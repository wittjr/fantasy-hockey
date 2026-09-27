"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

/** Spinner shown while the enclosing Link's navigation is pending. Always rendered, so no layout shift. */
function PendingSpinner() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`inline-block size-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700 transition-opacity dark:border-neutral-700 dark:border-t-neutral-200 ${
        pending ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

/**
 * A Link that shows a small spinner while navigating. For links that only change search
 * params on a slow dynamic page (e.g. the planner's week links), where loading.tsx doesn't
 * show and the old page otherwise just sits there. Prefetch is off so the pending state
 * isn't skipped - and so hovering doesn't kick off the page's expensive data loads.
 */
export function PendingLink({ children, className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link prefetch={false} {...props} className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {children}
      <PendingSpinner />
    </Link>
  );
}
