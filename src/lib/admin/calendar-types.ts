import type {
  BookingStatus,
  PaymentStatus,
  SlotStatus,
} from "@/lib/types";

export type AdminBooking = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  message: string | null;
  danceType: string | null;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  slotId: string | null;
  recurringClassId: string | null;
};

export type AdminClass = {
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
  bookings: AdminBooking[];
};

export type AdminSlot = {
  id: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
  adminNote: string | null;
  booking: AdminBooking | null;
};

export type AdminCalendarData = {
  classes: AdminClass[];
  slots: AdminSlot[];
};
