import type { AreaId } from "@/lib/meros/content/estate";
import { PLACE_CATEGORIES, PLACE_OF } from "@/lib/meros/content/places";
import type { DueView, GameView } from "@/lib/meros/service/view";

/** Today's list as the owner sees it: drops lapsed days and yesterday's excused ones. */
export function visibleDue(v: GameView): DueView[] {
  return v.today.due.filter((d) => !(d.status === "lapsed" || (d.status === "excused" && d.phase === "closed" && d.localDate !== v.today.localDate)));
}

export function isRemaining(d: DueView) {
  return d.status === "open" && d.phase !== "closed";
}

export interface PlaceStatus {
  due: DueView[];
  /** Still to do today (open now or later). This is the number on the bubble. */
  remaining: number;
  /** Open right now: the bubble turns solid. */
  openNow: number;
  /** When the soonest open window closes (to pick the place to point at first). */
  closesFirst: number | null;
}

export function placeStatus(v: GameView, area: AreaId): PlaceStatus {
  const cats = PLACE_CATEGORIES[area];
  const due = visibleDue(v).filter((d) => cats.includes(d.category));
  const remaining = due.filter(isRemaining);
  const open = remaining.filter((d) => d.phase === "open");
  return {
    due,
    remaining: remaining.length,
    openNow: open.length,
    closesFirst: open.length ? Math.min(...open.map((d) => Date.parse(d.closesAt))) : null,
  };
}

/** The place whose open task closes soonest: the one the Home screen points at. */
export function focalPlace(v: GameView, areas: AreaId[]): AreaId | null {
  let best: { area: AreaId; t: number } | null = null;
  for (const a of areas) {
    const s = placeStatus(v, a);
    if (s.closesFirst !== null && (!best || s.closesFirst < best.t)) best = { area: a, t: s.closesFirst };
  }
  return best?.area ?? null;
}

export { PLACE_OF };
