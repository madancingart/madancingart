import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AdminLocationTabs } from "@/components/admin/AdminLocationTabs";
import { AdminNav } from "@/components/admin/AdminNav";
import { IcalSubscribeButton } from "@/components/admin/IcalSubscribeButton";
import { getCalendarFeedToken } from "@/lib/calendar/token";
import { requireAdmin } from "@/lib/admin/require-admin";

export default async function AdminAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requireAdmin();

  return (
    <div className="flex min-h-full">
      <AdminNav email={user.email ?? user.id} />
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <header className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[13px] text-cream">
              {user.email ?? "Administrator"}
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <IcalSubscribeButton token={getCalendarFeedToken()} />
              <Link href="/" className="text-[12px] text-muted hover:text-gold">
                Strona
              </Link>
            </div>
          </div>
          <Suspense
            fallback={<div className="h-8 border-b border-white/10" />}
          >
            <AdminLocationTabs />
          </Suspense>
        </header>
        <div className="flex-1 px-4 py-4 md:px-6 md:py-5">{children}</div>
      </div>
    </div>
  );
}
