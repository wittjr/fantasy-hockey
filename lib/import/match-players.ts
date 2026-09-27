import fuzzysort from "fuzzysort";
import type { FantraxPlayer } from "@/lib/fantrax/client";

/** The only fields matchSpreadsheetRow needs - satisfied by both freshly-parsed rows and DB rows. */
export interface MatchableRow {
  name: string;
  nhlTeamAbbrev: string | null;
  position: string | null;
}

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

/** Lowercase, accent-stripped, punctuation/suffix-free name for matching across sources. */
export function normalizeName(name: string): string {
  const stripped = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritics
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !SUFFIXES.has(word));
  return stripped.join(" ");
}

/** Fantrax player names are "Last, First" - convert to "First Last" for comparison with the spreadsheet. */
export function fantraxNameToFirstLast(fantraxName: string): string {
  const [last, first] = fantraxName.split(",").map((s) => s.trim());
  return first && last ? `${first} ${last}` : fantraxName;
}

interface IndexedPlayer {
  fantraxPlayerId: string;
  player: FantraxPlayer;
  normalizedName: string;
}

export function buildFantraxPlayerIndex(players: Record<string, FantraxPlayer>): {
  byNormalizedName: Map<string, IndexedPlayer[]>;
  all: IndexedPlayer[];
} {
  const byNormalizedName = new Map<string, IndexedPlayer[]>();
  const all: IndexedPlayer[] = [];

  for (const [fantraxPlayerId, player] of Object.entries(players)) {
    const normalizedName = normalizeName(fantraxNameToFirstLast(player.name));
    const entry: IndexedPlayer = { fantraxPlayerId, player, normalizedName };
    all.push(entry);
    if (!byNormalizedName.has(normalizedName)) byNormalizedName.set(normalizedName, []);
    byNormalizedName.get(normalizedName)!.push(entry);
  }

  return { byNormalizedName, all };
}

export interface MatchResult {
  fantraxPlayerId: string;
  player: FantraxPlayer;
  confidence: "exact" | "exact-multi-disambiguated" | "fuzzy" | "last-name-team";
}

const FUZZY_SCORE_THRESHOLD = -400; // fuzzysort: 0 = perfect match, more negative = worse

/**
 * Matches one spreadsheet row to a Fantrax player pool entry, using team/position to
 * disambiguate common names and falling back to fuzzy matching for spelling differences.
 * Returns null when no confident match is found - better to leave a row unmatched than
 * to silently attach it to the wrong player.
 */
export function matchSpreadsheetRow(row: MatchableRow, index: ReturnType<typeof buildFantraxPlayerIndex>): MatchResult | null {
  // Drop parenthesized notes like "Elias Pettersson (D)" - the spreadsheet's own disambiguation,
  // which position handles below.
  const normalized = normalizeName(row.name.replace(/\([^)]*\)/g, " "));
  const exactCandidates = index.byNormalizedName.get(normalized) ?? [];

  if (exactCandidates.length === 1) {
    return { fantraxPlayerId: exactCandidates[0].fantraxPlayerId, player: exactCandidates[0].player, confidence: "exact" };
  }

  if (exactCandidates.length > 1) {
    const byTeam = exactCandidates.filter((c) => c.player.team === row.nhlTeamAbbrev);
    if (byTeam.length === 1) {
      return { fantraxPlayerId: byTeam[0].fantraxPlayerId, player: byTeam[0].player, confidence: "exact-multi-disambiguated" };
    }
    const positions = (row.position ?? "").split(",").map((p) => p.trim());
    const byPosition = (byTeam.length > 0 ? byTeam : exactCandidates).filter((c) => positions.includes(c.player.position));
    if (byPosition.length === 1) {
      return { fantraxPlayerId: byPosition[0].fantraxPlayerId, player: byPosition[0].player, confidence: "exact-multi-disambiguated" };
    }
    // Ambiguous and we can't disambiguate confidently - don't guess.
    return null;
  }

  // No exact normalized-name match - fuzzy match, preferring same-team candidates.
  const pool = row.nhlTeamAbbrev ? index.all.filter((c) => c.player.team === row.nhlTeamAbbrev) : index.all;
  const searchPool = pool.length > 0 ? pool : index.all;
  const results = fuzzysort.go(normalized, searchPool, { key: "normalizedName", limit: 1 });

  if (results.length > 0 && results[0].score >= FUZZY_SCORE_THRESHOLD) {
    const match = results[0].obj;
    return { fantraxPlayerId: match.fantraxPlayerId, player: match.player, confidence: "fuzzy" };
  }

  // Different first names for the same player (Nick/Nicholas Robertson, J.J./Janis Moser, Egor/Yegor
  // Chinakhov) - accept the only player on the same NHL team with that last name.
  const lastName = normalized.split(" ").pop();
  if (row.nhlTeamAbbrev && lastName) {
    const sameLast = pool.filter((c) => c.player.team === row.nhlTeamAbbrev && c.normalizedName.split(" ").pop() === lastName);
    if (sameLast.length === 1) {
      return { fantraxPlayerId: sameLast[0].fantraxPlayerId, player: sameLast[0].player, confidence: "last-name-team" };
    }
  }

  return null;
}
