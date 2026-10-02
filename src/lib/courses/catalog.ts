import "server-only";

import { cache } from "react";

import { site, type LocationId } from "@/content/site";
import { courseWhenLine } from "@/lib/courses/schedule";
import { toWarsaw } from "@/lib/datetime";
import { isoWeekday } from "@/lib/slot-series";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/server";

export type PublicCourseCard = {
  slug: string;
  title: string;
  locationId: LocationId | null;
  city: string;
  when: string;
  priceCents: number;
  taken: number;
  capacity: number | null;
  freeLabel: string;
};

export type PublicCourseSession = {
  id: string;
  sessionNo: number | null;
  total: number;
  title: string;
  startsAt: string;
  endsAt: string;
  when: string;
  cancelled: boolean;
  canBook: boolean;
  priceCents: number | null;
};

export type PublicCourse = {
  slug: string;
  title: string;
  description: string | null;
  locationId: LocationId | null;
  city: string;
  address: string;
  trainerId: string | null;
  priceCents: number;
  allowSingle: boolean;
  signupOpen: boolean;
  taken: number;
  capacity: number | null;
  freeLabel: string;
  full: boolean;
  sessions: PublicCourseSession[];
};

type SeriesRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  location_id: string | null;
  trainer_id: string | null;
  capacity: number | null;
  price_cents: number;
  allow_single: boolean;
  signup_open: boolean;
};

type EventRow = {
  id: string;
  series_id: string;
  session_no: number | null;
  title: string;
  starts_at: string;
  ends_at: string;
  signup_open: boolean;
  price_cents: number | null;
  cancelled_at: string | null;
};

function warsawDate(iso: string): string {
  const date = toWarsaw(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function warsawTime(iso: string): string {
  const date = toWarsaw(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function locationOf(id: string | null): { id: LocationId | null; city: string; address: string } {
  const location = site.locations.find((item) => item.id === id);
  return {
    id: location?.id ?? null,
    city: location?.city ?? "Sala",
    address: location?.address ?? "",
  };
}

function freeLabel(taken: number, capacity: number | null): string {
  if (capacity === null) {
    return "miejsca bez limitu";
  }
  const left = Math.max(0, capacity - taken);
  if (left === 0) {
    return "brak wolnych miejsc";
  }
  if (left === 1) {
    return "1 wolne miejsce";
  }
  return `${left} wolnych miejsc`;
}

function whenFromEvents(events: EventRow[]): string {
  const active = events.filter((item) => !item.cancelled_at);
  const source = active.length > 0 ? active : events;
  const first = source[0];
  if (!first) {
    return "terminy wkrótce";
  }
  const weekdays = source.map((item) => isoWeekday(warsawDate(item.starts_at)));
  return courseWhenLine({
    count: active.length || events.length,
    weekdays,
    startTime: warsawTime(first.starts_at),
    firstDate: warsawDate(first.starts_at),
  });
}

const loadPublished = cache(async (): Promise<{ series: SeriesRow[]; events: EventRow[]; taken: Map<string, number> } | null> => {
  if (!hasSupabaseEnv()) {
    return { series: [], events: [], taken: new Map() };
  }
  const supabase = createPublicClient();
  const { data: seriesData, error } = await supabase
    .from("event_series")
    .select(
      "id, slug, title, description, location_id, trainer_id, capacity, price_cents, allow_single, signup_open",
    )
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (error || !seriesData) {
    return null;
  }
  const series = seriesData as SeriesRow[];
  const ids = series.map((item) => item.id);
  if (ids.length === 0) {
    return { series, events: [], taken: new Map() };
  }
  const [{ data: eventData, error: eventError }, { data: occupancy }] = await Promise.all([
    supabase
      .from("events")
      .select("id, series_id, session_no, title, starts_at, ends_at, signup_open, price_cents, cancelled_at")
      .in("series_id", ids)
      .eq("published", true)
      .order("starts_at"),
    supabase.from("series_occupancy").select("series_id, taken, capacity").in("series_id", ids),
  ]);
  let events = (eventData ?? []) as EventRow[];
  if (eventError) {
    const fallback = await supabase
      .from("events")
      .select("id, series_id, session_no, title, starts_at, ends_at, signup_open")
      .in("series_id", ids)
      .eq("published", true)
      .order("starts_at");
    if (fallback.error) {
      return null;
    }
    events = ((fallback.data ?? []) as Omit<EventRow, "price_cents" | "cancelled_at">[]).map(
      (row) => ({
        ...row,
        price_cents: null,
        cancelled_at: null,
      }),
    );
  }
  const taken = new Map<string, number>();
  for (const row of (occupancy ?? []) as { series_id: string; taken: number }[]) {
    taken.set(row.series_id, Number(row.taken));
  }
  return { series, events, taken };
});

export async function getPublishedCourseCards(): Promise<PublicCourseCard[]> {
  const loaded = await loadPublished();
  if (!loaded) {
    return [];
  }
  return loaded.series.map((item) => {
    const place = locationOf(item.location_id);
    const events = loaded.events.filter((event) => event.series_id === item.id);
    const seats = loaded.taken.get(item.id) ?? 0;
    return {
      slug: item.slug,
      title: item.title,
      locationId: place.id,
      city: place.city,
      when: whenFromEvents(events),
      priceCents: item.price_cents,
      taken: seats,
      capacity: item.capacity,
      freeLabel: freeLabel(seats, item.capacity),
    };
  });
}

export async function getPublishedCourse(slug: string): Promise<PublicCourse | null> {
  const loaded = await loadPublished();
  if (!loaded) {
    return null;
  }
  const item = loaded.series.find((series) => series.slug === slug);
  if (!item) {
    return null;
  }
  const place = locationOf(item.location_id);
  const events = loaded.events.filter((event) => event.series_id === item.id);
  const total = events.length;
  const seats = loaded.taken.get(item.id) ?? 0;
  const now = Date.now();
  return {
    slug: item.slug,
    title: item.title,
    description: item.description,
    locationId: place.id,
    city: place.city,
    address: place.address,
    trainerId: item.trainer_id,
    priceCents: item.price_cents,
    allowSingle: item.allow_single,
    signupOpen: item.signup_open,
    taken: seats,
    capacity: item.capacity,
    freeLabel: freeLabel(seats, item.capacity),
    full: item.capacity !== null && seats >= item.capacity,
    sessions: events.map((event) => ({
      id: event.id,
      sessionNo: event.session_no,
      total,
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      when: `${warsawDate(event.starts_at).split("-").reverse().join(".")} ${warsawTime(event.starts_at)}`,
      cancelled: Boolean(event.cancelled_at),
      canBook:
        item.allow_single &&
        item.signup_open &&
        event.signup_open &&
        !event.cancelled_at &&
        event.price_cents !== null &&
        event.price_cents > 0 &&
        new Date(event.starts_at).getTime() > now &&
        place.id !== null,
      priceCents: event.price_cents,
    })),
  };
}

export async function publishedCourseSlugs(): Promise<string[]> {
  const loaded = await loadPublished();
  return loaded?.series.map((item) => item.slug) ?? [];
}
