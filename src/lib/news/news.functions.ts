import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { NewsStory } from "./types";

export type { NewsStory } from "./types";

export const getMarketNews = createServerFn({ method: "POST" })
  .validator(
    z.object({
      symbol: z.string().min(1),
      stance: z.enum(["strong-bid", "bid", "balanced", "offer", "strong-offer"]),
    }),
  )
  .handler(async ({ data }): Promise<NewsStory[]> => {
    const { fetchMarketNews } = await import("./news.server.ts");
    return fetchMarketNews(data.symbol, data.stance);
  });