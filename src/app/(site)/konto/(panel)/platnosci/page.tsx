import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { firstParam } from "@/lib/account/params";
import { formatBillingZloty } from "@/lib/billing/status";
import { loadChargeList } from "@/lib/account/panel";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: `Płatności — ${site.name}`,
};

function formatDue(isoDate: string): string {
  const day = Number.parseInt(isoDate.slice(8, 10), 10);
  const month = Number.parseInt(isoDate.slice(5, 7), 10);
  return `${day}.${month}.${isoDate.slice(0, 4)}`;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const params = await searchParams;
  const paid = firstParam(params.status) === "ok";
  const charges = await loadChargeList();

  if (!charges) {
    return (
      <p role="alert" className="text-sm text-[#E8A0A0]">
        Nie udało się wczytać płatności. Odśwież stronę.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {paid ? (
        <p className="border border-gold/50 bg-black-soft p-4 text-sm text-cream" role="status">
          Dziękujemy — wpłata zaksięgowana.
        </p>
      ) : null}
      <h2 className="text-lg text-cream">Należności</h2>
      {charges.length === 0 ? (
        <p className="text-sm text-muted">Nie masz jeszcze należności.</p>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {charges.map((charge) => (
              <li key={charge.id} className="border border-white/10 bg-black-soft p-4 text-sm">
                <p className="text-cream">{charge.description}</p>
                <dl className="mt-2 space-y-1 text-muted">
                  <div className="flex justify-between gap-3">
                    <dt>Okres</dt>
                    <dd className="text-cream">{charge.period}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Kwota</dt>
                    <dd className="text-cream">{formatBillingZloty(charge.amountCents)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Termin</dt>
                    <dd className="text-cream">{formatDue(charge.dueDate)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Status</dt>
                    <dd className="text-cream">{charge.state}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Metoda</dt>
                    <dd className="text-cream">{charge.method}</dd>
                  </div>
                </dl>
                {charge.payHref ? (
                  <Button href={charge.payHref} size="sm" className="mt-3">
                    Opłać
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Należności</caption>
              <thead>
                <tr className="border-b border-white/10 text-muted">
                  <th scope="col" className="py-2 pr-3 font-normal">Okres</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Opis</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Kwota</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Termin</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Status</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Metoda</th>
                  <th scope="col" className="py-2 font-normal">
                    <span className="sr-only">Akcja</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => (
                  <tr key={charge.id} className="border-b border-white/10">
                    <td className="py-3 pr-3 text-cream">{charge.period}</td>
                    <td className="py-3 pr-3 text-cream">{charge.description}</td>
                    <td className="py-3 pr-3 text-cream">{formatBillingZloty(charge.amountCents)}</td>
                    <td className="py-3 pr-3 text-cream">{formatDue(charge.dueDate)}</td>
                    <td className="py-3 pr-3 text-cream">{charge.state}</td>
                    <td className="py-3 pr-3 text-cream">{charge.method}</td>
                    <td className="py-3 text-right">
                      {charge.payHref ? (
                        <Button href={charge.payHref} size="sm">
                          Opłać
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-sm text-muted">
        Płacisz gotówką na sali? Trener odnotuje wpłatę, a status zmieni się tutaj.
      </p>
    </div>
  );
}
