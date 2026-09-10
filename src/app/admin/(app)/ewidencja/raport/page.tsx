import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { parseYearMonth } from "@/lib/admin/class-dates";
import { getAttendanceReport } from "@/lib/admin/get-attendance-report";
import { clockFromDbTime, formatDateTimeWarsaw, warsawTodayIso, weekdayLongLabel } from "@/lib/datetime";
import { formatPlnFromCents } from "@/lib/money";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatAvg(value: number | null): string {
  if (value == null) {
    return "—";
  }
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export default async function AttendanceReportPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const raw = await searchParams;
  const todayMonth = warsawTodayIso().slice(0, 7);
  const monthParam = first(raw.miesiac) ?? todayMonth;
  const month = parseYearMonth(monthParam) ? monthParam : todayMonth;
  const report = await getAttendanceReport(supabase, month);

  if (!report) {
    return <p className="text-muted">Nie udało się wczytać raportu.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/admin/ewidencja"
            className="text-[13px] text-muted hover:text-gold"
          >
            ← Dziennik
          </Link>
          <h1 className="mt-2 text-[15px] font-semibold text-cream">
            Raport ewidencji
          </h1>
        </div>
        <a
          href={`/admin/ewidencja/raport/csv?miesiac=${month}`}
          className="inline-flex min-h-11 items-center border border-gold px-3 text-[13px] text-gold hover:bg-gold/10"
        >
          Eksport CSV
        </a>
      </div>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-[12px] text-muted">
          Miesiąc
          <input
            type="month"
            name="miesiac"
            defaultValue={month}
            className="mt-1 min-h-11 border border-white/10 bg-black px-2 text-[13px] text-cream"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 border border-gold px-4 text-[13px] text-gold hover:bg-gold/10"
        >
          Pokaż
        </button>
      </form>

      {report.methodTotals.length > 0 ? (
        <section className="mt-6 border border-white/10 bg-black-soft p-4">
          <h2 className="text-[14px] font-semibold text-cream">
            Wpłaty w miesiącu — suma per metoda
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-[13px] text-muted">
            {report.methodTotals.map((item) => (
              <li key={item.method}>
                {item.label}: {item.count}{" "}
                {item.count === 1 ? "wpłata" : "wpłat"} ·{" "}
                {formatPlnFromCents(item.amountCents)}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-6 text-[13px] text-muted">Brak wpłat w tym miesiącu.</p>
      )}

      {site.locations.map((location) => {
        const groups = report.groups.filter(
          (group) => group.locationId === location.id,
        );
        if (groups.length === 0) {
          return null;
        }
        return (
          <section key={location.id} className="mt-8">
            <h2 className="text-[15px] font-semibold text-cream">
              {location.city}
            </h2>
            <div className="mt-3 flex flex-col gap-4">
              {groups.map((group) => (
                <article
                  key={group.classId}
                  className="border border-white/10 bg-black-soft p-4"
                >
                  <h3 className="text-cream">
                    {group.name}
                    <span className="text-muted">
                      {` · ${weekdayLongLabel(group.weekday)} ${clockFromDbTime(group.startTime)}`}
                    </span>
                  </h3>
                  <p className="mt-2 text-[13px] text-muted">
                    Odbyte zajęcia: {group.heldCount}
                    {" · "}
                    Frekwencja średnia: {formatAvg(group.averageAttendance)}
                  </p>
                  {group.methodSums.length > 0 ? (
                    <ul className="mt-2 text-[13px] text-muted">
                      {group.methodSums.map((item) => (
                        <li key={item.method}>
                          {item.label}: {formatPlnFromCents(item.amountCents)} (
                          {item.count})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[13px] text-muted">Brak wpłat.</p>
                  )}
                  {group.payments.length > 0 ? (
                    <ul className="mt-3 divide-y divide-white/10 text-[13px]">
                      {group.payments.map((payment) => (
                        <li
                          key={payment.id}
                          className="flex flex-wrap justify-between gap-2 py-2 text-cream"
                        >
                          <span>
                            {payment.customerName}
                            <span className="text-muted">
                              {` · ${formatDateTimeWarsaw(payment.paidAt)}`}
                            </span>
                          </span>
                          <span className="text-gold">
                            {formatPlnFromCents(payment.amountCents)}
                            {" · "}
                            {payment.method === "onsite"
                              ? "gotówka"
                              : payment.method === "transfer"
                                ? "przelew"
                                : payment.method === "stripe"
                                  ? "Stripe"
                                  : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}

      {report.otherPayments.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[15px] font-semibold text-cream">Inne wpłaty</h2>
          <ul className="mt-3 divide-y divide-white/10 border border-white/10 bg-black-soft px-4 text-[13px]">
            {report.otherPayments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap justify-between gap-2 py-2 text-cream"
              >
                <span>
                  {payment.customerName}
                  <span className="text-muted">{` · ${payment.label}`}</span>
                </span>
                <span className="text-gold">
                  {formatPlnFromCents(payment.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
