import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { z } from "zod";
import { CheckoutButton } from "@/components/account/CheckoutButton";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/content/site";
import { loadPayLink } from "@/lib/billing/pay-link";
import { telHref } from "@/lib/contact";
import { allowPayTokenLookup, clientIpFromHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Płatność — ${site.name}`,
  robots: { index: false, follow: false },
};

export default async function PayTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const headerList = await headers();
  if (!allowPayTokenLookup(clientIpFromHeaders(headerList))) {
    return (
      <Shell title="Za dużo prób">
        <p className="text-sm text-cream">Zbyt wiele prób. Spróbuj ponownie za kilka minut.</p>
      </Shell>
    );
  }

  if (!z.uuid().safeParse(token).success) {
    return <Missing />;
  }

  const view = await loadPayLink(token);
  if (view === "missing") {
    return <Missing />;
  }

  return (
    <Shell title="Płatność">
      <article className="space-y-2 border border-white/10 bg-black-soft p-4 text-sm text-cream">
        <p>
          {view.firstName} {view.lastInitial}
        </p>
        <p>{view.description}</p>
        <p className="text-muted">{view.period}</p>
        <p>{view.amountLabel}</p>
        <p className="text-muted">Termin {view.dueLabel}</p>
      </article>
      {view.status === "paid" ? (
        <p className="text-sm text-cream">Ta płatność jest już opłacona — dziękujemy!</p>
      ) : null}
      {view.status === "void" ? (
        <p className="text-sm text-cream">
          Ta płatność jest nieaktualna. Zadzwoń:{" "}
          <a href={telHref(site.phone)} className="text-gold hover:text-gold-light">
            {site.phone}
          </a>
          .
        </p>
      ) : null}
      {view.status === "open" && view.payLabel ? (
        <div className="space-y-2">
          {view.bundledNote ? <p className="text-sm text-muted">{view.bundledNote}</p> : null}
          <CheckoutButton label={view.payLabel} token={token} />
        </div>
      ) : null}
    </Shell>
  );
}

function Missing() {
  return (
    <Shell title="Płatność">
      <p className="text-sm text-cream">
        Nie znaleziono tej płatności. Zadzwoń:{" "}
        <a href={telHref(site.phone)} className="text-gold hover:text-gold-light">
          {site.phone}
        </a>
        .
      </p>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-16 md:py-24">
      <Container className="mx-auto max-w-lg space-y-6">
        <SectionHeading script="Wpłata" title={title} titleAs="h1" />
        {children}
      </Container>
    </section>
  );
}
