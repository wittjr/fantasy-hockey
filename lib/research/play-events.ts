// Maps NHL play-by-play JSON to the shot and goal events that unit statistics count.
// Pure and tolerant: the JSON is untrusted, so a play that cannot be mapped is skipped, never thrown on.
import { parseClock } from "./lines";
import type { NhlPlayByPlay } from "@/lib/nhl/client";

export type EventKind = "goal" | "shot-on-goal" | "missed-shot" | "blocked-shot";
export type Exclusion = "shootout" | "penalty-shot" | "teammate-blocked";

export interface GameEvent {
  /** Abbrev of the shooting team (eventOwnerTeamId). */
  team: string;
  /** Period number; 4 or more is overtime, but only periodType says whether it is a shootout. */
  period: number;
  /** Seconds elapsed in the period. */
  t: number;
  kind: EventKind;
  /** Why the event is left out of every count, or null when it counts. */
  exclusion: Exclusion | null;
  /** True when a counted event happened with either goalie out of the net (D-21); such events go to Other. */
  pulledGoalie: boolean;
  /** The raw 4-digit code: away goalie, away skaters, home skaters, home goalie. "" when absent. */
  situationCode: string;
}

const KINDS = new Set<string>(["goal", "shot-on-goal", "missed-shot", "blocked-shot"]);
// Penalty shots: one skater against a goalie, either way round.
const PENALTY_SHOT_CODES = new Set(["1010", "0101"]);

export function toGameEvents(pbp: NhlPlayByPlay): GameEvent[] {
  const abbrev = new Map([
    [pbp.homeTeam.id, pbp.homeTeam.abbrev],
    [pbp.awayTeam.id, pbp.awayTeam.abbrev],
  ]);
  const events: GameEvent[] = [];
  for (const play of pbp.plays) {
    if (!KINDS.has(play.typeDescKey)) continue;
    const ownerId = play.details?.eventOwnerTeamId;
    const team = ownerId === undefined ? undefined : abbrev.get(ownerId);
    const t = parseClock(play.timeInPeriod);
    if (!team || t === null) continue;
    const code = play.situationCode ?? "";
    // Every blocked shot counts for the shooting team whatever the block reason (UAT G-03-1).
    const exclusion: Exclusion | null =
      play.periodDescriptor.periodType === "SO" ? "shootout" : PENALTY_SHOT_CODES.has(code) ? "penalty-shot" : null;
    events.push({
      team,
      period: play.periodDescriptor.number,
      t,
      kind: play.typeDescKey as EventKind,
      exclusion,
      pulledGoalie: exclusion === null && code.length === 4 && (code[0] === "0" || code[3] === "0"),
      situationCode: code,
    });
  }
  return events;
}
