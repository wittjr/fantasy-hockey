import type { AvailablePlayer, DailySlot, GamesByTeam, PlannerRosterPlayer } from "./types";

// Slots any skater can fill. Yahoo calls it "Util"; other platforms use similar names.
const SKATER_FLEX_SLOTS = new Set(["UTIL", "SKATER", "SKT", "FLEX"]);
const FORWARD_POSITIONS = new Set(["C", "LW", "RW", "F", "W"]);

export function isFlexSlot(slot: string): boolean {
  return SKATER_FLEX_SLOTS.has(slot.toUpperCase());
}

/**
 * Whether a player with these eligible positions can occupy a lineup slot. Handles the
 * common hockey conventions across platforms: exact position match, forward buckets
 * ("F" takes C/LW/RW, "W" takes LW/RW) and skater flex slots ("Util" takes any non-goalie).
 */
export function canFillSlot(slot: string, eligiblePositions: readonly string[]): boolean {
  const s = slot.toUpperCase();
  const eligible = eligiblePositions.map((p) => p.toUpperCase());
  if (eligible.includes(s)) return true;
  if (SKATER_FLEX_SLOTS.has(s)) return eligible.some((p) => p !== "G");
  if (s === "F") return eligible.some((p) => FORWARD_POSITIONS.has(p));
  if (s === "W") return eligible.some((p) => p === "LW" || p === "RW");
  return false;
}

/** Expands { C: 2, Util: 1 } to ["C", "C", "Util"], with flex slots last so specific slots fill first. */
export function expandSlots(lineupSlots: Record<string, number>): string[] {
  const entries = Object.entries(lineupSlots).sort(([a], [b]) => Number(isFlexSlot(a)) - Number(isFlexSlot(b)));
  return entries.flatMap(([slot, count]) => Array<string>(count).fill(slot));
}

// Display order for lineup slot types: forwards, then D, then skater flex, then G.
const SLOT_DISPLAY_ORDER = ["C", "LW", "RW", "W", "F", "D", "UTIL", "SKATER", "SKT", "FLEX", "G"];

/** Lineup slot types in display order (forwards, D, flex, G); unrecognized slots go last. */
export function orderSlotTypes(lineupSlots: Record<string, number>): string[] {
  const rank = (slot: string) => {
    const i = SLOT_DISPLAY_ORDER.indexOf(slot.toUpperCase());
    return i === -1 ? SLOT_DISPLAY_ORDER.length : i;
  };
  return Object.keys(lineupSlots).sort((a, b) => rank(a) - rank(b));
}

/**
 * Bipartite matching (Kuhn's algorithm; lineups are ~20 slots so this is instant), adding
 * players in the given order. Each later player only gets in if everyone already placed
 * can be shuffled to keep a slot - so ordering by value gives the max-value lineup.
 * Returns, for each slot, the index of the player in it (or -1).
 */
function assignInOrder(fits: boolean[][], order: readonly number[], slotCount: number): number[] {
  const owner: number[] = Array(slotCount).fill(-1);
  const tryAssign = (p: number, seen: boolean[]): boolean => {
    for (let s = 0; s < slotCount; s++) {
      if (!fits[p][s] || seen[s]) continue;
      seen[s] = true;
      if (owner[s] === -1 || tryAssign(owner[s], seen)) {
        owner[s] = p;
        return true;
      }
    }
    return false;
  };
  for (const p of order) tryAssign(p, Array(slotCount).fill(false));
  return owner;
}

/** Maximum number of slots these players can fill at once. Returns the slots left empty. */
export function solveLineup(players: readonly (readonly string[])[], slots: readonly string[]): { filled: number; openSlots: string[] } {
  const fits = players.map((eligible) => slots.map((slot) => canFillSlot(slot, eligible)));
  // Least-flexible players first, so the leftover empty slots tend to be the flexible ones.
  const order = players.map((_, i) => i).sort((a, b) => fits[a].filter(Boolean).length - fits[b].filter(Boolean).length);
  const owner = assignInOrder(fits, order, slots.length);
  return { filled: owner.filter((p) => p !== -1).length, openSlots: slots.filter((_, s) => owner[s] === -1) };
}

