export type LocationId = "mikolow" | "lubliniec";

export type BookingKind = "slot" | "class" | "event";
export type SlotStatus = "open" | "booked" | "blocked";
export type BookingStatus = "pending" | "confirmed" | "cancelled";
export type PaymentOption = "onsite" | "reservation" | "full";
export type PaymentStatus = "not_required" | "pending" | "paid" | "refunded";

export type LocationRow = {
  id: LocationId | string;
  name: string;
  address: string;
  maps_url: string | null;
};

export type ClassTypeRow = {
  id: string;
  slug: string;
  name: string;
  is_pair: boolean;
  color: string;
};

export type RecurringClassRow = {
  id: string;
  location_id: string;
  class_type_id: string;
  weekday: number;
  start_time: string;
  duration_min: number;
  level: string | null;
  capacity: number;
  signup_open: boolean;
  active: boolean;
};

export type SlotRow = {
  id: string;
  location_id: string;
  starts_at: string;
  ends_at: string;
  status: SlotStatus;
  admin_note: string | null;
  created_at: string;
};

export type EventRow = {
  id: string;
  location_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  signup_open: boolean;
  published: boolean;
};

export type BookingRow = {
  id: string;
  kind: BookingKind;
  slot_id: string | null;
  recurring_class_id: string | null;
  event_id: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  message: string | null;
  dance_type: string | null;
  status: BookingStatus;
  payment_option: PaymentOption;
  payment_status: PaymentStatus;
  stripe_checkout_session_id: string | null;
  amount_cents: number | null;
  consent_rodo: boolean;
  created_at: string;
};

export type AdminRow = {
  user_id: string;
};

/** Public calendar: initial + dance_type only — never PII. */
export type PublicCalendarRow = {
  id: string;
  kind: "slot";
  location_id: string;
  starts_at: string;
  ends_at: string;
  status: Extract<SlotStatus, "open" | "booked">;
  initial: string | null;
  dance_type: string | null;
};

export type ClassOccupancyRow = {
  recurring_class_id: string;
  taken: number;
  capacity: number;
};

export type CreateBookingArgs = {
  p_kind: BookingKind;
  p_target_id: string;
  p_first_name: string;
  p_last_name: string;
  p_phone: string;
  p_email: string;
  p_message: string | null;
  p_dance_type: string | null;
  p_payment_option: PaymentOption | null;
  p_consent: boolean;
};
