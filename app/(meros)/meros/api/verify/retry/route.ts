import { fromSameOrigin, requireOwner } from "@/lib/meros/server/auth";
import { liveGame } from "@/lib/meros/server/db";
import { errorResponse, json } from "@/lib/meros/server/http";
import { evaluateAttempt } from "@/lib/meros/server/photo";
import { downloadEvidence } from "@/lib/meros/server/storage";
import { GameError } from "@/lib/meros/service/context";
import type { Rubric } from "@/lib/meros/verify/vision";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Re-evaluates a photo after a provider outage, reusing the same attempt (never awards twice). */
export async function POST(request: Request) {
  try {
    if (!fromSameOrigin(request)) throw new GameError("invalid_input", "Cross-site request refused.", 403);
    const owner = await requireOwner();
    const body = (await request.json().catch(() => null)) as { attemptId?: string } | null;
    if (!body?.attemptId || !/^[0-9a-f-]{36}$/.test(body.attemptId)) throw new GameError("invalid_input", "Missing attempt.");
    const game = liveGame();
    const retry = await game.photoForRetry(owner.id, body.attemptId);
    let result;
    if (retry.retry) {
      const jpeg = await downloadEvidence(retry.imagePath);
      if (!jpeg) throw new GameError("not_found", "The stored photo is gone. Take a new one if the window is still open.", 410);
      result = await evaluateAttempt(game, owner.id, retry.attempt.id, jpeg, retry.rubric as unknown as Rubric);
    } else {
      result = { attemptId: retry.attempt.id, status: retry.attempt.status, reason: retry.attempt.reason, guidance: retry.attempt.guidance, award: null };
    }
    return json({ result, view: await game.view(owner.id) });
  } catch (error) {
    return errorResponse(error);
  }
}
