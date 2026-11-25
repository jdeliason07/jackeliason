import { RATE_LIMITS, TIMING_RULES } from "../config";
import type { QuestOccurrences, VerificationAttempts } from "../db/schema";
import { evaluateGeofence, type GeoReading } from "../domain/geofence";
import type { Tx } from "../store/types";
import { type AwardSummary, completeMinimum } from "./awards";
import { type GameDeps, GameError, randomToken, sha256Hex } from "./context";
import type { Ledger } from "./ledger";
import type { OccurrenceSnapshot } from "./quest-definition";

/**
 * Verification. Scoring requires an accepted result tied to one scheduled occurrence; there is no
 * manual approval path. Photo flow:
 *
 *   issueChallenge ─▶ (client captures with the live camera) ─▶ beginPhotoAttempt (bind token, hash,
 *   occurrence, owner; reject reused bytes) ─▶ provider evaluates the frozen criteria ─▶ resolveAttempt
 *
 * The attempt id is the stable verification identity: retries after an outage re-evaluate the same
 * stored image and can never award twice. An outage leaves the attempt `unavailable` (never accepted,
 * never a failure); if it can't resolve within the grace period the occurrence is excused.
 */

export interface ProviderVerdict {
  outcome: "accepted" | "rejected" | "inconclusive";
  reason: string;
  guidance: string | null;
}

export type ResolveInput =
  | { kind: "verdict"; verdict: ProviderVerdict; provider: string; model: string }
  | { kind: "unavailable"; reason: string; provider: string; model: string };

export interface AttemptResult {
  attemptId: string;
  status: VerificationAttempts["status"];
  reason: string;
  guidance: string | null;
  award: AwardSummary | null;
  similarToPrevious?: boolean;
}

function snapshot(occ: QuestOccurrences): OccurrenceSnapshot {
  return occ.snapshot as unknown as OccurrenceSnapshot;
}

export async function loadOwnedOccurrence(tx: Tx, owner: string, occurrenceId: string): Promise<QuestOccurrences> {
  const occ = await tx.get("quest_occurrences", occurrenceId);
  if (!occ || occ.owner_id !== owner) throw new GameError("not_found", "That check-in isn't available.", 404);
  return occ;
}

export function assertOpenForEvidence(occ: QuestOccurrences, now: Date) {
  if (occ.status === "completed") throw new GameError("already_completed", "Already verified. Nice work.", 409);
  if (occ.status !== "open") throw new GameError("window_closed", "This check-in has closed.", 409);
  if (now.getTime() < Date.parse(occ.opens_at)) {
    throw new GameError("window_not_open", "This check-in hasn't opened yet.", 409);
  }
  if (now.getTime() >= Date.parse(occ.closes_at)) {
    throw new GameError("window_closed", "This check-in's window has closed. Evidence must be submitted inside the window.", 409);
  }
}

async function enforceRateLimit(tx: Tx, owner: string, now: Date) {
  const tenMin = new Date(now.getTime() - 10 * 60_000).toISOString();
  const day = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const recent = await tx.find("verification_attempts", { owner_id: owner, submitted_at: { $gte: day } });
  const lastTen = recent.filter((a) => a.submitted_at >= tenMin).length;
  if (lastTen >= RATE_LIMITS.verificationAttemptsPer10Min || recent.length >= RATE_LIMITS.verificationAttemptsPerDay) {
    throw new GameError("rate_limited", "Too many verification attempts. Wait a few minutes and try again.", 429);
  }
}

async function assertHabitFree(tx: Tx, occ: QuestOccurrences) {
  const done = await tx.find("quest_occurrences", {
    owner_id: occ.owner_id,
    habit_key: occ.habit_key,
    local_date: occ.local_date,
    status: "completed",
  });
  if (done.some((o) => o.id !== occ.id)) {
    throw new GameError("habit_already_scored", "This habit already scored today through another copy of the quest.", 409);
  }
}

export async function issueChallenge(tx: Tx, deps: GameDeps, owner: string, occurrenceId: string) {
  const now = deps.now();
  const occ = await loadOwnedOccurrence(tx, owner, occurrenceId);
  assertOpenForEvidence(occ, now);
  if (snapshot(occ).verification.mode !== "photo") throw new GameError("wrong_mode", "This quest is verified by location.", 400);
  await assertHabitFree(tx, occ);
  await enforceRateLimit(tx, owner, now);
  const token = randomToken();
  const id = deps.uuid();
  const expiresAt = new Date(
    Math.min(now.getTime() + TIMING_RULES.captureChallengeMinutes * 60_000, Date.parse(occ.closes_at)),
  ).toISOString();
  await tx.insert("capture_challenges", {
    id,
    owner_id: owner,
    occurrence_id: occ.id,
    token_hash: await sha256Hex(token),
    issued_at: now.toISOString(),
    expires_at: expiresAt,
    used_at: null,
  });
  return { challengeId: id, token, expiresAt, criteria: snapshot(occ).verification.criteria };
}

