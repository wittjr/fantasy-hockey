#!/usr/bin/env node
/*
 * webkit-player-check.cjs: re-runnable desktop WebKit check of the player detail panel on the real /research page
 * (phase 02, plan 02-07). Run with: node .planning/phases/02-player-linemate-detail/webkit-player-check.cjs
 * Optional env: CHECK_TEAM=EDM (default MTL) when the default team has no shift charts for its recent games.
 *
 * What it does:
 *  - copies the repo (not .git, .next, node_modules, .planning, .claude or any .env* file) to a temp directory,
 *    clones node_modules into it, and removes the three auth-gate lines from the COPY of app/research/page.tsx only;
 *  - runs `next dev -p 3102 -H 127.0.0.1` in the copy (loopback only, so the auth-free copy is not reachable from the network);
 *  - drives it with Playwright's bundled WebKit (playwright-core from the npx cache; nothing is installed), desktop context only
 *    (the site targets laptop browsers), and navigates by clicking, as a user does:
 *      N1-N10  select a player, jump to the panel, swap, re-jump, Back, reload, tab keeps scroll, unit-table name opens the
 *              right tab, window and team links, close;
 *      H1-H7   heat strip: separate squares, hover/click/pin, keyboard focus and Escape, outside press, no clipping at
 *              Last 20, Escape on the Per game strip, dark-mode shades and screenshots;
 *  - kills the server process group and removes the temp directory after a fully passing run.
 * Prints PASS|FAIL|SKIP|INFO lines and a final "player-check:" line. Exit 0 = all passed, 1 = a check failed, 2 = could not run
 * (no summary line). Needs live NHL data (network access).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const PORT = 3102;
const BASE = `http://127.0.0.1:${PORT}`;
const TEAM = (process.env.CHECK_TEAM || "MTL").toUpperCase();
const OTHER_TEAM = TEAM === "EDM" ? "TOR" : "EDM";
const TOP_LEVEL_SKIP = new Set([".git", ".next", "node_modules", ".planning", ".claude"]);
const GATE_LINES = [
  'import { auth } from "@/auth";\n',
  "  const session = await auth();\n",
  '  if (!session?.user) redirect("/login");\n',
];

const counts = { pass: 0, fail: 0, skip: 0 };
const out = (kind, id, what, details) => {
  if (kind === "PASS") counts.pass++;
  else if (kind === "FAIL") counts.fail++;
  else if (kind === "SKIP") counts.skip++;
  console.log(`${kind} ${id} ${what}${details === undefined ? "" : " " + JSON.stringify(details)}`);
};

/** Thrown for "could not run" conditions found after the server is up, so main() can still clean up and exit 2. */
class HarnessError extends Error {}

function die(msg) {
  console.error(msg);
  process.exit(2);
}

function findPlaywright() {
  const root = path.join(os.homedir(), ".npm", "_npx");
  let dirs = [];
  try {
    dirs = fs.readdirSync(root).map((d) => path.join(root, d, "node_modules", "playwright-core"));
  } catch {}
  const found = dirs.find((d) => fs.existsSync(path.join(d, "package.json")));
  if (!found) die("playwright-core not found in the npx cache; not installing anything");
  return require(found);
}

async function answers(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.status;
  } catch {
    return null;
  }
}

function makeScratchApp() {
  const root = path.resolve(__dirname, "..", "..", "..");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "player-check-"));
  fs.cpSync(root, tmp, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(root, src);
      if (rel && TOP_LEVEL_SKIP.has(rel.split(path.sep)[0])) return false;
      return !path.basename(src).startsWith(".env");
    },
  });
  execFileSync("cp", ["-Rc", path.join(root, "node_modules"), path.join(tmp, "node_modules")]);
  const pagePath = path.join(tmp, "app", "research", "page.tsx");
  let page = fs.readFileSync(pagePath, "utf8");
  for (const line of GATE_LINES) {
    if (!page.includes(line)) {
      fs.rmSync(tmp, { recursive: true, force: true });
      die("auth gate changed; update webkit-player-check.cjs");
    }
    page = page.replace(line, "");
  }
  fs.writeFileSync(pagePath, page);
  return tmp;
}

