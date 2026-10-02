import { expiredLinkRedirect, redirectAfterSession } from "@/lib/account/finish-login";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return expiredLinkRedirect(request);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return expiredLinkRedirect(request);
  }

  return redirectAfterSession(request, url.searchParams.get("next"), supabase);
}
