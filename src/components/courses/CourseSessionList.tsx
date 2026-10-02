"use client";

import { useState } from "react";
import { BookingModal } from "@/components/booking/BookingModal";
import { Button } from "@/components/ui/Button";
import { formatBillingZloty } from "@/lib/billing/status";
import type { LocationId } from "@/content/site";
import type { BookingTarget } from "@/lib/schedule/types";

export type CourseSessionView = {
  id: string;
  label: string;
  when: string;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  canBook: boolean;
  priceCents: number | null;
};

export function CourseSessionList({
  title,
  locationId,
  locationLabel,
  sessions,
}: {
  title: string;
  locationId: LocationId;
  locationLabel: string;
  sessions: CourseSessionView[];
}) {
  const [target, setTarget] = useState<BookingTarget | null>(null);

  return (
    <>
      <ol className="flex flex-col gap-3">
        {sessions.map((session) => (
          <li key={session.id} className="border border-white/10 bg-black-soft p-4">
            <p className="text-cream">
              {session.label} · {session.when}
            </p>
            {session.cancelled ? <p className="mt-1 text-sm text-muted">Odwołane</p> : null}
            {session.canBook ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() =>
                  setTarget({
                    kind: "event",
                    id: session.id,
                    title,
                    meta: `${session.when} · ${locationLabel}`,
                    locationId,
                    startsAt: session.startsAt,
                    endsAt: session.endsAt,
                  })
                }
              >
                Tylko to spotkanie
                {session.priceCents ? ` · ${formatBillingZloty(session.priceCents)}` : ""}
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
      {target ? <BookingModal target={target} onClose={() => setTarget(null)} /> : null}
    </>
  );
}
