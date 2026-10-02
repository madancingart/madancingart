"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { previewCourseDates, saveCourse } from "@/app/admin/(app)/kursy/actions";
import { site } from "@/content/site";
import { generateCourseMeetings, slugifyCourseTitle } from "@/lib/courses/schedule";
import { TRAINER_CATALOG } from "@/lib/trainers";

type Meeting = {
  date: string;
  start: string;
  end: string;
  conflict: string | null;
};

const WEEKDAYS = [
  { id: 1, label: "poniedziałek" },
  { id: 2, label: "wtorek" },
  { id: 3, label: "środa" },
  { id: 4, label: "czwartek" },
  { id: 5, label: "piątek" },
  { id: 6, label: "sobota" },
  { id: 7, label: "niedziela" },
];

export function CourseCreator() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([2]);
  const [allowSingle, setAllowSingle] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const publishedRef = useRef(false);

  function onTitle(value: string) {
    setTitle(value);
    if (!slugTouched) {
      setSlug(slugifyCourseTitle(value));
    }
  }

  async function refresh(next: { date: string; start: string; end: string }[], form: FormData) {
    if (next.length === 0) {
      setMeetings([]);
      setMessage(null);
      return;
    }
    const result = await previewCourseDates({
      locationId: String(form.get("locationId")),
      trainerId: String(form.get("trainerId") ?? ""),
      meetings: next,
    });
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMeetings(
      result.meetings.map((item) => ({
        date: item.date,
        start: item.start,
        end: item.end,
        conflict: item.conflict,
      })),
    );
    setMessage(null);
  }

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const published = publishedRef.current;
        setPending(true);
        void saveCourse({
          title,
          slug,
          description: String(form.get("description") ?? ""),
          locationId: String(form.get("locationId")),
          trainerId: String(form.get("trainerId") ?? ""),
          capacity: String(form.get("capacity") ?? ""),
          priceZloty: String(form.get("price") ?? ""),
          allowSingle,
          singlePriceZloty: String(form.get("singlePrice") ?? ""),
          published,
          meetings: meetings.map(({ date, start, end }) => ({ date, start, end })),
        }).then((result) => {
          setPending(false);
          setMessage(result.ok ? result.message : result.error);
          if (result.ok && result.id) {
            router.push(`/admin/kursy/${result.id}`);
          }
        });
      }}
    >
      <label className="text-[13px] text-muted">
        Tytuł
        <input
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          required
          className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
        />
      </label>
      <label className="text-[13px] text-muted">
        Adres
        <input
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugifyCourseTitle(event.target.value));
          }}
          required
          className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
        />
      </label>
      <label className="text-[13px] text-muted">
        Opis
        <textarea name="description" rows={4} className="mt-1 w-full border border-white/10 bg-black px-3 py-2 text-cream" />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <select name="locationId" className="min-h-11 border border-white/10 bg-black px-3 text-cream">
          {site.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.city}
            </option>
          ))}
        </select>
        <select name="trainerId" className="min-h-11 border border-white/10 bg-black px-3 text-cream">
          <option value="">Prowadzący</option>
          {TRAINER_CATALOG.map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.name}
            </option>
          ))}
        </select>
        <input name="capacity" inputMode="numeric" placeholder="Limit miejsc" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
        <input name="price" required placeholder="Cena całego kursu, zł" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
      </div>
      <label className="flex items-center gap-2 text-[13px] text-muted">
        <input type="checkbox" checked={allowSingle} onChange={(event) => setAllowSingle(event.target.checked)} />
        pozwól zapisywać się na pojedyncze spotkania
      </label>
      {allowSingle ? (
        <input name="singlePrice" placeholder="Cena pojedynczego spotkania, zł" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
      ) : null}

      <fieldset className="border border-white/10 p-3">
        <legend className="px-1 text-[13px] text-cream">Harmonogram</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {WEEKDAYS.map((day) => (
            <label key={day.id} className="flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={weekdays.includes(day.id)}
                onChange={(event) => {
                  setWeekdays((current) =>
                    event.target.checked
                      ? [...current, day.id]
                      : current.filter((item) => item !== day.id),
                  );
                }}
              />
              {day.label}
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <input name="startDate" type="date" required className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
          <input name="startTime" type="time" required defaultValue="19:00" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
          <input name="duration" type="number" min={15} max={180} defaultValue={60} className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
          <input name="count" type="number" min={1} max={24} defaultValue={6} className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={(event) => {
            const form = new FormData(event.currentTarget.form ?? undefined);
            const start = String(form.get("startTime") ?? "19:00").slice(0, 5);
            const duration = Number(form.get("duration") ?? 60);
            const generated = generateCourseMeetings({
              startDate: String(form.get("startDate") ?? ""),
              weekdays,
              startTime: start,
              durationMin: duration,
              count: Number(form.get("count") ?? 6),
            });
            if (generated.length === 0) {
              setMessage("Nie udało się ułożyć dat. Sprawdź dzień startu, dni tygodnia i liczbę spotkań.");
              return;
            }
            const next = generated.map((item) => ({
              date: item.date,
              start: item.start,
              end: item.end,
            }));
            void refresh(next, form);
          }}
        >
          Pokaż daty
        </Button>
        {meetings.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {meetings.map((meeting, index) => (
              <li key={`${meeting.date}-${meeting.start}-${index}`} className="flex flex-wrap items-center gap-2 text-[13px]">
                <input
                  type="date"
                  value={meeting.date}
                  className="min-h-9 border border-white/10 bg-black px-2 text-cream"
                  onChange={(event) => {
                    const form = new FormData(event.currentTarget.form ?? undefined);
                    const next = meetings.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, date: event.target.value } : item,
                    );
                    void refresh(next, form);
                  }}
                />
                <span className="text-cream">
                  {meeting.start}–{meeting.end}
                </span>
                {meeting.conflict ? <span className="text-[#E8A0A0]">{meeting.conflict}</span> : null}
                <button
                  type="button"
                  className="text-gold"
                  onClick={(event) => {
                    const form = new FormData(event.currentTarget.form ?? undefined);
                    void refresh(
                      meetings.filter((_, itemIndex) => itemIndex !== index),
                      form,
                    );
                  }}
                >
                  Usuń
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || meetings.length === 0}
          onClick={() => {
            publishedRef.current = false;
            formRef.current?.requestSubmit();
          }}
        >
          Zapisz szkic
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending || meetings.length === 0}
          onClick={() => {
            publishedRef.current = true;
            formRef.current?.requestSubmit();
          }}
        >
          Opublikuj
        </Button>
      </div>
      {message ? <p className="text-[13px] text-muted">{message}</p> : null}
    </form>
  );
}
