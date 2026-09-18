import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSentiment, scoreAlignment, summarizeAlignment } from "./alignment.ts";
import { newsMatchesInstrument } from "./news.server.ts";

test("bullish headlines align with bid-heavy COT stance", () => {
  assert.equal(scoreAlignment("bullish", "strong-bid"), "aligned");
  assert.equal(scoreAlignment("bullish", "bid"), "aligned");
});

test("bearish headlines align with offer-heavy COT stance", () => {
  assert.equal(scoreAlignment("bearish", "strong-offer"), "aligned");
  assert.equal(scoreAlignment("bearish", "offer"), "aligned");
});

test("mixed sentiment is marked as divergence", () => {
  assert.equal(scoreAlignment("bullish", "strong-offer"), "diverged");
  assert.equal(scoreAlignment("bearish", "strong-bid"), "diverged");
});

test("neutral stories do not cause a false read", () => {
  assert.equal(scoreAlignment("neutral", "balanced"), "neutral");
  assert.equal(summarizeAlignment("neutral"), "Neutral");
});

test("sentiment recognizes market-specific bearish and bullish signals", () => {
  assert.equal(normalizeSentiment("gold rallies as bullion extends gains"), "bullish");
  assert.equal(normalizeSentiment("dollar weakness intensifies as yields slide"), "bearish");
  assert.equal(normalizeSentiment("markets digest the latest data"), "neutral");
});

test("headline filtering keeps only stories relevant to the instrument", () => {
  assert.equal(newsMatchesInstrument("Gold prices rally as bullion extends gains", "XAUUSD"), true);
  assert.equal(newsMatchesInstrument("Stocks hit records as traders cheer earnings", "XAUUSD"), false);
  assert.equal(newsMatchesInstrument("Dollar index slips as traders cut bets", "DXY"), true);
});
