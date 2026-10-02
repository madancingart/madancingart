"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ClassPriceField } from "@/components/admin/ClassPriceField";
import { Button } from "@/components/ui/Button";
import { telHref } from "@/lib/contact";
import { formatDatePl, formatDateTimeWarsaw } from "@/lib/datetime";
import type { AdminBooking, AdminClass, AdminSlot, AdminTrainer } from "@/lib/admin/calendar-types";
import { GroupMembersList } from "@/components/admin/GroupMembersList";
import { CustomerNameLink } from "@/components/admin/CustomerNameLink";
import { TrainerSelect } from "@/components/admin/TrainerSelect";
import type { BookingStatus, PaymentStatus } from "@/lib/types";
import { trainerShortName, UNASSIGNED_TRAINER_LABEL } from "@/lib/trainers";
import {
  blockSlot,
  cancelBooking,
  confirmBooking,
  deleteSlot,
  markBookingConfirmedByPhone,
  resendConfirmationReminder,
  unblockSlot,
  updateClassSettings,
  updateSlotTrainer,
} from "@/app/admin/(app)/kalendarz/actions";
import type { ActionResult } from "@/app/admin/(app)/kalendarz/actions";
import { MoveBookingModal } from "@/components/admin/MoveBookingModal";
import { CancelClassOccurrenceForm } from "@/components/admin/CancelClassOccurrenceForm";
import {
  attachBookingToPackage,
  listActivePackagesForCustomer,
  type CustomerPackageOption,
} from "@/app/admin/(app)/pakiety/actions";

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
  run: (notifyClient?: boolean) => Promise<ActionResult>;
  notifyOption?: boolean;
};

type CalendarDrawerProps = {
  open: boolean;
  target: { kind: "class"; item: AdminClass } | { kind: "slot"; item: AdminSlot } | null;
  sessionDateIso?: string | null;
  trainers: AdminTrainer[];
  onClose: () => void;
  onDone: (result: ActionResult, closeDrawer?: boolean) => void;
};

