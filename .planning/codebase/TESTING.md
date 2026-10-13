---
last_mapped_commit: 71dcf6bf8b83733ab5a0ba6dd1f08cc26a801652
last_mapped_at: 2026-10-11
---
# Testing Patterns

**Analysis Date:** 2026-10-11

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`)
- Configured in `package.json` with script: `"test": "tsx --test lib/**/*.test.ts"`
- Run via `npm test`

**Assertion Library:**
- `node:assert/strict` - strictest assertion mode available in Node.js

**Run Commands:**

```bash
npm test              # Run all tests (finds lib/**/*.test.ts)
```

## Test File Organization

**Location:**
- Co-located with source files: `lib/analysis/gap-analysis.test.ts` next to `lib/analysis/gap-analysis.ts`
- Directory structure mirrors source: `lib/research/lines.test.ts`, `lib/fantrax/projections.test.ts`

**Naming:**
- Pattern: `[module-name].test.ts`
- Examples: `gap-analysis.test.ts`, `schedule.test.ts`, `match-players.test.ts`

**Structure:**

```
lib/
├── analysis/
│   ├── gap-analysis.ts
│   └── gap-analysis.test.ts
├── fantrax/
│   ├── projections.ts
│   └── projections.test.ts
└── research/
    ├── lines.ts
    └── lines.test.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { functionToTest } from "./module";

// Helper functions or test data
const slotConstraints = { F: 2, D: 1, G: 1 };

test("describes what the function should do", () => {
  // Arrange: set up test data
  const input = [...];
  
  // Act: call the function
  const result = functionToTest(input);
  
  // Assert: verify the result
  assert.deepEqual(result, expected);
});

test("describes another behavior", () => {
  // Similar structure
});
```

**Patterns:**
- Each `test()` call is independent; no shared state between tests
- Helper functions defined at module level: `function shifts(team, ids, startSec, endSec) { ... }`
- Test data structures match the real data expected by functions
- Descriptive test names explain the behavior being tested

## Test Structure Examples

**Simple value assertions:**

```typescript
test("parseClock parses MM:SS and rejects junk", () => {
  assert.equal(parseClock("03:30"), 210);
  assert.equal(parseClock("19:59"), 1199);
  assert.equal(parseClock(""), null);
  assert.equal(parseClock(null), null);
});
```

**Complex object assertions:**

```typescript
test("splits time into EV/PP/SH from on-ice counts and groups lines", () => {
  const input = [
    ...shifts("BUF", [1, 2, 3, 11, 12, 20], 0, 60),
    ...shifts("OPP", [101, 102, 103, 104, 105, 120], 0, 60),
  ];
  const lines = analyzeGameLines("BUF", input, positions);
  
  assert.deepEqual(lines.situationSeconds, { ev: 60, pp: 0, sh: 0 });
  assert.deepEqual(lines.units.ev.F, [{ playerIds: [1, 2, 3], seconds: 60, pct: 100 }]);
});
```

**Collection assertions:**

```typescript
test("columnByPlayer reads a column by header name and skips non-player rows", () => {
  const header = [{ shortName: "Opp" }, { shortName: "FPts" }];
  const rows = [{ scorer: { scorerId: "049k7" }, cells: [...] }, ...];
  
  assert.deepEqual([...columnByPlayer(header, rows, "FPts")], [["049k7", 5.19], ["04bdb", 0]]);
  assert.equal(columnByPlayer(header, rows, "Missing").size, 0);
});
```

## Mocking

**Framework:** None used - direct function calls with test data

**Patterns:**
- Create minimal test fixtures matching function expectations
- Pass real data structures (arrays, maps, objects) as arguments
- No external dependencies mocked; tests remain focused on pure logic
- Example: `gap-analysis.test.ts` passes `ConsideredPlayer[]` and `ScheduleGame[]` directly

**What to NOT Mock:**
- External APIs (Yahoo, Fantrax) - these are integration concerns, not unit test scope
- Database calls - not called from testable utility functions
- Network requests - functions receiving data are tested, not fetch/request code

**What IS Tested:**
- Pure calculation functions: `computeRosterGaps()`, `trendSlope()`, `analyzeGameLines()`
- Data transformation: `columnByPlayer()`, `matchSpreadsheetRow()`
- Business logic: date/bucket gap detection, lineup constraints validation

## Fixtures and Factories

**Test Data:**

```typescript
// Helper to reduce repetition in shift data:
function shifts(team: string, ids: number[], startSec: number, endSec: number, period = 1): ShiftInput[] {
  return ids.map((playerId) => ({ playerId, team, period, startSec, endSec }));
}

// Reusable test fixtures:
const slotConstraints = { F: 2, D: 1, G: 1 };
const positions = new Map<number, PositionGroup>([
  [1, "F"], [2, "F"], [3, "F"],
  [11, "D"], [12, "D"],
  [20, "G"],
]);
```

**Location:**
- Defined at top of test file, after imports
- Shared across multiple tests in that file
- Simple object/array literals; no complex factory patterns

## Coverage

**Requirements:** No target enforced; tests focus on critical business logic

**Key Tested Areas:**
- Analysis functions: `lib/analysis/*.test.ts` (gap detection, team fit scoring, keeper logic)
- Data parsing: `lib/fantrax/projections.test.ts` (column extraction), `lib/import/match-players.test.ts`
- Schedules and planning: `lib/planner/*.test.ts` (lineup optimization, week boundaries)
- Line analysis: `lib/research/lines.test.ts` (situational ice time calculation)

## Test Types

**Unit Tests:**
- Scope: Pure functions accepting structured data
- Approach: Assert output matches expected behavior for given inputs
- Example: `analyzeGameLines()` receives shifts and positions, verifies line combinations

**Integration Tests:**
- Not present in test suite
- Real integrations (Yahoo, Fantrax) tested in development; not in CI

**E2E Tests:**
- Not applicable; this is a library-based codebase
- Server Components and API routes not covered by automated tests

## Common Patterns

**Async Testing:**
Not present in test suite (all tested functions are synchronous). Server-side async functions (API calls, database queries) are not covered by tests.

**Error Testing:**
No explicit error path testing. Functions that throw (validation failures) are not tested. Critical errors rely on integration testing and manual verification.

**Arrange-Act-Assert Pattern:**
Consistently used:
1. **Arrange:** Set up test data (players, games, shifts)
2. **Act:** Call the function
3. **Assert:** Verify results with `assert.deepEqual()`, `assert.equal()`, `assert.ok()`

**Test Independence:**
- Each test is self-contained
- No beforeEach/afterEach hooks (not used)
- Helper functions create fresh data for each test
- No shared mutable state between tests

---

*Testing analysis: 2026-10-11*
