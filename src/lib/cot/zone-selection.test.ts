import assert from "node:assert/strict";
import test from "node:test";
import { chooseActiveZone, type PriceZoneCandidate } from "./zone-selection.ts";

const zones: PriceZoneCandidate[] = [
  { instrumentCode: "097741", direction: "demand", lowerPrice: 140, upperPrice: 145, quality: "fresh", active: true },
  { instrumentCode: "097741", direction: "supply", lowerPrice: 150, upperPrice: 155, quality: "fresh", active: true },
  { instrumentCode: "097741", direction: "demand", lowerPrice: 150, upperPrice: 155, quality: "fresh", active: true },
  { instrumentCode: "097741", direction: "supply", lowerPrice: 150, upperPrice: 155, quality: "removed", active: true },
];

test("an older active zone containing price is selected over a newer out-of-range zone", () => {
  const selected = chooseActiveZone(zones, "097741", 142, () => false);
  assert.equal(selected?.lowerPrice, 140);
});

test("overlapping zones prefer the direction supported by COT", () => {
  const selected = chooseActiveZone(zones, "097741", 152, (direction) => direction === "supply");
  assert.equal(selected?.direction, "supply");
});

test("inactive, removed, and other-instrument zones are excluded", () => {
  const selected = chooseActiveZone(zones, "ES", 152, () => true);
  assert.equal(selected, null);
});