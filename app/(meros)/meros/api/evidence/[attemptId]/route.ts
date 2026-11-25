import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/meros/server/auth";
import { liveGame } from "@/lib/meros/server/db";
import { errorResponse } from "@/lib/meros/server/http";
import { signedEvidenceUrl } from "@/lib/meros/server/storage";
import { GameError } from "@/lib/meros/service/context";

export const dynamic = "force-dynamic";

/** Redirects the owner to a 60-second signed URL for their own evidence photo. */
export async function GET(_request: Request, context: RouteContext<"/meros/api/evidence/[attemptId]">) {
  try {
    const owner = await requireOwner();
    const { attemptId } = await context.params;
    const attempt = await liveGame().deps.store.transaction((tx) => tx.get("verification_attempts", attemptId));
    if (!attempt || attempt.owner_id !== owner.id || !attempt.image_path || attempt.image_deleted_at) {
      throw new GameError("not_found", "That photo isn't available.", 404);
    }
    const url = await signedEvidenceUrl(attempt.image_path);
    if (!url) throw new GameError("not_found", "That photo isn't available.", 404);
    return NextResponse.redirect(url, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
