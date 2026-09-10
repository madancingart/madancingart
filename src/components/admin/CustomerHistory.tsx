import {
  Banknote,
  CalendarDays,
  ClipboardCheck,
  ScrollText,
} from "lucide-react";
import Link from "next/link";
import type {
  CustomerHistoryItem,
  CustomerHistoryKind,
} from "@/lib/admin/get-customer";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<CustomerHistoryKind, LucideIcon> = {
  booking: CalendarDays,
  attendance: ClipboardCheck,
  payment: Banknote,
  audit: ScrollText,
};

function hrefLabel(href: string): string {
  if (href.startsWith("/admin/ewidencja")) {
    return "Otwórz ewidencję";
  }
  if (href.startsWith("/admin/grupy")) {
    return "Otwórz grupę";
  }
  if (href.startsWith("/admin/pakiety")) {
    return "Otwórz pakiet";
  }
  if (href.startsWith("/admin/eventy")) {
    return "Otwórz wydarzenia";
  }
  return "Otwórz w kalendarzu";
}

export function CustomerHistory({ items }: { items: CustomerHistoryItem[] }) {
  return (
    <section className="border border-white/10 bg-black-soft p-4">
      <h2 className="text-[15px] font-semibold text-cream">Historia</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">Brak wpisów.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-0">
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <li
                key={item.id}
                className="flex gap-3 border-l border-white/10 py-3 pl-4 first:pt-0"
              >
                <Icon
                  strokeWidth={1.5}
                  className="mt-0.5 size-4 shrink-0 text-gold"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-muted">{item.atLabel}</p>
                  <p className="text-[14px] text-cream">{item.title}</p>
                  {item.detail ? (
                    <p className="text-[13px] text-muted">{item.detail}</p>
                  ) : null}
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="mt-1 inline-block text-[13px] text-gold hover:text-gold-light"
                    >
                      {hrefLabel(item.href)}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
