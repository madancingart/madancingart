import "server-only";

import { runConfirmationReminders } from "@/lib/booking/reminders";
import { blankResult, errorText, finishResult, type JobContext, type JobResult } from "@/lib/jobs/types";

export async function runConfirmations(ctx: JobContext): Promise<JobResult> {
  const result = blankResult("confirmations");
  try {
    const outcome = await runConfirmationReminders(ctx.now, {
      dryRun: ctx.mode === "dry-run",
      onPlanned: (mail) => {
        ctx.planned.push({
          job: "confirmations",
          to: mail.to,
          name: mail.name,
          subject: mail.subject,
          amount: null,
          period: mail.when,
        });
      },
    });
    result.created = outcome.released;
    result.sent = outcome.reminded + outcome.released;
    result.skipped = outcome.skipped;
    result.errors = outcome.errors;
  } catch (error) {
    result.errors.push(errorText(error));
  }
  return finishResult(result);
}
