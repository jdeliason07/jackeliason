"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CHEST_OPEN_SRC, CHEST_SRC } from "@/lib/meros/content/art";
import { DUPLICATE_CONVERSION, itemById } from "@/lib/meros/content/items";
import type { GameView } from "@/lib/meros/service/view";
import ItemArt from "./art/ItemArt";
import { Count, prefersReducedMotion, Sparks } from "./motion";
import { useAction, useGame } from "./GameProvider";
import { Icon, Note, RarityChip, Sheet } from "./ui";

interface Opening {
  rarity: string;
  credits: number;
  item_id: string;
  duplicate_credits: number;
  replay: boolean;
}

type Phase = "idle" | "charge" | "spin" | "burst" | "reveal";

/**
 * Opening a chest: the server rolls and saves the outcome first; this only reveals it. Re-opening
 * after a dropped connection shows the same saved result. No near-miss theatrics: the reveal shows
 * exactly what you got.
 *
 * The show: the case drops in and idles; on Open it strains three times, spins faster and faster
 * (for as long as the server takes), bursts in a white flash and a ring of sparks, and the item
 * pops out. Under reduced motion it goes straight to the result.
 */
export default function ChestSheet({ chest, onClose }: { chest: GameView["chests"]["unopened"][number]; onClose: () => void }) {
  const game = useGame();
  const action = useAction<Opening>();
  const [opening, setOpening] = useState<Opening | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number) => new Promise<void>((r) => timers.current.push(setTimeout(r, ms)));

  async function open() {
    const quick = prefersReducedMotion();
    if (!quick) setPhase("charge");
    const [result] = await Promise.all([action.execute({ type: "openChest", entitlementId: chest.id }), quick ? null : later(1000).then(() => setPhase("spin"))]);
    if (!result) return setPhase("idle");
    if (!quick) {
      await later(900);
      setPhase("burst");
      game.sound("chest");
      await later(320);
    } else game.sound("chest");
    setOpening(result);
    setPhase("reveal");
  }

  const item = opening ? itemById(opening.item_id) : null;
  const caseClass = { idle: "m-drop", charge: "m-charge", spin: "m-spin", burst: "m-burst-out", reveal: "" }[phase];
  return (
    <Sheet open onClose={onClose} title={`Chest #${chest.seq}`}>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative grid h-56 w-full place-items-center">
          {(phase === "spin" || phase === "burst" || phase === "reveal") && (
            <span aria-hidden="true" className="m-rays absolute h-[22rem] w-[22rem] bg-[repeating-conic-gradient(var(--color-blood)_0deg_6deg,transparent_6deg_30deg)] opacity-15 [mask:radial-gradient(closest-side,black,transparent)]" />
          )}
          {phase !== "reveal" ? (
            <span key={phase} className={`relative block ${caseClass}`}>
              <Image src={CHEST_SRC} alt="A closed case" width={560} height={560} unoptimized priority className={`h-48 w-48 object-contain ${phase === "idle" ? "m-breathe" : ""}`} />
            </span>
          ) : (
            <span className="m-pop relative block">
              <Image src={CHEST_OPEN_SRC} alt="The opened case" width={560} height={560} unoptimized className="h-48 w-48 object-contain" />
            </span>
          )}
          {phase === "burst" && (
            <>
              <span aria-hidden="true" className="m-flash fixed inset-0 z-50 bg-white" />
              <Sparks count={28} distance={170} />
            </>
          )}
        </div>
        {phase !== "reveal" && (
          <>
            <p className="font-normal">Estate Credits plus one item, rolled and saved before you see it.</p>
            {action.error && <Note tone="error">{action.error.message}</Note>}
            <button className="btn btn-primary min-h-14 w-full text-lg" onClick={() => void open()} disabled={phase !== "idle"}>
              <Icon name="chest" /> {phase !== "idle" ? "Opening…" : action.error ? "Try again" : "Open chest"}
            </button>
          </>
        )}
        {opening && item && (
          <div className="flex w-full flex-col items-center gap-3">
            <span className="m-slam">
              <RarityChip rarity={opening.rarity} />
            </span>
            <div className="m-pop flex items-center gap-3 text-left [animation-delay:150ms]">
              <ItemArt itemId={item.id} className="h-20 w-20" />
              <div>
                <p className="font-display text-2xl leading-tight">{item.name}</p>
                <p className="hint">{item.description}</p>
              </div>
            </div>
            <p className="m-rise font-display text-2xl [animation-delay:300ms]">
              <Icon name="coin" className="mr-1 inline h-6 w-6 align-[-0.2em]" />+<Count value={opening.credits} /> Estate Credits
            </p>
            {opening.duplicate_credits > 0 && (
              <Note tone="info">
                You already own {item.name}, so it converted to +{opening.duplicate_credits} Estate Credits.
              </Note>
            )}
            <button className="btn btn-primary w-full" onClick={onClose}>
              Claim
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
    <details className="rule w-full pt-2 text-left">
      <summary className="min-h-11 cursor-pointer content-center font-extrabold">Chest odds and contents</summary>
      <table className="mt-2 w-full text-[0.875rem]">
        <thead>
          <tr className="text-left">
            <th className="py-1">Rarity</th>
            <th>Chance</th>
            <th>Credits</th>
            <th>Duplicate</th>
          </tr>
        </thead>
        <tbody>
          {odds.map((o) => (
            <tr key={o.rarity} className="border-t border-blood">
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
