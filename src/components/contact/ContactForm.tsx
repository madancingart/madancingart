"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { site } from "@/content/site";
import {
  CONTACT_TOPICS,
  contactFormSchema,
  type ContactFormInput,
  type ContactFormValues,
} from "@/lib/validation";

const fieldClass =
  "w-full min-h-11 border border-white/15 bg-black px-3 text-cream";

const SUCCESS =
  "Wiadomość dotarła do Oli i Mikołaja. Jeśli to pilne — zadzwoń: 539 143 200.";

function withPhone(message: string): string {
  if (message.includes(site.phone)) {
    return message;
  }
  return `${message} Zadzwoń: ${site.phone}.`;
}

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormInput, unknown, ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      message: "",
      topic: "" as ContactFormInput["topic"],
      consentRodo: false,
      website: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus("sending");
    setServerError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        setStatus("error");
        setServerError(
          withPhone(payload.error ?? "Nie udało się wysłać wiadomości."),
        );
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setServerError(withPhone("Nie udało się wysłać wiadomości."));
    }
  });

  if (status === "success") {
    return (
      <p className="text-cream" role="status">
        {SUCCESS}
      </p>
    );
  }

  return (
    <form className="relative flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <div
        className="absolute top-auto left-[-10000px] h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="contact-website">Strona www</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>

      <Field label="Imię" htmlFor="contact-name" error={errors.name?.message}>
        <input
          id="contact-name"
          className={fieldClass}
          autoComplete="given-name"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
      </Field>

      <Field
        label="Telefon"
        htmlFor="contact-phone"
        error={errors.phone?.message}
        hint="Wystarczy telefon albo e-mail."
      >
        <input
          id="contact-phone"
          className={fieldClass}
          type="tel"
          autoComplete="tel"
          aria-invalid={Boolean(errors.phone)}
          {...register("phone")}
        />
      </Field>

      <Field
        label="E-mail"
        htmlFor="contact-email"
        error={errors.email?.message}
      >
        <input
          id="contact-email"
          className={fieldClass}
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
      </Field>

      <Field label="Temat" htmlFor="contact-topic" error={errors.topic?.message}>
        <select
          id="contact-topic"
          className={fieldClass}
          defaultValue=""
          aria-invalid={Boolean(errors.topic)}
          {...register("topic")}
        >
          <option value="" disabled>
            Wybierz temat
          </option>
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Wiadomość"
        htmlFor="contact-message"
        error={errors.message?.message}
      >
        <textarea
          id="contact-message"
          className={`${fieldClass} min-h-32 py-2`}
          maxLength={1000}
          aria-invalid={Boolean(errors.message)}
          {...register("message")}
        />
      </Field>

      <div>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-gold"
            aria-invalid={Boolean(errors.consentRodo)}
            {...register("consentRodo")}
          />
          <span>
            Wyrażam zgodę na przetwarzanie moich danych w celu odpowiedzi na
            wiadomość — zgodnie z{" "}
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

      {serverError ? (
        <p className="text-sm text-[#E8A0A0]" role="alert">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" disabled={status === "sending"} className="self-start">
        {status === "sending" ? "Wysyłanie…" : "Wyślij wiadomość"}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-cream">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-sm text-[#E8A0A0]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
