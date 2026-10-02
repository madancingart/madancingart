import type { BookingKind, LocationId } from "@/lib/types";

export type ScheduleClass = {
  id: string;
  locationId: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  name: string;
  level: string | null;
  signupOpen: boolean;
  taken: number;
  capacity: number;
  trainerId: string | null;
  isPair: boolean;
  slug: string;
  cancelledDates: string[];
};

export type ScheduleSlot = {
  id: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  status: "open" | "booked";
  initial: string | null;
  danceType: string | null;
  trainerId: string | null;
};

export type ScheduleEvent = {
  id: string;
  locationId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  signupOpen: boolean;
  sessionLabel: string | null;
  cancelled: boolean;
};

export type ScheduleData = {
  classes: ScheduleClass[];
  slots: ScheduleSlot[];
  events: ScheduleEvent[];
};

export type BookingTarget = {
  kind: BookingKind;
  id: string;
  title: string;
  meta: string;
  locationId: LocationId;
  startsAt: string;
  endsAt: string;
  classSlug?: string | null;
  isPair?: boolean;
};
