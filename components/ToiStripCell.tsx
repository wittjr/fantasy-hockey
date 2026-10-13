"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StripCellState } from "@/lib/research/game-strip";
import type { LinemateCellState } from "@/lib/research/linemates";

export type CellEvent = "click" | "blur" | "enter" | "space" | "escape" | "outside" | "leave";

/** The popover's open state after an event: click, Enter and Space toggle it; blur, Escape and an outside pointerdown close it; a pointer leaving keeps a pin. */
export function nextOpen(open: boolean, event: CellEvent): boolean {
  if (event === "leave") return open;
  return event === "click" || event === "enter" || event === "space" ? !open : false;
}

/** Escape hides the popover without moving focus (WCAG 1.4.13); the next click, Enter, Space, blur or pointer leave clears it. */
export function nextDismissed(dismissed: boolean, event: CellEvent): boolean {
  if (event === "escape") return true;
  return event === "outside" ? dismissed : false;
}

/**
 * One strip square. Hover or keyboard focus shows its popover; a click or tap, Enter or Space pins it (data-open),
 * because touch screens have no hover. A second click, an outside pointerdown or losing focus unpins it. Escape hides
 * it without moving focus (data-dismissed) until the next click, Enter, Space, blur or pointer leave. The popover itself
 * is server-rendered and passed in as children; its CSS shows it on hover, focus or while this span carries data-open,
 * and hides it while this span carries data-dismissed.
 */
export function ToiStripCell({
  label,
  state,
  className,
  children,
}: {
  label: string;
  state: StripCellState | LinemateCellState;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  const send = (event: CellEvent) => {
    setOpen((o) => nextOpen(o, event));
    setDismissed((d) => nextDismissed(d, event));
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen((o) => nextOpen(o, "outside"));
        setDismissed((d) => nextDismissed(d, "outside"));
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // Escape also dismisses a popover that is showing on hover alone, where the square never took focus.
  useEffect(() => {
    if (!hovered) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen((o) => nextOpen(o, "escape"));
      setDismissed((d) => nextDismissed(d, "escape"));
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [hovered]);

  return (
    <span
      ref={ref}
      data-state={state}
      data-open={open ? "" : undefined}
      data-dismissed={dismissed ? "" : undefined}
      tabIndex={0}
      role="button"
      aria-label={label}
      className={className}
      onClick={() => send("click")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          send(e.key === "Enter" ? "enter" : "space");
        } else if (e.key === "Escape") {
          send("escape");
        }
      }}
      onBlur={() => send("blur")}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        send("leave");
      }}
    >
      {children}
    </span>
  );
}
