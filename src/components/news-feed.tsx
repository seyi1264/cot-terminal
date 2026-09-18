import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getMarketNews, type NewsStory } from "@/lib/news/news.server";

export function NewsFeed({ symbol, stance }: { symbol: string; stance: string }) {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const next = await getMarketNews({
          data: {
            symbol,
            stance: stance as "strong-bid" | "bid" | "balanced" | "offer" | "strong-offer",
          },
        });
        if (!cancelled) setStories(next.slice(0, 4));
      } catch {
        if (!cancelled) setStories([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [stance, symbol]);

  if (loading) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-subtle">Market news</p>
        <div className="animate-pulse space-y-2">
          <div className="h-12 rounded-lg bg-bg-subtle" />
          <div className="h-12 rounded-lg bg-bg-subtle" />
        </div>
      </div>
    );
  }

  if (!stories.length) {
    return (
      <div className="rounded-lg border border-border bg-bg p-3 text-sm text-muted">
        No recent market headlines loaded for {symbol}.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-subtle">Market news</p>
        <span className="text-[10px] uppercase tracking-wide text-muted">RSS feed</span>
      </div>
      <div className="space-y-2">
        {stories.map((story) => (
          <article key={`${story.link}-${story.title}`} className="rounded-lg border border-border bg-bg p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <a
                  href={story.link}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm font-medium text-fg hover:text-accent"
                >
                  {story.title}
                </a>
              </div>
              <span className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                story.alignment === "aligned"
                  ? "bg-bid/15 text-bid"
                  : story.alignment === "diverged"
                    ? "bg-offer/15 text-offer"
                    : "bg-bg-subtle text-muted",
              )}>
                {story.alignmentLabel}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{story.snippet}</p>
            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-wide text-subtle">
              <span>{story.source}</span>
              <span>{new Date(story.publishedAt).toLocaleDateString()}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
