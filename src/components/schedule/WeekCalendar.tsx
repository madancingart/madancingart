"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMinutes, getISODay, isSameDay } from "date-fns";
import { useState, type ReactNode } from "react";
import { BookingModal } from "@/components/booking/BookingModal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { site, type LocationId } from "@/content/site";
import {
  classStartOnDay,
  formatDayChip,
  formatDayHeader,
  formatTimeRange,
  formatWeekRange,
  toWarsaw,
  warsawTodayIso,
  weekDaysFromIso,
} from "@/lib/datetime";
import { trainerAccent, trainerShortName } from "@/lib/trainers";
import type { BookingTarget } from "@/lib/schedule/types";
import type {
  ScheduleClass,
  ScheduleEvent,
  ScheduleSlot,
} from "@/lib/schedule/types";

const MAX_WEEK_OFFSET = 4;

type WeekCalendarProps = {
  locationId: LocationId;
  nowIso: string;
  classes: ScheduleClass[];
  slots: ScheduleSlot[];
  events: ScheduleEvent[];
};

type DayEntry = {
  sortKey: number;
  node: ReactNode;
};

function cityName(locationId: LocationId): string {
  return (
    site.locations.find((location) => location.id === locationId)?.city ?? ""
  );
}

function isPast(start: Date, now: Date): boolean {
  return start.getTime() < now.getTime();
}

function bookedLabel(slot: ScheduleSlot): string {
  const initial = slot.initial?.trim();
  const dance = slot.danceType?.trim();
  if (initial && dance) {
    return `${initial} — ${dance}`;
  }
  if (initial) {
    return initial;
  }
  if (dance) {
    return dance;
  }
  return "Zajęte";
}

function classStatus(
  item: ScheduleClass,
  start: Date,
  now: Date,
  cancelled: boolean,
) {
  const full = item.taken >= item.capacity;
  const past = isPast(start, now);
  const canSignup = item.signupOpen && !full && !past && !cancelled;
  const lastPlaces =
    canSignup && item.capacity > 0 && item.taken / item.capacity >= 0.8;

  return { canSignup, lastPlaces, cancelled };
}

