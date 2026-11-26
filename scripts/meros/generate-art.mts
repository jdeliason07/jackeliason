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
 * Characters and the chest are only cached here; scripts/meros/cutout.py turns them into sprites.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { BASE_OUTFITS, HAIR_STYLES } from "../../lib/meros/content/appearance";
import { PHOTO_HAIR, PHOTO_OUTFITS, PHOTO_SKINS } from "../../lib/meros/content/art";
import { AREAS } from "../../lib/meros/content/estate";
import { CITY_STAGES, HOMES } from "../../lib/meros/content/home";
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

type Kind = "char" | "items" | "estate" | "scene";
interface Job {
  id: string; // also the output path under OUT, without extension
  kind: Kind;
  prompt: string;
  aspect: "3:4" | "1:1" | "4:3" | "9:16";
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

/** The other buildings, set in the same modest neighborhood as the city view; higher tiers simply look nicer. */
const PLACE = (subject: string, tier: number) =>
  `Photograph of ${subject}, in a modest, growing neighborhood at the edge of a mid-sized American city, ` +
  ["plain and a little worn, soft overcast light", "clean and simple, soft daylight", "well designed and inviting, warm afternoon light", "beautiful, high-end, and impressive, golden-hour light"][tier] +
  ", eye-level wide shot, photorealistic, high detail. No people, no readable text, no logos.";

/** Decorations: close enough that the piece reads at thumbnail size, the estate soft behind it. */
const DECOR = (subject: string) =>
  `Close-up photograph of ${subject} on a modern Manhattan rooftop terrace, the piece filling most of the frame and sharply in focus, ` +
  "the city skyline softly blurred behind, late-afternoon light, 50mm lens, photorealistic, high detail. No people, no readable text, no logos.";

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

/** Items whose name alone draws the wrong thing. */
const ITEM_OVERRIDE: Record<string, string> = {
  "head-laurel": "a pair of polished gold wireless earbuds resting beside their open white charging case",
};

function itemSubject(item: (typeof ITEMS)[number]) {
  if (ITEM_OVERRIDE[item.id]) return ITEM_OVERRIDE[item.id];
  if (item.kind === "decoration") return null;
  const detail = item.description.replace(/\.$/, "").toLowerCase();
  const color = colorName(item.color);
  if (item.kind === "component") return `a ${color} ${item.name.toLowerCase()} (${detail})`;
  const how = { outfit: "laid out flat, the whole garment visible", headwear: "shown on its own", handheld: "shown on its own", accessory: "shown on its own" }[item.slot!];
  return `a ${color} ${item.name.toLowerCase()}, ${how} (${detail})`;
}

const ESTATE_BASE: Record<string, string> = {
  office: "a small table by the window of a plain neighborhood coffee shop, with a laptop and a paper cup",
  library: "a small stack of library books on a cheap desk by a window",
  gym: "a pull-up bar mounted in a plain apartment doorway, an old yoga mat rolled beneath it",
  workshop: "a sturdy old workbench with a few hand tools in a cluttered one-car garage",
  gardens: "a bare gravel rooftop on a low brick building with a single plastic chair, open fields and a small distant skyline beyond",
};

// ——— The world: a wide view with room to grow, and the homes you move through ———

/** Stage one: seen from high up, a small, plain neighborhood with a lot of open land around it. */
const CITY_BASE =
  "High aerial photograph looking steeply down over a modest, slightly worn neighborhood at the far edge of a city, soft late-afternoon light, vertical frame, " +
  "taken from high up so a wide area is visible and everything looks small. In the middle third of the frame, a small loose cluster of plain low buildings along one quiet two-lane road: " +
  "an aging three-story brick apartment building, a one-story gym in a converted garage, a small brick public library, a plain two-story office building with a small parking lot, " +
  "a corrugated-metal garage workshop, and a little building with a flat roof. Around the cluster, lots of empty space: gravel lots, chain-link fences, patchy grass fields, dirt tracks, a few bare trees. " +
  "A small river curves along the lower left. The downtown skyline is tiny and far away on the horizon at the very top. Mostly open, undeveloped land with room to build. " +
  "Photorealistic, high detail, natural colors. No readable text, no logos.";

/** Each stage adds one thing to the previous photograph (and the in-app unlock text says the same). */
const CITY_GROWTH: Record<number, string> = {
  3: "new sidewalks and a row of young street trees line the road, and a small corner market now stands on one of the empty gravel lots.",
  5: "a new five-story apartment building with balconies now stands on one of the empty lots near the cluster, and the road has fresh asphalt and a bike lane.",
  7: "the patchy grass field beside the cluster is now a green park with walking paths, trees, and a small playground.",
  10: "a modern glass office building now rises on the large empty lot across the road, and a few new houses appear along a new side street.",
  15: "most of the remaining empty lots are now filled with new mid-rise buildings, shops, and homes, and a promenade with trees runs along the river.",
  20: "a few new glass towers now rise at the edge of the neighborhood, and the area is a lively, finished part of the city that reaches toward the skyline.",
};

const HOME_EXTERIOR: string[] = [
  "an aging three-story brick row building on a plain street, its basement windows at sidewalk level and a worn metal stair leading down to a basement door",
  "a narrow five-story brick walk-up apartment building with a black fire escape on a quiet street",
  "a clean modern ten-story apartment building with glass balconies on a tree-lined street",
  "a slender glass residential tower rising above the neighborhood, seen from the street",
  "a modern two-story family house with a wide green lawn, a large tree, and a driveway, on a quiet residential street",
];

/** Each home, empty on move-in day. Open floor space left and right: the character and the desk stand there. */
const HOME_ROOM: string[] = [
  "a small rented basement room: low ceiling, one small window high on the wall at street level, bare concrete floor, plain scuffed white walls, a single bare bulb, completely empty",
  "an empty studio apartment on the third floor of an old walk-up: worn wood floor, one tall window, a tiny kitchenette along the back wall, an old radiator, no furniture",
  "an empty one-bedroom apartment on the 8th floor of a newer building: an open living room with a wide window over a neighborhood, light oak floor, an open kitchen, the bedroom door ajar, no furniture",
  "an empty large two-bedroom apartment high in a glass tower: floor-to-ceiling windows over the city far below, pale stone floor, a long open kitchen, no furniture",
  "the empty living room of a new modern family house: high ceiling, big windows onto a green back yard with a tree, wide plank wood floors, a fireplace, no furniture",
];

/** The three furnishing steps, sized to each home. */
const FURNISH: [string, string, string][] = [
  ["a mattress on a simple low frame with a grey blanket, a small clip-on lamp, and a folding table with one chair", "a small rug, a cheap bookshelf with a few books, and a potted plant", "a framed print on the wall, warm string lights, a better chair, and a neat blanket and pillows on the bed"],
  ["a bed with a simple wooden frame, a small dining table with two chairs, and a floor lamp", "a soft rug, a bookshelf full of books, two potted plants, and curtains on the window", "framed art on the walls, warm layered lighting, a comfortable armchair, and a few tasteful objects"],
  ["a sofa, a coffee table, a dining table with four chairs, and simple lighting", "a large soft rug, full bookshelves, several big plants, and linen curtains", "a gallery wall of framed art, designer pendant lights, a leather armchair, and styled shelves"],
  ["a large modern sofa, a dining table for six, and pendant lights", "a big wool rug, a long shelving wall with books, tall indoor trees, and sheer curtains", "large-scale art, a sculptural lounge chair, warm architectural lighting, and a few beautiful objects"],
  ["a big comfortable sofa, a long dining table, and a rug in front of the fireplace", "full bookshelves, large plants, curtains, and a reading chair by the window", "framed art over the fireplace, warm lamps throughout, a fine armchair, and family photos on the shelves"],
];

const EDIT_ROOM = (add: string) =>
  "This is a photograph of a room. Produce the same photograph from exactly the same camera position, keeping the room, walls, windows, floor, light, and everything already in it exactly as they are. " +
  `Add only: ${add}. Keep open floor space on the left and on the right. Photorealistic. No people, no readable text, no logos.`;

function worldJobs(): Job[] {
  const list: Job[] = [];
  CITY_STAGES.forEach((level, i) => {
    const prev = CITY_STAGES[i - 1];
    list.push({
      id: `city/stage-${level}`,
      kind: "estate",
      prompt:
        i === 0
          ? CITY_BASE
          : `This is a high aerial photograph of a neighborhood. Produce the same photograph from exactly the same camera position and height, keeping every existing building, road, and the river exactly where they are, and add one change: ${CITY_GROWTH[level]} Photorealistic. No readable text, no logos.`,
      reference: i === 0 ? undefined : `city/stage-${prev}`,
      aspect: "9:16",
      size: [720, 1280],
      quality: 70,
    });
  });
  HOMES.forEach((h) => {
    list.push({
      id: `home/exterior-${h.tier}`,
      kind: "estate",
      prompt: `Eye-level photograph of ${HOME_EXTERIOR[h.tier]}, soft late-afternoon light, wide shot, photorealistic, high detail. No people, no readable text, no logos.`,
      aspect: "4:3",
      size: [640, 480],
      quality: 72,
    });
    list.push({
      id: `home/interior-${h.tier}-0`,
      kind: "scene",
      prompt:
        `Interior photograph of ${HOME_ROOM[h.tier]}. Eye-level, wide 24mm lens, the floor visible in the lower third, open floor space on the left and on the right. ` +
        "Natural light, photorealistic, high detail. No people, no readable text, no logos.",
      aspect: "9:16",
      size: [720, 1280],
      quality: 70,
    });
    FURNISH[h.tier].forEach((add, i) =>
      list.push({ id: `home/interior-${h.tier}-${i + 1}`, kind: "scene", prompt: EDIT_ROOM(add), reference: `home/interior-${h.tier}-${i}`, aspect: "9:16", size: [720, 1280], quality: 70 }),
    );
  });
  return list;
}

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

