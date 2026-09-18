import { ArrowDownRight, ArrowUpRight, Flame, MoveRight } from "lucide-react";
import { formatSigned } from "@/lib/cot/format";
import { buildBriefing } from "@/lib/cot/briefing";
import type { InstrumentReport } from "@/lib/cot/types";
import { cn } from "@/lib/utils";

export function WeeklyBriefing({ reports, onSelect }: { reports: InstrumentReport[]; onSelect: (code: string) => void }) {
  const items = buildBriefing(reports);

  return (
    <section className="border-y border-border py-6" aria-labelledby="weekly-briefing-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-accent">Weekly briefing</p>
          <h2 id="weekly-briefing-title" className="mt-1 font-display text-2xl font-medium tracking-tight text-fg">
            What changed in positioning
          </h2>
        </div>
        <p className="hidden text-right text-xs text-subtle sm:block">Ranked by this week&apos;s signal</p>
      </div>

      <div className="mt-5 grid gap-2 lg:grid-cols-5">
        {items.map((item) => {
          const positive = item.report.woDiffChange >= 0;
          const Icon = item.kind === "extreme" ? Flame : item.kind === "shift" ? (positive ? ArrowUpRight : ArrowDownRight) : MoveRight;
          return (
            <button
              key={item.report.code}
              type="button"
              onClick={() => onSelect(item.report.code)}
              className="group rounded-lg bg-bg-elevated p-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-(--motion-quick) hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-medium text-fg">{item.report.symbol}</span>
                <Icon className={cn("size-4", item.kind === "extreme" ? "text-accent" : positive ? "text-bid" : "text-offer")} />
              </div>
              <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-subtle">{item.label}</p>
              <p className="mt-1 text-sm font-medium text-fg">{item.report.headline}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{item.detail}</p>
              <p className={cn("mt-3 font-mono text-xs tabular", item.report.woDiff >= 0 ? "text-bid" : "text-offer")}>
                WO {formatSigned(item.report.woDiff)}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}