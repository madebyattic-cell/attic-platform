"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

export function BackLink({ fallbackHref, label = "Back" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();

  function handleClick(e: MouseEvent) {
    e.preventDefault();
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <a href={fallbackHref} onClick={handleClick} style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
      ← {label}
    </a>
  );
}
