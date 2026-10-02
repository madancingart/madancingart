"use client";

import { useState } from "react";

type MapFacadeProps = {
  src: string;
  title: string;
};

export function MapFacade({ src, title }: MapFacadeProps) {
  const [visible, setVisible] = useState(false);

  if (!visible) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center border border-white/10 bg-black px-6">
        <button
          type="button"
          className="border border-gold px-5 py-2.5 text-gold transition-colors duration-300 hover:bg-gold/10"
          onClick={() => setVisible(true)}
        >
          Pokaż mapę
        </button>
      </div>
    );
  }

  return (
    <iframe
      title={title}
      src={src}
      className="aspect-[16/10] w-full border-0"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
