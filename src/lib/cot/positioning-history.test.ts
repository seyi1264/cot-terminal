import assert from "node:assert/strict";
import test from "node:test";
import { summarizeExtremeReversion, summarizeExtremeReversionAtHorizons } from "./positioning-history.ts";

function report(values: number[]) {
  return { series: values.map((w) => ({ w })) } as Parameters<typeof summarizeExtremeReversion>[0][number];
}

test("upper-tail COT extremes count retracement rather than further expansion", () => {
  const summary = summarizeExtremeReversion([report([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 12, 10, 8])]);
  assert.equal(summary.samples, 1);
  assert.equal(summary.reversions, 1);
  assert.equal(summary.reversionRate, 100);
});

test("lower-tail COT extremes count retracement rather than further decline", () => {
  const summary = summarizeExtremeReversion([report([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, 1, 2, 4])]);
  assert.equal(summary.samples, 1);
  assert.equal(summary.reversions, 1);
});

test("continuation after an extreme is not counted as a reversion", () => {
  const summary = summarizeExtremeReversion([report([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])]);
  assert.equal(summary.samples, 1);
  assert.equal(summary.reversions, 0);
  assert.equal(summary.reversionRate, 0);
});

test("multi-horizon rates are COT reversion counts, not same-direction follow-through", () => {
  const summary = summarizeExtremeReversionAtHorizons(
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 12, 10, 8].map((w) => ({ w })),
    90,
    [1, 4],
  );
  assert.equal(summary.samples, 1);
  assert.equal(summary.reversions[1], 0);
  assert.equal(summary.reversions[4], 1);
  assert.equal(summary.reversionRates[4], 100);
});

test("the first 12 observations are not treated as historical extremes", () => {
  const summary = summarizeExtremeReversion([report([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])]);
  assert.equal(summary.samples, 0);
});