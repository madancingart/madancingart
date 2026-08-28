import { addMinutes } from "date-fns";
import { site } from "@/content/site";
import {
  classStartOnDay,
  formatBookingWhen,
  toWarsaw,
} from "@/lib/datetime";
import type { BookingKind, LocationId } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BookingTermSummary = {
  title: string;
  when: string;
  city: string;
  address: string;
  locationLine: string;
};

function locationLine(locationId: string): {
  city: string;
  address: string;
  locationLine: string;
} {
  const location = site.locations.find((item) => item.id === locationId);
  const city = location?.city ?? "";
  const address = location?.address ?? "";
  return {
    city,
    address,
    locationLine: [city, address].filter(Boolean).join(", "),
  };
}

function isLocationId(value: string): value is LocationId {
  return value === "mikolow" || value === "lubliniec";
}

export async function resolveBookingTerm(
  supabase: SupabaseClient,
  params: {
    kind: BookingKind;
    targetId: string;
    startsAt: string;
    endsAt: string;
    fallbackTitle: string;
    fallbackLocationId: string;
  },
): Promise<BookingTermSummary> {
  const fallbackStart = toWarsaw(params.startsAt);
  const fallbackEnd = toWarsaw(params.endsAt);
  const fallbackPlace = isLocationId(params.fallbackLocationId)
    ? locationLine(params.fallbackLocationId)
    : { city: "", address: "", locationLine: "" };

  if (params.kind === "slot") {
    const { data } = await supabase
      .from("public_calendar")
      .select("location_id,starts_at,ends_at")
      .eq("id", params.targetId)
      .maybeSingle();

    if (data) {
      const place = locationLine(data.location_id as string);
      return {
        title: "Lekcja indywidualna",
        when: formatBookingWhen(
          toWarsaw(data.starts_at as string),
          toWarsaw(data.ends_at as string),
        ),
        ...place,
      };
    }
  }

  if (params.kind === "event") {
    const { data } = await supabase
      .from("events")
      .select("title,location_id,starts_at,ends_at")
      .eq("id", params.targetId)
      .maybeSingle();

    if (data) {
      const locationId = (data.location_id as string | null) ?? params.fallbackLocationId;
      const place = locationLine(locationId);
      return {
        title: data.title as string,
        when: formatBookingWhen(
          toWarsaw(data.starts_at as string),
          toWarsaw(data.ends_at as string),
        ),
        ...place,
      };
    }
  }

  if (params.kind === "class") {
    const { data } = await supabase
      .from("recurring_classes")
      .select("location_id,start_time,duration_min,class_type_id")
      .eq("id", params.targetId)
      .maybeSingle();

    if (data) {
      const { data: type } = await supabase
        .from("class_types")
        .select("name")
        .eq("id", data.class_type_id as string)
        .maybeSingle();

      const day = toWarsaw(params.startsAt);
      const start = classStartOnDay(day, data.start_time as string);
      const end = addMinutes(start, Number(data.duration_min));
      const place = locationLine(data.location_id as string);

      return {
        title: (type?.name as string | undefined) ?? params.fallbackTitle,
        when: formatBookingWhen(start, end),
        ...place,
      };
    }
  }

  return {
    title: params.fallbackTitle,
    when: formatBookingWhen(fallbackStart, fallbackEnd),
    ...fallbackPlace,
  };
}
