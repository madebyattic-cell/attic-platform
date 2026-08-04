"use client";

import { useState } from "react";

type Item = { name: string; quantity: number; gross: string };

export function ExpandableOrderRow({
  label,
  customerLabel,
  itemCount,
  gross,
  items,
}: {
  label: string;
  customerLabel: string;
  itemCount: number;
  gross: string;
  items: Item[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: "1px solid #D8D8C7" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "grid", gridTemplateColumns: "1fr 1.4fr 0.9fr 0.8fr", width: "100%",
          background: "transparent", border: "none", cursor: "pointer", padding: "5px 0", fontSize: 12, textAlign: "left",
        }}
      >
        <span style={{ color: "#8A867B" }}>{label}</span>
        <span style={{ color: "#2C2A26" }}>{customerLabel}</span>
        <span style={{ color: "#8A867B", display: "flex", alignItems: "center", gap: 4 }}>
          {itemCount} items <span style={{ fontSize: 9, transform: open ? "rotate(180deg)" : "none" }}>▾</span>
        </span>
        <span style={{ color: "#2C2A26" }}>{gross}</span>
      </button>
      {open && (
        <div style={{ padding: "4px 0 10px 12px" }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8A867B", padding: "3px 0" }}>
              <span>{it.quantity}× {it.name}</span>
              <span>{it.gross}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
