"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/account/panel/StatusPill";
import { Button } from "@/components/ui/Button";
import { CustomerNameLink } from "@/components/admin/CustomerNameLink";
import {
  changeDueAction,
  recordPaymentAction,
  remindNowAction,
  voidChargeAction,
} from "@/app/admin/(app)/rozliczenia/actions";
import { formatBillingZloty, reminderStageLabel } from "@/lib/billing/status";
import { formatDatePl } from "@/lib/datetime";
import type { ChargeListRow } from "@/lib/admin/get-billing";

export function ChargesTable({
  rows,
  payOrigin,
}: {
  rows: ChargeListRow[];
  payOrigin: string;
}) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-muted">Brak należności dla tych filtrów.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-[13px]">
        <thead className="text-[11px] uppercase tracking-wide text-muted">
          <tr>
            <th className="px-2 py-2 font-normal">Uczestnik</th>
            <th className="px-2 py-2 font-normal">Zajęcia</th>
            <th className="px-2 py-2 font-normal">Okres</th>
            <th className="px-2 py-2 font-normal">Kwota</th>
            <th className="px-2 py-2 font-normal">Termin</th>
            <th className="px-2 py-2 font-normal">Status</th>
            <th className="px-2 py-2 font-normal">Przypomnienie</th>
            <th className="px-2 py-2 font-normal">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/10 align-top">
              <td className="px-2 py-3">
                <CustomerNameLink customerId={row.customerId}>{row.customerName}</CustomerNameLink>
              </td>
              <td className="px-2 py-3 text-cream">{row.className}</td>
              <td className="px-2 py-3 text-muted">{row.period ?? "—"}</td>
              <td className="px-2 py-3 text-cream">{formatBillingZloty(row.amountCents)}</td>
              <td className="px-2 py-3 text-cream">{formatDatePl(row.dueDate)}</td>
              <td className="px-2 py-3">
                <StatusPill tone={row.pill.tone} label={row.pill.label} />
              </td>
              <td className="px-2 py-3 text-muted">{reminderStageLabel(row.reminderStage)}</td>
              <td className="px-2 py-3">
                <RowActions row={row} payOrigin={payOrigin} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ row, payOrigin }: { row: ChargeListRow; payOrigin: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<"pay" | "due" | "void" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const link = `${payOrigin}/zaplac/${row.payToken}`;

  async function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setPending(true);
    const result = await action();
    setPending(false);
    setMessage(result.ok ? (result.message ?? "Zapisane.") : (result.error ?? "Nie udało się."));
    if (result.ok) {
      setOpen(null);
      router.refresh();
    }
  }

  if (row.status !== "open") {
    return <span className="text-muted">—</span>;
  }

  return (
    <div className="flex min-w-44 flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setOpen(open === "pay" ? null : "pay")}>
          Odnotuj wpłatę
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => void navigator.clipboard.writeText(link).then(() => setMessage("Link skopiowany."))}
        >
          Kopiuj link do płatności
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => void run(() => remindNowAction(row.id))}
        >
          Wyślij przypomnienie teraz
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(open === "due" ? null : "due")}>
          Zmień termin płatności
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(open === "void" ? null : "void")}>
          Anuluj należność
        </Button>
      </div>
      {open === "pay" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(() =>
              recordPaymentAction({
                chargeId: row.id,
                method: String(form.get("method")),
                paidOn: String(form.get("paidOn")),
              }),
            );
          }}
        >
          <select name="method" className="min-h-9 border border-white/10 bg-black px-2 text-cream">
            <option value="onsite">Gotówka</option>
            <option value="transfer">Przelew</option>
          </select>
          <input name="paidOn" type="date" required className="min-h-9 border border-white/10 bg-black px-2 text-cream" />
          <Button type="submit" size="sm" disabled={pending}>Zapisz</Button>
        </form>
      ) : null}
      {open === "due" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(() => changeDueAction({ chargeId: row.id, dueDate: String(form.get("dueDate")) }));
          }}
        >
          <input name="dueDate" type="date" required defaultValue={row.dueDate} className="min-h-9 border border-white/10 bg-black px-2 text-cream" />
          <Button type="submit" size="sm" disabled={pending}>Zapisz termin</Button>
        </form>
      ) : null}
      {open === "void" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void run(() => voidChargeAction({ chargeId: row.id, reason: String(form.get("reason")) }));
          }}
        >
          <input name="reason" required placeholder="Powód" className="min-h-9 border border-white/10 bg-black px-2 text-cream" />
          <Button type="submit" size="sm" disabled={pending}>Anuluj</Button>
        </form>
      ) : null}
      {message ? <p className="text-[12px] text-muted">{message}</p> : null}
    </div>
  );
}
