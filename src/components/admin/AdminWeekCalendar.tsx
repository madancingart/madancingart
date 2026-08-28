"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { addMinutes, differenceInMinutes, getISODay, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AddSlotModal } from "@/components/admin/AddSlotModal";
import { CalendarDrawer } from "@/components/admin/CalendarDrawer";
import { ToastProvider, useToast } from "@/components/admin/Toast";
import { cn } from "@/lib/cn";
import {
  classStartOnDay,
  formatClock,
  formatDayChip,
  formatDayHeader,
  formatTimeRange,
  formatWeekRange,
  nowInWarsaw,
  toWarsaw,
  weekDaysFromIso,
} from "@/lib/datetime";
import type { AdminCalendarData, AdminClass, AdminSlot } from "@/lib/admin/calendar-types";
import type { LocationId } from "@/content/site";
import type { ActionResult } from "@/app/admin/(app)/kalendarz/actions";

const GRID_START = 8 * 60;
const GRID_END = 22 * 60;
const PX_PER_MIN = 1.15;
const GRID_HEIGHT = (GRID_END - GRID_START) * PX_PER_MIN;

type DrawerId = { kind: "class"; id: string } | { kind: "slot"; id: string };

type DrawerTarget =
  | { kind: "class"; item: AdminClass }
  | { kind: "slot"; item: AdminSlot };

type AdminWeekCalendarProps = {
  locationId: LocationId;
  nowIso: string;
  weekOffset: number;
  data: AdminCalendarData;
  openAddInitially: boolean;
};

function minutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function hrefForWeek(locationId: LocationId, offset: number): string {
  const params = new URLSearchParams();
  params.set("lokalizacja", locationId);
  if (offset !== 0) {
    params.set("tydzien", String(offset));
  }
  return `/admin/kalendarz?${params.toString()}`;
}

export function AdminWeekCalendar(props: AdminWeekCalendarProps) {
  return (
    <ToastProvider>
      <AdminWeekCalendarInner {...props} />
    </ToastProvider>
  );
}

