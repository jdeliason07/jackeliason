import { describe, expect, it } from "vitest";
import { evaluateGeofence, haversineMeters } from "@/lib/meros/domain/geofence";
import { currentOccurrenceDate, windowFor, weekBounds, prorateWeeklyTarget } from "@/lib/meros/domain/schedule";
import { localDateOf, weekStartOf, zonedTimeToUtc } from "@/lib/meros/domain/time";

const TZ = "America/Denver";

describe("time zones and DST", () => {
  it("maps wall times to instants", () => {
    expect(zonedTimeToUtc("2026-01-15", "06:00", TZ).toISOString()).toBe("2026-01-15T13:00:00.000Z");
    expect(zonedTimeToUtc("2026-07-15", "06:00", TZ).toISOString()).toBe("2026-07-15T12:00:00.000Z");
  });

  it("moves a nonexistent spring-forward time past the gap", () => {
    // 2026-03-08 02:30 does not exist in Denver; policy: keep the pre-transition offset → 03:30 MDT.
    expect(zonedTimeToUtc("2026-03-08", "02:30", TZ).toISOString()).toBe("2026-03-08T09:30:00.000Z");
  });

  it("uses the earlier instant for an ambiguous fall-back time", () => {
    // 2026-11-01 01:30 happens twice; the first is MDT (UTC-6).
    expect(zonedTimeToUtc("2026-11-01", "01:30", TZ).toISOString()).toBe("2026-11-01T07:30:00.000Z");
  });

  it("gives transition days their true wall-clock lengths", () => {
    const spring = windowFor("2026-03-08", { start: "00:00", end: "24:00" }, TZ);
    expect((spring.closesAt.getTime() - spring.opensAt.getTime()) / 3_600_000).toBe(23);
    const fall = windowFor("2026-11-01", { start: "00:00", end: "24:00" }, TZ);
    expect((fall.closesAt.getTime() - fall.opensAt.getTime()) / 3_600_000).toBe(25);
    const normal = windowFor("2026-11-02", { start: "06:00", end: "09:00" }, TZ);
    expect((normal.closesAt.getTime() - normal.opensAt.getTime()) / 3_600_000).toBe(3);
  });

  it("handles windows that cross midnight, governed by the opening date", () => {
    const w = windowFor("2026-05-04", { start: "22:00", end: "01:00" }, TZ);
    expect(w.opensAt.toISOString()).toBe("2026-05-05T04:00:00.000Z");
    expect(w.closesAt.toISOString()).toBe("2026-05-05T07:00:00.000Z");
    // At 00:30 local on May 5, the open window belongs to May 4.
    expect(currentOccurrenceDate(new Date("2026-05-05T06:30:00Z"), { start: "22:00", end: "01:00" }, TZ)).toBe("2026-05-04");
  });

  it("computes local dates and Monday week starts", () => {
    expect(localDateOf(Date.parse("2026-11-25T05:00:00Z"), TZ)).toBe("2026-11-24");
    expect(weekStartOf("2026-11-29")).toBe("2026-11-23");
    expect(weekStartOf("2026-11-23")).toBe("2026-11-23");
  });

  it("prorates the first weekly target so activation never creates a guaranteed miss", () => {
    const w = { start: "06:00", end: "22:00" };
    const b = weekBounds("2026-11-27", w, TZ); // Friday
    expect(prorateWeeklyTarget(5, b.weekStart, new Date("2026-11-27T20:00:00Z"), w, TZ)).toBe(3); // Fri, Sat, Sun
    expect(prorateWeeklyTarget(2, b.weekStart, new Date("2026-11-27T20:00:00Z"), w, TZ)).toBe(2);
  });
});

describe("geofence", () => {
  const target = { lat: 40.2518, lng: -111.6493, radiusM: 150 };
  const now = Date.parse("2026-11-25T17:00:00Z");
  const at = (dLatMeters: number, accuracyM: number, ageMs = 1000) => ({
    lat: target.lat + dLatMeters / 111_195,
    lng: target.lng,
    accuracyM,
    timestamp: now - ageMs,
  });

  it("measures haversine distance", () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111_195, -2);
  });

  it("accepts only when the whole accuracy circle is inside", () => {
    expect(evaluateGeofence(target, at(50, 20), now).outcome).toBe("accepted");
    expect(evaluateGeofence(target, at(130, 20), now).outcome).toBe("accepted"); // 150 exactly
    expect(evaluateGeofence(target, at(135, 20), now)).toMatchObject({ outcome: "inconclusive", code: "boundary" });
  });

  it("rejects only when the whole circle is outside", () => {
    expect(evaluateGeofence(target, at(400, 30), now)).toMatchObject({ outcome: "rejected", code: "outside" });
    expect(evaluateGeofence(target, at(175, 30), now).outcome).toBe("inconclusive");
  });

  it("treats poor or zone-wide accuracy as inconclusive, not cheating", () => {
    expect(evaluateGeofence(target, at(10, 300), now)).toMatchObject({ outcome: "inconclusive", code: "poor_accuracy" });
    expect(evaluateGeofence(target, at(10, 160), now)).toMatchObject({ outcome: "inconclusive", code: "accuracy_wider_than_zone" });
  });

  it("rejects stale, future, and invalid readings", () => {
    expect(evaluateGeofence(target, at(10, 10, 10 * 60_000), now)).toMatchObject({ outcome: "inconclusive", code: "stale" });
    expect(evaluateGeofence(target, at(10, 10, -5 * 60_000), now)).toMatchObject({ outcome: "rejected", code: "future" });
    expect(evaluateGeofence(target, { lat: 0, lng: 0, accuracyM: 5, timestamp: now }, now)).toMatchObject({ outcome: "rejected", code: "invalid" });
    expect(evaluateGeofence(target, { lat: NaN, lng: 1, accuracyM: 5, timestamp: now }, now).outcome).toBe("rejected");
    expect(evaluateGeofence(target, at(10, 0), now)).toMatchObject({ outcome: "inconclusive", code: "invalid" });
  });
});
