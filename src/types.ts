export type Role = "admin" | "manager";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  address: string | null;
  role: Role;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  brand_name: string | null;
  category: string | null;
  price: number;
  cost_price: number | null;
  stock_qty: number;
  low_stock_threshold: number;
  is_serialized: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UnitStatus = "in_stock" | "sold";

export interface ProductUnit {
  id: string;
  product_id: string;
  imei1: string | null;
  imei2: string | null;
  cost_price: number | null;
  status: UnitStatus;
  sold_voucher_line_id: string | null;
  created_at: string;
  updated_at: string;
}

export type VoucherStatus = "completed" | "void";

export interface Voucher {
  id: string;
  voucher_no: number;
  customer_id: string | null;
  staff_id: string;
  subtotal: number;
  trade_in_credit: number;
  grand_total: number;
  status: VoucherStatus;
  void_reason: string | null;
  voided_at: string | null;
  voided_by: string | null;
  created_at: string;
}

export type LineType = "sale" | "trade_in";
export type Condition = "excellent" | "good" | "fair" | "poor";

export interface VoucherLine {
  id: string;
  voucher_id: string;
  line_type: LineType;
  product_id: string | null;
  product_unit_id: string | null;
  name: string;
  tag: string;
  qty: number;
  unit_price: number | null;
  cost_price: number | null;
  amount: number;
  imei: string | null;
  condition: Condition | null;
  created_at: string;
}

export interface CartLine {
  id: string;
  lineType: LineType;
  name: string;
  tag: string;
  amount: number;
  productId?: string;
  unitId?: string;
  qty?: number;
  unitPrice?: number;
  imei?: string;
  condition?: Condition;
}
