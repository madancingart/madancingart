"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { addPaidClientAction } from "@/app/admin/(app)/rozliczenia/actions";

export function PaidClientFields({
  groups,
}: {
  groups: { id: string; code: string; label: string }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState("adult");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-4 grid gap-3 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        void addPaidClientAction({
          kind,
          firstName: String(form.get("firstName") ?? ""),
          lastName: String(form.get("lastName") ?? ""),
          partnerFirstName: String(form.get("partnerFirstName") ?? ""),
          partnerLastName: String(form.get("partnerLastName") ?? ""),
          guardianName: String(form.get("guardianName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          classId: String(form.get("classId") ?? ""),
          paidUntil: String(form.get("paidUntil") ?? ""),
          amountZloty: String(form.get("amount") ?? ""),
          method: String(form.get("method") ?? "legacy"),
          note: String(form.get("note") ?? ""),
          invite: form.get("invite") === "on",
        }).then((result) => {
          setPending(false);
          setMessage(result.ok ? result.message : result.error);
          if (result.ok) {
            router.refresh();
          }
        });
      }}
    >
      <select
        value={kind}
        onChange={(event) => setKind(event.target.value)}
        className="min-h-11 border border-white/10 bg-black px-3 text-cream"
      >
        <option value="adult">Dorosły</option>
        <option value="pair">Para</option>
        <option value="child">Dziecko</option>
      </select>
      <select name="classId" required className="min-h-11 border border-white/10 bg-black px-3 text-cream">
        <option value="">Grupa</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.code} · {group.label}
          </option>
        ))}
      </select>
      <input name="firstName" required placeholder="Imię" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
      <input name="lastName" required placeholder="Nazwisko" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
      {kind === "pair" ? (
        <>
          <input name="partnerFirstName" placeholder="Imię partnera" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
          <input name="partnerLastName" placeholder="Nazwisko partnera" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
        </>
      ) : null}
      {kind === "child" ? (
        <input name="guardianName" placeholder="Opiekun" className="min-h-11 border border-white/10 bg-black px-3 text-cream md:col-span-2" />
      ) : null}
      <input name="email" type="email" required placeholder="E-mail" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
      <input name="phone" required placeholder="Telefon" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
      <input name="paidUntil" type="date" required className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
      <input name="amount" inputMode="decimal" placeholder="Kwota zł, 0 gdy nieznana" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
      <select name="method" defaultValue="legacy" className="min-h-11 border border-white/10 bg-black px-3 text-cream">
        <option value="legacy">Metoda nieznana</option>
        <option value="onsite">Gotówka</option>
        <option value="transfer">Przelew</option>
      </select>
      <input name="note" placeholder="Notatka" className="min-h-11 border border-white/10 bg-black px-3 text-cream" />
      <label className="flex items-center gap-2 text-[13px] text-muted md:col-span-2">
        <input name="invite" type="checkbox" />
        Wyślij zaproszenie do konta
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        Dodaj opłaconego klienta
      </Button>
      {message ? <p className="text-[13px] text-muted md:col-span-2">{message}</p> : null}
    </form>
  );
}
