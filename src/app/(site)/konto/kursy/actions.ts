"use server";

import { z } from "zod";
import { enrollInSeries, joinCourseWaitlist } from "@/lib/courses/enroll";

const enrollSchema = z.object({
  customerId: z.uuid(),
  slug: z.string().trim().min(3).max(60),
});

const waitlistSchema = z.object({
  slug: z.string().trim().min(3).max(60),
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  phone: z.string().trim().min(9).max(20),
});

export async function enrollCourse(input: unknown) {
  const parsed = enrollSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Wybierz uczestnika." };
  }
  return enrollInSeries(parsed.data);
}

export async function requestCourseWaitlist(input: unknown) {
  const parsed = waitlistSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Podaj imię, e-mail i telefon." };
  }
  return joinCourseWaitlist(parsed.data);
}
