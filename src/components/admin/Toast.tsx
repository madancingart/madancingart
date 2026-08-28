"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type ToastKind = "ok" | "err";

type ToastItem = {
  id: number;
  kind: ToastKind;
  text: string;
};

type ToastApi = {
  push: (kind: ToastKind, text: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast wymaga ToastProvider");
  }
  return value;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setItems((current) => [...current, { id, kind, text }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-16 z-50 flex w-[min(100%-2rem,22rem)] flex-col gap-2 md:bottom-4">
        {items.map((item) => (
          <p
            key={item.id}
            role="status"
            className={cn(
              "pointer-events-auto border px-3 py-2 text-[13px]",
              item.kind === "ok"
                ? "border-gold/50 bg-black-soft text-cream"
                : "border-red-400/40 bg-black-soft text-cream",
            )}
          >
            {item.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
