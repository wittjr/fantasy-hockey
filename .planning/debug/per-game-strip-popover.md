---
status: diagnosed
trigger: "UAT gaps G-01-2, G-01-5, G-01-1b on /research: no popovers on strip squares; Per game strip looks like pieces of a bold line; Pos column reads C5/5 GP"
goal: find_root_cause_only
created: 2026-10-12T01:13:33Z
updated: 2026-10-12T02:15:00Z
---

## Current Focus

bug_class: Bohrbug for G-01-1b and G-01-5 (visual), deterministic. Environment-dependent for the popover half of G-01-2/G-01-5 (works in every engine reproduced; fails only in the user's live session).
hypothesis: |
  G-01-2 / G-01-5 popovers: no code or CSS defect blocks the popover. The cause is a set: (env) the UAT was run in macOS Safari while answering in a terminal, and Safari does not process hover for a non-key window, so a CSS-only hover reveal never fires and Tab goes to the terminal; AND (design) the reveal is hover/focus-only on 12x16 targets with no visible affordance, so nothing invites the click that would both activate the window and focus the square.
  G-01-5 visual: the strip renders exactly as UI-SPEC specifies, and that spec reads as one segmented bar.
  G-01-1b: no text separator; only a 4px margin between same-tone tokens.
candidate_causes:
  - "code: Tailwind did not emit group-hover/cell etc.: ELIMINATED (present in dev and prod CSS, correct specificity)"
  - "code: 01-07 group/variant mismatch or clipping/z-index: ELIMINATED (popover shows and is top-most in Chromium + WebKit, every row incl. last D, 0px clipped at 760px width)"
  - "environment: stale dev server/CSS/tab: ELIMINATED (trace: full reload 21:04:47 after the 19:02 change; CSS no-cache, unchanged since 16:47; SSR chunk has the 01-07 classes)"
  - "environment: Safari non-key window ignores hover (WebKit bug 187545 / r236286): MOST LIKELY, not directly observed in the user's Safari"
  - "design: hover-only reveal, no affordance, popover occludes the squares below it: CONFIRMED as a contributor"
and_gate: "yes. The environment alone is harmless if the cell is clickable or obviously interactive; the design alone works in an active window. Together they produce 'no popovers'."
next_action: return diagnosis (find_root_cause_only). Confirming human check: in Safari, click a blank part of the /research page, then rest the pointer on a Per game block without clicking. If the popover appears, the environment+design root cause is confirmed. If not, run `matchMedia('(hover: hover)').matches` in Safari Web Inspector.

## Symptoms

### G-01-2 (major, UAT test 2)
expected: Hover and Tab through strip squares (first/last forward row, last defense row, Last 20, OT game with no shift chart); popover opens under the hovered square, fully visible, not clipped by the overflow-x-auto wrapper.
actual: "I don't see any popovers"
errors: none reported

### G-01-5 (major, UAT test 5)
expected: Per game strip reads as one distinct square per team game (shaded by TOI vs player's average, OT/SO ring, missed-game markers); popover shows OT tag and "OT excluded +m:ss".
actual: "I don't see any popovers. Also the Per Game looks like small pieces of a bold line, I can't tell what it is"
errors: none reported

### G-01-1b (cosmetic, UAT test 1 area)
expected: Pos column separates position from games played ("C" and "5/5 GP").
actual: "There should be some space between the position and games played, I see things like C5/5 GP"
errors: none reported

reproduction: UAT tests 2 and 5; /research?team=MTL&games=5 and games=20; desktop browser on macOS, signed in, branch gsd/phase-1-ice-time-trends-table
started: discovered during UAT after gap plans 01-05..01-07 (01-07 changed popover anchoring: square `group/cell relative`, popover `absolute right-0 top-full`, td no longer positioned)

## Eliminated

- hypothesis: Tailwind 4 does not emit the strip/popover classes (source detection misses components/, or named-group variants unsupported)
  evidence: prod and dev CSS both contain group-hover/cell:block, group-focus/cell:block, h-4, w-3, gap-px, right-0, top-full, z-10, ml-1 with correct declarations
  timestamp: 2026-10-12T01:22:00Z

- hypothesis: 01-07 moved group/cell to the square but the variant or anchoring no longer matches (popover never displays, or is clipped / painted under rows)
  evidence: Chromium + WebKit, static markup and real Next.js runtime: hover gives display:block, the popover is top-most at its centre, all four corners are visible for first F, last F and last D rows, and 0px is clipped at 760px width
  timestamp: 2026-10-12T01:55:00Z

- hypothesis: the user's browser ran stale code or CSS (long-lived dev server, HMR, cache)
  evidence: dev trace shows a full document load at 21:04:47 EDT after the last code change (19:02); CSS is served no-cache and has been unchanged since 16:47 with all classes; the SSR chunk (19:02) has the 01-07 classes
  timestamp: 2026-10-12T02:00:00Z

- hypothesis: WebKit engine (rather than window state) cannot run the group-hover popover
  evidence: Playwright WebKit 26.5: (hover:hover)=true, :hover and the group-hover selector match, the popover shows; programmatic focus and Tab also show it
  timestamp: 2026-10-12T01:45:00Z

## Evidence

- timestamp: 2026-10-12T01:20:00Z
  checked: knowledge base (.planning/debug/knowledge-base.md)
  found: does not exist; no prior resolved sessions
  implication: no known-pattern candidate

- timestamp: 2026-10-12T01:22:00Z
  checked: compiled CSS: prod build .next/static/chunks/3z3kl758c6zif.css (19:03, after 01-07 commit 19:01) and dev chunks .next/dev/static/chunks/app_globals_css_*.css (16:47)
  found: every strip/popover class is emitted. Exact rules: `@media (hover:hover){.group-hover\/cell\:block:is(:where(.group\/cell):hover *){display:block}}`, `.group-focus\/cell\:block:is(:where(.group\/cell):focus *){display:block}`, `.hidden{display:none}`, `.h-4{height:calc(var(--spacing)*4)}`, `.w-3{width:calc(var(--spacing)*3)}`, `.gap-px{gap:1px}`, `.right-0`, `.top-full`, `.z-10`, `.relative`, `.ml-1{margin-left:var(--spacing)}`, `.pb-28`, `.-mb-24`, `.overflow-x-auto{overflow-x:auto}`
  implication: Tailwind source detection covers components/; the group-hover variant has specificity (0,2,0) > .hidden (0,1,0). "Classes not emitted" is not the cause for any of the three gaps.

- timestamp: 2026-10-12T01:22:00Z
  checked: running processes
  found: a `next dev` server (pid 39045) is listening on :3000; .next/dev/build-manifest.json touched 21:05, UAT committed 21:12
  implication: the user most likely tested against this local dev server

- timestamp: 2026-10-12T01:30:00Z
  checked: CSS actually served by the running dev server (GET /_next/static/chunks/[root-of-the-server]__0cbk-n2._.css, linked from /login, 66457 bytes)
  found: same correct rules (group-hover/cell:block inside @media (hover:hover), group-focus/cell:block, .hidden, h-4, w-3, gap-px, ml-1)
  implication: the dev server is not serving stale or missing CSS

- timestamp: 2026-10-12T01:34:00Z
  checked: real ToiTrends markup (renderToStaticMarkup, 16-skater MTL-like fixture, 5 games with OT, SO, DNP, no-chart) + live dev CSS, loaded in headless Chrome via CDP at 1280px, Input.dispatchMouseEvent over Nick Suzuki's 2nd (OT) square
  found: before hover popover display:none; after hover `:hover` matches, popover display:block at x=734..954, y=430..528 (right edge = square's right edge, top = square bottom + 4px), elementFromPoint at its centre is inside the popover (not covered). Squares measure 12x16 with 1px gaps. Pos cell innerText "C5/5 GP" but GP span has computed margin-left 4px; screenshot shows "C 5/5 GP". Headless Chrome reports (hover:hover)=true, (pointer:fine)=true, prefers-color-scheme: dark=true (inherits macOS appearance).
  implication: in Chromium the CSS-only popover mechanism, as committed, works.

- timestamp: 2026-10-12T01:40:00Z
  checked: environment the user tested in
  found: branch gsd/phase-1-ice-time-trends-table has no upstream (not pushed), so not a Vercel build; dev server SSR chunk .next/dev/server/chunks/ssr/[root-of-the-server]__13onl73._.js (19:02) contains the 01-07 popover classes (right-0 top-full); default https handler is com.apple.safari; Safari 27.0.1 has been running since Oct 5 (pid 1188); Safari-only extensions installed
  implication: user almost certainly tested in Safari against the local dev server serving current code

- timestamp: 2026-10-12T01:45:00Z
  checked: same page-5.html (real markup + live dev CSS) in headless WebKit 26.5 (Playwright), colorScheme dark, hover via page.mouse.move over the OT square, then Tab and focus()
  found: (hover:hover)=true; hover -> :hover matches, popover matches `:is(:where(.group\/cell):hover *)`, display:block, rect x=734..954 y=430..528 (same as Chromium); programmatic focus -> display:block; Tab reaches the squares
  implication: WebKit is not the difference either. The committed markup+CSS shows popovers in both engines.

- timestamp: 2026-10-12T01:55:00Z
  checked: real Next.js runtime: scratch copy of the app (auth redirect removed, no .env copied) on :3101, real MTL NHL data (5 games incl. OT-no-chart Oct 3 and SO Oct 10), WebKit dpr2 + Chromium dpr1, dark scheme
  found: hovering any row's square directly (rows 0, 10, 20) -> exactly 1 square :hover, 1 popover shown, hit-test inside square; OT-no-chart popover renders fully ("Oct 3 @ PIT · L 5–6 [OT] / TOI — / Total (incl. OT) 22:43 / ... Excluded from averages..."); no console errors. A sweep straight down a column keeps the FIRST popover open: the open popover (z-10, right-aligned, ~100-130px tall, ~150-290px wide) is a descendant of its square and covers the squares of the next ~4 rows in that column and columns to its left, so those squares never receive :hover.
  implication: the real runtime works too; but occlusion of lower squares is a secondary UX defect

- timestamp: 2026-10-12T02:00:00Z
  checked: .next/dev/trace (handle-request / client-hmr-latency, wall clock from startTime) and .next/dev/logs
  found: user's tab did a FULL document load at 21:04:47 EDT (/research?team=BUF&games=5&sort=ppShare), after the last code change (19:02) and with CSS unchanged since 16:47 (served Cache-Control: no-cache); then soft navs MTL 5 -> MTL 20 -> COL -> MTL sorts -> MTL 20 -> DET until 21:11:37. Tab was hidden 16:57-20:35 (77 queued HMR events applied at 20:35). 21:15 entries are this investigation's curl calls.
  implication: the user's browser had current markup and CSS during UAT; staleness is ruled out

- timestamp: 2026-10-12T02:05:00Z
  checked: WebKit bug 187545 / changeset r236286 (web)
  found: "REGRESSION(r196265): WKWebView fires mouseover, mouseenter, and mouseleave events even when it's in a background window" — table-row hover backgrounds changing in a background Safari window was treated as a bug and fixed in 2018; i.e. Safari on macOS deliberately does not process hover for a non-key window
  implication: when the UAT is answered in a terminal (terminal = key window) and the pointer is then moved over Safari without clicking into it, Safari never applies :hover -> group-hover popovers never open, and keyboard Tab goes to the terminal, not the page. Consistent with: test 4 (click-driven, clicking activates Safari) passed; tests 2 and 5 (hover/Tab-driven) failed. The user's "no popovers" must come from something outside the committed component+CSS: different browser engine, different code actually served, or how the squares are being targeted.

- timestamp: 2026-10-12T02:10:00Z
  checked: strip geometry and Pos cell in screenshots (WebKit dpr2, Chromium dpr1, real MTL data) + CSS tokens
  found: strip = 5 cells x 12px + 4 x 1px gap = 64x16px bar; rounded-sm resolves to --radius-sm .25rem = 4px in Tailwind 4 (a third of the cell width), so cells read as rounded dashes; single-ink neutral-200 (dark) opacity ramp 0.2-1.0 relative to each player's own average makes neighbouring cells similar greys; no cursor/affordance on cells (hover outline appears only after hover); the explaining legend sits under a ~620px table. Pos cell markup `C<span class="ml-1 text-xs tabular-nums text-neutral-600 dark:text-neutral-400">5/5 GP</span>`: innerText "C5/5 GP", separation = 4px margin only, position text-neutral-500 vs GP dark:text-neutral-400 (near-identical tone in dark mode). UI-SPEC example was `C  5/5 GP`. The view test only asserts includes("2/3 GP").
  implication: G-01-5 visual and G-01-1b are deterministic presentation causes in components/ToiGameStrip.tsx and components/ToiTrends.tsx

- timestamp: 2026-10-12T02:12:00Z
  checked: popover clipping in a narrow window (WebKit 760px, wrapper scrolled fully right)
  found: popover left 298 > wrapper left 32, 0px clipped
  implication: right-0 anchoring does not clip at a narrow width; not a contributor

## Resolution

root_cause: |
  G-01-2: no defect in the committed CSS/markup (works in Chromium and WebKit on the real Next.js page with real data). The cause is two things together: (env) the UAT was most likely done in macOS Safari while answering in a terminal, and Safari ignores hover in a non-key window (WebKit bug 187545), so the hover-only reveal never fires and Tab lands in the terminal; (design) the reveal is CSS hover/focus only, on 12x16 targets with no affordance, so nothing prompts the click that would activate the window and focus the square. Secondary: an open popover (z-10, right-aligned, ~100-130px tall) covers the squares of the next ~4 rows, so sweeping down a column keeps showing the first popover.
  G-01-5: (visual) the strip renders exactly per UI-SPEC. 12x16 cells, a 1px gap, Tailwind-4 rounded-sm = 4px radius and a single-ink opacity ramp make 5 cells read as one 64x16 segmented bar ("pieces of a bold line"); nothing marks a cell as a separate game or as hoverable. (popover) Same cause as G-01-2.
  G-01-1b: ToiTrends.tsx Pos cell renders `{position}<span className="ml-1 ...">{gp}/{n} GP</span>` with no text separator; the only gap is a 4px margin between tokens of near-identical muted tone. Text/accessible name is literally "C5/5 GP".
fix: (not applied; goal find_root_cause_only)
verification: (diagnosis only) Chromium + WebKit CDP/Playwright probes on real markup and the real Next.js runtime; dev trace timeline; CSS rule extraction
files_changed: []
