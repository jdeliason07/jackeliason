import "server-only";

/**
 * Server configuration. Secrets (service-role key, database URL, AI key, cron secret) are read only
 * here, on the server, and never use the NEXT_PUBLIC_ prefix. The browser receives only the public
 * Supabase URL and anon/publishable key, which RLS is designed around.
 */

export interface ServerEnv {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  serviceRoleKey: string | undefined;
  databaseUrl: string | undefined;
  ownerEmails: string[];
  vision: { provider: string | undefined; model: string; apiKey: string | undefined; timeoutMs: number };
  cronSecret: string | undefined;
  production: boolean;
}

export function serverEnv(): ServerEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    databaseUrl: process.env.MEROS_DATABASE_URL,
    ownerEmails: (process.env.MEROS_OWNER_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    vision: {
      provider: process.env.MEROS_VISION_PROVIDER,
      model: process.env.MEROS_VISION_MODEL || "claude-opus-5-5",
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeoutMs: Number(process.env.MEROS_VISION_TIMEOUT_MS) || 30_000,
    },
    cronSecret: process.env.CRON_SECRET,
    production: process.env.NODE_ENV === "production",
  };
}

/** What's missing for the live (non-demo) app. The UI shows this instead of pretending. */
export function missingLiveSettings(env = serverEnv()): string[] {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!env.serviceRoleKey) missing.push("SUPABASE_SECRET_KEY");
  if (!env.databaseUrl) missing.push("MEROS_DATABASE_URL");
  if (env.ownerEmails.length === 0) missing.push("MEROS_OWNER_EMAILS");
  return missing;
}

export function missingVisionSettings(env = serverEnv()): string[] {
  const missing: string[] = [];
  if (env.vision.provider !== "anthropic" && !(env.vision.provider === "test" && !env.production)) {
    missing.push("MEROS_VISION_PROVIDER");
  }
  if (env.vision.provider === "anthropic" && !env.vision.apiKey) missing.push("ANTHROPIC_API_KEY");
  return missing;
}
