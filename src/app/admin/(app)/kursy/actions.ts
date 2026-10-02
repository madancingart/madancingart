"use server";

import { revalidatePath } from "next/cache";
import { addMinutes } from "date-fns";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { site } from "@/content/site";
import { fromDatetimeLocal, formatBookingWhen } from "@/lib/datetime";
import { sendClassSessionCancelledEmails } from "@/lib/email";
import {
  addIsoDays,
  applyCollisions,
  occupiedFromClasses,
  occupiedFromTrainerSlots,
  type SeriesPreviewSlot,
} from "@/lib/slot-series";

export type CourseActionResult = { ok: true; message: string; id?: string } | { ok: false; error: string };

const meetingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const courseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(4000),
  locationId: z.enum(["mikolow", "lubliniec"]),
  trainerId: z.string().trim(),
  capacity: z.string(),
  priceZloty: z.string(),
  allowSingle: z.boolean(),
  singlePriceZloty: z.string(),
  published: z.boolean(),
  meetings: z.array(meetingSchema).min(1).max(24),
});

export async function previewCourseDates(input: unknown): Promise<
  { ok: true; meetings: SeriesPreviewSlot[] } | { ok: false; error: string }
> {
  const parsed = z
    .object({
      locationId: z.enum(["mikolow", "lubliniec"]),
      trainerId: z.string(),
      meetings: z.array(meetingSchema).min(1).max(24),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Uzupełnij daty spotkań." };
  }
  const occupied = await loadOccupied(parsed.data);
  if ("error" in occupied) {
    return { ok: false, error: occupied.error };
  }
  const slots = parsed.data.meetings.map((meeting) => {
    const [startH = 0, startM = 0] = meeting.start.split(":").map(Number);
    const [endH = 0, endM = 0] = meeting.end.split(":").map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    return {
      date: meeting.date,
      weekday: 1,
      startMin,
      endMin,
      start: meeting.start,
      end: meeting.end,
    };
  });
  return { ok: true, meetings: applyCollisions(slots, occupied.intervals) };
}

export async function saveCourse(input: unknown): Promise<CourseActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Sprawdź tytuł, adres, cenę i listę spotkań." };
  }
  const priceCents = zlotyToCents(parsed.data.priceZloty);
  if (priceCents === null || priceCents <= 0) {
    return { ok: false, error: "Podaj cenę całego kursu." };
  }
  const singleCents = parsed.data.allowSingle ? zlotyToCents(parsed.data.singlePriceZloty) : 0;
  if (parsed.data.allowSingle && (singleCents === null || singleCents <= 0)) {
    return { ok: false, error: "Podaj cenę pojedynczego spotkania." };
  }
  const capacity = parsed.data.capacity.trim()
    ? Number.parseInt(parsed.data.capacity, 10)
    : null;
  if (capacity !== null && (!Number.isFinite(capacity) || capacity < 1)) {
    return { ok: false, error: "Limit miejsc musi być liczbą większą od zera." };
  }

  const preview = await previewCourseDates({
    locationId: parsed.data.locationId,
    trainerId: parsed.data.trainerId,
    meetings: parsed.data.meetings,
  });
  if (!preview.ok) {
    return preview;
  }
  if (preview.meetings.some((item) => item.conflict)) {
    return { ok: false, error: "Część spotkań koliduje z grafikiem. Usuń je albo przesuń." };
  }

  const { data: inserted, error } = await supabase
    .from("event_series")
    .insert({
      slug: parsed.data.slug,
      title: parsed.data.title,
      description: parsed.data.description || null,
      location_id: parsed.data.locationId,
      trainer_id: parsed.data.trainerId || null,
      capacity,
      price_cents: priceCents,
      allow_single: parsed.data.allowSingle,
      single_price_cents: parsed.data.allowSingle ? singleCents : null,
      signup_open: parsed.data.published,
      published: parsed.data.published,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return {
      ok: false,
      error: error?.code === "23505" ? "Ten adres kursu jest już zajęty." : "Nie udało się zapisać kursu.",
    };
  }
  const seriesId = (inserted as { id: string }).id;
  const ordered = [...parsed.data.meetings].sort((left, right) =>
    `${left.date}T${left.start}`.localeCompare(`${right.date}T${right.start}`),
  );
  const total = ordered.length;
  const events = ordered.map((meeting, index) => {
    const starts = fromDatetimeLocal(`${meeting.date}T${meeting.start}`);
    const ends = fromDatetimeLocal(`${meeting.date}T${meeting.end}`);
    const sessionNo = index + 1;
    return {
      series_id: seriesId,
      session_no: sessionNo,
      location_id: parsed.data.locationId,
      title: `${parsed.data.title} — spotkanie ${sessionNo}/${total}`,
      description: parsed.data.description || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      capacity,
      signup_open: parsed.data.published && parsed.data.allowSingle,
      published: parsed.data.published,
      price_cents: parsed.data.allowSingle ? singleCents : null,
    };
  });
  const { error: eventsError } = await supabase.from("events").insert(events);
  if (eventsError) {
    await supabase.from("event_series").delete().eq("id", seriesId);
    return { ok: false, error: "Nie udało się zapisać spotkań." };
  }
  revalidatePath("/admin/kursy");
  revalidatePath("/grafik");
  revalidatePath(`/kursy/${parsed.data.slug}`);
  return {
    ok: true,
    id: seriesId,
    message: parsed.data.published ? "Kurs opublikowany." : "Szkic zapisany.",
  };
}

