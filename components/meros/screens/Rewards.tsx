"use client";

import { useState } from "react";
import { APP_NAME } from "@/lib/meros/config";
import type { GameView } from "@/lib/meros/service/view";
import { useAction, useGame } from "../GameProvider";
import { Empty, Icon, money, Note, Sheet } from "../ui";

type Reward = GameView["rewards"]["list"][number];
const KIND_LABEL = { money: "Money allocation", gift_card: "Gift card", experience: "Experience", other: "Other" } as Record<string, string>;

export default function Rewards() {
  const game = useGame();
  const v = game.view!;
  const [editing, setEditing] = useState<Reward | "new" | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const claim = useAction<{ budgeted: boolean }>();
  const b = v.rewards.budget;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Real-world rewards</h1>
        <button className="btn btn-primary min-h-11" onClick={() => setEditing("new")}>
          <Icon name="plus" /> Add
        </button>
      </div>
      <Note tone="info">
        Rewards you fund yourself, unlocked by real progress. {APP_NAME} records entitlements and claims only; it never moves money, buys gift cards, or touches a bank.
      </Note>
      <section className="card flex items-center justify-between gap-3 p-4">
        <div>
          <p className="font-extrabold">Monthly budget ({b.month})</p>
          <p className="hint">
            {b.capCents === null ? "Not set: money rewards are recorded as unbudgeted." : `${money(b.remainingCents)} of ${money(b.capCents)} left this month (${money(b.usedCents)} claimed).`}
          </p>
        </div>
        <button className="btn btn-secondary min-h-11 shrink-0" onClick={() => setBudgetOpen(true)}>
          {b.capCents === null ? "Set" : "Change"}
        </button>
      </section>
      {claim.error && <Note tone="error">{claim.error.message}</Note>}
      {v.rewards.list.length === 0 && <Empty title="No rewards yet">Add a few for meaningful milestones, like Level 5 or 100 minimums. Several per milestone is fine.</Empty>}
      <ul className="flex flex-col gap-3">
        {v.rewards.list.map((r) => {
          const milestone = [r.targetLevel ? `Level ${r.targetLevel}` : null, r.targetMinimums ? `${r.targetMinimums} minimums` : null].filter(Boolean).join(" or ");
          return (
            <li key={r.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-extrabold text-muted">{KIND_LABEL[r.kind]}{r.amountCents ? ` · ${money(r.amountCents)}` : ""}</p>
                  <p className="font-display text-lg leading-tight font-semibold">{r.title}</p>
                  {r.description && <p className="hint">{r.description}</p>}
                </div>
                <span className={`chip shrink-0 ${r.claimedAt ? "bg-success-soft text-success" : r.unlockedAt ? "bg-blood-soft" : "bg-raised text-muted"}`}>
                  {r.claimedAt ? "Claimed" : r.unlockedAt ? "Unlocked" : <><Icon name="lock" className="h-3.5 w-3.5" /> {milestone}</>}
                </span>
              </div>
              {r.claimedAt && r.monetary && <p className="hint">{r.budgeted ? "Counted against that month's budget." : "Recorded as unbudgeted."}</p>}
              <div className="flex gap-2">
                {r.unlockedAt && !r.claimedAt && (
                  <button className="btn btn-go flex-1" disabled={claim.pending} onClick={() => void claim.execute({ type: "claimReward", rewardId: r.id, note: "" }).then((res) => res && game.celebrate({ kind: "victory", title: `Claimed: ${r.title}`, lines: ["Enjoy it. You earned it."] }, "victory"))}>
                    Claim
                  </button>
                )}
                {!r.claimedAt && (
                  <button className="btn btn-secondary" onClick={() => setEditing(r)}>
                    Edit
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {editing && <RewardForm reward={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {budgetOpen && <BudgetForm current={b.capCents} onClose={() => setBudgetOpen(false)} />}
    </div>
  );
}

function RewardForm({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const save = useAction();
  const archive = useAction();
  const [title, setTitle] = useState(reward?.title ?? "");
  const [kind, setKind] = useState(reward?.kind ?? "experience");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [amount, setAmount] = useState(reward?.amountCents ? String(reward.amountCents / 100) : "");
  const [level, setLevel] = useState(reward?.targetLevel ? String(reward.targetLevel) : "5");
  const [count, setCount] = useState(reward?.targetMinimums ? String(reward.targetMinimums) : "");
  const [notes, setNotes] = useState(reward?.notes ?? "");

  async function submit() {
    const cents = amount ? Math.round(Number(amount) * 100) : null;
    const res = await save.execute({
      type: "saveReward",
      reward: {
        id: reward?.id ?? null,
        title,
        kind: kind as "money" | "gift_card" | "experience" | "other",
        description,
        amountCents: cents && cents > 0 ? cents : null,
        targetLevel: level ? Number(level) : null,
        targetMinimums: count ? Number(count) : null,
        notes,
      },
    });
    if (res) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={reward ? "Edit reward" : "New reward"}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div><label className="label" htmlFor="r-title">Title</label><input id="r-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} /></div>
        <div>
          <label className="label" htmlFor="r-kind">Kind</label>
          <select id="r-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {(kind === "money" || kind === "gift_card") && (
          <div><label className="label" htmlFor="r-amt">Amount (USD)</label><input id="r-amt" className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25" /></div>
        )}
        <div><label className="label" htmlFor="r-desc">Description</label><input id="r-desc" className="field" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="r-lvl">At level</label><input id="r-lvl" className="field" inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value.replace(/\D/g, ""))} /></div>
          <div><label className="label" htmlFor="r-cnt">Or at minimums</label><input id="r-cnt" className="field" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} placeholder="100" /></div>
        </div>
        <div><label className="label" htmlFor="r-notes">Notes</label><input id="r-notes" className="field" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
        {save.error && <Note tone="error">{save.error.message}</Note>}
        <button type="submit" className="btn btn-primary" disabled={save.pending}>Save</button>
        {reward && (
          <button type="button" className="btn btn-ghost" disabled={archive.pending} onClick={async () => { if (await archive.execute({ type: "archiveReward", rewardId: reward.id })) onClose(); }}>
            Remove reward
          </button>
        )}
      </form>
    </Sheet>
  );
}

function BudgetForm({ current, onClose }: { current: number | null; onClose: () => void }) {
  const save = useAction();
  const [value, setValue] = useState(current === null ? "" : String(current / 100));
  return (
    <Sheet open onClose={onClose} title="Monthly reward budget">
      <form className="flex flex-col gap-3" onSubmit={async (e) => { e.preventDefault(); if (await save.execute({ type: "setBudget", cents: value === "" ? null : Math.round(Number(value) * 100) })) onClose(); }}>
        <p className="hint">A self-imposed cap on new money and gift-card claims each month. Changing it affects future claims, not past ones. Leave empty for no budget.</p>
        <label className="label" htmlFor="b-amt">Amount per month (USD)</label>
        <input id="b-amt" className="field" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Not set" />
        {save.error && <Note tone="error">{save.error.message}</Note>}
        <button type="submit" className="btn btn-primary" disabled={save.pending}>Save budget</button>
      </form>
    </Sheet>
  );
}
