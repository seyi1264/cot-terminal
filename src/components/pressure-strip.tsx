import { formatSigned, stanceTone } from "@/lib/cot/format";
import { stanceInPairQuote } from "@/lib/cot/instruments";
import type { InstrumentReport } from "@/lib/cot/types";
import { cn } from "@/lib/utils";

export function PressureStrip({
  instruments,
  onSelect,
}: {
  instruments: InstrumentReport[];
  onSelect: (code: string) => void;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Quoted COT stance by instrument"
    >
      {instruments.map((row) => {
        const tone = stanceTone(stanceInPairQuote(row.pair, row.stance));
        return (
          <button
            key={row.code}
            type="button"
            onClick={() => onSelect(row.code)}
            className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-bg-elevated px-3.5 shadow-[var(--shadow-border)] transition-[box-shadow] duration-(--motion-quick) hover:shadow-[var(--shadow-border-hover)]"
          >
            <span className="font-mono text-xs font-medium text-fg">{row.symbol}</span>
            <span
              className={cn(
                "size-1.5 rounded-full",
                tone === "bid" && "bg-bid",
                tone === "offer" && "bg-offer",
                tone === "flat" && "bg-muted",
              )}
            />
            <span
              className={cn(
                "font-mono text-xs tabular",
                row.woDiff >= 0 ? "text-bid" : "text-offer",
              )}
            >
              {formatSigned(row.woDiff, 0)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
