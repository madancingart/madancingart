import Link from "next/link";
import { CUSTOMER_PAGE_SIZE, getCustomersPage } from "@/lib/admin/get-customers";
import { CustomerCards } from "@/components/admin/CustomerCards";
import { CustomerSearch } from "@/components/admin/CustomerSearch";
import { requireAdmin } from "@/lib/admin/require-admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ q?: string | string[]; strona?: string | string[] }>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = first(params.q)?.trim() ?? "";
  const pageRaw = Number.parseInt(first(params.strona) ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const { rows, total } = await getCustomersPage(supabase, { q, page });
  const pages = Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE));

  function pageHref(nextPage: number): string {
    const search = new URLSearchParams();
    if (q) {
      search.set("q", q);
    }
    if (nextPage > 1) {
      search.set("strona", String(nextPage));
    }
    const query = search.toString();
    return query ? `/admin/klienci?${query}` : "/admin/klienci";
  }

  return (
    <div>
      <h1 className="text-[15px] font-semibold text-cream">Klienci</h1>
      <div className="mt-4">
        <CustomerSearch initialQuery={q} />
      </div>
      <p className="mt-3 text-[13px] text-muted">
        {q
          ? `Wyniki: ${total}`
          : `Ostatnio dodani · ${total}`}
      </p>
      <div className="mt-4">
        <CustomerCards rows={rows} />
      </div>
      {pages > 1 ? (
        <nav
          className="mt-4 flex flex-wrap items-center gap-2"
          aria-label="Strony"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="min-h-11 border border-white/10 px-3 text-[13px] text-cream hover:border-gold"
            >
              Poprzednia
            </Link>
          ) : null}
          <p className="text-[13px] text-muted">
            {page} / {pages}
          </p>
          {page < pages ? (
            <Link
              href={pageHref(page + 1)}
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
