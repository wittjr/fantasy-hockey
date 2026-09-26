export interface PlayerKeeperStatus {
  fantraxPlayerId: string;
  /** Final effective "is this player being kept" value - override wins over the default guess. */
  isConsidered: boolean;
  /** True when isConsidered reflects the default heuristic rather than a manual override. */
  isProgrammatic: boolean;
}

/**
 * Merges the programmatic "top 6 by ADP" keeper guess with any manual overrides the user
 * has made, for one team's roster. A manual override (checked or unchecked) always wins;
 * players with no override fall back to the default guess and are flagged isProgrammatic
 * so the UI can label them "Likely" instead of presenting them as a confirmed pick.
 */
export function computeKeeperStatuses(
  rosterPlayerIds: string[],
  programmaticKeptSet: ReadonlySet<string>,
  overrides: ReadonlyMap<string, boolean>
): PlayerKeeperStatus[] {
  return rosterPlayerIds.map((fantraxPlayerId) => {
    const override = overrides.get(fantraxPlayerId);
    const isConsidered = override ?? programmaticKeptSet.has(fantraxPlayerId);
    return { fantraxPlayerId, isConsidered, isProgrammatic: override === undefined };
  });
}
