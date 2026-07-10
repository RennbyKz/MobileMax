import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import type { ProductUnit } from "../types";

interface ProductUnitsContextValue {
  units: ProductUnit[];
  loading: boolean;
}

const ProductUnitsContext = createContext<ProductUnitsContextValue | null>(null);

export function ProductUnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase
      .from("product_units")
      .select("*")
      .order("created_at")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("Failed to load product units", error);
        setUnits((data as ProductUnit[]) ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel("product-units-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_units" }, (payload) => {
        setUnits((prev) => {
          if (payload.eventType === "INSERT") {
            return [...prev, payload.new as ProductUnit];
          }
          if (payload.eventType === "UPDATE") {
            return prev.map((u) => (u.id === (payload.new as ProductUnit).id ? (payload.new as ProductUnit) : u));
          }
          if (payload.eventType === "DELETE") {
            return prev.filter((u) => u.id !== (payload.old as ProductUnit).id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return <ProductUnitsContext.Provider value={{ units, loading }}>{children}</ProductUnitsContext.Provider>;
}

export function useProductUnitsContext() {
  const ctx = useContext(ProductUnitsContext);
  if (!ctx) throw new Error("useProductUnitsContext must be used within ProductUnitsProvider");
  return ctx;
}
