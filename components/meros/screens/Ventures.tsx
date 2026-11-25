"use client";

import { useState } from "react";
import { BATTLE_REWARDS } from "@/lib/meros/config";
import { CATEGORY_LABEL, SCENARIOS_BY_ID, TUTORIAL_SCENARIO_ID } from "@/lib/meros/content/battles";
import { TAG_LABEL } from "@/lib/meros/domain/battle";
import { STAT_LABEL } from "@/lib/meros/domain/stats";
import type { BattleView } from "@/lib/meros/service/view";
import { useAction, useGame } from "../GameProvider";
import { Count, Letters } from "../motion";
import { Icon, Note, ProgressBar } from "../ui";

export default function Ventures() {
  const game = useGame();
  const v = game.view!;
  const [finished, setFinished] = useState<BattleView | null>(null);
  const active = v.ventures.active;

  if (finished) return <Battle battle={finished} onFinished={setFinished} onBack={() => setFinished(null)} />;
  if (active) return <Battle battle={active} onFinished={setFinished} onBack={() => undefined} />;
  return <VentureList />;
}

function Initial({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full border-[1.5px] border-blood font-display ${large ? "h-14 w-14 text-2xl" : "h-11 w-11 text-xl"}`} aria-hidden="true">
      {name[0]}
    </span>
  );
}

function VentureList() {
  const game = useGame();
  const v = game.view!;
  const start = useAction<{ battleId: string }>();
  const [practice, setPractice] = useState(false);
  const outcomeLabel = { victory: "Victory", partial: "Partial", defeat: "Short" } as Record<string, string>;
  const locked = !practice && v.ventures.tickets === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-[2.25rem] leading-none">Ventures</h1>
        <p className="font-display text-xl">
          <Icon name="ticket" className="mr-1 inline h-5 w-5 align-[-0.15em]" />
          <Count value={v.ventures.tickets} />/{v.ventures.maxStored} tickets
        </p>
      </div>
      <section className="flex flex-col gap-3" aria-label="Tickets">
        <div role="radiogroup" aria-label="Venture mode" className="relative grid grid-cols-2 rounded-full border-[1.5px] border-blood p-1">
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-blood transition-transform duration-300 ease-spring"
            style={{ transform: practice ? "translateX(100%)" : undefined }}
          />
          {(
            [
              [false, "Rewarded"],
              [true, "Practice"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={label}
              role="radio"
              aria-checked={practice === mode}
              className={`relative min-h-10 rounded-full font-display text-base tracking-wide uppercase transition-colors duration-200 ${practice === mode ? "text-white" : ""}`}
              onClick={() => setPractice(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        <p key={String(practice)} className="hint m-rise">
          {practice
            ? "No ticket, no rewards. The Harbor Lease includes a tutorial."
            : locked
              ? "No tickets yet. Verify a quest’s minimum to earn one, or play Practice."
              : `One ticket per verified minimum (${v.ventures.earnedToday}/${v.ventures.maxPerDay} today). Pays ${BATTLE_REWARDS.completion} credits, +${BATTLE_REWARDS.victoryBonus} for a victory. Never XP.`}
        </p>
      </section>
      {start.error && <Note tone="error">{start.error.message}</Note>}
      <ul className="m-list flex flex-col">
        {v.ventures.scenarios.map((s, i) => {
          const scenario = SCENARIOS_BY_ID.get(s.id)!;
          const disabled = start.pending || locked;
          return (
            <li key={s.id} className="rule flex items-center gap-3 py-4">
              <Initial name={scenario.opponent.name} />
              <div className="min-w-0 flex-1">
                <p className="eyebrow">{s.category}</p>
                <p className="font-display text-lg leading-tight">{s.title}</p>
                <p className="hint truncate">{s.objective}</p>
              </div>
              <button
                className={`btn min-h-11 shrink-0 px-4 ${i === 0 ? "btn-primary" : "btn-secondary"}`}
                disabled={disabled}
                aria-label={`${practice ? "Practice" : "Start"} ${s.title}`}
                onClick={() => void start.execute({ type: "startBattle", scenarioId: s.id, mode: practice ? "practice" : "rewarded" })}
              >
                {practice ? "Practice" : "Play"}
              </button>
            </li>
          );
        })}
      </ul>
      {v.ventures.recent.length > 0 && (
        <section>
          <h2 className="eyebrow">Recent</h2>
          <ul className="mt-2 flex flex-col">
            {v.ventures.recent.map((r) => (
              <li key={r.id} className="rule flex items-center justify-between py-2 text-[0.9375rem]">
                <span className="font-normal">{SCENARIOS_BY_ID.get(r.scenarioId)?.title}</span>
                <span className="font-bold">
                  {r.outcome ? outcomeLabel[r.outcome] : "Forfeited"}
                  {r.mode === "practice" ? " · practice" : r.rewardCredits ? ` · +${r.rewardCredits}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Battle({ battle, onFinished, onBack }: { battle: BattleView; onFinished: (b: BattleView) => void; onBack: () => void }) {
  const game = useGame();
  const choose = useAction<{ battle: BattleView }>();
  const forfeit = useAction();
  const scenario = SCENARIOS_BY_ID.get(battle.scenarioId)!;
  const round = scenario.rounds[Math.min(battle.round, 3) - 1];
  const last = battle.turns.at(-1);
  const done = battle.status !== "active";
  const tutorial = battle.mode === "practice" && battle.scenarioId === TUTORIAL_SCENARIO_ID;
  const score = battle.meter + battle.capital;
  const victory = battle.outcome === "victory";

  async function pick(choiceId: string) {
    const res = await choose.execute({ type: "chooseBattle", battleId: battle.id, round: battle.round, choiceId });
    if (res?.battle.status === "finished") {
      onFinished(res.battle);
      game.sound(res.battle.outcome === "victory" ? "victory" : "soft");
    } else if (res) game.sound("tap");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Initial name={scenario.opponent.name} large />
        <div className="min-w-0">
          <p className="eyebrow">
            {CATEGORY_LABEL[scenario.category]} · {battle.mode === "practice" ? "Practice" : "Rewarded"}
          </p>
          <h1 className="font-display text-[1.75rem] leading-none">{scenario.title}</h1>
          <p className="hint mt-1">
            vs. {scenario.opponent.name}, {scenario.opponent.role}
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-2" aria-label="Scoreboard">
        <div className="flex items-end justify-between">
          <p className="font-display leading-none">
            <span className="text-[3rem]">
              <Count value={score} />
            </span>
            <span className="text-xl"> / {battle.target}</span>
          </p>
          <p className="text-right text-sm font-bold">
            <span className="block">Round {Math.min(battle.round, 3)}/3</span>
            <span className="block">
              <Count value={battle.capital} /> Capital
            </span>
          </p>
        </div>
        <ProgressBar value={score} max={battle.target} label={`${scenario.meterLabel} toward goal`} />
        <p className="hint">
          {scenario.meterLabel} {battle.meter} + {battle.capital} Capital. {scenario.objective}
          {battle.targetBonus ? ` Goal includes +${battle.targetBonus} for your strength.` : ""}
          {battle.loadout.vitalityModifier < 1 ? ` Vitality ×${battle.loadout.vitalityModifier.toFixed(2)}.` : ""}
        </p>
        <details className="group">
          <summary className="min-h-10 cursor-pointer content-center text-sm font-extrabold">Conditions</summary>
          <ul className="hint m-rise list-disc pl-5">
            {scenario.conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
            <li>Unspent Capital counts toward your final score.</li>
          </ul>
        </details>
      </section>

      {last && (
        <section key={last.round} className="m-rise border-l-2 border-blood pl-3" aria-live="polite">
          <p className="font-display text-lg">
            Round {last.round}: net {last.delta >= 0 ? "+" : ""}
            {last.delta}
          </p>
          {last.lines.map((l, i) => (
            <p key={i} className="text-[0.9375rem] font-normal">
              {l}
            </p>
          ))}
        </section>
      )}

      {!done && (
        <section key={battle.round} className="flex flex-col gap-4" aria-label={`Round ${battle.round}`}>
          <div className="m-rise flex flex-col gap-2">
            <h2 className="font-display text-2xl leading-tight">{round.title}</h2>
            <p className="text-[0.9375rem] font-normal">{round.situation}</p>
            <p className="text-[0.9375rem]">
              <strong>Signal:</strong> <span className="font-normal">{round.signal}</span>
            </p>
            {battle.revealedIntent ? (
              <p className="text-[0.9375rem]">
                <strong>Scouted:</strong>{" "}
                <span className="font-normal">
                  {battle.revealedIntent.label}. {battle.revealedIntent.detail} Countered by {battle.revealedIntent.weakTo.map((t) => TAG_LABEL[t as keyof typeof TAG_LABEL]).join(" or ")}.
                </span>
              </p>
            ) : (
              <p className="hint">Their move is hidden. Research reveals the next one.</p>
            )}
            {battle.weaknessKnown && (
              <p className="text-[0.9375rem]">
                <strong>Weakness:</strong> <span className="font-normal">{scenario.weakness}</span>
              </p>
            )}
            {tutorial && (
              <Note tone="info">
                Each option shows what you can count on (base + your stat + estate bonus). Counter their move for +{scenario.counterBonus} and half their pressure. Research costs a little now but reveals the next move.
              </Note>
            )}
          </div>
          {choose.error && <Note tone="error">{choose.error.message}</Note>}
          <ul className="m-list flex flex-col gap-2">
            {battle.choices.map((c) => {
              const disabled = !c.affordable || c.locked || choose.pending;
              const flags = [
                c.defense ? `Blocks ${c.defense}` : null,
                c.reveals ? "Reveals next move" : null,
                c.exploits ? (c.locked ? "Needs research" : "Uses weakness") : null,
                c.yield ? `Returns ${c.yield}` : null,
                !c.affordable ? "Not enough Capital" : null,
              ].filter(Boolean);
              return (
                <li key={c.id}>
                  <button className="card flex w-full flex-col items-start gap-1 p-4 text-left disabled:opacity-40" disabled={disabled} onClick={() => void pick(c.id)}>
                    <span className="flex w-full items-baseline justify-between gap-2">
                      <span className="font-display text-lg leading-tight">{c.label}</span>
                      <span className="shrink-0 font-display text-lg">≈ +{c.estimate}</span>
                    </span>
                    <span className="text-[0.9375rem] font-normal">{c.detail}</span>
                    <span className="text-[0.8125rem] font-bold">
                      {c.cost === 0 ? "Free" : `${c.cost} Capital`} · {TAG_LABEL[c.tag]} · {STAT_LABEL[c.stat]} {battle.loadout.stats[c.stat as keyof typeof battle.loadout.stats]}
                    </span>
                    {flags.length > 0 && (
                      <span className="flex flex-wrap gap-1.5">
                        {flags.map((f) => (
                          <span key={f} className="chip">
                            {f}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <button className="btn btn-ghost w-full" disabled={forfeit.pending} onClick={() => void forfeit.execute({ type: "forfeitBattle", battleId: battle.id })}>
            Forfeit{battle.mode === "rewarded" ? " (ticket is not returned)" : ""}
          </button>
        </section>
      )}

      {done && battle.summary && (
        <section className={`m-pop relative flex flex-col gap-3 overflow-hidden rounded-2xl p-6 ${victory ? "bg-blood text-white" : "border-[1.5px] border-blood"}`} aria-label="Summary">
          {victory && <span aria-hidden="true" className="m-ring pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full border-2 border-white" />}
          <p className={`font-display text-[4.25rem] leading-[0.85] ${battle.outcome === "partial" ? "outline-type" : ""}`}>
            <Letters text={victory ? "Victory" : battle.outcome === "partial" ? "Partial" : "Defeat"} />
          </p>
          <p className="m-rise [animation-delay:200ms]">{battle.summary.headline}</p>
          <ul className="m-list flex flex-col gap-1.5">
            {battle.summary.notes.map((n, i) => (
              <li key={i} className="text-[0.9375rem] font-normal">
                {n}
              </li>
            ))}
          </ul>
          <p className="font-display text-2xl">
            {battle.mode === "rewarded" ? (
              <>
                +<Count value={battle.rewardCredits} /> Estate Credits
              </>
            ) : (
              "Practice: no rewards"
            )}
          </p>
          <button className={`btn w-full ${victory ? "bg-white text-blood" : "btn-primary"}`} data-magnetic onClick={onBack}>
            Back to Ventures
          </button>
        </section>
      )}
    </div>
  );
}
