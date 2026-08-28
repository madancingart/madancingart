import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
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
