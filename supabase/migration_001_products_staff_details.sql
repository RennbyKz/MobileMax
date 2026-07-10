-- MobileMax — migration 001: staff contact details, per-unit IMEI tracking, cost price / profit
-- Run once against the live project (SQL Editor). Nothing in this file has been applied yet,
-- so this is the complete, final design in one shot.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists address text;

-- ============================================================
-- Products: brand + serialized/cost-price support
-- ============================================================

alter table public.products
  add column if not exists brand_name text,
  add column if not exists is_serialized boolean not null default false,
  add column if not exists cost_price numeric(12, 2);

-- products had NO delete policy at all before this — RLS was silently denying every delete.
drop policy if exists products_delete_all on public.products;
create policy products_delete_all on public.products
  for delete to authenticated using (true);

-- ============================================================
-- Product units: one row per physical serialized device (e.g. each phone),
-- each with its own IMEI1/IMEI2 and purchase cost. products.stock_qty stays
-- authoritative for non-serialized items and is kept in sync automatically
-- (via trigger below) for serialized ones — every existing reader of
-- stock_qty (low-stock badge, out-of-stock disabling, stock report) needs
-- no changes at all.
-- ============================================================

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
-- Prevents two active listings of the same physical device, while still allowing
-- the same IMEI to reappear later if a device is sold and later traded back in.
create unique index product_units_imei1_active_idx
  on public.product_units (imei1) where imei1 is not null and status = 'in_stock';

alter table public.product_units enable row level security;
create policy product_units_select_all on public.product_units
  for select to authenticated using (true);
create policy product_units_insert_all on public.product_units
  for insert to authenticated with check (true);
create policy product_units_update_all on public.product_units
  for update to authenticated using (true) with check (true);
create policy product_units_delete_all on public.product_units
  for delete to authenticated using (true);

alter publication supabase_realtime add table public.product_units;

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

-- ============================================================
-- Voucher lines: record exactly which physical unit sold + its cost basis
-- ============================================================

alter table public.voucher_lines
  add column if not exists product_unit_id uuid references public.product_units(id),
  add column if not exists cost_price numeric(12, 2);

alter table public.product_units
  add constraint product_units_sold_voucher_line_id_fkey
  foreign key (sold_voucher_line_id) references public.voucher_lines(id);

-- ============================================================
-- Checkout / void RPCs — now unit-aware
-- ============================================================

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

-- ============================================================
-- Revenue views — profit-aware. Vouchers and costed lines are aggregated
-- SEPARATELY then combined, to avoid a join fan-out that would otherwise
-- multiply grand_total by each voucher's line count.
-- ============================================================

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
