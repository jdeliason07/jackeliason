import { z } from "zod";
import { fromSameOrigin, isAllowedEmail, supabaseServer } from "@/lib/meros/server/auth";
import { braked, clientKey } from "@/lib/meros/server/brake";
import { errorResponse, json } from "@/lib/meros/server/http";
import { GameError } from "@/lib/meros/service/context";

export const dynamic = "force-dynamic";

/** Verifies the emailed code and sets the session cookies (HttpOnly handled by @supabase/ssr). */
export async function POST(request: Request) {
  try {
    if (!fromSameOrigin(request)) throw new GameError("invalid_input", "Cross-site request refused.", 403);
    if (braked(`verify:${clientKey(request)}`, 10, 15 * 60_000)) throw new GameError("rate_limited", "Too many attempts. Wait a few minutes.", 429);
    const body = z
      .object({ email: z.string().email().max(254), token: z.string().regex(/^\d{6,10}$/) })
      .safeParse(await request.json().catch(() => null));
    if (!body.success) throw new GameError("invalid_input", "Enter the code from the email.");
    const email = body.data.email.toLowerCase();
    if (!isAllowedEmail(email)) throw new GameError("not_found", "That code didn't work. Request a new one.", 401);
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ email, token: body.data.token, type: "email" });
    if (error) throw new GameError("not_found", "That code didn't work. Request a new one.", 401);
    return json({ signedIn: true });
  } catch (error) {
    return errorResponse(error);
  }
}
