import { buildSchoolCalendarIcs } from "@/lib/calendar/feed";
import {
  calendarFeedTokensMatch,
  getCalendarFeedToken,
} from "@/lib/calendar/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { token } = await params;
  const expected = getCalendarFeedToken();
  if (!calendarFeedTokensMatch(token, expected)) {
    return new Response("Nie znaleziono kalendarza.", { status: 404 });
  }

  const body = await buildSchoolCalendarIcs();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="ma-dancing-art.ics"',
      "Cache-Control": "no-cache, no-store, max-age=0",
    },
  });
}
