import { OfferCard } from "@/components/offer/OfferCard";
import { offerItems } from "@/content/offer";

type OfferGridProps = {
  items?: typeof offerItems;
};

export function OfferGrid({ items = offerItems }: OfferGridProps) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.slug}>
          <OfferCard item={item} />
        </li>
      ))}
    </ul>
  );
}
