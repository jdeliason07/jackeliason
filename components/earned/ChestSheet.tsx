"use client";

import { useState } from "react";
import { DUPLICATE_CONVERSION, itemById } from "@/lib/earned/content/items";
import type { GameView } from "@/lib/earned/service/view";
import ChestArt from "./art/ChestArt";
import ItemArt from "./art/ItemArt";
import { useAction, useGame } from "./GameProvider";
import { Icon, Note, RarityChip, Sheet } from "./ui";

interface Opening {
  rarity: string;
  credits: number;
  item_id: string;
  duplicate_credits: number;
  replay: boolean;
}

/**
 * Opening a chest: the server rolls and saves the outcome first; this only reveals it. Re-opening
 * after a dropped connection shows the same saved result. No near-miss theatrics: the reveal shows
 * exactly what you got.
 */
export default function ChestSheet({ chest, onClose }: { chest: GameView["chests"]["unopened"][number]; onClose: () => void }) {
  const game = useGame();
  const action = useAction<Opening>();
  const [opening, setOpening] = useState<Opening | null>(null);

  async function open() {
    const result = await action.execute({ type: "openChest", entitlementId: chest.id });
    if (result) {
      setOpening(result);
      game.sound("chest");
    }
  }

  const item = opening ? itemById(opening.item_id) : null;
  return (
    <Sheet open onClose={onClose} title={`Chest #${chest.seq}`}>
      <div className="flex flex-col items-center gap-4 text-center">
        <ChestArt open={Boolean(opening)} rarity={opening?.rarity} shake={action.pending} className="h-40 w-40" />
        {!opening && (
          <>
            <p className="text-ink-soft">Earned from three verified minimums. Every chest holds Estate Credits plus one item.</p>
            {action.error && <Note tone="error">{action.error.message}</Note>}
            <button className="btn btn-primary w-full text-lg" onClick={() => void open()} disabled={action.pending}>
              <Icon name="chest" /> {action.pending ? "Opening…" : action.error ? "Try again" : "Open chest"}
            </button>
          </>
        )}
        {opening && item && (
          <div className="earned-pop flex w-full flex-col items-center gap-3">
            <RarityChip rarity={opening.rarity} />
            <div className="flex items-center gap-3 rounded-2xl bg-cloud p-3 text-left">
              <ItemArt itemId={item.id} />
              <div>
                <p className="font-display text-lg font-semibold">{item.name}</p>
                <p className="hint">{item.description}</p>
              </div>
            </div>
            <p className="font-extrabold">
              <Icon name="coin" className="mr-1 inline h-5 w-5" />+{opening.credits} Estate Credits
            </p>
            {opening.duplicate_credits > 0 && (
              <Note tone="info">
                You already own {item.name}, so it converted to +{opening.duplicate_credits} Estate Credits.
              </Note>
            )}
            <button className="btn btn-primary w-full" onClick={onClose}>
              Nice
            </button>
          </div>
        )}
        <OddsInfo odds={game.view!.chests.odds} />
      </div>
    </Sheet>
  );
}

export function OddsInfo({ odds }: { odds: GameView["chests"]["odds"] }) {
  return (
    <details className="w-full rounded-2xl bg-cloud px-4 py-3 text-left">
      <summary className="min-h-11 cursor-pointer content-center font-extrabold">Chest odds and contents</summary>
      <table className="mt-2 w-full text-[0.875rem]">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1">Rarity</th>
            <th>Chance</th>
            <th>Credits</th>
            <th>Duplicate</th>
          </tr>
        </thead>
        <tbody>
          {odds.map((o) => (
            <tr key={o.rarity} className="border-t border-line">
              <td className="py-1.5 capitalize">{o.rarity}</td>
              <td>{o.percent}%</td>
              <td>{o.credits}</td>
              <td>+{DUPLICATE_CONVERSION[o.rarity as keyof typeof DUPLICATE_CONVERSION]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint mt-2">
        Each chest: credits plus one item of the rolled rarity (equipment 50%, collectible component 30%, decoration 20% where available). Rolled once on the server and saved before you see it. Chests never contain XP or real money, and there’s no way to pay for one.
      </p>
    </details>
  );
}
