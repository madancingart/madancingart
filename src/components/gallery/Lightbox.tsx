"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef } from "react";
import type { GalleryImage } from "@/content/gallery";

type LightboxProps = {
  images: GalleryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

function preloadSrc(src: string) {
  const image = new window.Image();
  image.src = src;
}

export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const image = images[index];
  const total = images.length;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const prev = images[index - 1];
    const next = images[index + 1];
    if (prev) {
      preloadSrc(prev.src.src);
    }
    if (next) {
      preloadSrc(next.src.src);
    }
  }, [images, index]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const onCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onIndexChange((index - 1 + total) % total);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onIndexChange((index + 1) % total);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const focusable = [
          ...dialog.querySelectorAll<HTMLButtonElement>("button"),
        ];
        if (focusable.length === 0) {
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("keydown", onKeyDown);

    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("keydown", onKeyDown);
    };
  }, [index, onClose, onIndexChange, total]);

  if (!image) {
    return null;
  }

  const goPrev = () => onIndexChange((index - 1 + total) % total);
  const goNext = () => onIndexChange((index + 1) % total);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelId}
      className="gallery-lightbox"
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <p id={labelId} className="sr-only">
        {image.alt}
      </p>

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Zamknij galerię"
        className="absolute top-4 right-4 z-10 text-cream transition-colors hover:text-gold"
      >
        <X strokeWidth={1.5} className="size-8" />
      </button>

      {total > 1 ? (
        <button
          type="button"
          onClick={goPrev}
          aria-label="Poprzednie zdjęcie"
          className="absolute top-1/2 left-2 z-10 -translate-y-1/2 text-cream transition-colors hover:text-gold md:left-6"
        >
          <ChevronLeft strokeWidth={1.5} className="size-10" />
        </button>
      ) : null}

      <figure className="flex max-h-full w-full max-w-5xl flex-col items-center px-14 py-16">
        <Image
          src={image.src}
          alt={image.alt}
          sizes="(max-width: 1280px) 92vw, 1100px"
          className="h-auto max-h-[78vh] w-auto max-w-full object-contain"
          priority
        />
        <figcaption className="mt-4 text-center text-sm tracking-wide text-muted">
          {index + 1} / {total}
        </figcaption>
      </figure>

      {total > 1 ? (
        <button
          type="button"
          onClick={goNext}
          aria-label="Następne zdjęcie"
          className="absolute top-1/2 right-2 z-10 -translate-y-1/2 text-cream transition-colors hover:text-gold md:right-6"
        >
          <ChevronRight strokeWidth={1.5} className="size-10" />
        </button>
      ) : null}
    </dialog>
  );
}
