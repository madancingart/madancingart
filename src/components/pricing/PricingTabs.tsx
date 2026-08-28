import Link from "next/link";
import { cn } from "@/lib/cn";
import type { LocationId } from "@/content/site";
import { site } from "@/content/site";

type PricingTabsProps = {
  active: LocationId;
};

export function PricingTabs({ active }: PricingTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Lokalizacja cennika"
      className="flex gap-2"
    >
      {site.locations.map((location) => {
        const isActive = location.id === active;

        return (
          <Link
            key={location.id}
            href={`/cennik?lokalizacja=${location.id}`}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "border px-4 py-2 text-sm transition-colors duration-300",
              isActive
                ? "border-gold bg-gold/10 text-gold"
                : "border-white/10 text-cream hover:border-gold/40 hover:text-gold",
            )}
          >
            {location.city}
          </Link>
        );
      })}
    </div>
  );
}
