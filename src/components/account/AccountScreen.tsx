import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function AccountScreen({
  script,
  title,
  children,
}: {
  script: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="py-16 md:py-24">
      <Container className="mx-auto max-w-lg">
        <SectionHeading script={script} title={title} titleAs="h1" />
        <div className="mt-10">{children}</div>
      </Container>
    </section>
  );
}
