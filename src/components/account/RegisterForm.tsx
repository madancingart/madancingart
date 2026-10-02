"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { InterestChips, type ClassTypeOption } from "@/components/account/InterestChips";
import { TurnstileWidget, turnstileSiteKey } from "@/components/account/Turnstile";
import { AccountField, PasswordField, accountFieldClass } from "@/components/account/fields";
import { Button } from "@/components/ui/Button";
import { publicSiteUrl } from "@/lib/booking/confirmation-window";
import { createClient } from "@/lib/supabase/client";
import {
  registerFormSchema,
  type RegisterFormInput,
  type RegisterFormValues,
} from "@/lib/validation";

const KINDS = [
  { value: "self", label: "Siebie" },
  { value: "pair", label: "Nas — parę" },
  { value: "child", label: "Dziecko" },
] as const;

function callbackUrl(next: string): string {
  return `${publicSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function RegisterForm({
  next,
  classTypes,
}: {
  next: string;
  classTypes: ClassTypeOption[];
}) {
  const [phase, setPhase] = useState<"form" | "inbox">("form");
  const [sentTo, setSentTo] = useState("");
  const [serverError, setServerError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [resendError, setResendError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      participantKind: "self",
      partnerFirstName: "",
      partnerLastName: "",
      childFirstName: "",
      childLastName: "",
      interests: [],
      consentTerms: false,
      consentRodo: false,
    },
  });

  const kind = watch("participantKind");
  const interests = watch("interests") ?? [];

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    if (turnstileSiteKey && !captchaToken) {
      setServerError("Potwierdź, że nie jesteś automatem.");
      return;
    }

    const participant =
      values.participantKind === "child"
        ? {
            participant_kind: "child" as const,
            participant_first_name: values.childFirstName,
            participant_last_name: values.childLastName,
            partner_first_name: null,
            partner_last_name: null,
          }
        : values.participantKind === "pair"
          ? {
              participant_kind: "pair" as const,
              participant_first_name: values.firstName,
              participant_last_name: values.lastName,
              partner_first_name: values.partnerFirstName,
              partner_last_name: values.partnerLastName,
            }
          : {
              participant_kind: "adult" as const,
              participant_first_name: values.firstName,
              participant_last_name: values.lastName,
              partner_first_name: null,
              partner_last_name: null,
            };

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: callbackUrl(next),
        captchaToken: captchaToken ?? undefined,
        data: {
          first_name: values.firstName,
          last_name: values.lastName,
          phone: values.phone,
          interests: values.interests,
          ...participant,
        },
      },
    });

    if (error) {
      setResetSignal((current) => current + 1);
      setServerError(
        error.message.toLowerCase().includes("already")
          ? "Nie udało się utworzyć konta. Jeśli korzystasz z tego adresu, zaloguj się."
          : "Nie udało się utworzyć konta. Spróbuj ponownie za chwilę.",
      );
      return;
    }

    setSentTo(values.email);
    setSeconds(60);
    setPhase("inbox");
  });

  async function resend() {
    if (seconds > 0 || !sentTo) {
      return;
    }
    setResendError("");
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: sentTo,
      options: {
        emailRedirectTo: callbackUrl(next),
        captchaToken: captchaToken ?? undefined,
      },
    });
    if (error) {
      setResendError("Nie udało się wysłać maila. Spróbuj za chwilę.");
      return;
    }
    setSeconds(60);
  }

  if (phase === "inbox") {
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="text-cream">
          Sprawdź skrzynkę <span className="text-gold">{sentTo}</span>. Link
          aktywuje konto.
        </p>
        <p className="text-sm text-muted">
          Jeśli maila nie ma, sprawdź foldery Oferty i Spam.
        </p>
        {resendError ? (
          <p className="text-sm text-[#E8A0A0]" role="alert">
            {resendError}
          </p>
        ) : null}
        <Button type="button" variant="outline" disabled={seconds > 0} onClick={() => void resend()}>
          {seconds > 0 ? `Wyślij ponownie (${seconds} s)` : "Wyślij ponownie"}
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {serverError ? (
        <p className="text-sm text-[#E8A0A0]" role="alert">
          {serverError}
        </p>
      ) : null}

      <AccountField label="Imię" htmlFor="reg-first" error={errors.firstName?.message}>
        <input id="reg-first" autoComplete="given-name" className={accountFieldClass} aria-invalid={Boolean(errors.firstName)} {...register("firstName")} />
      </AccountField>
      <AccountField label="Nazwisko" htmlFor="reg-last" error={errors.lastName?.message}>
        <input id="reg-last" autoComplete="family-name" className={accountFieldClass} aria-invalid={Boolean(errors.lastName)} {...register("lastName")} />
      </AccountField>
      <AccountField label="E-mail" htmlFor="reg-email" error={errors.email?.message}>
        <input id="reg-email" type="email" autoComplete="email" className={accountFieldClass} aria-invalid={Boolean(errors.email)} {...register("email")} />
      </AccountField>
      <AccountField label="Telefon" htmlFor="reg-phone" error={errors.phone?.message}>
        <input id="reg-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+48" className={accountFieldClass} aria-invalid={Boolean(errors.phone)} {...register("phone")} />
      </AccountField>
      <PasswordField
        id="reg-password"
        label="Hasło"
        autoComplete="new-password"
        error={errors.password?.message}
        registration={register("password")}
      />

      <fieldset>
        <legend className="mb-2 text-sm text-cream">Kogo zapisujesz?</legend>
        <div className="flex flex-col gap-2">
          {KINDS.map((item) => (
            <label key={item.value} className="flex min-h-11 items-center gap-3 text-cream">
              <input type="radio" value={item.value} className="accent-(--gold)" {...register("participantKind")} />
              {item.label}
            </label>
          ))}
        </div>
        {errors.participantKind?.message ? (
          <p className="mt-1 text-sm text-[#E8A0A0]" role="alert">
            {errors.participantKind.message}
          </p>
        ) : null}
      </fieldset>

      {kind === "pair" ? (
        <>
          <AccountField label="Imię partnera lub partnerki" htmlFor="reg-partner-first" error={errors.partnerFirstName?.message}>
            <input id="reg-partner-first" className={accountFieldClass} aria-invalid={Boolean(errors.partnerFirstName)} {...register("partnerFirstName")} />
          </AccountField>
          <AccountField label="Nazwisko partnera lub partnerki" htmlFor="reg-partner-last" error={errors.partnerLastName?.message}>
            <input id="reg-partner-last" className={accountFieldClass} aria-invalid={Boolean(errors.partnerLastName)} {...register("partnerLastName")} />
          </AccountField>
        </>
      ) : null}

      {kind === "child" ? (
        <>
          <p className="text-sm text-muted">Kolejne dzieci dodasz w panelu.</p>
          <AccountField label="Imię dziecka" htmlFor="reg-child-first" error={errors.childFirstName?.message}>
            <input id="reg-child-first" className={accountFieldClass} aria-invalid={Boolean(errors.childFirstName)} {...register("childFirstName")} />
          </AccountField>
          <AccountField label="Nazwisko dziecka" htmlFor="reg-child-last" error={errors.childLastName?.message}>
            <input id="reg-child-last" className={accountFieldClass} aria-invalid={Boolean(errors.childLastName)} {...register("childLastName")} />
          </AccountField>
        </>
      ) : null}

      <InterestChips
        options={classTypes}
        value={interests}
        onChange={(nextInterests) => setValue("interests", nextInterests, { shouldDirty: true })}
      />

      <label className="flex items-start gap-3 text-sm text-cream">
        <input type="checkbox" className="mt-1 accent-(--gold)" {...register("consentTerms")} />
        <span>
          Akceptuję{" "}
          <Link href="/regulamin" className="text-gold hover:text-gold-light">
            regulamin
          </Link>
          .
        </span>
      </label>
      {errors.consentTerms?.message ? (
        <p className="text-sm text-[#E8A0A0]" role="alert">
          {errors.consentTerms.message}
        </p>
      ) : null}

      <label className="flex items-start gap-3 text-sm text-cream">
        <input type="checkbox" className="mt-1 accent-(--gold)" {...register("consentRodo")} />
        <span>
          Wyrażam zgodę na przetwarzanie danych zgodnie z{" "}
          <Link href="/polityka-prywatnosci" className="text-gold hover:text-gold-light">
            polityką prywatności
          </Link>
          .
        </span>
      </label>
      {errors.consentRodo?.message ? (
        <p className="text-sm text-[#E8A0A0]" role="alert">
          {errors.consentRodo.message}
        </p>
      ) : null}

      <TurnstileWidget onToken={setCaptchaToken} resetSignal={resetSignal} />

      <Button type="submit" disabled={isSubmitting} className="min-h-11 w-full">
        {isSubmitting ? "Wysyłanie…" : "Załóż konto"}
      </Button>
      <p className="text-sm text-muted">
        <Link href={`/konto/logowanie?next=${encodeURIComponent(next)}`} className="text-gold hover:text-gold-light">
          Mam już konto
        </Link>
      </p>
    </form>
  );
}