export interface PhotoSubmission {
  challengeId: string;
  token: string;
  sha256: string;
  dhash: string | null;
  imagePath: string | null;
  demo: boolean;
}

/**
 * Binds an uploaded image to its challenge and occurrence. Returns a pending attempt to evaluate, or
 * an already-decided one (exact image reuse is rejected here without calling the provider).
 */
export async function beginPhotoAttempt(
  tx: Tx,
  deps: GameDeps,
  owner: string,
  input: PhotoSubmission,
): Promise<{ attempt: VerificationAttempts; occurrence: QuestOccurrences; evaluate: boolean }> {
  const now = deps.now();
  if (input.demo !== (deps.mode === "demo")) throw new GameError("invalid_input", "Demo evidence can't be used here.", 400);
  const challenge = await tx.get("capture_challenges", input.challengeId);
  if (!challenge || challenge.owner_id !== owner) throw new GameError("challenge_invalid", "This capture session isn't valid. Start the camera again.", 400);

  const existing = await tx.find("verification_attempts", { challenge_id: challenge.id });
  if (existing[0]) {
    const occurrence = await loadOwnedOccurrence(tx, owner, existing[0].occurrence_id);
    return { attempt: existing[0], occurrence, evaluate: existing[0].status === "pending" };
  }
  if (challenge.used_at) throw new GameError("challenge_invalid", "This capture session was already used.", 400);
  if (Date.parse(challenge.expires_at) <= now.getTime()) {
    throw new GameError("challenge_invalid", "This capture session expired. Take a fresh photo.", 400);
  }
  if ((await sha256Hex(input.token)) !== challenge.token_hash) {
    throw new GameError("challenge_invalid", "This capture session isn't valid. Start the camera again.", 400);
  }
  const occ = await loadOwnedOccurrence(tx, owner, challenge.occurrence_id);
  assertOpenForEvidence(occ, now);
  await assertHabitFree(tx, occ);
  await enforceRateLimit(tx, owner, now);
  await tx.update("capture_challenges", challenge.id, { used_at: now.toISOString() });

  const snap = snapshot(occ);
  const rubric = { title: snap.title, minimumAction: snap.minimumAction, criteria: snap.verification.criteria };
  const base: VerificationAttempts = {
    id: deps.uuid(),
    owner_id: owner,
    occurrence_id: occ.id,
    challenge_id: challenge.id,
    idempotency_key: null,
    mode: "photo",
    status: "pending",
    reason: "",
    guidance: null,
    provider: null,
    model: null,
    rubric: rubric as never,
    image_path: input.imagePath,
    image_sha256: input.sha256,
    image_dhash: input.dhash,
    reuse_of: null,
    similar_to: null,
    image_deleted_at: null,
    distance_m: null,
    accuracy_m: null,
    reading_at: null,
    evaluations: 0,
    demo: input.demo,
    submitted_at: now.toISOString(),
    decided_at: null,
  };

  const reused = await tx.find("verification_attempts", { owner_id: owner, image_sha256: input.sha256, reuse_of: { $null: true } });
  if (reused[0]) {
    const attempt = await tx.insert("verification_attempts", {
      ...base,
      status: "rejected",
      reuse_of: reused[0].id,
      reason: "This exact photo was already submitted. Each check-in needs a fresh photo.",
      guidance: "Take a new photo of today's minimum action with the in-app camera.",
      decided_at: now.toISOString(),
    });
    return { attempt, occurrence: occ, evaluate: false };
  }

  // Perceptual similarity is supporting context only: genuine daily photos often look alike.
  if (input.dhash) {
    const recent = await tx.find(
      "verification_attempts",
      { owner_id: owner, mode: "photo", image_dhash: { $ne: null } },
      { orderBy: [["submitted_at", "desc"]], limit: 30 },
    );
    const similar = recent.find((a) => a.image_dhash && hamming(a.image_dhash, input.dhash!) <= 3);
    if (similar) base.similar_to = similar.id;
  }

  const attempt = await tx.insert("verification_attempts", base);
  return { attempt, occurrence: occ, evaluate: true };
}

