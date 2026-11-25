"use client";

import { useState } from "react";
import { effortBonusXp, EFFORT_ANCHORS } from "@/lib/meros/domain/xp";
import { celebrateLevels } from "./awards";
import { useAction, useGame } from "./GameProvider";
import { Note, Sheet } from "./ui";

/** Finishing optional work: a self-rated effort score. The evidence verified only the minimum. */
export default function RatingSheet({ sessionId, title, maxXp, onClose }: { sessionId: string; title: string; maxXp: number; onClose: () => void }) {
  const game = useGame();
  const action = useAction<{ status: string; bonusXp: number; levelsGained: number[] }>();
  const [rating, setRating] = useState<number | null>(null);

  async function finish(r: number | null) {
    const res = await action.execute({ type: "finishOptional", sessionId, rating: r });
    if (!res) return;
    if (res.status === "expired") {
      game.celebrate({ kind: "info", title: "Window closed", lines: ["That optional session ended with the quest's window. Your minimum still counts in full."] });
    } else if (res.bonusXp > 0) {
      game.celebrate({ kind: "verify", title: `${title}: extra effort`, lines: [`+${res.bonusXp} bonus XP (self-rated).`] }, "verify");
    } else {
      game.celebrate({ kind: "info", title: "Done for today", lines: ["No bonus, no penalty. Showing up was the goal."] });
    }
    if (res.levelsGained.length) celebrateLevels(game.celebrate, res.levelsGained);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title="How did the extra work go?">
      <div className="flex flex-col gap-4">
        <p className="text-blood">
          Self-rated, honor system. The photo or location verified your minimum, not your effort. Up to +{maxXp / 2} XP.
        </p>
        <div role="radiogroup" aria-label="Effort rating, 1 to 10" className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={rating === n}
              onClick={() => setRating(n)}
              className={`btn min-h-14 px-0 text-lg ${rating === n ? "btn-primary" : "btn-secondary"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <ul className="hint flex flex-col gap-0.5">
          {Object.entries(EFFORT_ANCHORS).map(([n, label]) => (
            <li key={n}>
              <strong>{n}</strong> = {label}
            </li>
          ))}
        </ul>
        {action.error && <Note tone="error">{action.error.message}</Note>}
        <button className="btn btn-primary w-full" disabled={rating === null || action.pending} onClick={() => void finish(rating)}>
          {rating === null ? "Pick a rating" : `Finish · +${effortBonusXp(rating, maxXp)} XP`}
        </button>
        <button className="btn btn-ghost w-full" disabled={action.pending} onClick={() => void finish(null)}>
          Done for today (no rating, no bonus)
        </button>
      </div>
    </Sheet>
  );
}
