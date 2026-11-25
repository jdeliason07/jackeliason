import { requireOwner } from "@/lib/meros/server/auth";
import { liveGame } from "@/lib/meros/server/db";
import { errorResponse, json } from "@/lib/meros/server/http";
import { visionAdapter } from "@/lib/meros/server/vision";

export const dynamic = "force-dynamic";

/** The owner's full game view. Runs the idempotent catch-up (misses, expiries) first. */
export async function GET() {
  try {
    const owner = await requireOwner();
    const view = await liveGame().view(owner.id);
    return json({ onboarded: Boolean(view), view, photoVerification: Boolean(visionAdapter()) });
  } catch (error) {
    return errorResponse(error);
  }
}
