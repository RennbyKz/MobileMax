import { supabase } from "./supabaseClient";
import type { VoucherLine } from "../types";

export interface VoucherRow {
  id: string;
  voucher_no: number;
  subtotal: number;
  trade_in_credit: number;
  grand_total: number;
  status: "completed" | "void";
  created_at: string;
  customers: { name: string; phone: string | null } | null;
  profiles: { display_name: string | null; email: string } | null;
}

export async function fetchVouchers(): Promise<VoucherRow[]> {
  const { data, error } = await supabase
    .from("vouchers")
    .select(
      "id, voucher_no, subtotal, trade_in_credit, grand_total, status, created_at, customers(name, phone), profiles!vouchers_staff_id_fkey(display_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as unknown as VoucherRow[];
}

export async function fetchVoucherLines(voucherId: string): Promise<VoucherLine[]> {
  const { data, error } = await supabase
    .from("voucher_lines")
    .select("*")
    .eq("voucher_id", voucherId)
    .order("created_at");
  if (error) throw error;
  return data as VoucherLine[];
}

export interface RevenuePoint {
  day?: string;
  month?: string;
  voucher_count: number;
  total: number;
  total_cost: number;
  profit: number;
}

export async function fetchRevenueDaily(): Promise<RevenuePoint[]> {
  const { data, error } = await supabase.from("revenue_daily").select("*").limit(30);
  if (error) throw error;
  return data as RevenuePoint[];
}

export async function fetchRevenueMonthly(): Promise<RevenuePoint[]> {
  const { data, error } = await supabase.from("revenue_monthly").select("*").limit(12);
  if (error) throw error;
  return data as RevenuePoint[];
}
