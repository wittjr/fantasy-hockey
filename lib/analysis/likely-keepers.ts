/**
 * Estimates which players on OTHER teams' rosters are likely being kept, since Fantrax
 * doesn't expose actual Keeper Admin picks via any API. Heuristic: a manager's most
 * valuable players (lowest ADP = drafted earliest) are the ones most likely worth
 * keeping - take the top N by ADP per other team as a stand-in for "probably kept".
 * Players with an ADP over maxAdp are never counted: past that point they'd go after the
 * keeper rounds, so they aren't worth a keeper spot (12 teams x 8 keeper rounds = 96).
 *
 * Returns a map of fantraxPlayerId -> the team ID (key of otherTeamRosterPlayerIds)
 * likely keeping them, so callers can show who's keeping whom, not just exclude silently.
 */
export function computeLikelyKeptPlayers(
  otherTeamRosterPlayerIds: Map<string, string[]>,
  adpByPlayerId: Map<string, number | null>,
  topN = 6,
  maxAdp = 96
): Map<string, string> {
  const keptBy = new Map<string, string>();

  for (const [teamId, playerIds] of otherTeamRosterPlayerIds) {
    const withAdp = playerIds
      .map((id) => ({ id, adp: adpByPlayerId.get(id) }))
      .filter((r): r is { id: string; adp: number } => r.adp != null && r.adp <= maxAdp)
      .sort((a, b) => a.adp - b.adp)
      .slice(0, topN);

    for (const r of withAdp) keptBy.set(r.id, teamId);
  }

  return keptBy;
}
