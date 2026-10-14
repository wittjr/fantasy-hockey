import type { ResearchGame } from "./team-games";

export function formatClock(seconds: number): string {
  const s = Math.round(Math.abs(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const MINUS = "\u2212";

/** Signed m:ss for a TOI change; a change that rounds to zero shows ±0:00 so every Δ carries a sign. */
export function formatSignedClock(seconds: number): string {
  const magnitude = Math.round(Math.abs(seconds));
  if (magnitude === 0) return "±0:00";
  return `${seconds > 0 ? "+" : MINUS}${formatClock(magnitude)}`;
}

/** Signed whole number; a value that rounds to zero is `zero`. */
function signed(value: number, zero: string): string {
  const magnitude = Math.round(Math.abs(value));
  return magnitude === 0 ? zero : `${value > 0 ? "+" : MINUS}${magnitude}`;
}

/** Signed whole number (e.g. goal +/-); zero is unsigned. */
export function formatSignedInt(n: number): string {
  return signed(n, "0");
}

/** Signed whole percentage points for a PP share Δ; zero shows ±0 so every Δ carries a sign. */
export function formatPointsDelta(points: number): string {
  return signed(points, "±0");
}

export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function gameLabel(game: Pick<ResearchGame, "home" | "opponent">): string {
  return `${game.home ? "vs" : "@"} ${game.opponent}`;
}

export function resultLabel(game: Pick<ResearchGame, "score">): string {
  if (!game.score) return "";
  const { for: f, against: a } = game.score;
  return `${f > a ? "W" : "L"} ${f}–${a}`;
}
