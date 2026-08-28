import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "border border-white/5 bg-black-soft p-6 transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-gold/40",
        className,
      )}
    >
      {children}
    </div>
  );
}
