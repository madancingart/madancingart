"use client";

import { Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { useState, type ReactNode } from "react";

export const accountFieldClass =
  "w-full min-h-11 border border-white/15 bg-black px-3 text-cream";

export function AccountField({
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

export function PasswordField({
  id,
  label,
  autoComplete,
  error,
  registration,
}: {
  id: string;
  label: string;
  autoComplete: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <AccountField label={label} htmlFor={id} error={error}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          className={`${accountFieldClass} pr-12`}
          {...registration}
        />
        <button
          type="button"
          className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-cream"
          aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? (
            <EyeOff strokeWidth={1.5} aria-hidden />
          ) : (
            <Eye strokeWidth={1.5} aria-hidden />
          )}
        </button>
      </div>
    </AccountField>
  );
}