function AdminWeekCalendarInner({
  locationId,
  nowIso,
  weekOffset,
  data,
  openAddInitially,
}: AdminWeekCalendarProps) {
  const router = useRouter();
  const toast = useToast();
  const now = toWarsaw(nowIso);
  const days = weekDaysFromIso(nowIso, weekOffset);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const index = days.findIndex((day) => isSameDay(day, now));
    return index >= 0 ? index : 0;
  });
  const [drawerId, setDrawerId] = useState<DrawerId | null>(null);
  const [addOpen, setAddOpen] = useState(openAddInitially);
  const [addStart, setAddStart] = useState<Date | null>(null);

  const hourLabels = useMemo(() => {
    const labels: number[] = [];
    for (let minutes = GRID_START; minutes < GRID_END; minutes += 60) {
      labels.push(minutes);
    }
    return labels;
  }, []);

  function goWeek(offset: number) {
    router.push(hrefForWeek(locationId, offset));
  }

  function goToday() {
    const todayIndex = weekDaysFromIso(nowIso, 0).findIndex((day) =>
      isSameDay(day, now),
    );
    setSelectedDayIndex(todayIndex >= 0 ? todayIndex : 0);
    goWeek(0);
  }

  function handleResult(result: ActionResult, closeDrawer = false) {
    if (result.ok) {
      toast.push("ok", "Zapisane.");
      router.refresh();
      if (closeDrawer) {
        setDrawerId(null);
      }
    } else {
      toast.push("err", result.error);
    }
  }

  function openEmpty(day: Date, clientY: number, gridTop: number) {
    const y = clientY - gridTop;
    const raw = GRID_START + y / PX_PER_MIN;
    const snapped = Math.round(raw / 15) * 15;
    const clamped = Math.min(GRID_END - 15, Math.max(GRID_START, snapped));
    const hours = Math.floor(clamped / 60);
    const minutes = clamped % 60;
    const start = classStartOnDay(
      day,
      `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    );
    setAddStart(start);
    setAddOpen(true);
  }

  const selectedDay = days[selectedDayIndex] ?? days[0];

  const drawerTarget: DrawerTarget | null = drawerId
    ? drawerId.kind === "class"
      ? (() => {
          const item = data.classes.find((row) => row.id === drawerId.id);
          return item ? { kind: "class", item } : null;
        })()
      : (() => {
          const item = data.slots.find((row) => row.id === drawerId.id);
          return item ? { kind: "slot", item } : null;
        })()
    : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goWeek(weekOffset - 1)}
            aria-label="Poprzedni tydzień"
            className="flex size-11 items-center justify-center text-cream"
          >
            <ChevronLeft strokeWidth={1.5} className="size-6" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="min-h-11 border border-white/10 px-3 text-[13px] text-cream hover:border-gold hover:text-gold"
          >
            Dziś
          </button>
          <button
            type="button"
            onClick={() => goWeek(weekOffset + 1)}
            aria-label="Następny tydzień"
            className="flex size-11 items-center justify-center text-cream"
          >
            <ChevronRight strokeWidth={1.5} className="size-6" />
          </button>
        </div>
        <p className="text-[13px] text-muted">
          {weekOffset === 0 ? "Bieżący tydzień" : "Tydzień"} ·{" "}
          {formatWeekRange(days[0], days[6])}
        </p>
        <button
          type="button"
          onClick={() => {
            setAddStart(nowInWarsaw());
            setAddOpen(true);
          }}
          className="min-h-11 border border-gold px-3 text-[13px] text-gold hover:bg-gold/10"
        >
          Dodaj termin
        </button>
      </div>

      <div className="mt-4 md:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {days.map((day, index) => (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDayIndex(index)}
              className={cn(
                "min-h-11 shrink-0 border px-3 py-2 text-sm whitespace-nowrap",
                index === selectedDayIndex
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-white/10 text-cream",
              )}
            >
              {formatDayChip(day)}
            </button>
          ))}
        </div>
        <DayGrid
          day={selectedDay}
          data={data}
          hourLabels={hourLabels}
          onEmpty={(clientY, top) => openEmpty(selectedDay, clientY, top)}
          onOpen={setDrawerId}
        />
      </div>

      <div className="mt-4 hidden overflow-x-auto md:block">
        <div className="grid min-w-[56rem] grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
          <div />
          {days.map((day) => {
            const header = formatDayHeader(day);
            const today = isSameDay(day, now);
            return (
              <p
                key={`${day.toISOString()}-h`}
                className={cn(
                  "mb-2 text-center text-[12px]",
                  today ? "text-gold" : "text-muted",
                )}
              >
                {header.weekday}
                <span className="mt-0.5 block text-cream">{header.date}</span>
              </p>
            );
          })}
          <div className="relative" style={{ height: GRID_HEIGHT }}>
            {hourLabels.map((minutes) => (
              <p
                key={minutes}
                className="absolute right-1 text-[10px] text-muted"
                style={{ top: (minutes - GRID_START) * PX_PER_MIN }}
              >
                {`${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`}
              </p>
            ))}
          </div>
          {days.map((day) => (
            <DayGrid
              key={day.toISOString()}
              day={day}
              data={data}
              hourLabels={hourLabels}
              onEmpty={(clientY, top) => openEmpty(day, clientY, top)}
              onOpen={setDrawerId}
              compact
            />
          ))}
        </div>
      </div>

      <CalendarDrawer
        open={Boolean(drawerTarget)}
        target={drawerTarget}
        onClose={() => setDrawerId(null)}
        onDone={handleResult}
      />
      <AddSlotModal
        open={addOpen}
        locationId={locationId}
        initialStart={addStart}
        onClose={() => {
          setAddOpen(false);
          if (openAddInitially) {
            router.replace(hrefForWeek(locationId, weekOffset));
          }
        }}
        onDone={handleResult}
      />
    </div>
  );
}

function DayGrid({
  day,
  data,
  hourLabels,
  onEmpty,
  onOpen,
  compact = false,
}: {
  day: Date;
  data: AdminCalendarData;
  hourLabels: number[];
  onEmpty: (clientY: number, gridTop: number) => void;
  onOpen: (target: DrawerId) => void;
  compact?: boolean;
}) {
  const weekday = getISODay(day);
  const classes = data.classes.filter((item) => item.weekday === weekday);
  const slots = data.slots.filter((item) =>
    isSameDay(toWarsaw(item.startsAt), day),
  );

  return (
    <div
      className={cn(
        "relative border-l border-white/5",
        compact ? "" : "mt-3 min-h-[32rem]",
      )}
      style={{ height: GRID_HEIGHT }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-tile]")) {
          return;
        }
        const top = event.currentTarget.getBoundingClientRect().top;
        onEmpty(event.clientY, top);
      }}
    >
      {hourLabels.map((minutes) => (
        <div
          key={minutes}
          className="absolute right-0 left-0 border-t border-white/5"
          style={{ top: (minutes - GRID_START) * PX_PER_MIN }}
        />
      ))}
      {classes.map((item) => {
        const start = classStartOnDay(day, item.startTime);
        const end = addMinutes(start, item.durationMin);
        return (
          <Tile
            key={`c-${item.id}`}
            start={start}
            end={end}
            className="border-white/15 bg-black-soft text-cream"
            onClick={() => onOpen({ kind: "class", id: item.id })}
          >
            <p className="truncate font-semibold">{item.name}</p>
            {item.level ? (
              <p className="truncate text-[11px] text-muted">{item.level}</p>
            ) : null}
            <p className="text-[11px] text-muted">{formatTimeRange(start, end)}</p>
            <p className="text-[11px] text-gold">
              {item.taken}/{item.capacity}
            </p>
          </Tile>
        );
      })}
      {slots.map((item) => {
        const start = toWarsaw(item.startsAt);
        const end = toWarsaw(item.endsAt);
        const tone =
          item.status === "open"
            ? "border-gold bg-gold/10 text-gold"
            : item.status === "booked"
              ? "border-gold bg-[image:var(--gold-gradient)] text-black"
              : "border-white/10 bg-white/10 text-muted";
        const name = item.booking
          ? `${item.booking.firstName} ${item.booking.lastName}`
          : item.status === "blocked"
            ? "Zablokowany"
            : "Wolny";
        return (
          <Tile
            key={`s-${item.id}`}
            start={start}
            end={end}
            className={tone}
            onClick={() => onOpen({ kind: "slot", id: item.id })}
          >
            <p className="truncate text-[12px] font-semibold">{name}</p>
            <p className="text-[11px] opacity-80">{formatClock(start)}</p>
          </Tile>
        );
      })}
    </div>
  );
}

function Tile({
  start,
  end,
  className,
  onClick,
  children,
}: {
  start: Date;
  end: Date;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const top = (minutesOf(start) - GRID_START) * PX_PER_MIN;
  const duration = Math.max(20, differenceInMinutes(end, start));
  const height = duration * PX_PER_MIN;

  return (
    <button
      type="button"
      data-tile
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute right-0.5 left-0.5 z-10 overflow-hidden border px-1.5 py-1 text-left",
        className,
      )}
      style={{ top, height }}
    >
      {children}
    </button>
  );
}
