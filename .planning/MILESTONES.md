# Milestones

## v1.0 Line Research (Shipped: 2026-10-14)

**Delivered:** The `/research` page became a tool for spotting role changes: an ice-time trends table, a per-player linemate panel, and boxscore-reconciled shot, goal and Corsi stats on every last-game unit table.

**Phases completed:** 3 phases, 29 plans, 62 tasks
**Timeline:** 2026-10-11 → 2026-10-14 (4 days), 322 commits; app/components/lib: 42 files, +7,535 / −339
**Closeout:** verified_closeout (all phases verified, 16/16 requirements, open-artifact audit clear)

**Key accomplishments:**
- Ice-time trends table: regulation-only Avg TOI, PP share and SH with recent-vs-window Δ, mover tints, DNP badge, URL-persisted sorting, and a clickable per-game strip with popovers (Phase 1)
- Player detail panel (`?player=`): per-game linemate heat strip by EV/PP/SH with window share and New/Rising/Fading/Out tags; every player name on the page opens it (Phase 2)
- Play-by-play events attributed to on-ice units, reconciled to the official boxscore (team SOG and every skater's plus-minus) across regulation, OT, shootout, empty-net and penalty-shot fixtures (Phase 3)
- Last-game unit tables show GF/GA/+/-, SF/SA/SF%, CF/CA/CF% with Other and Total rows, a legend, and amber reliability notes; unknown data shows "—", never 0 (Phase 3)
- "Last 20" loads without NHL throttling: tiered finished-game cache, short 429 retry, paced newest-first loading (Phase 3)

**Carried forward (not blocking):** review info items (Phase 1 IN-01..IN-12 and WR-08 remainder, Phase 2 IN-11, Phase 3 IN-01..IN-04); no Phase 3 UI audit; Last 20 only verified on 6-8 finished games per team; backlog 999.1 (details of the "Other" row).

---
