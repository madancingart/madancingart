import type { SiteLocation } from "@/content/site";

export function telHref(phone: string): string {
  return `tel:+48${phone.replaceAll(" ", "")}`;
}

export function googleMapsUrl(location: SiteLocation): string {
  const query = `${location.address}, ${location.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
