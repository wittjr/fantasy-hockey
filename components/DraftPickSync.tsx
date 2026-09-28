"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftSyncResult } from "@/lib/fantrax/draft-sync";

const LEAD_MS = 60_000;
const INTERVAL_MS = 15_000;

type Mode = "scheduled" | "polling" | "stopped";

/**
 * Polls the live Fantrax draft while this page is open: from 1 minute before the draft
 * starts, every 15 seconds until Fantrax reports it completed. Start/Stop override the
 * schedule. The action re-renders the page whenever picks change the available pool or your team.
 */
export function DraftPickSync({
  syncAction,
  draftStartMs,
  initialState,
  alreadySynced,
}: {
  syncAction: () => Promise<DraftSyncResult>;
  draftStartMs: number;
  initialState: string;
  /** True once this completed draft's catch-up sync has run. */
  alreadySynced: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialState === "completed" ? "stopped" : "scheduled");
  const [result, setResult] = useState<DraftSyncResult | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [lastChanges, setLastChanges] = useState<{ at: Date; lines: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextSyncAt, setNextSyncAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Bumped by "Sync now" while auto-syncing: restarts the polling loop, so the manual check
  // runs immediately and the next automatic one is a full 15s after it.
  const [pollEpoch, setPollEpoch] = useState(0);
  const inFlight = useRef(false);
  // The page re-renders after every sync that changes something, which can hand us a new action
  // reference - read it through a ref so that doesn't restart the timers below.
  const actionRef = useRef(syncAction);
  useEffect(() => {
    actionRef.current = syncAction;
  }, [syncAction]);

  const sync = useCallback(async () => {
    if (inFlight.current) return null;
    inFlight.current = true;
    try {
      const r = await actionRef.current();
      setResult(r);
      setError(null);
      if (r.changes.length > 0) setLastChanges({ at: new Date(), lines: r.changes });
      return r;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLastChecked(new Date());
      inFlight.current = false;
    }
  }, []);

  // A completed draft gets one catch-up sync, in case the page wasn't open for the end. The
  // server records it once it succeeds, so later page loads skip this.
  useEffect(() => {
    if (initialState === "completed" && !alreadySynced) void sync();
  }, [initialState, alreadySynced, sync]);

  useEffect(() => {
    if (mode !== "scheduled") return;
    const timeout = setTimeout(() => setMode("polling"), Math.max(0, draftStartMs - LEAD_MS - Date.now()));
    return () => clearTimeout(timeout);
  }, [mode, draftStartMs]);

  useEffect(() => {
    if (mode !== "polling") return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      setNextSyncAt(null);
      const r = await sync();
      if (cancelled) return;
      if (r?.state === "completed") {
        setMode("stopped");
        return;
      }
      setNextSyncAt(Date.now() + INTERVAL_MS);
      timeout = setTimeout(run, INTERVAL_MS);
    };
    void run();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearInterval(clock);
      setNextSyncAt(null);
    };
  }, [mode, pollEpoch, sync]);

  const startLabel = new Date(draftStartMs).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  const completed = (result?.state ?? initialState) === "completed";

  let status: string;
  if (mode === "polling") {
    status = nextSyncAt === null ? "Checking Fantrax…" : `Next check in ${Math.max(0, Math.ceil((nextSyncAt - now) / 1000))}s.`;
  } else if (completed) status = "Draft complete.";
  else if (mode === "scheduled") status = `Draft starts ${startLabel}; auto-sync begins a minute before (keep this page open).`;
  else status = "Auto-sync stopped.";

  const buttonClass =
    "rounded-md border border-sky-300 px-3 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-950/40";

  return (
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-sky-200 bg-sky-50/60 px-4 py-2 text-sm dark:border-sky-900/60 dark:bg-sky-950/20">
      <div className="flex flex-col">
        <span className="font-medium text-sky-900 dark:text-sky-200">
          Live draft sync: <span className="font-normal">{status}</span>
        </span>
        <span className="text-xs text-sky-800/70 dark:text-sky-200/60">
          {result && `${result.picksMade} of ${result.totalPicks} picks made. `}
          {lastChecked && `Last checked ${lastChecked.toLocaleTimeString()}.`}
        </span>
        {lastChanges && (
          <div className="mt-1 text-xs text-sky-900 dark:text-sky-100">
            <span className="text-sky-800/70 dark:text-sky-200/60">Changes at {lastChanges.at.toLocaleTimeString()}:</span>
            <ul>
              {lastChanges.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {error && <span className="text-xs text-red-600 dark:text-red-400">Sync failed: {error}</span>}
        {result?.errors.map((e) => (
          <span key={e} className="text-xs text-red-600 dark:text-red-400">
            {e}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        {mode === "polling" ? (
          <button type="button" onClick={() => setMode("stopped")} className={buttonClass}>
            Stop auto-sync
          </button>
        ) : (
          <button type="button" onClick={() => setMode("polling")} className={buttonClass}>
            Start auto-sync
          </button>
        )}
        <button
          type="button"
          onClick={() => (mode === "polling" ? setPollEpoch((e) => e + 1) : void sync())}
          className={buttonClass}
        >
          Sync now
        </button>
      </div>
    </div>
  );
}
