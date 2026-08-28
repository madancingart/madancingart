"use client";

import Image from "next/image";
import { useState } from "react";
import type { GalleryImage } from "@/content/gallery";
import { Lightbox } from "@/components/gallery/Lightbox";

type GalleryMasonryProps = {
  images: GalleryImage[];
};

export function GalleryMasonry({ images }: GalleryMasonryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <p className="mt-10 text-muted">W tej kategorii nie ma jeszcze zdjęć.</p>
    );
  }

  return (
    <>
      <ul className="mt-10 columns-1 gap-4 md:columns-2 lg:columns-3">
        {images.map((image, index) => (
          <li key={image.id} className="mb-4 break-inside-avoid">
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`${image.alt}. Otwórz w pełnym rozmiarze`}
              className="group relative block w-full overflow-hidden border border-transparent transition-colors duration-300 hover:border-gold focus-visible:border-gold"
            >
              <Image
                src={image.src}
                alt={image.alt}
                sizes="(max-width: 768px) 92vw, (max-width: 1024px) 46vw, 380px"
                quality={60}
                className="h-auto w-full transition-opacity duration-300 group-hover:opacity-70"
              />
              <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/35" />
            </button>
          </li>
        ))}
      </ul>

      {activeIndex !== null ? (
        <Lightbox
          images={images}
          index={activeIndex}
          onIndexChange={setActiveIndex}
          onClose={() => setActiveIndex(null)}
        />
      ) : null}
    </>
  );
}
