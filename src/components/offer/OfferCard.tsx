import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { OfferItem } from "@/content/offer";

type OfferCardProps = {
  item: OfferItem;
};

export function OfferCard({ item }: OfferCardProps) {
  return (
    <Link href={`/oferta/${item.slug}`} className="block h-full">
      <Card className="h-full overflow-hidden p-0">
        <div className="relative aspect-[4/3]">
          <Image
            src={item.image}
            alt={`${item.name} — M&A Dancing Art`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
        <div className="flex items-end justify-between gap-3 p-5">
          <div>
            <h3 className="font-medium text-cream">{item.name}</h3>
            <p className="mt-1 text-sm text-muted">{item.shortDesc}</p>
          </div>
          <ArrowRight
            strokeWidth={1.5}
            className="mb-1 size-5 shrink-0 text-gold"
            aria-hidden
          />
        </div>
      </Card>
    </Link>
  );
}
