import { useCallback, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  closing: boolean;
}

export const TOAST_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  error: 4200,
};

const EXIT_ANIMATION_MS = 220;
let nextId = 1;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, closing: true } : t)));
    window.clearTimeout(timers.current.get(id));
    const removeTimer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, EXIT_ANIMATION_MS);
    timers.current.set(id, removeTimer);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = String(nextId++);
      setToasts((prev) => [...prev, { id, message, type, closing: false }]);
      const timer = window.setTimeout(() => dismissToast(id), TOAST_DURATIONS[type]);
      timers.current.set(id, timer);
    },
    [dismissToast]
  );

  return { toasts, showToast, dismissToast };
}
