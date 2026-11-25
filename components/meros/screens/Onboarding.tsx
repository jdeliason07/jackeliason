"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBrowserValue } from "../useBrowserValue";
import { APP_BASE_PATH, APP_MOTTO, APP_NAME } from "@/lib/meros/config";
import { type Appearance, DEFAULT_APPEARANCE, HAIR_STYLES } from "@/lib/meros/content/appearance";
import { PHOTO_SKINS, skinKey } from "@/lib/meros/content/art";
import { STAT_BLURB, STAT_LABEL } from "@/lib/meros/domain/stats";
import Character from "../art/Character";
import { useAction, useGame } from "../GameProvider";
import { Note } from "../ui";

export default function Onboarding() {
  const game = useGame();
  const router = useRouter();
  const action = useAction();
  const [name, setName] = useState("");
  const detectedTz = useBrowserValue(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Denver", "America/Denver");
  const [tzOverride, setTz] = useState<string | null>(null);
  const tz = tzOverride ?? detectedTz;
  const [focus, setFocus] = useState<"insight" | "execution" | "influence">("insight");
  const [a, setA] = useState<Appearance>(DEFAULT_APPEARANCE);

  if (game.status !== "onboarding") return null;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const ok = await action.execute({ type: "onboard", displayName: name || "Founder", timezone: tz, focus, appearance: a });
    if (ok) {
      await game.refresh();
      router.replace(`${APP_BASE_PATH}/tasks/new?start=1`);
    }
  }

  const pick = "h-11 w-11 rounded-full border-4";
  return (
    <form className="flex flex-col gap-5 pt-4" onSubmit={start}>
      <div>
        <p className="eyebrow">{APP_MOTTO}</p>
        <h1 className="font-display text-3xl">Welcome to <span className="wordmark text-[1.15em] normal-case">{APP_NAME.toLowerCase()}</span></h1>
        <p className="text-blood">Do the small thing every day. Your character, your estate, and your record follow.</p>
      </div>
      <div className="rule flex flex-col items-center gap-3 py-4">
        <Character appearance={a} level={1} energy="radiant" className="h-64 w-48" animate />
        <div className="flex flex-wrap justify-center gap-2" aria-label="Skin tone">
          {PHOTO_SKINS.map((t, i) => <button type="button" key={t.key} aria-label={`Skin tone ${i + 1}`} aria-pressed={skinKey(a.skin) === t.key} className={`${pick} ${skinKey(a.skin) === t.key ? "border-blood" : "border-white"}`} style={{ background: t.hex }} onClick={() => setA({ ...a, skin: t.hex })} />)}
        </div>
        <div className="flex flex-wrap justify-center gap-2" aria-label="Hair">
          {HAIR_STYLES.filter((h) => h.minLevel <= 1).map((h) => <button type="button" key={h.id} aria-pressed={a.hairStyle === h.id} className="chip min-h-10 px-3" onClick={() => setA({ ...a, hairStyle: h.id })}>{h.label}</button>)}
        </div>
      </div>
      <div><label className="label" htmlFor="o-name">What should we call you?</label><input id="o-name" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Founder" /></div>
      <div><label className="label" htmlFor="o-tz">Time zone</label><input id="o-tz" className="field" value={tz} onChange={(e) => setTz(e.target.value)} /></div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label">Ventures focus (for business battles)</legend>
        {(["insight", "execution", "influence"] as const).map((f) => (
          <button type="button" key={f} aria-pressed={focus === f} className={`rounded-2xl border-[1.5px] border-blood p-3 text-left transition-[background-color,color,transform] duration-300 ease-spring active:scale-[0.98] ${focus === f ? "bg-blood text-white" : "bg-white"}`} onClick={() => setFocus(f)}>
            <span className="font-extrabold">{STAT_LABEL[f]}</span>
            <span className="hint block">{STAT_BLURB[f]}</span>
          </button>
        ))}
      </fieldset>
      {action.error && <Note tone="error">{action.error.message}</Note>}
      <button type="submit" className="btn btn-hero" disabled={action.pending}>Next: pick tasks</button>
    </form>
  );
}
