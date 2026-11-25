/**
 * Calendar and time-zone arithmetic for occurrence windows, without a date library.
 *
 * Everything authoritative is an instant (a UTC `Date` / ISO string). Local dates ("YYYY-MM-DD")
 * and wall times ("HH:MM") are always interpreted in an explicit IANA zone.
 *
 * DST policy (tested in tests/earned/time.test.ts):
 * - A wall time that does not exist (spring-forward gap, e.g. 02:30 on the US start date) maps to
 *   the instant that the wall clock would show if it had kept the pre-transition offset, which is
 *   the same distance past the gap (02:30 → 03:30 local). Windows never vanish.
 * - A wall time that occurs twice (fall-back overlap, e.g. 01:30) maps to the EARLIER instant.
 *   A window that opens at 01:30 therefore opens at the first 01:30.
 * - A window is computed from its local date and wall times, so on transition days a window can be
 *   one hour longer or shorter than usual. That is intended: "06:00–09:00" means what the clock says.
 */

export type LocalDate = string; // YYYY-MM-DD
export type WallTime = string; // HH:MM (00:00–24:00; 24:00 only as an end)

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== "string" || timeZone.length > 64) return false;
  try {
    formatter(timeZone).format(0);
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** ISO weekday: Monday = 1 … Sunday = 7. */
  weekday: number;
}

export function localParts(instant: Date | number, timeZone: string): LocalParts {
  const parts = formatter(timeZone).formatToParts(typeof instant === "number" ? instant : instant.getTime());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS[get("weekday")] ?? 1,
  };
}

/** Offset of local time from UTC at an instant, in ms (Denver in winter: -7h). */
export function offsetMs(instant: number, timeZone: string): number {
  const p = localParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function localDateOf(instant: Date | number | string, timeZone: string): LocalDate {
  const t = typeof instant === "string" ? Date.parse(instant) : instant;
  const p = localParts(t, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

export function isLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isWallTime(value: string, allow24 = false): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  if (allow24 && h === 24 && m === 0) return true;
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}

export function wallMinutes(value: WallTime): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  const toUtc = (x: LocalDate) => {
    const [y, m, d] = x.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** ISO weekday of a calendar date (Monday = 1). Zone-independent. */
export function weekdayOf(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

/** The Monday that starts the ISO week containing `date`. */
export function weekStartOf(date: LocalDate): LocalDate {
  return addDays(date, 1 - weekdayOf(date));
}

/**
 * The instant at which the wall clock in `timeZone` shows `time` on `date`.
 * See the DST policy at the top of this file. "24:00" means midnight at the end of `date`.
 */
export function zonedTimeToUtc(date: LocalDate, time: WallTime, timeZone: string): Date {
  if (time === "24:00") return zonedTimeToUtc(addDays(date, 1), "00:00", timeZone);
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const before = offsetMs(naive - 12 * 3_600_000, timeZone);
  const after = offsetMs(naive + 12 * 3_600_000, timeZone);
  const candidates = [...new Set([naive - before, naive - after])].sort((a, b) => a - b);
  const valid = candidates.filter((c) => {
    const p = localParts(c, timeZone);
    return p.year === y && p.month === mo && p.day === d && p.hour === h && p.minute === mi;
  });
  if (valid.length > 0) return new Date(valid[0]); // earlier instant when ambiguous
  return new Date(naive - before); // gap: keep the pre-transition offset
}

export function toIso(date: Date | number): string {
  return new Date(date).toISOString();
}

/** Formats an instant as "HH:MM" wall time in a zone, for labels. */
export function wallTimeOf(instant: Date | number | string, timeZone: string): WallTime {
  const t = typeof instant === "string" ? Date.parse(instant) : instant;
  const p = localParts(t, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function monthOf(date: LocalDate): string {
  return date.slice(0, 7);
}
