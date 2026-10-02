"use client";

import { useEffect, useMemo, useState } from "react";
import { previewSignup } from "@/app/(site)/konto/zapisy/actions";
import { AccountField, accountFieldClass } from "@/components/account/fields";
import { ContractConsent } from "@/components/legal/ContractConsent";
import { Button } from "@/components/ui/Button";
import type { SignupGroup } from "@/lib/account/signup-catalog";
import { participantRpcMessage } from "@/lib/account/rpc-errors";
import type { EnrollmentPreview } from "@/lib/billing/preview";
import { site, type LocationId } from "@/content/site";
import { weekdayLongLabel } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/client";
import type { CustomerKind } from "@/lib/types";
import { childParticipantSchema, pairParticipantSchema } from "@/lib/validation";

const paymentsOn = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";

type Person = {
  id: string;
  kind: CustomerKind;
  label: string;
};

function placeLabel(group: SignupGroup): string | null {
  if (!group.signupOpen) {
    return "Zapisy zamknięte";
  }
  if (group.capacity > 0 && group.taken >= group.capacity) {
    return "brak miejsc";
  }
  if (group.capacity > 0 && group.taken / group.capacity >= 0.8) {
    return "ostatnie miejsca";
  }
  return null;
}

function canJoin(group: SignupGroup): boolean {
  return group.signupOpen && (group.capacity <= 0 || group.taken < group.capacity);
}

