import { GPS_RULES } from "../config";

/**
 * GPS evidence, evaluated on the server. A reading is evidence that the device reported a position
 * inside the quest's area at a moment; it is not tamper-proof and the app never claims it is.
 *
 * Conservative boundary rule: accepted only when the whole uncertainty circle (distance + accuracy)
 * fits inside the radius. Rejected only when the whole circle lies outside (distance − accuracy >
 * radius). A circle that overlaps the boundary is inconclusive: retry, ideally with a better fix.
 */

export interface GeoTarget {
  lat: number;
  lng: number;
  radiusM: number;
}

export interface GeoReading {
  lat: number;
  lng: number;
  /** Device-reported horizontal accuracy (meters, 68% confidence radius). */
  accuracyM: number;
  /** Device timestamp of the fix (ms since epoch). */
  timestamp: number;
}

export type GeoOutcome = "accepted" | "rejected" | "inconclusive";

export interface GeoDecision {
  outcome: GeoOutcome;
  code:
    | "inside"
    | "outside"
    | "boundary"
    | "poor_accuracy"
    | "accuracy_wider_than_zone"
    | "stale"
    | "future"
    | "invalid";
  reason: string;
  guidance: string | null;
  distanceM: number | null;
  accuracyM: number | null;
  ageMs: number | null;
}

const EARTH_RADIUS_M = 6_371_008.8;

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0) // "Null Island" is a classic failed-fix value
  );
}

export function isValidRadius(r: unknown): r is number {
  return typeof r === "number" && Number.isFinite(r) && r >= GPS_RULES.minRadiusM && r <= GPS_RULES.maxRadiusM;
}

export function evaluateGeofence(target: GeoTarget, reading: GeoReading, serverNow: number): GeoDecision {
  const base = { distanceM: null, accuracyM: null, ageMs: null } as const;
  if (!isValidCoordinate(target.lat, target.lng) || !isValidRadius(target.radiusM)) {
    return {
      ...base,
      outcome: "inconclusive",
      code: "invalid",
      reason: "This quest's location isn't set up correctly.",
      guidance: "Edit the quest and set its location again.",
    };
  }
  if (
    !isValidCoordinate(reading.lat, reading.lng) ||
    typeof reading.accuracyM !== "number" ||
    !Number.isFinite(reading.accuracyM) ||
    typeof reading.timestamp !== "number" ||
    !Number.isFinite(reading.timestamp)
  ) {
    return { ...base, outcome: "rejected", code: "invalid", reason: "The location reading was incomplete or invalid.", guidance: "Try again." };
  }
  const ageMs = serverNow - reading.timestamp;
  const accuracyM = Math.round(reading.accuracyM * 10) / 10;
  if (ageMs < -GPS_RULES.maxFutureSkewMs) {
    return {
      ...base,
      accuracyM,
      ageMs,
      outcome: "rejected",
      code: "future",
      reason: "The reading's timestamp is ahead of the server clock.",
      guidance: "Check that your phone's date and time are set automatically, then try again.",
    };
  }
  if (ageMs > GPS_RULES.maxReadingAgeMs) {
    return {
      ...base,
      accuracyM,
      ageMs,
      outcome: "inconclusive",
      code: "stale",
      reason: "That reading is too old to count.",
      guidance: "Request a fresh location and submit it right away.",
    };
  }
  if (reading.accuracyM < GPS_RULES.minPlausibleAccuracyM) {
    return {
      ...base,
      accuracyM,
      ageMs,
      outcome: "inconclusive",
      code: "invalid",
      reason: "The reported accuracy isn't plausible for a phone fix.",
      guidance: "Turn off any location-simulation tools and try again.",
    };
  }
  const distanceM = Math.round(haversineMeters(target, reading) * 10) / 10;
  const common = { distanceM, accuracyM, ageMs };
  if (reading.accuracyM > GPS_RULES.maxUsableAccuracyM) {
    return {
      ...common,
      outcome: "inconclusive",
      code: "poor_accuracy",
      reason: `Your phone's fix is only accurate to about ${Math.round(accuracyM)} m. That's common indoors and isn't a sign of anything wrong.`,
      guidance: "Step near a window or outside for a few seconds, make sure Precise Location is on, then try again.",
    };
  }
  if (distanceM + reading.accuracyM <= target.radiusM) {
    return { ...common, outcome: "accepted", code: "inside", reason: "You're inside this quest's area.", guidance: null };
  }
  if (distanceM - reading.accuracyM > target.radiusM) {
    return {
      ...common,
      outcome: "rejected",
      code: "outside",
      reason: `You're about ${Math.round(distanceM)} m from the saved spot; the area is ${target.radiusM} m.`,
      guidance: "Check in once you've arrived. If the saved spot is wrong, edit the quest's location.",
    };
  }
  if (reading.accuracyM >= target.radiusM) {
    return {
      ...common,
      outcome: "inconclusive",
      code: "accuracy_wider_than_zone",
      reason: `The fix (±${Math.round(accuracyM)} m) is wider than the ${target.radiusM} m area, so it can't confirm you're inside.`,
      guidance: "Wait a moment for a sharper fix near a window or outside, or widen the area in the quest's settings.",
    };
  }
  return {
    ...common,
    outcome: "inconclusive",
    code: "boundary",
    reason: "You're near the edge of the area and the fix's uncertainty overlaps it.",
    guidance: "Move a little closer to the saved spot and try again.",
  };
}
