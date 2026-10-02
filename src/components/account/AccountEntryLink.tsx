"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const enabled = process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === "true";

type AccountEntryLinkProps = {
  className: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
};

export function AccountEntryLink({ className, onClick }: AccountEntryLinkProps) {
  const [entry, setEntry] = useState<{ href: string; label: string } | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    const supabase = createClient();
    const apply = (hasSession: boolean) => {
      if (!active) {
        return;
      }
      setEntry(
        hasSession
          ? { href: "/konto", label: "Moje konto" }
          : { href: "/konto/logowanie", label: "Zaloguj się" },
      );
    };

    void supabase.auth.getSession().then(({ data }) => {
      apply(Boolean(data.session));
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(Boolean(session));
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!enabled || !entry) {
    return null;
  }

  return (
    <Link
      href={entry.href}
      className={className}
      onClick={(event) => onClick?.(event, entry.href)}
    >
      {entry.label}
    </Link>
  );
}
