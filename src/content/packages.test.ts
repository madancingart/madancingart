import { describe, expect, it } from "vitest";
import { pricing } from "@/content/pricing";
import { WEDDING_PACKAGES } from "@/content/packages";

describe("WEDDING_PACKAGES", () => {
  const individual = pricing.mikolow.find(
    (section) => section.title === "Lekcje indywidualne",
  );

  it("bierze kwoty z cennika lekcji indywidualnych", () => {
    expect(individual).toBeDefined();
    const byId = new Map(
      (individual?.items ?? []).map((item) => [item.id, item.amountCents]),
    );
    expect(WEDDING_PACKAGES[0]?.kind).toBe("wedding_single");
    expect(WEDDING_PACKAGES[0]?.priceCents).toBe(byId.get("mikolow-ind-1h"));
    expect(WEDDING_PACKAGES[0]?.totalLessons).toBe(1);
    expect(WEDDING_PACKAGES[1]?.kind).toBe("wedding_6");
    expect(WEDDING_PACKAGES[1]?.priceCents).toBe(byId.get("mikolow-ind-6h"));
    expect(WEDDING_PACKAGES[1]?.totalLessons).toBe(6);
    expect(WEDDING_PACKAGES[2]?.kind).toBe("wedding_10");
    expect(WEDDING_PACKAGES[2]?.priceCents).toBe(byId.get("mikolow-ind-10h"));
    expect(WEDDING_PACKAGES[2]?.totalLessons).toBe(10);
  });
});
