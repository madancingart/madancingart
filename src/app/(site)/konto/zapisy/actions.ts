"use server";

import { z } from "zod";
import { previewEnrollment, type EnrollmentPreview } from "@/lib/billing/preview";

export async function previewSignup(
  classId: string,
  customerId: string,
): Promise<EnrollmentPreview> {
  const parsed = z
    .object({ classId: z.uuid(), customerId: z.uuid() })
    .safeParse({ classId, customerId });
  if (!parsed.success) {
    return { kind: "unavailable", message: "Wybierz uczestnika i grupę." };
  }
  return previewEnrollment(parsed.data);
}
