#!/usr/bin/env node
/*
 * webkit-units-check.cjs: re-runnable desktop WebKit check of the real /research page (phase 03, plans 03-09 and 03-10).
 * Run with: node .planning/phases/03-unit-event-stats/webkit-units-check.cjs
 * Optional env: CHECK_TEAM=EDM (default MTL). The second and third teams of U1 are the other two of TOR, EDM, MTL taken
 * in that order (MTL: TOR and EDM; EDM: TOR and MTL; TOR: EDM and MTL).
 *
 * Checks in this file (plan 03-09):
 *   U1  cold Last 20 for three teams within a minute: each page renders its "Last game" section, shows no
 *       "Couldn't load NHL data" banner, and the server log has no "429" (ROADMAP SC5, DATA-01); INFO seconds per load.
 *   U2  warm reload of the first team makes no NHL request (D-01) other than the by-design uncached re-request of a shift
 *       chart or play-by-play that is still empty; SKIP when the request counter saw nothing in U1.
 * Checks in this file (plan 03-10, the unit tables on /research?team=<T>&games=5, desktop widths only):
 *   U3  the six Last game tables render in order EV, PP, SH (forwards then defense) with the Goals, Shots and Corsi group headers,
 *       the 13 column headers, Other then Total as last rows and the legend under them; no Other count (GF, GA, SF, SA, CF, CA)
 *       is negative (UNIT-01..03; the live render check). FAIL, never a pass, when the last game has no shift chart.
 *   U4  clicking a linked name in a PP table opens that player's panel with PP as the current tab (UNIT-04).
 * Added in the same plan, second task: U5 and U6 (see the check functions below).
 *
 * What it does:
 *  - copies the repo (not .git, .next, node_modules, .planning, .claude or any .env* file) to a temp directory,
 *    clones node_modules into it, and removes the three auth-gate lines from the COPY of app/research/page.tsx only
 *    (the repo's page is never edited);
 *  - writes count-nhl-fetch.cjs into the temp directory and starts `next dev -p 3103 -H 127.0.0.1` there with
 *    NODE_OPTIONS=--require <it>: the preload wraps globalThis.fetch and prints "NHL-FETCH <url>" to stderr for every
 *    NHL request, api-web.nhle.com and the api.nhle.com shift charts (Next wraps the fetch it finds, so only real network calls, not cache hits, reach the wrapper);
 *  - the server binds loopback only, so the auth-free copy is not reachable from the network;
 *  - drives it with Playwright's bundled WebKit (playwright-core from the npx cache; nothing is installed), desktop context only
 *    (the site targets laptop browsers);
 *  - kills the server process group and removes the temp directory after a fully passing run.
 * The scratch copy has no .next directory, so the first loads are cold. Needs live NHL data (network access) and at least 60 s
 * without other live NHL load before each run.
 * Prints PASS|FAIL|SKIP|INFO lines and a final "units-check:" line. Exit 0 = all passed, 1 = a check failed, 2 = could not run
 * (no summary line).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const PORT = 3103;
const BASE = `http://127.0.0.1:${PORT}`;
const TEAM = (process.env.CHECK_TEAM || "MTL").toUpperCase();
const OTHER_TEAMS = ["TOR", "EDM", "MTL"].filter((t) => t !== TEAM).slice(0, 2);
const TOP_LEVEL_SKIP = new Set([".git", ".next", "node_modules", ".planning", ".claude"]);
const GATE_LINES = [
  'import { auth } from "@/auth";\n',
  "  const session = await auth();\n",
  '  if (!session?.user) redirect("/login");\n',
];

// Prints one line per real NHL request (api-web.nhle.com and the api.nhle.com shift charts). Next patches globalThis.fetch after this runs, so cache hits never reach it.
const COUNT_FETCH_PRELOAD = `
const original = globalThis.fetch;
if (typeof original === "function" && !original.__nhlCounter) {
  const wrapped = function (input, init) {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input && input.url;
      if (url && url.includes("nhle.com")) process.stderr.write("NHL-FETCH " + url + "\\n");
    } catch {}
    return original.apply(this, arguments);
  };
  wrapped.__nhlCounter = true;
  globalThis.fetch = wrapped;
}
`;

const counts = { pass: 0, fail: 0, skip: 0 };
const out = (kind, id, what, details) => {
  if (kind === "PASS") counts.pass++;
  else if (kind === "FAIL") counts.fail++;
  else if (kind === "SKIP") counts.skip++;
  console.log(`${kind} ${id} ${what}${details === undefined ? "" : " " + JSON.stringify(details)}`);
};

/** Server stdout and stderr, one entry per line, in arrival order. Checks take `log.length` as a mark and slice from it. */
const log = [];

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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "units-check-"));
  fs.cpSync(root, tmp, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(root, src);
      if (rel && TOP_LEVEL_SKIP.has(rel.split(path.sep)[0])) return false;
      return !path.basename(src).startsWith(".env");
    },
  });
  // node_modules may be a symlink (a worktree borrowing the main checkout's); clone the real directory so Turbopack
  // sees a real one. BSD `cp -R` would copy a symlink source as a symlink.
  execFileSync("cp", ["-Rc", fs.realpathSync(path.join(root, "node_modules")), path.join(tmp, "node_modules")]);
  const pagePath = path.join(tmp, "app", "research", "page.tsx");
  let page = fs.readFileSync(pagePath, "utf8");
  for (const line of GATE_LINES) {
    if (!page.includes(line)) {
      fs.rmSync(tmp, { recursive: true, force: true });
      die("auth gate changed; update webkit-units-check.cjs");
    }
    page = page.replace(line, "");
  }
  fs.writeFileSync(pagePath, page);
  fs.writeFileSync(path.join(tmp, "count-nhl-fetch.cjs"), COUNT_FETCH_PRELOAD);
  return tmp;
}

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

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Server log lines from `mark` on that are NHL-FETCH counter lines. Waits briefly so piped stderr has arrived. */
async function fetchesSince(mark) {
  await pause(1500);
  return log.slice(mark).filter((l) => l.startsWith("NHL-FETCH "));
}

