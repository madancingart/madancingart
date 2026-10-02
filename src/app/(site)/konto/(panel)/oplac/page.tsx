import type { Metadata } from "next";
import { CheckoutButton } from "@/components/account/CheckoutButton";
import { Button } from "@/components/ui/Button";
import { isPaymentsEnabled } from "@/lib/validation";
import { firstParam } from "@/lib/account/params";
import { loadChargeForPayment } from "@/lib/account/panel";
import { formatBillingZloty } from "@/lib/billing/status";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `Płatność — ${site.name}`,
};

const CHARGE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDue(isoDate: string): string {
  const day = Number.parseInt(isoDate.slice(8, 10), 10);
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  return `${day}.${month}.${isoDate.slice(0, 4)}`;
}

export default async function PayChargePage({
  searchParams,
}: {
  searchParams: Promise<{ naleznosc?: string | string[] }>;
}) {
  const params = await searchParams;
  const chargeId = firstParam(params.naleznosc);

  if (!chargeId || !CHARGE_ID.test(chargeId)) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg text-cream">Płatność</h2>
        <p className="text-sm text-muted">Wybierz należność z listy płatności.</p>
        <Button href="/konto/platnosci" variant="outline" size="sm">
          Płatności
        </Button>
      </div>
    );
  }

  const charge = await loadChargeForPayment(chargeId);
  if (!charge) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg text-cream">Płatność</h2>
        <p className="text-sm text-muted">Nie znaleziono tej należności.</p>
        <Button href="/konto/platnosci" variant="outline" size="sm">
          Płatności
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg text-cream">Płatność</h2>
      <article className="border border-white/10 bg-black-soft p-4 text-sm">
        <p className="text-cream">{charge.description}</p>
        <p className="mt-2 text-cream">{formatBillingZloty(charge.amountCents)}</p>
        <p className="mt-1 text-muted">Termin {formatDue(charge.dueDate)} · {charge.state}</p>
      </article>
      {charge.payHref && isPaymentsEnabled() ? (
        <CheckoutButton label={`Zapłać ${formatBillingZloty(charge.amountCents)}`} chargeId={chargeId} />
      ) : charge.payHref ? (
        <p className="text-sm leading-relaxed text-cream">
          Płatność online jest chwilowo wyłączona. Możesz zapłacić gotówką na sali — trener
          odnotuje wpłatę, a status zmieni się w płatnościach.
        </p>
      ) : (
        <p className="text-sm text-cream">
          {charge.state === "Opłacone"
            ? "Ta należność jest już opłacona."
            : "Tej należności nie da się już opłacić."}
        </p>
      )}
      <Button href="/konto/platnosci" variant="outline" size="sm">
        Wróć do płatności
      </Button>
    </div>
  );
}
