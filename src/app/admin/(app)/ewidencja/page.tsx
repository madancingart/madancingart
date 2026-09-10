import Link from "next/link";
import { getISODay } from "date-fns";
import { AttendanceJournal } from "@/components/admin/AttendanceJournal";
import { requireAdmin } from "@/lib/admin/require-admin";
import { isIsoDate } from "@/lib/admin/class-dates";
import {
  getJournal,
  getJournalCatalog,
  todayClassChips,
} from "@/lib/admin/get-journal";
import {
  clockFromDbTime,
  nowInWarsaw,
  warsawTodayIso,
  weekdayShortLabel,
} from "@/lib/datetime";
import { site } from "@/content/site";
import { z } from "zod";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const uuidSchema = z.uuid();

export default async function AttendancePage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const raw = await searchParams;
  const todayIso = warsawTodayIso();
  const dateParam = first(raw.data);
  const sessionDate = dateParam && isIsoDate(dateParam) ? dateParam : todayIso;
  const groupParam = first(raw.grupa);
  const groupId =
    groupParam && uuidSchema.safeParse(groupParam).success ? groupParam : null;

  const catalog = await getJournalCatalog(supabase);
  const chips = todayClassChips(catalog);
  const journal = groupId
    ? await getJournal(supabase, groupId, sessionDate)
    : null;

  const weekdayToday = getISODay(nowInWarsaw());

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[15px] font-semibold text-cream">Dziennik zajęć</h1>
        <Link
          href={`/admin/ewidencja/raport?miesiac=${todayIso.slice(0, 7)}`}
          className="inline-flex min-h-11 items-center text-[13px] text-gold hover:text-gold-light"
        >
          Raport miesięczny
        </Link>
      </div>

      {chips.length > 0 ? (
        <div className="mt-4">
          <p className="text-[12px] text-muted">Dzisiejsze zajęcia</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {chips.map((item) => {
              const href = `/admin/ewidencja?grupa=${item.id}&data=${todayIso}`;
              const active = groupId === item.id && sessionDate === todayIso;
              return (
                <Link
                  key={item.id}
                  href={href}
                  className={
                    active
                      ? "inline-flex min-h-11 items-center border border-gold bg-gold/10 px-3 text-[13px] text-gold"
                      : "inline-flex min-h-11 items-center border border-white/10 px-3 text-[13px] text-cream hover:border-gold"
                  }
                >
                  {item.locationCity} · {clockFromDbTime(item.startTime)} ·{" "}
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-muted">
          Dziś ({weekdayShortLabel(weekdayToday)}) nie ma zaplanowanych grup.
        </p>
      )}

      <form
        method="get"
        className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
      >
        <label className="text-[12px] text-muted">
          Grupa
          <select
            name="grupa"
            defaultValue={groupId ?? ""}
            className="mt-1 min-h-11 w-full border border-white/10 bg-black px-2 text-[13px] text-cream"
          >
            <option value="">Wybierz grupę</option>
            {site.locations.map((location) => (
              <optgroup key={location.id} label={location.city}>
                {catalog
                  .filter((item) => item.locationId === location.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {weekdayShortLabel(item.weekday)}{" "}
                      {clockFromDbTime(item.startTime)} · {item.name}
                      {item.level ? ` · ${item.level}` : ""}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-muted">
          Dzień
          <input
            type="date"
            name="data"
            defaultValue={sessionDate}
            className="mt-1 min-h-11 border border-white/10 bg-black px-2 text-[13px] text-cream"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="min-h-11 border border-gold px-4 text-[13px] text-gold hover:bg-gold/10"
          >
            Otwórz
          </button>
        </div>
      </form>

      {groupId && !journal ? (
        <p className="mt-6 text-muted">Nie znaleziono tej grupy.</p>
      ) : null}
      {journal ? (
        <AttendanceJournal
          key={`${journal.sessionId}-${journal.sessionStatus}`}
          data={journal}
        />
      ) : null}
    </div>
  );
}
