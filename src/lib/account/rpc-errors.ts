export function participantRpcMessage(message: string): string {
  if (message.includes("invalid_name")) {
    return "Podaj imię i nazwisko (co najmniej 2 znaki).";
  }
  if (message.includes("invalid_phone")) {
    return "Podaj numer telefonu.";
  }
  if (message.includes("partner_required")) {
    return "Podaj imię i nazwisko partnera lub partnerki.";
  }
  if (message.includes("profile_required")) {
    return "Najpierw uzupełnij profil.";
  }
  if (message.includes("forbidden")) {
    return "Nie możesz edytować tego uczestnika.";
  }
  return "Nie udało się zapisać. Spróbuj za chwilę.";
}
