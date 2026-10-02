import type { ClassTypeOption } from "@/components/account/InterestChips";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function listClassTypes(): Promise<ClassTypeOption[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("class_types")
    .select("slug, name")
    .order("name");

  return (data ?? []).flatMap((row) => {
    if (typeof row.slug === "string" && typeof row.name === "string") {
      return [{ slug: row.slug, name: row.name }];
    }
    return [];
  });
}
