"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const PRESETS = [
  { value: "all", label: "All Time" },
  { value: "year", label: "This Year" },
  { value: "month_current", label: "This Month" },
  { value: "week", label: "This Week" },
  { value: "yesterday", label: "Yesterday" },
  { value: "today", label: "Today" },
];

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

// Shared keyboard handling for a simple button-triggered listbox: Escape
// closes and returns focus to the trigger, Arrow keys move the active
// option, Enter/Space selects it — the standard WAI-ARIA listbox pattern.
function useListboxKeyboard({
  open,
  setOpen,
  optionCount,
  onSelect,
  triggerRef,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  optionCount: number;
  onSelect: (index: number) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === " " || e.key === "ArrowDown") && !open) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(0);
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, optionCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(activeIndex);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return { activeIndex, setActiveIndex, onTriggerKeyDown, onListKeyDown };
}

export function DashboardControls({
  currentRange,
  currentLabel,
  hasExplicitMonth,
  availableMonths,
}: {
  currentRange: string;
  currentLabel: string;
  hasExplicitMonth: boolean;
  availableMonths: { ym: string; label: string }[];
}) {
  const router = useRouter();
  const [presetOpen, setPresetOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const presetRef = useClickOutside(() => setPresetOpen(false));
  const monthRef = useClickOutside(() => setMonthOpen(false));
  const customRef = useClickOutside(() => setCustomOpen(false));
  const presetTriggerRef = useRef<HTMLButtonElement>(null);
  const monthTriggerRef = useRef<HTMLButtonElement>(null);

  const presetKb = useListboxKeyboard({
    open: presetOpen,
    setOpen: setPresetOpen,
    optionCount: PRESETS.length,
    onSelect: (i) => go(PRESETS[i].value === "month_current" ? { range: "month" } : { range: PRESETS[i].value }),
    triggerRef: presetTriggerRef,
  });
  const monthKb = useListboxKeyboard({
    open: monthOpen,
    setOpen: setMonthOpen,
    optionCount: availableMonths.length,
    onSelect: (i) => availableMonths[i] && go({ range: "month", ym: availableMonths[i].ym }),
    triggerRef: monthTriggerRef,
  });

  // A "preset" is active when the range is one of the fixed presets, or
  // "This Month" was picked from the presets list (range=month with no
  // specific month chosen). A specific month picked from the Select Month
  // list takes over the Select Month button instead.
  const isPresetActive = ["all", "year", "week", "yesterday", "today"].includes(currentRange) || (currentRange === "month" && !hasExplicitMonth);
  const isMonthActive = currentRange === "month" && hasExplicitMonth;
  const isCustomActive = currentRange === "custom";

  const presetButtonLabel = isPresetActive ? currentLabel : "All Time";
  const monthButtonLabel = isMonthActive ? currentLabel : "Select Month";
  const customButtonLabel = isCustomActive ? currentLabel : "Custom Range";

  function go(params: Record<string, string>) {
    const qs = new URLSearchParams(params).toString();
    router.push(`/?${qs}`);
    setPresetOpen(false);
    setMonthOpen(false);
    setCustomOpen(false);
  }

  return (
    <div style={{ display: "flex", gap: 8, position: "relative" }}>
      <div ref={presetRef} style={{ position: "relative" }}>
        <button
          ref={presetTriggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={presetOpen}
          onClick={() => setPresetOpen((o) => !o)}
          onKeyDown={presetKb.onTriggerKeyDown}
          style={{
            padding: "7px 16px", borderRadius: 12, fontSize: 13, cursor: "pointer",
            background: isPresetActive ? "#E6E7B7" : "transparent",
            border: isPresetActive ? "none" : "1px solid #D8D8C7", color: "#2C2A26",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {isPresetActive ? presetButtonLabel : "All Time"} <span style={{ fontSize: 10 }}>▾</span>
        </button>
        {presetOpen && (
          <div role="listbox" onKeyDown={presetKb.onListKeyDown} tabIndex={-1} ref={(el) => el?.focus()} style={{ position: "absolute", top: "110%", left: 0, background: "#FBFCF6", border: "1px solid #D8D8C7", borderRadius: 12, padding: 6, minWidth: 150, zIndex: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            {PRESETS.map((p, i) => (
              <button
                key={p.value}
                type="button"
                role="option"
                aria-selected={i === presetKb.activeIndex}
                onMouseEnter={() => presetKb.setActiveIndex(i)}
                onClick={() => go(p.value === "month_current" ? { range: "month" } : { range: p.value })}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", fontSize: 13, background: i === presetKb.activeIndex ? "#E6E7B7" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", color: "#2C2A26" }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={monthRef} style={{ position: "relative" }}>
        <button
          ref={monthTriggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={monthOpen}
          onClick={() => setMonthOpen((o) => !o)}
          onKeyDown={monthKb.onTriggerKeyDown}
          style={{
            padding: "7px 16px", borderRadius: 12, fontSize: 13, cursor: "pointer",
            background: isMonthActive ? "#E6E7B7" : "transparent",
            border: isMonthActive ? "none" : "1px solid #D8D8C7", color: "#2C2A26",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {monthButtonLabel} <span style={{ fontSize: 10 }}>▾</span>
        </button>
        {monthOpen && (
          <div role="listbox" onKeyDown={monthKb.onListKeyDown} tabIndex={-1} ref={(el) => el?.focus()} style={{ position: "absolute", top: "110%", left: 0, background: "#FBFCF6", border: "1px solid #D8D8C7", borderRadius: 12, padding: 6, minWidth: 160, maxHeight: 280, overflowY: "auto", zIndex: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
            {availableMonths.length === 0 ? (
              <div style={{ padding: 10, fontSize: 12, color: "#8A867B" }}>No order history yet.</div>
            ) : (
              availableMonths.map((m, i) => (
                <button
                  key={m.ym}
                  type="button"
                  role="option"
                  aria-selected={i === monthKb.activeIndex}
                  onMouseEnter={() => monthKb.setActiveIndex(i)}
                  onClick={() => go({ range: "month", ym: m.ym })}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", fontSize: 13, background: i === monthKb.activeIndex ? "#E6E7B7" : "transparent", border: "none", borderRadius: 8, cursor: "pointer", color: "#2C2A26" }}
                >
                  {m.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div ref={customRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setCustomOpen((o) => !o)}
          style={{
            padding: "7px 16px", borderRadius: 12, fontSize: 13, cursor: "pointer",
            background: isCustomActive ? "#E6E7B7" : "transparent",
            border: isCustomActive ? "none" : "1px solid #D8D8C7", color: "#2C2A26",
          }}
        >
          {customButtonLabel}
        </button>
        {customOpen && (
          <div onKeyDown={(e) => { if (e.key === "Escape") setCustomOpen(false); }} style={{ position: "absolute", top: "110%", right: 0, background: "#FBFCF6", border: "1px solid #D8D8C7", borderRadius: 12, padding: 14, zIndex: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", gap: 8, minWidth: 220 }}>
            <label style={{ fontSize: 11, color: "#8A867B" }}>
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4, height: 32, fontSize: 13 }} />
            </label>
            <label style={{ fontSize: 11, color: "#8A867B" }}>
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4, height: 32, fontSize: 13 }} />
            </label>
            <button
              type="button"
              disabled={!from || !to}
              onClick={() => go({ range: "custom", from, to })}
              style={{ marginTop: 4, padding: "7px 12px", borderRadius: 8, fontSize: 13, background: "#2C2A26", color: "#FBFCF6", border: "none", cursor: from && to ? "pointer" : "default", opacity: from && to ? 1 : 0.5 }}
            >
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
