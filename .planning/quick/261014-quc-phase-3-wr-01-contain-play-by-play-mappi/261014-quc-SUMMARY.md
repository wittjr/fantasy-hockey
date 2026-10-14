---
quick_id: 261014-quc
status: complete
commits: [84ec065, 0768b00, 054cce3]
---

# Quick 261014-quc Summary

- **WR-01 (84ec065):** `buildGameEvents` guards `plays` with `?.` and wraps mapping/attribution in try/catch, logging and returning null (unknown). Malformed play-by-play no longer rejects `loadGame`, so the game keeps TOI, lines and linemates (D-05). Test covers missing `plays`, missing `homeTeam` and a shot without `periodDescriptor`; it fails without the fix.
- **WR-02 (0768b00):** `topNotes` appends `{N} shot attempt(s) fell in seconds with no shift data, so it is / they are in no table, including Total.` when `events.unattributed > 0`, after the D-23/D-16 notes. All 9 recorded fixtures have 0 unattributed, so the note only shows on real gaps.
- **Spec (054cce3):** 03-UI-SPEC adds the note and fixes its amber tokens to `amber-700` text (missed in quick 261014-qgu).
- Ledgers: 03 WR-01/WR-02 fixed; 01 IN-13 marked fixed (ad76e51 removed aria-expanded). STATE.md: stale Phase 1 UI re-audit line removed.
- `npm test` 557/557, tsc and eslint clean.
