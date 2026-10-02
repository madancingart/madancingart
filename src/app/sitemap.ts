import type { MetadataRoute } from "next";
import { offerItems } from "@/content/offer";
import { publishedCourseSlugs } from "@/lib/courses/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    ...(await publishedCourseSlugs()).map((slug) => `/kursy/${slug}`),
  ];

  return paths.map((path) => ({
    url: `${siteUrl}${path || "/"}`,
  }));
}
