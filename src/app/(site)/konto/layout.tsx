import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { accountsEnabled } from "@/lib/account/flags";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Konto",
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  if (!accountsEnabled()) {
    notFound();
  }

  return children;
}
