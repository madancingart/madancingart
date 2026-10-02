"use client";

import { useState } from "react";
import { enrollCourse, requestCourseWaitlist } from "@/app/(site)/konto/kursy/actions";
import { Button } from "@/components/ui/Button";

type Person = { id: string; label: string };

export function CourseEnrollForm({
  slug,
  people,
  full,
}: {
  slug: string;
  people: Person[];
  full: boolean;
}) {
  const [customerId, setCustomerId] = useState(people[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [waitlist, setWaitlist] = useState(full);
  const [pending, setPending] = useState(false);

  if (waitlist) {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setPending(true);
          void requestCourseWaitlist({
            slug,
            name: String(form.get("name") ?? ""),
            email: String(form.get("email") ?? ""),
            phone: String(form.get("phone") ?? ""),
          }).then((result) => {
            setPending(false);
            setMessage(result.ok ? "Dziękujemy. Napiszemy, gdy zwolni się miejsce." : result.error);
          });
        }}
      >
        <p className="text-sm text-cream">
          Brak miejsc — zostaw kontakt, damy znać, jeśli ktoś zrezygnuje.
        </p>
        <input name="name" required placeholder="Imię i nazwisko" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
        <input name="email" type="email" required placeholder="E-mail" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
        <input name="phone" required placeholder="Telefon" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
        <Button type="submit" size="sm" disabled={pending}>
          Zostaw kontakt
        </Button>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void enrollCourse({ customerId, slug }).then((result) => {
          setPending(false);
          if (result.ok && "checkoutUrl" in result && result.checkoutUrl) {
            window.location.assign(result.checkoutUrl);
            return;
          }
          if (!result.ok && "waitlist" in result && result.waitlist) {
            setWaitlist(true);
            setMessage(result.error);
            return;
          }
          if (result.ok) {
            setMessage("message" in result ? result.message : "Zapis przyjęty.");
            return;
          }
          setMessage(result.error);
        });
      }}
    >
      {people.length === 0 ? (
        <p className="text-sm text-muted">
          Dodaj uczestnika w koncie, zanim zapiszesz się na kurs.
        </p>
      ) : (
        <label className="text-sm text-muted">
          Uczestnik
          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button type="submit" size="sm" disabled={pending || people.length === 0}>
        Zapisz i opłać
      </Button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </form>
  );
}
