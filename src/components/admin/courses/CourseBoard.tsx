"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  addCourseSession,
  cancelCourseSession,
  setCourseSignup,
  toggleCourseAttendance,
} from "@/app/admin/(app)/kursy/actions";
import { formatDateTimeWarsaw } from "@/lib/datetime";

export type CoursePerson = {
  bookingId: string;
  customerId: string;
  name: string;
  email: string;
  phone: string;
  payment: string;
};

export type CourseSession = {
  id: string;
  title: string;
  startsAt: string;
  cancelled: boolean;
};

export function CourseBoard({
  seriesId,
  signupOpen,
  people,
  sessions,
  present,
}: {
  seriesId: string;
  signupOpen: boolean;
  people: CoursePerson[];
  sessions: CourseSession[];
  present: string[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const marks = new Set(present);

  async function run(action: Promise<{ ok: boolean; error?: string; message?: string }>) {
    setPending(true);
    const result = await action;
    setPending(false);
    setMessage(result.ok ? (result.message ?? "Zapisane.") : (result.error ?? "Nie udało się."));
    if (result.ok) {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => void run(setCourseSignup({ seriesId, open: !signupOpen }))}
        >
          {signupOpen ? "Zamknij zapisy" : "Otwórz zapisy"}
        </Button>
        <Button href={`/admin/kursy/${seriesId}/csv`} size="sm" variant="ghost">
          Eksport CSV
        </Button>
      </div>

      <section>
        <h2 className="text-[15px] font-semibold text-cream">Uczestnicy</h2>
        {people.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">Nikt jeszcze nie jest zapisany na cały kurs.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {people.map((person) => (
              <li key={person.bookingId} className="text-[13px] text-cream">
                {person.name}
                <span className="text-muted">
                  {" "}
                  · {person.phone || "brak telefonu"} · {person.email || "brak e-maila"} · {person.payment}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-x-auto">
        <h2 className="text-[15px] font-semibold text-cream">Obecność</h2>
        {sessions.length === 0 || people.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">Siatka pojawi się, gdy będą spotkania i uczestnicy.</p>
        ) : (
          <table className="mt-2 w-full min-w-[640px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-2 py-2 font-normal">Uczestnik</th>
                {sessions.map((session) => (
                  <th key={session.id} className="px-2 py-2 font-normal">
                    {formatDateTimeWarsaw(session.startsAt)}
                    {session.cancelled ? " · odwołane" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.customerId} className="border-t border-white/10">
                  <td className="px-2 py-2 text-cream">{person.name}</td>
                  {sessions.map((session) => (
                    <td key={session.id} className="px-2 py-2">
                      <input
                        type="checkbox"
                        disabled={pending || session.cancelled}
                        checked={marks.has(`${session.id}:${person.customerId}`)}
                        onChange={(event) =>
                          void run(
                            toggleCourseAttendance({
                              eventId: session.id,
                              customerId: person.customerId,
                              present: event.target.checked,
                            }),
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-cream">Spotkania</h2>
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center gap-2 text-[13px] text-cream">
              <span>
                {session.title} · {formatDateTimeWarsaw(session.startsAt)}
              </span>
              {session.cancelled ? (
                <span className="text-muted">odwołane</span>
              ) : (
                <CancelSession eventId={session.id} disabled={pending} onRun={run} />
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              addCourseSession({
                seriesId,
                date: String(form.get("date")),
                start: String(form.get("start")).slice(0, 5),
                durationMin: Number(form.get("duration")),
              }),
            );
          }}
        >
          <input name="date" type="date" required className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
          <input name="start" type="time" required className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
          <input name="duration" type="number" min={15} max={180} defaultValue={60} className="min-h-11 w-24 border border-white/10 bg-black px-3 text-cream" />
          <Button type="submit" size="sm" disabled={pending}>
            Dodaj spotkanie
          </Button>
        </form>
      </section>
      {message ? <p className="text-[13px] text-muted">{message}</p> : null}
    </div>
  );
}

function CancelSession({
  eventId,
  disabled,
  onRun,
}: {
  eventId: string;
  disabled: boolean;
  onRun: (action: Promise<{ ok: boolean; error?: string; message?: string }>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="text-gold" disabled={disabled} onClick={() => setOpen(true)}>
        Odwołaj spotkanie
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void onRun(cancelCourseSession({ eventId, reason: String(form.get("reason") ?? "") }));
      }}
    >
      <input name="reason" placeholder="Powód" className="min-h-9 border border-white/10 bg-black px-2 text-cream" />
      <Button type="submit" size="sm" disabled={disabled}>
        Wyślij odwołanie
      </Button>
    </form>
  );
}
