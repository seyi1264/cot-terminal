import { ArrowDownRight, ArrowUpRight, Flame } from "lucide-react";
import { buildBriefing } from "@/lib/cot/briefing";
import { formatSigned, stanceLabel } from "@/lib/cot/format";
import type { InstrumentReport } from "@/lib/cot/types";
import { cn } from "@/lib/utils";

export function SignalTicker({ reports, onSelect }: { reports: InstrumentReport[]; onSelect: (code: string) => void }) {
  const items = buildBriefing(reports, 6);
  if (!items.length) return null;

  const tickerItems = [...items, ...items];

  return (
    <div className="border-b border-border bg-bg-elevated/70" aria-label="Positioning signals">
      <div className="mx-auto flex max-w-6xl items-center overflow-hidden px-4">
        <span className="z-10 shrink-0 border-r border-border bg-bg-elevated py-2.5 pr-4 text-[10px] font-medium uppercase tracking-[0.16em] text-accent">
          Signals
        </span>
        <div className="relative min-w-0 overflow-hidden">
          <div className="signal-ticker-track flex w-max items-center" aria-live="polite">
            {tickerItems.map((item, index) => {
              const positive = item.report.woDiffChange >= 0;
              const Icon = item.kind === "extreme" ? Flame : positive ? ArrowUpRight : ArrowDownRight;
              return (
                <button
                  key={`${item.report.code}-${index}`}
                  type="button"
                  tabIndex={index >= items.length ? -1 : undefined}
                  aria-hidden={index >= items.length}
                  onClick={() => onSelect(item.report.code)}
                  className="signal-ticker-item flex items-center gap-2 px-5 py-2.5 text-left text-xs text-muted transition-colors hover:text-fg focus-visible:bg-bg-subtle focus-visible:text-fg focus-visible:outline-none"
                >
                  <span className="font-mono font-medium text-fg">{item.report.symbol}</span>
                  <span>{stanceLabel(item.report.stance)}</span>
                  <Icon className={cn("size-3.5", item.kind === "extreme" ? "text-accent" : positive ? "text-bid" : "text-offer")} />
                  <span className={cn("font-mono tabular", item.report.woDiff >= 0 ? "text-bid" : "text-offer")}>
                    {formatSigned(item.report.woDiff)}
                  </span>
                  <span className="text-border" aria-hidden="true">/</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}