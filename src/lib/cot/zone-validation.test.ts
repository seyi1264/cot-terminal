import assert from "node:assert/strict";
import test from "node:test";
import { validateZonePrices } from "./zone-validation.ts";

test("demand invalidation must be below the demand zone", () => {
  assert.equal(validateZonePrices({ direction: "demand", lowerPrice: 10, upperPrice: 12, invalidationPrice: 9 }), null);
  assert.equal(validateZonePrices({ direction: "demand", lowerPrice: 10, upperPrice: 12, invalidationPrice: 10 })?.field, "invalidationPrice");
});

test("supply invalidation must be above the supply zone", () => {
  assert.equal(validateZonePrices({ direction: "supply", lowerPrice: 10, upperPrice: 12, invalidationPrice: 13 }), null);
  assert.equal(validateZonePrices({ direction: "supply", lowerPrice: 10, upperPrice: 12, invalidationPrice: 12 })?.field, "invalidationPrice");
});

test("zone prices reject reversed boundaries", () => {
  assert.equal(validateZonePrices({ direction: "demand", lowerPrice: 12, upperPrice: 10, invalidationPrice: 9 })?.field, "upperPrice");
});