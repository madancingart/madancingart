import Link from "next/link";
import { cn } from "@/lib/cn";
import { adminCalendarHref, type AdminKindFilter } from "@/lib/admin/calendar-url";
import { trainerFilterLabel } from "@/lib/trainers";
import type { LocationId } from "@/content/site";
import type { TrainerRow } from "@/lib/types";

type CalendarFiltersProps = {
  locationId: LocationId;
  weekOffset: number;
  trainer: string | null;
  kind: AdminKindFilter;
  trainers: Pick<TrainerRow, "id" | "name">[];
};

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 text-[13px]",
        active
          ? "border-gold bg-gold text-black"
          : "border-white/20 bg-transparent text-cream hover:border-gold/60",
      )}
    >
      {children}
    </Link>
  );
}

export function CalendarFilters({
  locationId,
  weekOffset,
  trainer,
  kind,
  trainers,
}: CalendarFiltersProps) {
  const base = { locationId, weekOffset, trainer, kind };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-2 text-[11px] tracking-wide text-muted uppercase">
          Prowadzący
        </p>
        <div
          role="group"
          aria-label="Prowadzący"
          className="flex flex-wrap gap-2"
        >
          <Pill
            href={adminCalendarHref({ ...base, trainer: null })}
            active={trainer === null}
          >
            Wszyscy
          </Pill>
          {trainers.map((item) => (
            <Pill
              key={item.id}
              href={adminCalendarHref({ ...base, trainer: item.id })}
              active={trainer === item.id}
            >
              {trainerFilterLabel(item.id, item.name)}
            </Pill>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] tracking-wide text-muted uppercase">
          Typ zajęć
        </p>
        <div role="group" aria-label="Typ zajęć" className="flex flex-wrap gap-2">
          <Pill
            href={adminCalendarHref({ ...base, kind: "all" })}
            active={kind === "all"}
          >
            Wszystko
          </Pill>
          <Pill
            href={adminCalendarHref({ ...base, kind: "slot" })}
            active={kind === "slot"}
          >
            Indywidualne
          </Pill>
          <Pill
            href={adminCalendarHref({ ...base, kind: "class" })}
            active={kind === "class"}
          >
            Grupowe
          </Pill>
        </div>
      </div>
    </div>
  );
}
