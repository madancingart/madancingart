import { cn } from "@/lib/cn";

type GoldDividerProps = {
  diamond?: boolean;
  className?: string;
};

export function GoldDivider({ diamond = false, className }: GoldDividerProps) {
  if (!diamond) {
    return (
      <div
        className={cn("h-px w-full bg-[image:var(--gold-gradient)]", className)}
        role="presentation"
      />
    );
  }

  return (
    <div
      className={cn("flex items-center gap-3", className)}
      role="presentation"
    >
      <div className="h-px flex-1 bg-[image:var(--gold-gradient)]" />
      <span className="block size-2 rotate-45 bg-gold" />
      <div className="h-px flex-1 bg-[image:var(--gold-gradient)]" />
    </div>
  );
}
