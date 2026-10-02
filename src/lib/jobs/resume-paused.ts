import "server-only";

import { addDays, maxIsoDate } from "@/lib/billing/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { blankResult, errorText, finishResult, type JobContext, type JobResult } from "@/lib/jobs/types";

type PausedRow = {
  id: string;
  billing_start: string;
  paused_until: string;
};

export async function runResumePaused(ctx: JobContext): Promise<JobResult> {
  const result = blankResult("resume-paused");
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("enrollments")
      .select("id, billing_start, paused_until")
      .eq("status", "paused")
      .lt("paused_until", ctx.today);
    if (error) {
      throw new Error("Nie udało się wczytać wstrzymanych zapisów.");
    }
    for (const row of (data ?? []) as PausedRow[]) {
      if (!row.paused_until) {
        result.skipped += 1;
        continue;
      }
      const billingStart = maxIsoDate([
        row.billing_start.slice(0, 10),
        addDays(row.paused_until.slice(0, 10), 1),
      ]);
      if (ctx.mode === "dry-run") {
        result.created += 1;
        continue;
      }
      const { data: updated, error: updateError } = await admin
        .from("enrollments")
        .update({ status: "active", billing_start: billingStart })
        .eq("id", row.id)
        .eq("status", "paused")
        .select("id");
      if (updateError) {
        result.errors.push(`Nie udało się wznowić zapisu ${row.id}.`);
        continue;
      }
      if ((updated ?? []).length === 0) {
        result.skipped += 1;
        continue;
      }
      result.created += 1;
    }
  } catch (error) {
    result.errors.push(errorText(error));
  }
  return finishResult(result);
}
