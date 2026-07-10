-- MobileMax — Supabase schema
-- Run this once, top to bottom, in the Supabase SQL Editor.
-- Safe to re-run: uses `create or replace` for functions/views and
-- `create table` (will error if tables already exist — drop first if re-seeding).

create extension if not exists pgcrypto;

-- ============================================================
-- Tables
-- ============================================================

-- Staff. One row per auth.users row, auto-created by the trigger below.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  phone text,
  address text,
  role text not null default 'manager' check (role in ('admin', 'manager')),
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index customers_name_lower_idx on public.customers (lower(name));
create index customers_phone_idx on public.customers (phone);

-- A catalog row. Non-serialized items (accessories) are tracked as a simple stock_qty
-- count. Serialized items (phones) set is_serialized=true and stock_qty is then kept
-- in sync automatically from the count of in-stock product_units (see trigger below) —
-- every reader of stock_qty (low-stock badge, sell/trade-in availability, stock report)
-- needs no special-casing for which kind of product it's looking at.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_name text,
  category text,
  price numeric(12, 2) not null check (price >= 0),
  cost_price numeric(12, 2),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  low_stock_threshold integer not null default 3,
  is_serialized boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per physical serialized device (e.g. each individual phone), each with its
-- own IMEI1/IMEI2 and purchase cost. Only meaningful when the parent product has
-- is_serialized = true.
create table public.product_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  imei1 text,
  imei2 text,
  cost_price numeric(12, 2),
  status text not null default 'in_stock' check (status in ('in_stock', 'sold')),
  sold_voucher_line_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_units_product_id_idx on public.product_units (product_id);
-- Prevents two active listings of the same physical device, while still allowing the
-- same IMEI to reappear later if a device is sold and later traded back in.
create unique index product_units_imei1_active_idx
  on public.product_units (imei1) where imei1 is not null and status = 'in_stock';

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_no bigint generated always as identity unique,
  customer_id uuid references public.customers(id),
  staff_id uuid not null references public.profiles(id),
  subtotal numeric(12, 2) not null,
  trade_in_credit numeric(12, 2) not null default 0,
  grand_total numeric(12, 2) not null,
  status text not null default 'completed' check (status in ('completed', 'void')),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index vouchers_created_at_idx on public.vouchers (created_at desc);
create index vouchers_customer_id_idx on public.vouchers (customer_id);

create table public.voucher_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  line_type text not null check (line_type in ('sale', 'trade_in')),
  product_id uuid references public.products(id),
  product_unit_id uuid references public.product_units(id),
  name text not null,
  tag text not null,
  qty integer not null default 1,
  unit_price numeric(12, 2),
  cost_price numeric(12, 2), -- snapshotted at sale time, same reasoning as unit_price
  amount numeric(12, 2) not null, -- negative = credit, matches the app's CartLine.amount convention
  imei text,
  condition text check (condition in ('excellent', 'good', 'fair', 'poor')),
  created_at timestamptz not null default now()
);
create index voucher_lines_voucher_id_idx on public.voucher_lines (voucher_id);

alter table public.product_units
  add constraint product_units_sold_voucher_line_id_fkey
  foreign key (sold_voucher_line_id) references public.voucher_lines(id) on delete set null;

-- ============================================================
-- Functions & triggers
-- ============================================================

