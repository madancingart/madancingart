import type { Metadata } from "next";
import { Arima, Great_Vibes } from "next/font/google";
import { site } from "@/content/site";
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

export const metadata: Metadata = {
  title: site.name,
  description: "Szkoła tańca M&A Dancing Art — Mikołów i Lubliniec",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className={`${arima.variable} ${greatVibes.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
