import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/content/site";
import { telHref } from "@/lib/contact";

export function LegalArticle({
  script,
  title,
  updated,
  children,
}: {
  script: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <section className="py-20 md:py-28">
      <Container className="max-w-3xl">
        <SectionHeading
          script={script}
          title={title}
          titleAs="h1"
          align="left"
          className="mb-4"
        />
        <p className="mb-10 text-sm text-muted">Obowiązuje od {updated}.</p>
        <div className="flex flex-col gap-10 text-muted leading-relaxed">{children}</div>
      </Container>
    </section>
  );
}

export function LegalIdentity() {
  return (
    <p>
      {site.legal.name}, {site.legal.address}. NIP {site.legal.nip}, REGON{" "}
      {site.legal.regon}, KRS {site.legal.krs}. {site.legal.court}. Telefon:{" "}
      <a href={telHref(site.phone)} className="text-gold hover:text-gold-light">
        {site.phone}
      </a>
      . E-mail:{" "}
      <a href={`mailto:${site.email}`} className="text-gold hover:text-gold-light">
        {site.email}
      </a>
      .
    </p>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-sans text-xl text-cream">{title}</h2>
      {children}
    </section>
  );
}
