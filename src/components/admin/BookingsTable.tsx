"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/admin/Toast";
import { telHref } from "@/lib/contact";
import {
  createdLabel,
  paymentLabel,
  personLabel,
  statusLabel,
  subjectLabel,
} from "@/lib/admin/booking-labels";
import type { AdminBookingListRow } from "@/lib/admin/get-bookings";
import {
  anonymizeBooking,
  cancelBooking,
  confirmBooking,
} from "@/app/admin/(app)/kalendarz/actions";
import type { ActionResult } from "@/app/admin/(app)/kalendarz/actions";

type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  run: () => Promise<ActionResult>;
};

export function BookingsTable({ rows }: { rows: AdminBookingListRow[] }) {
  return (
    <ToastProvider>
      <BookingsTableInner rows={rows} />
    </ToastProvider>
  );
}

function BookingsTableInner({ rows }: { rows: AdminBookingListRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  async function run(action: () => Promise<ActionResult>) {
    setPendingId("busy");
    const result = await action();
    setPendingId(null);
    setConfirm(null);
    if (result.ok) {
      toast.push("ok", "Zapisane.");
      router.refresh();
    } else {
      toast.push("err", result.error);
    }
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[56rem] text-left text-[13px]">
        <thead>
          <tr className="border-b border-white/10 text-muted">
            <th className="px-2 py-2 font-normal">Data zapisu</th>
            <th className="px-2 py-2 font-normal">Osoba</th>
            <th className="px-2 py-2 font-normal">Kontakt</th>
            <th className="px-2 py-2 font-normal">Dotyczy</th>
            <th className="px-2 py-2 font-normal">Status</th>
            <th className="px-2 py-2 font-normal">Płatność</th>
            <th className="px-2 py-2 font-normal">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-white/5 align-top">
              <td className="px-2 py-3 text-muted">{createdLabel(row.createdAt)}</td>
              <td className="px-2 py-3 text-cream">{personLabel(row)}</td>
              <td className="px-2 py-3">
                {row.phone ? (
                  <a
                    href={telHref(row.phone)}
                    className="block text-gold hover:text-gold-light"
                  >
                    {row.phone}
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
                {row.email ? (
                  <a
                    href={`mailto:${row.email}`}
                    className="mt-1 block text-gold hover:text-gold-light"
                  >
                    {row.email}
                  </a>
                ) : null}
              </td>
              <td className="max-w-xs px-2 py-3 text-muted">{subjectLabel(row)}</td>
              <td className="px-2 py-3 text-cream">{statusLabel(row.status)}</td>
              <td className="px-2 py-3 text-muted">
                {paymentLabel(row.paymentStatus)}
              </td>
              <td className="px-2 py-3">
                <div className="flex flex-col gap-1">
                  {row.status === "pending" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={Boolean(pendingId)}
                      onClick={() =>
                        void run(() => confirmBooking({ bookingId: row.id }))
                      }
                    >
                      Potwierdź
                    </Button>
                  ) : null}
                  {row.status !== "cancelled" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(pendingId)}
                      onClick={() =>
                        setConfirm({
                          title: "Anulować zapis?",
                          body: "Status zmieni się na anulowany. Przy lekcji indywidualnej termin wróci jako wolny.",
                          confirmLabel: "Anuluj",
                          run: () => cancelBooking({ bookingId: row.id }),
                        })
                      }
                    >
                      Anuluj
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={Boolean(pendingId) || row.firstName === "Usunięto"}
                    onClick={() =>
                      setConfirm({
                        title: "Usunąć dane osobowe?",
                        body: "Imię, nazwisko, telefon, mail i wiadomość znikną. Wiersz zostanie (zajętość i statystyki).",
                        confirmLabel: "Usuń dane",
                        run: () => anonymizeBooking({ bookingId: row.id }),
                      })
                    }
                  >
                    Usuń dane
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-[min(100%,24rem)] border border-white/10 bg-black-soft p-5">
            <h2 className="text-[16px] font-semibold text-cream">{confirm.title}</h2>
            <p className="mt-2 text-[14px] text-muted">{confirm.body}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirm(null)}
              >
                Wróć
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(pendingId)}
                onClick={() => void run(confirm.run)}
              >
                {confirm.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
