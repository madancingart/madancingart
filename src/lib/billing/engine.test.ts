import { afterEach, describe, expect, it } from "vitest";
import { findPriceItem } from "@/content/pricing";
import { warsawNow } from "@/lib/billing/dates";
import {
  quoteFirst,
  quoteNextMonthly,
  quotePass,
  quotePrepaid,
  rate,
  type BillingClass,
  type BillingQuote,
} from "@/lib/billing/engine";

const monday: BillingClass = { weekday: 1, startTime: "18:00" };
const tuesday: BillingClass = { weekday: 2, startTime: "16:00" };

function expectPeriod(
  quote: BillingQuote,
  periodStart: string,
  periodEnd: string,
  sessionDates: string[],
  amountCents: number,
) {
  expect(quote.periodStart).toBe(periodStart);
  expect(quote.periodEnd).toBe(periodEnd);
  expect(quote.sessionDates).toEqual(sessionDates);
  expect(quote.amountCents).toBe(amountCents);
}

describe("stawki", () => {
  it("dzieli miesiąc na cztery wejścia", () => {
    expect(rate(12_000)).toBe(3_000);
    expect(rate(13_000)).toBe(3_250);
    expect(rate(36_000)).toBe(9_000);
  });
});

describe("quoteFirst", () => {
  it("A — dwa zajęcia do końca lipca", () => {
    const quote = quoteFirst(monday, 12_000, "2026-07-14", "10:00");
    expectPeriod(quote, "2026-07-14", "2026-07-31", ["2026-07-20", "2026-07-27"], 6_000);
    expect(quote.lines).toEqual(["2 zajęcia w lipcu (20.07, 27.07) × 30 zł"]);
  });

  it("B — dzisiejsze zajęcia jeszcze się nie zaczęły", () => {
    const quote = quoteFirst(tuesday, 13_000, "2026-07-14", "15:00");
    expectPeriod(
      quote,
      "2026-07-14",
      "2026-07-31",
      ["2026-07-14", "2026-07-21", "2026-07-28"],
      9_750,
    );
  });

  it("C — jedno zajęcia w lipcu dociąga sierpień", () => {
    const quote = quoteFirst(monday, 12_000, "2026-07-27", "12:00");
    expectPeriod(
      quote,
      "2026-07-27",
      "2026-08-31",
      ["2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"],
      15_000,
    );
  });

  it("D — dzisiejsze zajęcia już się zaczęły, zostaje sam sierpień", () => {
    const quote = quoteFirst(monday, 12_000, "2026-07-27", "19:00");
    expectPeriod(
      quote,
      "2026-07-27",
      "2026-08-31",
      ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"],
      12_000,
    );
  });

  it("E — odwołany poniedziałek wypada z pierwszej wpłaty", () => {
    const quote = quoteFirst(monday, 12_000, "2026-11-10", "09:00", ["2026-11-16"]);
    expectPeriod(quote, "2026-11-10", "2026-11-30", ["2026-11-23", "2026-11-30"], 6_000);
  });

  it("F — pięć zajęć obcina się do ceny miesiąca", () => {
    const quote = quoteFirst(tuesday, 13_000, "2026-12-01", "10:00");
    expectPeriod(
      quote,
      "2026-12-01",
      "2026-12-31",
      ["2026-12-01", "2026-12-08", "2026-12-15", "2026-12-22", "2026-12-29"],
      13_000,
    );
  });
});

describe("quoteNextMonthly", () => {
  it("G — pełny miesiąc, płasko, termin 5. dnia", () => {
    const quote = quoteNextMonthly(monday, 12_000, "2026-10-31", "2026-08-01");
    expectPeriod(
      quote,
      "2026-11-01",
      "2026-11-30",
      ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"],
      12_000,
    );
    expect(quote.kind).toBe("monthly");
    expect(quote.issueOn).toBe("2026-10-20");
    expect(quote.dueOn).toBe("2026-11-05");
  });

  it("H — okres od połowy miesiąca", () => {
    const quote = quoteNextMonthly(monday, 12_000, "2026-11-15", "2026-08-01");
    expectPeriod(
      quote,
      "2026-11-16",
      "2026-11-30",
      ["2026-11-16", "2026-11-23", "2026-11-30"],
      9_000,
    );
    expect(quote.kind).toBe("monthly");
    expect(quote.issueOn).toBe("2026-11-06");
    expect(quote.dueOn).toBe("2026-11-20");
  });

  it("I — cały miesiąc odwołany", () => {
    const quote = quoteNextMonthly(monday, 12_000, "2026-06-30", "2026-06-01", [
      "2026-07-06",
      "2026-07-13",
      "2026-07-20",
      "2026-07-27",
    ]);
    expectPeriod(quote, "2026-07-01", "2026-07-31", [], 0);
    expect(quote.kind).toBe("skip");
  });

  it("J — legacy bez paid_until zaczyna od billingStart", () => {
    const quote = quoteNextMonthly(monday, 12_000, null, "2026-11-01");
    expectPeriod(
      quote,
      "2026-11-01",
      "2026-11-30",
      ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"],
      12_000,
    );
    expect(quote.issueOn).toBe("2026-10-20");
  });
});

