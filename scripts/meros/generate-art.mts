/**
 * Generates Meros's photographic art with Google's Gemini image model on Vertex AI, then writes
 * web-sized WebP files to public/meros/art. Resumable: raw PNGs are cached (ART_CACHE, default
 * .cache/meros-art) and anything already generated is skipped, so a rerun only fills gaps.
 *
 *   gcloud auth activate-service-account --key-file=key.json
 *   GCP_PROJECT=my-project npm run meros:art                # everything missing
 *   GCP_PROJECT=my-project npm run meros:art -- --only=items --limit=3
 *
 * Characters: one base photo per person (skin × hair, wearing the T-shirt), then each other outfit
 * is generated FROM that photo, so the face, hair, pose, and street stay the same as outfits unlock.
 * Estate overviews chain the same way: each stage adds its feature to the previous photograph.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { BASE_OUTFITS, HAIR_STYLES, LEVEL_UNLOCKS } from "../../lib/meros/content/appearance";
import { ESTATE_STAGES, PHOTO_HAIR, PHOTO_OUTFITS, PHOTO_SKINS } from "../../lib/meros/content/art";
import { AREAS } from "../../lib/meros/content/estate";
import { ITEMS } from "../../lib/meros/content/items";

const PROJECT = process.env.GCP_PROJECT;
/**
 * Each model has its own small quota (a couple of requests per window), so requests rotate across
 * the cheap image models; a model that answers 429 rests for a while and the next free one is used.
 */
