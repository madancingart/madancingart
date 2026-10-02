import { publicSiteUrl } from "@/lib/booking/confirmation-window";
import { site, type LocationId } from "@/content/site";

function schemaPhone(phone: string): string {
  const compact = phone.replaceAll(" ", "");
  return compact.startsWith("+") ? compact : `+48${compact}`;
}

export function businessId(locationId: LocationId): string {
  return `${publicSiteUrl()}/#${locationId}`;
}

export function localBusinessGraph(): {
  "@context": string;
  "@graph": Record<string, unknown>[];
} {
  const url = publicSiteUrl();

  return {
    "@context": "https://schema.org",
    "@graph": site.locations.map((location) => ({
      "@type": "LocalBusiness",
      "@id": businessId(location.id),
      name: `${site.name} — ${location.city}`,
      url,
      telephone: schemaPhone(site.phone),
      email: site.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: location.address,
        addressLocality: location.city,
        addressCountry: "PL",
      },
    })),
  };
}

export function videoObjectJsonLd(video: {
  title: string;
  description: string;
  poster: { src: string };
  uploadDate: string;
  durationIso?: string;
  provider: "youtube" | "self";
  youtubeId?: string;
  src?: { mp4: string };
}): Record<string, unknown> {
  const url = publicSiteUrl();
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.description,
    thumbnailUrl: `${url}${video.poster.src}`,
    uploadDate: video.uploadDate,
  };

  if (video.durationIso) {
    data.duration = video.durationIso;
  }

  if (video.provider === "youtube" && video.youtubeId) {
    data.embedUrl = `https://www.youtube-nocookie.com/embed/${video.youtubeId}`;
  } else if (video.src?.mp4) {
    data.contentUrl = `${url}${video.src.mp4}`;
  }

  return data;
}

export function contactPageJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Kontakt",
    url: `${publicSiteUrl()}/kontakt`,
    mainEntity: site.locations.map((location) => ({
      "@id": businessId(location.id),
    })),
  };
}