export async function setCourseSignup(input: unknown): Promise<CourseActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = z.object({ seriesId: z.uuid(), open: z.boolean() }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Nie udało się zmienić zapisów." };
  }
  const { error } = await supabase
    .from("event_series")
    .update({ signup_open: parsed.data.open })
    .eq("id", parsed.data.seriesId);
  if (error) {
    return { ok: false, error: "Nie udało się zmienić zapisów." };
  }
  const { data: series } = await supabase
    .from("event_series")
    .select("allow_single, published")
    .eq("id", parsed.data.seriesId)
    .maybeSingle();
  const row = series as { allow_single: boolean; published: boolean } | null;
  if (row?.allow_single) {
    await supabase
      .from("events")
      .update({ signup_open: parsed.data.open && row.published })
      .eq("series_id", parsed.data.seriesId)
      .is("cancelled_at", null);
  }
  revalidatePath("/admin/kursy");
  revalidatePath("/grafik");
  return { ok: true, message: parsed.data.open ? "Zapisy otwarte." : "Zapisy zamknięte." };
}

export async function cancelCourseSession(input: unknown): Promise<CourseActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = z
    .object({ eventId: z.uuid(), reason: z.string().trim().max(300) })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj spotkanie." };
  }
  const { data: event } = await supabase
    .from("events")
    .select("id, title, starts_at, ends_at, location_id, series_id, cancelled_at")
    .eq("id", parsed.data.eventId)
    .maybeSingle();
  const row = event as {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    location_id: string | null;
    series_id: string | null;
    cancelled_at: string | null;
  } | null;
  if (!row || !row.series_id) {
    return { ok: false, error: "Nie znaleziono spotkania." };
  }
  if (row.cancelled_at) {
    return { ok: false, error: "To spotkanie jest już odwołane." };
  }
  const { error } = await supabase
    .from("events")
    .update({
      cancelled_at: new Date().toISOString(),
      cancel_reason: parsed.data.reason || null,
      signup_open: false,
    })
    .eq("id", row.id);
  if (error) {
    return { ok: false, error: "Nie udało się odwołać spotkania." };
  }
  const emails = await participantEmails(supabase, row.series_id, row.id);
  const location = site.locations.find((item) => item.id === row.location_id);
  const notified = await sendClassSessionCancelledEmails({
    emails,
    title: row.title,
    when: formatBookingWhen(new Date(row.starts_at), new Date(row.ends_at)),
    locationLine: [location?.city, location?.address].filter(Boolean).join(", "),
    reason: parsed.data.reason || null,
  });
  revalidatePath("/admin/kursy");
  revalidatePath("/grafik");
  return {
    ok: true,
    message:
      notified > 0
        ? `Spotkanie odwołane. Wysłano ${notified} ${notified === 1 ? "wiadomość" : "wiadomości"}.`
        : "Spotkanie odwołane.",
  };
}

