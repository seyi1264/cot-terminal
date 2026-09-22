import assert from "node:assert/strict";
import test from "node:test";
import {
  interpretOpenInterestContext,
  summarizeRetailDivergence,
} from "./white-oak.ts";

test("rising oi with rising price is treated as genuine trend participation", () => {
  const read = interpretOpenInterestContext({
    oiChange: 18_000,
    priceChange: 2.4,
    commercialNet: -20_000,
    woDiff: 24_000,
  });

  assert.match(read.label, /genuine trend|new money entering/i);
  assert.equal(read.tone, "strong-bid");
});

test("falling oi with rising price is treated as weak short covering not fresh breakout", () => {
  const read = interpretOpenInterestContext({
    oiChange: -7_000,
    priceChange: 1.8,
    commercialNet: -18_000,
    woDiff: 12_000,
  });

  assert.match(read.label, /short covering|weaker move|caution/i);
  assert.equal(read.tone, "cautious");
});

test("retail crowding at extremes is translated into a contrarian direction signal", () => {
  const read = summarizeRetailDivergence({
    retailNet: 18_000,
    woDiff: 24_000,
    retailExtreme: 85,
    stance: "bid",
  });

  assert.match(read.label, /crowded long|distribution|contrarian/i);
  assert.equal(read.tone, "warning");
});
