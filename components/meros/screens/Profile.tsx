"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBrowserValue } from "../useBrowserValue";
import { APP_BASE_PATH, APP_NAME } from "@/lib/meros/config";
import { STAT_BLURB, STAT_LABEL } from "@/lib/meros/domain/stats";
import Character from "../art/Character";
import { useAction, useGame } from "../GameProvider";
import { formatDay, Icon, Note } from "../ui";

export default function Profile() {
  const game = useGame();
  const v = game.view!;
  const router = useRouter();
  const level = v.profile.progress.level;
  const [name, setName] = useState(v.profile.displayName);
  const [tz, setTz] = useState(v.profile.timezone);
  const save = useAction();
  const policy = useAction();
  const focus = useAction();
  const evidence = useAction();
  const equipped = v.inventory.filter((i) => i.equipped).map((i) => i.itemId);
  const standalone = useBrowserValue(
    () => matchMedia("(display-mode: standalone)").matches || Boolean((navigator as unknown as { standalone?: boolean }).standalone),
    true,
  );
  const dirty = name !== v.profile.displayName || tz !== v.profile.timezone;

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
        <Link href={`${APP_BASE_PATH}/dress`} className="card group flex items-center gap-4 overflow-hidden p-0 pr-4">
          <Character appearance={v.profile.appearance} equipped={equipped} level={level} energy={v.profile.energy} animate className="h-36 w-27 shrink-0 !rounded-none" />
          <span className="flex-1">
            <span className="block font-display text-xl leading-tight">Dressing room</span>
          </span>
          <Icon name="chevron" className="h-5 w-5 transition-transform duration-300 ease-spring group-hover:translate-x-1" />
        </Link>
        <div>
          <label className="label" htmlFor="p-name">Name</label>
          <input id="p-name" className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="p-tz">Time zone</label>
          <input id="p-tz" className="field" value={tz} onChange={(e) => setTz(e.target.value)} />
        </div>
        {save.error && <Note tone="error">{save.error.message}</Note>}
        <button className={`btn ${dirty ? "btn-hero" : "btn-secondary"}`} disabled={!dirty || save.pending} onClick={() => void save.execute({ type: "updateProfile", displayName: name, timezone: tz })}>
          Save changes
        </button>
      </section>

      <section className="rule flex flex-col gap-3 py-4" aria-labelledby="focus">
        <h2 id="focus" className="font-display text-xl">Ventures focus</h2>
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
      </section>

      <section className="rule flex flex-col gap-3 py-4" aria-labelledby="privacy">
        <h2 id="privacy" className="font-display text-xl">Evidence and privacy</h2>
        <p className="hint inline-flex items-center gap-1.5">
          <Icon name="lock" className="h-4 w-4 shrink-0" /> Photos deleted after {v.retentionDays} days · location check-ins keep distance only
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
            <li>Safari → Share → Add to Home Screen</li>
            <li>Open {APP_NAME} from there and sign in again</li>
          </ol>
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
