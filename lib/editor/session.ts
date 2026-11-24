import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The editor's lock. The password lives only in the EDITOR_PASSWORD environment
 * variable on the server; it never reaches the browser. A correct password earns
 * a signed, HttpOnly session cookie that expires after 12 hours. Changing the
 * password signs everyone out, because sessions are signed with it.
 */

export const SESSION_COOKIE = "editor_session";
const SESSION_HOURS = 12;

/** Which of the two settings the editor needs are missing (see README.md). */
export function missingSettings(): string[] {
  return ["EDITOR_PASSWORD", "GITHUB_TOKEN"].filter((name) => !process.env[name]);
}

const sha256 = (text: string) => createHash("sha256").update(text).digest();
const signingKey = () => sha256(`jackeliason.com editor\0${process.env.EDITOR_PASSWORD ?? ""}`);
const sign = (payload: string) => createHmac("sha256", signingKey()).update(payload).digest("hex");

export function passwordMatches(attempt: string): boolean {
  const expected = process.env.EDITOR_PASSWORD;
  if (!expected) return false;
  // Compare fixed-length digests in constant time, so timing reveals nothing about the password.
  return timingSafeEqual(sha256(attempt), sha256(expected));
}

export function newSession(): { value: string; maxAge: number } {
  const maxAge = SESSION_HOURS * 60 * 60;
  const expires = String(Date.now() + maxAge * 1000);
  return { value: `${expires}.${sign(expires)}`, maxAge };
}

function sessionValid(value: string | undefined): boolean {
  if (!value || !process.env.EDITOR_PASSWORD) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(expires), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function signedIn(): Promise<boolean> {
  return sessionValid((await cookies()).get(SESSION_COOKIE)?.value);
}

export const sessionCookie = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
};

/**
 * Changes must come from this site's own pages. With the strict same-site cookie,
 * this stops another site from submitting a change in a signed-in browser.
 */
export function fromThisSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Slows password guessing: every wrong attempt waits a second, and an address
 * that keeps guessing is refused for a while. Per server instance, so it's a
 * brake rather than a wall; a long passphrase is the real protection.
 */
const failures = new Map<string, { count: number; since: number }>();
const WINDOW = 15 * 60 * 1000;
const LIMIT = 8;

export function tooManyAttempts(address: string): boolean {
  const entry = failures.get(address);
  if (!entry || Date.now() - entry.since > WINDOW) return false;
  return entry.count >= LIMIT;
}

export async function recordFailure(address: string): Promise<void> {
  const entry = failures.get(address);
  if (!entry || Date.now() - entry.since > WINDOW) failures.set(address, { count: 1, since: Date.now() });
  else entry.count += 1;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

export function clientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
