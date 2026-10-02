"use client";

import { BookOpen, CalendarDays, ClipboardCheck, ClipboardList, LogOut, Sparkles, Ticket, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { signOutAdmin } from "@/app/admin/(app)/actions";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  exact?: boolean;
};

const links: NavItem[] = [
  { href: "/admin/kalendarz", label: "Kalendarz", short: "Kalendarz", icon: CalendarDays },
  { href: "/admin/ewidencja", label: "Ewidencja", short: "Ewidencja", icon: ClipboardCheck },
  { href: "/admin/klienci", label: "Klienci", short: "Klienci", icon: Users },
  { href: "/admin/rozliczenia", label: "Rozliczenia", short: "Kasa", icon: Wallet },
  { href: "/admin/zapisy", label: "Zapisy", short: "Zapisy", icon: ClipboardList },
  { href: "/admin/pakiety", label: "Pakiety", short: "Pakiety", icon: Ticket },
  { href: "/admin/eventy", label: "Eventy", short: "Eventy", icon: Sparkles },
  { href: "/admin/kursy", label: "Kursy", short: "Kursy", icon: BookOpen },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-52 shrink-0 border-r border-white/10 bg-black-soft md:flex md:flex-col">
        <div className="border-b border-white/10 px-4 py-4">
          <Link href="/admin" className="text-gold-gradient text-lg font-semibold tracking-tight">
            M&A
          </Link>
          <p className="mt-1 text-[11px] text-muted">Panel</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Panel">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex min-h-9 items-center gap-2 px-3 text-[13px]",
                  active
                    ? "border-l-2 border-gold bg-gold/10 text-gold"
                    : "border-l-2 border-transparent text-cream hover:text-gold",
                )}
              >
                <Icon strokeWidth={1.5} className="size-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <form action={signOutAdmin} className="border-t border-white/10 p-2">
          <p className="truncate px-3 pb-2 text-[11px] text-muted" title={email}>
            {email}
          </p>
          <button
            type="submit"
            className="flex min-h-9 w-full items-center gap-2 px-3 text-[13px] text-cream hover:text-gold"
          >
            <LogOut strokeWidth={1.5} className="size-4" />
            Wyloguj
          </button>
        </form>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-black-soft md:hidden"
        aria-label="Panel"
      >
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[9px] leading-none",
                active ? "text-gold" : "text-muted",
              )}
            >
              <Icon strokeWidth={1.5} className="size-5" />
              {link.short}
            </Link>
          );
        })}
        <form action={signOutAdmin} className="flex flex-1">
          <button
            type="submit"
            className="flex min-h-12 w-full flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[9px] leading-none text-muted"
          >
            <LogOut strokeWidth={1.5} className="size-5" />
            Wyloguj
          </button>
        </form>
      </nav>
    </>
  );
}
