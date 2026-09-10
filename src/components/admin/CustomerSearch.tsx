"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function CustomerSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (value.trim() === initialQuery.trim()) {
      return;
    }
    const handle = window.setTimeout(() => {
      const trimmed = value.trim();
      const href = trimmed
        ? `${pathname}?q=${encodeURIComponent(trimmed)}`
        : pathname;
      router.replace(href, { scroll: false });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [value, initialQuery, pathname, router]);

  return (
    <label className="block text-[12px] text-muted">
      Szukaj po nazwisku, imieniu, telefonie lub e-mailu
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Kowalska, 512 345, anna@"
        className="mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-[14px] text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      />
    </label>
  );
}
