import { NextResponse } from "next/server";
import { pathAfterLogin, safeNextPath } from "@/lib/account/redirect";
import { postLogin } from "@/lib/account/post-login";
import { publicSiteUrl } from "@/lib/booking/confirmation-window";
import type { createClient } from "@/lib/supabase/server";

type AccountClient = Awaited<ReturnType<typeof createClient>>;

const EXPIRED = "/konto/logowanie?blad=link";

export async function redirectAfterSession(
  request: Request,
  nextValue: string | null,
  supabase: AccountClient,
): Promise<NextResponse> {
  const url = new URL(request.url);
  const allowed = [url.origin, new URL(publicSiteUrl()).origin];
  const next = safeNextPath(nextValue, "/konto", allowed);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(EXPIRED, url.origin));
  }

  const result = await postLogin(supabase, user);
  const destination = pathAfterLogin(result, next);
  return NextResponse.redirect(new URL(destination, url.origin));
}

export function expiredLinkRedirect(request: Request): NextResponse {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL(EXPIRED, url.origin));
}