export async function addCourseSession(input: unknown): Promise<CourseActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = z
    .object({
      seriesId: z.uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      start: z.string().regex(/^\d{2}:\d{2}$/),
      durationMin: z.number().int().min(15).max(180),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj datę i godzinę." };
  }
  const { data: series } = await supabase
    .from("event_series")
    .select("id, title, description, location_id, trainer_id, capacity, allow_single, single_price_cents, published, signup_open")
    .eq("id", parsed.data.seriesId)
    .maybeSingle();
  const course = series as {
    id: string;
    title: string;
    description: string | null;
    location_id: string;
    trainer_id: string | null;
    capacity: number | null;
    allow_single: boolean;
    single_price_cents: number | null;
    published: boolean;
    signup_open: boolean;
  } | null;
  if (!course) {
    return { ok: false, error: "Nie znaleziono kursu." };
  }
  const end = formatEnd(parsed.data.start, parsed.data.durationMin);
  const preview = await previewCourseDates({
    locationId: course.location_id,
    trainerId: course.trainer_id ?? "",
    meetings: [{ date: parsed.data.date, start: parsed.data.start, end }],
  });
  if (!preview.ok) {
    return preview;
  }
  if (preview.meetings[0]?.conflict) {
    return { ok: false, error: preview.meetings[0].conflict };
  }
  const { data: existing } = await supabase
    .from("events")
    .select("id, session_no")
    .eq("series_id", course.id);
  const rows = (existing ?? []) as { id: string; session_no: number | null }[];
  const sessionNo = rows.reduce((max, item) => Math.max(max, item.session_no ?? 0), 0) + 1;
  const total = rows.length + 1;
  const starts = fromDatetimeLocal(`${parsed.data.date}T${parsed.data.start}`);
  const ends = addMinutes(starts, parsed.data.durationMin);
  const { error } = await supabase.from("events").insert({
    series_id: course.id,
    session_no: sessionNo,
    location_id: course.location_id,
    title: `${course.title} — spotkanie ${sessionNo}/${total}`,
    description: course.description,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    capacity: course.capacity,
    signup_open: course.published && course.signup_open && course.allow_single,
    published: course.published,
    price_cents: course.allow_single ? course.single_price_cents : null,
  });
  if (error) {
    return { ok: false, error: "Nie udało się dodać spotkania." };
  }
  await renumberSessionTitles(supabase, course.id, course.title);
  revalidatePath(`/admin/kursy/${course.id}`);
  revalidatePath("/grafik");
  return { ok: true, message: "Spotkanie dodane." };
}

export async function toggleCourseAttendance(input: unknown): Promise<CourseActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = z
    .object({ eventId: z.uuid(), customerId: z.uuid(), present: z.boolean() })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Nie udało się zapisać obecności." };
  }
  if (!parsed.data.present) {
    await supabase
      .from("attendance")
      .delete()
      .eq("event_id", parsed.data.eventId)
      .eq("customer_id", parsed.data.customerId);
    return { ok: true, message: "Obecność zdjęta." };
  }
  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("event_id", parsed.data.eventId)
    .eq("customer_id", parsed.data.customerId)
    .maybeSingle();
  if (existing) {
    return { ok: true, message: "Obecność zapisana." };
  }
  const { error } = await supabase.from("attendance").insert({
    event_id: parsed.data.eventId,
    customer_id: parsed.data.customerId,
    present: true,
  });
  if (error) {
    return { ok: false, error: "Nie udało się zapisać obecności." };
  }
  return { ok: true, message: "Obecność zapisana." };
}