/** The fields lineup selection needs - satisfied by both rostered and available players. */
type LineupCandidate = Pick<PlannerRosterPlayer, "name" | "eligiblePositions" | "projectedPointsPerGame"> & {
  dailyProjections?: Record<string, number>;
};

/** A player's projected fantasy points for this date's game: the per-day projection if there is one, else FP/GP. */
export function projectionOn(player: LineupCandidate, date: string): number | null {
  return player.dailyProjections?.[date] ?? player.projectedPointsPerGame;
}

/** Best projection for this date first; unprojected players last. */
function byProjectionOn(date: string) {
  return (a: LineupCandidate, b: LineupCandidate): number =>
    (projectionOn(b, date) ?? -Infinity) - (projectionOn(a, date) ?? -Infinity) || a.name.localeCompare(b.name);
}

function byProjectionDesc(a: LineupCandidate, b: LineupCandidate): number {
  return (b.projectedPointsPerGame ?? -Infinity) - (a.projectedPointsPerGame ?? -Infinity) || a.name.localeCompare(b.name);
}

/** Rostered players who can play this date (have a game, not IR/out), best projection first. */
function playableOn(date: string, roster: readonly PlannerRosterPlayer[], gamesByTeam: GamesByTeam): PlannerRosterPlayer[] {
  return roster
    .filter((p) => p.dailySlots[date] && p.dailySlots[date].status !== "out")
    .filter((p) => p.nhlTeamAbbrev && gamesByTeam.get(p.nhlTeamAbbrev)?.has(date))
    .sort(byProjectionOn(date));
}

/**
 * The max-FP/GP lineup from players already sorted best first: adding them greedily in that
 * order with augmenting paths is optimal, since a placed player is never unseated. Players
 * without a projection count as 0. Returns each slot's player index (or -1) and the total.
 */
function pickStarters(
  sorted: readonly LineupCandidate[],
  slots: readonly string[],
  date: string
): { owner: number[]; total: number } {
  const fits = sorted.map((p) => slots.map((slot) => canFillSlot(slot, p.eligiblePositions)));
  const owner = assignInOrder(fits, sorted.map((_, i) => i), slots.length);
  const total = owner.reduce((sum, p) => sum + (p === -1 ? 0 : (projectionOn(sorted[p], date) ?? 0)), 0);
  return { owner, total };
}

/**
 * How one planned player-day compares to the platform's current lineup. Only active vs not
 * matters - which starting slot the platform has them in doesn't change scoring.
 *  agreed = planned starter who's active; start = planned starter sitting on the bench/IR;
 *  bench = planned bench player who's active; none = planned bench player already benched.
 */
export type LineupChange = "agreed" | "start" | "bench" | "none";

/** isPlannedStarter: whether the plan starts the player that day (vs. benching them). */
export function lineupChange(isPlannedStarter: boolean, current: DailySlot | undefined): LineupChange {
  const active = current?.status === "active";
  if (isPlannedStarter) return active ? "agreed" : "start";
  return active ? "bench" : "none";
}

export interface DailyLineup {
  date: string;
  /** One entry per starting slot, in display order (e.g. 6 F, 4 D, 1 G); best FP/GP first within a slot type. */
  starters: Array<{ slot: string; player: PlannerRosterPlayer | null }>;
  /** Players with a game who aren't IR/out but didn't make the lineup, best FP/GP first. */
  bench: PlannerRosterPlayer[];
}

/**
 * Each day's highest-FP/GP lineup from rostered players who have a game and aren't out.
 * Players without a projection rank below every projected one. Starts as many players as
 * possible, same as planDays.
 */
