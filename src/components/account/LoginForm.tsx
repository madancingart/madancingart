"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { TurnstileWidget, turnstileSiteKey } from "@/components/account/Turnstile";
import { AccountField, PasswordField, accountFieldClass } from "@/components/account/fields";
import { Button } from "@/components/ui/Button";
import { signInAccount } from "@/app/(site)/konto/actions";
import { publicSiteUrl } from "@/lib/booking/confirmation-window";
import { safeNextPath } from "@/lib/account/redirect";
import { createClient } from "@/lib/supabase/client";
import {
  loginFormSchema,
  type LoginFormInput,
  type LoginFormValues,
} from "@/lib/validation";

const IF_EXISTS = "Jeśli konto istnieje, wysłaliśmy link.";

function callbackUrl(next: string): string {
  return `${publicSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function LoginForm({
  next,
  expiredLink,
}: {
  next: string;
  expiredLink: boolean;
}) {
  const [serverError, setServerError] = useState(
    expiredLink ? "Link wygasł albo był już użyty — wyślij nowy." : "",
  );
  const [notice, setNotice] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [busy, setBusy] = useState<"password" | "otp" | "reset" | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  function captchaReady(): boolean {
    if (!turnstileSiteKey || captchaToken) {
      return true;
    }
    setServerError("Potwierdź, że nie jesteś automatem.");
    return false;
  }

  const onPassword = handleSubmit(async (values) => {
    setNotice("");
    setServerError("");
    if (!captchaReady()) {
      return;
    }
    setBusy("password");
    const result = await signInAccount({
      email: values.email,
      password: values.password,
      next,
      captchaToken: captchaToken ?? undefined,
    });
    setBusy(null);
    setResetSignal((current) => current + 1);
    setServerError(result.error);
  });

  async function sendLink(kind: "otp" | "reset") {
    setNotice("");
    setServerError("");
    const email = getValues("email").trim();
    if (!email) {
      setServerError("Podaj adres e-mail.");
      return;
    }
    if (!captchaReady()) {
      return;
    }
    setBusy(kind);
    const supabase = createClient();
    const captcha = captchaToken ?? undefined;
    const { error } =
      kind === "reset"
        ? await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: callbackUrl("/konto/nowe-haslo"),
            captchaToken: captcha,
          })
        : await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: callbackUrl(safeNextPath(next)),
              captchaToken: captcha,
              shouldCreateUser: false,
            },
          });
    setBusy(null);
    setResetSignal((current) => current + 1);
    if (error && !/user|not found|signups not allowed/i.test(error.message)) {
      setServerError("Nie udało się wysłać linku. Spróbuj za chwilę.");
      return;
    }
    setNotice(IF_EXISTS);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onPassword} noValidate>
      {serverError ? (
        <p className="text-sm text-[#E8A0A0]" role="alert">
          {serverError}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-cream" role="status">
          {notice}
        </p>
      ) : null}

      <AccountField label="E-mail" htmlFor="login-email" error={errors.email?.message}>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          className={accountFieldClass}
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </AccountField>
      <PasswordField
        id="login-password"
        label="Hasło"
        autoComplete="current-password"
        error={errors.password?.message}
        registration={register("password")}
      />

      <TurnstileWidget onToken={setCaptchaToken} resetSignal={resetSignal} />

      <Button type="submit" disabled={busy !== null} className="min-h-11 w-full">
        {busy === "password" ? "Logowanie…" : "Zaloguj się"}
      </Button>
      <button
        type="button"
        className="text-left text-sm text-gold hover:text-gold-light"
        disabled={busy !== null}
        onClick={() => void sendLink("otp")}
      >
        {busy === "otp" ? "Wysyłanie…" : "Wyślij mi link do logowania"}
      </button>
      <button
        type="button"
        className="text-left text-sm text-gold hover:text-gold-light"
        disabled={busy !== null}
        onClick={() => void sendLink("reset")}
      >
        {busy === "reset" ? "Wysyłanie…" : "Nie pamiętam hasła"}
      </button>
      <p className="text-sm text-muted">
        Nie masz konta?{" "}
        <Link
          href={`/konto/rejestracja?next=${encodeURIComponent(next)}`}
          className="text-gold hover:text-gold-light"
        >
          Załóż konto
        </Link>
      </p>
    </form>
  );
}
