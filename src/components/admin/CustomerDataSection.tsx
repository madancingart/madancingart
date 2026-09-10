"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  updateCustomer,
  updateCustomerNotes,
} from "@/app/admin/(app)/klienci/actions";
import type { CustomerFileRecord } from "@/lib/admin/get-customer";
import type { CustomerKind } from "@/lib/types";
import { useToast } from "@/components/admin/Toast";

const fieldClass =
  "mt-1 min-h-11 w-full border border-white/10 bg-black px-3 text-[13px] text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

type FormState = {
  kind: CustomerKind;
  firstName: string;
  lastName: string;
  partnerFirstName: string;
  partnerLastName: string;
  guardianName: string;
  guardianPhone: string;
  phone: string;
  email: string;
};

function toForm(customer: CustomerFileRecord): FormState {
  return {
    kind: customer.kind,
    firstName: customer.firstName,
    lastName: customer.lastName,
    partnerFirstName: customer.partnerFirstName ?? "",
    partnerLastName: customer.partnerLastName ?? "",
    guardianName: customer.guardianName ?? "",
    guardianPhone: customer.guardianPhone ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
  };
}

export function CustomerDataSection({
  customer,
}: {
  customer: CustomerFileRecord;
}) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState(() => toForm(customer));
  const formRef = useRef(form);
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    if (notes === (customer.notes ?? "")) {
      return;
    }
    const handle = window.setTimeout(() => {
      void updateCustomerNotes({
        customerId: customer.id,
        notes,
      }).then((result) => {
        if (!result.ok) {
          toast.push("err", result.error);
        }
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [notes, customer.id, customer.notes, toast]);

  async function persist(next: FormState) {
    const initial = toForm(customer);
    if (JSON.stringify(next) === JSON.stringify(initial)) {
      return;
    }
    setSaving(true);
    const result = await updateCustomer({
      customerId: customer.id,
      kind: next.kind,
      firstName: next.firstName,
      lastName: next.lastName,
      partnerFirstName: next.partnerFirstName,
      partnerLastName: next.partnerLastName,
      guardianName: next.guardianName,
      guardianPhone: next.guardianPhone,
      phone: next.phone,
      email: next.email,
    });
    setSaving(false);
    if (result.ok) {
      router.refresh();
    } else {
      toast.push("err", result.error);
    }
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="border border-white/10 bg-black-soft p-4">
      <h2 className="text-[15px] font-semibold text-cream">Dane</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] text-muted">
          Rodzaj
          <select
            value={form.kind}
            onChange={(event) => {
              const kind = event.target.value as CustomerKind;
              const next = { ...form, kind };
              setForm(next);
              void persist(next);
            }}
            className={fieldClass}
          >
            <option value="adult">Osoba dorosła</option>
            <option value="pair">Para</option>
            <option value="child">Dziecko</option>
          </select>
        </label>
        <div className="hidden sm:block" />
        <label className="text-[12px] text-muted">
          Imię
          <input
            value={form.firstName}
            onChange={(event) => patch("firstName", event.target.value)}
            onBlur={() => void persist(formRef.current)}
            className={fieldClass}
          />
        </label>
        <label className="text-[12px] text-muted">
          Nazwisko
          <input
            value={form.lastName}
            onChange={(event) => patch("lastName", event.target.value)}
            onBlur={() => void persist(formRef.current)}
            className={fieldClass}
          />
        </label>
        {form.kind === "pair" ? (
          <>
            <label className="text-[12px] text-muted">
              Imię partnera
              <input
                value={form.partnerFirstName}
                onChange={(event) =>
                  patch("partnerFirstName", event.target.value)
                }
                onBlur={() => void persist(formRef.current)}
                className={fieldClass}
              />
            </label>
            <label className="text-[12px] text-muted">
              Nazwisko partnera
              <input
                value={form.partnerLastName}
                onChange={(event) =>
                  patch("partnerLastName", event.target.value)
                }
                onBlur={() => void persist(formRef.current)}
                className={fieldClass}
              />
            </label>
          </>
        ) : null}
        {form.kind === "child" ? (
          <>
            <label className="text-[12px] text-muted">
              Opiekun
              <input
                value={form.guardianName}
                onChange={(event) => patch("guardianName", event.target.value)}
                onBlur={() => void persist(formRef.current)}
                className={fieldClass}
              />
            </label>
            <label className="text-[12px] text-muted">
              Telefon opiekuna
              <input
                value={form.guardianPhone}
                onChange={(event) => patch("guardianPhone", event.target.value)}
                onBlur={() => void persist(formRef.current)}
                className={fieldClass}
              />
            </label>
          </>
        ) : null}
        <label className="text-[12px] text-muted">
          Telefon
          <input
            value={form.phone}
            onChange={(event) => patch("phone", event.target.value)}
            onBlur={() => void persist(formRef.current)}
            className={fieldClass}
          />
        </label>
        <label className="text-[12px] text-muted">
          E-mail
          <input
            type="email"
            value={form.email}
            onChange={(event) => patch("email", event.target.value)}
            onBlur={() => void persist(formRef.current)}
            className={fieldClass}
          />
        </label>
      </div>
      <label className="mt-3 block text-[12px] text-muted">
        Notatki
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={5}
          className="mt-1 w-full border border-white/10 bg-black px-3 py-2 text-[13px] text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        />
      </label>
      <p className="mt-2 text-[12px] text-muted">
        {saving ? "Zapisuję…" : "Notatki zapisują się automatycznie."}
      </p>
      <div className="mt-3 sm:hidden">
        <Button type="button" size="sm" onClick={() => void persist(formRef.current)}>
          Zapisz dane
        </Button>
      </div>
    </section>
  );
}
