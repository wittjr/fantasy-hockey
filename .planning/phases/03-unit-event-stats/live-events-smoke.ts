// Live reconciliation smoke: attributed shots on goal for and against, plus each team's penalty shots,
// must equal the official boxscore SOG on current games. Re-runnable (plan 03-11 reruns it):
//   npx tsx .planning/phases/03-unit-event-stats/live-events-smoke.ts
// Env: SMOKE_TEAM (default MTL), SMOKE_GAMES (default 5). About 5 api-web requests per game.
import { getPlayByPlay, type NhlTeamAbbrev } from "../../../lib/nhl/client";
import { toGameEvents } from "../../../lib/research/play-events";
import { loadTeamResearch } from "../../../lib/research/team-games";

const SITUATIONS = ["ev", "pp", "sh"] as const;
const GROUPS = ["F", "D"] as const;
const COUNTERS = ["gf", "ga", "sf", "sa", "cf", "ca"] as const;

interface BoxscoreSog {
  homeTeam: { abbrev: string; sog: number };
  awayTeam: { abbrev: string; sog: number };
}

async function main() {
  const team = (process.env.SMOKE_TEAM ?? "MTL") as NhlTeamAbbrev;
  const count = Number(process.env.SMOKE_GAMES ?? 5);
  const research = await loadTeamResearch(team, count);

  const failures: string[] = [];
  let withEvents = 0;
  for (const game of research.games) {
    const { events } = game;
    if (!game.lines || !events) {
      if (game.lines) console.log(`INFO game ${game.id} (${game.date}) has lines but no events`);
      continue;
    }
    withEvents++;

    const res = await fetch(`https://api-web.nhle.com/v1/gamecenter/${game.id}/boxscore`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`boxscore ${game.id} failed: ${res.status} ${res.statusText}`);
    const box = (await res.json()) as BoxscoreSog;
    const ourSog = game.home ? box.homeTeam.sog : box.awayTeam.sog;
    const theirSog = game.home ? box.awayTeam.sog : box.homeTeam.sog;

    // Penalty shots are left out of every count but the boxscore counts them in SOG.
    const penaltyShotSog = new Map<string, number>();
    for (const e of toGameEvents(await getPlayByPlay(game.id))) {
      if (e.exclusion === "penalty-shot" && (e.kind === "goal" || e.kind === "shot-on-goal")) {
        penaltyShotSog.set(e.team, (penaltyShotSog.get(e.team) ?? 0) + 1);
      }
    }
    const sum = (key: "sf" | "sa") => SITUATIONS.reduce((n, s) => n + events.total[s][key], 0);
    const ourAttributed = sum("sf") + (penaltyShotSog.get(team) ?? 0);
    const theirAttributed = sum("sa") + (penaltyShotSog.get(game.opponent) ?? 0);

    const label = `game ${game.id} (${game.date})`;
    if (events.unattributed !== 0) failures.push(`${label}: ${events.unattributed} unattributed events`);
    if (ourAttributed !== ourSog) failures.push(`${label}: our SOG ${ourAttributed} attributed vs ${ourSog} boxscore`);
    if (theirAttributed !== theirSog) {
      failures.push(`${label}: their SOG ${theirAttributed} attributed vs ${theirSog} boxscore`);
    }
    for (const s of SITUATIONS) {
      for (const g of GROUPS) {
        for (const c of COUNTERS) {
          let unitSum = 0;
          for (const counts of events.byUnit[s][g].values()) unitSum += counts[c];
          if (unitSum > events.total[s][c]) {
            failures.push(`${label}: ${s} ${g} ${c} unit sum ${unitSum} exceeds total ${events.total[s][c]}`);
          }
        }
      }
    }
    console.log(
      `INFO ${label}: SOG ${ourAttributed}-${theirAttributed} vs boxscore ${ourSog}-${theirSog}, unattributed ${events.unattributed}`,
    );
  }

  if (failures.length > 0) throw new Error(failures.join("; "));
  if (withEvents === 0) throw new Error("no play-by-play in window; rerun with SMOKE_TEAM set to another team");
  console.log(`SMOKE OK games=${research.games.length} withEvents=${withEvents}`);
}

main().catch((err: unknown) => {
  console.log(`SMOKE FAIL ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
