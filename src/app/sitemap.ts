import type { MetadataRoute } from "next";
import { offerItems } from "@/content/offer";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  const paths = [
    "",
    "/oferta",
    ...offerItems.map((item) => `/oferta/${item.slug}`),
    "/grafik",
    "/cennik",
    "/zespol",
    "/galeria",
    "/o-nas",
    "/kontakt",
    "/polityka-prywatnosci",
    "/regulamin",
    "/regulamin-zajec",
    "/umowa",
    "/pierwszy-taniec/pakiety",
  ];

  return paths.map((path) => ({
    url: `${siteUrl}${path || "/"}`,
  }));
}
