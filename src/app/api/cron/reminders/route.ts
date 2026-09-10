import { timingSafeEqual } from "crypto";
import { runConfirmationReminders } from "@/lib/booking/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }
  const token = header.slice("Bearer ".length);
  const expected = Buffer.from(secret);
  const given = Buffer.from(token);
  if (expected.length !== given.length) {
    return false;
  }
  return timingSafeEqual(expected, given);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runConfirmationReminders();
  return Response.json({ ok: true, ...result });
}
