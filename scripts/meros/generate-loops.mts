/**
 * Turns each estate aerial (public/meros/art/estate/overview-*.webp, made by generate-art.mts) into a
 * seamless six-second loop with Google's Veo on Vertex AI: trees and grass in the wind, clouds and
 * their shadows drifting, a little street life. The first and last frames are both the still photo,
 * so the loop has no seam, and the still stays the poster (and the whole picture under reduced motion).
 *
 *   GCP_PROJECT=my-project npm run meros:loops                 # every stage without a loop yet
 *   GCP_PROJECT=my-project npm run meros:loops -- --only=overview-1
 *
 * Needs ffmpeg on PATH to compress the result for the web.
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ESTATE_STAGES } from "../../lib/meros/content/art";

const PROJECT = process.env.GCP_PROJECT;
const MODEL = process.env.LOOP_MODEL ?? "veo-3.1-fast-generate-001";
const REGION = "us-central1";
const CACHE = process.env.ART_CACHE ?? ".cache/meros-art";
const OUT = "public/meros/art/estate";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
if (!PROJECT) throw new Error("Set GCP_PROJECT.");

const PROMPT =
  "The same aerial photograph, brought gently to life. A light breeze moves the leaves of the street trees and the grass in the park; " +
  "soft cloud shadows drift slowly across the rooftops; a few cars and taxis move along the streets; a flag ripples. " +
  "The camera stays perfectly still. Buildings do not move or change. Calm, realistic, subtle motion. No text.";

const token = () => execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
const base = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/publishers/google/models/${MODEL}`;

async function call(path: string, body: unknown) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${base}:${path}`, { method: "POST", headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return res.json();
    const text = await res.text();
    if (res.status !== 429 || attempt >= 8) throw new Error(`${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 15_000 * attempt));
  }
}

async function loop(stage: number) {
  const id = `overview-${stage}`;
  const still = join(CACHE, "estate", `${id}.png`);
  const raw = join(CACHE, "loops", `${id}.mp4`);
  const out = join(OUT, `${id}.mp4`);
  if (!existsSync(still)) return console.log(`${id}: no still yet, skipped`);
  if (!existsSync(raw)) {
    const frame = { bytesBase64Encoded: readFileSync(still).toString("base64"), mimeType: "image/png" };
    const op = (await call("predictLongRunning", {
      instances: [{ prompt: PROMPT, image: frame, lastFrame: frame }],
      parameters: { aspectRatio: "9:16", durationSeconds: 6, generateAudio: false, resolution: "720p", sampleCount: 1 },
    })) as { name: string };
    console.log(`${id}: started`);
    for (;;) {
      await new Promise((r) => setTimeout(r, 10_000));
      const status = (await call("fetchPredictOperation", { operationName: op.name })) as {
        done?: boolean;
        error?: { message: string };
        response?: { videos?: { bytesBase64Encoded?: string }[]; raiMediaFilteredReasons?: string[] };
      };
      if (!status.done) continue;
      if (status.error) throw new Error(`${id}: ${status.error.message}`);
      const video = status.response?.videos?.[0]?.bytesBase64Encoded;
      if (!video) throw new Error(`${id}: no video (${JSON.stringify(status.response).slice(0, 200)})`);
      mkdirSync(join(CACHE, "loops"), { recursive: true });
      writeFileSync(raw, Buffer.from(video, "base64"));
      break;
    }
  }
  // Web size: 540x960 H.264, no audio, fast start. About 1 MB for six seconds.
  mkdirSync(OUT, { recursive: true });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-an", "-vf", "scale=540:960", "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
  console.log(`${id}: ${out}`);
}

const stages = ESTATE_STAGES.filter((s) => !args.only || args.only === `overview-${s}`);
for (const stage of stages) {
  try {
    await loop(stage);
  } catch (e) {
    console.error(String(e));
    process.exitCode = 1;
  }
}
