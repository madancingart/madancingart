"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { recordGroupPayment } from "@/app/admin/(app)/grupy/actions";
import type { LocationId } from "@/content/site";
import { groupPassSuggestions } from "@/lib/group-pricing";
import { addMonthsIso } from "@/lib/slot-series";
import { warsawMonthBounds, warsawTodayIso } from "@/lib/datetime";
import type { GroupPassKind } from "@/lib/membership-status";

type RecordPaymentFormProps = {
  classId: string;
  bookingId: string;
  locationId: LocationId;
  classSlug: string;
  durationMin: number;
  disabled?: boolean;
  onDone: (message: string) => void;
  onError: (message: string) => void;
};

function zlotyFromCents(cents: number | null): string {
  if (cents == null) {
    return "";
  }
  return String(Math.round(cents / 100));
}

export function RecordPaymentForm({
  classId,
  bookingId,
  locationId,
  classSlug,
  durationMin,
  disabled,
  onDone,
  onError,
}: RecordPaymentFormProps) {
  const suggestions = useMemo(
    () => groupPassSuggestions({ locationId, classSlug, durationMin }),
    [locationId, classSlug, durationMin],
  );
  const defaultKind =
    suggestions.find((item) => item.amountCents != null)?.kind ?? "monthly";
  const [kind, setKind] = useState<GroupPassKind>(defaultKind);
  const [amountZloty, setAmountZloty] = useState(() =>
    zlotyFromCents(
      suggestions.find((item) => item.kind === defaultKind)?.amountCents ?? null,
    ),
  );
  const [method, setMethod] = useState<"onsite" | "transfer">("onsite");
  const [pending, setPending] = useState(false);

  const today = warsawTodayIso();
  const month = warsawMonthBounds(today);
  const [validFrom, setValidFrom] = useState(
    defaultKind === "monthly" ? month.from : today,
  );
  const [validUntil, setValidUntil] = useState(
    defaultKind === "monthly" ? month.until : addMonthsIso(today, 3),
  );

  function applyKind(next: GroupPassKind) {
    setKind(next);
    const suggested = suggestions.find((item) => item.kind === next)?.amountCents ?? null;
    setAmountZloty(zlotyFromCents(suggested));
    if (next === "monthly") {
      setValidFrom(month.from);
      setValidUntil(month.until);
    } else {
      setValidFrom(today);
      setValidUntil(addMonthsIso(today, 3));
    }
  }

  async function submit() {
    const amountCents = Math.round(Number.parseFloat(amountZloty.replace(",", ".")) * 100);
    setPending(true);
    const result = await recordGroupPayment({
      bookingId,
      classId,
      kind,
      amountCents,
      paymentMethod: method,
      validFrom,
      validUntil,
    });
    setPending(false);
    if (result.ok) {
      onDone(result.message ?? "Wpłata odnotowana.");
    } else {
      onError(result.error);
    }
  }

  return (
    <form
      className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="text-[12px] text-muted">
        Typ
        <select
          value={kind}
          onChange={(event) => applyKind(event.target.value as GroupPassKind)}
          className="mt-1 min-h-11 w-full border border-white/10 bg-black px-2 text-[13px] text-cream"
        >
          {suggestions.map((item) => (
            <option key={item.kind} value={item.kind}>
              {item.label}
              {item.amountCents != null
                ? ` (${Math.round(item.amountCents / 100)} zł)`
                : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[12px] text-muted">
        Kwota (zł)
        <input
          type="number"
          min={1}
          step={1}
          value={amountZloty}
          onChange={(event) => setAmountZloty(event.target.value)}
          className="mt-1 min-h-11 w-full border border-white/10 bg-black px-2 text-[13px] text-cream"
        />
      </label>
      <label className="text-[12px] text-muted">
        Metoda
        <select
          value={method}
          onChange={(event) =>
            setMethod(event.target.value as "onsite" | "transfer")
          }
          className="mt-1 min-h-11 w-full border border-white/10 bg-black px-2 text-[13px] text-cream"
        >
          <option value="onsite">Gotówka</option>
          <option value="transfer">Przelew</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[12px] text-muted">
          Od
          <input
            type="date"
            value={validFrom}
            onChange={(event) => setValidFrom(event.target.value)}
            className="mt-1 min-h-11 w-full border border-white/10 bg-black px-2 text-[13px] text-cream"
          />
        </label>
        <label className="text-[12px] text-muted">
          Do
          <input
            type="date"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
            className="mt-1 min-h-11 w-full border border-white/10 bg-black px-2 text-[13px] text-cream"
          />
        </label>
      </div>
      <Button type="submit" size="sm" disabled={disabled || pending}>
        Zapisz wpłatę
      </Button>
    </form>
  );
}
