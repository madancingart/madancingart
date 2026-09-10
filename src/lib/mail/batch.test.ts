import { describe, expect, it } from "vitest";
import { chunkItems, uniqueEmails } from "@/lib/mail/batch";

describe("uniqueEmails", () => {
  it("dedupes case and skips empty", () => {
    expect(
      uniqueEmails([
        "Anna@example.com",
        "  anna@example.com ",
        null,
        "ola@szkola.pl",
        "nie-mail",
      ]),
    ).toEqual(["anna@example.com", "ola@szkola.pl"]);
  });
});

describe("chunkItems", () => {
  it("splits into batches of 50", () => {
    const items = Array.from({ length: 51 }, (_, index) => index);
    const chunks = chunkItems(items, 50);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(50);
    expect(chunks[1]).toHaveLength(1);
  });
});
