import "server-only";

import { sendBillingNoticeEmail } from "@/lib/email";
import { siteUrl } from "@/lib/stripe";
import type { Recipient } from "@/lib/jobs/recipients";
import type { JobContext, JobName } from "@/lib/jobs/types";

export async function deliverClientMail(
  ctx: JobContext,
  input: {
    job: JobName;
    recipient: Recipient | null;
    subject: string;
    text: string;
    amount: string | null;
    period: string | null;
    payToken: string | null;
  },
): Promise<"sent" | "skipped" | "failed"> {
  if (!input.recipient?.email) {
    return "skipped";
  }
  if (ctx.mode === "dry-run") {
    ctx.planned.push({
      job: input.job,
      to: input.recipient.email,
      name: input.recipient.greetingName,
      subject: input.subject,
      amount: input.amount,
      period: input.period,
    });
    return "sent";
  }
  const payUrl = input.payToken ? `${siteUrl()}/zaplac/${input.payToken}` : null;
  const ok = await sendBillingNoticeEmail({
    to: input.recipient.email,
    subject: input.subject,
    text: input.text,
    participantLine: input.recipient.participantLine,
    payUrl,
  });
  return ok ? "sent" : "failed";
}
