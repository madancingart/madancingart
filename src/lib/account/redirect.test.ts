import { describe, expect, it } from "vitest";
import { classSignupHref, groupSignupHref, pathAfterLogin, safeNextPath } from "@/lib/account/redirect";

describe("safeNextPath", () => {
  it("zostawia ścieżkę względną", () => {
    expect(safeNextPath("/konto/witaj")).toBe("/konto/witaj");
    expect(safeNextPath("/grafik?grupa=abc")).toBe("/grafik?grupa=abc");
  });

  it("odrzuca open redirect", () => {
    expect(safeNextPath("//evil.example")).toBe("/konto");
    expect(safeNextPath("https://evil.example/phish")).toBe("/konto");
    expect(safeNextPath("/\\evil.example")).toBe("/konto");
    expect(safeNextPath("konto")).toBe("/konto");
  });

  it("bierze ścieżkę z adresu na dozwolonym hoście", () => {
    expect(
      safeNextPath("http://localhost:3000/konto/witaj?next=1", "/konto", [
        "http://localhost:3000",
      ]),
    ).toBe("/konto/witaj?next=1");
  });
});

describe("classSignupHref", () => {
  it("gościa prowadzi przez rejestrację, a zalogowanego od razu na zapis", () => {
    const next = "/konto/zapisy/nowy?grupa=abc";
    expect(groupSignupHref("abc")).toBe(next);
    expect(classSignupHref("abc", true)).toBe(next);
    expect(classSignupHref("abc", false)).toBe(
      `/konto/rejestracja?next=${encodeURIComponent(next)}`,
    );
  });
});

describe("pathAfterLogin", () => {
  it("kieruje na uzupełnienie profilu i niesie claimed", () => {
    expect(
      pathAfterLogin(
        { claimed: 2, needsProfile: true },
        "/konto/witaj",
      ),
    ).toBe(
      `/konto/uzupelnij?next=${encodeURIComponent("/konto/witaj?claimed=2")}`,
    );
  });

  it("zostawia next, gdy profil jest", () => {
    expect(
      pathAfterLogin({ claimed: 0, needsProfile: false }, "/grafik?grupa=1"),
    ).toBe("/grafik?grupa=1");
  });
});
