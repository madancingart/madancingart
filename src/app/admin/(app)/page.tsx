import { Plus } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getAdminDashboard } from "@/lib/admin/dashboard";
import type { LocationId } from "@/content/site";

type PageProps = {
  searchParams: Promise<{ lokalizacja?: string }>;
};

function resolveLocation(value: string | undefined): LocationId | "all" {
  if (value === "mikolow" || value === "lubliniec") {
    return value;
  }
  return "all";
}

function kindLabel(kind: string): string {
  if (kind === "slot") {
    return "indywidualne";
  }
  if (kind === "event") {
    return "wydarzenie";
  }
  return "grupa";
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const location = resolveLocation(params.lokalizacja);
  const data = await getAdminDashboard(supabase, location);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <article className="border border-white/10 bg-black-soft p-4">
          <p className="text-[12px] text-muted">Dzisiejsze pozycje</p>
          <p className="mt-1 text-2xl text-gold">{data.todayCount}</p>
        </article>
        <article className="border border-white/10 bg-black-soft p-4">
          <p className="text-[12px] text-muted">Oczekujące zapisy</p>
          <p className="mt-1 text-2xl text-gold">{data.pendingCount}</p>
          <Link
            href="/admin/zapisy?status=pending"
            className="mt-2 inline-block text-[12px] text-muted hover:text-gold"
          >
            Otwórz listę
          </Link>
        </article>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/kalendarz?nowy=slot"
          className="inline-flex min-h-9 items-center gap-1 border border-gold px-3 text-[13px] text-gold hover:bg-gold/10"
        >
          <Plus strokeWidth={1.5} className="size-4" />
          Dodaj wolny termin
        </Link>
        <Link
          href="/admin/eventy?nowy=1"
          className="inline-flex min-h-9 items-center gap-1 border border-gold px-3 text-[13px] text-gold hover:bg-gold/10"
        >
          <Plus strokeWidth={1.5} className="size-4" />
          Dodaj event
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="border border-white/10 bg-black-soft p-4">
          <h1 className="text-[15px] font-semibold text-cream">
            Dzisiejsze zajęcia i rezerwacje
          </h1>
          {data.today.length === 0 ? (
            <p className="mt-3 text-muted">Brak pozycji na dziś.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {data.today.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 py-2"
                >
                  <div>
                    <p className="text-cream">{item.title}</p>
                    <p className="text-[12px] text-muted">
                      {item.locationLabel}
                      {item.detail ? ` · ${item.detail}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-[12px] text-gold">{item.time}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="border border-white/10 bg-black-soft p-4">
          <h2 className="flex items-baseline justify-between gap-2 text-[15px] font-semibold text-cream">
            Nowe zapisy (pending)
            <span className="text-gold">{data.pendingCount}</span>
          </h2>
          {data.pending.length === 0 ? (
            <p className="mt-3 text-muted">Brak oczekujących zapisów.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {data.pending.map((item) => (
                <li key={item.id} className="py-2">
                  <Link
                    href="/admin/zapisy"
                    className="flex items-baseline justify-between gap-3 hover:text-gold"
                  >
                    <span className="text-cream">{item.name}</span>
                    <span className="text-[12px] text-muted">
                      {kindLabel(item.kind)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
