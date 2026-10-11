import type { ResearchGame } from "./team-games";

export function formatClock(seconds: number): string {
  const s = Math.round(Math.abs(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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
