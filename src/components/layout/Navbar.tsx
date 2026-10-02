"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MobileMenu, navIconButtonClass } from "@/components/layout/MobileMenu";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { enrollLink, navLinks } from "@/content/navigation";
import { cn } from "@/lib/cn";

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPathname, setMenuPathname] = useState(pathname);
  const menuId = useId();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  if (pathname !== menuPathname) {
    setMenuPathname(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (media.matches) {
        setMenuOpen(false);
      }
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,backdrop-filter] duration-300",
        scrolled ? "bg-black/90 backdrop-blur-md" : "bg-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="text-gold-gradient shrink-0 font-sans text-2xl font-semibold tracking-tight"
        >
          M&A
        </Link>

        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Nawigacja główna"
        >
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-cream transition-colors duration-300 hover:text-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button href={enrollLink.href} size="sm">
            {enrollLink.label}
          </Button>
        </div>

        <button
          ref={openButtonRef}
          type="button"
          className={cn(navIconButtonClass, "md:hidden")}
          aria-label="Otwórz menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen(true)}
        >
          <Menu strokeWidth={1.5} aria-hidden />
        </button>
      </Container>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[image:var(--gold-gradient)] transition-opacity duration-300",
          scrolled ? "opacity-100" : "opacity-0",
        )}
      />

      {menuOpen ? (
        <MobileMenu
          menuId={menuId}
          onClose={closeMenu}
          returnFocusRef={openButtonRef}
        />
      ) : null}
    </header>
  );
}
