"use client";

import { Button } from "@/components/ui/Button";
import { site } from "@/content/site";
import { telHref } from "@/lib/contact";

export function SiteErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <span className="font-script text-4xl text-gold md:text-5xl">
        Przepraszamy
      </span>
      <h1 className="mt-3 max-w-3xl font-sans text-4xl font-semibold tracking-tight text-cream md:text-5xl">
        Coś poszło nie tak
      </h1>
      <Button type="button" onClick={onRetry} className="mt-8">
        Spróbuj ponownie
      </Button>
      <a
        href={telHref(site.phone)}
        className="mt-6 text-gold transition-colors duration-300 hover:text-gold-light"
      >
        {site.phone}
      </a>
    </main>
  );
}
