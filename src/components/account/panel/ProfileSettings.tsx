"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AccountField, PasswordField, accountFieldClass } from "@/components/account/fields";
import { Button } from "@/components/ui/Button";
import { requestAccountDeletion } from "@/app/(site)/konto/actions";
import { participantRpcMessage } from "@/lib/account/rpc-errors";
import { createClient } from "@/lib/supabase/client";
import {
  accountProfileSchema,
  changeEmailSchema,
  newPasswordSchema,
  type AccountProfileInput,
  type AccountProfileValues,
  type ChangeEmailInput,
  type ChangeEmailValues,
  type NewPasswordInput,
  type NewPasswordValues,
} from "@/lib/validation";

export function ProfileSettings({
  firstName,
  lastName,
  phone,
  email,
  interests,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  interests: string[];
}) {
  return (
    <div className="space-y-8">
      <ProfileForm
        firstName={firstName}
        lastName={lastName}
        phone={phone}
        interests={interests}
      />
      <EmailForm currentEmail={email} />
      <PasswordForm />
      <SignOutButton />
      <DeleteAccount />
    </div>
  );
}

function ProfileForm({
  firstName,
  lastName,
  phone,
  interests,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  interests: string[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountProfileInput, unknown, AccountProfileValues>({
    resolver: zodResolver(accountProfileSchema),
    defaultValues: { firstName, lastName, phone },
  });

  async function onSubmit(values: AccountProfileValues) {
    setMessage("");
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("upsert_my_profile", {
      p_first_name: values.firstName,
      p_last_name: values.lastName,
      p_phone: values.phone,
      p_interests: interests,
    });
    if (rpcError) {
      setError(participantRpcMessage(rpcError.message));
      return;
    }
    setMessage("Zapisaliśmy profil.");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg text-cream">Dane</h2>
      <AccountField label="Imię" htmlFor="profile-first" error={errors.firstName?.message}>
        <input id="profile-first" autoComplete="given-name" className={accountFieldClass} {...register("firstName")} />
      </AccountField>
      <AccountField label="Nazwisko" htmlFor="profile-last" error={errors.lastName?.message}>
        <input id="profile-last" autoComplete="family-name" className={accountFieldClass} {...register("lastName")} />
      </AccountField>
      <AccountField label="Telefon" htmlFor="profile-phone" error={errors.phone?.message}>
        <input id="profile-phone" type="tel" autoComplete="tel" placeholder="+48" className={accountFieldClass} {...register("phone")} />
      </AccountField>
      {error ? <p role="alert" className="text-sm text-[#E8A0A0]">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-cream">{message}</p> : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Zapisywanie…" : "Zapisz dane"}
      </Button>
    </form>
  );
}

function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailInput, unknown, ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: currentEmail },
  });

  async function onSubmit(values: ChangeEmailValues) {
    setMessage("");
    setError("");
    if (values.email === currentEmail.toLowerCase()) {
      setError("To już jest Twój adres.");
      return;
    }
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      email: values.email,
    });
    if (updateError) {
      setError("Nie udało się zmienić adresu. Spróbuj za chwilę.");
      return;
    }
    setMessage("Wysłaliśmy link na nowy adres. Konto przełączy się na niego po potwierdzeniu.");
  }

  return (
    <form className="space-y-4 border-t border-white/10 pt-8" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg text-cream">E-mail</h2>
      <p className="text-sm text-muted">
        Nowy adres trzeba potwierdzić. Do tego czasu zostaje dotychczasowy.
      </p>
      <AccountField label="Adres e-mail" htmlFor="profile-email" error={errors.email?.message}>
        <input id="profile-email" type="email" autoComplete="email" className={accountFieldClass} {...register("email")} />
      </AccountField>
      {error ? <p role="alert" className="text-sm text-[#E8A0A0]">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-cream">{message}</p> : null}
      <Button type="submit" variant="outline" disabled={isSubmitting}>
        {isSubmitting ? "Wysyłanie…" : "Zmień e-mail"}
      </Button>
    </form>
  );
}

function PasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput, unknown, NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: NewPasswordValues) {
    setMessage("");
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (updateError) {
      setError("Nie udało się zmienić hasła. Spróbuj za chwilę.");
      return;
    }
    reset();
    setMessage("Hasło zostało zmienione.");
  }

  return (
    <form className="space-y-4 border-t border-white/10 pt-8" onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg text-cream">Hasło</h2>
      <PasswordField
        id="profile-password"
        label="Nowe hasło"
        autoComplete="new-password"
        error={errors.password?.message}
        registration={register("password")}
      />
      <PasswordField
        id="profile-password-confirm"
        label="Powtórz hasło"
        autoComplete="new-password"
        error={errors.confirm?.message}
        registration={register("confirm")}
      />
      {error ? <p role="alert" className="text-sm text-[#E8A0A0]">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-cream">{message}</p> : null}
      <Button type="submit" variant="outline" disabled={isSubmitting}>
        {isSubmitting ? "Zapisywanie…" : "Zmień hasło"}
      </Button>
    </form>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="border-t border-white/10 pt-8">
      <Button type="button" variant="outline" disabled={pending} onClick={signOut}>
        {pending ? "Wylogowywanie…" : "Wyloguj"}
      </Button>
    </div>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setPending(true);
    setMessage("");
    setError("");
    const result = await requestAccountDeletion();
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmed(false);
    setMessage(
      result.mailed
        ? "Wysłaliśmy prośbę do szkoły. Konto usuwa administrator — do tego czasu możesz się logować."
        : "Prośba jest zapisana, ale mail nie wyszedł. Zadzwoń: 539 143 200.",
    );
  }

  return (
    <section className="border-t border-white/10 pt-8">
      <h2 className="text-lg text-cream">Usunięcie konta</h2>
      {open ? (
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-cream">
          <p>Prośba trafia do szkoły. Samo usunięcie robi administrator, anonimizując dane.</p>
          <div>
            <p className="text-muted">Co zostanie usunięte</p>
            <ul className="mt-1 list-disc pl-5">
              <li>dane logowania: adres e-mail i hasło</li>
              <li>profil: imię, nazwisko i telefon</li>
              <li>powiązanie uczestników z tym kontem</li>
            </ul>
          </div>
          <div>
            <p className="text-muted">Co zostaje w szkole</p>
            <ul className="mt-1 list-disc pl-5">
              <li>historia płatności i dokumenty, które trzeba przechowywać</li>
              <li>zapisy i obecności po anonimizacji, już bez danych, po których da się Ciebie rozpoznać</li>
            </ul>
          </div>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 accent-(--gold)"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>Proszę szkołę o usunięcie konta.</span>
          </label>
          {error ? <p role="alert" className="text-[#E8A0A0]">{error}</p> : null}
          {message ? <p role="status">{message}</p> : null}
          <Button type="button" disabled={!confirmed || pending} onClick={submit}>
            {pending ? "Wysyłanie…" : "Wyślij prośbę"}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="mt-3 text-sm text-muted underline decoration-white/30 underline-offset-4"
          onClick={() => setOpen(true)}
        >
          Chcę usunąć konto
        </button>
      )}
    </section>
  );
}
