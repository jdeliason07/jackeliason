import { z } from "zod";
import { GPS_RULES } from "../config";
import { type AreaId } from "../content/estate";
import { isPlaceId, PLACE_CATEGORIES, PLACE_LABEL, type PlaceLocation, type Places } from "../content/places";
import { isValidCoordinate } from "../domain/geofence";
import { localDateOf } from "../domain/time";
import type { Tx } from "../store/types";
import { type GameDeps, GameError, requireProfile } from "./context";
import { updateQuest } from "./manage";
import type { OccurrenceSnapshot, QuestDefinition } from "./quest-definition";

/**
 * The real-life side of the game: where the owner's buildings actually are (the gym down the
 * street), and the real money tasks bring in. Neither touches XP, credits, or anything earned in
 * the game; they only make the game a truer picture of the owner's life.
 */

export const placeLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radiusM: z.number().int().min(GPS_RULES.minRadiusM).max(GPS_RULES.maxRadiusM),
  label: z.string().trim().max(60),
});

export function placesOf(raw: unknown): Places {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Places) : {};
}

const sameSpot = (a: { lat: number; lng: number } | null | undefined, b: { lat: number; lng: number } | null | undefined) =>
  Boolean(a && b && Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6);

/**
 * Saves (or clears) where a building is in real life. Location tasks that pointed at the old spot
 * move with it (each gets a new version, so past days keep the spot they were checked against).
 */
export async function setPlace(tx: Tx, deps: GameDeps, owner: string, area: string, location: PlaceLocation | null) {
  if (!isPlaceId(area)) throw new GameError("invalid_input", "Unknown place.");
  const profile = await requireProfile(tx, owner);
  if (location && !isValidCoordinate(location.lat, location.lng)) throw new GameError("invalid_input", "That spot isn't on the map.");
  const places = { ...placesOf(profile.places) };
  const previous = places[area] ?? null;
  const next: PlaceLocation | null = location
    ? {
        lat: Math.round(location.lat * 1e6) / 1e6,
        lng: Math.round(location.lng * 1e6) / 1e6,
        radiusM: location.radiusM,
        label: location.label.trim() || PLACE_LABEL[area],
      }
    : null;
  if (next) places[area] = next;
  else delete places[area];
  await tx.update("profiles", owner, { places: places as never, updated_at: deps.now().toISOString() });

  let moved = 0;
  if (next && previous && !sameSpot(previous, next)) {
    const quests = await tx.find("quests", { owner_id: owner, status: { $in: ["active", "paused"] } });
    for (const q of quests) {
      const v = q.current_version_id ? await tx.get("quest_versions", q.current_version_id) : null;
      const def = v?.definition as unknown as QuestDefinition | undefined;
      if (!def || !PLACE_CATEGORIES[area as AreaId].includes(def.category)) continue;
      if (def.verification.mode !== "gps" || !sameSpot(def.verification.gps, previous)) continue;
      await updateQuest(tx, deps, owner, q.id, { ...def, verification: { ...def.verification, gps: { ...next } } });
      moved++;
    }
  }
  return { area, location: next, moved };
}

export const earningSchema = z.object({
  occurrenceId: z.string().uuid().nullable(),
  org: z.string().trim().max(40),
  amountCents: z.number().int().min(0).max(100_000_000),
  note: z.string().trim().max(140).default(""),
});

/**
 * Records real money earned. Tied to a completed task when there is one (logging again corrects
 * the amount); otherwise stands alone, like a payment that arrived later. Zero is allowed: it
 * means "this one didn't bring anything in" and stops the prompt.
 */
export async function logEarning(tx: Tx, deps: GameDeps, owner: string, input: z.infer<typeof earningSchema>) {
  const profile = await requireProfile(tx, owner);
  const now = deps.now();
  const nowIso = now.toISOString();
  if (input.occurrenceId) {
    const occ = await tx.get("quest_occurrences", input.occurrenceId);
    if (!occ || occ.owner_id !== owner) throw new GameError("not_found", "Task not found.", 404);
    if (occ.status !== "completed") throw new GameError("invalid_input", "Finish the task first, then log what it earned.", 409);
    const snap = occ.snapshot as unknown as OccurrenceSnapshot;
    const org = input.org || snap.org || "";
    const existing = (await tx.find("earnings", { owner_id: owner, occurrence_id: occ.id }))[0];
    if (existing) {
      const row = await tx.update("earnings", existing.id, { amount_cents: input.amountCents, org, note: input.note, updated_at: nowIso });
      return { earningId: row.id, amountCents: row.amount_cents, org };
    }
    const row = await tx.insert("earnings", {
      id: deps.uuid(),
      owner_id: owner,
      occurrence_id: occ.id,
      quest_id: occ.quest_id,
      org,
      amount_cents: input.amountCents,
      note: input.note,
      local_date: occ.local_date,
      created_at: nowIso,
      updated_at: nowIso,
    });
    return { earningId: row.id, amountCents: row.amount_cents, org };
  }
  if (input.amountCents === 0) throw new GameError("invalid_input", "Enter an amount.");
  const row = await tx.insert("earnings", {
    id: deps.uuid(),
    owner_id: owner,
    occurrence_id: null,
    quest_id: null,
    org: input.org,
    amount_cents: input.amountCents,
    note: input.note,
    local_date: localDateOf(now, profile.timezone),
    created_at: nowIso,
    updated_at: nowIso,
  });
  return { earningId: row.id, amountCents: row.amount_cents, org: row.org };
}
