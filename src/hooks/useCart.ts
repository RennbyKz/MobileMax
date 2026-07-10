import { useMemo, useState } from "react";
import type { CartLine } from "../types";

let nextId = 1;

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);

  function addLine(line: Omit<CartLine, "id">) {
    setLines((prev) => [...prev, { ...line, id: String(nextId++) }]);
  }

  function addLines(newLines: Omit<CartLine, "id">[]) {
    setLines((prev) => [...prev, ...newLines.map((line) => ({ ...line, id: String(nextId++) }))]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((line) => line.id !== id));
  }

  function clearCart() {
    setLines([]);
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    let credit = 0;
    for (const line of lines) {
      if (line.amount < 0) credit += -line.amount;
      else subtotal += line.amount;
    }
    return { subtotal, credit, grandTotal: subtotal - credit };
  }, [lines]);

  return { lines, addLine, addLines, removeLine, clearCart, totals };
}

export type UseCartReturn = ReturnType<typeof useCart>;
