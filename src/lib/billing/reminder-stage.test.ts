import { describe, expect, it } from "vitest";
import { reminderStageFor } from "@/lib/billing/reminder-stage";

const due = "2026-10-20";

describe("reminderStageFor", () => {
  const open = { amountCents: 13_000, dueDate: due, reminderStage: 1 };

  it("due − 3 nic nie wysyła", () => {
    expect(reminderStageFor(open, "2026-10-17")).toBeNull();
  });

  it("due − 2 to etap 2", () => {
    expect(reminderStageFor(open, "2026-10-18")).toBe(2);
  });

  it("w terminie zostaje etap 2", () => {
    expect(reminderStageFor(open, due)).toBe(2);
  });

  it("due + 3 to etap 3", () => {
    expect(reminderStageFor(open, "2026-10-23")).toBe(3);
  });

  it("due + 10 to etap 4", () => {
    expect(reminderStageFor(open, "2026-10-30")).toBe(4);
  });

  it("due + 30 zostaje na etapie 4", () => {
    expect(reminderStageFor(open, "2026-11-19")).toBe(4);
  });

  it("należność 0 zł nie dostaje przypomnienia", () => {
    expect(
      reminderStageFor({ amountCents: 0, dueDate: due, reminderStage: 1 }, "2026-10-30"),
    ).toBeNull();
  });

  it("etap 4 nie wychodzi drugi raz", () => {
    expect(
      reminderStageFor(
        { amountCents: 13_000, dueDate: due, reminderStage: 4 },
        "2026-10-30",
      ),
    ).toBeNull();
  });

  it("już wysłanego etapu nie powtarza i nie cofa się po przegapionym", () => {
    expect(
      reminderStageFor({ amountCents: 13_000, dueDate: due, reminderStage: 2 }, due),
    ).toBeNull();
    expect(
      reminderStageFor(
        { amountCents: 13_000, dueDate: due, reminderStage: 2 },
        "2026-10-23",
      ),
    ).toBe(3);
  });
});
