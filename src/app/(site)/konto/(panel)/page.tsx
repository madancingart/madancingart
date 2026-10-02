import type { Metadata } from "next";
import { StatusPill } from "@/components/account/panel/StatusPill";
import { firstParam } from "@/lib/account/params";
import { Button } from "@/components/ui/Button";
import { loadClassPanel } from "@/lib/account/panel";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `Zajęcia — ${site.name}`,
};

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ platnosc?: string | string[] }>;
}) {
  const params = await searchParams;
  const paymentCancelled = firstParam(params.platnosc) === "anulowana";
  const panel = await loadClassPanel();

  if (!panel) {
    return (
      <p role="alert" className="text-sm text-[#E8A0A0]">
        Nie udało się wczytać zajęć. Odśwież stronę.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {paymentCancelled ? (
        <p className="border border-gold/50 bg-black-soft p-4 text-sm text-cream" role="status">
          Płatność anulowana. Możesz wrócić do niej z listy albo zapłacić na sali.
        </p>
      ) : null}
      {panel.arrears.length > 0 ? (
        <div className="space-y-3">
          {panel.arrears.map((item) => (
            <div key={item.id} className="border border-red-800/80 bg-black-soft p-4" role="status">
              <p className="text-sm text-cream">{item.text}</p>
              <Button href={item.payHref} size="sm" className="mt-3">
                Opłać teraz
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg text-cream">Zajęcia stałe</h2>
        {panel.cards.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">Nie masz zapisów na stałe grupy.</p>
            <Button href="/grafik" variant="outline" size="sm">
              Zobacz grafik
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {panel.cards.map((card) => (
              <li key={card.id}>
                <article className="border border-white/10 bg-black-soft p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-base text-cream">{card.title}</h3>
                    {card.paused ? <span className="text-xs text-muted">Pauza</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {card.place} · {card.when}
                  </p>
                  {card.trainer ? (
                    <p className="mt-1 text-sm text-cream">{card.trainer}</p>
                  ) : null}
                  {card.participant ? (
                    <p className="mt-1 text-sm text-cream">Uczestnik: {card.participant}</p>
                  ) : null}
                  <div className="mt-3">
                    <StatusPill tone={card.tone} label={card.label} />
                  </div>
                  {card.payHref ? (
                    <Button href={card.payHref} size="sm" className="mt-3">
                      Opłać
                    </Button>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg text-cream">Najbliższe 14 dni</h2>
        {panel.cancellationsNote ? (
          <p role="alert" className="text-sm text-amber-200">{panel.cancellationsNote}</p>
        ) : null}
        {panel.lessonsNote ? (
          <p role="alert" className="text-sm text-amber-200">{panel.lessonsNote}</p>
        ) : null}
        {panel.agenda.length === 0 ? (
          <p className="text-sm text-muted">W najbliższych 14 dniach nie ma zajęć.</p>
        ) : (
          <ul className="space-y-2">
            {panel.agenda.map((item) => (
              <li key={item.id} className="border border-white/10 bg-black-soft px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-cream">{item.when}</p>
                  {item.cancelled ? (
                    <span className="shrink-0 border border-red-700/80 px-2 py-0.5 text-xs text-red-300">
                      Odwołane
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-cream">{item.title}</p>
                <p className="text-sm text-muted">
                  {item.place}
                  {item.detail ? ` · ${item.detail}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Karty kursów — lista spotkań i obecności — pojawią się po prompcie 38. */}
    </div>
  );
}
