import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { GameError } from "../service/context";
import { ensureAllowlisted } from "./db";
import { missingLiveSettings, serverEnv } from "./env";

/**
 * Supabase Auth with a private owner allowlist. A valid session is necessary but not sufficient:
 * the email must also be in MEROS_OWNER_EMAILS. Identity comes from getClaims(), which verifies the
 * JWT, never from client-supplied ids.
 */

export async function supabaseServer() {
  const env = serverEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) throw new GameError("verification_unavailable", "Sign-in isn't configured.", 503);
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes cookies instead.
        }
      },
    },
  });
}

/** Service-role client for private storage only. Never sent to the browser. */
export function supabaseAdmin() {
  const env = serverEnv();
  if (!env.supabaseUrl || !env.serviceRoleKey) throw new Error("Supabase service credentials are not set");
  return createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return serverEnv().ownerEmails.includes(email.toLowerCase());
}

export interface Owner {
  id: string;
  email: string;
}

/** The signed-in, allowlisted owner, or a 401/403 GameError. */
export async function requireOwner(): Promise<Owner> {
  if (missingLiveSettings().length) throw new GameError("verification_unavailable", "Meros isn't configured on this server yet.", 503);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) throw new GameError("not_found", "Sign in to continue.", 401);
  const email = typeof claims.email === "string" ? claims.email : null;
  if (!isAllowedEmail(email)) throw new GameError("not_found", "This account isn't allowed to use Meros.", 403);
  await ensureAllowlisted(email!);
  return { id: claims.sub, email: email! };
}

/** Same-origin check for mutations (cookies are SameSite=Lax by default). */
export function fromSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
