"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBrowserValue } from "../useBrowserValue";
import { APP_BASE_PATH, APP_NAME } from "@/lib/meros/config";
import {
  ACCENT_COLORS,
  type Appearance,
  BACKGROUNDS,
  BASE_OUTFITS,
  FLAIR_LABELS,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFIT_COLORS,
  SKIN_TONES,
  unlockedAt,
} from "@/lib/meros/content/appearance";
import { STAT_BLURB, STAT_LABEL } from "@/lib/meros/domain/stats";
import Character from "../art/Character";
import { useAction, useGame } from "../GameProvider";
import { formatDay, Icon, Note } from "../ui";

function Swatches({ label, values, value, onPick, unlocked }: { label: string; values: string[]; value: string; onPick: (v: string) => void; unlocked?: string[] }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((c, i) => {
          const locked = unlocked ? !unlocked.includes(c) : false;
          return (
            <button
              key={c}
              type="button"
              aria-label={`${label} ${i + 1}${locked ? " (locked)" : ""}`}
              aria-pressed={value === c}
              disabled={locked}
              onClick={() => onPick(c)}
              className={`h-11 w-11 rounded-full border-4 ${value === c ? "border-blood" : "border-white"} ${locked ? "opacity-30" : ""}`}
              style={{ background: c }}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

function Options<T extends string>({ label, options, value, onPick, level }: { label: string; options: { id: T; label: string; minLevel: number }[]; value: T; onPick: (v: T) => void; level: number }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const locked = o.minLevel > level;
          return (
            <button key={o.id} type="button" aria-pressed={value === o.id} disabled={locked} onClick={() => onPick(o.id)} className={`chip min-h-10 px-3 ${locked ? "opacity-50" : ""}`}>
              {locked && <Icon name="lock" className="h-3.5 w-3.5" />} {o.label}
              {locked ? ` · L${o.minLevel}` : ""}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function Profile() {
  const game = useGame();
  const v = game.view!;
  const router = useRouter();
  const level = v.profile.progress.level;
  const [a, setA] = useState<Appearance>(v.profile.appearance);
  const [name, setName] = useState(v.profile.displayName);
  const [tz, setTz] = useState(v.profile.timezone);
  const save = useAction();
  const policy = useAction();
  const focus = useAction();
  const evidence = useAction();
  const u = unlockedAt(level);
  const equipped = v.inventory.filter((i) => i.equipped).map((i) => i.itemId);
  const standalone = useBrowserValue(
    () => matchMedia("(display-mode: standalone)").matches || Boolean((navigator as unknown as { standalone?: boolean }).standalone),
    true,
  );
  const dirty = JSON.stringify(a) !== JSON.stringify(v.profile.appearance) || name !== v.profile.displayName || tz !== v.profile.timezone;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[2.25rem] leading-none">Profile</h1>
      <div className="flex gap-2 text-sm">
        <Link href={`${APP_BASE_PATH}/collection`} className="chip min-h-10 px-3">Collection</Link>
        <Link href={`${APP_BASE_PATH}/rewards`} className="chip min-h-10 px-3">Rewards</Link>
        <Link href={`${APP_BASE_PATH}/progress`} className="chip min-h-10 px-3">Progress</Link>
      </div>

      <section className="rule flex flex-col gap-4 py-4" aria-labelledby="look">
        <h2 id="look" className="font-display text-xl">Appearance</h2>
        <div className="grid place-items-center py-2">
          <Character appearance={a} equipped={equipped} level={level} energy={v.profile.energy} className="h-52 w-44" />
        </div>
        <Swatches label="Skin tone" values={SKIN_TONES} value={a.skin} onPick={(skin) => setA({ ...a, skin })} />
        <Options label="Hair" options={HAIR_STYLES} value={a.hairStyle} onPick={(hairStyle) => setA({ ...a, hairStyle })} level={level} />
        <Swatches label="Hair color" values={HAIR_COLORS} value={a.hairColor} onPick={(hairColor) => setA({ ...a, hairColor })} />
        <Options label="Outfit" options={BASE_OUTFITS} value={a.baseOutfit} onPick={(baseOutfit) => setA({ ...a, baseOutfit })} level={level} />
        <Swatches label="Outfit color" values={OUTFIT_COLORS} value={a.outfitColor} onPick={(outfitColor) => setA({ ...a, outfitColor })} />
        <Swatches label="Accent" values={[...ACCENT_COLORS, "#D1AA55"]} unlocked={u.accents} value={a.accent} onPick={(accent) => setA({ ...a, accent })} />
        <Options label="Backdrop" options={BACKGROUNDS.map((b) => ({ id: b.id, label: b.label, minLevel: b.minLevel }))} value={a.background} onPick={(background) => setA({ ...a, background })} level={level} />
        <fieldset>
          <legend className="label">Flair (unlocked by level)</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FLAIR_LABELS).map(([id, label]) => {
              const on = a.flair.includes(id);
              const locked = !u.flair.includes(id);
              return (
                <button key={id} type="button" disabled={locked} aria-pressed={on} onClick={() => setA({ ...a, flair: on ? a.flair.filter((f) => f !== id) : [...a.flair, id] })} className={`chip min-h-10 px-3 ${locked ? "opacity-50" : ""}`}>
                  {locked && <Icon name="lock" className="h-3.5 w-3.5" />} {label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="p-name">Name</label>
          <input id="p-name" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="p-tz">Time zone</label>
          <input id="p-tz" className="field" value={tz} onChange={(e) => setTz(e.target.value)} />
          <p className="hint mt-1">Applies to new quests and future days. Past and already-scheduled windows keep their zone.</p>
        </div>
        {save.error && <Note tone="error">{save.error.message}</Note>}
        <button className="btn btn-primary" disabled={!dirty || save.pending} onClick={() => void save.execute({ type: "updateProfile", appearance: a, displayName: name, timezone: tz })}>
          Save changes
        </button>
      </section>

      <section className="rule flex flex-col gap-3 py-4" aria-labelledby="focus">
        <h2 id="focus" className="font-display text-xl">Ventures focus</h2>
        <p className="hint">Your strongest base stat in business battles (+2). Change it any time; it never affects quests or XP.</p>
        <div className="grid gap-2">
          {(["insight", "execution", "influence"] as const).map((f) => (
            <button key={f} aria-pressed={v.profile.focus === f} disabled={focus.pending} className={`rounded-2xl border-[1.5px] border-blood p-3 text-left transition-[background-color,color,transform] duration-300 ease-spring active:scale-[0.98] ${v.profile.focus === f ? "bg-blood text-white" : "bg-white"}`} onClick={() => void focus.execute({ type: "updateProfile", focus: f })}>
              <span className="font-extrabold">{STAT_LABEL[f]}</span>
              <span className="hint block">{STAT_BLURB[f]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rule flex flex-col gap-3 py-4" aria-labelledby="settings">
        <h2 id="settings" className="font-display text-xl">Settings</h2>
        <label className="flex min-h-11 items-center justify-between gap-3 font-bold">
          Sound effects
          <input type="checkbox" className="h-6 w-6" checked={!game.muted} onChange={(e) => { game.setMute(!e.target.checked); if (e.target.checked) game.sound("tap"); }} />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3 font-bold">
          Reduce motion
          <input type="checkbox" className="h-6 w-6" checked={game.reducedMotion} onChange={(e) => game.setReducedMotion(e.target.checked)} />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3 font-bold">
          Vitality loss after 5+ misses in a row
          <input type="checkbox" className="h-6 w-6" checked={v.profile.deteriorationEnabled} disabled={policy.pending} onChange={(e) => void policy.execute({ type: "updatePolicy", patch: { deteriorationEnabled: e.target.checked } })} />
        </label>
        <p className="hint">Policy changes apply to future misses only (policy v{v.profile.policyVersion}); past events are never rewritten. Vitality never touches XP, level, buildings, or items.</p>
      </section>

      <section className="rule flex flex-col gap-3 py-4" aria-labelledby="privacy">
        <h2 id="privacy" className="font-display text-xl">Evidence and privacy</h2>
        <p className="hint">
          Photos are stored privately and deleted after {v.retentionDays} days; the decision record (accepted/rejected, reason, time) stays. Photos are sent to the configured AI provider for checking, and its own retention policy applies to what it receives. GPS check-ins keep distance and accuracy, not your coordinates.
        </p>
        {evidence.error && <Note tone="error">{evidence.error.message}</Note>}
        <ul className="flex flex-col divide-y divide-blood">
          {v.evidence.slice(0, 10).map((e) => (
            <li key={e.attemptId} className="flex items-center justify-between gap-2 py-2 text-[0.9375rem]">
              <span className="min-w-0">
                <span className="block truncate font-bold">{e.title}</span>
                <span className="hint">{formatDay(e.submittedAt)} · {e.status}</span>
              </span>
              {!e.stored ? (
                <span className="text-sm text-blood">{e.deleted ? "Photo deleted" : "No photo stored"}</span>
              ) : (
                <span className="flex gap-1">
                  {game.mode === "live" && <a className="btn btn-ghost min-h-10 px-2 text-sm" href={`${APP_BASE_PATH}/api/evidence/${e.attemptId}`} target="_blank" rel="noreferrer">View</a>}
                  <button className="btn btn-secondary min-h-10 px-3 text-sm" disabled={evidence.pending} onClick={() => void evidence.execute({ type: "deleteEvidence", attemptId: e.attemptId })}>Delete</button>
                </span>
              )}
            </li>
          ))}
          {v.evidence.length === 0 && <li className="hint py-2">No photo evidence yet.</li>}
        </ul>
      </section>

      {!standalone && (
        <section className="rule flex flex-col gap-2 py-4" aria-labelledby="install">
          <h2 id="install" className="font-display text-xl">Install on iPhone</h2>
          <ol className="list-decimal pl-5 text-[0.9375rem]">
            <li>Open this page in Safari (HTTPS).</li>
            <li>Tap Share, then “Add to Home Screen”.</li>
            <li>Open {APP_NAME} from the Home Screen and sign in there with an emailed code (the installed app keeps its own sign-in).</li>
          </ol>
          <p className="hint">Camera and location prompts appear on first use. Offline, you can view your last-synced day; check-ins need a connection.</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        {game.mode === "demo" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-secondary" onClick={() => void game.advanceDemo(24)}>Demo: skip a day</button>
              <button className="btn btn-secondary" onClick={() => void game.resetDemo()}>Reset demo</button>
            </div>
            <button className="btn btn-ghost" onClick={() => { game.exitDemo(); router.push(`${APP_BASE_PATH}/sign-in`); }}>Exit demo</button>
          </>
        ) : (
          <button className="btn btn-secondary" onClick={() => void game.signOut().then(() => router.push(`${APP_BASE_PATH}/sign-in`))}>Sign out</button>
        )}
        <Link href="/" className="btn btn-ghost">Back to jackeliason.com</Link>
      </section>
    </div>
  );
}
