import type { BillingTone } from "@/lib/billing/status";

const TONE_CLASS: Record<BillingTone, string> = {
  green: "border-emerald-700/80 text-emerald-300",
  amber: "border-amber-600/80 text-amber-200",
  red: "border-red-700/80 text-red-300",
  pending: "border-gold/80 text-gold-light",
};

export function StatusPill({
  tone,
  label,
}: {
  tone: BillingTone;
  label: string;
}) {
  return (
    <p
      className={`inline-block border px-2 py-1 text-sm leading-snug ${TONE_CLASS[tone]}`}
    >
      {label}
    </p>
  );
}