// Helpers injected into every page. A "scope" is "panel" (the player detail heat strip) or "trend" (the Ice-time trends Per game strip).
const PAGE_HELPERS = `
window.__pc = {
  list(scope) {
    if (scope === "panel") return [...document.querySelectorAll("#player-detail [data-state]")];
    const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.trim() === "Ice-time trends");
    return h ? [...h.closest("section").querySelectorAll("tbody [data-state]")] : [];
  },
  pop(el) { return el.querySelector(':scope > [aria-hidden="true"]'); },
  shown(el) { return getComputedStyle(this.pop(el)).display !== "none"; },
  anyShown(scope) { return this.list(scope).filter((el) => this.shown(el)).length; },
  inside(el) {
    const p = this.pop(el).getBoundingClientRect();
    const w = el.closest(".overflow-x-auto").getBoundingClientRect();
    return { inside: p.left >= w.left - 1 && p.right <= w.right + 1 && p.top >= w.top - 1 && p.bottom <= w.bottom + 1,
      pop: [p.left, p.top, p.right, p.bottom].map(Math.round), wrapper: [w.left, w.top, w.right, w.bottom].map(Math.round) };
  },
  state(el) {
    return { shown: this.shown(el), focused: document.activeElement === el, dismissed: el.hasAttribute("data-dismissed"),
      open: el.hasAttribute("data-open"), expanded: el.hasAttribute("aria-expanded") };
  },
};
`;

const TRENDS = 'section:has(h2:text-is("Ice-time trends"))';
const NAME_LINKS = `${TRENDS} tbody tr td:first-child a`;
const SITUATION_NAV = 'nav[aria-label="Situation"]';
const panelSq = (page, i) => page.locator("#player-detail [data-state]").nth(i);
const call = (page, fn, scope, i) => page.evaluate(([f, s, n]) => window.__pc[f](window.__pc.list(s)[n]), [fn, scope, i]);

async function check(id, what, fn) {
  try {
    const res = await fn();
    if (res && res.skip) out("SKIP", id, what, res.details);
    else if (res && res.ok) out("PASS", id, what, res.details);
    else out("FAIL", id, what, res && res.details);
  } catch (err) {
    out("FAIL", id, what, { error: String(err && err.message ? err.message : err).split("\n")[0] });
  }
}

const settle = (page, ms = 150) => page.waitForTimeout(ms);

/** Resolves true when `fn(arg)` becomes truthy in the page within `timeout` ms (RESEARCH: dev can show the old player for a while after Back). */
async function until(page, fn, arg, timeout = 15000) {
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 100 });
    return true;
  } catch {
    return false;
  }
}

async function hydrated(page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-state]");
      return !!el && Object.getOwnPropertyNames(el).some((k) => k.startsWith("__reactProps"));
    },
    null,
    { timeout: 60000 },
  );
}

async function open(context, query) {
  const page = await context.newPage();
  await page.goto(`${BASE}/research?team=${TEAM}&games=5${query}`, { waitUntil: "networkidle", timeout: 120000 });
  await hydrated(page);
  return page;
}

async function openPanel(context, games, playerId) {
  const page = await context.newPage();
  await page.goto(`${BASE}/research?team=${TEAM}&games=${games}&player=${playerId}`, { waitUntil: "networkidle", timeout: 120000 });
  await hydrated(page);
  return page;
}

const nameLink = async (page, i) =>
  page.locator(NAME_LINKS).nth(i).evaluate((a) => ({
    href: a.getAttribute("href"),
    name: a.textContent.trim(),
    id: (/player=(\d+)/.exec(a.getAttribute("href") || "") || [])[1] || null,
  }));

/** Waits until the URL carries player (and sit, when given) and the panel heading starts with the name. */
const waitPlayer = (page, id, name, sit) =>
  until(
    page,
    ([id, name, sit]) => {
      const p = new URLSearchParams(location.search);
      if (p.get("player") !== String(id)) return false;
      if (sit !== undefined && (p.get("sit") || "ev") !== sit) return false;
      const h = document.querySelector("#player-detail-title");
      return !!h && (!name || h.textContent.trim().startsWith(name));
    },
    [id, name, sit],
  );

const panelState = (page) =>
  page.evaluate(() => {
    const p = new URLSearchParams(location.search);
    return {
      player: p.get("player"),
      sit: p.get("sit"),
      games: p.get("games"),
      team: p.get("team"),
      h2: document.querySelector("#player-detail-title")?.textContent.trim().slice(0, 40) ?? null,
      scrollY: Math.round(scrollY),
    };
  });

