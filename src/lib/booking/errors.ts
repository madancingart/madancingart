export function mapBookingError(raw: string): {
  status: number;
  message: string;
} {
  const text = raw.toLowerCase();

  if (text.includes("slot_unavailable")) {
    return {
      status: 409,
      message:
        "Ktoś właśnie zarezerwował ten termin. Odśwież grafik i wybierz inny.",
    };
  }
  if (text.includes("event_full")) {
    return {
      status: 409,
      message:
        "Brak wolnych miejsc na to wydarzenie. Napisz do nas — spróbujemy znaleźć rozwiązanie.",
    };
  }
  if (text.includes("account_required")) {
    return {
      status: 409,
      message:
        "Na stałe zajęcia zapisujesz się przez konto — założysz je w minutę.",
    };
  }
  if (text.includes("class_full")) {
    return {
      status: 409,
      message:
        "Grupa jest pełna. Wybierz inny termin albo napisz do nas — spróbujemy znaleźć miejsce.",
    };
  }
  if (text.includes("class_closed") || text.includes("event_closed")) {
    return {
      status: 409,
      message: "Zapisy na ten termin są zamknięte.",
    };
  }
  if (text.includes("consent_required")) {
    return {
      status: 400,
      message: "Zgoda na przetwarzanie danych jest wymagana.",
    };
  }
  if (text.includes("invalid_phone")) {
    return { status: 400, message: "Podaj poprawny numer telefonu." };
  }
  if (text.includes("invalid_email")) {
    return { status: 400, message: "Podaj poprawny adres e-mail." };
  }
  if (text.includes("invalid_first_name") || text.includes("invalid_last_name")) {
    return { status: 400, message: "Sprawdź imię i nazwisko." };
  }

  return {
    status: 500,
    message: "Nie udało się zapisać. Spróbuj ponownie za chwilę.",
  };
}
