import { z } from "zod";
import { enrollInClass } from "@/lib/billing/enroll";

const bodySchema = z.object({
  customerId: z.uuid(),
  classId: z.uuid(),
  plan: z.enum(["period", "prepaid"]),
  acceptContract: z.boolean().refine((value) => value === true, {
    error: "Zaakceptuj umowę i regulamin zajęć.",
  }),
});

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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Sprawdź uczestnika i grupę." },
      { status: 400 },
    );
  }

  const result = await enrollInClass(parsed.data);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  if ("alreadyCovered" in result) {
    return Response.json({ ok: true, alreadyCovered: true, message: result.message });
  }
  if ("skipped" in result) {
    return Response.json({ ok: true, skipped: true, message: result.message });
  }
  if ("onsite" in result) {
    return Response.json({ ok: true, onsite: true, message: result.message });
  }
  return Response.json({ ok: true, checkoutUrl: result.checkoutUrl });
}
