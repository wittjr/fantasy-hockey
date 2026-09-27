import { unstable_cache } from "next/cache";
import { getPeriodProjections, getRosterDayProjections } from "./projections";

// Fantrax's projections are slow to fetch (two ~1MB player-list requests plus one lineup
// request per day) and change at most daily, so keep them for up to 24 hours. unstable_cache
// is Next 16's option without opting the whole app into Cache Components ("use cache").
// Errors aren't cached. Only the small processed results are stored, not the raw responses.
const ONE_DAY = 24 * 60 * 60;
/** Tag on every cached Fantrax projection - invalidate it to force a refetch. */
export const FANTRAX_PROJECTIONS_TAG = "fantrax-projections";
const TAG = FANTRAX_PROJECTIONS_TAG;

/** Cached getPeriodProjections, keyed by league. */
export const getCachedPeriodProjections = unstable_cache(getPeriodProjections, ["fantrax-period-projections"], {
  revalidate: ONE_DAY,
  tags: [TAG],
});

/**
 * Cached getRosterDayProjections. rosterPlayerIds isn't used to fetch - it's there so the
 * cache key changes when the roster does, and a newly added player gets projections right
 * away instead of up to a day later. Pass it sorted.
 */
export const getCachedRosterDayProjections = unstable_cache(
  (leagueId: string, teamId: string, period: number, rosterPlayerIds: string[]) => {
    void rosterPlayerIds;
    return getRosterDayProjections(leagueId, teamId, period);
  },
  ["fantrax-roster-day-projections"],
  { revalidate: ONE_DAY, tags: [TAG] }
);
