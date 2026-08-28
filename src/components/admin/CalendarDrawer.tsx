"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { telHref } from "@/lib/contact";
import { formatDateTimeWarsaw } from "@/lib/datetime";
import type { AdminBooking, AdminClass, AdminSlot } from "@/lib/admin/calendar-types";
import type { BookingStatus, PaymentStatus } from "@/lib/types";
import {
  blockSlot,
  cancelBooking,
  confirmBooking,
  deleteSlot,
  unblockSlot,
  updateClassSettings,
} from "@/app/admin/(app)/kalendarz/actions";
import type { ActionResult } from "@/app/admin/(app)/kalendarz/actions";

function bookingStatusLabel(status: BookingStatus): string {
  if (status === "confirmed") {
    return "potwierdzony";
  }
  if (status === "cancelled") {
    return "anulowany";
  }
  return "oczekuje";
}

function paymentLabel(status: PaymentStatus): string {
  if (status === "paid") {
    return "opłacone";
  }
  if (status === "pending") {
    return "oczekuje na płatność";
  }
  if (status === "refunded") {
    return "zwrot";
  }
  return "płatność na miejscu";
}

type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  run: () => Promise<ActionResult>;
};

type CalendarDrawerProps = {
  open: boolean;
  target: { kind: "class"; item: AdminClass } | { kind: "slot"; item: AdminSlot } | null;
  onClose: () => void;
  onDone: (result: ActionResult, closeDrawer?: boolean) => void;
};

