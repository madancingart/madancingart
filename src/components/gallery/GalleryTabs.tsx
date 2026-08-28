import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  GALLERY_FILTERS,
  type GalleryFilterId,
} from "@/content/gallery";

type GalleryTabsProps = {
  active: GalleryFilterId;
};

export function GalleryTabs({ active }: GalleryTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Kategoria galerii"
      className="flex flex-wrap gap-2"
    >
      {GALLERY_FILTERS.map((filter) => {
        const isActive = filter.id === active;
        const href =
          filter.id === "wszystkie"
            ? "/galeria"
            : `/galeria?kategoria=${filter.id}`;

        return (
          <Link
            key={filter.id}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "border px-4 py-2 text-sm transition-colors duration-300",
              isActive
                ? "border-gold bg-gold/10 text-gold"
                : "border-white/10 text-cream hover:border-gold/40 hover:text-gold",
            )}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
