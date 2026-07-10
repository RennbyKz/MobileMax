import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Product } from "../types";

interface ProductsContextValue {
  products: Product[];
  loading: boolean;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase
      .from("products")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("Failed to load products", error);
        setProducts((data as Product[]) ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel("products-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (payload) => {
        setProducts((prev) => {
          if (payload.eventType === "INSERT") {
            return [...prev, payload.new as Product].sort((a, b) => a.name.localeCompare(b.name));
          }
          if (payload.eventType === "UPDATE") {
            return prev.map((p) => (p.id === (payload.new as Product).id ? (payload.new as Product) : p));
          }
          if (payload.eventType === "DELETE") {
            return prev.filter((p) => p.id !== (payload.old as Product).id);
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

  return <ProductsContext.Provider value={{ products, loading }}>{children}</ProductsContext.Provider>;
}

export function useProductsContext() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProductsContext must be used within ProductsProvider");
  return ctx;
}
