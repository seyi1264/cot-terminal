import assert from "node:assert/strict";
import test from "node:test";
import { countDirectionalReadings, DOLLAR_COMPLEX_CODES, dollarBiasFromCot } from "./intermarket.ts";

test("dollar complex includes each FX future once", () => {
  assert.equal(DOLLAR_COMPLEX_CODES.length, 9);
  assert.equal(new Set(DOLLAR_COMPLEX_CODES).size, 9);
  assert.ok(DOLLAR_COMPLEX_CODES.includes("232741"));
  assert.ok(DOLLAR_COMPLEX_CODES.includes("112741"));
});

test("foreign-currency futures direction is inverted to derive USD bias", () => {
  assert.equal(dollarBiasFromCot({ pair: "DXY", woDiff: 10 }), 1);
  assert.equal(dollarBiasFromCot({ pair: "EURUSD", woDiff: 10 }), -1);
  assert.equal(dollarBiasFromCot({ pair: "USDJPY", woDiff: -10 }), 1);
  assert.equal(dollarBiasFromCot({ pair: "USDJPY", woDiff: 0 }), 0);
});

test("direction summaries exclude flat readings from positive and negative counts", () => {
  assert.deepEqual(countDirectionalReadings([1, 1, 0, -1]), {
    positive: 2,
    negative: 1,
    bias: "positive",
  });
  assert.equal(countDirectionalReadings([0, 0]).bias, "mixed");
});