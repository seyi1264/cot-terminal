export type NewsSentiment = "bullish" | "bearish" | "neutral";
export type StoryAlignment = "aligned" | "diverged" | "neutral";

export type NewsStory = {
  title: string;
  source: string;
  publishedAt: string;
  link: string;
  snippet: string;
  sentiment: NewsSentiment;
  alignment: StoryAlignment;
  alignmentLabel: string;
};