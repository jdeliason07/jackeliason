"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { AREAS, AREAS_BY_ID, type AreaId } from "@/lib/meros/content/estate";
import Image from "next/image";
import { areaSrc, estateLoopSrc, estateSrc, onPhotoError } from "@/lib/meros/content/art";
import ItemArt from "../art/ItemArt";
import { useAction, useGame } from "../GameProvider";
import { Count, prefersReducedMotion, Sparks } from "../motion";
import { Hotspot, Icon, Note, Sheet } from "../ui";

/**
 * Where each area sits in the aerial photographs, in percent of the frame. Every stage is an edit of
 * the first, so the buildings stay put (scripts/meros/generate-art.mts).
 */
const HOTSPOTS: Record<AreaId, { x: number; y: number }> = {
  residence: { x: 50, y: 56 },
  gardens: { x: 50, y: 40 },
  office: { x: 26, y: 28 },
  library: { x: 74, y: 30 },
  gym: { x: 24, y: 70 },
  workshop: { x: 76, y: 70 },
};

/** The aerial still, and over it the same view as a seamless loop (skipped under reduced motion or if it can't play). */
function Aerial({ level }: { level: number }) {
  const [still, setStill] = useState(true);
  return (
    <>
      <Image src={estateSrc(level)} alt="Your city block from above" fill priority unoptimized sizes="32rem" onError={onPhotoError} className="object-cover" />
      <video
        key={estateLoopSrc(level)}
        src={estateLoopSrc(level)}
        poster={estateSrc(level)}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        aria-hidden="true"
        onCanPlay={(e) => {
          if (prefersReducedMotion()) return e.currentTarget.pause();
          setStill(false);
        }}
        onError={() => setStill(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${still ? "opacity-0" : "opacity-100"}`}
      />
    </>
  );
}

export default function Estate() {
  const game = useGame();
  const v = game.view!;
  const [selected, setSelected] = useState<AreaId | null>(null);
  const totalTiers = Object.values(v.estate.tiers).reduce((s, t) => s + t, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-[2.25rem] leading-none">Estate</h1>
        <span className="font-display text-xl" aria-label={`${totalTiers} of 18 upgrades`}>
          <Count value={totalTiers} />/18
        </span>
      </div>
      {/* The block from above: a living loop that grows with your level. Tap a building. */}
      <section aria-label="Your estate from above" className="relative isolate aspect-[9/16] max-h-[calc(100dvh-13rem)] w-full overflow-hidden rounded-2xl">
        <Aerial level={v.profile.progress.level} />
        {AREAS.map((a) => {
          const info = v.estate.areas.find((x) => x.id === a.id)!;
          const spot = HOTSPOTS[a.id as AreaId];
          const name = info.tier === 0 ? a.baseName : a.tiers[info.tier - 1].name;
          const label = `${a.name}${info.canUpgrade ? " · Ready" : ""}`;
          const place = { left: `${spot.x}%`, top: `${spot.y}%` };
          const cls = "group absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 ease-spring active:scale-90";
          return a.id === "residence" ? (
            <Link key={a.id} href={`${APP_BASE_PATH}/estate/home`} aria-label={`Go inside: ${name}`} className={cls} style={place}>
              <Hotspot label="Home" className="relative" />
            </Link>
          ) : (
            <button key={a.id} aria-label={`${a.name}: ${name}`} className={cls} style={place} onClick={() => setSelected(a.id as AreaId)}>
              <Hotspot label={label} className="relative" />
            </button>
          );
        })}
        {v.estate.placedDecorations.length > 0 && (
          <ul className="m-list absolute bottom-2 left-2 flex gap-1.5" aria-label="Placed decorations">
            {v.estate.placedDecorations.map((id) => (
              <li key={id}>
                <ItemArt itemId={id} className="size-10 border-[1.5px] border-white" />
              </li>
            ))}
          </ul>
        )}
      </section>
      <ul className="m-list grid grid-cols-2 gap-3">
        {AREAS.map((a) => {
          const info = v.estate.areas.find((x) => x.id === a.id)!;
          const name = info.tier === 0 ? a.baseName : a.tiers[info.tier - 1].name;
          return (
            <li key={a.id}>
              <button className="card flex h-full w-full flex-col items-start gap-1 overflow-hidden p-0 pb-3 text-left" onClick={() => setSelected(a.id)}>
                <Image src={areaSrc(a.id, info.tier)} alt="" width={640} height={480} unoptimized onError={onPhotoError} className="mb-1.5 aspect-[4/3] w-full object-cover" />
                <span className="eyebrow px-3">{a.name}</span>
                <span className="px-3 font-display text-lg leading-tight">{name}</span>
                <span className="flex gap-1 px-3" aria-label={`Tier ${info.tier} of 3`}>
                  {[1, 2, 3].map((t) => (
                    <span key={t} className={`h-2 w-6 rounded-full border border-blood transition-colors duration-300 ${t <= info.tier ? "bg-blood" : "bg-white"}`} />
                  ))}
                </span>
                {info.nextCost !== null && (
                  <span className={`mx-3 mt-1 inline-flex items-center gap-1 text-sm font-bold whitespace-nowrap ${info.canUpgrade ? "chip chip-solid" : ""}`}>
                    <Icon name="coin" className="h-3.5 w-3.5" />
                    {info.canUpgrade ? `Ready: ${info.nextCost}` : `Next: ${info.nextCost}`}
                    <span className="sr-only"> credits</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm">
        <Link href={`${APP_BASE_PATH}/collection`} className="font-extrabold underline decoration-2 underline-offset-4">
          Place decorations ({v.estate.placedDecorations.length}/{v.estate.bonuses.decorationSlots} slots)
        </Link>
      </p>
      {selected && <AreaSheet area={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AreaSheet({ area, onClose }: { area: AreaId; onClose: () => void }) {
  const game = useGame();
  const v = game.view!;
  const def = AREAS_BY_ID.get(area)!;
  const info = v.estate.areas.find((a) => a.id === area)!;
  const action = useAction<{ name: string }>();
  const next = def.tiers[info.tier];
  const [preview, setPreview] = useState(false);
  const [built, setBuilt] = useState(0);

  async function upgrade() {
    const res = await action.execute({ type: "upgradeBuilding", area });
    if (res) {
      setPreview(false);
      setBuilt((n) => n + 1);
    }
    if (res) game.celebrate({ kind: "victory", title: `${res.name} built!`, lines: ["Your estate just grew."] }, "victory");
  }

  return (
    <Sheet open onClose={onClose} title={def.name}>
      <div className="flex flex-col gap-4">
        {/* Current tier, with the next one crossfading over it while previewed. */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
          <Image
            key={areaSrc(area, info.tier)}
            src={areaSrc(area, info.tier)}
            alt={info.tier === 0 ? def.baseName : def.tiers[info.tier - 1].name}
            fill
            unoptimized
            sizes="28rem"
            onError={onPhotoError}
            className={`object-cover ${built ? "m-build" : ""}`}
          />
          {built > 0 && <Sparks key={built} count={18} distance={140} delay={500} />}
          {next && (
            <Image
              src={areaSrc(area, next.tier)}
              alt={`Preview: ${next.name}`}
              fill
              unoptimized
              sizes="28rem"
              onError={onPhotoError}
              className={`object-cover transition-[opacity,scale] duration-300 ease-out ${preview ? "scale-100 opacity-100" : "pointer-events-none scale-105 opacity-0"}`}
            />
          )}
          {preview && next && <span className="m-pop chip chip-solid absolute top-2 left-2">Preview: {next.name}</span>}
        </div>
        <p className="font-normal">{def.purpose}</p>
        <ol className="m-list flex flex-col">
          {def.tiers.map((t) => {
            const owned = t.tier <= info.tier;
            return (
              <li key={t.tier} className={`rule py-3 ${t.tier === info.tier + 1 ? "border-l-2 border-l-blood pl-3" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-extrabold">
                    Tier {t.tier}: {t.name}
                  </p>
                  {owned ? <span className="chip chip-solid"><Icon name="check" className="h-4 w-4" /> Owned</span> : <span className="chip">{t.cost} credits</span>}
                </div>
                <p className="hint">{t.preview}</p>
                <p className="hint">
                  Needs Level {t.minLevel}
                  {Object.entries(t.requires).map(([req, tier]) => ` · ${AREAS_BY_ID.get(req as AreaId)!.name} tier ${tier}`)}
                </p>
              </li>
            );
          })}
        </ol>
        {next ? (
          <>
            <button className="btn btn-secondary w-full" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
              {preview ? "Show current" : `Preview ${next.name}`}
            </button>
            {!info.canUpgrade && info.reason && <Note tone="info">{info.reason}</Note>}
            {action.error && <Note tone="error">{action.error.message}</Note>}
            <button className="btn btn-primary w-full text-lg" disabled={!info.canUpgrade || action.pending} onClick={() => void upgrade()}>
              <Icon name="coin" /> Build {next.name} · {next.cost}
            </button>
          </>
        ) : (
          <Note tone="ok">Fully built.</Note>
        )}
      </div>
    </Sheet>
  );
}
