import { test } from "node:test";
import assert from "node:assert/strict";
import { columnByPlayer } from "./projections";

test("columnByPlayer reads a column by header name and skips non-player rows", () => {
  const header = [{ shortName: "Opp" }, { shortName: "FPts" }, { shortName: "FP/G" }];
  const rows = [
    { scorer: { scorerId: "049k7", name: "Martin Necas" }, cells: [{ content: "LAK<br/>Wed" }, { content: "5.19" }, { content: "5.19" }] },
    { scorer: { scorerId: "04bdb", name: "Jack Hughes" }, cells: [{ content: "" }, { content: "0" }, { content: "0" }] },
    { cells: [{ content: "Totals" }, { content: "5.19" }, { content: "" }] },
  ];
  assert.deepEqual([...columnByPlayer(header, rows, "FPts")], [["049k7", 5.19], ["04bdb", 0]]);
  assert.equal(columnByPlayer(header, rows, "Missing").size, 0);
});
