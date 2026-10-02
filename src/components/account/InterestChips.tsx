"use client";

export type ClassTypeOption = {
  slug: string;
  name: string;
};

export function InterestChips({
  options,
  value,
  onChange,
}: {
  options: ClassTypeOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm text-cream">Jakie zajęcia Cię interesują?</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option.slug);
          return (
            <button
              key={option.slug}
              type="button"
              aria-pressed={selected}
              className={
                selected
                  ? "min-h-11 border border-gold px-3 text-sm text-gold"
                  : "min-h-11 border border-white/15 px-3 text-sm text-cream"
              }
              onClick={() => {
                onChange(
                  selected
                    ? value.filter((slug) => slug !== option.slug)
                    : [...value, option.slug],
                );
              }}
            >
              {option.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
