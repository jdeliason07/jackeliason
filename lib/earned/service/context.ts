import { CONSEQUENCE_POLICY_V1, type ConsequencePolicy } from "../config";
import type { Profiles } from "../db/schema";
import type { Rng } from "../domain/random";
import { localDateOf } from "../domain/time";
import type { Store, Tx } from "../store/types";

export interface GameDeps {
  store: Store;
  now: () => Date;
  /** CSPRNG-backed in production (chest outcomes). */
  rng: Rng;
  /** Battle seeds (stored with each battle). */
  seed: () => number;
  uuid: () => string;
  /** "demo" runs in the browser on synthetic data and can never touch a real account. */
  mode: "live" | "demo";
}

export type ErrorCode =
  | "invalid_input"
  | "not_onboarded"
  | "already_onboarded"
  | "not_found"
  | "conflict"
  | "window_not_open"
  | "window_closed"
  | "already_completed"
  | "habit_already_scored"
  | "wrong_mode"
  | "challenge_invalid"
  | "rate_limited"
  | "duplicate_quest"
  | "similar_quest"
  | "insufficient_funds"
  | "insufficient_tickets"
  | "battle_in_progress"
  | "battle_rule"
  | "locked"
  | "budget_exceeded"
  | "not_unlocked"
  | "already_claimed"
  | "verification_unavailable";

export class GameError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = "GameError";
  }
}

export function policyOf(profile: Profiles): ConsequencePolicy {
  const stored = (profile.policy ?? {}) as Partial<ConsequencePolicy>;
  return { ...CONSEQUENCE_POLICY_V1, ...stored, penaltyByMiss: { ...CONSEQUENCE_POLICY_V1.penaltyByMiss, ...(stored.penaltyByMiss ?? {}) } };
}

export function profileDay(profile: Profiles, instant: Date | string): string {
  return localDateOf(typeof instant === "string" ? Date.parse(instant) : instant, profile.timezone);
}

export async function requireProfile(tx: Tx, ownerId: string): Promise<Profiles> {
  const profile = await tx.get("profiles", ownerId);
  if (!profile || !profile.onboarded_at) throw new GameError("not_onboarded", "Finish setup first.", 409);
  return profile;
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}
