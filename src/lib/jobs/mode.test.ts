import { describe, expect, it } from "vitest";
import { DRY_RUN_SUBJECT, formatDryRunDigest } from "@/lib/jobs/digest-copy";
import { parseBillingMode, warsawStartIso } from "@/lib/jobs/mode";

describe("tryb rozliczeń", () => {
  it("nieznana wartość zostaje wyłączona", () => {
    expect(parseBillingMode(undefined)).toBe("off");
    expect(parseBillingMode("")).toBe("off");
    expect(parseBillingMode("off")).toBe("off");
    expect(parseBillingMode(" LIVE ")).toBe("off");
    expect(parseBillingMode("dry-run")).toBe("dry-run");
    expect(parseBillingMode(" live ")).toBe("live");
  });

  it("północ w Warszawie jest wcześniejsza w UTC", () => {
    expect(warsawStartIso("2026-10-02")).toBe("2026-10-01T22:00:00.000Z");
    expect(warsawStartIso("2026-01-15")).toBe("2026-01-14T23:00:00.000Z");
  });
});

describe("mail testowy", () => {
  it("zbiera komu, jaki mail, kwotę i okres", () => {
    expect(DRY_RUN_SUBJECT).toBe("[TEST] Co bot zrobiłby dziś");
    const text = formatDryRunDigest({
      today: "2026-10-20",
      jobs: [
        {
          job: "monthly-charges",
          created: 1,
          sent: 1,
          skipped: 0,
          errors: [],
          detail: "Maile 20. dnia bez rozłożenia: 2. Rozłożenie na 18.–22.: nie.",
        },
      ],
      planned: [
        {
          name: "Anna",
          to: "anna@example.com",
          subject: "Opłata za listopad: Latino solo",
          amount: "130 zł",
          period: "2026-11-01 – 2026-11-30",
        },
      ],
    });
    expect(text).toContain("Anna <anna@example.com>");
    expect(text).toContain("Opłata za listopad: Latino solo");
    expect(text).toContain("130 zł");
    expect(text).toContain("2026-11-01 – 2026-11-30");
    expect(text).toContain("Maile 20. dnia bez rozłożenia: 2");
  });
});