export function CalendarDrawer({
  open,
  target,
  sessionDateIso = null,
  trainers,
  onClose,
  onDone,
}: CalendarDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [pending, setPending] = useState(false);
  const [notifyClient, setNotifyClient] = useState(true);
  const [moving, setMoving] = useState(false);

  function closeDrawer() {
    setConfirm(null);
    setMoving(false);
    onClose();
  }

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

  async function run(
    action: () => Promise<ActionResult>,
    closeDrawer = false,
  ) {
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
            closeDrawer();
          }
        }}
        onClick={(event) => {
          if (event.target === ref.current && !pending) {
            closeDrawer();
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
              onClick={closeDrawer}
              className="flex size-11 items-center justify-center text-cream"
              aria-label="Zamknij panel"
            >
              <X strokeWidth={1.5} className="size-5" />
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto px-4 py-4">
            {target?.kind === "class" ? (
              <ClassPanel
                key={target.item.id}
                item={target.item}
                sessionDateIso={sessionDateIso}
                trainers={trainers}
                pending={pending}
                onToggleSignup={() =>
                  run(() =>
                    updateClassSettings({
                      classId: target.item.id,
                      signupOpen: !target.item.signupOpen,
                      capacity: target.item.capacity,
                      trainerId: target.item.trainerId ?? "",
                      priceItemId: target.item.priceItemId ?? "",
                    }),
                  )
                }
                onSaveCapacity={(nextCapacity) =>
                  run(() =>
                    updateClassSettings({
                      classId: target.item.id,
                      signupOpen: target.item.signupOpen,
                      capacity: nextCapacity,
                      trainerId: target.item.trainerId ?? "",
                      priceItemId: target.item.priceItemId ?? "",
                    }),
                  )
                }
                onSaveTrainer={(trainerId) =>
                  run(() =>
                    updateClassSettings({
                      classId: target.item.id,
                      signupOpen: target.item.signupOpen,
                      capacity: target.item.capacity,
                      trainerId,
                      priceItemId: target.item.priceItemId ?? "",
                    }),
                  )
                }
                onSavePrice={(priceItemId) =>
                  run(() =>
                    updateClassSettings({
                      classId: target.item.id,
                      signupOpen: target.item.signupOpen,
                      capacity: target.item.capacity,
                      trainerId: target.item.trainerId ?? "",
                      priceItemId,
                    }),
                  )
                }
                onCancelOccurrenceDone={(message) => {
                  void run(async () => ({ ok: true, message }));
                }}
                onCancelOccurrenceError={(message) => {
                  void run(async () => ({ ok: false, error: message }));
                }}
              />
            ) : null}

            {target?.kind === "slot" ? (
              <SlotPanel
                key={target.item.id}
                item={target.item}
                trainers={trainers}
                pending={pending}
                onSaveTrainer={(trainerId) =>
                  run(() =>
                    updateSlotTrainer({
                      slotId: target.item.id,
                      trainerId,
                    }),
                  )
                }
                onConfirm={(booking) =>
                  run(() => confirmBooking({ bookingId: booking.id }))
                }
                onMarkConfirmed={(booking) =>
                  run(() =>
                    markBookingConfirmedByPhone({ bookingId: booking.id }),
                  )
                }
                onResendReminder={(booking) =>
                  run(() =>
                    resendConfirmationReminder({ bookingId: booking.id }),
                  )
                }
                onCancelBooking={(booking) => {
                  setNotifyClient(true);
                  setConfirm({
                    title: "Anulować rezerwację?",
                    body: "Zapis zostanie anulowany, a termin wróci jako wolny na stronie publicznej.",
                    confirmLabel: "Anuluj rezerwację",
                    notifyOption: Boolean(booking.email),
                    run: (notify) =>
                      cancelBooking({
                        bookingId: booking.id,
                        notifyClient: Boolean(notify),
                      }),
                  });
                }}
                onMove={() => setMoving(true)}
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
                onPackageResult={(result) => {
                  void run(async () => result);
                }}
              />
            ) : null}

            {confirm ? (
              <div className="absolute inset-0 z-20 flex items-end bg-black/80 p-4 sm:items-center">
                <div className="w-full border border-white/10 bg-black-soft p-4">
                  <h3 className="text-[15px] font-semibold text-cream">
                    {confirm.title}
                  </h3>
                  <p className="mt-2 text-[14px] text-muted">{confirm.body}</p>
                  {confirm.notifyOption ? (
                    <label className="mt-3 flex min-h-11 items-center gap-2 text-[13px] text-cream">
                      <input
                        type="checkbox"
                        checked={notifyClient}
                        onChange={(event) =>
                          setNotifyClient(event.target.checked)
                        }
                      />
                      Wyślij mail do klienta (przeprosiny i link do grafiku)
                    </label>
                  ) : null}
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setConfirm(null)}
                    >
                      Wróć
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        void run(
                          () => confirm.run(notifyClient),
                          confirm.confirmLabel === "Usuń slot",
                        );
                      }}
                    >
                      {confirm.confirmLabel}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </dialog>
      {moving && target?.kind === "slot" && target.item.booking ? (
        <MoveBookingModal
          bookingId={target.item.booking.id}
          fromStartsAt={target.item.startsAt}
          fromLocationId={target.item.locationId}
          fromTrainerId={target.item.trainerId}
          trainers={trainers}
          onClose={() => setMoving(false)}
          onDone={(message) => {
            setMoving(false);
            void run(async () => ({ ok: true, message }), true);
          }}
          onError={(message) => {
            void run(async () => ({ ok: false, error: message }));
          }}
        />
      ) : null}
    </>
  );
}