  for (const area of AREAS.filter((a) => a.id !== "residence")) {
    list.push({ id: `estate/${area.id}-0`, kind: "estate", prompt: PLACE(ESTATE_BASE[area.id] ?? area.baseName, 0), aspect: "4:3", size: [640, 480], quality: 72 });
    for (const t of area.tiers)
      list.push({ id: `estate/${area.id}-${t.tier}`, kind: "estate", prompt: PLACE(`a ${t.name.toLowerCase()}: ${t.preview.replace(/\.$/, "").toLowerCase()}`, t.tier), aspect: "4:3", size: [640, 480], quality: 72 });
  }

  // The street behind the character, empty, taken from the default person's photo so the light matches.
  list.push({
    id: "scene/street",
    kind: "scene",
    prompt:
      "This is a photograph of a man on a city street. Produce the same photograph from the same camera position with the man removed completely: " +
      "only the empty street, the planters, and the storefronts, with the pavement continuing naturally where he stood. Photorealistic. No text, no logos.",
    reference: "char/s2-short-tee",
    aspect: "3:4",
    size: [600, 800],
    quality: 70,
  });

  // The chest: a modern hard case, closed and open, on pure white so it can be cut out.
  for (const [id, state] of [
    ["sprite/chest", "closed, latches shut"],
    ["sprite/chest-open", "lid open wide, glowing warm white light pouring out of the empty interior"],
  ] as const)
    list.push({
      id,
      kind: "scene",
      prompt:
        `Studio product photograph of a sleek deep-red hard-shell equipment case with brushed steel latches and corners, ${state}, three-quarter view from slightly above, ` +
        "centered, on a seamless pure white background, soft even light, photorealistic, high detail. No text, no logos.",
      aspect: "1:1",
      size: [640, 640],
      quality: 80,
    });

