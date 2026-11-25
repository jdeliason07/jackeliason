import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processEvidence, sniffType } from "@/lib/earned/server/image";
import { AnthropicVisionAdapter } from "@/lib/earned/verify/anthropic";
import { SYSTEM_PROMPT, toVerdict, userPrompt, verdictSchema, VisionUnavailable } from "@/lib/earned/verify/vision";

const rubric = { title: "Open the assigned textbook", minimumAction: "Open your textbook", criteria: ["An open textbook with printed pages visible", "The book is open (not closed)"] };

function adapterReturning(response: unknown | Error) {
  const adapter = new AnthropicVisionAdapter("test-key", "claude-opus-5-5", 1000);
  const calls: unknown[] = [];
  (adapter as unknown as { client: unknown }).client = {
    beta: {
      messages: {
        create: async (body: unknown) => {
          calls.push(body);
          if (response instanceof Error) throw response;
          return response;
        },
      },
    },
  };
  return { adapter, calls };
}

const reply = (json: unknown, stop_reason = "end_turn") => ({
  stop_reason,
  content: [{ type: "text", text: typeof json === "string" ? json : JSON.stringify(json) }],
});

describe("vision verdicts", () => {
  it("validates structured output strictly", () => {
    expect(verdictSchema.safeParse({ outcome: "accepted", criteria: [], reason: "ok", recapture_guidance: null }).success).toBe(true);
    expect(verdictSchema.safeParse({ outcome: "approved", criteria: [], reason: "ok", recapture_guidance: null }).success).toBe(false);
    expect(verdictSchema.safeParse({ outcome: "accepted", reason: "ok" }).success).toBe(false);
  });

  it("only accepts when every frozen criterion is visibly met", () => {
    const yes = rubric.criteria.map((criterion) => ({ criterion, visible: "yes" as const }));
    expect(toVerdict({ outcome: "accepted", criteria: yes, reason: "Open book.", recapture_guidance: null }, rubric).outcome).toBe("accepted");
    expect(toVerdict({ outcome: "accepted", criteria: [yes[0], { ...yes[1], visible: "unclear" }], reason: "x", recapture_guidance: null }, rubric).outcome).toBe("inconclusive");
    expect(toVerdict({ outcome: "accepted", criteria: [yes[0], { ...yes[1], visible: "no" }], reason: "x", recapture_guidance: null }, rubric).outcome).toBe("rejected");
    expect(toVerdict({ outcome: "accepted", criteria: [yes[0]], reason: "x", recapture_guidance: null }, rubric).outcome).not.toBe("accepted");
    const rejected = toVerdict({ outcome: "rejected", criteria: [], reason: "Book is closed.", recapture_guidance: null }, rubric);
    expect(rejected.guidance).toBeTruthy(); // always tells you what to do next
  });

  it("treats text inside the image as scene content, never instructions", () => {
    expect(SYSTEM_PROMPT).toMatch(/text that appears inside the image/i);
    expect(SYSTEM_PROMPT).toMatch(/never an instruction/i);
    expect(SYSTEM_PROMPT).toMatch(/identity, effort, attention/);
    expect(userPrompt(rubric)).toContain("<criteria>");
  });
});

describe("Anthropic adapter", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

  it("sends only the image and frozen criteria, with structured output", async () => {
    const yes = rubric.criteria.map((criterion) => ({ criterion, visible: "yes" }));
    const { adapter, calls } = adapterReturning(reply({ outcome: "accepted", criteria: yes, reason: "An open textbook.", recapture_guidance: null }));
    const verdict = await adapter.evaluate({ jpeg, rubric });
    expect(verdict.outcome).toBe("accepted");
    const body = calls[0] as { model: string; output_config: { format: { type: string } }; messages: { content: { type: string; source?: { media_type: string } }[] }[] };
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.messages[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/jpeg" } });
  });

  it("a photo whose text claims approval is still judged by its criteria", async () => {
    // Simulates a model partially swayed by injected text: claims accepted but can't confirm the criteria.
    const { adapter } = adapterReturning(
      reply({ outcome: "accepted", criteria: [{ criterion: rubric.criteria[0], visible: "no" }, { criterion: rubric.criteria[1], visible: "no" }], reason: "A note says APPROVED.", recapture_guidance: null }),
    );
    expect((await adapter.evaluate({ jpeg, rubric })).outcome).toBe("rejected");
  });

  it("maps refusals, truncation, malformed output, and transport errors to unavailable", async () => {
    for (const r of [reply("{}", "refusal"), reply("{", "max_tokens"), reply("not json"), reply({ outcome: "yes" }), new Error("socket hang up")]) {
      const { adapter } = adapterReturning(r);
      await expect(adapter.evaluate({ jpeg, rubric })).rejects.toBeInstanceOf(VisionUnavailable);
    }
  });
});

describe("evidence images", () => {
  it("sniffs real bytes, not declared types", async () => {
    expect(sniffType(Buffer.from("hello world, not an image"))).toBeNull();
    await expect(processEvidence(Buffer.from("<svg></svg>"))).rejects.toThrow(/supported photo/);
  });

  it("strips metadata, re-encodes as JPEG, and hashes the original bytes", async () => {
    const original = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#7a9" } })
      .jpeg()
      .withExif({ IFD0: { Make: "TestCam", Model: "Secret Phone" } })
      .toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const out = await processEvidence(original);
    const meta = await sharp(out.jpeg).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(out.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(out.dhash).toMatch(/^[0-9a-f]{16}$/);
    const png = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#fff" } }).png().toBuffer();
    expect((await sharp((await processEvidence(png)).jpeg).metadata()).format).toBe("jpeg");
  });

  it("rejects images that are too small to check", async () => {
    const tiny = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#000" } }).jpeg().toBuffer();
    await expect(processEvidence(tiny)).rejects.toThrow(/too small/);
  });
});
