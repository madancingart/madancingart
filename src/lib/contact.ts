import type { SiteLocation } from "@/content/site";

export function telHref(phone: string): string {
  const compact = phone.replaceAll(" ", "");
  if (compact.startsWith("+")) {
    return `tel:${compact}`;
  }
  return `tel:+48${compact.replace(/^\+?48/, "")}`;
}

export function googleMapsUrl(location: SiteLocation): string {
  const query = `${location.address}, ${location.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