  // The quest symbol inside the home: a desk you walk up to for the day's work.
  list.push({
    id: "sprite/quest-desk",
    kind: "scene",
    prompt:
      "Studio product photograph of a modern walnut standing desk with slim black steel legs, a glowing tablet propped on it showing an abstract red checklist, " +
      "and a deep-red notebook beside it, three-quarter view from slightly above, centered, on a seamless pure white background, soft even light, photorealistic. No readable text, no logos.",
    aspect: "1:1",
    size: [640, 640],
    quality: 80,
  });

  return list;
}

// ——— Vertex AI ———

let token = "";
let tokenAt = 0;
function accessToken() {
  if (!token || Date.now() - tokenAt > 20 * 60_000) {
    token = execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
    tokenAt = Date.now();
  }
  return token;
}

const rawPath = (id: string) => join(CACHE, `${id}.png`);
const outPath = (id: string) => join(OUT, `${id}.webp`);

/**
 * The reference photo for an edit. Normally the cached original; on a fresh machine without the cache,
 * a person's photo is rebuilt from the committed cut-out standing on the committed street plate, so
 * new outfits keep the same face as the ones already made.
 */
async function referencePng(id: string): Promise<Buffer> {
  if (existsSync(rawPath(id))) return readFileSync(rawPath(id));
  const cut = outPath(id);
  const street = join(OUT, "scene", "street.webp");
  if (id.startsWith("char/") && existsSync(cut) && existsSync(street)) {
    const size = { width: 896, height: 1200 };
    const person = await sharp(cut).resize(size.width, size.height, { fit: "contain", position: "bottom", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    return sharp(street).resize(size.width, size.height, { fit: "cover" }).composite([{ input: person }]).png().toBuffer();
  }
  if (existsSync(outPath(id))) return sharp(outPath(id)).png().toBuffer();
  throw new Error(`no reference image for ${id}`);
}

async function generate(job: Job): Promise<Buffer> {
  const parts: object[] = [];
  if (job.reference) parts.push({ inlineData: { mimeType: "image/png", data: (await referencePng(job.reference)).toString("base64") } });
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
    } else if (res.status === 401) {
      token = ""; // expired: fetch a fresh one and try again
      if (attempt >= 6) throw new Error(`${job.id}: HTTP 401 after refreshing the token`);
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

/** Characters and the chest become cut-out sprites (scripts/meros/cutout.py); everything else is written here. */
const SPRITE = (id: string) => id.startsWith("char/") || id.startsWith("sprite/");

async function write(job: Job, png: Buffer) {
  if (SPRITE(job.id)) return;
  mkdirSync(dirname(outPath(job.id)), { recursive: true });
  await sharp(png).resize(job.size[0], job.size[1], { fit: "cover", position: "attention" }).webp({ quality: job.quality }).toFile(outPath(job.id));
}

// ——— Run ———

// The demo's default person first, then everything that isn't a character, then everyone else.
const rank = (j: Job) => (j.id.startsWith(`char/s2-short-`) ? 0 : j.kind === "char" ? 2 : 1);
const all = [...jobs(), ...worldJobs()]
  .sort((a, b) => rank(a) - rank(b))
  .filter((j) => !args.only || j.kind === args.only || j.id.startsWith(args.only));
const todo = all.filter((j) => !existsSync(rawPath(j.id)) && !existsSync(outPath(j.id))).slice(0, args.limit ? Number(args.limit) : undefined);
console.log(`${all.length} images in scope, ${todo.length} to generate with ${MODELS.join(" → ")}.`);

const done = new Set(all.filter((j) => existsSync(rawPath(j.id)) || existsSync(outPath(j.id))).map((j) => j.id));
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
for (const job of all) if (!SPRITE(job.id) && existsSync(rawPath(job.id)) && !existsSync(outPath(job.id))) await write(job, readFileSync(rawPath(job.id)));

console.log(`Images per model: ${JSON.stringify(Object.fromEntries(usage))}`);
console.log(failed.length ? `Done with ${failed.length} failures: ${failed.join(", ")}` : "Done.");
if (failed.length) process.exitCode = 1;
