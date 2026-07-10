import { supabase } from "./supabaseClient";
import type { CartLine, Voucher } from "../types";

interface SubmitVoucherInput {
  customerId: string | null;
  lines: CartLine[];
  totals: { subtotal: number; credit: number; grandTotal: number };
}

export async function submitVoucher({ customerId, lines, totals }: SubmitVoucherInput): Promise<Voucher> {
  const payload = lines.map((line) => ({
    lineType: line.lineType,
    productId: line.productId ?? "",
    unitId: line.unitId ?? "",
    name: line.name,
    tag: line.tag,
    qty: line.qty ?? 1,
    unitPrice: line.unitPrice ?? "",
    amount: line.amount,
    imei: line.imei ?? "",
    condition: line.condition ?? "",
  }));

  const { data, error } = await supabase.rpc("create_voucher", {
    p_customer_id: customerId,
    p_subtotal: totals.subtotal,
    p_trade_in_credit: totals.credit,
    p_grand_total: totals.grandTotal,
    p_lines: payload,
  });
  if (error) throw error;
  return data as Voucher;
}

export async function voidVoucher(voucherId: string, reason: string): Promise<Voucher> {
  const { data, error } = await supabase.rpc("void_voucher", {
    p_voucher_id: voucherId,
    p_reason: reason,
  });
  if (error) throw error;
  return data as Voucher;
}

export async function deleteVoucher(voucherId: string): Promise<void> {
  const { data, error } = await supabase.from("vouchers").delete().eq("id", voucherId).select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Voucher must be voided before it can be deleted.");
  }
}
