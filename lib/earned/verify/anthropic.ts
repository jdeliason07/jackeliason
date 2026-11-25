import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ProviderVerdict } from "../service/verification";
import { type Rubric, SYSTEM_PROMPT, toVerdict, userPrompt, VERDICT_JSON_SCHEMA, verdictSchema, type VisionAdapter, VisionUnavailable } from "./vision";

/**
 * Claude vision adapter (Anthropic Messages API, structured JSON output). Sends only the
 * re-encoded, metadata-free JPEG and the quest's frozen criteria. Low effort: this is a narrow
 * visual check. Server-side fallbacks are on so a model-level refusal can be retried by the API;
 * a final refusal, timeout, outage, or output that fails schema validation is "unavailable", never
 * acceptance and never the owner's failure.
 *
 * Anthropic's API retention: inputs/outputs are retained per Anthropic's commercial data-retention
 * policy for the account (see README "Evidence and privacy"); this app cannot delete provider-side
 * copies.
 */
export class AnthropicVisionAdapter implements VisionAdapter {
  provider = "anthropic";
  private client: Anthropic;

  constructor(
    apiKey: string,
    public model: string,
    timeoutMs: number,
  ) {
    this.client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 1 });
  }

  async evaluate({ jpeg, rubric, signal }: { jpeg: Buffer; rubric: Rubric; signal?: AbortSignal }): Promise<ProviderVerdict> {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create(
        {
          model: this.model,
          max_tokens: 2000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low", format: { type: "json_schema", schema: VERDICT_JSON_SCHEMA as unknown as Record<string, unknown> } },
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
                { type: "text", text: userPrompt(rubric) },
              ],
            },
          ],
        },
        { signal },
      );
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        // Log status only: never the image or the key.
        throw new VisionUnavailable(`provider error ${error.status ?? "network"}`);
      }
      throw new VisionUnavailable("provider request failed");
    }

    if (response.stop_reason === "refusal") throw new VisionUnavailable("provider declined to evaluate");
    if (response.stop_reason === "max_tokens") throw new VisionUnavailable("provider output truncated");
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new VisionUnavailable("provider returned malformed output");
    }
    const result = verdictSchema.safeParse(parsed);
    if (!result.success) throw new VisionUnavailable("provider output failed validation");
    return toVerdict(result.data, rubric);
  }
}
