import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HowToRead({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/70" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-xl bg-bg-elevated p-6 shadow-[var(--shadow-border)] outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-2xl font-medium text-fg">
              How White Oak reads the COT
            </Dialog.Title>
            <Button variant="quiet" size="icon" onClick={onClose} aria-label="Close">
              <X className="size-5" />
            </Button>
          </div>
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
            <p>
              Legacy futures-only Commitments of Traders. Three books: non-commercials (large
              specs), commercials (hedgers / banks), and non-reportable (retail).
            </p>
            <p>
              <strong className="font-medium text-fg">Non-commercials move price.</strong> They
              speculate with the direction they expect. Adding to a winning book is accumulation;
              cutting a winning book is profit taking.
            </p>
            <p>
              <strong className="font-medium text-fg">Commercials hedge the opposite way.</strong>{" "}
              If they expect a rise they sell futures to lock it in. White Oak therefore treats
              commercial shorts as a bid confirmation, commercial longs as an offer confirmation.
            </p>
            <p>
              <strong className="font-medium text-fg">Difference = spec net − commercial net.</strong>{" "}
              Two minuses make a plus: specs long and commercials short is a combined institutional
              bid. The all-history index (0–100) flags extremes; the 13-week average damps noise.
              When a book approaches its historical high or low, profit taking is the base case.
            </p>
            <p>
              <strong className="font-medium text-fg">Retail divergence</strong> is small specs
              standing the other way from that combined view — a confirming tell at extremes, not
              a trigger on its own.
            </p>
            <p>
              <strong className="font-medium text-fg">Weekly briefing</strong> ranks the biggest
              positioning changes first. Largest shifts show where the White Oak difference moved
              most; extreme readings show when positioning is near its all-history boundary; active
              flow shows which books are doing the work.
            </p>
            <p>
              <strong className="font-medium text-fg">News alignment</strong> compares recent
              instrument-specific headlines with the current stance. Aligned means the headline
              tone supports the COT read; Diverged means it points the other way; Neutral means
              there is no reliable directional signal. News is context, not confirmation by itself.
            </p>
            <p>
              The board fetches the latest available CFTC report when it loads or when you press
              Refresh. CFTC publishes Friday data for Tuesday’s close, so the displayed date is
              the position date, not the publication date. If the live feed is unavailable, the
              board marks itself as a snapshot. Always confirm the read against chart zones before
              acting.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
