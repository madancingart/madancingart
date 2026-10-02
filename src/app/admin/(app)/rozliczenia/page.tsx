import Link from "next/link";
import type { ReactNode } from "react";
import { ChargesTable } from "@/components/admin/billing/ChargesTable";
import { PaidClientFields } from "@/components/admin/billing/PaidClientFields";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getBillingBoard } from "@/lib/admin/get-billing";
import { formatBillingZloty } from "@/lib/billing/status";
import { siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? "";
}

export default async function BillingPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const filters = {
    status: first(params.status),
    overdue: first(params.zalegle) === "1",
    locationId: first(params.lokalizacja),
    classId: first(params.grupa),
    month: first(params.miesiac),
    method: first(params.metoda),
    query: first(params.q),
  };
  const board = await getBillingBoard(supabase, filters);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[15px] font-semibold text-cream">Rozliczenia</h1>
        <div className="flex flex-wrap gap-3 text-[13px]">
          <Link href="/admin/rozliczenia/import" className="text-gold hover:text-gold-light">
            Import CSV
          </Link>
          <Link href="#dodaj-oplaconego" className="text-gold hover:text-gold-light">
            Dodaj opłaconego klienta
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile title="Wpłaty w tym miesiącu" value={formatBillingZloty(board.tiles.monthTotalCents)}>
          {board.tiles.methods.length === 0
            ? "Brak wpłat."
            : board.tiles.methods
                .map((item) => `${item.label}: ${formatBillingZloty(item.amountCents)}`)
                .join(" · ")}
        </Tile>
        <Tile title="Otwarte" value={formatBillingZloty(board.tiles.openCents)}>
          {board.tiles.openCount} należności
        </Tile>
        <Tile title="Zaległe" value={formatBillingZloty(board.tiles.overdueCents)}>
          {board.tiles.overduePeople} osób · {board.tiles.overdueCount} należności
        </Tile>
        <Tile title="Czekają na pierwszą płatność" value={String(board.tiles.pendingEnrollments)}>
          zapisy ze statusem oczekującym
        </Tile>
      </div>

      <form method="get" className="grid gap-2 md:grid-cols-3">
        <input
          name="q"
          defaultValue={filters.query}
          placeholder="Szukaj osoby lub zajęć"
          className="min-h-11 border border-white/10 bg-black px-3 text-[14px] text-cream"
        />
        <select name="status" defaultValue={filters.status} className="min-h-11 border border-white/10 bg-black px-3 text-cream">
          <option value="">Każdy status</option>
          <option value="open">Otwarte</option>
          <option value="paid">Opłacone</option>
          <option value="void">Anulowane</option>
        </select>
        <select name="zalegle" defaultValue={filters.overdue ? "1" : ""} className="min-h-11 border border-white/10 bg-black px-3 text-cream">
          <option value="">Wszystkie terminy</option>
          <option value="1">Tylko zaległe</option>
        </select>
        <select name="lokalizacja" defaultValue={filters.locationId} className="min-h-11 border border-white/10 bg-black px-3 text-cream">
          <option value="">Każda lokalizacja</option>
          <option value="mikolow">Mikołów</option>
          <option value="lubliniec">Lubliniec</option>
        </select>
        <select name="grupa" defaultValue={filters.classId} className="min-h-11 border border-white/10 bg-black px-3 text-cream">
          <option value="">Każda grupa</option>
          {board.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
        <input
          name="miesiac"
          type="month"
          defaultValue={filters.month}
          className="min-h-11 border border-white/10 bg-black px-3 text-cream"
        />
        <select name="metoda" defaultValue={filters.method} className="min-h-11 border border-white/10 bg-black px-3 text-cream">
          <option value="">Każda metoda</option>
          <option value="stripe">Online</option>
          <option value="onsite">Gotówka</option>
          <option value="transfer">Przelew</option>
          <option value="legacy">Wcześniejsze</option>
        </select>
        <button type="submit" className="min-h-11 border border-gold px-3 text-[13px] text-gold">
          Filtruj
        </button>
      </form>

      <ChargesTable rows={board.rows} payOrigin={siteUrl()} />

      <section id="dodaj-oplaconego" className="border border-white/10 bg-black-soft p-4">
        <h2 className="text-[15px] font-semibold text-cream">Dodaj opłaconego klienta</h2>
        <p className="mt-2 text-[13px] text-muted">
          Dla kilku osób, które opłaciły zajęcia zanim powstały konta. Przy tym samym mailu konto podepnie się samo.
        </p>
        <PaidClientFields groups={board.groups} />
      </section>
    </div>
  );
}

function Tile({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <article className="border border-white/10 bg-black-soft p-4">
      <p className="text-[12px] text-muted">{title}</p>
      <p className="mt-1 text-2xl text-gold">{value}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{children}</p>
    </article>
  );
}
