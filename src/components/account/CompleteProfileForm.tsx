"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { InterestChips, type ClassTypeOption } from "@/components/account/InterestChips";
import { AccountField, accountFieldClass } from "@/components/account/fields";
import { Button } from "@/components/ui/Button";
import { safeNextPath } from "@/lib/account/redirect";
import { createClient } from "@/lib/supabase/client";
import {
  completeProfileSchema,
  type CompleteProfileInput,
  type CompleteProfileValues,
} from "@/lib/validation";

export type ProfilePrefill = {
  firstName: string;
  lastName: string;
  phone: string;
  interests: string[];
};

export function CompleteProfileForm({
  next,
  prefill,
  classTypes,
}: {
  next: string;
  prefill: ProfilePrefill;
  classTypes: ClassTypeOption[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CompleteProfileInput, unknown, CompleteProfileValues>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: prefill,
  });
  const interests = watch("interests") ?? [];

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    const supabase = createClient();
    const { error } = await supabase.rpc("upsert_my_profile", {
      p_first_name: values.firstName,
      p_last_name: values.lastName,
      p_phone: values.phone,
      p_interests: values.interests,
    });
    if (error) {
      setServerError("Nie udało się zapisać profilu. Sprawdź dane i spróbuj ponownie.");
      return;
    }
    router.push(safeNextPath(next, "/konto/witaj"));
    router.refresh();
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {serverError ? (
        <p className="text-sm text-[#E8A0A0]" role="alert">
          {serverError}
        </p>
      ) : null}
      <AccountField label="Imię" htmlFor="profile-first" error={errors.firstName?.message}>
        <input id="profile-first" autoComplete="given-name" className={accountFieldClass} aria-invalid={Boolean(errors.firstName)} {...register("firstName")} />
      </AccountField>
      <AccountField label="Nazwisko" htmlFor="profile-last" error={errors.lastName?.message}>
        <input id="profile-last" autoComplete="family-name" className={accountFieldClass} aria-invalid={Boolean(errors.lastName)} {...register("lastName")} />
      </AccountField>
      <AccountField label="Telefon" htmlFor="profile-phone" error={errors.phone?.message}>
        <input id="profile-phone" type="tel" autoComplete="tel" className={accountFieldClass} aria-invalid={Boolean(errors.phone)} {...register("phone")} />
      </AccountField>
      <InterestChips
        options={classTypes}
        value={interests}
        onChange={(nextInterests) => setValue("interests", nextInterests, { shouldDirty: true })}
      />
      <Button type="submit" disabled={isSubmitting} className="min-h-11 w-full">
        {isSubmitting ? "Zapisywanie…" : "Zapisz profil"}
      </Button>
    </form>
  );
}
