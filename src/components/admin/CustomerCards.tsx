import { StatusPill } from "@/components/account/panel/StatusPill";
import { CustomerNameLink } from "@/components/admin/CustomerNameLink";
import { telHref } from "@/lib/contact";
import type { CustomerListCard } from "@/lib/admin/get-customers";

function futureLabel(count: number): string {
  if (count === 1) {
    return "1 przyszły termin";
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} przyszłe terminy`;
  }
  return `${count} przyszłych terminów`;
}

export function CustomerCards({ rows }: { rows: CustomerListCard[] }) {
  if (rows.length === 0) {
    return <p className="text-[14px] text-muted">Brak klientów.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id} className="border border-white/10 bg-black-soft p-4">
          <CustomerNameLink
            customerId={row.id}
            className="text-[15px] font-semibold"
          >
            {row.displayName}
          </CustomerNameLink>
          <p className="mt-1 text-[13px]">
            {row.phone ? (
              <a
                href={telHref(row.phone)}
                className="text-gold hover:text-gold-light"
              >
                {row.phone}
              </a>
            ) : (
              <span className="text-muted">brak telefonu</span>
            )}
          </p>
          <div className="mt-2">
            <StatusPill tone={row.membership.tone} label={row.membership.label} />
          </div>
          <p className="mt-2 text-[13px] text-muted">
            {futureLabel(row.futureCount)}
          </p>
        </li>
      ))}
    </ul>
  );
}
