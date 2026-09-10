import { cn } from "@/lib/cn";
import type { MembershipStatus } from "@/lib/membership-status";

export function MembershipBadge({
  status,
  compact = false,
}: {
  status: MembershipStatus;
  compact?: boolean;
}) {
  const color =
    status.level === "ok"
      ? "bg-emerald-500"
      : status.level === "ending"
        ? "bg-gold"
        : "bg-[#E8A0A0]";

  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <span
        className={cn("size-2 shrink-0 rounded-full", color)}
        aria-hidden
      />
      <span className="text-cream">{status.label}</span>
      {!compact && status.detail ? (
        <span className="text-muted">{status.detail}</span>
      ) : null}
    </span>
  );
}
