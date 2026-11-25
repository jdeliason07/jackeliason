import { fromSameOrigin, requireOwner } from "@/lib/earned/server/auth";
import { liveGame } from "@/lib/earned/server/db";
import { errorResponse, json } from "@/lib/earned/server/http";
import { removeEvidence } from "@/lib/earned/server/storage";
import { visionAdapter } from "@/lib/earned/server/vision";
import { GameError } from "@/lib/earned/service/context";
import { parseCommand } from "@/lib/earned/service/game";

export const dynamic = "force-dynamic";

/**
 * Every game mutation. Body: { command, idempotencyKey }. A repeated key returns the stored result
 * instead of running again, so retries, double taps, and refreshes can't duplicate anything.
 */
export async function POST(request: Request) {
  try {
    if (!fromSameOrigin(request)) throw new GameError("invalid_input", "Cross-site request refused.", 403);
    const owner = await requireOwner();
    const body = (await request.json().catch(() => null)) as { command?: unknown; idempotencyKey?: unknown } | null;
    if (!body) throw new GameError("invalid_input", "Invalid request body.");
    const command = parseCommand(body.command);
    if (command.type === "issueChallenge" && !visionAdapter()) {
      throw new GameError("verification_unavailable", "Photo verification isn't configured on this server yet, so photo quests can't be checked in. Nothing is counted against you.", 503);
    }
    const game = liveGame();
    const response = await game.command(owner.id, command, String(body.idempotencyKey ?? ""));
    if (command.type === "deleteEvidence") {
      const path = (response.result as { path: string | null }).path;
      if (path) await removeEvidence([path]);
    }
    const view = await game.view(owner.id);
    return json({ ...response, view });
  } catch (error) {
    return errorResponse(error);
  }
}
