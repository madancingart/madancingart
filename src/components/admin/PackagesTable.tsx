import { formatDatePl } from "@/lib/datetime";
import { formatPlnFromCents } from "@/lib/money";
import { weddingCoupleTileLabel } from "@/lib/packages/couple-label";
import type { PackageStatus } from "@/lib/types";
import Link from "next/link";

export type PackageListItem = {
  id: string;
  label: string;
  status: PackageStatus;
  weddingDate: string | null;
  songs: string[];
  totalLessons: number | null;
  usedLessons: number;
  priceCents: number;
  firstName: string;
  lastName: string;
  partnerFirstName: string | null;
  partnerLastName: string | null;
};

function statusLabel(status: PackageStatus): string {
  if (status === "pending_payment") {
    return "do opłacenia";
  }
  if (status === "active") {
    return "aktywny";
  }
  if (status === "completed") {
    return "wyczerpany";
  }
  if (status === "expired") {
    return "wygasł";
  }
  return "anulowany";
}

export function PackagesTable({ items }: { items: PackageListItem[] }) {
  if (items.length === 0) {
    return <p className="text-[14px] text-muted">Brak pakietów.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const couple = weddingCoupleTileLabel({
          lastName: item.lastName,
          partnerLastName: item.partnerLastName,
        });
        const names = `${item.firstName} ${item.lastName}${
          item.partnerFirstName
            ? ` i ${item.partnerFirstName} ${item.partnerLastName ?? ""}`
            : ""
        }`.trim();
        const paid = item.status !== "pending_payment";
        const progress =
          item.totalLessons != null
            ? `${item.usedLessons}/${item.totalLessons}`
            : `${item.usedLessons}`;

        return (
          <li
            key={item.id}
            className="border border-white/10 bg-black-soft p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold text-cream">{couple}</p>
                <p className="text-[13px] text-muted">{names}</p>
                <p className="mt-1 text-[13px] text-cream">{item.label}</p>
              </div>
              <Link
                href={`/admin/pakiety/${item.id}`}
                className="min-h-11 text-[13px] text-gold hover:text-gold-light"
              >
                Szczegóły
              </Link>
            </div>
            <dl className="mt-3 grid gap-1 text-[13px] text-muted sm:grid-cols-2">
              <div>
                Opłacony:{" "}
                <span className="text-cream">{paid ? "tak" : "nie"}</span>
                {" · "}
                {statusLabel(item.status)}
              </div>
              <div>
                Postęp: <span className="text-cream">{progress}</span>
              </div>
              <div>
                Wesele:{" "}
                <span className="text-cream">
                  {item.weddingDate ? formatDatePl(item.weddingDate) : "—"}
                </span>
              </div>
              <div>{formatPlnFromCents(item.priceCents)}</div>
            </dl>
            {item.songs.length > 0 ? (
              <p className="mt-2 text-[13px] text-cream">
                Piosenki: {item.songs.join(" · ")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
