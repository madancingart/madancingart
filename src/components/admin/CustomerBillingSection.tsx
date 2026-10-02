"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/account/panel/StatusPill";
import { Button } from "@/components/ui/Button";
import { inviteCustomerAction } from "@/app/admin/(app)/rozliczenia/actions";
import type { CustomerBillingView } from "@/lib/admin/get-customer";
import { formatBillingZloty } from "@/lib/billing/status";
import { formatDatePl } from "@/lib/datetime";

export function CustomerBillingSection({ billing }: { billing: CustomerBillingView }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <section className="border border-white/10 bg-black-soft p-4">
      <h2 className="text-[15px] font-semibold text-cream">Rozliczenia</h2>
      <p className="mt-2 text-[13px] text-muted">
        {billing.hasAccount ? "Konto aktywne." : "Brak konta."}
      </p>
      {!billing.hasAccount && billing.email ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void inviteCustomerAction({ email: billing.email }).then((result) => {
              setPending(false);
              setMessage(result.ok ? result.message : result.error);
              if (result.ok) {
                router.refresh();
              }
            });
          }}
        >
          Wyślij zaproszenie
        </Button>
      ) : null}
      {message ? <p className="mt-2 text-[12px] text-muted">{message}</p> : null}

      <h3 className="mt-5 text-[13px] text-cream">Zapisy</h3>
      {billing.enrollments.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">Brak zapisów stałych.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {billing.enrollments.map((item) => (
            <li key={item.id} className="text-[13px] text-cream">
              {item.className} · {item.statusLabel}
              {item.paidUntil ? ` · opłacone do ${formatDatePl(item.paidUntil)}` : ""}
              <span className="mt-1 block">
                <StatusPill tone={item.tone} label={item.label} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-5 text-[13px] text-cream">Należności</h3>
      {billing.charges.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">Brak należności.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {billing.charges.map((item) => (
            <li key={item.id} className="text-[13px] text-muted">
              <span className="text-cream">{item.className}</span>
              {item.period ? ` · ${item.period}` : ""} · {formatBillingZloty(item.amountCents)} ·{" "}
              {formatDatePl(item.dueDate)}
              <span className="mt-1 block">
                <StatusPill tone={item.tone} label={item.label} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
