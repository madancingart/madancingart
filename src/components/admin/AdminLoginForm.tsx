"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { signInAdmin } from "@/app/admin/login/actions";

export function AdminLoginForm({ denied = false }: { denied?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(denied ? "Brak uprawnień." : "");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const result = await signInAdmin(email, password);
    setSubmitting(false);
    if (result && !result.ok) {
      setError(result.error);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {error ? (
        <p className="text-sm text-[#E8A0A0]" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <label htmlFor="admin-email" className="mb-1 block text-sm text-cream">
          Login
        </label>
        <input
          id="admin-email"
          type="text"
          autoComplete="username"
          required
          placeholder="admin"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-11 w-full border border-white/15 bg-black px-3 text-cream"
        />
      </div>

      <div>
        <label htmlFor="admin-password" className="mb-1 block text-sm text-cream">
          Hasło
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 w-full border border-white/15 bg-black px-3 text-cream"
        />
      </div>

      <Button type="submit" disabled={submitting} className="min-h-11 w-full">
        {submitting ? "Logowanie…" : "Zaloguj się"}
      </Button>
    </form>
  );
}
