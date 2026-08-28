import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionHeadingProps = {
  script: string;
  title: string;
  sub?: ReactNode;
  align?: "center" | "left";
  titleAs?: "h1" | "h2";
  className?: string;
};

export function SectionHeading({
  script,
  title,
  sub,
  align = "center",
  titleAs: TitleTag = "h2",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      <span className="block font-script text-4xl text-gold md:text-5xl">
        {script}
      </span>
      <TitleTag className="max-w-3xl font-sans text-3xl font-semibold tracking-tight text-cream md:text-5xl">
        {title}
      </TitleTag>
      {sub ? <p className="max-w-2xl text-muted">{sub}</p> : null}
    </div>
  );
}
