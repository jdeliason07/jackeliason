import { fromSameOrigin, supabaseServer } from "@/lib/meros/server/auth";
import { errorResponse, json } from "@/lib/meros/server/http";
import { GameError } from "@/lib/meros/service/context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!fromSameOrigin(request)) throw new GameError("invalid_input", "Cross-site request refused.", 403);
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    return json({ signedOut: true });
  } catch (error) {
    return errorResponse(error);
  }
}
