import { NHL_TEAM_ABBREVS } from "./client";

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

// Yahoo's editorial_team_abbr is mixed-case and differs from the NHL's for some teams.
const PLATFORM_TEAM_ABBREV_FIXES: Record<string, string> = {
  ANH: "ANA",
  CAL: "CGY",
  CLB: "CBJ",
  CLS: "CBJ",
  LA: "LAK",
  MON: "MTL",
  NAS: "NSH",
  NJ: "NJD",
  SJ: "SJS",
  TB: "TBL",
  UTAH: "UTA",
  VEG: "VGK",
  WAS: "WSH",
  WIN: "WPG",
};

/** Maps a platform's team abbrev to the NHL API's, or null if it isn't recognizable as a current NHL team. */
export function normalizePlatformTeamAbbrev(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  const abbrev = PLATFORM_TEAM_ABBREV_FIXES[upper] ?? upper;
  return (NHL_TEAM_ABBREVS as readonly string[]).includes(abbrev) ? abbrev : null;
}
