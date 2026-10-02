export type LocationId = "mikolow" | "lubliniec";

export type BookingKind = "slot" | "class" | "event" | "series";
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
  trainer_id: string | null;
  price_item_id: string | null;
};

export type SlotRow = {
  id: string;
  location_id: string;
  starts_at: string;
  ends_at: string;
  status: SlotStatus;
  admin_note: string | null;
  created_at: string;
  trainer_id: string | null;
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
  series_id: string | null;
  session_no: number | null;
  price_cents?: number | null;
  cancelled_at?: string | null;
};

export type BookingRow = {
  id: string;
  kind: BookingKind;
  slot_id: string | null;
  recurring_class_id: string | null;
  event_id: string | null;
  series_id: string | null;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  dance_type: string | null;
  status: BookingStatus;
  payment_option: PaymentOption;
  payment_status: PaymentStatus;
  stripe_checkout_session_id: string | null;
  amount_cents: number | null;
  consent_rodo: boolean;
  created_at: string;
  customer_id: string | null;
  package_id: string | null;
  lesson_no: number | null;
  confirm_token: string;
  confirmed_at: string | null;
  reminder_sent_at: string | null;
  rescheduled_from: string | null;
};

export type CustomerKind = "adult" | "pair" | "child";
export type PackageKind =
  | "wedding_single"
  | "wedding_6"
  | "wedding_10"
  | "pass_4"
  | "pass_8"
  | "monthly";
export type PackageStatus =
  | "pending_payment"
  | "active"
  | "completed"
  | "expired"
  | "cancelled";
export type PackagePaymentMethod = "stripe" | "onsite" | "transfer";
export type ClassSessionStatus = "planned" | "done" | "cancelled";

export type TrainerRow = {
  id: string;
  name: string;
  active: boolean;
};

export type CustomerRow = {
  id: string;
  kind: CustomerKind;
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  phone: string | null;
  phone_norm: string;
  email: string | null;
  notes: string | null;
  owner_user_id: string | null;
  created_at: string;
};

export type PackageRow = {
  id: string;
  customer_id: string;
  kind: PackageKind;
  label: string;
  total_lessons: number | null;
  wedding_date: string | null;
  songs: string[] | null;
  recurring_class_id: string | null;
  price_cents: number;
  status: PackageStatus;
  paid_at: string | null;
  payment_method: PackagePaymentMethod | null;
  stripe_checkout_session_id: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
};

export type ClassSessionRow = {
  id: string;
  recurring_class_id: string;
  session_date: string;
  status: ClassSessionStatus;
  note: string | null;
};

export type AttendanceRow = {
  id: string;
  class_session_id: string | null;
  event_id: string | null;
  customer_id: string;
  present: boolean;
  package_id: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  actor_label: string;
  action: string;
  entity: string;
  entity_id: string | null;
  customer_id: string | null;
  details: Record<string, unknown> | null;
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
  trainer_id: string | null;
};

export type ClassOccupancyRow = {
  recurring_class_id: string;
  taken: number;
  capacity: number;
};

export type SeriesOccupancyRow = {
  series_id: string;
  taken: number;
  capacity: number | null;
};

export type AccountProfileRow = {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  interests: string[];
  terms_accepted_at: string;
  created_at: string;
};

export type EnrollmentStatus = "pending" | "active" | "paused" | "ended" | "lapsed";
export type EnrollmentBillingMode = "monthly" | "pass4";
export type EnrollmentSource = "online" | "admin" | "import" | "legacy";

export type EnrollmentRow = {
  id: string;
  customer_id: string;
  recurring_class_id: string;
  status: EnrollmentStatus;
  billing_mode: EnrollmentBillingMode;
  started_on: string;
  billing_start: string;
  paid_until: string | null;
  paused_from: string | null;
  paused_until: string | null;
  ended_on: string | null;
  hold_expires_at: string | null;
  source: EnrollmentSource;
  created_at: string;
};

export type ChargeKind =
  | "first"
  | "monthly"
  | "prepaid"
  | "pass4"
  | "series"
  | "skip"
  | "manual";
export type ChargeStatus = "open" | "paid" | "void";
export type ChargePaymentMethod = "stripe" | "onsite" | "transfer" | "legacy";

export type ChargeRow = {
  id: string;
  customer_id: string;
  enrollment_id: string | null;
  series_booking_id: string | null;
  kind: ChargeKind;
  label: string;
  period_start: string | null;
  period_end: string | null;
  sessions_count: number | null;
  amount_cents: number;
  due_date: string;
  status: ChargeStatus;
  paid_at: string | null;
  payment_method: ChargePaymentMethod | null;
  stripe_checkout_session_id: string | null;
  pay_token: string;
  reminder_stage: number;
  last_reminded_at: string | null;
  note: string | null;
  void_reason: string | null;
  created_by: string;
  created_at: string;
};

export type EventSeriesRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  location_id: string | null;
  trainer_id: string | null;
  capacity: number | null;
  price_cents: number;
  allow_single: boolean;
  single_price_cents: number | null;
  signup_open: boolean;
  published: boolean;
  created_at: string;
};

export type MyParticipantRow = {
  id: string;
  kind: CustomerKind;
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  phone: string | null;
  email: string | null;
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
  p_partner_first_name?: string | null;
  p_partner_last_name?: string | null;
  p_guardian_name?: string | null;
  p_guardian_phone?: string | null;
  p_customer_kind?: CustomerKind;
};

export type UpsertMyProfileArgs = {
  p_first_name: string;
  p_last_name: string;
  p_phone: string;
  p_interests?: string[];
};

export type AddParticipantArgs = {
  p_kind: CustomerKind;
  p_first_name: string;
  p_last_name: string;
  p_partner_first_name?: string | null;
  p_partner_last_name?: string | null;
};

export type UpdateMyParticipantArgs = {
  p_id: string;
  p_first_name: string;
  p_last_name: string;
  p_partner_first_name?: string | null;
  p_partner_last_name?: string | null;
};

export type EnrollInClassArgs = {
  p_customer_id: string;
  p_class_id: string;
};

export type EnrollInClassResult = {
  enrollment_id: string;
  is_new: boolean;
};

export type EnrollInSeriesArgs = {
  p_customer_id: string;
  p_series_id: string;
};

export type EnrollInSeriesResult = {
  booking_id: string;
  is_new: boolean;
};

export type ApplyChargePaymentArgs = {
  p_charge_id: string;
  p_method: ChargePaymentMethod;
  p_stripe_session_id?: string | null;
};

export type FindOrCreateCustomerArgs = {
  p_first_name: string;
  p_last_name: string;
  p_phone: string;
  p_email: string;
  p_kind?: CustomerKind;
  p_partner_first_name?: string | null;
  p_partner_last_name?: string | null;
  p_guardian_name?: string | null;
  p_guardian_phone?: string | null;
};
