import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { GoldDivider } from "@/components/ui/GoldDivider";
import { FacebookIcon, InstagramIcon } from "@/components/ui/SocialIcons";
import { legalLinks } from "@/content/navigation";
import { site } from "@/content/site";
import { googleMapsUrl, telHref } from "@/lib/contact";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-white/5 pt-16 pb-8">
      <Container>
        <div className="grid gap-12 md:grid-cols-3">
          <div className="flex flex-col gap-4">
            <p className="text-gold-gradient font-sans text-3xl font-semibold">
              M&A
            </p>
            <p className="max-w-xs text-muted">{site.tagline}</p>
          </div>

          <div>
            <p className="mb-4 text-cream">Lokalizacje</p>
            <ul className="flex flex-col gap-4">
              {site.locations.map((location) => (
                <li key={location.id}>
                  <p className="text-cream">{location.city}</p>
                  <a
                    href={googleMapsUrl(location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted transition-colors duration-300 hover:text-gold"
                  >
                    {location.address}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 text-cream">Kontakt</p>
            <ul className="flex flex-col gap-3">
              <li>
                <a
                  href={telHref(site.phone)}
                  className="text-muted transition-colors duration-300 hover:text-gold"
                >
                  {site.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="text-muted transition-colors duration-300 hover:text-gold"
                >
                  {site.email}
                </a>
              </li>
              <li className="flex gap-3 pt-2">
                <a
                  href={site.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="text-cream transition-colors duration-300 hover:text-gold"
                >
                  <InstagramIcon />
                </a>
                <a
                  href={site.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="text-cream transition-colors duration-300 hover:text-gold"
                >
                  <FacebookIcon />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <GoldDivider className="mt-12 mb-6" />

        <div className="flex flex-col gap-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.legal.name}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {legalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors duration-300 hover:text-gold"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
