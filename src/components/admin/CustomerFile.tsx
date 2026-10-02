"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CustomerBillingSection } from "@/components/admin/CustomerBillingSection";
import { CustomerDataSection } from "@/components/admin/CustomerDataSection";
import { CustomerHistory } from "@/components/admin/CustomerHistory";
import { CustomerPackagesSection } from "@/components/admin/CustomerPackagesSection";
import { ToastProvider, useToast } from "@/components/admin/Toast";
import { anonymizeCustomer } from "@/app/admin/(app)/klienci/actions";
import type { CustomerFileData } from "@/lib/admin/get-customer";

export function CustomerFile({ data }: { data: CustomerFileData }) {
  return (
    <ToastProvider>
      <CustomerFileInner data={data} />
    </ToastProvider>
  );
}

function CustomerFileInner({ data }: { data: CustomerFileData }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const anonymized = data.customer.firstName === "Usunięto";

  async function runAnonymize() {
    setPending(true);
    const result = await anonymizeCustomer({ customerId: data.customer.id });
    setPending(false);
    setConfirm(false);
    if (result.ok) {
      toast.push("ok", result.message ?? "Dane usunięte.");
      router.refresh();
    } else {
      toast.push("err", result.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[12px] text-muted">Kartoteka</p>
        <h1 className="text-2xl font-semibold text-cream">
          {data.customer.displayName}
        </h1>
      </div>

      <CustomerDataSection
        key={`${data.customer.id}-${data.customer.firstName === "Usunięto" ? "anon" : "live"}`}
        customer={data.customer}
      />
      <CustomerBillingSection billing={data.billing} />
      <CustomerPackagesSection
        packages={data.packages}
        enrollments={data.enrollments}
        trainers={data.trainers}
      />
      <CustomerHistory items={data.history} />

      <section className="border border-white/10 bg-black-soft p-4">
        <h2 className="text-[15px] font-semibold text-cream">RODO</h2>
        <p className="mt-2 text-[13px] text-muted">
          Usuwa imię, nazwisko, telefon, e-mail, notatki i dane partnera lub
          opiekuna. Rezerwacje zostają (zajętość), pakiety zostają z kwotami.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={pending || anonymized}
          onClick={() => setConfirm(true)}
        >
          Usuń dane klienta
        </Button>
      </section>

      {confirm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-[min(100%,24rem)] border border-white/10 bg-black-soft p-5">
            <h2 className="text-[16px] font-semibold text-cream">
              Usunąć dane osobowe?
            </h2>
            <p className="mt-2 text-[14px] text-muted">
              Tej operacji nie da się cofnąć. Historia pakietów i wpłat
              pozostanie bez danych kontaktowych.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirm(false)}
              >
                Wróć
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => void runAnonymize()}
              >
                Usuń dane
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
