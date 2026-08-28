"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { enrollLink, navLinks } from "@/content/navigation";
import { cn } from "@/lib/cn";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    const openButton = openButtonRef.current;

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      openButton?.focus();
    };
  }, [menuOpen]);

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

  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,backdrop-filter] duration-300",
        scrolled ? "bg-black/90 backdrop-blur-md" : "bg-transparent",
      )}
    >
      <Container className="relative flex h-16 items-center justify-between gap-4">
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
          className="p-2 text-cream md:hidden"
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
        <div
          id={menuId}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[60] flex flex-col bg-black md:hidden"
        >
          <Container className="flex h-16 items-center justify-between">
            <Link
              href="/"
              className="text-gold-gradient font-sans text-2xl font-semibold tracking-tight"
              onClick={closeMenu}
            >
              M&A
            </Link>
            <button
              ref={closeButtonRef}
              type="button"
              className="p-2 text-cream"
              aria-label="Zamknij menu"
              onClick={closeMenu}
            >
              <X strokeWidth={1.5} aria-hidden />
            </button>
          </Container>

          <nav
            className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16"
            aria-label="Menu mobilne"
          >
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-sans text-3xl text-cream transition-colors duration-300 hover:text-gold"
                onClick={closeMenu}
              >
                {item.label}
              </Link>
            ))}
            <Button
              href={enrollLink.href}
              size="lg"
              className="mt-4"
              onClick={closeMenu}
            >
              {enrollLink.label}
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
