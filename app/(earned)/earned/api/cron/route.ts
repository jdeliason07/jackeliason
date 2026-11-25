import { timingSafeEqual } from "node:crypto";
import { allOwnerIds, liveGame } from "@/lib/earned/server/db";
import { serverEnv } from "@/lib/earned/server/env";
import { errorResponse, json } from "@/lib/earned/server/http";
import { removeEvidence } from "@/lib/earned/server/storage";
import { GameError } from "@/lib/earned/service/context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled maintenance (vercel.json runs it daily; hourly works on paid plans): materializes occurrences, processes misses in
 * order exactly once, expires optional sessions, and deletes evidence images past retention. Safe to
 * run late, early, or twice: every step is idempotent, and app entry runs the same catch-up.
 */
export async function GET(request: Request) {
  try {
    const secret = serverEnv().cronSecret;
    const given = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
    if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
      throw new GameError("not_found", "Not allowed.", 401);
    }
    const game = liveGame();
    let owners = 0;
    let deleted = 0;
    for (const id of await allOwnerIds()) {
      const { expiredEvidencePaths } = await game.maintenance(id);
      if (await removeEvidence(expiredEvidencePaths)) deleted += expiredEvidencePaths.length;
      owners++;
    }
    return json({ owners, evidenceDeleted: deleted });
  } catch (error) {
    return errorResponse(error);
  }
}