export function buildDailyLineups(
  days: readonly string[],
  lineupSlots: Record<string, number>,
  roster: readonly PlannerRosterPlayer[],
  gamesByTeam: GamesByTeam
): DailyLineup[] {
  const slotTypes = orderSlotTypes(lineupSlots);
  const slots = slotTypes.flatMap((slot) => Array<string>(lineupSlots[slot]).fill(slot));

  return days.map((date) => {
    const playable = playableOn(date, roster, gamesByTeam);
    const { owner } = pickStarters(playable, slots, date);

    // Matching decides who starts at which slot type; within a type, list best first.
    const starters: DailyLineup["starters"] = [];
    for (const slot of slotTypes) {
      const placed = slots
        .map((s, i) => (s === slot && owner[i] !== -1 ? playable[owner[i]] : null))
        .filter((p): p is PlannerRosterPlayer => p !== null)
        .sort(byProjectionOn(date));
      for (let i = 0; i < lineupSlots[slot]; i++) starters.push({ slot, player: placed[i] ?? null });
    }
    const starting = new Set(owner.filter((p) => p !== -1));
    return { date, starters, bench: playable.filter((_, i) => !starting.has(i)) };
  });
}

/**
 * Rostered players who are on IR (or otherwise out) on any of these days, labelled with the
 * first lineup slot type they're eligible for and ordered like the lineup (F, D, G), best
 * FP/GP first within a slot.
 */
export function injuredPlayers(
  days: readonly string[],
  lineupSlots: Record<string, number>,
  roster: readonly PlannerRosterPlayer[]
): Array<{ slot: string; player: PlannerRosterPlayer }> {
  const slotTypes = orderSlotTypes(lineupSlots);
  return roster
    .filter((p) => days.some((d) => p.dailySlots[d]?.status === "out"))
    .map((player) => ({ slot: slotTypes.find((s) => canFillSlot(s, player.eligiblePositions)) ?? player.displayPosition, player }))
    .sort((a, b) => {
      const rank = (slot: string) => (slotTypes.includes(slot) ? slotTypes.indexOf(slot) : slotTypes.length);
      return rank(a.slot) - rank(b.slot) || byProjectionDesc(a.player, b.player);
    });
}

export interface DayPlan {
  date: string;
  totalSlots: number;
  /** Best possible number of starters with a game, using anyone not on IR/out. */
  startersWithGame: number;
  openSlots: string[];
  /** Eligible positions of every rostered player able to play this date - input for what-if additions. */
  playable: string[][];
}

/**
 * For each day, the best lineup your roster can field from players who have a game,
 * and which slots would still be empty. Uses the optimal assignment rather than the
 * lineup currently set on the platform, since that's what you'd set before lock.
 */
export function planDays(
  days: readonly string[],
  lineupSlots: Record<string, number>,
  roster: readonly PlannerRosterPlayer[],
  gamesByTeam: GamesByTeam
): DayPlan[] {
  const slots = expandSlots(lineupSlots);
  return days.map((date) => {
    const playable = roster
      .filter((p) => p.dailySlots[date] && p.dailySlots[date].status !== "out")
      .filter((p) => p.nhlTeamAbbrev && gamesByTeam.get(p.nhlTeamAbbrev)?.has(date))
      .map((p) => p.eligiblePositions);
    const { filled, openSlots } = solveLineup(playable, slots);
    return { date, totalSlots: slots.length, startersWithGame: filled, openSlots, playable };
  });
}

/** Dates on which adding a player with these positions/team would put one more starter on the ice. */
export function datesFilledByAddition(
  eligiblePositions: readonly string[],
  nhlTeamAbbrev: string | null,
  dayPlans: readonly DayPlan[],
  lineupSlots: Record<string, number>,
  gamesByTeam: GamesByTeam
): string[] {
  if (!nhlTeamAbbrev) return [];
  const teamGames = gamesByTeam.get(nhlTeamAbbrev);
  if (!teamGames) return [];
  const slots = expandSlots(lineupSlots);
  return dayPlans
    .filter((d) => d.openSlots.length > 0 && teamGames.has(d.date))
    .filter((d) => solveLineup([...d.playable, eligiblePositions], slots).filled > d.startersWithGame)
    .map((d) => d.date);
}

