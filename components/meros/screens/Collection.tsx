"use client";

import { type EquipSlot, itemById, ITEMS } from "@/lib/meros/content/items";
import { STAT_LABEL, STATS } from "@/lib/meros/domain/stats";
import Character from "../art/Character";
import ItemArt from "../art/ItemArt";
import { useAction, useGame } from "../GameProvider";
import { Empty, Note, RarityChip } from "../ui";

const SLOT_LABEL: Record<EquipSlot, string> = { outfit: "Outfit", headwear: "Headwear", handheld: "In hand", accessory: "Accessory" };

export default function Collection() {
  const game = useGame();
  const v = game.view!;
  const toggle = useAction();
  const owned = new Map(v.inventory.map((i) => [i.itemId, i]));
  const equipped = v.inventory.filter((i) => i.equipped).map((i) => i.itemId);
  const cosmetics = v.inventory.map((i) => itemById(i.itemId)!).filter((i) => i?.kind === "cosmetic");
  const decorations = v.inventory.map((i) => itemById(i.itemId)!).filter((i) => i?.kind === "decoration");
  const components = v.inventory.map((i) => itemById(i.itemId)!).filter((i) => i?.kind === "component");
  const totalUnique = ITEMS.filter((i) => i.unique).length;
  const ownedUnique = v.inventory.filter((i) => itemById(i.itemId)?.unique).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[2.25rem] leading-none">Collection</h1>
      <section className="flex items-center gap-4">
        <Character appearance={v.profile.appearance} equipped={equipped} level={v.profile.progress.level} energy={v.profile.energy} className="h-40 w-30 shrink-0" />
        <div className="flex-1">
          <p className="font-extrabold">Ventures stats</p>
          <ul className="mt-1 flex flex-col gap-1 text-[0.9375rem]">
            {STATS.map((s) => (
              <li key={s} className="flex justify-between">
                <span>{STAT_LABEL[s]}</span>
                <span className="font-bold">
                  {v.stats.base[s]}
                  {v.stats.equipment[s] ? ` ${v.stats.equipment[s] > 0 ? "+" : ""}${v.stats.equipment[s]}` : ""} → {v.stats.effective[s]}
                </span>
              </li>
            ))}
          </ul>
          <p className="hint mt-1">Equipment changes battle stats only (each stat’s bonus capped at +5). Never XP.{v.profile.vitalityModifier < 1 ? ` Vitality ×${v.profile.vitalityModifier.toFixed(2)} applies.` : ""}</p>
        </div>
      </section>
      <p className="hint">{ownedUnique}/{totalUnique} unique items collected.</p>
      {toggle.error && <Note tone="error">{toggle.error.message}</Note>}

      <section aria-labelledby="eq" className="flex flex-col gap-2">
        <h2 id="eq" className="font-display text-xl">Equipment</h2>
        {cosmetics.length === 0 && <Empty title="No equipment yet">Chests (every 3 verified minimums) contain equipment, decorations, and components.</Empty>}
        <ul className="m-list flex flex-col">
          {cosmetics.map((item) => {
            const inv = owned.get(item.id)!;
            return (
              <li key={item.id} className="rule flex items-center gap-3 py-4">
                <ItemArt itemId={item.id} />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{item.name}</p>
                  <p className="hint">{SLOT_LABEL[item.slot!]} · {Object.entries(item.stats ?? {}).map(([s, n]) => `${STAT_LABEL[s as keyof typeof STAT_LABEL]} ${n! > 0 ? "+" : ""}${n}`).join(", ")}</p>
                  <RarityChip rarity={item.rarity} />
                </div>
                <button className={`btn min-h-11 shrink-0 px-4 ${inv.equipped ? "btn-secondary" : "btn-primary"}`} disabled={toggle.pending} onClick={() => void toggle.execute({ type: "setEquipped", itemId: item.id, equipped: !inv.equipped })}>
                  {inv.equipped ? "Unequip" : "Equip"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="dec" className="flex flex-col gap-2">
        <h2 id="dec" className="font-display text-xl">Decorations · {v.estate.placedDecorations.length}/{v.estate.bonuses.decorationSlots} placed</h2>
        {decorations.length === 0 && <p className="hint">None yet.</p>}
        <ul className="m-list flex flex-col">
          {decorations.map((item) => {
            const inv = owned.get(item.id)!;
            return (
              <li key={item.id} className="rule flex items-center gap-3 py-4">
                <ItemArt itemId={item.id} />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{item.name}</p>
                  <p className="hint">{item.description}</p>
                </div>
                <button className={`btn min-h-11 shrink-0 px-4 ${inv.equipped ? "btn-secondary" : "btn-primary"}`} disabled={toggle.pending} onClick={() => void toggle.execute({ type: "setEquipped", itemId: item.id, equipped: !inv.equipped })}>
                  {inv.equipped ? "Remove" : "Place"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="comp" className="flex flex-col gap-2">
        <h2 id="comp" className="font-display text-xl">Components</h2>
        <p className="hint">Keepsakes for your collection shelf ({v.estate.bonuses.collectionSlots} display slots; the Workshop adds more).</p>
        <ul className="m-list grid grid-cols-3 gap-2">
          {components.map((item) => (
            <li key={item.id} className="flex flex-col items-center gap-1 py-3 text-center">
              <ItemArt itemId={item.id} />
              <p className="text-sm font-extrabold">{item.name}</p>
              <p className="hint">×{owned.get(item.id)!.quantity}</p>
            </li>
          ))}
        </ul>
        {components.length === 0 && <p className="hint">None yet.</p>}
      </section>
    </div>
  );
}
