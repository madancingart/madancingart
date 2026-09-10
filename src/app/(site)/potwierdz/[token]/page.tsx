import type { Metadata } from "next";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/content/site";
import { formatBookingWhen, nowInWarsaw, toWarsaw } from "@/lib/datetime";
import { createAdminClient } from "@/lib/supabase/admin";
import { telHref } from "@/lib/contact";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Potwierdzenie terminu | M&A Dancing Art",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

const uuidSchema = z.uuid();

function staleCopy() {
  return (
    <SectionHeading
      script="Kontakt"
      title="Ten link jest już nieaktualny"
      titleAs="h1"
      align="left"
      sub={
        <>
          Jeśli nadal chcesz potwierdzić lekcję, zadzwoń:
          {" "}
          <a href={telHref(site.phone)} className="text-gold hover:text-gold-light">
            {site.phone}
          </a>
          .
        </>
      }
    />
  );
}

export default async function ConfirmBookingPage({ params }: PageProps) {
  const { token } = await params;
  if (!uuidSchema.safeParse(token).success) {
    return (
      <section className="py-20 md:py-28">
        <Container className="max-w-lg">{staleCopy()}</Container>
      </section>
    );
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id,status,confirmed_at,slot_id,slots(starts_at,ends_at,location_id)",
    )
    .eq("confirm_token", token)
    .maybeSingle();

  type SlotEmbed = {
    starts_at: string;
    ends_at: string;
    location_id: string;
  };
  const slotRaw = data
    ? ((data as { slots: SlotEmbed | SlotEmbed[] | null }).slots ?? null)
    : null;
  const slot = Array.isArray(slotRaw) ? (slotRaw[0] ?? null) : slotRaw;
  const now = nowInWarsaw();
  const alreadyConfirmed = Boolean(data?.confirmed_at);
  const cancelled = data?.status === "cancelled";
  const upcoming =
    slot != null && new Date(slot.starts_at).getTime() > now.getTime();

  let confirmed = alreadyConfirmed && !cancelled && upcoming;
  if (data && !cancelled && upcoming && !alreadyConfirmed) {
    const { data: ok } = await supabase.rpc("confirm_booking", {
      p_token: token,
    });
    confirmed = ok === true;
  }

  if (!confirmed || !slot) {
    return (
      <section className="py-20 md:py-28">
        <Container className="max-w-lg">{staleCopy()}</Container>
      </section>
    );
  }

  const location = site.locations.find((item) => item.id === slot.location_id);
  const when = formatBookingWhen(toWarsaw(slot.starts_at), toWarsaw(slot.ends_at));
  const where = [location?.city, location?.address].filter(Boolean).join(", ");

  return (
    <section className="py-20 md:py-28">
      <Container className="max-w-lg">
        <SectionHeading
          script="Do zobaczenia"
          title="Termin potwierdzony, do zobaczenia!"
          titleAs="h1"
          align="left"
          sub={`${when}${where ? ` · ${where}` : ""}`}
        />
        <Button href="/grafik" className="mt-10 min-h-11">
          Wróć do grafiku
        </Button>
      </Container>
    </section>
  );
}
