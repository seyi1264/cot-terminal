import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { RefreshCw, Star } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BrandMark } from "@/components/brand-mark";
import { DetailPanel } from "@/components/detail-panel";
import { HowToRead } from "@/components/how-to-read";
import { InstrumentCard } from "@/components/instrument-card";
import { PressureStrip } from "@/components/pressure-strip";
import { ResearchDesk } from "@/components/research-desk";
import { SignalTicker } from "@/components/signal-ticker";
import { WeeklyBriefing } from "@/components/weekly-briefing";
import { AnalysisLab } from "@/components/analysis-lab";
import { WatchlistPanel } from "@/components/watchlist-panel";
import { Button } from "@/components/ui/button";
import { SignInGate, UserButton } from "@/lib/auth/gates";
import { getCotBoard } from "@/lib/cot/board.functions";
import {
  getWatchAlerts,
  readWatchlistSession,
  type WatchlistSettings,
  writeWatchlistSession,
} from "@/lib/cot/watchlist";
import { CATEGORY_LABEL } from "@/lib/cot/instruments";
import { stanceInPairQuote } from "@/lib/cot/instruments";
import { formatDate } from "@/lib/cot/format";
import type { CotCategory, InstrumentReport } from "@/lib/cot/types";
import { cn } from "@/lib/utils";

type CatFilter = CotCategory | "all";
type SortKey = "stance" | "extreme" | "change" | "name";

const CATS: CatFilter[] = ["all", "fx", "metals", "energy", "equity", "rates", "crypto"];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    cat: typeof search.cat === "string" ? search.cat : undefined,
  }),
  loader: () => getCotBoard({ data: {} }),
  pendingComponent: BoardSkeleton,
  component: Home,
});

