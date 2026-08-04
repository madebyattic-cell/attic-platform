"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; kind: "success" | "error" };
type ToastContextValue = { show: (message: string, kind?: "success" | "error") => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: "success" | "error" = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 8, zIndex: 1000 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.kind === "error" ? "#F6E2DE" : "#EDEDE4",
              color: t.kind === "error" ? "#A3402E" : "#2C2A26",
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 13,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 200,
              textAlign: "center",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