/** The panel's top edge relative to the viewport, once the hash jump has landed (it runs after the server render). */
async function topAfterJump(page) {
  let top = null;
  for (let n = 0; n < 50; n++) {
    top = await page.evaluate(() => document.querySelector("#player-detail")?.getBoundingClientRect().top ?? null);
    if (top !== null && top >= 0 && top <= 40) return top;
    await page.waitForTimeout(100);
  }
  return top;
}

const panelTop = (page) => page.evaluate(() => document.querySelector("#player-detail")?.getBoundingClientRect().top ?? null);
const hasPanel = (page) => page.evaluate(() => !!document.querySelector("#player-detail"));
const scrollY = (page) => page.evaluate(() => Math.round(window.scrollY));

async function blankPoint(page) {
  const h = page.locator("#player-detail-title");
  await h.scrollIntoViewIfNeeded();
  const b = await h.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function resetPointer(page) {
  const b = await blankPoint(page);
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.mouse.move(1, 1);
  await settle(page);
}

async function navigationChecks(context) {
  const page = await open(context, "");
  const info = await page.evaluate(() => ({ userAgent: navigator.userAgent, hoverHover: matchMedia("(hover: hover)").matches }));
  console.log(`INFO N0 desktop environment ${JSON.stringify({ team: TEAM, ...info })}`);
  const rows = await page.locator(NAME_LINKS).count();
  if (rows < 4) throw new HarnessError(`only ${rows} trends rows for ${TEAM}; set CHECK_TEAM`);
  const A = { id: null, name: null };
  const B = { id: null, name: null };

  await check("N1", "no player in the URL means no panel", async () => {
    const present = await hasPanel(page);
    return { ok: !present && !new URL(page.url()).searchParams.has("player"), details: { present } };
  });

  await check("N2", "clicking the last trends row's name adds player to the URL, shows his panel and lands it 0-40px from the top (D-03)", async () => {
    const link = page.locator(NAME_LINKS).nth(rows - 1);
    await link.scrollIntoViewIfNeeded();
    const target = await nameLink(page, rows - 1);
    Object.assign(A, { id: target.id, name: target.name });
    const before = await scrollY(page);
    await link.click();
    const found = await waitPlayer(page, A.id, A.name);
    const top = await topAfterJump(page);
    return { ok: found && top !== null && top >= 0 && top <= 40, details: { found, top, scrollBefore: before, ...(await panelState(page)) } };
  });

  await check("N3", "clicking the second-to-last row's name swaps the player and lands the panel at the same spot", async () => {
    const link = page.locator(NAME_LINKS).nth(rows - 2);
    await link.scrollIntoViewIfNeeded();
    const target = await nameLink(page, rows - 2);
    Object.assign(B, { id: target.id, name: target.name });
    await link.click();
    const found = await waitPlayer(page, B.id, B.name);
    const top = await topAfterJump(page);
    return { ok: found && B.id !== A.id && top !== null && top >= 0 && top <= 40, details: { found, top, ...(await panelState(page)) } };
  });

  await check("N4", "clicking the selected name from the bottom of the page jumps back to the panel (hash anchor)", async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const before = await panelTop(page);
    await page.locator(`${TRENDS} a[href="#player-detail"][aria-current="true"]`).click();
    const top = await topAfterJump(page);
    return { ok: before !== null && (before < 0 || before > 40) && top !== null && top >= 0 && top <= 40, details: { before, top, ...(await panelState(page)) } };
  });

  await check("N5", "Back restores the previous player in the URL and the heading (D-04)", async () => {
    await page.goBack({ waitUntil: "commit", timeout: 15000 }).catch(() => null);
    const found = await waitPlayer(page, A.id, A.name);
    return { ok: found, details: { found, expected: A, ...(await panelState(page)) } };
  });

  await check("N6", "reload shows the same player's panel", async () => {
    await page.reload({ waitUntil: "networkidle", timeout: 120000 });
    await hydrated(page);
    const found = await waitPlayer(page, A.id, A.name);
    return { ok: found, details: { found, ...(await panelState(page)) } };
  });

  await check("N7", "clicking the PP tab sets sit=pp, marks PP current and keeps the scroll position (scroll false)", async () => {
    const start = await page.evaluate((sel) => {
      const n = document.querySelector(sel);
      window.scrollTo(0, n.getBoundingClientRect().top + window.scrollY - 150);
      return Math.round(window.scrollY);
    }, SITUATION_NAV);
    await settle(page, 300);
    const before = await scrollY(page);
    await page.locator(`${SITUATION_NAV} a:text-is("PP")`).click();
    const found = await until(
      page,
      (sel) => new URLSearchParams(location.search).get("sit") === "pp" && document.querySelector(`${sel} a[aria-current="true"]`)?.textContent.trim() === "PP",
      SITUATION_NAV,
    );
    await settle(page, 500);
    const after = await scrollY(page);
    return { ok: found && before > 0 && Math.abs(after - before) <= 4, details: { found, start, before, after } };
  });

  await check("N8", "clicking a name in a PP unit table opens that player on the PP tab and jumps to the panel (D-22)", async () => {
    const target = await page.evaluate((cur) => {
      const tables = [...document.querySelectorAll("table")].filter((t) =>
        (t.querySelector("thead tr")?.lastElementChild?.textContent ?? "").trim().startsWith("PP - "),
      );
      for (const t of tables) {
        for (const a of t.querySelectorAll("tbody td:last-child a")) {
          const m = /player=(\d+)/.exec(a.getAttribute("href") ?? "");
          if (m && m[1] !== String(cur)) {
            a.setAttribute("data-pc-target", "1");
            return { id: m[1], name: a.textContent.trim(), href: a.getAttribute("href") };
          }
        }
      }
      return null;
    }, A.id);
    if (!target) return { ok: false, details: { error: "no linked name in a PP unit table" } };
    await page.locator("[data-pc-target]").scrollIntoViewIfNeeded();
    await page.locator("[data-pc-target]").click();
    const found = await waitPlayer(page, target.id, target.name, "pp");
    const ppCurrent = await until(page, (sel) => document.querySelector(`${sel} a[aria-current="true"]`)?.textContent.trim() === "PP", SITUATION_NAV, 5000);
    const top = await topAfterJump(page);
    return {
      ok: found && ppCurrent && target.href.includes("sit=pp") && top !== null && top >= 0 && top <= 40,
      details: { found, ppCurrent, top, target, ...(await panelState(page)) },
    };
  });

  await check("N9", "Last 3 keeps player and sit; another team's link drops the player and the panel (D-04)", async () => {
    await page.locator('a:text-is("Last 3")').click();
    const kept = await until(
      page,
      () => {
        const p = new URLSearchParams(location.search);
        return p.get("games") === "3" && !!p.get("player") && p.get("sit") === "pp" && !!document.querySelector("#player-detail-title");
      },
      null,
    );
    const afterWindow = await panelState(page);
    await page.locator(`nav a:text-is("${OTHER_TEAM}")`).click();
    const dropped = await until(page, (t) => new URLSearchParams(location.search).get("team") === t && !location.search.includes("player="), OTHER_TEAM);
    await settle(page, 500);
    const panel = await hasPanel(page);
    return { ok: kept && dropped && !panel, details: { kept, dropped, panel, afterWindow, url: page.url() } };
  });

  await check("N10", "the panel's close link drops player, removes the panel and keeps the scroll position", async () => {
    await page.locator(`nav a:text-is("${TEAM}")`).click();
    await until(page, (t) => new URLSearchParams(location.search).get("team") === t, TEAM);
    const target = await nameLink(page, 0);
    await page.locator(NAME_LINKS).nth(0).click();
    const opened = await waitPlayer(page, target.id, target.name);
    await topAfterJump(page);
    await settle(page, 300);
    const before = await scrollY(page);
    await page.locator('#player-detail [aria-label^="Close "]').click();
    const closed = await until(page, () => !location.search.includes("player=") && !document.querySelector("#player-detail"), null);
    await settle(page, 500);
    const after = await scrollY(page);
    return { ok: opened && closed && Math.abs(after - before) <= 4, details: { opened, closed, before, after, url: page.url() } };
  });

  await page.close();
}

