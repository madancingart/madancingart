"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/account/panel/StatusPill";
import { CustomerNameLink } from "@/components/admin/CustomerNameLink";
import { Button } from "@/components/ui/Button";
import {
  addToClassAction,
  endEnrollmentAction,
  listMoveTargets,
  pauseEnrollmentAction,
  searchPeopleAction,
  setPaidUntilAction,
  transferEnrollmentAction,
} from "@/app/admin/(app)/rozliczenia/actions";
import type { AdminGroupMember } from "@/lib/admin/calendar-types";
import { telHref } from "@/lib/contact";
import { formatDatePl, warsawTodayIso } from "@/lib/datetime";

export function GroupMembersList({
  classId,
  members,
  showFullLink = true,
}: {
  classId: string;
  members: AdminGroupMember[];
  showFullLink?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  function done(text: string) {
    setMessage(text);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {showFullLink ? (
        <Link href={`/admin/grupy/${classId}`} className="text-[13px] text-gold hover:text-gold-light">
          Pełna lista grupy
        </Link>
      ) : null}
      <AddToClass classId={classId} onDone={done} onError={setMessage} />
      {message ? <p className="text-[12px] text-muted">{message}</p> : null}
      {members.length === 0 ? (
        <p className="text-[13px] text-muted">Brak zapisanych osób.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((member) => (
            <li key={member.key} className="border border-white/10 bg-black-soft p-3">
              <MemberIdentity member={member} />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill tone={member.billing.tone} label={member.billing.label} />
                {member.enrollmentStatus === "paused" ? (
                  <span className="text-[12px] text-muted">przerwa</span>
                ) : null}
                {member.paidUntil ? (
                  <span className="text-[12px] text-muted">opłacone do {formatDatePl(member.paidUntil)}</span>
                ) : null}
              </div>
              <MemberActions classId={classId} member={member} onDone={done} onError={setMessage} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddToClass({
  classId,
  onDone,
  onError,
}: {
  classId: string;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<{ id: string; label: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-col gap-2 border border-white/10 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        void addToClassAction({
          customerId,
          classId,
          skipFirstPayment: form.get("skip") === "on",
        }).then((result) => {
          setPending(false);
          if (result.ok) {
            onDone(result.message);
          } else {
            onError(result.error);
          }
        });
      }}
    >
      <p className="text-[13px] text-cream">Dodaj do grupy</p>
      <input
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          void searchPeopleAction(next).then(setPeople);
        }}
        placeholder="Nazwisko, e-mail albo telefon"
        className="min-h-11 border border-white/10 bg-black px-3 text-cream"
      />
      {people.length > 0 ? (
        <ul className="flex flex-col">
          {people.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="min-h-9 w-full px-2 text-left text-[13px] text-cream hover:text-gold"
                onClick={() => {
                  setCustomerId(person.id);
                  setQuery(person.label);
                  setPeople([]);
                }}
              >
                {person.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label className="flex items-center gap-2 text-[13px] text-muted">
        <input name="skip" type="checkbox" />
        bez pierwszej płatności
      </label>
      <Button type="submit" size="sm" disabled={pending || !customerId}>
        Dodaj
      </Button>
    </form>
  );
}

function MemberActions({
  classId,
  member,
  onDone,
  onError,
}: {
  classId: string;
  member: AdminGroupMember;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState<"pause" | "end" | "move" | "paid" | null>(null);
  const [targets, setTargets] = useState<{ id: string; label: string }[]>([]);
  const [pending, setPending] = useState(false);
  const today = warsawTodayIso();

  async function run(action: Promise<{ ok: boolean; error?: string; message?: string }>) {
    setPending(true);
    const result = await action;
    setPending(false);
    if (result.ok) {
      setOpen(null);
      onDone(result.message ?? "Zapisane.");
    } else {
      onError(result.error ?? "Nie udało się.");
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(open === "pause" ? null : "pause")}>
          Wstrzymaj
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(open === "end" ? null : "end")}>
          Zakończ
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(open === "move" ? null : "move");
            if (targets.length === 0) {
              void listMoveTargets(classId).then(setTargets);
            }
          }}
        >
          Przenieś do innej grupy
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(open === "paid" ? null : "paid")}>
          Ustaw opłacone do
        </Button>
      </div>
      {open === "pause" ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              pauseEnrollmentAction({
                enrollmentId: member.enrollmentId,
                from: String(form.get("from")),
                until: String(form.get("until")),
              }),
            );
          }}
        >
          <input name="from" type="date" required defaultValue={today} className="min-h-9 border border-white/10 bg-black px-2 text-cream" />
          <input name="until" type="date" required className="min-h-9 border border-white/10 bg-black px-2 text-cream" />
          <Button type="submit" size="sm" disabled={pending}>Wstrzymaj</Button>
        </form>
      ) : null}
      {open === "end" ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(endEnrollmentAction({ enrollmentId: member.enrollmentId, endedOn: String(form.get("endedOn")) }));
          }}
        >
          <input name="endedOn" type="date" required defaultValue={today} className="min-h-9 border border-white/10 bg-black px-2 text-cream" />
          <Button type="submit" size="sm" disabled={pending}>Zakończ zapis</Button>
        </form>
      ) : null}
      {open === "move" ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              transferEnrollmentAction({
                enrollmentId: member.enrollmentId,
                targetClassId: String(form.get("target")),
              }),
            );
          }}
        >
          <select name="target" required className="min-h-9 border border-white/10 bg-black px-2 text-cream">
            <option value="">Wybierz grupę</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={pending}>Przenieś</Button>
        </form>
      ) : null}
      {open === "paid" ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(
              setPaidUntilAction({
                enrollmentId: member.enrollmentId,
                until: String(form.get("until")),
                amountZloty: String(form.get("amount")),
                method: String(form.get("method")),
                note: String(form.get("note") ?? ""),
              }),
            );
          }}
        >
          <input name="until" type="date" required className="min-h-9 border border-white/10 bg-black px-2 text-cream" />
          <input name="amount" inputMode="decimal" placeholder="Kwota zł, 0 gdy nieznana" className="min-h-9 border border-white/10 bg-black px-2 text-cream" />
          <select name="method" defaultValue="legacy" className="min-h-9 border border-white/10 bg-black px-2 text-cream">
            <option value="legacy">Metoda nieznana</option>
            <option value="onsite">Gotówka</option>
            <option value="transfer">Przelew</option>
          </select>
          <input name="note" placeholder="Notatka" className="min-h-9 border border-white/10 bg-black px-2 text-cream" />
          <Button type="submit" size="sm" disabled={pending}>Zapisz</Button>
        </form>
      ) : null}
    </div>
  );
}

