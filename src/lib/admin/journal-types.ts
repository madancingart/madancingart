import type { LocationId } from "@/content/site";
import type { ClassSessionStatus, CustomerKind } from "@/lib/types";

export type JournalClassOption = {
  id: string;
  locationId: LocationId;
  locationCity: string;
  name: string;
  weekday: number;
  startTime: string;
  level: string | null;
};

export type JournalPerson = {
  key: string;
  customerId: string | null;
  bookingId: string | null;
  firstName: string;
  lastName: string | null;
  customerKind: CustomerKind | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  guardianName: string | null;
  dropIn: boolean;
  present: boolean;
  unpaid: boolean;
  remainingLabel: string | null;
};

export type JournalData = {
  classId: string;
  className: string;
  locationCity: string;
  weekday: number;
  startTime: string;
  level: string | null;
  sessionId: string;
  sessionDate: string;
  sessionStatus: ClassSessionStatus;
  cancelReason: string | null;
  people: JournalPerson[];
};
