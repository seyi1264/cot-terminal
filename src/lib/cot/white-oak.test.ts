import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeInstrument,
  interpretOpenInterestContext,
  summarizeRetailDivergence,
} from "./white-oak.ts";
import { INSTRUMENTS } from "./instruments.ts";

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

test("retail short crowding plus rising price flags upside absorption", () => {
  const read = summarizeRetailDivergence({
    retailNet: -18_000,
    woDiff: 24_000,
    retailExtreme: 85,
    stance: "offer",
    priceChange: 1.6,
  });

  assert.match(read.label, /retail short|price resilience|absorbing|upside/i);
  assert.equal(read.tone, "warning");
});

test("extreme institutional short covering is flagged as a relief rally until demand holds", () => {
  const def = INSTRUMENTS.find((item) => item.code === "099741")!;
  const rows = Array.from({ length: 9 }, (_, index) => {
    const date = new Date(2025, 0, 1 + index).toISOString().slice(0, 10);
    return {
      cftc_contract_market_code: def.code,
      report_date_as_yyyy_mm_dd: date,
      open_interest_all: 500_000,
      noncomm_positions_long_all: index === 8 ? 120_000 : 100_000,
      noncomm_positions_short_all: index === 8 ? 300_000 : 200_000 + index * 14_000,
      noncomm_postions_spread_all: 0,
      comm_positions_long_all: 220_000,
      comm_positions_short_all: 180_000,
      nonrept_positions_long_all: 80_000,
      nonrept_positions_short_all: 60_000,
      change_in_open_interest_all: index === 8 ? -8_000 : 2_000,
      change_in_noncomm_long_all: index === 8 ? 20_000 : 500,
      change_in_noncomm_short_all: index === 8 ? -20_000 : -1_000,
      change_in_comm_long_all: index === 8 ? 1_000 : 400,
      change_in_comm_short_all: index === 8 ? -2_000 : -300,
      change_in_nonrept_long_all: 400,
      change_in_nonrept_short_all: 300,
    };
  });

  const report = analyzeInstrument(def, rows);
  assert.ok(report, "report should exist");
  assert.ok(
    report!.flags.some((flag) => /covering shorts.*extreme|relief-driven|fresh demand/i.test(flag)),
    `expected relief-rally warning, got: ${report!.flags.join(" | ")}`,
  );
});

test("stretched long positioning flags the institutional profit-taking handoff to retail", () => {
  const def = INSTRUMENTS.find((item) => item.code === "097741")!;
  const rows = Array.from({ length: 9 }, (_, index) => {
    const date = new Date(2025, 0, 1 + index).toISOString().slice(0, 10);
    return {
      cftc_contract_market_code: def.code,
      report_date_as_yyyy_mm_dd: date,
      open_interest_all: 520_000,
      noncomm_positions_long_all: 320_000 + index * 4_000,
      noncomm_positions_short_all: 120_000 + index * 2_000,
      noncomm_postions_spread_all: 0,
      comm_positions_long_all: 210_000,
      comm_positions_short_all: 180_000,
      nonrept_positions_long_all: 150_000 + index * 2_500,
      nonrept_positions_short_all: 50_000,
      change_in_open_interest_all: index === 8 ? -8_000 : 4_000,
      change_in_noncomm_long_all: index === 8 ? -20_000 : 6_000,
      change_in_noncomm_short_all: index === 8 ? 10_000 : -1_000,
      change_in_comm_long_all: index === 8 ? 3_000 : -1_000,
      change_in_comm_short_all: index === 8 ? -8_000 : 800,
      change_in_nonrept_long_all: index === 8 ? 3_500 : 1_400,
      change_in_nonrept_short_all: index === 8 ? -1_200 : 300,
    };
  });

  const report = analyzeInstrument(def, rows);
  assert.ok(report, "report should exist");
  assert.ok(
    report!.flags.some((flag) => /institutional.*(long.*(exit|profit)|handoff)|retail.*long|crowded.*long/i.test(flag)),
    `expected a stretched-long / retail handoff warning, got: ${report!.flags.join(" | ")}`,
  );
});
