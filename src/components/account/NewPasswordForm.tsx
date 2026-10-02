"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { PasswordField } from "@/components/account/fields";
import { Button } from "@/components/ui/Button";
import { saveNewPassword } from "@/app/(site)/konto/actions";
import {
  newPasswordSchema,
  type NewPasswordInput,
  type NewPasswordValues,
} from "@/lib/validation";

export function NewPasswordForm({ next }: { next: string }) {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput, unknown, NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    const result = await saveNewPassword({ password: values.password, next });
    setServerError(result.error);
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {serverError ? (
        <p className="text-sm text-[#E8A0A0]" role="alert">
          {serverError}
        </p>
      ) : null}
      <PasswordField
        id="new-password"
        label="Nowe hasło"
        autoComplete="new-password"
        error={errors.password?.message}
        registration={register("password")}
      />
      <PasswordField
        id="new-password-confirm"
        label="Powtórz hasło"
        autoComplete="new-password"
        error={errors.confirm?.message}
        registration={register("confirm")}
      />
      <Button type="submit" disabled={isSubmitting} className="min-h-11 w-full">
        {isSubmitting ? "Zapisywanie…" : "Zapisz hasło"}
      </Button>
    </form>
  );
}
