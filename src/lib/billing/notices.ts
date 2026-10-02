import { site } from "@/content/site";

export const PAY_BUTTON_LABEL = "Zapłać online";
export const ONSITE_LINE =
  "Płacisz na sali? Daj znać trenerowi — odnotujemy wpłatę.";

export function participantLine(fullName: string): string {
  return `Uczestnik: ${fullName}`;
}

export type PaymentNoticeVars = {
  name: string;
  month: string;
  amount: string;
  className: string;
  location: string;
  weekday: string;
  time: string;
  due: string;
};

export function paymentNotice(
  stage: 1 | 2 | 3 | 4,
  vars: PaymentNoticeVars,
): { subject: string; text: string } {
  if (stage === 1) {
    return {
      subject: `Opłata za ${vars.month}: ${vars.className}`,
      text: `Cześć ${vars.name}, przesyłamy rozliczenie za ${vars.month}: ${vars.amount} za ${vars.className} w ${vars.location} (${vars.weekday}, ${vars.time}). Termin płatności: ${vars.due}. Do zobaczenia na sali — Ola i Mikołaj`,
    };
  }
  if (stage === 2) {
    return {
      subject: `Przypomnienie: płatność za ${vars.month}`,
      text: `Cześć ${vars.name}, przypominamy, że do ${vars.due} czeka płatność ${vars.amount} za ${vars.className}. Jeśli wpłata już do nas dotarła, zignoruj tę wiadomość.`,
    };
  }
  if (stage === 3) {
    return {
      subject: `Zaległa płatność za ${vars.month}`,
      text: `Cześć ${vars.name}, nie widzimy jeszcze wpłaty ${vars.amount} za ${vars.className} — termin minął ${vars.due}. Zapłacisz online w minutę. Jeśli coś się zmieniło i nie chodzisz już na zajęcia, odpisz na tego maila — zamkniemy zapis i przestaniemy przypominać.`,
    };
  }
  return {
    subject: `Druga prośba o płatność za ${vars.month}`,
    text: `Cześć ${vars.name}, to ostatnie automatyczne przypomnienie o płatności ${vars.amount} za ${vars.className}. Zależy nam, żeby miejsce w grupie zostało dla Ciebie — prosimy o wpłatę albo krótką wiadomość, co się zmieniło.`,
  };
}

export function passNotice(vars: {
  name: string;
  className: string;
  location: string;
  amount: string;
}): { subject: string; text: string } {
  return {
    subject: "Na karnecie zostało ostatnie wejście",
    text: `Cześć ${vars.name}, na Twoim karnecie (${vars.className}, ${vars.location}) zostało ostatnie wejście. Nowy karnet 4 wejść kosztuje ${vars.amount} — opłacisz go online albo na sali.`,
  };
}

export function lapseNotice(vars: {
  name: string;
  className: string;
}): { subject: string; text: string } {
  return {
    subject: "Twoje miejsce w grupie wróciło do puli",
    text: `Cześć ${vars.name}, nie zobaczyliśmy płatności za zapis na ${vars.className}, więc po 72 godzinach miejsce wróciło do puli. Jeśli nadal chcesz chodzić — zapisz się ponownie albo zadzwoń: ${site.phone}.`,
  };
}
