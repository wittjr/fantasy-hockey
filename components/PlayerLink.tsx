import { PendingLink } from "@/components/PendingLink";
import type { Situation } from "@/lib/research/lines";
import { playerHref, type SortSpec } from "@/lib/research/toi-trends";

const LINK_LOOK =
  "underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900 dark:decoration-neutral-600 dark:hover:decoration-neutral-100";

/**
 * A player's name as a link to his panel on the given situation tab.
 * `selectedSit` is the panel's situation when this player is the selected one, else null. On his own tab the name is a
 * plain hash anchor, because a native anchor jumps to the panel on every click while a link to the identical URL does not.
 */
export function PlayerLink({
  playerId,
  name,
  sit,
  selectedSit,
  team,
  gameCount,
  sort,
  title,
  overlaySpinner,
}: {
  playerId: number;
  name: string;
  sit: Situation;
  selectedSit: Situation | null;
  team: string;
  gameCount: number;
  sort: SortSpec;
  title: string;
  /** Float the pending spinner over the line so the name takes no trailing space (unit tables). */
  overlaySpinner?: boolean;
}) {
  const selected = selectedSit !== null;
  const className = `${LINK_LOOK}${selected ? " font-medium" : ""}`;
  if (selectedSit === sit) {
    return (
      <a href="#player-detail" aria-current="true" title={title} className={className}>
        {name}
      </a>
    );
  }
  return (
    <PendingLink
      href={playerHref(team, gameCount, sort, { player: playerId, sit })}
      aria-current={selected ? "true" : undefined}
      title={title}
      className={className}
      overlaySpinner={overlaySpinner}
    >
      {name}
    </PendingLink>
  );
}
