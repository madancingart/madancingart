import { sendContactEmails } from "@/lib/email";
import { allowBookingAttempt, clientIp } from "@/lib/rate-limit";
import { contactFormSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Niepoprawne dane formularza." },
      { status: 400 },
    );
  }

  const parsed = contactFormSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { ok: false, error: first?.message ?? "Sprawdź dane w formularzu." },
      { status: 400 },
    );
  }

  const data = parsed.data;
  if (data.website?.trim()) {
    return Response.json(
      { ok: false, error: "Nie udało się wysłać wiadomości." },
      { status: 400 },
    );
  }

  if (!allowBookingAttempt(clientIp(request))) {
    return Response.json(
      {
        ok: false,
        error: "Zbyt wiele wiadomości. Spróbuj ponownie za kilka minut.",
      },
      { status: 429 },
    );
  }

  const sent = await sendContactEmails({
    name: data.name,
    phone: data.phone,
    email: data.email.toLowerCase(),
    topic: data.topic,
    message: data.message,
  });

  if (!sent.ok) {
    return Response.json({ ok: false, error: sent.error }, { status: 503 });
  }

  return Response.json({ ok: true });
}
