import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-[image:var(--gold-gradient)] text-black hover:opacity-90",
  outline: "border border-gold bg-transparent text-gold hover:bg-gold/10",
  ghost: "bg-transparent text-gold hover:text-gold-light",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-7 py-3 text-lg",
} as const;

const base =
  "inline-flex items-center justify-center font-sans transition-[opacity,background-color,color] duration-300 disabled:cursor-not-allowed disabled:opacity-50";

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

type ButtonBase = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonAsLink = ButtonBase & {
  href: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

type ButtonAsButton = ButtonBase & {
  href?: undefined;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  "aria-label"?: string;
};

export function Button(props: ButtonAsLink | ButtonAsButton) {
  const classes = cn(
    base,
    variants[props.variant ?? "primary"],
    sizes[props.size ?? "md"],
    props.className,
  );

  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={classes} onClick={props.onClick}>
        {props.children}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      className={classes}
      disabled={props.disabled}
      onClick={props.onClick}
      aria-label={props["aria-label"]}
    >
      {props.children}
    </button>
  );
}