function ClassPanel({
  item,
  sessionDateIso,
  trainers,
  pending,
  onToggleSignup,
  onSaveCapacity,
  onSaveTrainer,
  onSavePrice,
  onCancelOccurrenceDone,
  onCancelOccurrenceError,
}: {
  item: AdminClass;
  sessionDateIso: string | null;
  trainers: AdminTrainer[];
  pending: boolean;
  onToggleSignup: () => void;
  onSaveCapacity: (capacity: number) => void;
  onSaveTrainer: (trainerId: string) => void;
  onSavePrice: (priceItemId: string) => void;
  onCancelOccurrenceDone: (message: string) => void;
  onCancelOccurrenceError: (message: string) => void;
}) {
  const [capacity, setCapacity] = useState(item.capacity);
  const cancelled =
    Boolean(sessionDateIso) && item.cancelledDates.includes(sessionDateIso ?? "");
  const journalHref = sessionDateIso
    ? `/admin/ewidencja?grupa=${item.id}&data=${sessionDateIso}`
    : `/admin/ewidencja?grupa=${item.id}`;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-muted">
        {item.level ? `${item.level} · ` : ""}
        obłożenie {item.taken}/{item.capacity}
      </p>
      {cancelled ? (
        <p className="text-[13px] text-muted">To wystąpienie jest odwołane.</p>
      ) : sessionDateIso ? (
        <CancelClassOccurrenceForm
          classId={item.id}
          sessionDate={sessionDateIso}
          onDone={onCancelOccurrenceDone}
          onError={onCancelOccurrenceError}
        />
      ) : null}
      <Link
        href={journalHref}
        className="text-[13px] text-gold hover:text-gold-light"
      >
        Dziennik zajęć
      </Link>

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
        Prowadzący
        <TrainerSelect
          value={item.trainerId ?? ""}
          trainers={trainers}
          disabled={pending}
          onChange={onSaveTrainer}
        />
      </label>

      <ClassPriceField
        locationId={item.locationId}
        value={item.priceItemId}
        disabled={pending}
        onChange={onSavePrice}
      />

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
            onClick={() => onSaveCapacity(capacity)}
          >
            Zapisz
          </Button>
        </span>
      </label>

      <GroupMembersList classId={item.id} members={item.members} />
    </div>
  );
}

function SlotPanel({
  item,
  trainers,
  pending,
  onSaveTrainer,
  onConfirm,
  onMarkConfirmed,
  onResendReminder,
  onCancelBooking,
  onMove,
  onBlock,
  onUnblock,
  onDelete,
  onPackageResult,
}: {
  item: AdminSlot;
  trainers: AdminTrainer[];
  pending: boolean;
  onSaveTrainer: (trainerId: string) => void;
  onConfirm: (booking: AdminBooking) => void;
  onMarkConfirmed: (booking: AdminBooking) => void;
  onResendReminder: (booking: AdminBooking) => void;
  onCancelBooking: (booking: AdminBooking) => void;
  onMove: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onDelete: () => void;
  onPackageResult: (result: ActionResult) => void;
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
        {" · "}
        {trainerShortName(item.trainerId) ?? UNASSIGNED_TRAINER_LABEL}
      </p>

      <label className="text-[13px] text-muted">
        Prowadzący
        <TrainerSelect
          value={item.trainerId ?? ""}
          trainers={trainers}
          disabled={pending}
          onChange={onSaveTrainer}
        />
      </label>

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
          <BookingPackageBlock
            booking={booking}
            pending={pending}
            onAttached={onPackageResult}
          />
          <p className="mt-2 text-[13px] text-muted">
            {paymentLabel(booking.paymentStatus)}
            {booking.confirmedAt
              ? " · potwierdzony"
              : booking.status !== "cancelled"
                ? " · czeka na potwierdzenie"
                : ""}
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
            {!booking.confirmedAt && booking.status !== "cancelled" ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => onMarkConfirmed(booking)}
              >
                Oznacz jako potwierdzone (tel.)
              </Button>
            ) : null}
            {!booking.confirmedAt && booking.status !== "cancelled" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onResendReminder(booking)}
              >
                Wyślij ponownie prośbę o potwierdzenie
              </Button>
            ) : null}
            {booking.status !== "cancelled" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={onMove}
              >
                Przenieś na inny termin
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
  const childPhone = booking.guardianPhone ?? booking.phone;
  const email = booking.email;
  const isPair =
    booking.customerKind === "pair" ||
    Boolean(booking.partnerFirstName || booking.partnerLastName);
  const isChild =
    booking.customerKind === "child" || Boolean(booking.guardianName);

  const firstLabel = [booking.firstName, booking.lastName]
    .filter(Boolean)
    .join(" ");
  const partnerLabel = [booking.partnerFirstName, booking.partnerLastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      {isPair ? (
        <>
          <p className="text-[12px] text-muted">Pierwsza osoba</p>
          <p className="text-cream">
            <CustomerNameLink customerId={booking.customerId}>
              {firstLabel}
            </CustomerNameLink>
          </p>
          <p className="mt-2 text-[12px] text-muted">Druga osoba</p>
          <p className="text-cream">
            <CustomerNameLink customerId={booking.customerId}>
              {partnerLabel || "—"}
            </CustomerNameLink>
          </p>
        </>
      ) : isChild ? (
        <>
          <p className="text-[12px] text-muted">Dziecko</p>
          <p className="text-cream">
            <CustomerNameLink customerId={booking.customerId}>
              {firstLabel}
            </CustomerNameLink>
          </p>
          <p className="mt-2 text-[12px] text-muted">Rodzic / opiekun</p>
          <p className="text-cream">{booking.guardianName || "—"}</p>
        </>
      ) : (
        <p className="text-cream">
          <CustomerNameLink customerId={booking.customerId}>
            {firstLabel}
          </CustomerNameLink>
        </p>
      )}
      <p className="mt-1 text-[13px]">
        {isChild ? (
          childPhone ? (
            <a
              href={telHref(childPhone)}
              className="text-gold hover:text-gold-light"
            >
              {childPhone}
            </a>
          ) : (
            <span className="text-muted">brak telefonu rodzica</span>
          )
        ) : booking.phone ? (
          <a
            href={telHref(booking.phone)}
            className="text-gold hover:text-gold-light"
          >
            {booking.phone}
          </a>
        ) : (
          <span className="text-muted">brak telefonu</span>
        )}
        {" · "}
        {email ? (
          <a href={`mailto:${email}`} className="text-gold hover:text-gold-light">
            {email}
          </a>
        ) : (
          <span className="text-muted">brak e-maila</span>
        )}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        {bookingStatusLabel(booking.status)} · zapis{" "}
        {formatDateTimeWarsaw(booking.createdAt)}
      </p>
    </div>
  );
}