/** True when `url` is a shift chart or play-by-play request whose answer is empty right now (the harness asks the API itself). */
async function isEmptyResult(url) {
  const shift = url.includes("/shiftcharts?");
  if (!shift && !url.endsWith("/play-by-play")) return false;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return false;
    const json = await res.json();
    return (shift ? json.data : json.plays)?.length === 0;
  } catch {
    return false;
  }
}

/**
 * Opens Last 20 for a team on a fresh page and reports what the page shows. The server renders after loading every game,
 * so goto resolves only once the load finished (or failed).
 */
async function loadLast20(context, team) {
  const page = await context.newPage();
  const started = Date.now();
  const response = await page.goto(`${BASE}/research?team=${team}&games=20`, { waitUntil: "load", timeout: 240000 });
  const seconds = (Date.now() - started) / 1000;
  const shown = await page.evaluate(() => ({
    lastGame: [...document.querySelectorAll("h2")].some((h) => h.textContent.trim().startsWith("Last game")),
    banner: /Couldn['’]t load NHL data/.test(document.body.innerText),
  }));
  await page.close();
  return { team, status: response ? response.status() : null, seconds: Number(seconds.toFixed(1)), ...shown };
}

async function loadChecks(context) {
  const teams = [TEAM, ...OTHER_TEAMS];
  const logMark = log.length;
  const startedAt = Date.now();

  await check("U1", `cold Last 20 for ${teams.join(", ")} opened back to back shows the Last game section, no load-error banner and no 429 in the server log (SC5)`, async () => {
    const loads = [];
    for (const team of teams) {
      const load = await loadLast20(context, team);
      loads.push(load);
      console.log(`INFO U1 team=${load.team} seconds=${load.seconds} lastGame=${load.lastGame} banner=${load.banner} status=${load.status}`);
    }
    const total = Number(((Date.now() - startedAt) / 1000).toFixed(1));
    await pause(1500);
    const throttled = log.slice(logMark).filter((l) => l.includes("429"));
    const bad = loads.filter((l) => l.status !== 200 || !l.lastGame || l.banner);
    return { ok: bad.length === 0 && throttled.length === 0 && total <= 60, details: { totalSeconds: total, bad, throttled: throttled.slice(0, 5) } };
  });

  const fetchesDuringCold = log.slice(logMark).filter((l) => l.startsWith("NHL-FETCH ")).length;
  console.log(`INFO U1 NHL requests counted during the cold loads: ${fetchesDuringCold}`);

  await check("U2", `reloading ${TEAM} Last 20 after the cold load makes no NHL request (D-01)`, async () => {
    if (fetchesDuringCold === 0) {
      return { skip: true, details: { reason: "the NHL-FETCH counter saw no request during U1, so it is not wired" } };
    }
    const mark = log.length;
    const warm = await loadLast20(context, TEAM);
    const urls = (await fetchesSince(mark)).map((l) => l.slice("NHL-FETCH ".length));
    console.log(`INFO U2 team=${TEAM} seconds=${warm.seconds} lastGame=${warm.lastGame} banner=${warm.banner}`);
    // By design (plan 03-07) a shift chart or play-by-play that came back empty is requested again uncached on every load,
    // so it is never pinned. Those requests are not cache misses; anything else is.
    const refetchedEmpty = [];
    const misses = [];
    for (const url of urls) (await isEmptyResult(url) ? refetchedEmpty : misses).push(url);
    return {
      ok: warm.status === 200 && warm.lastGame && !warm.banner && misses.length === 0,
      details: { requests: urls.length, misses: misses.slice(0, 10), refetchedEmpty },
    };
  });
}

const SITUATION_ORDER = ["EV", "PP", "SH"];
const EXPECTED_TITLES = SITUATION_ORDER.flatMap((s) => [`${s} - Forwards`, `${s} - Defense`]);
const EXPECTED_HEADERS = ["#", "Time", "%", null, "GF", "GA", "+/-", "SF", "SA", "SF%", "CF", "CA", "CF%"]; // null = the table's own title
const LEGEND_PHRASES = [
  "GF and GA are goals for and against",
  "+/- is GF",
  "Other is everything in that situation not on a listed line",
  "all time and events while either goalie was pulled",
];
const SPEC_URL = `${BASE}/research?team=${TEAM}&games=5`;

/** Opens the last 5 games of a team on a fresh page (the Last game section does not depend on the window). */
async function openUnitPage(context, team) {
  const page = await context.newPage();
  await page.goto(`${BASE}/research?team=${team}&games=5`, { waitUntil: "load", timeout: 240000 });
  return page;
}

/** Reads the six tables of the Last game section. Runs in the page, so it is self-contained. */
function readLastGameTables() {
  const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
  const h2 = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim().startsWith("Last game"));
  if (!h2) return { error: "no Last game section" };
  const section = h2.closest("section");
  const tables = [...section.querySelectorAll("table")];
  const foot = section.lastElementChild;
  return {
    heading: text(h2),
    noChart: /No shift chart is available/.test(section.innerText),
    footText: foot ? foot.innerText : "",
    footAfterTables: tables.length > 0 && !!foot && !!(tables[tables.length - 1].compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING),
    tables: tables.map((t) => {
      const head = [...t.tHead.rows];
      return {
        groups: [...head[0].querySelectorAll('th[scope="colgroup"]')].map((th) => ({ text: text(th), span: th.colSpan })),
        leadSpan: head[0].cells[0].colSpan,
        headers: [...head[1].querySelectorAll('th[scope="col"]')].map(text),
        body: [...t.tBodies[0].rows].map((r) => [...r.cells].map(text)),
      };
    }),
  };
}