async function renumberSessionTitles(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  seriesId: string,
  title: string,
) {
  const { data } = await supabase
    .from("events")
    .select("id, session_no")
    .eq("series_id", seriesId)
    .order("starts_at", { ascending: true });
  const rows = (data ?? []) as { id: string; session_no: number | null }[];
  const total = rows.length;
  await Promise.all(
    rows.map((row, index) =>
      supabase
        .from("events")
        .update({
          session_no: index + 1,
          title: `${title} — spotkanie ${index + 1}/${total}`,
        })
        .eq("id", row.id),
    ),
  );
}

async function participantEmails(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  seriesId: string,
  eventId: string,
): Promise<string[]> {
  const [{ data: seriesBookings }, { data: eventBookings }] = await Promise.all([
    supabase
      .from("bookings")
      .select("email")
      .eq("series_id", seriesId)
      .neq("status", "cancelled"),
    supabase
      .from("bookings")
      .select("email")
      .eq("event_id", eventId)
      .neq("status", "cancelled"),
  ]);
  return [
    ...new Set(
      [...(seriesBookings ?? []), ...(eventBookings ?? [])]
        .map((row) => (row.email as string | null)?.trim().toLowerCase() ?? "")
        .filter((email) => email.includes("@")),
    ),
  ];
}

async function loadOccupied(input: {
  locationId: string;
  trainerId: string;
  meetings: { date: string; start: string; end: string }[];
}): Promise<{ intervals: ReturnType<typeof occupiedFromClasses> } | { error: string }> {
  const dates = input.meetings.map((item) => item.date).sort();
  const fromDate = dates[0];
  const toDate = dates[dates.length - 1];
  if (!fromDate || !toDate) {
    return { error: "Brak dat." };
  }
  const { supabase } = await requireAdmin();
  const from = fromDatetimeLocal(`${fromDate}T00:00`);
  const until = fromDatetimeLocal(`${addIsoDays(toDate, 1)}T00:00`);
  const [classesResult, typesResult, slotsResult, eventsResult] = await Promise.all([
    supabase
      .from("recurring_classes")
      .select("weekday,start_time,duration_min,class_type_id")
      .eq("active", true)
      .eq("location_id", input.locationId),
    supabase.from("class_types").select("id,name"),
    supabase
      .from("slots")
      .select("starts_at,ends_at")
      .eq("location_id", input.locationId)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", until.toISOString()),
    supabase
      .from("events")
      .select("title,starts_at,ends_at")
      .eq("location_id", input.locationId)
      .is("cancelled_at", null)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", until.toISOString()),
  ]);
  if (classesResult.error || slotsResult.error || eventsResult.error) {
    return { error: "Nie udało się sprawdzić kolizji." };
  }
  const types = new Map(
    ((typesResult.data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]),
  );
  const classes = ((classesResult.data ?? []) as {
    weekday: number;
    start_time: string;
    duration_min: number;
    class_type_id: string;
  }[]).map((row) => ({
    weekday: row.weekday,
    startTime: row.start_time,
    durationMin: row.duration_min,
    name: types.get(row.class_type_id) ?? "zajęcia grupowe",
  }));
  const slots = ((slotsResult.data ?? []) as { starts_at: string; ends_at: string }[]).map(
    (row) => ({ startsAt: row.starts_at, endsAt: row.ends_at }),
  );
  const eventBlocks = occupiedFromTrainerSlots(
    ((eventsResult.data ?? []) as { title: string; starts_at: string; ends_at: string }[]).map(
      (row) => ({
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        label: row.title,
      }),
    ),
  );
  void input.trainerId;
  return {
    intervals: [
      ...occupiedFromClasses(classes, fromDate, toDate),
      ...occupiedFromTrainerSlots(slots),
      ...eventBlocks,
    ],
  };
}

function formatEnd(start: string, durationMin: number): string {
  const [hours = 0, minutes = 0] = start.split(":").map(Number);
  const total = hours * 60 + minutes + durationMin;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function zlotyToCents(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole = "0", fraction = ""] = trimmed.split(".");
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0"), 10);
}
