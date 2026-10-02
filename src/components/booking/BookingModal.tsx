"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { ContractConsent } from "@/components/legal/ContractConsent";
import { Button } from "@/components/ui/Button";
import { site } from "@/content/site";
import { createClient } from "@/lib/supabase/client";
import { formatBookingWhen, toWarsaw } from "@/lib/datetime";
import type { BookingTarget } from "@/lib/schedule/types";
import type { CustomerKind } from "@/lib/types";
import {
  bookingFormSchema,
  customerKindForSlot,
  DANCE_TYPES,
  formCustomerKindForTarget,
  type BookingFormInput,
  type BookingFormValues,
} from "@/lib/validation";

type BookingModalProps = {
  target: BookingTarget;
  onClose: () => void;
};

type View = "form" | "success" | "error";

export function BookingModal({ target, onClose }: BookingModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const summaryId = useId();
  const router = useRouter();
  const [view, setView] = useState<View>("form");
  const [errorMessage, setErrorMessage] = useState("");
  const [accountHref, setAccountHref] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState("");
  const initialCustomerKind = formCustomerKindForTarget({
    bookingKind: target.kind,
    classSlug: target.classSlug,
    isPair: target.isPair,
  });
  const location = site.locations.find((item) => item.id === target.locationId);
  const when = formatBookingWhen(
    toWarsaw(target.startsAt),
    toWarsaw(target.endsAt),
  );

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormInput, unknown, BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      customerKind: initialCustomerKind,
      firstName: "",
      lastName: "",
      partnerFirstName: "",
      partnerLastName: "",
      guardianFirstName: "",
      guardianLastName: "",
      phone: "",
      email: "",
      message: "",
      danceType: "",
      paymentOption: "full",
      consentRodo: false,
      consentContract: false,
      website: "",
    } as BookingFormInput,
  });

  const firstNameReg = register("firstName");
  const danceType = watch("danceType");
  const customerKind = watch("customerKind") as CustomerKind;
  const pairErrors = errors as {
    partnerFirstName?: { message?: string };
    partnerLastName?: { message?: string };
  };
  const childErrors = errors as {
    guardianFirstName?: { message?: string };
    guardianLastName?: { message?: string };
  };

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED !== "true") {
      return;
    }
    if (target.kind === "class") {
      return;
    }
    let active = true;
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) {
        return;
      }
      if (data.user.email) {
        setValue("email", data.user.email);
      }
      const profile = await supabase
        .from("account_profiles")
        .select("first_name, last_name, phone")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!active || !profile.data) {
        return;
      }
      const row = profile.data as {
        first_name: string;
        last_name: string;
        phone: string;
      };
      setValue("firstName", row.first_name);
      setValue("lastName", row.last_name);
      setValue("phone", row.phone);
    })();
    return () => {
      active = false;
    };
  }, [setValue, target.kind]);

  useEffect(() => {
    if (target.kind !== "slot") {
      return;
    }
    const next = customerKindForSlot(danceType);
    if (next !== customerKind) {
      setValue("customerKind", next);
    }
  }, [customerKind, danceType, setValue, target.kind]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    firstFieldRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onCancel = (event: Event) => {
      event.preventDefault();
      if (!isSubmitting) {
        onClose();
      }
    };

    dialog.addEventListener("cancel", onCancel);

    return () => {
      document.body.style.overflow = previousOverflow;
      dialog.removeEventListener("cancel", onCancel);
    };
  }, [onClose, isSubmitting]);

  async function onSubmit(values: BookingFormValues) {
    if (target.kind === "slot") {
      const allowed = DANCE_TYPES.includes(
        values.danceType as (typeof DANCE_TYPES)[number],
      );
      if (!allowed) {
        setError("danceType", { message: "Wybierz, czego dotyczą zajęcia." });
        return;
      }
    }

    setView("form");
    setErrorMessage("");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          kind: target.kind,
          targetId: target.id,
          locationId: target.locationId,
          title: target.title,
          startsAt: target.startsAt,
          endsAt: target.endsAt,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        checkoutUrl?: string;
        accountHref?: string;
      };

      if (!response.ok || !payload.ok) {
        setAccountHref(payload.accountHref ?? null);
        setErrorMessage(
          payload.error ?? "Nie udało się zapisać. Spróbuj ponownie.",
        );
        setView("error");
        return;
      }

      if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
        return;
      }

      setSuccessEmail(values.email);
      setView("success");
      router.refresh();
    } catch {
      setErrorMessage("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
      setView("error");
    }
  }

  const busy = isSubmitting;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={summaryId}
      className="booking-dialog w-[calc(100%-2rem)] max-w-lg border border-gold/40 bg-black-soft p-6 text-cream"
      data-kind={target.kind}
      data-id={target.id}
      onClick={(event) => {
        if (event.target === dialogRef.current && !busy) {
          onClose();
        }
      }}
    >
      <div className="max-h-[min(90vh,40rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-script text-4xl text-gold">Zapis</p>
            <h2 id={titleId} className="mt-1 text-xl font-semibold text-cream">
              {target.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!busy) {
                onClose();
              }
            }}
            aria-label="Zamknij"
            className="shrink-0 text-cream hover:text-gold"
          >
            <X strokeWidth={1.5} className="size-6" />
          </button>
        </div>

        <div id={summaryId} className="mt-4 border-t border-white/10 pt-4 text-sm">
          <p className="text-cream">{target.title}</p>
          {location ? (
            <p className="mt-1 text-muted">
              {location.city}, {location.address}
            </p>
          ) : null}
          <p className="mt-1 text-muted">{when}</p>
        </div>

        {view === "success" ? (
          <div className="mt-8 text-center">
            <Check
              strokeWidth={1.5}
              className="mx-auto size-12 text-gold"
              aria-hidden
            />
            <p className="mt-4 text-lg text-cream">Zapis przyjęty!</p>
            <p className="mt-2 text-muted">
              Potwierdzenie wysłaliśmy na {successEmail}.
            </p>
            <p className="mt-4 text-sm text-muted">
              Oddzwonimy albo napiszemy, żeby dopiąć szczegóły. W razie pytań:{" "}
              {site.phone}.
            </p>
            <Button className="mt-8 min-h-11 w-full" onClick={onClose}>
              Zamknij
            </Button>
          </div>
        ) : null}

        {view === "error" ? (
          <div className="mt-8">
            <p className="text-[#E8A0A0]" role="alert">
              {errorMessage}{" "}
              {accountHref ? (
                <Link href={accountHref} className="text-gold hover:text-gold-light">
                  Załóż konto
                </Link>
              ) : null}
            </p>
            <Button
              className="mt-6 min-h-11 w-full"
              onClick={() => setView("form")}
            >
              Spróbuj ponownie
            </Button>
          </div>
        ) : null}

        {view === "form" ? (
          <form
            className="relative mt-6 flex flex-col gap-4"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div
              className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
              aria-hidden="true"
            >
              <label htmlFor="website">Strona www</label>
              <input
                id="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                {...register("website")}
              />
            </div>

            <input type="hidden" {...register("customerKind")} />

            {target.kind === "slot" ? (
              <Field
                label="Czego dotyczą zajęcia?"
                error={errors.danceType?.message}
                htmlFor="booking-dance-type"
              >
                <select
                  id="booking-dance-type"
                  className={fieldClass}
                  aria-invalid={Boolean(errors.danceType)}
                  {...register("danceType")}
                >
                  <option value="">Wybierz…</option>
                  {DANCE_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {customerKind === "child" ? (
              <p className="text-sm text-muted">
                Kontaktujemy się wyłącznie z rodzicem/opiekunem.
              </p>
            ) : null}

            <Field
              label={
                customerKind === "pair"
                  ? "Imię pierwszej osoby"
                  : customerKind === "child"
                    ? "Imię dziecka"
                    : "Imię"
              }
              error={errors.firstName?.message}
              htmlFor="booking-first-name"
            >
              <input
                id="booking-first-name"
                autoComplete="given-name"
                className={fieldClass}
                aria-invalid={Boolean(errors.firstName)}
                {...firstNameReg}
                ref={(element) => {
                  firstNameReg.ref(element);
                  firstFieldRef.current = element;
                }}
              />
            </Field>

            <Field
              label={
                customerKind === "pair"
                  ? "Nazwisko pierwszej osoby"
                  : customerKind === "child"
                    ? "Nazwisko dziecka"
                    : "Nazwisko"
              }
              error={errors.lastName?.message}
              htmlFor="booking-last-name"
            >
              <input
                id="booking-last-name"
                autoComplete="family-name"
                className={fieldClass}
                aria-invalid={Boolean(errors.lastName)}
                {...register("lastName")}
              />
            </Field>

            {customerKind === "pair" ? (
              <>
                <Field
                  label="Imię drugiej osoby"
                  error={pairErrors.partnerFirstName?.message}
                  htmlFor="booking-partner-first-name"
                >
                  <input
                    id="booking-partner-first-name"
                    className={fieldClass}
                    aria-invalid={Boolean(pairErrors.partnerFirstName)}
                    {...register("partnerFirstName" as never)}
                  />
                </Field>
                <Field
                  label="Nazwisko drugiej osoby"
                  error={pairErrors.partnerLastName?.message}
                  htmlFor="booking-partner-last-name"
                >
                  <input
                    id="booking-partner-last-name"
                    className={fieldClass}
                    aria-invalid={Boolean(pairErrors.partnerLastName)}
                    {...register("partnerLastName" as never)}
                  />
                </Field>
              </>
            ) : null}

            {customerKind === "child" ? (
              <>
                <Field
                  label="Imię rodzica/opiekuna"
                  error={childErrors.guardianFirstName?.message}
                  htmlFor="booking-guardian-first-name"
                >
                  <input
                    id="booking-guardian-first-name"
                    className={fieldClass}
                    aria-invalid={Boolean(childErrors.guardianFirstName)}
                    {...register("guardianFirstName" as never)}
                  />
                </Field>
                <Field
                  label="Nazwisko rodzica/opiekuna"
                  error={childErrors.guardianLastName?.message}
                  htmlFor="booking-guardian-last-name"
                >
                  <input
                    id="booking-guardian-last-name"
                    className={fieldClass}
                    aria-invalid={Boolean(childErrors.guardianLastName)}
                    {...register("guardianLastName" as never)}
                  />
                </Field>
              </>
            ) : null}

            <Field
              label={
                customerKind === "pair"
                  ? "Telefon (wspólny)"
                  : customerKind === "child"
                    ? "Telefon do rodzica"
                    : "Telefon"
              }
              error={errors.phone?.message}
              htmlFor="booking-phone"
            >
              <input
                id="booking-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                className={fieldClass}
                aria-invalid={Boolean(errors.phone)}
                {...register("phone")}
              />
            </Field>

            <Field
              label="E-mail"
              error={errors.email?.message}
              htmlFor="booking-email"
            >
              <input
                id="booking-email"
                type="email"
                autoComplete="email"
                className={fieldClass}
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
            </Field>

            <Field
              label="Wiadomość (opcjonalnie)"
              error={errors.message?.message}
              htmlFor="booking-message"
            >
              <textarea
                id="booking-message"
                rows={3}
                maxLength={500}
                className={`${fieldClass} min-h-24 py-2`}
                aria-invalid={Boolean(errors.message)}
                {...register("message")}
              />
            </Field>

            <input type="hidden" value="full" {...register("paymentOption")} />

            <ContractConsent
              tone="muted"
              aria-invalid={Boolean(errors.consentContract)}
              {...register("consentContract")}
              error={errors.consentContract?.message}
            />

            <div>
              <label className="flex items-start gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-gold"
                  aria-invalid={Boolean(errors.consentRodo)}
                  {...register("consentRodo")}
                />
                <span>
                  Wyrażam zgodę na przetwarzanie moich danych osobowych w celu
                  obsługi zapisu — zgodnie z{" "}
                  <Link
                    href="/polityka-prywatnosci"
                    className="text-gold underline-offset-2 hover:underline"
                  >
                    polityką prywatności
                  </Link>
                  .
                </span>
              </label>
              {errors.consentRodo?.message ? (
                <p className="mt-1 text-sm text-[#E8A0A0]" role="alert">
                  {errors.consentRodo.message}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="mt-2 min-h-11 w-full gap-2"
            >
              {busy ? (
                <>
                  <Loader2
                    strokeWidth={1.5}
                    className="size-5 animate-spin"
                    aria-hidden
                  />
                  Wysyłanie…
                </>
              ) : (
                "Przejdź do płatności"
              )}
            </Button>
          </form>
        ) : null}
      </div>
    </dialog>
  );
}

const fieldClass =
  "w-full min-h-11 border border-white/15 bg-black px-3 text-cream";

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-cream">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-sm text-[#E8A0A0]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
