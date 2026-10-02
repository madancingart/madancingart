export const DRY_RUN_SUBJECT = "[TEST] Co bot zrobiłby dziś";

export function formatDryRunDigest(input: {
  today: string;
  jobs: {
    job: string;
    created: number;
    sent: number;
    skipped: number;
    errors: string[];
    detail?: string;
  }[];
  planned: {
    name: string;
    to: string;
    subject: string;
    amount: string | null;
    period: string | null;
    body?: string;
  }[];
}): string {
  const lines = [
    `Symulacja na ${input.today}. Klienci nie dostali maili i nic nie zostało zapisane w rozliczeniach.`,
    "",
  ];
  for (const job of input.jobs) {
    lines.push(
      `${job.job}: wystawione ${job.created}, maile ${job.sent}, pominięte ${job.skipped}`,
    );
    if (job.detail) {
      lines.push(job.detail);
    }
    for (const error of job.errors) {
      lines.push(`Błąd: ${error}`);
    }
  }
  lines.push("", "Maile:");
  if (input.planned.length === 0) {
    lines.push("Brak.");
  }
  for (const mail of input.planned) {
    lines.push(
      `${mail.name} <${mail.to}> — ${mail.subject} — ${mail.amount ?? "—"} — ${mail.period ?? "—"}`,
    );
    if (mail.body) {
      lines.push(mail.body, "");
    }
  }
  return lines.join("\n");
}
