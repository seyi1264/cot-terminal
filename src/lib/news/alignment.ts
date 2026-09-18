import type { Stance } from "@/lib/cot/types";

export type NewsSentiment = "bullish" | "bearish" | "neutral";
export type StoryAlignment = "aligned" | "diverged" | "neutral";

const POSITIVE = [
  "bullish",
  "upbeat",
  "strong",
  "higher",
  "higher for",
  "rally",
  "rallies",
  "gain",
  "gains",
  "surge",
  "surges",
  "strength",
  "risk-on",
  "support",
  "lift",
  "lifts",
  "breakout",
  "rebound",
  "advances",
  "advance",
  "firm",
  "dollar strength",
  "dollar strong",
  "yields rise",
  "yields higher",
  "oil gains",
  "inflation cools",
  "extends gains",
  "climbs",
  "rises",
];

const NEGATIVE = [
  "bearish",
  "weak",
  "weaker",
  "lower",
  "selloff",
  "drop",
  "drops",
  "slump",
  "slumps",
  "pressure",
  "risk-off",
  "resistance",
  "worry",
  "collapse",
  "breakdown",
  "soft",
  "decline",
  "declines",
  "recession",
  "dollar weakness",
  "dollar weak",
  "yields fall",
  "yields lower",
  "oil slips",
  "inflation heats",
  "slides",
  "falls",
  "sinks",
  "cuts gains",
  "weakens",
];

export function normalizeSentiment(value: string | null | undefined): NewsSentiment {
  if (!value) return "neutral";
  const text = value.toLowerCase();
  const positiveScore = POSITIVE.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
  const negativeScore = NEGATIVE.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);

  if (positiveScore > negativeScore) return "bullish";
  if (negativeScore > positiveScore) return "bearish";
  return "neutral";
}

export function scoreAlignment(storySentiment: string | null | undefined, stance: Stance): StoryAlignment {
  const sentiment = normalizeSentiment(storySentiment);
  if (sentiment === "neutral" || stance === "balanced") return "neutral";

  const bullishAligned = new Set(["strong-bid", "bid"]);
  const bearishAligned = new Set(["strong-offer", "offer"]);

  if (sentiment === "bullish") {
    return bullishAligned.has(stance) ? "aligned" : "diverged";
  }

  if (sentiment === "bearish") {
    return bearishAligned.has(stance) ? "aligned" : "diverged";
  }

  return "neutral";
}

export function summarizeAlignment(alignment: StoryAlignment | string): string {
  if (alignment === "aligned") return "Aligned";
  if (alignment === "diverged") return "Diverged";
  return "Neutral";
}
