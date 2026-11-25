"use client";

import { useState } from "react";
import { parseDollars } from "./EarningPrompt";
import { useAction, useGame } from "./GameProvider";
import { Count } from "./motion";
import { formatDay, Icon, money, Note, Sheet } from "./ui";

/**
 * Real money: what your tasks (and anything else you log) actually brought in. It never mixes with
 * Estate Credits; the game can't create it and you can't spend it here.
 */
export default function MoneySheet({ onClose }: { onClose: () => void }) {
  const game = useGame();
  const m = game.view!.money;
  const top = Math.max(1, ...m.byOrg.map((o) => o.monthCents));
  const [adding, setAdding] = useState(m.totalCents === 0);

  return (
    <Sheet open onClose={onClose} title="Money">
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">This month</p>
            <p className="font-display text-5xl leading-none">
              $<Count value={Math.round(m.monthCents / 100)} />
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">All time</p>
            <p className="font-display text-2xl leading-none">{money(m.totalCents) || "$0"}</p>
          </div>
        </div>

        {m.byOrg.length > 0 && (
          <ul className="m-list flex flex-col gap-3" aria-label="By organization">
            {m.byOrg.map((o) => (
              <li key={o.org} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between font-bold">
                  <span>{o.org}</span>
                  <span className="font-display text-lg">{money(o.monthCents) || "$0"}</span>
                </div>
                <div className="m-bar">
                  <div className="m-bar-fill" style={{ "--p": o.monthCents / top } as React.CSSProperties} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {adding ? <LogIncome orgs={m.orgs} onDone={() => setAdding(false)} /> : (
          <button className="btn btn-hero w-full" onClick={() => setAdding(true)}>
            <Icon name="plus" /> Log income
          </button>
        )}

        {m.recent.length > 0 && (
          <ul className="m-list flex flex-col" aria-label="Recent">
            {m.recent.map((e) => (
              <li key={e.id} className="rule flex items-center gap-3 py-3">
                <Icon name="coin" className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{e.title ?? (e.note || e.org || "Income")}</p>
                  <p className="hint">
                    {e.org ? `${e.org} · ` : ""}
                    {formatDay(`${e.localDate}T12:00:00Z`, "UTC")}
                  </p>
                </div>
                <span className="font-display text-lg">+{money(e.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

function LogIncome({ orgs, onDone }: { orgs: string[]; onDone: () => void }) {
  const game = useGame();
  const action = useAction<{ amountCents: number; org: string }>();
  const [org, setOrg] = useState(orgs[0] ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const cents = parseDollars(amount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cents) return;
    const r = await action.execute({ type: "logEarning", earning: { occurrenceId: null, org: org.trim(), amountCents: cents, note: note.trim() } });
    if (r) {
      game.celebrate({ kind: "money", title: `+${money(cents)}`, lines: [r.org || "Income"] }, "chest");
      onDone();
    }
  }

  return (
    <form className="m-rise flex flex-col gap-3" onSubmit={submit}>
      <div className="relative">
        <span aria-hidden="true" className="absolute top-1/2 left-3 -translate-y-1/2 font-display text-2xl">$</span>
        <input className="field pl-8 font-display text-2xl" inputMode="decimal" placeholder="0" aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </div>
      {orgs.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="For">
          {orgs.map((o) => (
            <button type="button" key={o} className="chip min-h-10 px-3" aria-pressed={org === o} onClick={() => setOrg(o)}>
              {o}
            </button>
          ))}
        </div>
      )}
      <input className="field" placeholder="For (Korvo, a client…)" aria-label="For" maxLength={40} value={org} onChange={(e) => setOrg(e.target.value)} />
      <input className="field" placeholder="Note (optional)" aria-label="Note" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
      {action.error && <Note tone="error">{action.error.message}</Note>}
      <button type="submit" className="btn btn-hero w-full" disabled={!cents || action.pending}>
        <Icon name="coin" /> Add {cents ? money(cents) : ""}
      </button>
    </form>
  );
}
