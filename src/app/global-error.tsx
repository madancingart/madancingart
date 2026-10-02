"use client";

import { useEffect } from "react";
import { Arima, Great_Vibes } from "next/font/google";
import { SiteErrorPanel } from "@/components/layout/SiteErrorPanel";
import "./globals.css";

const arima = Arima({
  variable: "--font-arima",
  subsets: ["latin", "latin-ext"],
});

const greatVibes = Great_Vibes({
  variable: "--font-great-vibes",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html
      lang="pl"
      className={`${arima.variable} ${greatVibes.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-black font-sans text-cream">
        <SiteErrorPanel onRetry={reset} />
      </body>
    </html>
  );
}
