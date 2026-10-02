import { addMinutes } from "date-fns";
import { site } from "@/content/site";
import {
  classStartOnDay,
  formatBookingWhen,
  formatDateTimeWarsaw,
  nowInWarsaw,
  toWarsaw,
} from "@/lib/datetime";
import type { AdminBookingListRow } from "@/lib/admin/get-bookings";
import type { BookingKind, BookingStatus, PaymentStatus } from "@/lib/types";

const WEEKDAY_LONG = [
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
] as const;

export function kindLabel(kind: BookingKind): string {
  if (kind === "slot") {
    return "lekcja indywidualna";
  }
  if (kind === "event") {
    return "wydarzenie";
  }
  if (kind === "series") {
    return "kurs";
  }
  return "grupa";
}

export function statusLabel(status: BookingStatus): string {
  if (status === "confirmed") {
    return "potwierdzony";
  }
  if (status === "cancelled") {
    return "anulowany";
  }
  return "oczekuje";
}

export function paymentLabel(status: PaymentStatus): string {
  if (status === "paid") {
    return "opłacone";
  }
  if (status === "pending") {
    return "oczekuje na płatność";
  }
  if (status === "refunded") {
    return "zwrot";
  }
  return "na miejscu";
}

export function locationLabel(locationId: string | null): string {
  if (!locationId) {
    return "ogólne";
  }
  return site.locations.find((item) => item.id === locationId)?.city ?? locationId;
}

export function personLabel(row: AdminBookingListRow): string {
  if (row.lastName) {
    return `${row.firstName} ${row.lastName}`;
  }
  return row.firstName;
}

export function subjectLabel(row: AdminBookingListRow): string {
  const place = locationLabel(row.locationId);
  if (row.kind === "slot" && row.slotStartsAt && row.slotEndsAt) {
    return `${kindLabel("slot")} · ${formatBookingWhen(toWarsaw(row.slotStartsAt), toWarsaw(row.slotEndsAt))} · ${place}`;
  }
  if (row.kind === "event" && row.eventStartsAt && row.eventEndsAt) {
    const title = row.eventTitle ?? "Wydarzenie";
    return `${title} · ${formatBookingWhen(toWarsaw(row.eventStartsAt), toWarsaw(row.eventEndsAt))} · ${place}`;
  }
  if (row.kind === "class") {
    const weekday =
      row.classWeekday && row.classWeekday >= 1 && row.classWeekday <= 7
        ? WEEKDAY_LONG[row.classWeekday - 1]
        : "";
    const start = row.classStartTime
      ? classStartOnDay(nowInWarsaw(), row.classStartTime)
      : null;
    const end =
      start && row.classDurationMin
        ? addMinutes(start, row.classDurationMin)
        : null;
    const clock =
      start && end
        ? `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}–${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`
        : "";
    const name = row.className ?? "Zajęcia";
    return `${name} · cyklicznie ${weekday} ${clock} · ${place}`.replaceAll(
      "  ",
      " ",
    );
  }
  return kindLabel(row.kind);
}

export function createdLabel(iso: string): string {
  return formatDateTimeWarsaw(iso);
}
