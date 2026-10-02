"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AccountEntryLink } from "@/components/account/AccountEntryLink";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { enrollLink, navLinks } from "@/content/navigation";
import { site } from "@/content/site";
import { telHref } from "@/lib/contact";

export const navIconButtonClass =
  "inline-flex appearance-none items-center justify-center border-0 bg-transparent p-2 text-cream shadow-none";

const menuLinkClass =
  "font-sans text-3xl text-cream transition-colors duration-300 hover:text-gold";

type MobileMenuProps = {
  menuId: string;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
};

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getClientRects().length > 0);
}

export function MobileMenu({
  menuId,
  onClose,
  returnFocusRef,
}: MobileMenuProps) {
  const pathname = usePathname();
  const pathnameOnOpen = useRef(pathname);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreScrollRef = useRef(true);

  useEffect(() => {
    const scrollY = window.scrollY;
    const { body } = document;
    const html = document.documentElement;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    const trigger = returnFocusRef.current;
    const openedAt = pathnameOnOpen.current;

    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        restoreScrollRef.current = true;
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const items = focusableElements(dialog);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        return;
      }

      const active = document.activeElement;

      if (!(active instanceof Node) || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;

      const navigated = window.location.pathname !== openedAt;
      if (!navigated && restoreScrollRef.current) {
        const previousBehavior = html.style.scrollBehavior;
        html.style.scrollBehavior = "auto";
        window.scrollTo(0, scrollY);
        html.style.scrollBehavior = previousBehavior;
      }

      trigger?.focus({ preventScroll: true });
    };
  }, [onClose, returnFocusRef]);

  const closeInPlace = () => {
    restoreScrollRef.current = true;
    onClose();
  };

  const handleLinkClick = (
    event: { preventDefault: () => void },
    href: string,
  ) => {
    const path = href.split(/[?#]/)[0] || "/";
    if (path === pathname) {
      event.preventDefault();
      closeInPlace();
      return;
    }

    restoreScrollRef.current = false;
    onClose();
  };

  return createPortal(
    <div
      ref={dialogRef}
      id={menuId}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-[60] h-[100dvh] overflow-y-auto overscroll-y-contain bg-black motion-safe:animate-menu-fade md:hidden"
    >
      <div className="sticky top-0 z-10 bg-black">
        <Container className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="text-gold-gradient font-sans text-2xl font-semibold tracking-tight"
            onClick={(event) => handleLinkClick(event, "/")}
          >
            M&A
          </Link>
          <button
            ref={closeButtonRef}
            type="button"
            className={navIconButtonClass}
            aria-label="Zamknij menu"
            onClick={closeInPlace}
          >
            <X strokeWidth={1.5} aria-hidden />
          </button>
        </Container>
      </div>

      <nav
        className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-6 px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]"
        aria-label="Menu mobilne"
      >
        {navLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={menuLinkClass}
            onClick={(event) => handleLinkClick(event, item.href)}
          >
            {item.label}
          </Link>
        ))}
        <a
          href={telHref(site.phone)}
          className="font-sans text-xl text-cream transition-colors duration-300 hover:text-gold"
          onClick={closeInPlace}
        >
          {site.phone}
        </a>
        <AccountEntryLink
          className="font-sans text-xl text-cream transition-colors duration-300 hover:text-gold"
          onClick={(event, href) => handleLinkClick(event, href)}
        />
        <Button
          href={enrollLink.href}
          size="lg"
          className="mt-4"
          onClick={(event) => handleLinkClick(event, enrollLink.href)}
        >
          {enrollLink.label}
        </Button>
      </nav>
    </div>,
    document.body,
  );
}