/** U3 and U4 on the 1280px desktop context. */
async function unitChecks(context) {
  await check("U3", `the six Last game tables render in order EV, PP, SH (forwards then defense) with Goals, Shots and Corsi headers, 13 column headers, Other then Total rows and the legend, and no Other count is negative (${SPEC_URL})`, async () => {
    const page = await openUnitPage(context, TEAM);
    let read;
    try {
      read = await page.evaluate(readLastGameTables);
    } finally {
      await page.close();
    }
    if (read.error) return { details: { reason: read.error } };
    console.log(`INFO U3 team=${TEAM} ${read.heading}`);
    if (read.noChart || read.tables.length === 0) {
      return { details: { reason: `the last game of ${TEAM} has no shift chart, so no tables rendered; rerun with CHECK_TEAM set to another team`, heading: read.heading } };
    }
    const problems = [];
    if (read.tables.length !== 6) problems.push(`${read.tables.length} tables, expected 6`);
    const titles = read.tables.map((t) => t.headers[3]);
    if (titles.join("|") !== EXPECTED_TITLES.join("|")) problems.push(`table order ${titles.join(", ")}`);
    let withTotals = 0;
    read.tables.forEach((t, i) => {
      const where = EXPECTED_TITLES[i] || `table ${i + 1}`;
      if (t.groups.map((g) => g.text).join(",") !== "Goals,Shots,Corsi" || t.groups.some((g) => g.span !== 3) || t.leadSpan !== 4) {
        problems.push(`${where}: group headers ${JSON.stringify(t.groups)} lead colSpan ${t.leadSpan}`);
      }
      const expected = EXPECTED_HEADERS.map((h) => (h === null ? t.headers[3] : h));
      if (t.headers.join("|") !== expected.join("|")) problems.push(`${where}: headers ${t.headers.join(" ")}`);
      const onlyNone = t.body.length === 1 && t.body[0].length === 1 && t.body[0][0] === "None";
      if (onlyNone) return;
      withTotals++;
      const labels = t.body.slice(-2).map((r) => r[3]);
      if (labels.join(",") !== "Other,Total") problems.push(`${where}: last rows are ${labels.join(", ")}, expected Other, Total`);
      const other = t.body[t.body.length - 2];
      for (const col of [4, 5, 7, 8, 10, 11]) {
        const cell = other && other[col];
        if (!/^(—|\d+)$/.test(cell || "")) problems.push(`${where}: Other ${t.headers[col]} is ${JSON.stringify(cell)}`);
      }
      if (t.body.some((r) => r.length !== 13 && r.length !== 1)) problems.push(`${where}: a body row does not have 13 cells`);
    });
    if (withTotals === 0) problems.push("every table is None, so no Other or Total row was checked");
    if (!read.footAfterTables) problems.push("the footnotes block does not follow the last table");
    for (const phrase of LEGEND_PHRASES) if (!read.footText.includes(phrase)) problems.push(`footnotes miss: ${phrase}`);
    return { ok: problems.length === 0, details: { team: TEAM, lastGame: read.heading, tablesWithOtherAndTotal: withTotals, problems: problems.slice(0, 10) } };
  });

  await check("U4", "clicking a linked name in a PP table opens that player's panel on the PP tab (UNIT-04)", async () => {
    const p = await openUnitPage(context, TEAM);
    try {
      const target = await p.evaluate(() => {
        for (const t of document.querySelectorAll("section table")) {
          if (!t.tHead.rows[1].cells[3].textContent.trim().startsWith("PP")) continue;
          const a = t.tBodies[0].querySelector('a[href*="player="]');
          if (a) {
            a.setAttribute("data-u4-target", "1");
            return { table: t.tHead.rows[1].cells[3].textContent.trim(), name: a.textContent.trim(), href: a.getAttribute("href") };
          }
        }
        return null;
      });
      if (!target) return { details: { reason: `no linked name in a PP table on ${TEAM}; rerun with CHECK_TEAM set to another team` } };
      const id = new URL(target.href, BASE).searchParams.get("player");
      await p.locator('[data-u4-target="1"]').click();
      await p.waitForURL((u) => u.searchParams.get("player") === id && u.searchParams.get("sit") === "pp", { timeout: 120000 });
      await p.waitForFunction(
        (name) => {
          const title = document.querySelector("#player-detail-title");
          const tab = document.querySelector('nav[aria-label="Situation"] a[aria-current="true"]');
          return !!title && title.textContent.trim().startsWith(name) && !!tab;
        },
        target.name,
        { timeout: 120000 }
      );
      const panel = await p.evaluate(() => ({
        title: document.querySelector("#player-detail-title").textContent.replace(/\s+/g, " ").trim(),
        tab: document.querySelector('nav[aria-label="Situation"] a[aria-current="true"]').textContent.trim(),
        url: location.search,
      }));
      return { ok: panel.tab === "PP" && panel.title.startsWith(target.name), details: { clicked: target.name, in: target.table, panel } };
    } finally {
      await p.close();
    }
  });
}

