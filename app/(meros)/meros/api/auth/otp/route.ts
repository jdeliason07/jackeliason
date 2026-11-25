import { z } from "zod";
import { fromSameOrigin, isAllowedEmail, supabaseServer } from "@/lib/meros/server/auth";
import { braked, clientKey } from "@/lib/meros/server/brake";
import { missingLiveSettings } from "@/lib/meros/server/env";
import { errorResponse, json } from "@/lib/meros/server/http";
import { GameError } from "@/lib/meros/service/context";

export const dynamic = "force-dynamic";

/**
 * Sends a 6-digit sign-in code. Codes (not magic links) so sign-in works inside an installed iPhone
 * web app, whose storage is separate from Safari's. Only allowlisted emails get a code; the response
 * is the same either way so the allowlist can't be probed. No accounts are created here.
 */
export async function POST(request: Request) {
  try {
    if (!fromSameOrigin(request)) throw new GameError("invalid_input", "Cross-site request refused.", 403);
    if (missingLiveSettings().length) throw new GameError("verification_unavailable", "Sign-in isn't configured on this server yet.", 503);
    if (braked(`otp:${clientKey(request)}`, 5, 15 * 60_000)) throw new GameError("rate_limited", "Too many code requests. Wait a few minutes.", 429);
    const body = z.object({ email: z.string().email().max(254) }).safeParse(await request.json().catch(() => null));
    if (!body.success) throw new GameError("invalid_input", "Enter a valid email.");
    const email = body.data.email.toLowerCase();
    if (isAllowedEmail(email)) {
      const supabase = await supabaseServer();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) console.error(`[meros] otp send failed: ${error.status ?? ""} ${error.code ?? ""}`);
    }
    return json({ sent: true, message: "If this email is allowed, a 6-digit code is on its way." });
  } catch (error) {
    return errorResponse(error);
  }
}
