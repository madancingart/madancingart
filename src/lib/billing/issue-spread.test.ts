import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/billing/dates";
import {
  effectiveIssueOn,
  issueDayOffset,
  naturalIssueOn,
  shouldSpreadIssues,
  stableHash,
} from "@/lib/billing/issue-spread";

describe("rozłożenie wystawienia", () => {
  it("hash i przesunięcie są stałe i mieszczą się w −2…+2", () => {
    const ids = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    ];
    for (const id of ids) {
      expect(stableHash(id)).toBe(stableHash(id));
      const offset = issueDayOffset(id);
      expect(offset).toBeGreaterThanOrEqual(-2);
      expect(offset).toBeLessThanOrEqual(2);
      expect(issueDayOffset(id)).toBe(offset);
    }
  });

  it("przesuwa tylko 20. dzień i tylko gdy pula tego wymaga", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const offset = issueDayOffset(id);
    expect(effectiveIssueOn("2026-10-20", id, true)).toBe(addDays("2026-10-20", offset));
    expect(effectiveIssueOn("2026-10-05", id, true)).toBe("2026-10-05");
    expect(effectiveIssueOn("2026-10-20", id, false)).toBe("2026-10-20");
    expect(shouldSpreadIssues(80)).toBe(false);
    expect(shouldSpreadIssues(81)).toBe(true);
  });

  it("dla pustego miesiąca wymyśla tę samą datę co przy pełnym", () => {
    expect(naturalIssueOn({ issueOn: null, periodStart: "2026-11-01" })).toBe("2026-10-20");
    expect(naturalIssueOn({ issueOn: null, periodStart: "2026-11-15" })).toBe("2026-11-05");
    expect(naturalIssueOn({ issueOn: "2026-10-20", periodStart: "2026-11-01" })).toBe(
      "2026-10-20",
    );
  });
});
