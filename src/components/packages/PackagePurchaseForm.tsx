"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { formatPlnFromCents } from "@/lib/money";
import { isPaymentsEnabled } from "@/lib/validation";
import {
  packagePurchaseSchema,
  type PackagePurchaseInput,
  type PackagePurchaseValues,
} from "@/lib/validation";
import type { WeddingPackageDef } from "@/content/packages";
import { warsawTodayIso } from "@/lib/datetime";

const fieldClass =
  "w-full min-h-11 border border-white/15 bg-black px-3 text-cream";

type PackagePurchaseFormProps = {
  packages: readonly WeddingPackageDef[];
  initialKind: WeddingPackageDef["kind"];
};

export function PackagePurchaseForm({
  packages,
  initialKind,
}: PackagePurchaseFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const paymentsOn = isPaymentsEnabled();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PackagePurchaseInput, unknown, PackagePurchaseValues>({
    resolver: zodResolver(packagePurchaseSchema),
    defaultValues: {
      packageKind: initialKind,
      firstName: "",
      lastName: "",
      partnerFirstName: "",
      partnerLastName: "",
      phone: "",
      email: "",
      weddingDate: "",
      songs: [{ title: "", artist: "" }],
      consentRodo: false,
      website: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "songs",
  });

  const selectedKind = watch("packageKind");
  const selected = packages.find((item) => item.kind === selectedKind);

  async function onSubmit(values: PackagePurchaseValues) {
    setSubmitError("");
    const response = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      checkoutUrl?: string | null;
    };
    if (!response.ok || !payload.ok) {
      setSubmitError(payload.error ?? "Nie udało się wysłać zgłoszenia.");
      return;
    }
    if (payload.checkoutUrl) {
      window.location.href = payload.checkoutUrl;
      return;
    }
    router.push("/pierwszy-taniec/pakiety/dziekujemy");
  }

  const minDate = (() => {
    const [year, month, day] = warsawTodayIso().split("-").map(Number) as [
      number,
      number,
      number,
    ];
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    return next.toISOString().slice(0, 10);
  })();

  return (
    <form
      className="relative mt-10 flex flex-col gap-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div
        className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="pkg-website">Strona www</label>
        <input
          id="pkg-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>

      <fieldset>
        <legend className="mb-3 text-sm text-cream">Pakiet</legend>
        <div className="flex flex-col gap-2">
          {packages.map((item) => (
            <label
              key={item.kind}
              className="flex min-h-11 items-center gap-3 border border-white/10 px-3 text-sm text-cream"
            >
              <input
                type="radio"
                value={item.kind}
                {...register("packageKind")}
              />
              <span>
                {item.label}{" "}
                <span className="text-gold">
                  {formatPlnFromCents(item.priceCents)}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.packageKind?.message ? (
          <p className="mt-1 text-sm text-[#E8A0A0]" role="alert">
            {errors.packageKind.message}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Imię pierwszej osoby"
          htmlFor="pkg-first-name"
          error={errors.firstName?.message}
        >
          <input
            id="pkg-first-name"
            autoComplete="given-name"
            className={fieldClass}
            {...register("firstName")}
          />
        </Field>
        <Field
          label="Nazwisko pierwszej osoby"
          htmlFor="pkg-last-name"
          error={errors.lastName?.message}
        >
          <input
            id="pkg-last-name"
            autoComplete="family-name"
            className={fieldClass}
            {...register("lastName")}
          />
        </Field>
        <Field
          label="Imię drugiej osoby"
          htmlFor="pkg-partner-first"
          error={errors.partnerFirstName?.message}
        >
          <input
            id="pkg-partner-first"
            className={fieldClass}
            {...register("partnerFirstName")}
          />
        </Field>
        <Field
          label="Nazwisko drugiej osoby"
          htmlFor="pkg-partner-last"
          error={errors.partnerLastName?.message}
        >
          <input
            id="pkg-partner-last"
            className={fieldClass}
            {...register("partnerLastName")}
          />
        </Field>
      </div>

      <Field
        label="Telefon (wspólny)"
        htmlFor="pkg-phone"
        error={errors.phone?.message}
      >
        <input
          id="pkg-phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          className={fieldClass}
          {...register("phone")}
        />
      </Field>

      <Field label="E-mail" htmlFor="pkg-email" error={errors.email?.message}>
        <input
          id="pkg-email"
          type="email"
          autoComplete="email"
          className={fieldClass}
          {...register("email")}
        />
      </Field>

      <Field
        label="Data wesela"
        htmlFor="pkg-wedding-date"
        error={errors.weddingDate?.message}
      >
        <input
          id="pkg-wedding-date"
          type="date"
          min={minDate}
          className={fieldClass}
          {...register("weddingDate")}
        />
      </Field>

      <div>
        <p className="mb-2 text-sm text-cream">Propozycje piosenek</p>
        <ul className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <li key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                aria-label={`Utwór ${index + 1}`}
                placeholder="Utwór"
                className={fieldClass}
                {...register(`songs.${index}.title`)}
              />
              <input
                aria-label={`Wykonawca ${index + 1}`}
                placeholder="Wykonawca"
                className={fieldClass}
                {...register(`songs.${index}.artist`)}
              />
              {fields.length > 1 ? (
                <button
                  type="button"
                  className="flex min-h-11 items-center justify-center text-muted hover:text-gold"
                  aria-label="Usuń propozycję"
                  onClick={() => remove(index)}
                >
                  <Trash2 strokeWidth={1.5} className="size-5" />
                </button>
              ) : (
                <span className="hidden sm:block" />
              )}
              {errors.songs?.[index]?.title?.message ? (
                <p className="text-sm text-[#E8A0A0] sm:col-span-3" role="alert">
                  {errors.songs[index].title?.message}
                </p>
              ) : null}
              {errors.songs?.[index]?.artist?.message ? (
                <p className="text-sm text-[#E8A0A0] sm:col-span-3" role="alert">
                  {errors.songs[index].artist?.message}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {errors.songs?.message || errors.songs?.root?.message ? (
          <p className="mt-1 text-sm text-[#E8A0A0]" role="alert">
            {errors.songs.message ?? errors.songs.root?.message}
          </p>
        ) : null}
        {fields.length < 5 ? (
          <button
            type="button"
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-gold hover:text-gold-light"
            onClick={() => append({ title: "", artist: "" })}
          >
            <Plus strokeWidth={1.5} className="size-4" />
            Dodaj kolejną propozycję
          </button>
        ) : null}
      </div>

      <p className="text-sm text-muted">
        {paymentsOn
          ? selected
            ? `Po wysłaniu przejdziesz do płatności ${formatPlnFromCents(selected.priceCents)}.`
            : "Po wysłaniu przejdziesz do płatności online."
          : "Płatność na miejscu — po wpłacie aktywujemy pakiet i umówimy pierwszą lekcję."}
      </p>

      <div>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-gold"
            {...register("consentRodo")}
          />
          <span>
            Wyrażam zgodę na przetwarzanie moich danych osobowych w celu obsługi
            zakupu pakietu — zgodnie z{" "}
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

      {submitError ? (
        <p className="text-sm text-[#E8A0A0]" role="alert">
          {submitError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="mt-2 min-h-11 w-full gap-2">
        {isSubmitting ? (
          <>
            <Loader2
              strokeWidth={1.5}
              className="size-5 animate-spin"
              aria-hidden
            />
            Wysyłanie…
          </>
        ) : paymentsOn ? (
          "Przejdź do płatności"
        ) : (
          "Wyślij zgłoszenie"
        )}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
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
