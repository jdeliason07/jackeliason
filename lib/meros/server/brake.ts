import "server-only";

/** A per-instance brake on auth endpoints (Supabase Auth also rate-limits on its side). */
const hits = new Map<string, { count: number; since: number }>();

export function braked(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.since > windowMs) {
    hits.set(key, { count: 1, since: now });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

export function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
