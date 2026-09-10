"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { customerFileHref } from "@/lib/admin/customer-label";
import type { ReactNode } from "react";

export function CustomerNameLink({
  customerId,
  children,
  className,
}: {
  customerId: string | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  if (!customerId) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      href={customerFileHref(customerId)}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "text-gold hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        className,
      )}
    >
      {children}
    </Link>
  );
}
