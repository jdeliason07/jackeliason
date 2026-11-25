import type { AreaId } from "./estate";
import type { QuestCategory } from "./templates";

/**
 * Every task lives in one building on the Home map: fitness in the gym, work in the office,
 * learning in the library, faith and chores at the house, people on the rooftop. The workshop
 * holds no tasks (it's a game upgrade only).
 */
export const PLACE_OF: Record<QuestCategory, AreaId> = {
  fitness: "gym",
  business: "office",
  learning: "library",
  faith: "residence",
  household: "residence",
  relationships: "gardens",
};

export const PLACE_CATEGORIES: Record<AreaId, QuestCategory[]> = {
  gym: ["fitness"],
  office: ["business"],
  library: ["learning"],
  residence: ["faith", "household"],
  gardens: ["relationships"],
  workshop: [],
};

/** Short names shown on the map and in the task builder. */
export const PLACE_LABEL: Record<AreaId, string> = {
  residence: "House",
  office: "Office",
  library: "Library",
  gym: "Gym",
  workshop: "Workshop",
  gardens: "Rooftop",
};

export const CATEGORY_SHORT: Record<QuestCategory, string> = {
  fitness: "Fitness",
  business: "Work",
  learning: "Learning",
  faith: "Faith",
  household: "Chores",
  relationships: "People",
};

/** The places that hold tasks, in map order. */
export const TASK_PLACES: AreaId[] = ["gym", "office", "library", "residence", "gardens"];

export interface PlaceLocation {
  lat: number;
  lng: number;
  radiusM: number;
  label: string;
}

export type Places = Partial<Record<AreaId, PlaceLocation>>;

export function isPlaceId(id: string): id is AreaId {
  return id in PLACE_LABEL;
}
