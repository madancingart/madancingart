"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/konto", label: "Zajęcia", exact: true },
  { href: "/konto/platnosci", label: "Płatności", exact: false },
  { href: "/konto/uczestnicy", label: "Uczestnicy", exact: false },
  { href: "/konto/profil", label: "Profil", exact: false },
] as const;

function isCurrent(pathname: string, href: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href || pathname.startsWith("/konto/oplac");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PanelNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-20 -mx-4 mt-4 border-b border-white/10 bg-black px-4">
      <nav aria-label="Konto" className="overflow-x-auto">
        <ul className="flex min-w-max gap-1">
          {TABS.map((tab) => {
            const current = isCurrent(pathname, tab.href, tab.exact);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={current ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm ${
                    current
                      ? "border-gold text-cream"
                      : "border-transparent text-muted"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
