import { TRAINER_CATALOG } from "@/lib/trainers";

export function ScheduleLegend() {
  return (
    <div className="mt-8 flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
        <li className="flex items-center gap-2">
          <span className="size-3 shrink-0 border border-white/20 bg-black-soft" />
          Zajęcia grupowe
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 shrink-0 border border-gold bg-black-soft" />
          Wolny termin indywidualny
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 shrink-0 border border-white/10 bg-black/40" />
          Zajęte
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 shrink-0 border border-white/5 bg-black/40" />
          Odwołane
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 shrink-0 bg-[image:var(--gold-gradient)]" />
          Wydarzenie
        </li>
      </ul>
      <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
        {TRAINER_CATALOG.map((trainer) => (
          <li key={trainer.id} className="flex items-center gap-2">
            <span
              className="h-3 w-1 shrink-0"
              style={{ backgroundColor: trainer.accent }}
              aria-hidden
            />
            {trainer.shortName} — lekcja indywidualna
          </li>
        ))}
      </ul>
    </div>
  );
}
