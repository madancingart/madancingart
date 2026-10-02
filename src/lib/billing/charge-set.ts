export type CheckoutCharge = {
  id: string;
  status: "open" | "paid" | "void";
  periodStart: string | null;
  customerId: string;
  amountCents: number;
  label: string;
  enrollmentId: string | null;
  stripeSessionId: string | null;
};

const MAX_CHECKOUT_CHARGES = 10;

export function chargesForCheckout(
  charges: readonly CheckoutCharge[],
): CheckoutCharge[] {
  const open = charges.filter((charge) => charge.status === "open");
  const customerIds = new Set(open.map((charge) => charge.customerId));
  if (customerIds.size !== 1) {
    return [];
  }

  return open
    .slice()
    .sort((left, right) => comparePeriod(left.periodStart, right.periodStart) || left.id.localeCompare(right.id))
    .slice(0, MAX_CHECKOUT_CHARGES);
}

/** Należność z linku oraz starsze otwarte z tego samego zapisu. */
export function chargesWithOlder(
  charges: readonly CheckoutCharge[],
  currentId: string,
): CheckoutCharge[] {
  const current = charges.find((charge) => charge.id === currentId);
  if (!current || current.status !== "open") {
    return [];
  }

  const selected = charges.filter((charge) => {
    if (charge.status !== "open" || charge.customerId !== current.customerId) {
      return false;
    }
    if (charge.enrollmentId !== current.enrollmentId) {
      return false;
    }
    if (charge.id === current.id) {
      return true;
    }
    if (!charge.periodStart || !current.periodStart) {
      return false;
    }
    return charge.periodStart <= current.periodStart;
  });

  return chargesForCheckout(selected);
}

function comparePeriod(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return -1;
  }
  if (!right) {
    return 1;
  }
  return left.localeCompare(right);
}
