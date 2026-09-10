export function pluralizePolishLastName(lastName: string): string {
  const trimmed = lastName.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  if (/ski$/i.test(trimmed)) {
    return `${trimmed.slice(0, -3)}scy`;
  }
  if (/cki$/i.test(trimmed)) {
    return `${trimmed.slice(0, -3)}ccy`;
  }
  return trimmed;
}

export function weddingCoupleTileLabel(input: {
  lastName: string | null;
  partnerLastName: string | null;
}): string {
  const first = (input.lastName ?? "").trim();
  const partner = (input.partnerLastName ?? "").trim();
  if (first && partner && first.toLowerCase() === partner.toLowerCase()) {
    return pluralizePolishLastName(first);
  }
  if (first && partner) {
    return `${first} i ${partner}`;
  }
  return first || partner || "Para";
}

export function weddingSlotTileLabel(input: {
  lastName: string | null;
  partnerLastName: string | null;
  lessonNo: number | null;
  totalLessons: number | null;
}): string {
  const couple = weddingCoupleTileLabel(input);
  const progress =
    input.lessonNo != null && input.totalLessons != null
      ? ` (${input.lessonNo}/${input.totalLessons})`
      : "";
  return `${couple} — pierwszy taniec${progress}`;
}
