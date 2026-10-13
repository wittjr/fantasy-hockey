#!/usr/bin/env node
/*
 * webkit-strip-check.cjs: re-runnable WebKit check of the Per game strip popover on the real /research page
 * (phase 01, plan 01-08, G-01-2). Run with: node .planning/phases/01-ice-time-trends-table/webkit-strip-check.cjs
 *
 * What it does:
 *  - copies the repo (not .git, .next, node_modules, .planning, .claude or any .env* file) to a temp directory,
 *    clones node_modules into it, and removes the three auth-gate lines from the COPY of app/research/page.tsx only;
 *  - runs `next dev -p 3101 -H 127.0.0.1` in the copy (loopback only, so the auth-free copy is not reachable from the network);
 *  - drives it with Playwright's bundled WebKit (playwright-core from the npx cache; nothing is installed): a desktop
 *    context (click, second click, outside click, one open at a time, popover does not block the square below, hover,
 *    Tab, Escape dismisses without blurring (D13), no clipping at Last 20) and an emulated iPhone 13 (no hover: tap opens, tap elsewhere closes);
 *  - kills the server process group and removes the temp directory when done.
 * Prints PASS|FAIL|SKIP lines and a final "strip-check:" line. Exit 0 = all passed, 1 = a check failed, 2 = could not run.
 * Needs live NHL data for MTL (network access).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "strip-check-"));
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
      die("auth gate changed; update webkit-strip-check.cjs");
    }
    page = page.replace(line, "");
  }
  fs.writeFileSync(pagePath, page);
  return tmp;
}

// Helpers injected into every page: rows of the "Ice-time trends" table, squares, popovers.
const PAGE_HELPERS = `
window.__strip = {
  rows() {
    const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.trim() === "Ice-time trends");
    return h ? [...h.closest("section").querySelectorAll("tbody tr")] : [];
  },
  sq(r, i) { return this.rows()[r].querySelectorAll("[data-state]")[i]; },
  pop(r, i) { return this.sq(r, i).querySelector(':scope > [aria-hidden="true"]'); },
  shown(r, i) { return getComputedStyle(this.pop(r, i)).display !== "none"; },
  open(r, i) { return this.sq(r, i).hasAttribute("data-open"); },
  allShown() {
    const out = [];
    this.rows().forEach((tr, r) => tr.querySelectorAll("[data-state]").forEach((s, i) => {
      const p = s.querySelector(':scope > [aria-hidden="true"]');
      if (p && getComputedStyle(p).display !== "none") out.push([r, i]);
    }));
    return out;
  },
  inside(r, i) {
    const p = this.pop(r, i).getBoundingClientRect();
    const w = this.sq(r, i).closest(".overflow-x-auto").getBoundingClientRect();
    return { inside: p.left >= w.left - 1 && p.right <= w.right + 1 && p.top >= w.top - 1 && p.bottom <= w.bottom + 1,
      pop: [p.left, p.top, p.right, p.bottom].map(Math.round), wrapper: [w.left, w.top, w.right, w.bottom].map(Math.round) };
  },
};
`;

const SECTION_ROWS = 'section:has(h2:text-is("Ice-time trends")) tbody tr';
const sqLoc = (page, r, i) => page.locator(SECTION_ROWS).nth(r).locator("[data-state]").nth(i);
const call = (page, fn, ...args) => page.evaluate(([f, a]) => window.__strip[f](...a), [fn, args]);

async function openResearch(context, games) {
  const page = await context.newPage();
  await page.goto(`${BASE}/research?team=MTL&games=${games}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-state]");
      return !!el && Object.getOwnPropertyNames(el).some((k) => k.startsWith("__reactProps"));
    },
    null,
    { timeout: 30000 },
  );
  return page;
}

async function blankPoint(page) {
  const h = page.locator('h2:text-is("Ice-time trends")');
  await h.scrollIntoViewIfNeeded();
  const b = await h.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
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

const settle = (page) => page.waitForTimeout(150);

async function desktopChecks(pw) {
  const browser = await pw.webkit.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  await context.addInitScript(PAGE_HELPERS);
  try {
    const page = await openResearch(context, 5);
    const info = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      hoverHover: matchMedia("(hover: hover)").matches,
      pointerFine: matchMedia("(pointer: fine)").matches,
    }));
    console.log(`INFO D1 desktop environment ${JSON.stringify(info)}`);
    const nRows = await page.evaluate(() => window.__strip.rows().length);
    const COL = 1;

    await check("D2", "nothing is open before any interaction", async () => {
      await page.mouse.move(1, 1);
      await settle(page);
      const shown = await call(page, "allShown");
      const open = await call(page, "open", 0, COL);
      return { ok: shown.length === 0 && !open, details: { shown } };
    });

    await check("S1", "every row-0 square is at least 20x20 and neighbouring squares are at least 24px apart centre to centre", async () => {
      const boxes = await page.evaluate(() =>
        [...window.__strip.rows()[0].querySelectorAll("[data-state]")].map((s) => {
          const r = s.getBoundingClientRect();
          return { w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
        }),
      );
      const small = boxes.filter((b) => b.w < 20 || b.h < 20).map((b) => [b.w, b.h]);
      const pitch = boxes.slice(1).map((b, i) => Math.hypot(b.cx - boxes[i].cx, b.cy - boxes[i].cy));
      const tight = pitch.filter((d) => d < 24);
      return { ok: boxes.length > 1 && small.length === 0 && tight.length === 0, details: { squares: boxes.length, small, minPitch: Math.min(...pitch) } };
    });

    await check("D3", "click opens the row-0 popover, it stays open with the pointer away and is not clipped", async () => {
      await sqLoc(page, 0, COL).click();
      const b = await blankPoint(page);
      await page.mouse.move(b.x, b.y);
      await settle(page);
      const shown = await call(page, "shown", 0, COL);
      const open = await call(page, "open", 0, COL);
      const inside = await call(page, "inside", 0, COL);
      return { ok: shown && open && inside.inside, details: { shown, open, ...inside } };
    });

    await check("D4", "a second click on the same square closes it", async () => {
      await sqLoc(page, 0, COL).click();
      const b = await blankPoint(page);
      await page.mouse.move(b.x, b.y);
      await settle(page);
      const shown = await call(page, "shown", 0, COL);
      const open = await call(page, "open", 0, COL);
      return { ok: !shown && !open, details: { shown, open } };
    });

    await check("D5", "a click elsewhere closes an open popover", async () => {
      await sqLoc(page, 0, COL).click();
      const opened = await call(page, "shown", 0, COL);
      const b = await blankPoint(page);
      await page.mouse.click(b.x, b.y);
      await settle(page);
      const shown = await call(page, "shown", 0, COL);
      return { ok: opened && !shown, details: { opened, shown } };
    });

    await check("D6", "opening another square closes the first", async () => {
      await sqLoc(page, 0, COL).click();
      await sqLoc(page, 2, COL).click();
      const b = await blankPoint(page);
      await page.mouse.move(b.x, b.y);
      await settle(page);
      const row0 = await call(page, "shown", 0, COL);
      const row2 = await call(page, "shown", 2, COL);
      return { ok: !row0 && row2, details: { row0, row2 } };
    });

    await check("D7", "an open popover does not block the square below it", async () => {
      let b = await blankPoint(page);
      await page.mouse.click(b.x, b.y);
      await sqLoc(page, 0, COL).click();
      b = await blankPoint(page);
      await page.mouse.move(b.x, b.y);
      await sqLoc(page, 1, COL).scrollIntoViewIfNeeded();
      const open0 = await call(page, "shown", 0, COL);
      const hit = await page.evaluate(([c]) => {
        const sq = window.__strip.sq(1, c);
        const r = sq.getBoundingClientRect();
        const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { hitIsSquare: sq === el || sq.contains(el), x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, [COL]);
      await page.mouse.click(hit.x, hit.y);
      await settle(page);
      const row0 = await call(page, "shown", 0, COL);
      const row1 = await call(page, "shown", 1, COL);
      return { ok: open0 && hit.hitIsSquare && row1 && !row0, details: { open0, hitIsSquare: hit.hitIsSquare, row0, row1 } };
    });

    await check("D8", "hover without a click still opens the popover and moving away closes it", async () => {
      let b = await blankPoint(page);
      await page.mouse.click(b.x, b.y);
      await sqLoc(page, 3, COL).hover();
      await settle(page);
      const hovered = await call(page, "shown", 3, COL);
      const open = await call(page, "open", 3, COL);
      b = await blankPoint(page);
      await page.mouse.move(b.x, b.y);
      await settle(page);
      const after = await call(page, "shown", 3, COL);
      return { ok: hovered && !open && !after, details: { hovered, open, after } };
    });

    await check("D9", "sweeping down a column shows exactly each row's own popover", async () => {
      const b = await blankPoint(page);
      await page.mouse.click(b.x, b.y);
      const bad = [];
      for (let r = 0; r < nRows; r++) {
        await sqLoc(page, r, COL).hover();
        await settle(page);
        const shown = await call(page, "allShown");
        if (shown.length !== 1 || shown[0][0] !== r || shown[0][1] !== COL) bad.push({ row: r, shown });
      }
      return { ok: bad.length === 0, details: { rows: nRows, bad } };
    });

    await check("D10", "keyboard focus (Tab) opens the popover and Tab away closes it", async () => {
      const b = await blankPoint(page);
      await page.mouse.click(b.x, b.y);
      await page.mouse.move(1, 1);
      let found = null;
      for (let n = 1; n <= 300 && !found; n++) {
        await page.keyboard.press("Tab");
        found = await page.evaluate(() => {
          const a = document.activeElement;
          if (!a || !a.matches("[data-state]")) return null;
          const rows = window.__strip.rows();
          const r = rows.findIndex((tr) => tr.contains(a));
          return [r, [...rows[r].querySelectorAll("[data-state]")].indexOf(a)];
        });
        if (found) found.push(n);
      }
      if (!found) return { ok: false, details: { error: "no square reached in 300 Tab presses" } };
      await settle(page);
      const shownOnFocus = await call(page, "shown", found[0], found[1]);
      await page.keyboard.press("Tab");
      await settle(page);
      const shownAfter = await call(page, "shown", found[0], found[1]);
      return { ok: shownOnFocus && !shownAfter, details: { square: found, shownOnFocus, shownAfter } };
    });

    await check("D13", "Escape hides a focused or pinned popover, keeps focus on the square, and the dismiss clears on blur", async () => {
      const b = await blankPoint(page);
      await page.mouse.click(b.x, b.y);
      await page.mouse.move(1, 1);
      let found = null;
      for (let n = 1; n <= 300 && !found; n++) {
        await page.keyboard.press("Tab");
        found = await page.evaluate(() => {
          const a = document.activeElement;
          if (!a || !a.matches("[data-state]")) return null;
          const rows = window.__strip.rows();
          const r = rows.findIndex((tr) => tr.contains(a));
          return [r, [...rows[r].querySelectorAll("[data-state]")].indexOf(a)];
        });
      }
      if (!found) return { ok: false, details: { error: "no square reached in 300 Tab presses" } };
      const [r, i] = found;
      const state = () =>
        page.evaluate(
          ([row, idx]) => {
            const sq = window.__strip.sq(row, idx);
            return {
              shown: window.__strip.shown(row, idx),
              focused: document.activeElement === sq,
              dismissed: sq.hasAttribute("data-dismissed"),
              open: sq.hasAttribute("data-open"),
              expanded: sq.hasAttribute("aria-expanded"),
            };
          },
          [r, i],
        );
      await settle(page);
      const shownOnFocus = (await state()).shown;
      await page.keyboard.press("Escape");
      await settle(page);
      const afterEscape = await state();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await settle(page);
      const refocused = await state();
      await sqLoc(page, r, i).click();
      const pinned = await state();
      await page.keyboard.press("Escape");
      await settle(page);
      const afterPinEscape = await state();
      await page.mouse.move(1, 1);
      const okFocus = shownOnFocus && !afterEscape.shown && afterEscape.focused && afterEscape.dismissed && !afterEscape.expanded;
      const okRearm = refocused.shown && !refocused.dismissed;
      const okPin = pinned.open && !afterPinEscape.shown && !afterPinEscape.open && afterPinEscape.focused;
      return { ok: okFocus && okRearm && okPin, details: { square: found, shownOnFocus, afterEscape, refocused, pinned, afterPinEscape } };
    });

    const page20 = await openResearch(context, 20);
    const n20 = await page20.evaluate(() => window.__strip.rows().length);
    const firstDefense = await page20.evaluate(() => window.__strip.rows().findIndex((tr) => tr.className.includes("border-t-2")));
    const lastForward = firstDefense > 0 ? firstDefense - 1 : -1;
    const targets = [
      ["first row", 0],
      ["last forward row", lastForward],
      ["last row", n20 - 1],
    ];
    await check("D11", "popovers are not clipped at Last 20 (first, last-forward and last rows, leftmost and rightmost squares)", async () => {
      if (lastForward < 0) return { ok: false, details: { error: "no forward/defense boundary found", firstDefense } };
      const results = [];
      for (const [name, r] of targets) {
        for (const side of ["left", "right"]) {
          await page20.evaluate(([row, s]) => {
            const w = window.__strip.sq(row, 0).closest(".overflow-x-auto");
            w.scrollLeft = s === "left" ? 0 : w.scrollWidth;
          }, [r, side]);
          const last = (await page20.evaluate((row) => window.__strip.rows()[row].querySelectorAll("[data-state]").length, r)) - 1;
          const i = side === "left" ? 0 : last;
          await sqLoc(page20, r, i).click();
          await page20.mouse.move(1, 1);
          await settle(page20);
          const shown = await call(page20, "shown", r, i);
          const inside = await call(page20, "inside", r, i);
          await sqLoc(page20, r, i).click();
          await page20.mouse.move(1, 1);
          await settle(page20);
          const closed = !(await call(page20, "shown", r, i));
          results.push({ name, side, shown, closed, ...inside });
        }
      }
      const bad = results.filter((x) => !(x.shown && x.inside && x.closed));
      return { ok: bad.length === 0, details: bad.length ? { bad } : { checked: results.length } };
    });

    await check("D12", "an OT/SO square's popover shows the period tag and the excluded OT time", async () => {
      const hit = await page20.evaluate(() => {
        const rows = window.__strip.rows();
        for (let r = 0; r < rows.length; r++) {
          const sqs = rows[r].querySelectorAll("[data-state]");
          for (let i = 0; i < sqs.length; i++) {
            const label = sqs[i].getAttribute("aria-label") || "";
            const tag = label.includes(" · OT · ") ? "OT" : label.includes(" · SO · ") ? "SO" : null;
            if (tag && (label.includes("OT excluded") || label.includes("Total (incl. OT)"))) return { r, i, tag };
          }
        }
        return null;
      });
      if (!hit) return { skip: true, details: { reason: "no OT/SO game with OT time in this window" } };
      await page20.evaluate(([r]) => window.__strip.sq(r, 0).closest(".overflow-x-auto").scrollTo(0, 0), [hit.r]);
      await sqLoc(page20, hit.r, hit.i).click();
      const text = await page20.evaluate(([r, i]) => window.__strip.pop(r, i).textContent, [hit.r, hit.i]);
      const shown = await call(page20, "shown", hit.r, hit.i);
      const ok = shown && text.includes(hit.tag) && (text.includes("OT excluded +") || text.includes("Total (incl. OT)"));
      return { ok, details: { ...hit, text } };
    });
  } finally {
    await browser.close();
  }
}

async function touchChecks(pw) {
  const browser = await pw.webkit.launch();
  const context = await browser.newContext({ ...pw.devices["iPhone 13"] });
  await context.addInitScript(PAGE_HELPERS);
  try {
    const page = await openResearch(context, 5);
    const info = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      hoverHover: matchMedia("(hover: hover)").matches,
      pointerFine: matchMedia("(pointer: fine)").matches,
      maxTouchPoints: navigator.maxTouchPoints,
    }));
    console.log(`INFO T1 emulated iPhone environment ${JSON.stringify(info)}`);
    const COL = 1;

    await check("T2", "tapping a square opens its popover (data-open)", async () => {
      const sq = sqLoc(page, 0, COL);
      await sq.scrollIntoViewIfNeeded();
      await sq.tap();
      await settle(page);
      const shown = await call(page, "shown", 0, COL);
      const open = await call(page, "open", 0, COL);
      return { ok: shown && open, details: { shown, open } };
    });

    await check("T3", "tapping elsewhere closes it", async () => {
      const b = await blankPoint(page);
      await page.touchscreen.tap(b.x, b.y);
      await settle(page);
      const shown = await call(page, "shown", 0, COL);
      return { ok: !shown, details: { shown } };
    });

    await check("T4", "tapping another square closes the first, tapping the same square again closes it", async () => {
      const a = sqLoc(page, 0, COL);
      await a.scrollIntoViewIfNeeded();
      await a.tap();
      const c = sqLoc(page, 2, COL);
      await c.scrollIntoViewIfNeeded();
      await c.tap();
      await settle(page);
      const shownAfterSecond = await call(page, "allShown");
      await c.tap();
      await settle(page);
      const shownAfterThird = await call(page, "allShown");
      return {
        ok: shownAfterSecond.length === 1 && shownAfterSecond[0][0] === 2 && shownAfterThird.length === 0,
        details: { shownAfterSecond, shownAfterThird },
      };
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  const pw = findPlaywright();
  if ((await answers(`${BASE}/`)) !== null) die("port 3101 busy");
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
      if ((await answers(`${BASE}/research?team=MTL&games=5`)) === 200) up = true;
      else await new Promise((r) => setTimeout(r, 1000));
    }
    if (!up) {
      console.error(log.slice(-40).join("\n"));
      console.error(`scratch copy kept at ${tmp}`);
      process.exitCode = 2;
      return;
    }
    await desktopChecks(pw);
    await touchChecks(pw);
    completed = true;
  } finally {
    stop();
    await new Promise((r) => setTimeout(r, 500));
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {}
    if (completed && counts.fail === 0) fs.rmSync(tmp, { recursive: true, force: true });
    else console.log(`scratch copy kept at ${tmp}`);
    console.log(`strip-check: ${counts.pass} passed, ${counts.fail} failed, ${counts.skip} skipped`);
    if (counts.fail > 0 && !process.exitCode) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
