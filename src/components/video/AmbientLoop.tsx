"use client";

import Image, { type StaticImageData } from "next/image";
import { useSyncExternalStore } from "react";

type AmbientLoopProps = {
  src: string;
  poster: StaticImageData;
  label: string;
};

type NetworkInformation = EventTarget & {
  saveData?: boolean;
};

function connection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function stayOnPoster(): boolean {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduce || connection()?.saveData === true;
}

function serverPoster() {
  return true;
}

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  connection()?.addEventListener("change", onStoreChange);
  return () => {
    media.removeEventListener("change", onStoreChange);
    connection()?.removeEventListener("change", onStoreChange);
  };
}

export function AmbientLoop({ src, poster, label }: AmbientLoopProps) {
  const posterOnly = useSyncExternalStore(subscribe, stayOnPoster, serverPoster);

  if (posterOnly) {
    return (
      <div className="relative aspect-video overflow-hidden border border-gold bg-black">
        <Image
          src={poster}
          alt={label}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-contain"
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden border border-gold bg-black">
      <video
        className="absolute inset-0 h-full w-full object-contain"
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        poster={poster.src}
        aria-label={label}
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}
