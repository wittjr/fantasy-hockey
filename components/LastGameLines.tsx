import { formatClock, formatDate, gameLabel, resultLabel } from "@/lib/research/format";
import type { Situation, Unit } from "@/lib/research/lines";
import type { TeamResearch } from "@/lib/research/team-games";

const UNIT_LIMITS: Record<Situation, { F: number; D: number }> = {
  ev: { F: 4, D: 3 },
  pp: { F: 2, D: 2 },
  sh: { F: 3, D: 3 },
};
const SITUATION_LABELS: Record<Situation, string> = { ev: "EV", pp: "PP", sh: "SH" };

export function LastGameLines({ research }: { research: TeamResearch }) {
  const game = research.games[research.games.length - 1];
  const name = (id: number) => research.players.get(id)?.name ?? String(id);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">
        Last game: {formatDate(game.date)} {gameLabel(game)}{" "}
        <span className="text-neutral-500">{resultLabel(game)}</span>
      </h2>
      {!game.lines ? (
        <p className="text-sm text-neutral-500">No shift chart is available for this game (not published yet, or it failed to load).</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {(["ev", "pp", "sh"] as const).flatMap((situation) =>
            (["F", "D"] as const).map((group) => (
              <UnitTable
                key={`${situation}-${group}`}
                title={`${SITUATION_LABELS[situation]} - ${group === "F" ? "Forwards" : "Defense"}`}
                units={game.lines!.units[situation][group].slice(0, UNIT_LIMITS[situation][group])}
                name={name}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function UnitTable({ title, units, name }: { title: string; units: Unit[]; name: (id: number) => string }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
          <th className="w-10 py-1 font-medium">#</th>
          <th className="w-14 py-1 font-medium">Time</th>
          <th className="w-14 py-1 font-medium">%</th>
          <th className="py-1 font-medium">{title}</th>
        </tr>
      </thead>
      <tbody>
        {units.length === 0 ? (
          <tr>
            <td colSpan={4} className="py-1 text-neutral-400">
              None
            </td>
          </tr>
        ) : (
          units.map((u, i) => (
            <tr key={u.playerIds.join(",")} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="py-1 text-neutral-500">{i + 1}</td>
              <td className="py-1 tabular-nums">{formatClock(u.seconds)}</td>
              <td className="py-1 tabular-nums text-neutral-500">{u.pct.toFixed(1)}</td>
              <td className="py-1">{u.playerIds.map(name).join(" – ")}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
