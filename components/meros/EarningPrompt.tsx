"use client";

import { useState } from "react";
import { useAction, useGame } from "./GameProvider";
import { Icon, money } from "./ui";

/** Dollars typed by a person ("1,250.50", "$80") → integer cents, or null if it isn't a number. */
export function parseDollars(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, "");
  if (!clean) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/**
 * After a money-making task: what did it actually bring in? Prefilled with last time's amount.
 * The number is real money, logged by you, never game currency, so the character's wealth on Home
 * only moves when your real income does.
 */
export default function EarningPrompt({
  occurrenceId,
  org,
  suggestedCents,
  loggedCents,
  hero = false,
  onDone,
}: {
  occurrenceId: string;
  org: string;
  suggestedCents: number | null;
  loggedCents: number | null;
  hero?: boolean;
  onDone?: () => void;
}) {
  const game = useGame();
  const action = useAction<{ amountCents: number; org: string }>();
  const [text, setText] = useState(() => {
    const c = loggedCents ?? suggestedCents;
    return c ? String(c / 100) : "";
  });
  const [editing, setEditing] = useState(loggedCents === null);
  const cents = parseDollars(text);

  async function save(amount: number) {
    const r = await action.execute({ type: "logEarning", earning: { occurrenceId, org, amountCents: amount, note: "" } });
    if (!r) return;
    setEditing(false);
    if (amount > 0) game.celebrate({ kind: "money", title: `+${money(amount)}`, lines: [r.org || "Earned"] }, "chest");
    onDone?.();
  }

  if (!editing) {
    return (
      <button type="button" className="chip chip-solid self-start" onClick={() => setEditing(true)} aria-label={`Earned ${money(loggedCents ?? 0)}. Change`}>
        <Icon name="coin" className="h-4 w-4" /> {loggedCents ? `+${money(loggedCents)}` : "$0"}
        {org ? ` · ${org}` : ""}
      </button>
    );
  }

  return (
    <form
      className="m-rise flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (cents !== null) void save(cents);
      }}
    >
      <label className="flex items-center gap-2 font-display text-lg" htmlFor={`earn-${occurrenceId}`}>
        <Icon name="coin" /> Earned{org ? ` for ${org}` : ""}?
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span aria-hidden="true" className="absolute top-1/2 left-3 -translate-y-1/2 font-display text-xl">$</span>
          <input
            id={`earn-${occurrenceId}`}
            className="field pl-7 font-display text-xl"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <button type="submit" className={`btn ${hero ? "btn-hero" : "btn-primary"} shrink-0`} disabled={cents === null || action.pending}>
          Log
        </button>
      </div>
      <button type="button" className="btn btn-ghost min-h-9 self-start px-1 text-sm" disabled={action.pending} onClick={() => void save(0)}>
        Nothing this time
      </button>
      {action.error && <p className="text-sm font-bold">{action.error.message}</p>}
    </form>
  );
}
