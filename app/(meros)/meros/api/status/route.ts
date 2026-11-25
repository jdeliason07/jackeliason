import { missingLiveSettings, missingVisionSettings } from "@/lib/meros/server/env";
import { json } from "@/lib/meros/server/http";

export const dynamic = "force-dynamic";

/** Which settings are missing (names only, never values), so the app can explain instead of failing. */
export async function GET() {
  return json({ live: missingLiveSettings(), vision: missingVisionSettings() });
}
