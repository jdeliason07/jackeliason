import { requireOwner } from "@/lib/earned/server/auth";
import { liveGame } from "@/lib/earned/server/db";
import { errorResponse, json } from "@/lib/earned/server/http";
import { visionAdapter } from "@/lib/earned/server/vision";

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
