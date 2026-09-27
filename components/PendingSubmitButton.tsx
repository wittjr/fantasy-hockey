"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/** Submit button that disables itself and shows a spinner while its form's action runs. */
export function PendingSubmitButton({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`inline-flex items-center gap-1.5 disabled:opacity-60 ${className ?? ""}`}>
      {children}
      <span
        aria-hidden
        className={`inline-block size-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700 transition-opacity dark:border-neutral-700 dark:border-t-neutral-200 ${
          pending ? "opacity-100" : "opacity-0"
        }`}
      />
    </button>
  );
}
