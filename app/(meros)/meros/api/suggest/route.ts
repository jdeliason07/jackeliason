import { fromSameOrigin, requireOwner } from "@/lib/meros/server/auth";
import { liveGame } from "@/lib/meros/server/db";
import { errorResponse, json } from "@/lib/meros/server/http";
import { aiSuggestions, SuggestUnavailable } from "@/lib/meros/server/suggest";
import { GameError } from "@/lib/meros/service/context";
import { habitsOf } from "@/lib/meros/domain/suggest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Fresh task ideas from Claude, learned from the owner's own follow-through. Read-only. */
export async function POST(request: Request) {
  try {
    if (!fromSameOrigin(request)) throw new GameError("invalid_input", "Cross-site request refused.", 403);
    const owner = await requireOwner();
    const view = await liveGame().view(owner.id);
    if (!view) throw new GameError("not_onboarded", "Finish setup first.", 409);
    const suggestions = await aiSuggestions(habitsOf(view.quests), view.profile.places);
    return json({ suggestions });
  } catch (error) {
    if (error instanceof SuggestUnavailable) {
      return json({ error: { code: "verification_unavailable", message: "Ideas aren't available right now." } }, 503);
    }
    return errorResponse(error);
  }
}