function Home() {
  const board = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const router = useRouter();
  const [pending, start] = useTransition();
  const [guideOpen, setGuideOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const initialSession = useMemo(() => readWatchlistSession(), []);
  const [watchlistCodes, setWatchlistCodes] = useState<string[]>(initialSession.codes);
  const [watchlistSettings, setWatchlistSettings] = useState<WatchlistSettings>(initialSession.settings);
  const [sort, setSort] = useState<SortKey>("stance");
  const cat = (CATS.includes(search.cat as CatFilter) ? search.cat : "all") as CatFilter;

  const filtered = useMemo(() => {
    const list =
      cat === "all"
        ? board.instruments
        : board.instruments.filter((row) => row.category === cat);
    return [...list].sort(sortReports(sort));
  }, [board.instruments, cat, sort]);

  const active = board.instruments.find((row) => row.code === search.code) ?? null;
  const watchedReports = board.instruments.filter((row) => watchlistCodes.includes(row.code));
  const balancedCount = board.instruments.filter((row) => row.stance === "balanced").length;

  useEffect(() => {
    writeWatchlistSession(watchlistCodes, watchlistSettings);
  }, [watchlistCodes, watchlistSettings]);

  function setCode(code?: string) {
    void navigate({
      search: (prev) => ({ ...prev, code }),
      replace: true,
    });
  }

  function setCat(next: CatFilter) {
    void navigate({
      search: (prev) => ({ ...prev, cat: next === "all" ? undefined : next }),
      replace: true,
    });
  }

  function refresh() {
    start(async () => {
      await getCotBoard({ data: { force: true } });
      await router.invalidate({ sync: true });
    });
  }

  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-7 text-accent" />
            <div>
              <p className="font-display text-lg font-medium leading-none tracking-tight text-fg">
                Oak & Ledger
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-subtle">
                Institutional positioning
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className={cn("hidden rounded-full border px-3 py-1 font-mono text-[11px] sm:block", board.source === "legacy" ? "border-accent/35 bg-accent/10 text-accent" : "border-offer/40 bg-offer/10 text-offer")}>
              Data as of {board.asOf ? formatDate(board.asOf) : "—"} · {board.source === "legacy" ? "legacy report, published Friday" : "legacy feed unavailable · no cached data"}
            </p>
            <Button variant="quiet" size="md" onClick={() => setGuideOpen(true)}>
              How to read
            </Button>
            <Button variant="quiet" size="md" onClick={() => setWatchlistOpen(true)}>
              <Star className="size-3.5" />
              Watchlist{watchlistCodes.length ? ` · ${watchlistCodes.length}` : ""}
            </Button>
            <Button variant="ghost" size="md" onClick={refresh} disabled={pending}>
              <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
              Refresh
            </Button>
            <SignInGate fallback={<Link to="/login" className="rounded-md border border-border px-3 py-2 text-xs font-medium text-fg hover:border-accent hover:text-accent">Sign in</Link>}>
              <UserButton />
            </SignInGate>
          </div>
        </div>
      </header>
      <SignalTicker reports={board.instruments} onSelect={setCode} />

      <main className="mx-auto max-w-6xl px-4">
        <section className="py-10 sm:py-14">
          <h1 className="max-w-xl font-display text-4xl font-medium tracking-tight text-fg sm:text-5xl">
            Follow the storyline before the signal.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            Start with where institutional positioning has been, what changed, and how the instrument
            responded. Then wait for price to confirm the thesis before acting.
          </p>
          <div className="mt-5 max-w-2xl rounded-lg border border-accent/45 bg-[#272118] p-4 shadow-[0_0_0_1px_rgb(200_192_176_/_0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">White Oak principle</p>
            <p className="mt-2 text-sm leading-relaxed text-fg">
              Follow the institutions. Follow the data. Follow the storyline. Then wait for the signal.
            </p>
            {balancedCount > 0 ? (
              <p className="mt-2 text-xs text-muted">{balancedCount} tracked {balancedCount === 1 ? "instrument is" : "instruments are"} currently neutral. Sometimes the smartest move is to wait.</p>
            ) : null}
          </div>
          <p className="mt-2 inline-flex rounded-full border border-accent/35 bg-accent/10 px-3 py-1 font-mono text-[11px] text-accent sm:hidden">
            Data as of {board.asOf ? formatDate(board.asOf) : "—"} · {board.source === "legacy" ? "legacy report, published Friday" : "legacy feed unavailable · no cached data"}
          </p>
          <div className="mt-8">
            <PressureStrip instruments={board.instruments} onSelect={setCode} />
          </div>
          <div className="mt-10">
            <WeeklyBriefing reports={board.instruments} onSelect={setCode} />
          </div>
          <AnalysisLab reports={board.instruments} />
          <div className="mt-8">
            <ResearchDesk reports={board.instruments} onSelect={setCode} />
          </div>
          {watchedReports.length ? (
            <section className="mt-8 border-b border-border pb-6" aria-labelledby="watchlist-summary-title">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-accent">Your watchlist</p>
                  <h2 id="watchlist-summary-title" className="mt-1 font-display text-2xl font-medium tracking-tight text-fg">
                    Markets worth a second look
                  </h2>
                </div>
                <button type="button" onClick={() => setWatchlistOpen(true)} className="text-xs text-muted hover:text-fg">
                  Manage
                </button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {watchedReports.map((report) => {
                  const alert = getWatchAlerts([report], [report.code], watchlistSettings)[0];
                  const activeAlert = Boolean(alert && alert.reasons.length);
                  return (
                    <button key={report.code} type="button" onClick={() => setCode(report.code)} className="flex items-center justify-between rounded-lg bg-bg-elevated p-3 text-left shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]">
                      <span>
                        <span className="block font-mono text-sm font-medium text-fg">{report.symbol}</span>
                        <span className="mt-1 block text-xs text-muted">{activeAlert ? alert.reasons[0] : "No new alert"}</span>
                      </span>
                      <span className={cn("size-2 rounded-full", activeAlert ? "bg-accent" : "bg-muted")} />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </section>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {CATS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCat(item)}
                className={cn(
                  "h-9 rounded-full px-3 text-sm transition-colors duration-(--motion-quick)",
                  cat === item
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:bg-bg-subtle hover:text-fg",
                )}
              >
                {CATEGORY_LABEL[item]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-md bg-bg-elevated px-2 text-fg shadow-[var(--shadow-border)]"
            >
              <option value="stance">Stance</option>
              <option value="extreme">Most extreme</option>
              <option value="change">Weekly change</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row, i) => (
            <div
              key={row.code}
              className="stagger-card"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <InstrumentCard
                report={row}
                active={row.code === search.code}
                onOpen={() => setCode(row.code)}
              />
            </div>
          ))}
        </section>

        <p className="mt-12 max-w-3xl text-xs leading-relaxed text-subtle">
          Source: CFTC Commitments of Traders — Legacy, Futures Only. {board.lagNote} This is
          macro context, not a trigger: confirm against chart zones and institutional trendlines
          before acting.
        </p>
      </main>

      <DetailPanel report={active} open={Boolean(active)} onClose={() => setCode(undefined)} />
      <HowToRead open={guideOpen} onClose={() => setGuideOpen(false)} />
      <WatchlistPanel
        reports={board.instruments}
        open={watchlistOpen}
        onClose={() => setWatchlistOpen(false)}
        codes={watchlistCodes}
        onCodesChange={setWatchlistCodes}
        settings={watchlistSettings}
        onSettingsChange={setWatchlistSettings}
      />
    </div>
  );
}

function sortReports(sort: SortKey) {
  const rank: Record<InstrumentReport["stance"], number> = {
    "strong-bid": 0,
    bid: 1,
    balanced: 2,
    offer: 3,
    "strong-offer": 4,
  };
  return (a: InstrumentReport, b: InstrumentReport) => {
    if (sort === "name") return a.symbol.localeCompare(b.symbol);
    if (sort === "extreme") {
      const ae = Math.max(a.woIndex, 100 - a.woIndex);
      const be = Math.max(b.woIndex, 100 - b.woIndex);
      return be - ae;
    }
    if (sort === "change") return Math.abs(b.woDiffChange) - Math.abs(a.woDiffChange);
    const rs = rank[stanceInPairQuote(a.pair, a.stance)] - rank[stanceInPairQuote(b.pair, b.stance)];
    if (rs !== 0) return rs;
    return Math.abs(b.score) - Math.abs(a.score);
  };
}

function BoardSkeleton() {
  return (
    <div className="min-h-dvh bg-bg px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="h-10 w-64 rounded-md bg-bg-subtle" />
        <div className="mt-4 h-16 w-full max-w-xl rounded-md bg-bg-subtle" />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-bg-elevated shadow-[var(--shadow-border)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
