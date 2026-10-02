import type { SiteLocation } from "@/content/site";

export function telHref(phone: string): string {
  const compact = phone.replaceAll(" ", "");
  if (compact.startsWith("+")) {
    return `tel:${compact}`;
  }
  return `tel:+48${compact.replace(/^\+?48/, "")}`;
}

export function mapsQuery(location: SiteLocation): string {
  return `${location.address}, ${location.city}`;
}

export function googleMapsUrl(location: SiteLocation): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery(location))}`;
}

export function appleMapsUrl(location: SiteLocation): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(mapsQuery(location))}`;
}

export function googleMapsEmbedUrl(location: SiteLocation): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery(location))}&output=embed`;
}
