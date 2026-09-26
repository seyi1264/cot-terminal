import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSentiment, scoreAlignment, summarizeAlignment } from "./alignment.ts";
import { newsMatchesInstrument, stripHtml } from "./news.server.ts";
import { doesStanceSupportZone, stanceInPairQuote } from "../cot/instruments.ts";

test("bullish headlines align with bid-heavy COT stance", () => {
  assert.equal(scoreAlignment("bullish", "strong-bid"), "aligned");
  assert.equal(scoreAlignment("bullish", "bid"), "aligned");
});

test("bearish headlines align with offer-heavy COT stance", () => {
  assert.equal(scoreAlignment("bearish", "strong-offer"), "aligned");
  assert.equal(scoreAlignment("bearish", "offer"), "aligned");
});

test("USD-base pair headlines use the inverse of the foreign-currency futures stance", () => {
  const pairStance = stanceInPairQuote("USDJPY", "strong-bid");
  assert.equal(pairStance, "strong-offer");
  assert.equal(scoreAlignment("bearish", pairStance), "aligned");
  assert.equal(stanceInPairQuote("EURUSD", "strong-bid"), "strong-bid");
  assert.equal(stanceInPairQuote("USDCHF", "balanced"), "balanced");
});

test("zone support follows quoted-pair direction for USD-base currencies", () => {
  assert.equal(doesStanceSupportZone("USDJPY", "strong-bid", "supply"), true);
  assert.equal(doesStanceSupportZone("USDJPY", "strong-bid", "demand"), false);
  assert.equal(doesStanceSupportZone("EURUSD", "strong-bid", "demand"), true);
  assert.equal(doesStanceSupportZone("EURUSD", "strong-bid", "supply"), false);
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
  assert.equal(newsMatchesInstrument("The dollar declines after mixed data", "CL"), false);
  assert.equal(newsMatchesInstrument("Equity futures rise as the S&P 500 rallies", "ES"), true);
  assert.equal(newsMatchesInstrument("Natural gas prices change this week", "NG"), true);
});

test("news descriptions decode escaped HTML before rendering", () => {
  assert.equal(
    stripHtml("&lt;a href=\"https://example.com\"&gt;Read more&lt;/a&gt; &amp; outlook"),
    "Read more & outlook",
  );
});