/**
 * Positions worth planning around: the league's starting slots minus skater-flex ones
 * (a Util opening is fillable by any of the specific skater positions anyway).
 */
export function planningPositions(lineupSlots: Record<string, number>): string[] {
  const all = Object.keys(lineupSlots);
  const specific = all.filter((s) => !isFlexSlot(s));
  return specific.length > 0 ? specific : all;
}

export interface TeamFit {
  teamAbbrev: string;
  position: string;
  filledDates: string[];
}

/** For each position, NHL teams ranked by how many of your open-slot days a player of theirs would fill. */
export function scoreTeamFits(
  positions: readonly string[],
  dayPlans: readonly DayPlan[],
  lineupSlots: Record<string, number>,
  gamesByTeam: GamesByTeam
): Map<string, TeamFit[]> {
  const result = new Map<string, TeamFit[]>();
  for (const position of positions) {
    const fits: TeamFit[] = [];
    for (const teamAbbrev of gamesByTeam.keys()) {
      const filledDates = datesFilledByAddition([position], teamAbbrev, dayPlans, lineupSlots, gamesByTeam);
      if (filledDates.length > 0) fits.push({ teamAbbrev, position, filledDates });
    }
    fits.sort((a, b) => b.filledDates.length - a.filledDates.length || a.teamAbbrev.localeCompare(b.teamAbbrev));
    result.set(position, fits);
  }
  return result;
}

export interface Recommendation {
  player: AvailablePlayer;
  /** Days the player would make your best lineup - filling an empty slot or displacing a weaker starter. */
  startDates: string[];
  /** Per start day, how much the best-lineup FP/GP total rises with this player added. */
  gainByDate: Record<string, number>;
  /**
   * How much the week's best-lineup FP/GP total rises with this player added: per start day,
   * lineup total with him minus without. Null when there's no projection for this player.
   */
  projectedAddedPoints: number | null;
}

/**
 * Available players who'd crack your best lineup on at least one day, best first: by the
 * projected points they add over your current roster, then by start days, then platform rank.
 */
export function recommendPlayers(
  available: readonly AvailablePlayer[],
  days: readonly string[],
  lineupSlots: Record<string, number>,
  roster: readonly PlannerRosterPlayer[],
  gamesByTeam: GamesByTeam
): Recommendation[] {
  const slots = expandSlots(lineupSlots);
  const baseline = days.map((date) => {
    const playable = playableOn(date, roster, gamesByTeam);
    return { date, playable, total: pickStarters(playable, slots, date).total };
  });

  const recs: Recommendation[] = [];
  for (const player of available) {
    const teamGames = player.nhlTeamAbbrev ? gamesByTeam.get(player.nhlTeamAbbrev) : undefined;
    if (!teamGames) continue;
    const startDates: string[] = [];
    const gainByDate: Record<string, number> = {};
    let gain = 0;
    for (const day of baseline) {
      if (!teamGames.has(day.date)) continue;
      const withPlayer = [...day.playable, player].sort(byProjectionOn(day.date));
      const { owner, total } = pickStarters(withPlayer, slots, day.date);
      if (!owner.includes(withPlayer.indexOf(player))) continue;
      startDates.push(day.date);
      gainByDate[day.date] = total - day.total;
      gain += total - day.total;
    }
    if (startDates.length === 0) continue;
    recs.push({ player, startDates, gainByDate, projectedAddedPoints: player.projectedPointsPerGame !== null ? gain : null });
  }
  return recs.sort(
    (a, b) =>
      (b.projectedAddedPoints ?? -Infinity) - (a.projectedAddedPoints ?? -Infinity) ||
      b.startDates.length - a.startDates.length ||
      (a.player.rank ?? Infinity) - (b.player.rank ?? Infinity)
  );
}