-- Role check used by RLS. SECURITY DEFINER so it can read profiles
-- without recursing back through the profiles RLS policy.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Auto-provision a profile row whenever a user is created (e.g. via the Dashboard
-- or the in-app Staff page's "Create staff account" form).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'manager'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keeps products.stock_qty in sync with the live count of in-stock units,
-- for serialized products only. Non-serialized products are unaffected —
-- their stock_qty is still adjusted directly (see products_update_all below).
create or replace function public.sync_product_stock_from_units()
returns trigger language plpgsql as $$
declare
  affected_product uuid;
begin
  affected_product := coalesce(new.product_id, old.product_id);
  update public.products
  set stock_qty = (
        select count(*) from public.product_units
        where product_id = affected_product and status = 'in_stock'
      ),
      updated_at = now()
  where id = affected_product and is_serialized = true;
  return null;
end;
$$;

drop trigger if exists trg_sync_product_stock on public.product_units;
create trigger trg_sync_product_stock
  after insert or update or delete on public.product_units
  for each row execute function public.sync_product_stock_from_units();

-- Atomic checkout: voucher header + all lines + stock decrement (or unit claim) in one
-- transaction. p_lines is a jsonb array of {lineType, productId, unitId, name, tag, qty,
-- unitPrice, amount, imei, condition}. Cost is always resolved server-side (from the
-- unit or the product's cost_price at the moment of sale), never trusting client input.
create or replace function public.create_voucher(
  p_customer_id uuid,
  p_subtotal numeric,
  p_trade_in_credit numeric,
  p_grand_total numeric,
  p_lines jsonb
)
returns public.vouchers
language plpgsql security invoker as $$
declare
  v_voucher public.vouchers;
  v_line jsonb;
  v_line_id uuid;
  v_unit_id uuid;
  v_claimed uuid;
  v_product_id uuid;
  v_cost numeric;
begin
  insert into public.vouchers (customer_id, staff_id, subtotal, trade_in_credit, grand_total)
  values (p_customer_id, auth.uid(), p_subtotal, p_trade_in_credit, p_grand_total)
  returning * into v_voucher;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_unit_id := nullif(v_line ->> 'unitId', '')::uuid;
    v_product_id := nullif(v_line ->> 'productId', '')::uuid;
    v_cost := null;

    if (v_line ->> 'lineType') = 'sale' and v_product_id is not null then
      if v_unit_id is not null then
        select cost_price into v_cost from public.product_units where id = v_unit_id;
      else
        select cost_price into v_cost from public.products where id = v_product_id;
      end if;
    end if;

    insert into public.voucher_lines (
      voucher_id, line_type, product_id, product_unit_id, name, tag, qty, unit_price, amount, imei, condition, cost_price
    )
    values (
      v_voucher.id,
      v_line ->> 'lineType',
      v_product_id,
      v_unit_id,
      v_line ->> 'name',
      v_line ->> 'tag',
      coalesce((v_line ->> 'qty')::int, 1),
      nullif(v_line ->> 'unitPrice', '')::numeric,
      (v_line ->> 'amount')::numeric,
      nullif(v_line ->> 'imei', ''),
      nullif(v_line ->> 'condition', ''),
      v_cost
    )
    returning id into v_line_id;

    if (v_line ->> 'lineType') = 'sale' and v_unit_id is not null then
      update public.product_units
      set status = 'sold', sold_voucher_line_id = v_line_id, updated_at = now()
      where id = v_unit_id and status = 'in_stock'
      returning id into v_claimed;

      if v_claimed is null then
        raise exception 'This unit was just sold by someone else — pick another.';
      end if;
    elsif (v_line ->> 'lineType') = 'sale' and v_product_id is not null then
      update public.products
      set stock_qty = stock_qty - coalesce((v_line ->> 'qty')::int, 1), updated_at = now()
      where id = v_product_id;
    end if;
  end loop;

  return v_voucher;
end;
$$;
grant execute on function public.create_voucher(uuid, numeric, numeric, numeric, jsonb) to authenticated;

-- Void: flip status, restock whatever it sold (unit or qty), block double-void.
create or replace function public.void_voucher(p_voucher_id uuid, p_reason text)
returns public.vouchers
language plpgsql security invoker as $$
declare
  v_voucher public.vouchers;
  v_line record;
begin
  update public.vouchers
  set status = 'void', void_reason = p_reason, voided_at = now(), voided_by = auth.uid()
  where id = p_voucher_id and status = 'completed'
  returning * into v_voucher;

  if v_voucher.id is null then
    raise exception 'Voucher not found or already void';
  end if;

  for v_line in
    select * from public.voucher_lines
    where voucher_id = p_voucher_id and line_type = 'sale'
  loop
    if v_line.product_unit_id is not null then
      update public.product_units
      set status = 'in_stock', sold_voucher_line_id = null, updated_at = now()
      where id = v_line.product_unit_id;
    elsif v_line.product_id is not null then
      update public.products
      set stock_qty = stock_qty + v_line.qty, updated_at = now()
      where id = v_line.product_id;
    end if;
  end loop;

  return v_voucher;
end;
$$;
grant execute on function public.void_voucher(uuid, text) to authenticated;

-- Defense in depth: once a voucher is voided it can never change again,
-- and only status/void columns may ever be updated.
create or replace function public.enforce_voucher_immutability()
returns trigger
language plpgsql as $$
begin
  if old.status = 'void' then
    raise exception 'Voucher % is void and cannot be modified', old.id;
  end if;
  if new.customer_id is distinct from old.customer_id
     or new.staff_id is distinct from old.staff_id
     or new.subtotal is distinct from old.subtotal
     or new.trade_in_credit is distinct from old.trade_in_credit
     or new.grand_total is distinct from old.grand_total then
    raise exception 'Only status/void fields may change on a voucher';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_voucher_immutability on public.vouchers;
create trigger trg_voucher_immutability
  before update on public.vouchers
  for each row execute function public.enforce_voucher_immutability();

-- ============================================================
-- Reporting views
-- ============================================================

-- Vouchers and costed lines are aggregated SEPARATELY then combined, to avoid a join
-- fan-out that would otherwise multiply grand_total by each voucher's line count.
create or replace view public.revenue_daily with (security_invoker = true) as
  select d.day, d.voucher_count, d.total, coalesce(c.total_cost, 0) as total_cost,
         d.total - coalesce(c.total_cost, 0) as profit
  from (
    select date_trunc('day', created_at)::date as day, count(*) as voucher_count, sum(grand_total) as total
    from public.vouchers where status = 'completed' group by 1
  ) d
  left join (
    select date_trunc('day', v.created_at)::date as day, sum(vl.cost_price * vl.qty) as total_cost
    from public.vouchers v
    join public.voucher_lines vl on vl.voucher_id = v.id and vl.line_type = 'sale'
    where v.status = 'completed'
    group by 1
  ) c on c.day = d.day
  order by d.day desc;

create or replace view public.revenue_monthly with (security_invoker = true) as
  select d.month, d.voucher_count, d.total, coalesce(c.total_cost, 0) as total_cost,
         d.total - coalesce(c.total_cost, 0) as profit
  from (
    select date_trunc('month', created_at)::date as month, count(*) as voucher_count, sum(grand_total) as total
    from public.vouchers where status = 'completed' group by 1
  ) d
  left join (
    select date_trunc('month', v.created_at)::date as month, sum(vl.cost_price * vl.qty) as total_cost
    from public.vouchers v
    join public.voucher_lines vl on vl.voucher_id = v.id and vl.line_type = 'sale'
    where v.status = 'completed'
    group by 1
  ) c on c.month = d.month
  order by d.month desc;

grant select on public.revenue_daily to authenticated;
grant select on public.revenue_monthly to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.product_units enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_lines enable row level security;

-- profiles: any staff member can see everyone (needed for "sold by X"); only admins change roles.
create policy profiles_select_all on public.profiles
  for select to authenticated using (true);
create policy profiles_update_admin_only on public.profiles
  for update to authenticated using (is_admin()) with check (is_admin());

-- customers: any staff can search/create/edit.
create policy customers_select_all on public.customers
  for select to authenticated using (true);
create policy customers_insert_all on public.customers
  for insert to authenticated with check (true);
create policy customers_update_all on public.customers
  for update to authenticated using (true) with check (true);

-- products: any staff can view/add/edit/delete (never-sold items only — the FK from
-- voucher_lines blocks deleting a product with sale history; archive via is_active instead).
create policy products_select_all on public.products
  for select to authenticated using (true);
create policy products_insert_all on public.products
  for insert to authenticated with check (true);
create policy products_update_all on public.products
  for update to authenticated using (true) with check (true);
create policy products_delete_all on public.products
  for delete to authenticated using (true);

-- product_units: same access shape as products.
create policy product_units_select_all on public.product_units
  for select to authenticated using (true);
create policy product_units_insert_all on public.product_units
  for insert to authenticated with check (true);
create policy product_units_update_all on public.product_units
  for update to authenticated using (true) with check (true);
create policy product_units_delete_all on public.product_units
  for delete to authenticated using (true);

-- vouchers: any staff reads all; you can only insert a voucher under your own staff_id;
-- update is allowed only for voiding (the immutability trigger enforces the rest).
create policy vouchers_select_all on public.vouchers
  for select to authenticated using (true);
create policy vouchers_insert_own on public.vouchers
  for insert to authenticated with check (staff_id = auth.uid());
create policy vouchers_update_for_void on public.vouchers
  for update to authenticated using (true) with check (true);
-- Only admins can delete a voucher, and only once it's already been voided — this
-- reuses void_voucher's restock logic as a safety rail so a live completed sale can
-- never be removed without first reversing its stock/credit effects.
create policy vouchers_delete_admin_only on public.vouchers
  for delete to authenticated using (is_admin() and status = 'void');

-- voucher_lines: read all; insert only into a voucher you just created; never updated or deleted.
create policy voucher_lines_select_all on public.voucher_lines
  for select to authenticated using (true);
create policy voucher_lines_insert_own_voucher on public.voucher_lines
  for insert to authenticated
  with check (exists (select 1 from public.vouchers v where v.id = voucher_id and v.staff_id = auth.uid()));
create policy voucher_lines_delete_admin_only on public.voucher_lines
  for delete to authenticated using (is_admin());

-- ============================================================
-- Realtime
-- ============================================================

alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.product_units;
alter publication supabase_realtime add table public.vouchers;
alter publication supabase_realtime add table public.voucher_lines;

-- ============================================================
-- One-time manual steps after running this script:
--
-- 1. Authentication -> Providers -> Email: turn OFF "Enable email confirmations"
--    (new logins — whether created via the Dashboard or the in-app Staff page's
--    "Create staff account" form — should be usable immediately).
-- 2. Authentication -> Users -> Add User: create your very first login
--    (real email + password; optionally set metadata {"display_name": "..."}).
--    Every login after this one can be created from the in-app Staff page instead.
-- 3. Promote that first user to admin (required once — the trigger defaults everyone to 'manager'):
--      update public.profiles set role = 'admin' where email = 'owner@example.com';
-- 4. From then on, admins can create and promote/demote additional staff accounts
--    directly from the in-app Staff page — no further manual Dashboard steps needed.
-- ============================================================
