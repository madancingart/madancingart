export function ScheduleLegend() {
  return (
    <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
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
        <span className="size-3 shrink-0 bg-[image:var(--gold-gradient)]" />
        Wydarzenie
      </li>
    </ul>
  );
}