const MODELS = (process.env.ART_MODEL ?? "gemini-3.1-flash-lite-image,gemini-3.1-flash-image,gemini-2.5-flash-image").split(",");
const restingUntil = new Map<string, number>();
let turn = 0;
async function pickModel(): Promise<string> {
  for (;;) {
    for (let i = 0; i < MODELS.length; i++) {
      const m = MODELS[(turn + i) % MODELS.length];
      if ((restingUntil.get(m) ?? 0) <= Date.now()) {
        turn = (turn + i + 1) % MODELS.length;
        return m;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
const usage = new Map<string, number>();
const CACHE = process.env.ART_CACHE ?? ".cache/meros-art";
const OUT = "public/meros/art";
const CONCURRENCY = Number(process.env.ART_CONCURRENCY ?? 6);
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
if (!PROJECT) throw new Error("Set GCP_PROJECT.");

type Kind = "char" | "items" | "estate";
interface Job {
  id: string; // also the output path under OUT, without extension
  kind: Kind;
  prompt: string;
  aspect: "3:4" | "1:1" | "4:3";
  reference?: string; // id of a job whose image is sent with the prompt
  size: [number, number];
  quality: number;
}

// ——— Prompts ———

const PERSON = (skin: string, hair: string, outfit: string) =>
  `Full-body photograph of a young man in his early twenties with ${skin} and ${hair}, wearing ${outfit}. ` +
  "He stands straight facing the camera, arms relaxed at his sides, with a calm, confident expression. " +
  "Centered, the whole figure from head to shoes in frame with a little space above and below. " +
  "A modern city pedestrian street with planters and storefronts softly out of focus behind him, overcast soft daylight, " +
  "50mm lens, shallow depth of field, photorealistic, natural skin texture. No text, no logos, no other people in focus.";

const REDRESS = (outfit: string) =>
  "This is a photograph of a man. Produce the same photograph of the same man: identical face, identical hair, " +
  "identical skin tone and build, the same pose, the same camera position, the same street background and light. " +
  `Change only his clothing: he now wears ${outfit}. Keep the whole figure from head to shoes in frame. Photorealistic. No text, no logos.`;

const PRODUCT = (subject: string) =>
  `Studio product photograph of ${subject}, centered and fully in frame on a seamless warm-white background, ` +
  "soft diffused studio light with a gentle shadow beneath, sharp focus, photorealistic, high detail. No text, no logos, no hands, no people.";

const PLACE = (subject: string) =>
  `Architectural photograph of ${subject}, on a green countryside estate in the American West with mountains far behind, ` +
  "late afternoon golden light, eye-level wide shot, photorealistic, high detail. No people, no text, no signage.";

/** Decorations: close enough that the piece reads at thumbnail size, the estate soft behind it. */
const DECOR = (subject: string) =>
  `Close-up photograph of ${subject} on a countryside estate, the piece filling most of the frame and sharply in focus, ` +
  "green grounds and mountains softly blurred behind, late afternoon golden light, 50mm lens, photorealistic, high detail. No people, no text.";

/** The catalog stores each item's color as hex; the prompt needs a word for it. */
const COLOR_NAMES: [string, string][] = [
  ["black", "#141414"], ["charcoal", "#2e3236"], ["slate grey", "#4a4f57"], ["grey", "#6b6b70"], ["silver", "#adb5bd"],
  ["off-white", "#e8e4dc"], ["white", "#f4f4f2"], ["navy", "#1f2a44"], ["slate blue", "#3b4a5a"], ["blue", "#3a86ff"],
  ["pale blue", "#a8dadc"], ["teal", "#2ec4b6"], ["forest green", "#2f4f3e"], ["sage green", "#95d5b2"], ["deep red", "#8a0f1a"],
  ["burgundy", "#5a1a1f"], ["red", "#e63946"], ["pink", "#ff5d8f"], ["purple", "#7b2cbf"], ["dark brown", "#3a2414"],
  ["brown", "#6b4a32"], ["tan", "#a47148"], ["khaki", "#7a6a52"], ["copper", "#b87333"], ["brass", "#b08d57"],
  ["gold", "#d1aa55"], ["bright gold", "#ffd60a"], ["amber", "#ffb703"],
];
function colorName(hex: string) {
  const v = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = v(hex.toLowerCase());
  return COLOR_NAMES.reduce<[string, number]>((best, [name, h]) => {
    const [r2, g2, b2] = v(h);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    return d < best[1] ? [name, d] : best;
  }, ["", Infinity])[0];
}

function itemSubject(item: (typeof ITEMS)[number]) {
  if (item.kind === "decoration") return null;
  const detail = item.description.replace(/\.$/, "").toLowerCase();
  const color = colorName(item.color);
  if (item.kind === "component") return `a ${color} ${item.name.toLowerCase()} (${detail})`;
  const how = { outfit: "laid out flat, the whole garment visible", headwear: "shown on its own", handheld: "shown on its own", accessory: "shown on its own" }[item.slot!];
  return `a ${color} ${item.name.toLowerCase()}, ${how} (${detail})`;
}

const ESTATE_BASE: Record<string, string> = {
  residence: "a small weathered timber cottage with a stone chimney",
  office: "a simple folding desk and chair set up outdoors under a tree, with a laptop and a notebook on it",
  library: "a wooden crate of well-read books on the grass beside a low stone wall",
  gym: "a sturdy steel pull-up bar standing on a patch of packed dirt in a field",
  workshop: "a rough wooden tool bench with hand tools, standing beside a fence",
  gardens: "an overgrown wild lot of tall grass and wildflowers with a broken wooden fence",
};

// ——— Jobs ———

function jobs(): Job[] {
  const list: Job[] = [];
  for (const s of PHOTO_SKINS)
    for (const h of HAIR_STYLES)
      for (const o of BASE_OUTFITS) {
        const base = `char/${s.key}-${h.id}-tee`;
        const id = `char/${s.key}-${h.id}-${o.id}`;
        list.push({
          id,
          kind: "char",
          prompt: o.id === "tee" ? PERSON(s.prompt, PHOTO_HAIR[h.id], PHOTO_OUTFITS.tee) : REDRESS(PHOTO_OUTFITS[o.id]),
          reference: o.id === "tee" ? undefined : base,
          aspect: "3:4",
          size: [480, 640],
          quality: 72,
        });
      }

  for (const item of ITEMS) {
    const subject = itemSubject(item);
    list.push({
      id: `items/${item.id}`,
      kind: "items",
      prompt: subject ? PRODUCT(subject) : DECOR(`a ${colorName(item.color)} ${item.name.toLowerCase()} (${item.description.replace(/\.$/, "").toLowerCase()})`),
      aspect: "1:1",
      size: [360, 360],
      quality: 75,
    });
  }

  for (const area of AREAS) {
    list.push({ id: `estate/${area.id}-0`, kind: "estate", prompt: PLACE(ESTATE_BASE[area.id] ?? area.baseName), aspect: "4:3", size: [640, 480], quality: 72 });
    for (const t of area.tiers)
      list.push({ id: `estate/${area.id}-${t.tier}`, kind: "estate", prompt: PLACE(`a ${t.name.toLowerCase()}: ${t.preview.replace(/\.$/, "").toLowerCase()}`), aspect: "4:3", size: [640, 480], quality: 72 });
  }

  // The grounds, growing with level. Each stage edits the previous photograph.
  const features = new Map(LEVEL_UNLOCKS.filter((u) => u.estate).map((u) => [u.level, u.estate!]));
  ESTATE_STAGES.forEach((level, i) => {
    const prev = ESTATE_STAGES[i - 1];
    list.push({
      id: `estate/overview-${level}`,
      kind: "estate",
      prompt:
        i === 0
          ? "Wide elevated photograph of a modest countryside estate on a gentle green hill in the American West: a small timber cottage, a few small outbuildings, a meadow, and mountains in the distance. Late afternoon golden light, photorealistic, high detail. No people, no text."
          : `This is a photograph of an estate. Produce the same photograph from the same camera position, with everything kept as it is, and add one change: ${features.get(level)} Photorealistic. No people, no text.`,
      reference: i === 0 ? undefined : `estate/overview-${prev}`,
      aspect: "4:3",
      size: [1024, 768],
      quality: 72,
    });
  });
  return list;
}

// ——— Vertex AI ———

let token = "";
let tokenAt = 0;
function accessToken() {
  if (!token || Date.now() - tokenAt > 30 * 60_000) {
    token = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
    tokenAt = Date.now();
  }
  return token;
}

const rawPath = (id: string) => join(CACHE, `${id}.png`);
const outPath = (id: string) => join(OUT, `${id}.webp`);

async function generate(job: Job): Promise<Buffer> {
  const parts: object[] = [];
  if (job.reference) parts.push({ inlineData: { mimeType: "image/png", data: readFileSync(rawPath(job.reference)).toString("base64") } });
  parts.push({ text: job.prompt });
  for (let attempt = 1; ; attempt++) {
    const model = await pickModel();
    const url = `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: job.aspect } } }),
    }).catch((e: Error) => ({ ok: false, status: 0, text: async () => e.message }) as unknown as Response);
    if (res.ok) {
      const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[] };
      const data = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
      if (data) {
        usage.set(model, (usage.get(model) ?? 0) + 1);
        return Buffer.from(data, "base64");
      }
      if (attempt >= 6) throw new Error(`${job.id}: no image returned (${JSON.stringify(json).slice(0, 200)})`);
    } else if (res.status === 429) {
      restingUntil.set(model, Date.now() + 20_000);
      if (attempt >= 60) throw new Error(`${job.id}: still rate-limited after ${attempt} tries`);
    } else {
      const body = await res.text();
      if (attempt >= 6 || (res.status >= 400 && res.status < 500)) throw new Error(`${job.id}: HTTP ${res.status} ${body.slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
}

async function write(job: Job, png: Buffer) {
  mkdirSync(dirname(outPath(job.id)), { recursive: true });
  await sharp(png).resize(job.size[0], job.size[1], { fit: "cover", position: "attention" }).webp({ quality: job.quality }).toFile(outPath(job.id));
}

// ——— Run ———

// The demo's default person first, then everything that isn't a character, then everyone else.
const rank = (j: Job) => (j.id.startsWith(`char/s2-short-`) ? 0 : j.kind === "char" ? 2 : 1);
const all = jobs()
  .sort((a, b) => rank(a) - rank(b))
  .filter((j) => !args.only || j.kind === args.only || j.id.startsWith(args.only));
const todo = all.filter((j) => !existsSync(rawPath(j.id))).slice(0, args.limit ? Number(args.limit) : undefined);
console.log(`${all.length} images in scope, ${todo.length} to generate with ${MODELS.join(" → ")}.`);

const done = new Set(all.filter((j) => existsSync(rawPath(j.id))).map((j) => j.id));
const failed: string[] = [];
const queue = [...todo];
let finished = 0;

async function worker() {
  while (queue.length) {
    // Take the first job whose reference (if any) is ready; wait if none is.
    const index = queue.findIndex((j) => !j.reference || done.has(j.reference));
    if (index === -1) {
      if (queue.every((j) => j.reference && failed.includes(j.reference))) {
        failed.push(...queue.splice(0).map((j) => j.id));
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    const [job] = queue.splice(index, 1);
    if (job.reference && failed.includes(job.reference)) {
      failed.push(job.id);
      continue;
    }
    try {
      const png = await generate(job);
      mkdirSync(dirname(rawPath(job.id)), { recursive: true });
      writeFileSync(rawPath(job.id), png);
      await write(job, png);
      done.add(job.id);
    } catch (e) {
      failed.push(job.id);
      console.error(String(e));
    }
    finished++;
    if (finished % 10 === 0 || !queue.length) console.log(`${finished}/${todo.length}${failed.length ? ` (${failed.length} failed)` : ""}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// Rewrite WebPs for anything cached but missing from public (e.g. after changing sizes).
for (const job of all) if (existsSync(rawPath(job.id)) && !existsSync(outPath(job.id))) await write(job, readFileSync(rawPath(job.id)));

console.log(`Images per model: ${JSON.stringify(Object.fromEntries(usage))}`);
console.log(failed.length ? `Done with ${failed.length} failures: ${failed.join(", ")}` : "Done.");
if (failed.length) process.exitCode = 1;
