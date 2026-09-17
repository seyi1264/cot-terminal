import { stanceLabel, stanceTone } from "@/lib/cot/format";
import type { Stance } from "@/lib/cot/types";
import { cn } from "@/lib/utils";

export function StanceChip({ stance, className }: { stance: Stance; className?: string }) {
  const tone = stanceTone(stance);
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-2.5 font-mono text-[11px] font-medium uppercase tracking-wide",
        tone === "bid" && "bg-bid/15 text-bid",
        tone === "offer" && "bg-offer/15 text-offer",
        tone === "flat" && "bg-bg-subtle text-muted",
        className,
      )}
    >
      {stanceLabel(stance)}
    </span>
  );
}
