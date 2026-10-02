export type JobName =
  | "confirmations"
  | "lapse-holds"
  | "resume-paused"
  | "monthly-charges"
  | "pass-renewals"
  | "payment-reminders"
  | "admin-digest";

export type JobResult = {
  job: JobName;
  created: number;
  sent: number;
  skipped: number;
  errors: string[];
  detail?: string;
};

export type PlannedMail = {
  job: JobName;
  to: string;
  name: string;
  subject: string;
  amount: string | null;
  period: string | null;
  body?: string;
};

export type JobContext = {
  mode: "dry-run" | "live";
  today: string;
  now: Date;
  planned: PlannedMail[];
};

export function blankResult(job: JobName): JobResult {
  return { job, created: 0, sent: 0, skipped: 0, errors: [] };
}

export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : "Nieznany błąd.";
  return message.slice(0, 200);
}

export function finishResult(result: JobResult): JobResult {
  return { ...result, errors: result.errors.slice(0, 20) };
}
