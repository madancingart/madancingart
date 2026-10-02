import type { EmailOtpType } from "@supabase/supabase-js";
import { expiredLinkRedirect, redirectAfterSession } from "@/lib/account/finish-login";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next");

  if (!tokenHash || !type || !OTP_TYPES.has(type as EmailOtpType)) {
    return expiredLinkRedirect(request);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  });

  if (error) {
    return expiredLinkRedirect(request);
  }

  const resume =
    type === "recovery" && !next ? "/konto/nowe-haslo" : next;
  return redirectAfterSession(request, resume, supabase);
}
