import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/content/site";
import { telHref } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Polityka prywatności — M&A Dancing Art",
  description:
    "Jak M&A Dancing Art przetwarza dane z formularza kontaktu i zapisów na zajęcia.",
};

export default function PrivacyPage() {
  return (
    <section className="py-20 md:py-28">
      <Container className="max-w-3xl">
        <SectionHeading
          script="Twoje dane"
          title="Polityka prywatności"
          titleAs="h1"
          align="left"
          className="mb-10"
        />
        <div className="flex flex-col gap-5 text-muted">
          <p>
            Administratorem danych jest {site.name}. Kontakt:{" "}
            <a href={`mailto:${site.email}`} className="text-gold hover:text-gold-light">
              {site.email}
            </a>
            ,{" "}
            <a href={telHref(site.phone)} className="text-gold hover:text-gold-light">
              {site.phone}
            </a>
            .
          </p>
          <p>
            Formularz kontaktu zbiera imię, telefon albo e-mail, temat i treść
            wiadomości. Zapis na zajęcia zbiera dane potrzebne do potwierdzenia
            terminu. Podstawą jest zgoda, którą zaznaczasz w formularzu.
          </p>
          <p>
            Dane służą tylko do odpowiedzi i obsługi zajęć. Nie sprzedajemy ich.
            Wiadomość z formularza trafia na {site.email}; wysyłkę realizuje
            Resend.
          </p>
          <p>
            Możesz poprosić o dostęp, poprawienie albo usunięcie danych — napisz
            na adres powyżej.
          </p>
        </div>
      </Container>
    </section>
  );
}