export function EnrollmentForm({
  people,
  groups,
  initialClassId,
  initialPreview,
}: {
  people: Person[];
  groups: SignupGroup[];
  initialClassId: string;
  initialPreview: EnrollmentPreview | null;
}) {
  const [participants, setParticipants] = useState(people);
  const [customerId, setCustomerId] = useState(people[0]?.id ?? "");
  const [classId, setClassId] = useState(
    groups.some((group) => group.id === initialClassId) ? initialClassId : "",
  );
  const [locationId, setLocationId] = useState<LocationId | "all">(() => {
    const selected = groups.find((group) => group.id === initialClassId);
    return selected && (selected.locationId === "mikolow" || selected.locationId === "lubliniec")
      ? selected.locationId
      : "all";
  });
  const [typeId, setTypeId] = useState("all");
  const [plan, setPlan] = useState<"period" | "prepaid">("period");
  const [loaded, setLoaded] = useState<{
    classId: string;
    customerId: string;
    preview: EnrollmentPreview;
  } | null>(
    initialPreview && initialClassId && people[0]
      ? { classId: initialClassId, customerId: people[0].id, preview: initialPreview }
      : null,
  );
  const [adding, setAdding] = useState<"child" | "pair" | null>(null);
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const types = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      map.set(group.typeId, group.typeName);
    }
    return [...map.entries()];
  }, [groups]);

  const visible = groups.filter((group) => {
    if (locationId !== "all" && group.locationId !== locationId) {
      return false;
    }
    if (typeId !== "all" && group.typeId !== typeId) {
      return false;
    }
    return true;
  });

  const selected = groups.find((group) => group.id === classId) ?? null;

  useEffect(() => {
    if (!customerId || !classId) {
      return;
    }
    let active = true;
    void previewSignup(classId, customerId).then((next) => {
      if (active) {
        setLoaded({ classId, customerId, preview: next });
      }
    });
    return () => {
      active = false;
    };
  }, [classId, customerId]);

  const preview =
    loaded && loaded.classId === classId && loaded.customerId === customerId
      ? loaded.preview
      : null;

  const summary =
    customerId && classId && !preview
      ? "Liczymy kwotę…"
      : preview?.kind === "offer"
      ? preview.billing === "pass4"
        ? preview.passChoice
        : plan === "prepaid"
          ? preview.prepaidSummary
          : preview.periodSummary
      : preview?.kind === "covered" || preview?.kind === "open" || preview?.kind === "unavailable"
        ? preview.message
        : "Wybierz uczestnika i grupę, a policzymy kwotę.";

  const blocked =
    !selected ||
    !customerId ||
    !canJoin(selected) ||
    preview?.kind === "covered" ||
    preview?.kind === "unavailable" ||
    (Boolean(customerId && classId) && !preview) ||
    pending;

  async function submit() {
    if (!selected || !customerId || blocked) {
      return;
    }
    if (!accepted) {
      setError("Zaakceptuj umowę i regulamin zajęć.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          classId: selected.id,
          plan: preview?.kind === "offer" && preview.billing === "monthly" ? plan : "period",
          acceptContract: true,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        checkoutUrl?: string;
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Nie udało się zapisać.");
        return;
      }
      if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
        return;
      }
      setDone(payload.message ?? "Zapis przyjęty.");
    } catch {
      setError("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-cream" role="status">
          {done}
        </p>
        <Button href="/konto" variant="outline">
          Wróć do konta
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg text-cream">Kto</h2>
        {participants.length === 0 ? (
          <p className="text-sm text-muted">Dodaj dziecko albo parę, albo dokończ profil dorosłego.</p>
        ) : (
          <ul className="space-y-2">
            {participants.map((person) => (
              <li key={person.id}>
                <label className="flex min-h-11 items-center gap-3 border border-white/10 bg-black-soft px-3 text-sm text-cream">
                  <input
                    type="radio"
                    name="participant"
                    className="accent-(--gold)"
                    checked={customerId === person.id}
                    onChange={() => setCustomerId(person.id)}
                  />
                  {person.label}
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding("child")}>
            Dodaj dziecko
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding("pair")}>
            Dodaj parę
          </Button>
        </div>
        {adding ? (
          <AddPerson
            kind={adding}
            onCancel={() => setAdding(null)}
            onAdded={(person) => {
              setParticipants((current) => [...current, person]);
              setCustomerId(person.id);
              setAdding(null);
            }}
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg text-cream">Grupa</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-cream">
            Lokalizacja
            <select
              className={`${accountFieldClass} mt-1`}
              value={locationId}
              onChange={(event) => setLocationId(event.target.value as LocationId | "all")}
            >
              <option value="all">Wszystkie</option>
              {site.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.city}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-cream">
            Rodzaj
            <select
              className={`${accountFieldClass} mt-1`}
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
            >
              <option value="all">Wszystkie</option>
              {types.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-muted">Brak grup dla tego filtra.</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {visible.map((group) => {
              const city = site.locations.find((item) => item.id === group.locationId)?.city ?? "";
              const note = placeLabel(group);
              return (
                <li key={group.id}>
                  <label className="flex min-h-11 items-start gap-3 border border-white/10 bg-black-soft px-3 py-2 text-sm text-cream">
                    <input
                      type="radio"
                      name="group"
                      className="mt-1 accent-(--gold)"
                      checked={classId === group.id}
                      onChange={() => {
                        setClassId(group.id);
                        setPlan("period");
                      }}
                    />
                    <span>
                      {group.typeName}
                      {group.level ? ` · ${group.level}` : ""}
                      <span className="mt-1 block text-muted">
                        {city} · {weekdayLongLabel(group.weekday)} {group.startTime}
                        {note ? ` · ${note}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg text-cream">Podsumowanie</h2>
        <p className="text-sm leading-relaxed text-cream">{summary}</p>
        {preview?.kind === "offer" && preview.billing === "monthly" && preview.prepaidChoice ? (
          <div className="space-y-2">
            <label className="flex min-h-11 items-center gap-3 text-sm text-cream">
              <input
                type="radio"
                name="plan"
                className="accent-(--gold)"
                checked={plan === "period"}
                onChange={() => setPlan("period")}
              />
              Ten okres
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-cream">
              <input
                type="radio"
                name="plan"
                className="accent-(--gold)"
                checked={plan === "prepaid"}
                onChange={() => setPlan("prepaid")}
              />
              {preview.prepaidChoice}
            </label>
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-[#E8A0A0]" role="alert">
            {error}
          </p>
        ) : null}
        {preview?.kind !== "covered" ? (
          <>
            <ContractConsent
              checked={accepted}
              onChange={(event) => {
                setAccepted(event.target.checked);
                setError("");
              }}
            />
            <Button type="button" className="min-h-11 w-full" disabled={blocked} onClick={() => void submit()}>
              {pending
                ? "Chwila…"
                : paymentsOn
                  ? "Zapisz się i zapłać"
                  : "Zapisz się — zapłacę na sali"}
            </Button>
            <p className="text-sm text-muted">Miejsce trzymamy przez 72 godziny.</p>
          </>
        ) : null}
      </section>
    </div>
  );
}

function AddPerson({
  kind,
  onCancel,
  onAdded,
}: {
  kind: "child" | "pair";
  onCancel: () => void;
  onAdded: (person: Person) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [partnerFirstName, setPartnerFirstName] = useState("");
  const [partnerLastName, setPartnerLastName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    setError("");
    const parsed =
      kind === "child"
        ? childParticipantSchema.safeParse({ firstName, lastName })
        : pairParticipantSchema.safeParse({
            firstName,
            lastName,
            partnerFirstName,
            partnerLastName,
          });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Sprawdź imiona.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const values = parsed.data;
    const { data, error: rpcError } = await supabase.rpc("add_participant", {
      p_kind: kind,
      p_first_name: values.firstName,
      p_last_name: values.lastName,
      p_partner_first_name: "partnerFirstName" in values ? values.partnerFirstName : null,
      p_partner_last_name: "partnerLastName" in values ? values.partnerLastName : null,
    });
    setPending(false);
    if (rpcError || typeof data !== "string") {
      setError(participantRpcMessage(rpcError?.message ?? ""));
      return;
    }
    const label =
      kind === "pair"
        ? `${values.firstName} ${values.lastName} i ${"partnerFirstName" in values ? values.partnerFirstName : ""} ${"partnerLastName" in values ? values.partnerLastName : ""}`.trim()
        : `${values.firstName} ${values.lastName}`;
    onAdded({ id: data, kind, label });
  }

  return (
    <div className="space-y-3 border border-white/10 bg-black-soft p-4">
      <AccountField label={kind === "child" ? "Imię dziecka" : "Imię"} htmlFor="enroll-first">
        <input
          id="enroll-first"
          className={accountFieldClass}
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
      </AccountField>
      <AccountField label="Nazwisko" htmlFor="enroll-last">
        <input
          id="enroll-last"
          className={accountFieldClass}
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
      </AccountField>
      {kind === "pair" ? (
        <>
          <AccountField label="Imię partnera lub partnerki" htmlFor="enroll-partner-first">
            <input
              id="enroll-partner-first"
              className={accountFieldClass}
              value={partnerFirstName}
              onChange={(event) => setPartnerFirstName(event.target.value)}
            />
          </AccountField>
          <AccountField label="Nazwisko partnera lub partnerki" htmlFor="enroll-partner-last">
            <input
              id="enroll-partner-last"
              className={accountFieldClass}
              value={partnerLastName}
              onChange={(event) => setPartnerLastName(event.target.value)}
            />
          </AccountField>
        </>
      ) : null}
      {error ? (
        <p className="text-sm text-[#E8A0A0]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => void save()}>
          {pending ? "Zapis…" : kind === "child" ? "Dodaj dziecko" : "Dodaj parę"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Anuluj
        </Button>
      </div>
    </div>
  );
}
