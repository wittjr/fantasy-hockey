type JsonObject = { [key: string]: unknown };

/**
 * Yahoo's `format=json` output is a mechanical translation of its XML:
 *  - collections are objects keyed "0", "1", ... plus a "count" field;
 *  - a single resource is an array of fragments ([{league_key}, {name}, ...], sometimes
 *    nested one level deeper, e.g. player: [[{player_key}, {name}, ...], {selected_position}]).
 * This turns collections into arrays and merges fragment arrays into one object, so callers
 * can write `league.teams[0].team.name` instead of indexing through the fragments.
 */
export function normalizeYahoo(value: unknown): unknown {
  if (Array.isArray(value)) {
    // Fragment arrays can nest (and contain empty [] placeholders for missing fields) at any depth.
    const flat: unknown[] = value.flat(Infinity);
    const objects = flat.filter((v): v is JsonObject => v !== null && typeof v === "object" && !Array.isArray(v));
    const keys = objects.flatMap((o) => Object.keys(o));
    // Fragments of one resource have distinct keys - merge them. Repeated keys mean it's a
    // genuine list (e.g. roster_positions: [{roster_position}, {roster_position}, ...]).
    if (objects.length === flat.length && new Set(keys).size === keys.length) {
      return normalizeYahoo(Object.assign({}, ...objects));
    }
    return flat.map(normalizeYahoo);
  }
  if (value !== null && typeof value === "object") {
    if ("count" in value && Object.keys(value).every((k) => k === "count" || /^\d+$/.test(k))) {
      return Object.keys(value)
        .filter((k) => k !== "count")
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => normalizeYahoo((value as JsonObject)[k]));
    }
    const out: JsonObject = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeYahoo(v);
    return out;
  }
  return value;
}
