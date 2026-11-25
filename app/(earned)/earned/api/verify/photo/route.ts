import { IMAGE_RULES } from "@/lib/earned/config";
import { fromSameOrigin, requireOwner } from "@/lib/earned/server/auth";
import { liveGame } from "@/lib/earned/server/db";
import { errorResponse, json } from "@/lib/earned/server/http";
import { processEvidence } from "@/lib/earned/server/image";
import { evaluateAttempt } from "@/lib/earned/server/photo";
import { evidencePath, removeEvidence, uploadEvidence } from "@/lib/earned/server/storage";
import { GameError } from "@/lib/earned/service/context";
import type { Rubric } from "@/lib/earned/verify/vision";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Photo evidence: multipart { challengeId, token, image }. The image was captured in-app with the
 * live camera against a short-lived server challenge. The server validates and re-encodes the bytes,
 * stores them privately, binds them to the challenge and occurrence, then asks the vision provider.
 */
export async function POST(request: Request) {
  try {
    if (!fromSameOrigin(request)) throw new GameError("invalid_input", "Cross-site request refused.", 403);
    const owner = await requireOwner();
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > IMAGE_RULES.maxBytes + 64_000) throw new GameError("invalid_input", "That photo is too large.");
    const form = await request.formData().catch(() => null);
    const challengeId = String(form?.get("challengeId") ?? "");
    const token = String(form?.get("token") ?? "");
    const file = form?.get("image");
    if (!/^[0-9a-f-]{36}$/.test(challengeId) || !/^[0-9a-f]{64}$/.test(token) || !(file instanceof Blob)) {
      throw new GameError("invalid_input", "Incomplete photo submission. Take the photo again.");
    }
    const image = await processEvidence(Buffer.from(await file.arrayBuffer()));
    const game = liveGame();
    const path = evidencePath(owner.id, challengeId);
    await uploadEvidence(path, image.jpeg);
    let begun;
    try {
      begun = await game.beginPhoto(owner.id, { challengeId, token, sha256: image.sha256, dhash: image.dhash, imagePath: path, demo: false });
    } catch (error) {
      await removeEvidence([path]);
      throw error;
    }
    const { attempt } = begun;
    const result = begun.evaluate
      ? await evaluateAttempt(game, owner.id, attempt.id, image.jpeg, attempt.rubric as unknown as Rubric)
      : { attemptId: attempt.id, status: attempt.status, reason: attempt.reason, guidance: attempt.guidance, award: null };
    if (attempt.reuse_of) await removeEvidence([path]);
    const view = await game.view(owner.id);
    return json({ result, view });
  } catch (error) {
    return errorResponse(error);
  }
}