/** Finds a trends-table player whose panel has at least one heat-strip square (RESEARCH Pitfall 7: some games have no shift chart). */
async function findPlayer(context) {
  const page = await open(context, "");
  const candidates = [];
  const n = Math.min(8, await page.locator(NAME_LINKS).count());
  for (let i = 0; i < n; i++) candidates.push(await nameLink(page, i));
  await page.close();
  for (const c of candidates) {
    const panel = await openPanel(context, 5, c.id);
    const squares = await panel.locator("#player-detail [data-state]").count();
    await panel.close();
    if (squares > 0) {
      console.log(`INFO H0 player ${c.id} ${c.name} (${squares} heat-strip squares) on ${TEAM}`);
      return c;
    }
  }
  throw new HarnessError(`no player with linemate data for ${TEAM}; set CHECK_TEAM`);
}

/** Tab from `start` to the first square in `scope`, then Escape, Tab away and Shift+Tab back (WR-10). */
async function escapeCheck(page, start, scope) {
  await page.mouse.move(1, 1);
  await start.focus();
  let found = null;
  for (let n = 1; n <= 12 && found === null; n++) {
    await page.keyboard.press("Tab");
    const i = await page.evaluate((s) => window.__pc.list(s).indexOf(document.activeElement), scope);
    if (i >= 0) found = i;
  }
  if (found === null) return { ok: false, details: { error: "no square reached within 12 Tab presses" } };
  const state = () => page.evaluate(([s, i]) => window.__pc.state(window.__pc.list(s)[i]), [scope, found]);
  await settle(page);
  const onFocus = await state();
  await page.keyboard.press("Escape");
  await settle(page);
  const afterEscape = await state();
  await page.keyboard.press("Tab");
  await settle(page);
  const nextTabLandedOn = await page.evaluate((s) => window.__pc.list(s).indexOf(document.activeElement), scope);
  await page.keyboard.press("Shift+Tab");
  await settle(page);
  const refocused = await state();
  const hasNext = await page.evaluate(([s, i]) => i + 1 < window.__pc.list(s).length, [scope, found]);
  const ok =
    onFocus.shown &&
    !afterEscape.shown && afterEscape.focused && afterEscape.dismissed && !afterEscape.expanded &&
    (!hasNext || nextTabLandedOn === found + 1) &&
    refocused.shown && refocused.focused && !refocused.dismissed;
  return { ok, details: { square: found, onFocus, afterEscape, nextTabLandedOn, refocused } };
}

