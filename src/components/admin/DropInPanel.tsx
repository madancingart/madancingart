"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addDropInExisting,
  addDropInNew,
  searchCustomers,
  type SearchCustomerRow,
} from "@/app/admin/(app)/ewidencja/actions";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/admin/Toast";

type DropInPanelProps = {
  sessionId: string;
  classId: string;
  sessionDate: string;
  excludeIds: string[];
  onAdded: () => void;
};

export function DropInPanel({
  sessionId,
  classId,
  sessionDate,
  excludeIds,
  onAdded,
}: DropInPanelProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [fetched, setFetched] = useState<SearchCustomerRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const trimmed = query.trim();
  const excludeKey = excludeIds.join(",");
  const rows = trimmed.length < 2 ? [] : fetched;

  useEffect(() => {
    if (trimmed.length < 2) {
      return;
    }
    const excluded = new Set(excludeKey.split(",").filter(Boolean));
    const handle = window.setTimeout(() => {
      setSearching(true);
      void searchCustomers(trimmed).then((result) => {
        setSearching(false);
        if (result.ok) {
          setFetched(result.rows.filter((row) => !excluded.has(row.id)));
        }
      });
    }, 280);
    return () => window.clearTimeout(handle);
  }, [trimmed, excludeKey]);

  function addExisting(customerId: string) {
    startTransition(async () => {
      const result = await addDropInExisting({
        sessionId,
        classId,
        sessionDate,
        customerId,
      });
      if (!result.ok) {
        toast.push("err", result.error);
        return;
      }
      toast.push("ok", "Dopisano na zajęcia.");
      setQuery("");
      setFetched([]);
      onAdded();
    });
  }

  return (
    <section className="border border-white/10 bg-black-soft p-3">
      <h3 className="text-[15px] font-semibold text-cream">
        Dopisz osobę spoza listy
      </h3>
      <label className="mt-3 block text-[12px] text-muted">
        Szukaj klienta
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="nazwisko, imię, telefon"
          className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-[13px] text-cream"
        />
      </label>
      {searching && trimmed.length >= 2 ? (
        <p className="mt-2 text-[12px] text-muted">Szukam…</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => addExisting(row.id)}
                className="flex min-h-11 w-full items-center justify-between gap-2 border border-white/10 px-3 text-left text-[13px] text-cream hover:border-gold"
              >
                <span>
                  {row.firstName} {row.lastName}
                </span>
                <span className="text-muted">{row.phone ?? row.email ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        className="mt-3 text-[13px] text-gold hover:text-gold-light"
        onClick={() => setShowNew((value) => !value)}
      >
        {showNew ? "Ukryj formularz" : "Nowy klient"}
      </button>

      {showNew ? (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await addDropInNew({
                sessionId,
                classId,
                sessionDate,
                firstName,
                lastName,
                phone,
                email,
              });
              if (!result.ok) {
                toast.push("err", result.error);
                return;
              }
              toast.push("ok", "Dopisano nowego klienta.");
              setFirstName("");
              setLastName("");
              setPhone("");
              setEmail("");
              setShowNew(false);
              onAdded();
            });
          }}
        >
          <label className="text-[12px] text-muted">
            Imię
            <input
              required
              minLength={2}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-[13px] text-cream"
            />
          </label>
          <label className="text-[12px] text-muted">
            Nazwisko
            <input
              required
              minLength={2}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-[13px] text-cream"
            />
          </label>
          <label className="text-[12px] text-muted">
            Telefon
            <input
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-[13px] text-cream"
            />
          </label>
          <label className="text-[12px] text-muted">
            E-mail (opcjonalnie)
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-[13px] text-cream"
            />
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            Dopisz
          </Button>
        </form>
      ) : null}
    </section>
  );
}
