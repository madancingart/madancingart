import type { PriceItem } from "@/content/pricing";
import { formatPlnFromCents } from "@/lib/money";

const unitLabel: Record<PriceItem["unit"], string> = {
  "os/mies": "os./mies.",
  "para/mies": "para/mies.",
  os: "os.",
  para: "para",
  h: "h",
  pakiet: "pakiet",
};

type PriceRowProps = {
  item: PriceItem;
};

export function PriceRow({ item }: PriceRowProps) {
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0">
        <p className="text-cream">{item.label}</p>
        {item.detail ? (
          <p className="text-sm text-muted">{item.detail}</p>
        ) : null}
        {item.note ? (
          <p className="text-sm text-muted">{item.note}</p>
        ) : null}
      </div>
      <span
        className="mb-[0.45em] min-w-4 flex-1 border-b border-dotted border-muted/40"
        aria-hidden
      />
      <p
        className="shrink-0 text-right whitespace-nowrap text-gold"
        suppressHydrationWarning
      >
        {formatPlnFromCents(item.amountCents)}
        <span className="ml-1 text-sm text-muted">
          / {unitLabel[item.unit]}
        </span>
      </p>
    </div>
  );
}
