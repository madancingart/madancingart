import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { localBusinessGraph } from "@/lib/schema";

export default function SiteLayout({ children }: { children: ReactNode }) {
  const jsonLd = JSON.stringify(localBusinessGraph());

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <a href="#tresc" className="skip-link">
        Przejdź do treści
      </a>
      <Navbar />
      <main id="tresc" className="flex flex-1 flex-col" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}
