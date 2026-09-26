const FORWARD_POSITIONS = new Set(["C", "LW", "RW"]);

/**
 * Maps a player's granular Fantrax position (C/LW/RW/D/G) onto one of the league's own
 * active-roster buckets. Most leagues just use those buckets directly; some (like this
 * one) collapse all forwards into a single "F" bucket instead of separate C/LW/RW slots.
 */
export function mapPositionToBucket(granularPosition: string, availableBuckets: string[]): string | null {
  const candidates = granularPosition.split(",").map((p) => p.trim());
  for (const candidate of candidates) {
    if (availableBuckets.includes(candidate)) return candidate;
  }
  if (candidates.some((c) => FORWARD_POSITIONS.has(c)) && availableBuckets.includes("F")) return "F";
  return null;
}
