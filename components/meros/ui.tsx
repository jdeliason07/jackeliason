"use client";

import { type CSSProperties, type ReactNode, useEffect, useId, useRef } from "react";

/** Small inline icon set (original, stroke-based). Always paired with a text label in the UI. */
const PATHS: Record<string, ReactNode> = {
  today: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  estate: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  ventures: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>,
  quests: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  chest: <><rect x="3" y="10" width="18" height="10" rx="2" /><path d="M3 10a9 5 0 0 1 18 0M12 13v3" /></>,
  ticket: <><path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3z" transform="translate(0 2)" /><path d="M14 6v12" strokeDasharray="2 2" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  coin: <><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" /></>,
  star: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  flip: <><path d="M4 9a8 8 0 0 1 14-3l2 2" /><path d="M20 4v4h-4M20 15a8 8 0 0 1-14 3l-2-2" /><path d="M4 20v-4h4" /></>,
  bolt: <path d="M13 3L5 13h6l-1 8 8-10h-6z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  sound: <><path d="M5 10h3l4-4v12l-4-4H5z" /><path d="M16 9a4 4 0 0 1 0 6" /></>,
  mute: <><path d="M5 10h3l4-4v12l-4-4H5z" /><path d="M16 10l4 4M20 10l-4 4" /></>,
  gift: <><rect x="3" y="9" width="18" height="11" rx="2" /><path d="M12 9v11M3 13h18M12 9s-4-6-6-3 6 3 6 3 4-6 6-3-6 3-6 3" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  wifi: <><path d="M3 9a14 14 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0" /><circle cx="12" cy="19" r="1" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  dumbbell: <><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" transform="translate(0 -2)" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M3 12h18" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>,
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>,
  broom: <><path d="M14 4l-4 9M7 13h8l2 7H5z" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.2a5 5 0 0 1 5.5 5.8" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>,
  flask: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" /><path d="M7.5 15h9" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></>,
};

/** Category → icon, for chips and task rows. */
export const CATEGORY_ICON: Record<string, string> = {
  fitness: "dumbbell",
  learning: "book",
  business: "briefcase",
  faith: "sun",
  household: "broom",
  relationships: "people",
};

export function Icon({ name, className = "h-5 w-5", strokeWidth = 2.2 }: { name: keyof typeof PATHS | string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}

/** A hairline track with a solid fill that grows on the compositor; it animates in on mount and on every change. */
export function ProgressBar({ value, max, label, className = "" }: { value: number; max: number; label: string; className?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 1;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={`m-bar w-full ${className}`}>
      <div className="m-bar-fill" style={{ "--p": p } as CSSProperties} />
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-sm font-bold">{label}</span>
    </span>
  );
}

/** A quiet message: icon, text, a red rule on the left. Tone changes only the icon and the role. */
export function Note({ tone = "info", children, action }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode; action?: ReactNode }) {
  const icon = { info: "info", warn: "info", error: "x", ok: "check" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`m-rise flex items-start gap-3 border-l-2 border-blood py-1 pl-3 text-[0.9375rem] ${tone === "error" ? "font-bold" : ""}`}>
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</div>
      {action}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-display text-2xl">{title}</p>
      {children && <div className="hint mx-auto mt-2 max-w-xs">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Bottom sheet dialog. Esc and the backdrop close it; focus moves in and returns on close. Springs up from the bottom. */
export function Sheet({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" className="m-fade absolute inset-0 bg-white/85 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`m-sheet relative max-h-[92dvh] w-full ${wide ? "sm:max-w-xl" : "sm:max-w-md"} overflow-y-auto rounded-t-[1.75rem] border-t border-blood bg-white px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] outline-none sm:rounded-[1.75rem] sm:border`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-blood sm:hidden" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-2xl">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="btn btn-ghost -mr-2 h-11 min-h-0 w-11 px-0" aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const RARITY_LABEL: Record<string, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", legendary: "Legendary" };
const RARITY_STARS: Record<string, number> = { common: 1, uncommon: 2, rare: 3, legendary: 4 };

/** Rarity reads by its name and its star count, never by color. */
export function RarityChip({ rarity }: { rarity: string }) {
  const n = RARITY_STARS[rarity] ?? 1;
  return (
    <span className="chip">
      <span className="flex" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <Icon key={i} name="star" className="-mx-px h-3 w-3" />
        ))}
      </span>
      {RARITY_LABEL[rarity] ?? RARITY_LABEL.common}
    </span>
  );
}

export function formatTime(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone });
}

export function formatDay(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", timeZone });
}

export function money(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** A label with a ring that keeps pulsing outward: "you can tap this". */
export function Hotspot({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span className={`pointer-events-none absolute flex flex-col items-center ${className}`}>
      <span className="relative grid place-items-center">
        <span aria-hidden="true" className="m-pulse-ring absolute h-8 w-8 rounded-full border-2 border-white" />
        <span className="chip chip-solid relative border-white whitespace-nowrap">{label}</span>
      </span>
    </span>
  );
}