// Check functions are listed here in run order, after loadChecks, so U1 and U2 stay untouched.
const CHECK_GROUPS = [loadChecks, unitChecks];

async function main() {
  const pw = findPlaywright();
  if ((await answers(`${BASE}/`)) !== null) die(`port ${PORT} busy`);
  const tmp = makeScratchApp();
  const server = spawn(process.execPath, [path.join(tmp, "node_modules", "next", "dist", "bin", "next"), "dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: tmp,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    // Minimal environment: the auth-free copy gets no secrets from this shell.
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      LANG: process.env.LANG,
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: `--require ${path.join(tmp, "count-nhl-fetch.cjs")}`,
    },
  });
  // A chunk can end mid-line, so keep the tail of each stream until its newline arrives (a split NHL-FETCH line would be missed).
  for (const s of [server.stdout, server.stderr]) {
    let tail = "";
    s.on("data", (d) => {
      const lines = (tail + String(d)).split("\n");
      tail = lines.pop();
      log.push(...lines.filter(Boolean));
    });
  }
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
    // /research with no team compiles the page without loading any NHL data, so the checks below start cold.
    let up = false;
    for (let n = 0; n < 180 && !up; n++) {
      if ((await answers(`${BASE}/research`)) === 200) up = true;
      else await pause(1000);
    }
    if (!up) {
      console.error(log.slice(-40).join("\n"));
      console.error(`scratch copy kept at ${tmp}`);
      process.exitCode = 2;
      return;
    }
    const browser = await pw.webkit.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      for (const group of CHECK_GROUPS) await group(context);
    } finally {
      await browser.close();
    }
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
    await pause(500);
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {}
    if (completed && counts.fail === 0) fs.rmSync(tmp, { recursive: true, force: true });
    else console.log(`scratch copy kept at ${tmp}`);
    if (process.exitCode !== 2) console.log(`units-check: pass=${counts.pass} fail=${counts.fail} skip=${counts.skip}`);
    if (counts.fail > 0 && !process.exitCode) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
