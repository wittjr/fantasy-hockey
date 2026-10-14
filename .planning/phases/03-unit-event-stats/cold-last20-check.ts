// Cold Last 20 throttling check (DATA-01, ROADMAP SC5, D-19). Re-runnable:
//   npx tsx .planning/phases/03-unit-event-stats/cold-last20-check.ts
// Env: COLD_TEAMS (default "MTL,TOR,EDM"). Runs outside Next, so there is no fetch cache and every request is cold,
// the worst case for the NHL rate limit. Teams load one after another with the default pacing constants.
// Needs a quiet minute beforehand: a 429 ban from an earlier run fails it. About 4 api-web requests per game.
import type { NhlTeamAbbrev } from "../../../lib/nhl/client";
import { GAME_START_GAP_MS, MAX_CONCURRENT_GAMES, loadTeamResearch } from "../../../lib/research/team-games";

const SLOW_SECONDS = 15;

async function main() {
  const teams = (process.env.COLD_TEAMS ?? "MTL,TOR,EDM")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean) as NhlTeamAbbrev[];

  // Record every logged error (the loader logs a failed game with console.error) while still printing it.
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
    original(...args);
  };

  console.log(`INFO constants MAX_CONCURRENT_GAMES=${MAX_CONCURRENT_GAMES} GAME_START_GAP_MS=${GAME_START_GAP_MS}`);
  const failures: string[] = [];
  for (const team of teams) {
    const started = Date.now();
    try {
      const research = await loadTeamResearch(team, 20);
      const seconds = (Date.now() - started) / 1000;
      console.log(
        `team=${team} games=${research.games.length} unavailable=${research.unavailableDates.length} seconds=${seconds.toFixed(1)}`,
      );
      if (research.unavailableDates.length > 0) {
        failures.push(`${team}: ${research.unavailableDates.length} unavailable (${research.unavailableDates.join(", ")})`);
      }
      if (seconds > SLOW_SECONDS) console.log(`INFO ${team} took ${seconds.toFixed(1)} s, over ${SLOW_SECONDS} s`);
    } catch (err) {
      failures.push(`${team}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.error = original;

  const throttled = errors.filter((m) => m.includes("429"));
  if (throttled.length > 0) failures.push(`${throttled.length} logged error(s) mention 429`);
  if (failures.length > 0) throw new Error(failures.join("; "));
  console.log("COLD OK");
}

main().catch((err: unknown) => {
  console.log(`COLD FAIL ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
