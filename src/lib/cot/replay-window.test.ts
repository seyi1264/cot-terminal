import test from "node:test";
import assert from "node:assert/strict";

import { clampReplayRange, resolveReplayRange } from "./replay-window.ts";

const series = [
  { d: "2023-01-01", w: 10 },
  { d: "2023-02-01", w: 20 },
  { d: "2023-03-01", w: 30 },
  { d: "2023-04-01", w: 40 },
  { d: "2023-05-01", w: 50 },
  { d: "2023-06-01", w: 60 },
];

test("resolveReplayRange prefers the chosen start and end dates within the available series", () => {
  const range = resolveReplayRange(series, "2023-02-01", "2023-05-01");
  assert.deepEqual(range, { start: 1, end: 4, startDate: "2023-02-01", endDate: "2023-05-01" });
});

test("clampReplayRange keeps the selection inside valid indices", () => {
  const range = clampReplayRange(series.length, 99, -5);
  assert.deepEqual(range, { start: 0, end: 5 });
});
