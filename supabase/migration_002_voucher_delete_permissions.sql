-- MobileMax — migration 002: voucher delete (admin-only, void-only) + role permission tightening
-- Run once against the live project (SQL Editor). Idempotent — safe to re-run.

-- Deleting a voucher must cascade to its lines (otherwise the delete fails with an
-- FK violation), and any product_unit that still points at a deleted line (shouldn't
-- normally happen since void_voucher already clears this, but defensive) should just
-- lose that reference rather than block the delete.
alter table public.voucher_lines
  drop constraint if exists voucher_lines_voucher_id_fkey,
  add constraint voucher_lines_voucher_id_fkey
    foreign key (voucher_id) references public.vouchers(id) on delete cascade;

alter table public.product_units
  drop constraint if exists product_units_sold_voucher_line_id_fkey,
  add constraint product_units_sold_voucher_line_id_fkey
    foreign key (sold_voucher_line_id) references public.voucher_lines(id) on delete set null;

-- Only admins can delete a voucher, and only once it's already been voided —
-- this reuses void_voucher's restock logic as a safety rail so a live completed
-- sale can never be removed without first reversing its stock/credit effects.
drop policy if exists vouchers_delete_admin_only on public.vouchers;
create policy vouchers_delete_admin_only on public.vouchers
  for delete to authenticated using (is_admin() and status = 'void');

drop policy if exists voucher_lines_delete_admin_only on public.voucher_lines;
create policy voucher_lines_delete_admin_only on public.voucher_lines
  for delete to authenticated using (is_admin());
