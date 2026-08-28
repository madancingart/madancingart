import Link from "next/link";
import { cn } from "@/lib/cn";
import { site, type LocationId } from "@/content/site";

type ScheduleLocationTabsProps = {
  active: LocationId;
};

export function ScheduleLocationTabs({ active }: ScheduleLocationTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Lokalizacja grafiku"
      className="flex gap-6 border-b border-white/10"
    >
      {site.locations.map((location) => {
        const isActive = location.id === active;

        return (
          <Link
            key={location.id}
            href={`/grafik?lokalizacja=${location.id}`}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "border-b-2 pb-3 text-base transition-colors duration-300",
              isActive
                ? "border-gold text-gold"
                : "border-transparent text-muted hover:text-cream",
            )}
          >
            {location.city}
          </Link>
        );
      })}
    </div>
  );
}
