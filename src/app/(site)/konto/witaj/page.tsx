import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { redirect } from "next/navigation";
import { AccountScreen } from "@/components/account/AccountScreen";
import { Button } from "@/components/ui/Button";
import { firstParam } from "@/lib/account/params";
import { groupSignupHref } from "@/lib/account/redirect";
import { site } from "@/content/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Witaj",
};

const WEEKDAY = [
  "",
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
] as const;

type WelcomeEnrollment = {
  id: string;
  label: string;
  paidUntil: string | null;
};

type SuggestedGroup = {
  id: string;
  label: string;
  href: string;
};

function clock(value: string): string {
  return value.slice(0, 5);
}

function city(locationId: string): string {
  return site.locations.find((item) => item.id === locationId)?.city ?? locationId;
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ claimed?: string | string[] }>;
}) {
  const params = await searchParams;
  const claimed = Number(firstParam(params.claimed) ?? "0");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/konto/logowanie?next=/konto/witaj");
  }

  const found = Number.isFinite(claimed) && claimed > 0;

  if (found) {
    const { data } = await supabase
      .from("enrollments")
      .select(
        "id, paid_until, status, recurring_classes(weekday, start_time, location_id, class_types(name))",
      )
      .in("status", ["pending", "active", "paused"]);

    const enrollments: WelcomeEnrollment[] = (data ?? []).flatMap((row) => {
      const klass = Array.isArray(row.recurring_classes)
        ? row.recurring_classes[0]
        : row.recurring_classes;
      if (!klass) {
        return [];
      }
      const type = Array.isArray(klass.class_types)
        ? klass.class_types[0]
        : klass.class_types;
      const weekday =
        typeof klass.weekday === "number" ? (WEEKDAY[klass.weekday] ?? "") : "";
      const time = typeof klass.start_time === "string" ? clock(klass.start_time) : "";
      const place = typeof klass.location_id === "string" ? city(klass.location_id) : "";
      const name = type && typeof type.name === "string" ? type.name : "Zajęcia";
      return [
        {
          id: row.id,
          label: [name, weekday, time, place].filter(Boolean).join(" · "),
          paidUntil: typeof row.paid_until === "string" ? row.paid_until : null,
        },
      ];
    });

    return (
      <AccountScreen script="Już Cię znamy" title="Znaleźliśmy Twoje dotychczasowe zajęcia">
        {enrollments.length === 0 ? (
          <p className="text-cream">Nie mamy teraz aktywnego zapisu na grupę.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {enrollments.map((item) => (
              <li key={item.id} className="border border-white/15 px-4 py-3">
                <p className="text-cream">{item.label}</p>
                <p className="mt-1 text-sm text-muted">
                  {item.paidUntil
                    ? `opłacone do ${format(parseISO(item.paidUntil), "d MMMM yyyy", { locale: pl })}`
                    : "opłacone do —"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AccountScreen>
    );
  }

  const { data: profile } = await supabase
    .from("account_profiles")
    .select("interests")
    .eq("user_id", user.id)
    .maybeSingle();
  const interests = Array.isArray(profile?.interests)
    ? profile.interests.filter((item): item is string => typeof item === "string")
    : [];

  const suggestions = await suggestedGroups(supabase, interests);

  return (
    <AccountScreen script="Zaczynamy" title="Wybierz grupę">
      {suggestions.length === 0 ? (
        <Button href="/grafik">Zobacz grafik</Button>
      ) : (
        <ul className="flex flex-col gap-4">
          {suggestions.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 border border-white/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-cream">{item.label}</p>
              <Button href={item.href} size="sm">
                Zapisz się
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AccountScreen>
  );
}

async function suggestedGroups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  interests: string[],
): Promise<SuggestedGroup[]> {
  if (interests.length === 0) {
    return [];
  }

  const { data: types } = await supabase
    .from("class_types")
    .select("id, slug, name")
    .in("slug", interests);

  const typeIds = (types ?? []).flatMap((row) =>
    typeof row.id === "string" ? [row.id] : [],
  );
  if (typeIds.length === 0) {
    return [];
  }

  const names = new Map(
    (types ?? []).flatMap((row) =>
      typeof row.id === "string" && typeof row.name === "string"
        ? [[row.id, row.name] as const]
        : [],
    ),
  );

  const { data: classes } = await supabase
    .from("recurring_classes")
    .select("id, weekday, start_time, location_id, class_type_id")
    .in("class_type_id", typeIds)
    .eq("active", true)
    .eq("signup_open", true);

  return (classes ?? []).flatMap((row) => {
    if (typeof row.id !== "string") {
      return [];
    }
    const weekday = typeof row.weekday === "number" ? (WEEKDAY[row.weekday] ?? "") : "";
    const time = typeof row.start_time === "string" ? clock(row.start_time) : "";
    const place = typeof row.location_id === "string" ? city(row.location_id) : "";
    const name =
      typeof row.class_type_id === "string" ? (names.get(row.class_type_id) ?? "Zajęcia") : "Zajęcia";
    return [
      {
        id: row.id,
        label: [name, weekday, time, place].filter(Boolean).join(" · "),
        href: groupSignupHref(row.id),
      },
    ];
  });
}
