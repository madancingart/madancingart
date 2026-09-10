import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Płatność przerwana — M&A Dancing Art",
};

export default function PackageCancelPage() {
  return (
    <section className="py-24">
      <Container className="max-w-xl text-center">
        <h1 className="text-3xl font-semibold text-cream">
          Płatność nie doszła do skutku
        </h1>
        <p className="mt-4 text-muted">
          Nic nie pobraliśmy. Możecie wrócić do pakietów i spróbować ponownie —
          zgłoszenie zostało zapisane i dopiszemy płatność po kontakcie.
        </p>
        <Button href="/pierwszy-taniec/pakiety" className="mt-8">
          Wróć do pakietów
        </Button>
      </Container>
    </section>
  );
}
