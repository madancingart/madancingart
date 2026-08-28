import { Container } from "@/components/ui/Container";
import { trustPhrases } from "@/content/home";

export function TrustBar() {
  return (
    <section
      id="zaufanie"
      className="border-y border-white/5 py-8"
      aria-label="Wyróżniki szkoły"
    >
      <Container>
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3 text-center text-sm tracking-wide text-cream md:text-base">
          {trustPhrases.map((phrase, index) => (
            <li key={phrase} className="flex items-center gap-3">
              {index > 0 ? (
                <span
                  className="hidden size-1.5 shrink-0 rounded-full bg-gold sm:block"
                  aria-hidden
                />
              ) : null}
              <span>{phrase}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
