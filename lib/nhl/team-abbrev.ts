// The Fantrax fxea API and the NHL API both use standard 3-letter team abbrevs
// (TBL, SJS, NJD, LAK, ...) - verified directly against both, no mapping needed there.
// The "The List" projections spreadsheet uses a different style for a handful of teams.
const SPREADSHEET_TEAM_ABBREV_FIXES: Record<string, string> = {
  "L.A": "LAK",
  "N.J": "NJD",
  "S.J": "SJS",
  "T.B": "TBL",
};

export function normalizeSpreadsheetTeamAbbrev(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  return SPREADSHEET_TEAM_ABBREV_FIXES[trimmed] ?? trimmed;
}
