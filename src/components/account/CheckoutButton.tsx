"use client";

import { useState } from "react";
import { startOwnedCheckout, startTokenCheckout } from "@/app/(site)/zaplac/actions";
import { Button } from "@/components/ui/Button";

export function CheckoutButton({
  label,
  token,
  chargeId,
}: {
  label: string;
  token?: string;
  chargeId?: string;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function pay() {
    setPending(true);
    setError("");
    const result = token
      ? await startTokenCheckout(token)
      : chargeId
        ? await startOwnedCheckout(chargeId)
        : { error: "Nie znaleziono tej płatności." };
    if ("url" in result) {
      window.location.assign(result.url);
      return;
    }
    setError(result.error);
    setPending(false);
  }

  return (
    <div className="space-y-2">
      <Button type="button" className="min-h-11 w-full" disabled={pending} onClick={() => void pay()}>
        {pending ? "Otwieranie płatności…" : label}
      </Button>
      {error ? (
        <p className="text-sm text-[#E8A0A0]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
