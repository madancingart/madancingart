import type {
  BookingStatus,
  PackageKind,
  PackagePaymentMethod,
  PackageStatus,
  PaymentStatus,
  SlotStatus,
} from "@/lib/types";
import type { MembershipStatus } from "@/lib/membership-status";
import type { LocationId } from "@/content/site";

export type AdminBookingPackage = {
  id: string;
  kind: PackageKind;
  label: string;
  totalLessons: number | null;
  weddingDate: string | null;
  songs: string[] | null;
  status: PackageStatus;
};

export type AdminBooking = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  danceType: string | null;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  slotId: string | null;
  recurringClassId: string | null;
  customerId: string | null;
  customerKind: "adult" | "pair" | "child" | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  packageId: string | null;
  lessonNo: number | null;
  weddingPackage: AdminBookingPackage | null;
};

export type AdminClass = {
  id: string;
  locationId: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  name: string;
  slug: string;
  level: string | null;
  signupOpen: boolean;
  taken: number;
  capacity: number;
  trainerId: string | null;
  bookings: AdminBooking[];
  members: AdminGroupMember[];
  cancelledDates: string[];
};

export type AdminMemberPackage = {
  id: string;
  kind: PackageKind;
  label: string;
  status: PackageStatus;
  validFrom: string | null;
  validUntil: string | null;
  totalLessons: number | null;
  usedEntries: number;
  paidAt: string | null;
  paymentMethod: PackagePaymentMethod | null;
  priceCents: number;
};

export type AdminGroupMember = {
  key: string;
  customerId: string | null;
  bookingIds: string[];
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  customerKind: "adult" | "pair" | "child" | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  bookingStatus: BookingStatus;
  membership: MembershipStatus;
  packages: AdminMemberPackage[];
};

export type AdminGroupDetail = {
  id: string;
  locationId: LocationId;
  weekday: number;
  startTime: string;
  durationMin: number;
  name: string;
  slug: string;
  level: string | null;
  signupOpen: boolean;
  taken: number;
  capacity: number;
  trainerId: string | null;
  bookings: AdminBooking[];
  members: AdminGroupMember[];
};

export type AdminSlot = {
  id: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  status: SlotStatus;
  adminNote: string | null;
  trainerId: string | null;
  booking: AdminBooking | null;
};

export type AdminTrainer = {
  id: string;
  name: string;
  active: boolean;
};

export type AdminCalendarData = {
  classes: AdminClass[];
  slots: AdminSlot[];
  trainers: AdminTrainer[];
};
