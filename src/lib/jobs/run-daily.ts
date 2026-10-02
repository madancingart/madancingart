import "server-only";

import { sendSchoolNoticeEmail } from "@/lib/email";
import { DRY_RUN_SUBJECT, formatDryRunDigest } from "@/lib/jobs/digest-copy";
import { billingMode, dailyClock } from "@/lib/jobs/mode";
import { runAdminDigest } from "@/lib/jobs/admin-digest";
import { runConfirmations } from "@/lib/jobs/confirmations";
import { runLapseHolds } from "@/lib/jobs/lapse-holds";
import { runMonthlyCharges } from "@/lib/jobs/monthly-charges";
import { runPassRenewals } from "@/lib/jobs/pass-renewals";
import { runPaymentReminders } from "@/lib/jobs/payment-reminders";
import { runResumePaused } from "@/lib/jobs/resume-paused";
import {
  errorText,
  type JobContext,
  type JobName,
  type JobResult,
} from "@/lib/jobs/types";
import { createAdminClient } from "@/lib/supabase/admin";

const RUNNERS: { job: JobName; run: (ctx: JobContext) => Promise<JobResult> }[] = [
  { job: "confirmations", run: runConfirmations },
  { job: "lapse-holds", run: runLapseHolds },
  { job: "resume-paused", run: runResumePaused },
  { job: "monthly-charges", run: runMonthlyCharges },
  { job: "pass-renewals", run: runPassRenewals },
  { job: "payment-reminders", run: runPaymentReminders },
  { job: "admin-digest", run: runAdminDigest },
];

export type DailyRun = {
  mode: "off" | "dry-run" | "live";
  jobs: JobResult[];
  digest: "sent" | "failed" | "missing" | "skipped";
  auditError?: string;
};

export async function runDaily(clock: Date = new Date()): Promise<DailyRun> {
  const mode = billingMode();
  if (mode === "off") {
    return { mode, jobs: [], digest: "skipped" };
  }

  const { today, now } = dailyClock(clock);
  const ctx: JobContext = { mode, today, now, planned: [] };
  const jobs: JobResult[] = [];
  for (const runner of RUNNERS) {
    try {
      jobs.push(await runner.run(ctx));
    } catch (error) {
      jobs.push({
        job: runner.job,
        created: 0,
        sent: 0,
        skipped: 0,
        errors: [errorText(error)],
      });
    }
  }

  let digest: DailyRun["digest"] = "skipped";
  if (mode === "dry-run") {
    digest = await sendDryRunDigest(today, jobs, ctx);
  }
  try {
    await writeAudit(today, mode, jobs, digest);
  } catch (error) {
    return { mode, jobs, digest, auditError: errorText(error) };
  }
  return { mode, jobs, digest };
}

async function sendDryRunDigest(
  today: string,
  jobs: JobResult[],
  ctx: JobContext,
): Promise<DailyRun["digest"]> {
  const to = process.env.ADMIN_DIGEST_EMAIL?.trim();
  if (!to) {
    return "missing";
  }
  if (await dryRunAlreadySent(today)) {
    return "skipped";
  }
  const text = formatDryRunDigest({ today, jobs, planned: ctx.planned });
  const sent = await sendSchoolNoticeEmail({ to, subject: DRY_RUN_SUBJECT, text });
  return sent ? "sent" : "failed";
}

async function dryRunAlreadySent(today: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("audit_log")
    .select("details")
    .eq("action", "cron.daily")
    .eq("entity_id", today)
    .limit(20);
  if (error) {
    throw new Error("Nie udało się sprawdzić dziennika.");
  }
  return (data ?? []).some((row) => {
    const details = row.details as { mode?: string; digest?: string } | null;
    return details?.mode === "dry-run" && details.digest === "sent";
  });
}

async function writeAudit(
  today: string,
  mode: "dry-run" | "live",
  jobs: JobResult[],
  digest: DailyRun["digest"],
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_label: "system",
    action: "cron.daily",
    entity: "cron",
    entity_id: today,
    details: {
      mode,
      digest,
      jobs: jobs.map((job) => ({
        job: job.job,
        created: job.created,
        sent: job.sent,
        skipped: job.skipped,
        detail: job.detail ?? null,
        errors: job.errors,
      })),
    },
  });
  if (error) {
    throw new Error("Nie udało się zapisać dziennika crona.");
  }
}
