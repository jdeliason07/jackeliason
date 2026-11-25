"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_BASE_PATH } from "@/lib/earned/config";
import { AREAS, AREAS_BY_ID, type AreaId } from "@/lib/earned/content/estate";
import EstateScene from "../art/EstateScene";
import { useAction, useGame } from "../GameProvider";
import { Icon, Note, Sheet } from "../ui";

export default function Estate() {
  const game = useGame();
  const v = game.view!;
  const [selected, setSelected] = useState<AreaId | null>(null);
  const totalTiers = Object.values(v.estate.tiers).reduce((s, t) => s + t, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-semibold">Your estate</h1>
        <span className="text-sm font-bold text-muted">{totalTiers}/18 upgrades</span>
      </div>
      <div className="card overflow-hidden p-0">
        <EstateScene
          tiers={v.estate.tiers}
          level={v.profile.progress.level}
          decorations={v.estate.placedDecorations}
          onSelect={setSelected}
          selected={selected}
          className="block h-auto w-full"
        />
      </div>
      <p className="hint">
        Built with Estate Credits from chests, momentum, and Ventures. Levels (from real-world quests only) unlock higher tiers. Buildings never grant XP.
      </p>
      <ul className="grid grid-cols-2 gap-3">
        {AREAS.map((a) => {
          const info = v.estate.areas.find((x) => x.id === a.id)!;
          const name = info.tier === 0 ? a.baseName : a.tiers[info.tier - 1].name;
          return (
            <li key={a.id}>
              <button className="card flex h-full w-full flex-col items-start gap-1 p-3 text-left" onClick={() => setSelected(a.id)}>
                <span className="text-sm font-extrabold text-muted">{a.name}</span>
                <span className="font-display text-base leading-tight font-semibold">{name}</span>
                <span className="flex gap-1" aria-label={`Tier ${info.tier} of 3`}>
                  {[1, 2, 3].map((t) => (
                    <span key={t} className={`h-2 w-6 rounded-full ${t <= info.tier ? "bg-sun" : "bg-line"}`} />
                  ))}
                </span>
                {info.nextCost !== null && (
                  <span className={`mt-1 text-sm font-bold ${info.canUpgrade ? "text-mint-deep" : "text-muted"}`}>
                    {info.canUpgrade ? `Ready: ${info.nextCost} credits` : `Next: ${info.nextCost} credits`}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm">
        <Link href={`${APP_BASE_PATH}/collection`} className="font-extrabold text-navy underline">
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

  async function upgrade() {
    const res = await action.execute({ type: "upgradeBuilding", area });
    if (res) game.celebrate({ kind: "victory", title: `${res.name} built!`, lines: ["Your estate just grew."] }, "victory");
  }

  return (
    <Sheet open onClose={onClose} title={def.name}>
      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-3xl bg-cloud">
          <EstateScene
            tiers={v.estate.tiers}
            level={v.profile.progress.level}
            decorations={v.estate.placedDecorations}
            preview={preview && next ? { area, tier: next.tier } : null}
            className="block h-auto w-full"
          />
        </div>
        <p className="text-ink-soft">{def.purpose}</p>
        <ol className="flex flex-col gap-2">
          {def.tiers.map((t) => {
            const owned = t.tier <= info.tier;
            return (
              <li key={t.tier} className={`rounded-2xl border-2 p-3 ${owned ? "border-mint/50 bg-mint-soft" : t.tier === info.tier + 1 ? "border-sun bg-white" : "border-line bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-extrabold">
                    Tier {t.tier}: {t.name}
                  </p>
                  {owned ? <span className="chip bg-white text-mint-deep"><Icon name="check" className="h-4 w-4" /> Owned</span> : <span className="chip bg-sun-soft">{t.cost} credits</span>}
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
          <Note tone="ok">Fully built. Beautiful work.</Note>
        )}
      </div>
    </Sheet>
  );
}