export function WeekCalendar({
  locationId,
  nowIso,
  classes,
  slots,
  events,
}: WeekCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const today = toWarsaw(nowIso);
    const currentWeek = weekDaysFromIso(nowIso, 0);
    const index = currentWeek.findIndex((day) => isSameDay(day, today));
    return index >= 0 ? index : 0;
  });
  const [target, setTarget] = useState<BookingTarget | null>(null);

  const now = toWarsaw(nowIso);
  const days = weekDaysFromIso(nowIso, weekOffset);
  const weekLabel = formatWeekRange(days[0], days[6]);
  const locationLabel = cityName(locationId);

  function entriesForDay(day: Date): DayEntry[] {
    const isoWeekday = getISODay(day);
    const entries: DayEntry[] = [];

    for (const item of classes) {
      if (item.weekday !== isoWeekday) {
        continue;
      }

      const start = classStartOnDay(day, item.startTime);
      const end = addMinutes(start, item.durationMin);
      const dateIso = warsawTodayIso(day);
      const cancelled = item.cancelledDates.includes(dateIso);
      const status = classStatus(item, start, now, cancelled);
      const lead = trainerShortName(item.trainerId);
      const meta = [formatTimeRange(start, end), locationLabel, item.level]
        .filter(Boolean)
        .join(" · ");

      entries.push({
        sortKey: start.getHours() * 60 + start.getMinutes(),
        node: (
          <article
            className={cn(
              "flex flex-col gap-2 border p-3",
              status.canSignup
                ? "border-white/10 bg-black-soft text-cream"
                : "border-white/5 bg-black/30 text-muted",
            )}
          >
            <p className="font-semibold text-cream">{item.name}</p>
            {item.level ? (
              <p className="text-sm text-muted">{item.level}</p>
            ) : null}
            <p className="text-sm text-muted">
              {formatTimeRange(start, end)}
              {lead ? ` · ${lead}` : ""}
            </p>
            {status.lastPlaces ? (
              <p className="text-xs tracking-wide text-gold">
                Ostatnie miejsca
              </p>
            ) : null}
            {status.cancelled ? (
              <p className="text-sm">Odwołane</p>
            ) : status.canSignup ? (
              <Button
                size="sm"
                className="min-h-11 w-full"
                onClick={() =>
                  setTarget({
                    kind: "class",
                    id: item.id,
                    title: item.name,
                    meta,
                    locationId,
                    startsAt: start.toISOString(),
                    endsAt: end.toISOString(),
                    classSlug: item.slug,
                    isPair: item.isPair,
                  })
                }
              >
                Zapisz się
              </Button>
            ) : (
              <p className="text-sm">Zapisy zamknięte</p>
            )}
          </article>
        ),
      });
    }

    for (const slot of slots) {
      const start = toWarsaw(slot.startsAt);
      if (!isSameDay(start, day)) {
        continue;
      }
      const end = toWarsaw(slot.endsAt);
      const time = formatTimeRange(start, end);
      const lead = trainerShortName(slot.trainerId);
      const accent = trainerAccent(slot.trainerId);
      const timeLine = lead ? `${time} · ${lead}` : time;

      if (slot.status === "open") {
        const title = "Wolny termin";
        const meta = `${time} · lekcja indywidualna · ${locationLabel}`;
        const canBook = !isPast(start, now);
        entries.push({
          sortKey: start.getHours() * 60 + start.getMinutes(),
          node: (
            <article
              className="flex flex-col gap-2 border border-gold bg-black-soft p-3"
              style={accent ? { borderLeftWidth: 3, borderLeftColor: accent } : undefined}
            >
              <p className="font-semibold text-gold">
                Wolny termin — zarezerwuj
              </p>
              <p className="text-sm text-muted">{timeLine}</p>
              {canBook ? (
                <Button
                  size="sm"
                  className="min-h-11 w-full"
                  onClick={() =>
                    setTarget({
                      kind: "slot",
                      id: slot.id,
                      title,
                      meta,
                      locationId,
                      startsAt: start.toISOString(),
                      endsAt: end.toISOString(),
                    })
                  }
                >
                  Zarezerwuj
                </Button>
              ) : (
                <p className="text-sm text-muted">Zapisy zamknięte</p>
              )}
            </article>
          ),
        });
      } else {
        entries.push({
          sortKey: start.getHours() * 60 + start.getMinutes(),
          node: (
            <article
              className="border border-white/5 bg-black/30 p-3 text-muted"
              style={accent ? { borderLeftWidth: 3, borderLeftColor: accent } : undefined}
            >
              <p className="text-sm">{bookedLabel(slot)}</p>
              <p className="mt-1 text-xs">{timeLine}</p>
            </article>
          ),
        });
      }
    }

    for (const event of events) {
      const start = toWarsaw(event.startsAt);
      if (!isSameDay(start, day)) {
        continue;
      }
      const end = toWarsaw(event.endsAt);
      const time = formatTimeRange(start, end);
      const meta = `${time} · ${locationLabel}`;
      const canSignup = event.signupOpen && !isPast(start, now);

      entries.push({
        sortKey: start.getHours() * 60 + start.getMinutes(),
        node: (
          <article className="flex flex-col gap-2 bg-[image:var(--gold-gradient)] p-3 text-black">
            <p className="font-semibold">{event.title}</p>
            <p className="text-sm opacity-80">{time}</p>
            {canSignup ? (
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 w-full border-black text-black hover:bg-black/10"
                onClick={() =>
                  setTarget({
                    kind: "event",
                    id: event.id,
                    title: event.title,
                    meta,
                    locationId,
                    startsAt: start.toISOString(),
                    endsAt: end.toISOString(),
                  })
                }
              >
                Zapisz się
              </Button>
            ) : (
              <p className="text-sm">Zapisy zamknięte</p>
            )}
          </article>
        ),
      });
    }

    return entries.sort((left, right) => left.sortKey - right.sortKey);
  }

  const selectedDay = days[selectedDayIndex] ?? days[0];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setWeekOffset((value) => Math.max(0, value - 1));
            setSelectedDayIndex(0);
          }}
          disabled={weekOffset === 0}
          aria-label="Poprzedni tydzień"
          className="flex size-11 items-center justify-center text-cream disabled:opacity-30"
        >
          <ChevronLeft strokeWidth={1.5} className="size-7" />
        </button>
        <p className="text-center text-cream">
          {weekOffset === 0 ? "Bieżący tydzień" : "Tydzień"}
          <span className="mt-1 block text-sm font-normal text-muted">
            {weekLabel}
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            setWeekOffset((value) => Math.min(MAX_WEEK_OFFSET, value + 1));
            setSelectedDayIndex(0);
          }}
          disabled={weekOffset >= MAX_WEEK_OFFSET}
          aria-label="Następny tydzień"
          className="flex size-11 items-center justify-center text-cream disabled:opacity-30"
        >
          <ChevronRight strokeWidth={1.5} className="size-7" />
        </button>
      </div>

      <div className="mt-6 md:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {days.map((day, index) => {
            const active = index === selectedDayIndex;
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setSelectedDayIndex(index)}
                className={cn(
                  "min-h-11 shrink-0 border px-3 py-2 text-sm whitespace-nowrap",
                  active
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-white/10 text-cream",
                )}
              >
                {formatDayChip(day)}
              </button>
            );
          })}
        </div>
        <DayColumn entries={entriesForDay(selectedDay)} />
      </div>

      <div className="mt-8 hidden grid-cols-7 gap-2 md:grid">
        {days.map((day) => (
          <div key={day.toISOString()} className="min-w-0">
            <p className="mb-3 text-center text-sm text-muted">
              {formatDayHeader(day).weekday}
              <span className="mt-1 block text-cream">
                {formatDayHeader(day).date}
              </span>
            </p>
            <DayColumn entries={entriesForDay(day)} />
          </div>
        ))}
      </div>

      {target ? (
        <BookingModal target={target} onClose={() => setTarget(null)} />
      ) : null}
    </div>
  );
}

function DayColumn({ entries }: { entries: DayEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        Brak zajęć tego dnia.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry, index) => (
        <div key={`${entry.sortKey}-${index}`}>{entry.node}</div>
      ))}
    </div>
  );
}
