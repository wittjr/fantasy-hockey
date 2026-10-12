"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StripCellState } from "@/lib/research/game-strip";

/**
 * One Per game square. Lets a click or tap open its popover (data-open), because touch screens have no hover and the
 * squares are small hover targets. A second click, an outside pointerdown or losing focus closes it. The popover itself
 * is server-rendered and passed in as children; its CSS shows it while this span carries data-open.
 */
export function ToiStripCell({
  label,
  state,
  className,
  children,
}: {
  label: string;
  state: StripCellState;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span
      ref={ref}
      data-state={state}
      data-open={open ? "" : undefined}
      tabIndex={0}
      role="img"
      aria-label={label}
      className={className}
      onClick={() => setOpen((o) => !o)}
      onBlur={() => setOpen(false)}
    >
      {children}
    </span>
  );
}
