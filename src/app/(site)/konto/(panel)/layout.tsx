import type { ReactNode } from "react";
import { PanelNav } from "@/components/account/panel/PanelNav";
import { Container } from "@/components/ui/Container";
import { requireAccount } from "@/lib/account/panel";

export default async function AccountPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = await requireAccount();

  return (
    <section className="py-6 md:py-10">
      <Container className="max-w-3xl">
        <p className="text-sm text-gold">Konto</p>
        <h1 className="mt-1 text-2xl text-cream">Cześć, {profile.firstName}</h1>
        <PanelNav />
        <div className="mt-6">{children}</div>
      </Container>
    </section>
  );
}
