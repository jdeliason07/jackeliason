import "server-only";
import type { Game } from "../service/game";
import type { AttemptResult } from "../service/verification";
import { type Rubric, VisionUnavailable } from "../verify/vision";
import { serverEnv } from "./env";
import { visionAdapter } from "./vision";

/**
 * Runs the configured vision adapter for a pending attempt and records the result. The attempt id is
 * the stable verification identity: this can be called again after an outage and never double-awards.
 */
export async function evaluateAttempt(game: Game, owner: string, attemptId: string, jpeg: Buffer, rubric: Rubric): Promise<AttemptResult> {
  const adapter = visionAdapter();
  if (!adapter) {
    return game.resolvePhoto(owner, attemptId, {
      kind: "unavailable",
      reason: "Photo verification isn't configured on this server.",
      provider: "none",
      model: "none",
    });
  }
  try {
    const verdict = await adapter.evaluate({ jpeg, rubric, signal: AbortSignal.timeout(serverEnv().vision.timeoutMs + 5_000) });
    return game.resolvePhoto(owner, attemptId, { kind: "verdict", verdict, provider: adapter.provider, model: adapter.model });
  } catch (error) {
    const reason =
      error instanceof VisionUnavailable
        ? "The photo checker is temporarily unavailable."
        : error instanceof Error && error.name === "TimeoutError"
          ? "The photo checker timed out."
          : "The photo checker couldn't be reached.";
    console.error(`[meros] vision unavailable: ${error instanceof Error ? error.message.slice(0, 120) : "unknown"}`);
    return game.resolvePhoto(owner, attemptId, { kind: "unavailable", reason, provider: adapter.provider, model: adapter.model });
  }
}
