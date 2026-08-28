"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { site, type LocationId } from "@/content/site";

export function AdminLocationTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("lokalizacja");
  const active: LocationId | "all" =
    raw === "mikolow" || raw === "lubliniec" ? raw : "all";

  const items: { id: LocationId | "all"; label: string }[] = [
    { id: "all", label: "Obie" },
    ...site.locations.map((location) => ({
      id: location.id,
      label: location.city,
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Lokalizacja"
      className="flex gap-4 border-b border-white/10 text-[13px]"
    >
      {items.map((item) => {
        const href =
          item.id === "all"
            ? pathname
            : `${pathname}?lokalizacja=${item.id}`;
        const isActive = active === item.id;

        return (
          <Link
            key={item.id}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "border-b-2 pb-2",
              isActive
                ? "border-gold text-gold"
                : "border-transparent text-muted hover:text-cream",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
