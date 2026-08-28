import Link from "next/link";
import { BookingsTable } from "@/components/admin/BookingsTable";
import {
  BOOKING_PAGE_SIZE,
  bookingFiltersToSearchParams,
  parseBookingFilters,
} from "@/lib/admin/booking-filters";
import { getAdminBookingsPage } from "@/lib/admin/get-bookings";
import { requireAdmin } from "@/lib/admin/require-admin";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function flatten(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    result[key] = first(value);
  }
  return result;
}

const selectClass =
  "min-h-11 border border-white/10 bg-black px-2 text-[13px] text-cream";

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const raw = flatten(await searchParams);
  const filters = parseBookingFilters(raw);
  const { rows, total } = await getAdminBookingsPage(supabase, filters);
  const pages = Math.max(1, Math.ceil(total / BOOKING_PAGE_SIZE));
  const csvQuery = bookingFiltersToSearchParams(filters, false).toString();
  const csvHref = csvQuery
    ? `/admin/zapisy/csv?${csvQuery}`
    : "/admin/zapisy/csv";

  function pageHref(page: number): string {
    const params = bookingFiltersToSearchParams({ ...filters, page }, true);
    const query = params.toString();
    return query ? `/admin/zapisy?${query}` : "/admin/zapisy";
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[15px] font-semibold text-cream">Zapisy</h1>
        <a
          href={csvHref}
          className="inline-flex min-h-11 items-center border border-gold px-3 text-[13px] text-gold hover:bg-gold/10"
        >
          Eksport CSV
        </a>
      </div>

      <form
        method="get"
        className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        <label className="text-[12px] text-muted">
          Lokalizacja
          <select
            name="lokalizacja"
            defaultValue={filters.locationId ?? ""}
            className={`${selectClass} mt-1 w-full`}
          >
            <option value="">Wszystkie</option>
            {site.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.city}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-muted">
          Status
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className={`${selectClass} mt-1 w-full`}
          >
            <option value="">Wszystkie</option>
            <option value="pending">oczekuje</option>
            <option value="confirmed">potwierdzony</option>
            <option value="cancelled">anulowany</option>
          </select>
        </label>
        <label className="text-[12px] text-muted">
          Rodzaj
          <select
            name="rodzaj"
            defaultValue={filters.kind ?? ""}
            className={`${selectClass} mt-1 w-full`}
          >
            <option value="">Wszystkie</option>
            <option value="class">grupa</option>
            <option value="slot">indywidualne</option>
            <option value="event">wydarzenie</option>
          </select>
        </label>
        <label className="text-[12px] text-muted">
          Od
          <input
            type="date"
            name="od"
            defaultValue={filters.from ?? ""}
            className={`${selectClass} mt-1 w-full`}
          />
        </label>
        <label className="text-[12px] text-muted">
          Do
          <input
            type="date"
            name="do"
            defaultValue={filters.to ?? ""}
            className={`${selectClass} mt-1 w-full`}
          />
        </label>
        <label className="text-[12px] text-muted sm:col-span-2 xl:col-span-1">
          Szukaj
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="nazwisko, mail, telefon"
            className={`${selectClass} mt-1 w-full`}
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="min-h-11 border border-gold px-4 text-[13px] text-gold hover:bg-gold/10"
          >
            Filtruj
          </button>
          <Link
            href="/admin/zapisy"
            className="inline-flex min-h-11 items-center px-3 text-[13px] text-muted hover:text-cream"
          >
            Wyczyść
          </Link>
        </div>
      </form>

      <p className="mt-4 text-[12px] text-muted">
        {total} {total === 1 ? "zapis" : "zapisów"}
      </p>

      {rows.length === 0 ? (
        <p className="mt-4 text-muted">Brak zapisów dla wybranych filtrów.</p>
      ) : (
        <div className="mt-3">
          <BookingsTable rows={rows} />
        </div>
      )}

      {pages > 1 ? (
        <nav
          className="mt-4 flex flex-wrap items-center gap-2"
          aria-label="Strony"
        >
          {filters.page > 1 ? (
            <Link
              href={pageHref(filters.page - 1)}
              className="min-h-11 border border-white/10 px-3 text-[13px] text-cream hover:border-gold"
            >
              Poprzednia
            </Link>
          ) : null}
          <p className="text-[13px] text-muted">
            {filters.page} / {pages}
          </p>
          {filters.page < pages ? (
            <Link
              href={pageHref(filters.page + 1)}
              className="min-h-11 border border-white/10 px-3 text-[13px] text-cream hover:border-gold"
            >
              Następna
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