export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Applies a provider decision (or outage) to a pending attempt. Idempotent per attempt. */
export async function resolveAttempt(
  tx: Tx,
  deps: GameDeps,
  ledger: Ledger,
  attemptId: string,
  input: ResolveInput,
): Promise<AttemptResult> {
  const now = deps.now();
  const attempt = await tx.get("verification_attempts", attemptId);
  if (!attempt || attempt.owner_id !== ledger.profile.id) throw new GameError("not_found", "Verification not found.", 404);
  if (attempt.status !== "pending" && attempt.status !== "unavailable") {
    return { attemptId, status: attempt.status, reason: attempt.reason, guidance: attempt.guidance, award: null };
  }
  const occ = await loadOwnedOccurrence(tx, ledger.profile.id, attempt.occurrence_id);
  const inGrace = now.getTime() < Date.parse(occ.closes_at) + TIMING_RULES.verificationGraceHours * 3_600_000;

  if (input.kind === "unavailable") {
    const updated = await tx.update("verification_attempts", attempt.id, {
      status: "unavailable",
      reason: input.reason,
      guidance: inGrace
        ? "The checker is unavailable. Your photo is saved; retry shortly. This won't count against you."
        : null,
      provider: input.provider,
      model: input.model,
      evaluations: attempt.evaluations + 1,
    });
    return { attemptId, status: updated.status, reason: updated.reason, guidance: updated.guidance, award: null };
  }

  const { verdict } = input;
  const updated = await tx.update("verification_attempts", attempt.id, {
    status: verdict.outcome,
    reason: verdict.reason.slice(0, 500),
    guidance: verdict.guidance?.slice(0, 500) ?? null,
    provider: input.provider,
    model: input.model,
    evaluations: attempt.evaluations + 1,
    decided_at: now.toISOString(),
  });

  let award: AwardSummary | null = null;
  if (verdict.outcome === "accepted") {
    if (occ.status === "open" && inGrace) {
      award = await completeMinimum(tx, deps, ledger, occ, updated);
    }
  }
  return {
    attemptId,
    status: updated.status,
    reason: updated.reason,
    guidance: updated.guidance,
    award,
    similarToPrevious: Boolean(updated.similar_to),
  };
}

/** For retrying an outage: returns the stored evidence to re-evaluate, within the grace period. */
export async function attemptForRetry(tx: Tx, deps: GameDeps, owner: string, attemptId: string) {
  const attempt = await tx.get("verification_attempts", attemptId);
  if (!attempt || attempt.owner_id !== owner) throw new GameError("not_found", "Verification not found.", 404);
  if (attempt.status !== "unavailable" && attempt.status !== "pending") {
    return { attempt, retry: false as const };
  }
  const occ = await loadOwnedOccurrence(tx, owner, attempt.occurrence_id);
  const graceEnd = Date.parse(occ.closes_at) + TIMING_RULES.verificationGraceHours * 3_600_000;
  if (deps.now().getTime() >= graceEnd || !attempt.image_path || attempt.image_deleted_at) {
    return { attempt, retry: false as const };
  }
  return { attempt, retry: true as const, rubric: attempt.rubric, imagePath: attempt.image_path };
}

export async function submitGps(
  tx: Tx,
  deps: GameDeps,
  ledger: Ledger,
  input: { occurrenceId: string; reading: GeoReading; idempotencyKey: string },
): Promise<AttemptResult> {
  const now = deps.now();
  const owner = ledger.profile.id;
  const prior = await tx.find("verification_attempts", { owner_id: owner, idempotency_key: input.idempotencyKey });
  if (prior[0]) {
    return { attemptId: prior[0].id, status: prior[0].status, reason: prior[0].reason, guidance: prior[0].guidance, award: null };
  }
  const occ = await loadOwnedOccurrence(tx, owner, input.occurrenceId);
  assertOpenForEvidence(occ, now);
  const snap = snapshot(occ);
  if (snap.verification.mode !== "gps") throw new GameError("wrong_mode", "This quest is verified by photo.", 400);
  await assertHabitFree(tx, occ);
  await enforceRateLimit(tx, owner, now);
  const target = snap.verification.gps;
  if (!target) throw new GameError("invalid_input", "This quest has no saved location. Edit it to set one.", 400);
  const decision = evaluateGeofence(target, input.reading, now.getTime());
  // Raw check-in coordinates are not stored: only distance, accuracy, and time.
  const attempt = await tx.insert("verification_attempts", {
    id: deps.uuid(),
    owner_id: owner,
    occurrence_id: occ.id,
    challenge_id: null,
    idempotency_key: input.idempotencyKey,
    mode: "gps",
    status: decision.outcome,
    reason: decision.reason,
    guidance: decision.guidance,
    provider: "geofence",
    model: `geofence-v1:${decision.code}`,
    rubric: { radiusM: target.radiusM, label: target.label } as never,
    image_path: null,
    image_sha256: null,
    image_dhash: null,
    reuse_of: null,
    similar_to: null,
    image_deleted_at: null,
    distance_m: decision.distanceM,
    accuracy_m: decision.accuracyM,
    reading_at: Number.isFinite(input.reading.timestamp) ? new Date(input.reading.timestamp).toISOString() : null,
    evaluations: 1,
    demo: deps.mode === "demo",
    submitted_at: now.toISOString(),
    decided_at: now.toISOString(),
  });
  const award = decision.outcome === "accepted" ? await completeMinimum(tx, deps, ledger, occ, attempt) : null;
  return { attemptId: attempt.id, status: attempt.status, reason: attempt.reason, guidance: attempt.guidance, award };
}