function MemberIdentity({ member }: { member: AdminGroupMember }) {
  const firstLabel = [member.firstName, member.lastName].filter(Boolean).join(" ");
  const partnerLabel = [member.partnerFirstName, member.partnerLastName].filter(Boolean).join(" ");
  const isPair = member.customerKind === "pair" || Boolean(partnerLabel);
  const isChild = member.customerKind === "child" || Boolean(member.guardianName);
  const phone = isChild ? (member.guardianPhone ?? member.phone) : member.phone;

  return (
    <div>
      {isPair ? (
        <>
          <p className="text-[12px] text-muted">Pierwsza osoba</p>
          <p className="text-cream">
            <CustomerNameLink customerId={member.customerId}>{firstLabel}</CustomerNameLink>
          </p>
          <p className="mt-1 text-[12px] text-muted">Druga osoba</p>
          <p className="text-cream">
            <CustomerNameLink customerId={member.customerId}>{partnerLabel || "—"}</CustomerNameLink>
          </p>
        </>
      ) : isChild ? (
        <>
          <p className="text-[12px] text-muted">Dziecko</p>
          <p className="text-cream">
            <CustomerNameLink customerId={member.customerId}>{firstLabel}</CustomerNameLink>
          </p>
          <p className="mt-1 text-[12px] text-muted">Rodzic / opiekun</p>
          <p className="text-cream">{member.guardianName || "—"}</p>
        </>
      ) : (
        <p className="text-cream">
          <CustomerNameLink customerId={member.customerId}>{firstLabel}</CustomerNameLink>
        </p>
      )}
      <p className="mt-1 text-[13px]">
        {phone ? (
          <a href={telHref(phone)} className="text-gold hover:text-gold-light">
            {phone}
          </a>
        ) : (
          <span className="text-muted">brak telefonu</span>
        )}
        {" · "}
        {member.email ? (
          <a href={`mailto:${member.email}`} className="text-gold hover:text-gold-light">
            {member.email}
          </a>
        ) : (
          <span className="text-muted">brak e-maila</span>
        )}
      </p>
    </div>
  );
}