export function CalendarDrawer({
  open,
  target,
  onClose,
  onDone,
}: CalendarDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [pending, setPending] = useState(false);
  const [capacity, setCapacity] = useState(12);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    if (open && !node.open) {
      node.showModal();
    }
    if (!open && node.open) {
      node.close();
    }
  }, [open]);

  useEffect(() => {
    if (target?.kind === "class") {
      setCapacity(target.item.capacity);
    }
  }, [target]);

  async function run(action: () => Promise<ActionResult>, closeDrawer = false) {
    setPending(true);
    const result = await action();
    setPending(false);
    setConfirm(null);
    onDone(result, closeDrawer && result.ok);
  }

  return (
    <>
      <dialog
        ref={ref}
        className="admin-drawer"
        onCancel={(event) => {
          event.preventDefault();
          if (!pending) {
            onClose();
          }
        }}
        onClick={(event) => {
          if (event.target === ref.current && !pending) {
            onClose();
          }
        }}
      >
        <div className="flex h-full w-[min(100vw,28rem)] flex-col border-l border-white/10 bg-black">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-[15px] font-semibold text-cream">
              {target?.kind === "class"
                ? target.item.name
                : "Termin indywidualny"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-11 items-center justify-center text-cream"
              aria-label="Zamknij panel"
            >
              <X strokeWidth={1.5} className="size-5" />
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto px-4 py-4">
            {target?.kind === "class" ? (
              <ClassPanel
                item={target.item}
                capacity={capacity}
                setCapacity={setCapacity}
                pending={pending}
                onToggleSignup={() =>
                  run(() =>
                    updateClassSettings({
                      classId: target.item.id,
                      signupOpen: !target.item.signupOpen,
                      capacity: target.item.capacity,
                    }),
                  )
                }
                onSaveCapacity={() =>
                  run(() =>
                    updateClassSettings({
                      classId: target.item.id,
                      signupOpen: target.item.signupOpen,
                      capacity,
                    }),
                  )
                }
                onConfirm={(booking) =>
                  run(() => confirmBooking({ bookingId: booking.id }))
                }
                onCancel={(booking) =>
                  setConfirm({
                    title: "Anulować zapis?",
                    body: `${booking.firstName} ${booking.lastName} zostanie usunięty z listy grupy.`,
                    confirmLabel: "Anuluj zapis",
                    run: () => cancelBooking({ bookingId: booking.id }),
                  })
                }
              />
            ) : null}

            {target?.kind === "slot" ? (
              <SlotPanel
                item={target.item}
                pending={pending}
                onConfirm={(booking) =>
                  run(() => confirmBooking({ bookingId: booking.id }))
                }
                onCancelBooking={(booking) =>
                  setConfirm({
                    title: "Anulować rezerwację?",
                    body: "Zapis zostanie anulowany, a termin wróci jako wolny na stronie publicznej.",
                    confirmLabel: "Anuluj rezerwację",
                    run: () => cancelBooking({ bookingId: booking.id }),
                  })
                }
                onBlock={() =>
                  setConfirm({
                    title: "Zablokować termin?",
                    body: "Zniknie z publicznego grafiku. Możesz go później odblokować.",
                    confirmLabel: "Zablokuj",
                    run: () => blockSlot({ slotId: target.item.id }),
                  })
                }
                onUnblock={() =>
                  run(() => unblockSlot({ slotId: target.item.id }))
                }
                onDelete={() =>
                  setConfirm({
                    title: "Usunąć termin?",
                    body: "Tej operacji nie da się cofnąć.",
                    confirmLabel: "Usuń slot",
                    run: () => deleteSlot({ slotId: target.item.id }),
                  })
                }
              />
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}

function ClassPanel({
  item,
  capacity,
  setCapacity,
  pending,
  onToggleSignup,
  onSaveCapacity,
  onConfirm,
  onCancel,
}: {
  item: AdminClass;
  capacity: number;
  setCapacity: (value: number) => void;
  pending: boolean;
  onToggleSignup: () => void;
  onSaveCapacity: () => void;
  onConfirm: (booking: AdminBooking) => void;
  onCancel: (booking: AdminBooking) => void;
}) {
  const active = item.bookings.filter((row) => row.status !== "cancelled");

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-muted">
        {item.level ? `${item.level} · ` : ""}
        obłożenie {item.taken}/{item.capacity}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={item.signupOpen ? "outline" : "primary"}
          disabled={pending}
          onClick={onToggleSignup}
        >
          {item.signupOpen ? "Zapisy otwarte" : "Zapisy zamknięte"}
        </Button>
        <p className="text-[12px] text-muted">Klik, aby przełączyć.</p>
      </div>

      <label className="text-[13px] text-muted">
        Pojemność
        <span className="mt-1 flex gap-2">
          <input
            type="number"
            min={1}
            max={80}
            value={capacity}
            onChange={(event) =>
              setCapacity(Number.parseInt(event.target.value, 10) || 1)
            }
            className="min-h-11 w-24 border border-white/10 bg-black px-3 text-cream"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || capacity === item.capacity}
            onClick={onSaveCapacity}
          >
            Zapisz
          </Button>
        </span>
      </label>

      <ul className="flex flex-col gap-3">
        {item.bookings.length === 0 ? (
          <li className="text-[13px] text-muted">Brak zapisanych osób.</li>
        ) : (
          item.bookings.map((booking) => (
            <li
              key={booking.id}
              className="border border-white/10 bg-black-soft p-3"
            >
              <BookingIdentity booking={booking} />
              {booking.status !== "cancelled" &&
              active.some((row) => row.id === booking.id) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {booking.status === "pending" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => onConfirm(booking)}
                    >
                      Potwierdź
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onCancel(booking)}
                  >
                    Anuluj
                  </Button>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function SlotPanel({
  item,
  pending,
  onConfirm,
  onCancelBooking,
  onBlock,
  onUnblock,
  onDelete,
}: {
  item: AdminSlot;
  pending: boolean;
  onConfirm: (booking: AdminBooking) => void;
  onCancelBooking: (booking: AdminBooking) => void;
  onBlock: () => void;
  onUnblock: () => void;
  onDelete: () => void;
}) {
  const booking = item.booking;
  const canDelete = !booking;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Status:{" "}
        <span className="text-cream">
          {item.status === "open"
            ? "wolny"
            : item.status === "booked"
              ? "zajęty"
              : "zablokowany"}
        </span>
      </p>

      {booking ? (
        <div className="border border-white/10 bg-black-soft p-3">
          <BookingIdentity booking={booking} />
          {booking.danceType ? (
            <p className="mt-2 text-[13px] text-cream">
              Taniec: {booking.danceType}
            </p>
          ) : null}
          {booking.message ? (
            <p className="mt-2 text-[13px] text-muted">„{booking.message}”</p>
          ) : null}
          <p className="mt-2 text-[13px] text-muted">
            {paymentLabel(booking.paymentStatus)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {booking.status === "pending" ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => onConfirm(booking)}
              >
                Potwierdź
              </Button>
            ) : null}
            {booking.status !== "cancelled" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onCancelBooking(booking)}
              >
                Anuluj rezerwację
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-muted">Brak rezerwacji na ten slot.</p>
      )}

      {item.adminNote ? (
        <p className="text-[13px] text-muted">Notatka: {item.adminNote}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {item.status === "blocked" ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={onUnblock}
          >
            Odblokuj
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || item.status === "booked"}
            onClick={onBlock}
          >
            Zablokuj termin
          </Button>
        )}
        {canDelete ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={onDelete}
          >
            Usuń slot
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function BookingIdentity({ booking }: { booking: AdminBooking }) {
  return (
    <div>
      <p className="text-cream">
        {booking.firstName} {booking.lastName}
      </p>
      <p className="mt-1 text-[13px]">
        <a href={telHref(booking.phone)} className="text-gold hover:text-gold-light">
          {booking.phone}
        </a>
        {" · "}
        <a
          href={`mailto:${booking.email}`}
          className="text-gold hover:text-gold-light"
        >
          {booking.email}
        </a>
      </p>
      <p className="mt-1 text-[12px] text-muted">
        {bookingStatusLabel(booking.status)} · zapis{" "}
        {formatDateTimeWarsaw(booking.createdAt)}
      </p>
    </div>
  );
}
