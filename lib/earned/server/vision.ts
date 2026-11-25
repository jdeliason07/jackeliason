import "server-only";
import { AnthropicVisionAdapter } from "../verify/anthropic";
import { ScriptedVisionAdapter, type VisionAdapter } from "../verify/vision";
import { missingVisionSettings, serverEnv } from "./env";

/**
 * Chooses the configured vision adapter. Fails closed: with no provider configured, photo
 * verification is unavailable (the UI says so) and nothing is ever accepted by a mock in production.
 * The scripted adapter exists only for local development with EARNED_VISION_PROVIDER=test, and the
 * factory refuses it when NODE_ENV is production.
 */
export function visionAdapter(): VisionAdapter | null {
  const env = serverEnv();
  if (missingVisionSettings(env).length) return null;
  if (env.vision.provider === "anthropic") return new AnthropicVisionAdapter(env.vision.apiKey!, env.vision.model, env.vision.timeoutMs);
  if (env.vision.provider === "test" && !env.production) {
    return new ScriptedVisionAdapter(() => ({ outcome: "accepted", reason: "Local test adapter: accepted without AI.", guidance: null }));
  }
  return null;
}
