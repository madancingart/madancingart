import Link from "next/link";
import type { ComponentProps } from "react";

export function ContractConsent({
  error,
  tone = "cream",
  ...input
}: {
  error?: string;
  tone?: "cream" | "muted";
} & ComponentProps<"input">) {
  const text = tone === "cream" ? "text-cream" : "text-muted";

  return (
    <div>
      <label className={`flex items-start gap-3 text-sm ${text}`}>
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-(--gold)"
          {...input}
        />
        <span>
          Akceptuję{" "}
          <Link
            href="/umowa"
            className="text-gold hover:text-gold-light"
            onClick={(event) => event.stopPropagation()}
          >
            umowę
          </Link>{" "}
          oraz{" "}
          <Link
            href="/regulamin-zajec"
            className="text-gold hover:text-gold-light"
            onClick={(event) => event.stopPropagation()}
          >
            regulamin zajęć
          </Link>
          .
        </span>
      </label>
      {error ? (
        <p className="mt-1 text-sm text-[#E8A0A0]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
