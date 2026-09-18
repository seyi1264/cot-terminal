import type { Stance } from "@/lib/cot/types";
import { normalizeSentiment, scoreAlignment, summarizeAlignment } from "./alignment.ts";
import type { NewsStory } from "./types";
const INSTRUMENT_KEYWORDS: Record<string, string[]> = {
  EURUSD: ["eur", "euro", "eurusd", "euro dollar", "dollar euro"],
  GBPUSD: ["gbp", "sterling", "pound", "gbpusd", "dollar pound"],
  USDJPY: ["yen", "jpy", "usdjpy", "dollar yen"],
  AUDUSD: ["aud", "australian dollar", "aussie", "audusd"],
  USDCAD: ["cad", "canadian dollar", "loonie", "usdcad"],
  USDCHF: ["chf", "swiss franc", "franc", "usdchf"],
  NZDUSD: ["nzd", "new zealand dollar", "kiwi", "nzdusd"],
  USDMXN: ["mxn", "mexican peso", "peso", "usdmxn"],
  DXY: ["dollar index", "dxy", "us dollar index"],
  XAUUSD: ["gold", "bullion", "xau", "gold prices", "precious metals"],
  XAGUSD: ["silver", "xag", "silver prices"],
  HG: ["copper", "hg", "copper prices"],
  CL: ["wti", "crude", "oil", "cl", "wti crude"],
  NG: ["natural gas", "ng", "gas prices"],
  ES: ["s&p 500", "sp500", "equity index", "es"],
  NQ: ["nasdaq", "nq", "tech index"],
  ZN: ["10-year treasury", "10y", "treasury yields", "zn"],
  ZB: ["treasury bond", "long bond", "bond yields", "zb"],
  BTC: ["bitcoin", "btc", "crypto", "digital asset"],
};

export function newsMatchesInstrument(title: string, symbol: string): boolean {
  const haystack = title.toLowerCase();
  const keys = INSTRUMENT_KEYWORDS[symbol] ?? [symbol.toLowerCase()];
  return keys.some((keyword) => haystack.includes(keyword.toLowerCase()));
}
const GOOGLE_NEWS_URL = "https://news.google.com/rss/search?q=";

export function stripHtml(value: string): string {
  const decoded = value.replace(/&(#x?[\da-f]+|amp|quot|apos|nbsp|lt|gt);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "quot") return '"';
    if (normalized === "apos") return "'";
    if (normalized === "nbsp") return " ";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    const numeric = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);
    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
  });

  return decoded
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tagContent(xml: string, tag: string): string {
  const pattern = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, "i");
  const match = xml.match(pattern);
  return match ? stripHtml(match[1] ?? "") : "";
}

function buildQuery(symbol: string): string {
  const normalized = symbol.trim();
  if (!normalized) return "market news";

  const map: Record<string, string> = {
    EURUSD: "EURUSD euro dollar",
    GBPUSD: "GBPUSD sterling dollar",
    USDJPY: "USDJPY yen",
    AUDUSD: "AUDUSD australian dollar",
    USDCAD: "USDCAD canadian dollar",
    USDCHF: "USDCHF swiss franc",
    NZDUSD: "NZDUSD kiwi dollar",
    USDMXN: "USDMXN mexican peso",
    DXY: "US Dollar Index",
    XAUUSD: "gold prices",
    XAGUSD: "silver prices",
    HG: "copper prices",
    CL: "WTI crude oil",
    NG: "natural gas prices",
    ES: "S&P 500 index",
    NQ: "Nasdaq index",
    ZN: "10-year treasury yields",
    ZB: "treasury bond yields",
    BTC: "bitcoin prices",
  };

  return map[normalized] ?? normalized;
}

export async function fetchMarketNews(symbol: string, stance: Stance): Promise<NewsStory[]> {
  const query = buildQuery(symbol);
  const url = `${GOOGLE_NEWS_URL}${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "OakLedger/1.0 (market-news)",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      throw new Error(`News feed ${response.status}`);
    }

    const xml = await response.text();
    const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0, 5);

    return items
      .map(([fullItem]) => {
        const title = stripHtml(tagContent(fullItem, "title"));
        const link = stripHtml(tagContent(fullItem, "link"));
        const source = stripHtml(tagContent(fullItem, "source")) || "Google News";
        const publishedAt = stripHtml(tagContent(fullItem, "pubDate")) || new Date().toISOString();
        const snippet = stripHtml(tagContent(fullItem, "description")) || title;
        const text = `${title} ${snippet}`;
        if (!newsMatchesInstrument(text, symbol)) {
          return null;
        }
        const sentiment = normalizeSentiment(text);
        const alignment = scoreAlignment(sentiment, stance);

        return {
          title: title || "Market headline",
          source,
          publishedAt,
          link: link || "https://news.google.com/",
          snippet: snippet || "No summary available.",
          sentiment,
          alignment,
          alignmentLabel: summarizeAlignment(alignment),
        };
      })
      .filter((story): story is NewsStory => story !== null)
      .slice(0, 4);
  } catch (error) {
    console.error("[news] market feed failed", error);
    return [];
  }
}

