"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  deletePriceItem,
  savePriceItem,
  setPriceItemActive,
} from "@/app/admin/(app)/cennik/actions";
import type { LocatedPriceItem, PriceBilling, PriceUnit } from "@/content/pricing";
import type { LocationId } from "@/content/site";
import { formatPlnFromCents } from "@/lib/money";

const UNITS: PriceUnit[] = ["os/mies", "para/mies", "os", "para", "h", "pakiet"];
const BILLINGS: { id: PriceBilling; label: string }[] = [
  { id: "monthly", label: "Miesięcznie" },
  { id: "pass4", label: "Karnet 4" },
  { id: "one-off", label: "Jednorazowo / ręcznie" },
];

type Draft = {
  id?: string;
  locationId: LocationId;
  section: string;
  label: string;
  detail: string;
  amountZl: string;
  unit: PriceUnit;
  note: string;
  billing: PriceBilling;
  sortOrder: number;
  active: boolean;
};

function emptyDraft(locationId: LocationId): Draft {
  return {
    locationId,
    section: "",
    label: "",
    detail: "",
    amountZl: "",
    unit: "os/mies",
    note: "",
    billing: "monthly",
    sortOrder: 0,
    active: true,
  };
}

function fromItem(item: LocatedPriceItem): Draft {
  return {
    id: item.id,
    locationId: item.locationId,
    section: item.section,
    label: item.label,
    detail: item.detail ?? "",
    amountZl: (item.amountCents / 100).toFixed(2),
    unit: item.unit,
    note: item.note ?? "",
    billing: item.billing,
    sortOrder: 0,
    active: true,
  };
}

export function PricingManager({
  items,
}: {
  items: (LocatedPriceItem & { active?: boolean })[];
}) {
  const router = useRouter();
  const [locationId, setLocationId] = useState<LocationId>("mikolow");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visible = useMemo(
    () => items.filter((item) => item.locationId === locationId),
    [items, locationId],
  );

  async function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setPending(true);
    const result = await action();
    setPending(false);
    setMessage(result.ok ? (result.message ?? "OK") : (result.error ?? "Błąd"));
    if (result.ok) {
      setDraft(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {(["mikolow", "lubliniec"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setLocationId(id)}
            className={`min-h-11 border px-3 text-[13px] ${
              locationId === id
                ? "border-gold bg-gold/10 text-gold"
                : "border-white/10 text-cream"
            }`}
          >
            {id === "mikolow" ? "Mikołów" : "Lubliniec"}
          </button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setDraft(emptyDraft(locationId))}
        >
          Dodaj pozycję
        </Button>
      </div>

      {message ? <p className="text-[13px] text-muted">{message}</p> : null}

      {draft ? (
        <form
          className="grid gap-3 border border-white/10 bg-black-soft p-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              savePriceItem({
                id: draft.id,
                locationId: draft.locationId,
                section: draft.section,
                label: draft.label,
                detail: draft.detail,
                amountZl: Number(draft.amountZl.replace(",", ".")),
                unit: draft.unit,
                note: draft.note,
                billing: draft.billing,
                sortOrder: draft.sortOrder,
                active: draft.active,
              }),
            );
          }}
        >
          <p className="md:col-span-2 text-[15px] font-semibold text-cream">
            {draft.id ? `Edycja: ${draft.id}` : "Nowa pozycja"}
          </p>
          <label className="text-[13px] text-muted">
            Sekcja
            <input
              required
              value={draft.section}
              onChange={(event) => setDraft({ ...draft, section: event.target.value })}
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            />
          </label>
          <label className="text-[13px] text-muted">
            Nazwa
            <input
              required
              value={draft.label}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            />
          </label>
          <label className="text-[13px] text-muted">
            Szczegół
            <input
              value={draft.detail}
              onChange={(event) => setDraft({ ...draft, detail: event.target.value })}
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            />
          </label>
          <label className="text-[13px] text-muted">
            Kwota (zł)
            <input
              required
              inputMode="decimal"
              value={draft.amountZl}
              onChange={(event) => setDraft({ ...draft, amountZl: event.target.value })}
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            />
          </label>
          <label className="text-[13px] text-muted">
            Jednostka
            <select
              value={draft.unit}
              onChange={(event) =>
                setDraft({ ...draft, unit: event.target.value as PriceUnit })
              }
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] text-muted">
            Rozliczenie
            <select
              value={draft.billing}
              onChange={(event) =>
                setDraft({ ...draft, billing: event.target.value as PriceBilling })
              }
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            >
              {BILLINGS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] text-muted md:col-span-2">
            Notatka
            <input
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-[13px] text-cream">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
            />
            Aktywna (widoczna w cenniku i przypisaniach)
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button type="submit" size="sm" disabled={pending}>
              Zapisz
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setDraft(null)}
            >
              Anuluj
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="flex flex-col gap-2">
        {visible.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 border border-white/10 bg-black-soft p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-[12px] text-muted">{item.section}</p>
              <p className="text-[14px] text-cream">
                {item.label}
                {item.detail ? ` · ${item.detail}` : ""}
              </p>
              <p className="text-[13px] text-muted">
                {formatPlnFromCents(item.amountCents)} / {item.unit} · {item.billing}
                {item.active === false ? " · ukryta" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setDraft(fromItem(item))}
              >
                Edytuj
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  void run(() =>
                    setPriceItemActive({
                      id: item.id,
                      active: item.active === false,
                    }),
                  )
                }
              >
                {item.active === false ? "Pokaż" : "Ukryj"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => void run(() => deletePriceItem({ id: item.id }))}
              >
                Usuń
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
