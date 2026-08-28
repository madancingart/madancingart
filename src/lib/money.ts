export function formatPlnFromCents(amountCents: number): string {
  const isRound = amountCents % 100 === 0;

  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: isRound ? 0 : 2,
    maximumFractionDigits: isRound ? 0 : 2,
  }).format(amountCents / 100);
}
