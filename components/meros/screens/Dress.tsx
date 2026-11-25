"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, useState } from "react";
import { type Appearance, BASE_OUTFITS, HAIR_STYLES } from "@/lib/meros/content/appearance";
import { PHOTO_SKINS, skinKey } from "@/lib/meros/content/art";
import { APP_BASE_PATH } from "@/lib/meros/config";
import Character from "../art/Character";
import { useAction, useGame } from "../GameProvider";
import { Icon, Note, Spinner } from "../ui";

const TABS = [
  { id: "outfit", label: "Outfit" },
  { id: "hair", label: "Hair" },
  { id: "skin", label: "Skin" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/**
 * The dressing room: the character fills the screen, and every pick turns him into the new look
 * (Character's change animation). Nothing is saved until Save; Close leaves him as he was.
 */
export default function Dress() {
  const game = useGame();
  if (game.status !== "ok" || !game.view)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner label="Opening the dressing room…" />
      </div>
    );
  return <Room />;
}

function Room() {
  const game = useGame();
  const router = useRouter();
  const v = game.view!;
  const level = v.profile.progress.level;
  const [a, setA] = useState<Appearance>(v.profile.appearance);
  const [tab, setTab] = useState<Tab>("outfit");
  const save = useAction();
  const equipped = v.inventory.filter((i) => i.equipped).map((i) => i.itemId);
  const dirty = JSON.stringify(a) !== JSON.stringify(v.profile.appearance);
  const tabIndex = TABS.findIndex((t) => t.id === tab);

  const leave = () => (window.history.length > 1 ? router.back() : router.push(`${APP_BASE_PATH}/house`));

  async function commit() {
    const ok = await save.execute({ type: "updateProfile", appearance: a });
    if (!ok) return;
    game.celebrate({ kind: "verify", title: "Looking sharp", lines: ["New look saved."] }, "tap");
    leave();
  }

  const choice = (on: boolean, locked: boolean) =>
    `chip min-h-11 shrink-0 px-4 text-[0.9375rem] ${locked ? "opacity-40" : ""} ${on ? "chip-solid" : ""}`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      <div className="relative min-h-0 flex-1">
        <Character appearance={a} equipped={equipped} level={level} energy={v.profile.energy} animate className="m-pop absolute inset-0 h-full w-full !rounded-none" title="Your character" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <button className="grid h-11 w-11 place-items-center rounded-full bg-white transition-transform duration-300 ease-spring active:scale-90" aria-label="Close without saving" onClick={leave}>
            <Icon name="x" />
          </button>
          <h1 className="rounded-full bg-white px-4 py-1.5 font-display text-xl">Dressing room</h1>
          <span className="w-11" />
        </div>
      </div>

      <section className="m-sheet flex flex-col gap-4 rounded-t-[1.75rem] border-t border-blood bg-white px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]" aria-label="Choose a look">
        <div role="tablist" aria-label="What to change" className="relative grid grid-cols-3 rounded-full border-[1.5px] border-blood p-1">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-blood transition-transform duration-300 ease-spring"
            style={{ transform: `translateX(${tabIndex * 100}%)` } as CSSProperties}
          />
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`relative min-h-10 rounded-full font-display text-base tracking-wide uppercase transition-colors duration-200 ${tab === t.id ? "text-white" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div key={tab} className="m-list -mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label={TABS[tabIndex].label}>
          {tab === "outfit" &&
            BASE_OUTFITS.map((o) => {
              const locked = o.minLevel > level;
              return (
                <button key={o.id} aria-pressed={a.baseOutfit === o.id} disabled={locked} className={choice(a.baseOutfit === o.id, locked)} onClick={() => setA({ ...a, baseOutfit: o.id })}>
                  {locked && <Icon name="lock" className="h-3.5 w-3.5" />} {o.label}
                  {locked ? ` · L${o.minLevel}` : ""}
                </button>
              );
            })}
          {tab === "hair" &&
            HAIR_STYLES.map((h) => {
              const locked = h.minLevel > level;
              return (
                <button key={h.id} aria-pressed={a.hairStyle === h.id} disabled={locked} className={choice(a.hairStyle === h.id, locked)} onClick={() => setA({ ...a, hairStyle: h.id })}>
                  {locked && <Icon name="lock" className="h-3.5 w-3.5" />} {h.label}
                  {locked ? ` · L${h.minLevel}` : ""}
                </button>
              );
            })}
          {tab === "skin" &&
            PHOTO_SKINS.map((t, i) => (
              <button
                key={t.key}
                aria-label={`Skin tone ${i + 1}`}
                aria-pressed={skinKey(a.skin) === t.key}
                className={`h-11 w-11 shrink-0 rounded-full border-4 transition-[border-color,transform] duration-300 ease-spring active:scale-90 ${skinKey(a.skin) === t.key ? "border-blood" : "border-white"}`}
                style={{ background: t.hex }}
                onClick={() => setA({ ...a, skin: t.hex })}
              />
            ))}
        </div>

        {save.error && <Note tone="error">{save.error.message}</Note>}
        <button className={`btn ${dirty ? "btn-hero" : "btn-secondary min-h-14"} w-full text-lg`} disabled={!dirty || save.pending} onClick={() => void commit()}>
          {save.pending ? "Saving…" : dirty ? "Save this look" : "Pick a new look"}
        </button>
      </section>
    </div>
  );
}
