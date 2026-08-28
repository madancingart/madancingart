import { Suspense } from "react";
import { EventsManager } from "@/components/admin/EventsManager";
import { requireAdmin } from "@/lib/admin/require-admin";
import type { EventRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("events")
    .select(
      "id,location_id,title,description,starts_at,ends_at,capacity,signup_open,published",
    )
    .order("starts_at", { ascending: false });

  const events = (data ?? []) as EventRow[];
  const ids = events.map((item) => item.id);
  const taken = new Map<string, number>();

  if (ids.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("event_id,status")
      .in("event_id", ids)
      .neq("status", "cancelled");

    for (const row of bookings ?? []) {
      const eventId = row.event_id as string | null;
      if (!eventId) {
        continue;
      }
      taken.set(eventId, (taken.get(eventId) ?? 0) + 1);
    }
  }

  return (
    <Suspense fallback={<p className="text-muted">Ładowanie…</p>}>
      <EventsManager
      events={events.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        locationId: item.location_id,
        startsAt: item.starts_at,
        endsAt: item.ends_at,
        capacity: item.capacity,
        signupOpen: item.signup_open,
        published: item.published,
        taken: taken.get(item.id) ?? 0,
      }))}
    />
    </Suspense>
  );
}