function BookingPackageBlock({
  booking,
  pending,
  onAttached,
}: {
  booking: AdminBooking;
  pending: boolean;
  onAttached: (result: ActionResult) => void;
}) {
  const pkg = booking.weddingPackage;
  const [options, setOptions] = useState<CustomerPackageOption[]>([]);
  const [selected, setSelected] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (pkg || !booking.customerId) {
      return;
    }
    let cancelled = false;
    void listActivePackagesForCustomer(booking.customerId).then((result) => {
      if (cancelled) {
        return;
      }
      setLoaded(true);
      if (result.ok) {
        setOptions(result.packages);
        setSelected(result.packages[0]?.id ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [booking.customerId, pkg]);

  if (pkg) {
    return (
      <div className="mt-3 border-t border-white/10 pt-3 text-[13px]">
        <p className="text-cream">
          Lekcja {booking.lessonNo ?? "—"}
          {pkg.totalLessons != null ? `/${pkg.totalLessons}` : ""} ·{" "}
          <a
            href={`/admin/pakiety/${pkg.id}`}
            className="text-gold hover:text-gold-light"
          >
            {pkg.label}
          </a>
        </p>
        <p className="mt-1 text-muted">
          Wesele: {pkg.weddingDate ? formatDatePl(pkg.weddingDate) : "—"}
        </p>
        {pkg.songs && pkg.songs.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-0.5 text-cream">
            {pkg.songs.map((song) => (
              <li key={song}>{song}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted">Brak piosenek w pakiecie.</p>
        )}
      </div>
    );
  }

  if (!booking.customerId || booking.status === "cancelled") {
    return null;
  }

  if (!loaded || options.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <label className="text-[13px] text-muted">
        Przypnij do pakietu
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-cream"
        >
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
              {item.totalLessons != null
                ? ` (${item.used}/${item.totalLessons})`
                : ""}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        size="sm"
        className="mt-2"
        disabled={pending || !selected}
        onClick={() => {
          void attachBookingToPackage({
            bookingId: booking.id,
            packageId: selected,
          }).then(onAttached);
        }}
      >
        Przypnij do pakietu
      </Button>
    </div>
  );
}
