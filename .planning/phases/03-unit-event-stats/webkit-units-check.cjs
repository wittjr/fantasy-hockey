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
 * Plan 03-10 appends U3 to U6 (the unit tables) by adding check functions above CHECK_GROUPS and listing them there.
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

// Plan 03-10 appends its unit-table check functions above this line and lists them here, after loadChecks, so U1 and U2
// stay untouched.
const CHECK_GROUPS = [loadChecks];

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
