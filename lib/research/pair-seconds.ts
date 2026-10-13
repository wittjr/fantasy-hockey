// Regulation-only seconds each skater, and each pair of teammates, spent on ice per situation.
// A second pass over the same on-ice seconds as analyzeGameLines, classified by the same situationFor.
// Unlike analyzeGameLines, a player with two overlapping differing rows counts once before strength is classified.
import {
  bucketOnIce,
  PERIOD_SECONDS,
  REGULATION_PERIODS,
  situationFor,
  type OnIce,
  type PositionGroup,
  type ShiftInput,
  type Situation,
} from "./lines";

export interface GamePairs {
  /** Seconds in periods 1-3 each own-team skater was on ice, per situation. */
  self: Map<number, Record<Situation, number>>;
  /** Seconds in periods 1-3 both skaters were on ice together, per situation. Symmetric: [a][b] equals [b][a]. */
  together: Map<number, Map<number, Record<Situation, number>>>;
  /** Position group of every own-team skater who was on ice in periods 1-3, for listing a linemate under the group he played most. */
  groups: Map<number, PositionGroup>;
}

const NO_ONE: OnIce = { skaters: [], goalie: false };

/** One entry per player, so overlapping rows for the same player cannot inflate the skater count that decides strength. */
const dedupe = (onIce: OnIce): OnIce => ({ skaters: [...new Set(onIce.skaters)], goalie: onIce.goalie });

const emptyRecord = (): Record<Situation, number> => ({ ev: 0, pp: 0, sh: 0 });

/** Regulation-only (periods 1-3) own and pair seconds for `team`; overtime seconds are skipped in every situation. */
export function pairSeconds(
  team: string,
  shifts: ShiftInput[],
  positions: Map<number, PositionGroup>,
): GamePairs {
  const self = new Map<number, Record<Situation, number>>();
  const together = new Map<number, Map<number, Record<Situation, number>>>();
  const groups = new Map<number, PositionGroup>();

  for (const [t, byTeam] of bucketOnIce(shifts, positions)) {
    if (t >= REGULATION_PERIODS * PERIOD_SECONDS) continue;
    const rawMine = byTeam.get(team);
    if (!rawMine || rawMine.skaters.length === 0) continue;
    const mine = dedupe(rawMine);
    const opp = dedupe([...byTeam].find(([abbrev]) => abbrev !== team)?.[1] ?? NO_ONE);
    const situation = situationFor(mine, opp);

    const skaters = mine.skaters;
    for (const a of skaters) {
      let own = self.get(a);
      if (!own) self.set(a, (own = emptyRecord()));
      own[situation]++;
      groups.set(a, positions.get(a)!);

      let pairs = together.get(a);
      if (!pairs) together.set(a, (pairs = new Map()));
      for (const b of skaters) {
        if (b === a) continue;
        let rec = pairs.get(b);
        if (!rec) pairs.set(b, (rec = emptyRecord()));
        rec[situation]++;
      }
    }
  }
  return { self, together, groups };
}
