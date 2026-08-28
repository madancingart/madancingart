import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: row } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (row) {
      redirect("/admin");
    }
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <p className="text-gold-gradient text-4xl font-semibold tracking-tight">
        M&A
      </p>
      <h1 className="mt-6 text-lg font-semibold text-cream">Logowanie do panelu</h1>
      <div className="mt-8 w-full max-w-sm">
        <Suspense>
          <AdminLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