describe("quotePrepaid", () => {
  it("K — trzy pełne miesiące sklejone", () => {
    const quote = quotePrepaid(monday, 12_000, 3, "2026-10-31", "2026-08-01", "2026-10-20");
    expect(quote.periodStart).toBe("2026-11-01");
    expect(quote.periodEnd).toBe("2027-01-31");
    expect(quote.sessionDates).toHaveLength(13);
    expect(quote.amountCents).toBe(36_000);
    expect(quote.kind).toBe("prepaid");
  });

  it("L — promocja 3 miesięcy od wskazanego dnia", () => {
    const quote = quotePrepaid(
      monday,
      36_000,
      3,
      null,
      "2026-10-05",
      "2026-10-05",
      { amountCents: 95_000, label: "3 miesiące 1×/tydz. — promocja" },
    );
    expect(quote.periodStart).toBe("2026-10-05");
    expect(quote.periodEnd).toBe("2027-01-04");
    expect(quote.amountCents).toBe(95_000);
    expect(quote.lines).toEqual(["3 miesiące 1×/tydz. — promocja"]);
  });
});

describe("quotePass", () => {
  it("bierze kwotę karnetu i nie tworzy okresu", () => {
    const item = findPriceItem("lubliniec-latino-4x-60");
    expect(item).not.toBeNull();
    const quote = quotePass(item!);
    expect(quote.kind).toBe("pass4");
    expect(quote.amountCents).toBe(12_000);
    expect(quote.periodStart).toBeNull();
    expect(quote.periodEnd).toBeNull();
  });
});

describe("cennik — billing", () => {
  it("przypisuje sposób rozliczania", () => {
    expect(findPriceItem("mikolow-dzieci-mies")?.billing).toBe("monthly");
    expect(findPriceItem("mikolow-latino-mies")?.billing).toBe("monthly");
    expect(findPriceItem("mikolow-uzytkowy-50")?.billing).toBe("monthly");
    expect(findPriceItem("mikolow-uzytkowy-75")?.billing).toBe("monthly");
    expect(findPriceItem("mikolow-ind-1h")?.billing).toBe("one-off");
    expect(findPriceItem("mikolow-ind-10h")?.billing).toBe("one-off");
    expect(findPriceItem("lubliniec-dzieci-mies")?.billing).toBe("monthly");
    expect(findPriceItem("lubliniec-latino-4x-60")?.billing).toBe("pass4");
    expect(findPriceItem("lubliniec-latino-4x-75")?.billing).toBe("pass4");
    expect(findPriceItem("lubliniec-uzytkowy-4x-60")?.billing).toBe("pass4");
    expect(findPriceItem("lubliniec-uzytkowy-4x-75")?.billing).toBe("pass4");
    expect(findPriceItem("lubliniec-ind-6h")?.billing).toBe("one-off");
    expect(findPriceItem("lubliniec-promo-75-3m-1x")?.billing).toBe("monthly");
    expect(findPriceItem("lubliniec-promo-75-3m-1x")?.prepaid).toEqual({
      months: 3,
      amountCents: 95_000,
      label: "3 miesiące 1×/tydz. — promocja",
    });
    expect(findPriceItem("lubliniec-promo-60-3m")?.prepaid).toEqual({
      months: 3,
      amountCents: 65_000,
      label: "3 miesiące — promocja",
    });
    expect(findPriceItem("lubliniec-promo-75-8")?.billing).toBe("one-off");
    expect(findPriceItem("lubliniec-promo-75-3m-2x")?.billing).toBe("one-off");
    expect(findPriceItem("lubliniec-promo-75-8")?.prepaid).toBeUndefined();
  });
});

describe("warsawNow", () => {
  const previousToday = process.env.TEST_TODAY;
  const previousNodeEnv = process.env.NODE_ENV;

  function setNodeEnv(value: string | undefined) {
    (process.env as { NODE_ENV?: string }).NODE_ENV = value;
  }

  afterEach(() => {
    process.env.TEST_TODAY = previousToday;
    setNodeEnv(previousNodeEnv);
  });

  it("w dev TEST_TODAY nadpisuje datę i godzinę", () => {
    setNodeEnv("development");
    process.env.TEST_TODAY = "2026-07-14T10:00";
    expect(warsawNow(new Date("2020-01-01T00:00:00Z"))).toEqual({
      date: "2026-07-14",
      time: "10:00",
    });
  });

  it("w produkcji TEST_TODAY jest ignorowane", () => {
    setNodeEnv("production");
    process.env.TEST_TODAY = "2026-07-14T10:00";
    expect(warsawNow(new Date("2026-03-01T12:00:00Z"))).toEqual({
      date: "2026-03-01",
      time: "13:00",
    });
  });
});