async function heatStripChecks(context, player) {
  const page = await openPanel(context, 5, player.id);
  const G = await page.evaluate(() => {
    const row = [...document.querySelectorAll("#player-detail tbody tr")].find((tr) => tr.querySelector("[data-state]"));
    return row.querySelectorAll("[data-state]").length;
  });
  const COL = Math.min(1, G - 1);
  const flag = (i, attr) => page.evaluate(([n, a]) => window.__pc.list("panel")[n].hasAttribute(a), [i, attr]);

  await check("H1", "every square in the panel's first strip row is at least 20x20 and neighbours are at least 24px apart centre to centre", async () => {
    const boxes = await page.evaluate(() => {
      const row = [...document.querySelectorAll("#player-detail tbody tr")].find((tr) => tr.querySelector("[data-state]"));
      return [...row.querySelectorAll("[data-state]")].map((s) => {
        const r = s.getBoundingClientRect();
        return { w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
      });
    });
    const small = boxes.filter((b) => b.w < 20 || b.h < 20).map((b) => [b.w, b.h]);
    const pitch = boxes.slice(1).map((b, i) => Math.hypot(b.cx - boxes[i].cx, b.cy - boxes[i].cy));
    return { ok: boxes.length > 1 && small.length === 0 && pitch.every((d) => d >= 24), details: { squares: boxes.length, small, minPitch: Math.min(...pitch) } };
  });

  await check("H2", "hover shows the popover and leaving hides it; a click pins it past the pointer leaving; a second click unpins", async () => {
    await resetPointer(page);
    await panelSq(page, COL).hover();
    await settle(page);
    const hovered = await call(page, "shown", "panel", COL);
    const hoverPinned = await flag(COL, "data-open");
    await resetPointer(page);
    const afterLeave = await call(page, "shown", "panel", COL);
    await panelSq(page, COL).click();
    const b = await blankPoint(page);
    await page.mouse.move(b.x, b.y);
    await settle(page);
    const pinnedShown = await call(page, "shown", "panel", COL);
    const pinned = await flag(COL, "data-open");
    await panelSq(page, COL).click();
    await page.mouse.move(b.x, b.y);
    await settle(page);
    const unpinnedShown = await call(page, "shown", "panel", COL);
    const unpinned = !(await flag(COL, "data-open"));
    return {
      ok: hovered && !hoverPinned && !afterLeave && pinnedShown && pinned && !unpinnedShown && unpinned,
      details: { hovered, hoverPinned, afterLeave, pinnedShown, pinned, unpinnedShown, unpinned },
    };
  });

  await check("H3", "Tab from the Situation nav reaches a square and shows its popover; Escape hides it, keeps focus, sets data-dismissed, no aria-expanded; Shift+Tab back re-arms it (WR-10)", async () => {
    await resetPointer(page);
    return escapeCheck(page, page.locator(`${SITUATION_NAV} a[aria-current="true"]`), "panel");
  });

  await check("H4", "pinning a square and then pressing the pointer on a blank area closes the popover", async () => {
    await resetPointer(page);
    await panelSq(page, COL).click();
    const b = await blankPoint(page);
    await page.mouse.move(1, 1);
    const pinned = await call(page, "shown", "panel", COL);
    await page.mouse.move(b.x, b.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(1, 1);
    await settle(page);
    const shown = await call(page, "shown", "panel", COL);
    const stillPinned = await flag(COL, "data-open");
    return { ok: pinned && !shown && !stillPinned, details: { pinned, shown, stillPinned } };
  });

  await check("H6", "Escape on a square of the Ice-time trends Per game strip hides the popover and keeps focus (WR-10, second strip)", async () => {
    await resetPointer(page);
    return escapeCheck(page, page.locator(NAME_LINKS).nth(0), "trend");
  });
  await page.close();

  const page20 = await openPanel(context, 20, player.id);
  await check("H5", "pinned popovers are not clipped at Last 20 (last forward row and last defense row, leftmost and rightmost squares)", async () => {
    const groups = await page20.evaluate(() => {
      const squares = window.__pc.list("panel");
      const bodies = [...document.querySelectorAll("#player-detail table tbody")];
      const res = {};
      ["forwards", "defense"].forEach((name, k) => {
        const rows = bodies[k] ? [...bodies[k].querySelectorAll("tr")].filter((tr) => tr.querySelector("[data-state]")) : [];
        const last = rows.length ? rows[rows.length - 1] : null;
        const cells = last ? [...last.querySelectorAll("[data-state]")] : [];
        res[name] = cells.length ? { left: squares.indexOf(cells[0]), right: squares.indexOf(cells[cells.length - 1]) } : null;
      });
      return res;
    });
    const results = [];
    const skipped = [];
    for (const [name, g] of Object.entries(groups)) {
      if (!g) {
        skipped.push(name);
        console.log(`INFO H5 ${name} has no rows for this player; group skipped`);
        continue;
      }
      for (const side of ["left", "right"]) {
        const i = g[side];
        await page20.evaluate(([n, s]) => {
          const w = window.__pc.list("panel")[n].closest(".overflow-x-auto");
          w.scrollLeft = s === "left" ? 0 : w.scrollWidth;
        }, [i, side]);
        await panelSq(page20, i).click();
        await page20.mouse.move(1, 1);
        await settle(page20);
        const shown = await call(page20, "shown", "panel", i);
        const inside = await call(page20, "inside", "panel", i);
        await panelSq(page20, i).click();
        await page20.mouse.move(1, 1);
        await settle(page20);
        const closed = !(await call(page20, "shown", "panel", i));
        results.push({ name, side, shown, closed, ...inside });
      }
    }
    if (results.length === 0) return { skip: true, details: { reason: "no linemate rows at Last 20", skipped } };
    const bad = results.filter((x) => !(x.shown && x.inside && x.closed));
    return { ok: bad.length === 0, details: bad.length ? { bad } : { checked: results.length, skipped } };
  });
  await page20.close();
}

/** H7: light and dark screenshots into an OS temp directory, and a check that the dark surface still shows distinct shades. */
async function colourChecks(pw, player) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "player-check-shots-"));
  const browser = await pw.webkit.launch();
  const files = [];
  let darkResult = null;
  try {
    for (const scheme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
      await context.addInitScript(PAGE_HELPERS);
      try {
        const page = await openPanel(context, 5, player.id);
        const shot = async (locator, name) => {
          const file = path.join(dir, `${scheme}-${name}.png`);
          await locator.screenshot({ path: file });
          files.push(file);
        };
        await shot(page.locator("#player-detail"), "panel");
        const selectedRow = (p) => p.locator(`${TRENDS} tbody tr`, { has: p.locator('a[aria-current="true"]') }).first();
        await shot(selectedRow(page), "selected-row");
        const mover = await page.evaluate(() => {
          const tr = document.querySelector("tr.bg-green-100, tr.bg-red-100");
          const a = tr && tr.querySelector("td:first-child a");
          const id = a && (/player=(\d+)/.exec(a.getAttribute("href") || "") || [])[1];
          return id ? { id, tone: tr.classList.contains("bg-green-100") ? "green" : "red" } : null;
        });
        if (mover) {
          const moverPage = await openPanel(context, 5, mover.id);
          await shot(selectedRow(moverPage), `selected-${mover.tone}-row`);
        } else {
          console.log(`INFO H7 no green or red row on ${TEAM} to show the selected-row bar on (${scheme})`);
        }
        if (scheme === "dark") {
          darkResult = await page.evaluate(() => ({
            dark: matchMedia("(prefers-color-scheme: dark)").matches,
            opacities: [...document.querySelectorAll('#player-detail [data-state="together"] > span:not([aria-hidden])')].map((s) => Number(getComputedStyle(s).opacity)),
          }));
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`INFO H7 screenshots ${files.join(" ")} (team ${TEAM}, player ${player.name})`);
  await check("H7", "dark mode: together squares have computed opacities within 0.2-1 and at least two distinct shades", async () => {
    const o = darkResult.opacities;
    const distinct = [...new Set(o.map((v) => v.toFixed(2)))];
    const inRange = o.every((v) => v >= 0.2 - 1e-6 && v <= 1 + 1e-6);
    return { ok: darkResult.dark && o.length > 0 && inRange && distinct.length >= 2, details: { dark: darkResult.dark, squares: o.length, distinct: distinct.length, min: Math.min(...o), max: Math.max(...o) } };
  });
}

async function main() {
  const pw = findPlaywright();
  if ((await answers(`${BASE}/`)) !== null) die(`port ${PORT} busy`);
  const tmp = makeScratchApp();
  const log = [];
  const server = spawn(process.execPath, [path.join(tmp, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: tmp,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    // Minimal environment: the auth-free copy gets no secrets from this shell.
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: process.env.LANG, NEXT_TELEMETRY_DISABLED: "1" },
  });
  for (const s of [server.stdout, server.stderr]) s.on("data", (d) => log.push(...String(d).split("\n")));
  const stop = () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  };
  process.on("SIGINT", () => {
    stop();
    process.exit(130);
  });
  let completed = false;
  try {
    let up = false;
    for (let n = 0; n < 180 && !up; n++) {
      if ((await answers(`${BASE}/research?team=${TEAM}&games=5`)) === 200) up = true;
      else await new Promise((r) => setTimeout(r, 1000));
    }
    if (!up) {
      console.error(log.slice(-40).join("\n"));
      console.error(`scratch copy kept at ${tmp}`);
      process.exitCode = 2;
      return;
    }
    let player;
    const browser = await pw.webkit.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addInitScript(PAGE_HELPERS);
      await navigationChecks(context);
      player = await findPlayer(context);
      await heatStripChecks(context, player);
    } finally {
      await browser.close();
    }
    await colourChecks(pw, player);
    completed = true;
  } catch (err) {
    if (err instanceof HarnessError) {
      console.error(err.message);
      process.exitCode = 2;
    } else {
      throw err;
    }
  } finally {
    stop();
    await new Promise((r) => setTimeout(r, 500));
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {}
    if (completed && counts.fail === 0) fs.rmSync(tmp, { recursive: true, force: true });
    else console.log(`scratch copy kept at ${tmp}`);
    if (process.exitCode !== 2) console.log(`player-check: ${counts.pass} passed, ${counts.fail} failed, ${counts.skip} skipped`);
    if (counts.fail > 0 && !process.exitCode) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
