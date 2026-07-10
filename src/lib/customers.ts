import { supabase } from "./supabaseClient";
import type { Customer } from "../types";

export async function searchCustomers(term: string): Promise<Customer[]> {
  const query = term.trim();
  if (!query) return [];
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .order("name")
    .limit(8);
  if (error) throw error;
  return data as Customer[];
}

export async function fetchAllCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.from("customers").select("*").order("name");
  if (error) throw error;
  return data as Customer[];
}

export async function createCustomer(input: {
  name: string;
  phone?: string;
  address?: string;
}): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert({ name: input.name, phone: input.phone || null, address: input.address || null })
    .select()
    .single();
  if (error) throw error;
  return data as Customer;
}
