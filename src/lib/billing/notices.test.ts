import { describe, expect, it } from "vitest";
import {
  ONSITE_LINE,
  PAY_BUTTON_LABEL,
  lapseNotice,
  participantLine,
  passNotice,
  paymentNotice,
} from "@/lib/billing/notices";

const vars = {
  name: "Anno",
  month: "listopad",
  amount: "130 zł",
  className: "Latino solo",
  location: "Mikołów",
  weekday: "poniedziałek",
  time: "18:00",
  due: "5 listopada 2026",
};

describe("treści maili rozliczeń", () => {
  it("trzyma dokładne zdania etapów, karnetu i wygaśnięcia", () => {
    expect(paymentNotice(1, vars)).toEqual({
      subject: "Opłata za listopad: Latino solo",
      text: "Cześć Anno, przesyłamy rozliczenie za listopad: 130 zł za Latino solo w Mikołów (poniedziałek, 18:00). Termin płatności: 5 listopada 2026. Do zobaczenia na sali — Ola i Mikołaj",
    });
    expect(paymentNotice(2, vars)).toEqual({
      subject: "Przypomnienie: płatność za listopad",
      text: "Cześć Anno, przypominamy, że do 5 listopada 2026 czeka płatność 130 zł za Latino solo. Jeśli wpłata już do nas dotarła, zignoruj tę wiadomość.",
    });
    expect(paymentNotice(3, vars)).toEqual({
      subject: "Zaległa płatność za listopad",
      text: "Cześć Anno, nie widzimy jeszcze wpłaty 130 zł za Latino solo — termin minął 5 listopada 2026. Zapłacisz online w minutę. Jeśli coś się zmieniło i nie chodzisz już na zajęcia, odpisz na tego maila — zamkniemy zapis i przestaniemy przypominać.",
    });
    expect(paymentNotice(4, vars)).toEqual({
      subject: "Druga prośba o płatność za listopad",
      text: "Cześć Anno, to ostatnie automatyczne przypomnienie o płatności 130 zł za Latino solo. Zależy nam, żeby miejsce w grupie zostało dla Ciebie — prosimy o wpłatę albo krótką wiadomość, co się zmieniło.",
    });
    expect(
      passNotice({
        name: "Anno",
        className: "Latino solo",
        location: "Mikołów",
        amount: "160 zł",
      }),
    ).toEqual({
      subject: "Na karnecie zostało ostatnie wejście",
      text: "Cześć Anno, na Twoim karnecie (Latino solo, Mikołów) zostało ostatnie wejście. Nowy karnet 4 wejść kosztuje 160 zł — opłacisz go online albo na sali.",
    });
    expect(lapseNotice({ name: "Anno", className: "Latino solo" })).toEqual({
      subject: "Twoje miejsce w grupie wróciło do puli",
      text: "Cześć Anno, nie zobaczyliśmy płatności za zapis na Latino solo, więc po 72 godzinach miejsce wróciło do puli. Jeśli nadal chcesz chodzić — zapisz się ponownie albo zadzwoń: 539 143 200.",
    });
  });

  it("ma przycisk płatności, linijkę o sali i imię dziecka", () => {
    expect(PAY_BUTTON_LABEL).toBe("Zapłać online");
    expect(ONSITE_LINE).toBe(
      "Płacisz na sali? Daj znać trenerowi — odnotujemy wpłatę.",
    );
    expect(participantLine("Jan Kowalski")).toBe("Uczestnik: Jan Kowalski");
  });
});
