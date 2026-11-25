"use client";

import { APP_BASE_PATH } from "../config";
import { DEMO_OWNER, DEMO_STORAGE_KEY, demoClock, demoGame, seedDemo } from "../demo/seed";
import { GameError } from "../service/context";
import type { Command, Game } from "../service/game";
import type { AttemptResult } from "../service/verification";
import type { GameView } from "../service/view";
import { MemoryStore } from "../store/memory";

/**
 * The UI talks to one of two clients with the same shape:
 * - LiveClient: the authenticated server API (authoritative; nothing is decided in the browser).
 * - DemoClient: the same rules in the browser on synthetic data, saved to localStorage. Clearly
 *   labeled, never connected to an account, and its "verification" is a local stand-in, not AI.
 */

export type ViewResult =
  | { status: "ok"; view: GameView; photoVerification: boolean }
  | { status: "onboarding"; photoVerification: boolean }
  | { status: "signin" }
  | { status: "unconfigured"; missing: string[] };

export class ClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
    public details?: unknown,
  ) {
    super(message);
  }
  get offline() {
    return this.code === "offline";
  }
}

export interface Challenge {
  challengeId: string;
  token: string;
  expiresAt: string;
  criteria: string[];
}

export interface GameClient {
  mode: "live" | "demo";
  view(): Promise<ViewResult>;
  command<T = unknown>(command: Command, idempotencyKey: string): Promise<{ result: T; view: GameView | null; replayed: boolean }>;
  submitPhoto(challenge: Challenge, image: Blob): Promise<{ result: AttemptResult; view: GameView | null }>;
  retryPhoto(attemptId: string): Promise<{ result: AttemptResult; view: GameView | null }>;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${APP_BASE_PATH}/api/${path}`, { credentials: "same-origin", cache: "no-store", ...init });
  } catch {
    throw new ClientError("offline", "You're offline. Verified check-ins need a connection; nothing was submitted.");
  }
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string; details?: unknown } } | null;
  if (!res.ok) {
    throw new ClientError(body?.error?.code ?? "server_error", body?.error?.message ?? "Something went wrong. Try again.", res.status, body?.error?.details);
  }
  return body as T;
}

export class LiveClient implements GameClient {
  mode = "live" as const;

  async view(): Promise<ViewResult> {
    try {
      const body = await call<{ onboarded: boolean; view: GameView | null; photoVerification: boolean }>("view");
      return body.onboarded && body.view
        ? { status: "ok", view: body.view, photoVerification: body.photoVerification }
        : { status: "onboarding", photoVerification: body.photoVerification };
    } catch (error) {
      if (error instanceof ClientError && (error.status === 401 || error.status === 403)) return { status: "signin" };
      if (error instanceof ClientError && error.status === 503) {
        const status = await call<{ live: string[] }>("status").catch(() => ({ live: [] as string[] }));
        return { status: "unconfigured", missing: status.live };
      }
      throw error;
    }
  }

  command<T>(command: Command, idempotencyKey: string) {
    return call<{ result: T; view: GameView | null; replayed: boolean }>("command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, idempotencyKey }),
    });
  }

  submitPhoto(challenge: Challenge, image: Blob) {
    const form = new FormData();
    form.set("challengeId", challenge.challengeId);
    form.set("token", challenge.token);
    form.set("image", image, "capture.jpg");
    return call<{ result: AttemptResult; view: GameView | null }>("verify/photo", { method: "POST", body: form });
  }

  retryPhoto(attemptId: string) {
    return call<{ result: AttemptResult; view: GameView | null }>("verify/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId }),
    });
  }
}

function asClientError(error: unknown): never {
  if (error instanceof GameError) throw new ClientError(error.code, error.message, error.status, error.details);
  throw error;
}

interface DemoSave {
  version: 1;
  offsetMs: number;
  data: unknown;
}

export class DemoClient implements GameClient {
  mode = "demo" as const;
  private game: Game | null = null;
  private store: MemoryStore | null = null;
  private clock = demoClock(0);
  private loading: Promise<void> | null = null;

  private save() {
    if (!this.store) return;
    try {
      const payload: DemoSave = { version: 1, offsetMs: this.clock.offsetMs, data: this.store.export() };
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage full or blocked: the demo keeps working for this tab.
    }
  }

  private async ensure() {
    if (this.game) return;
    this.loading ??= (async () => {
      let saved: DemoSave | null = null;
      try {
        saved = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) ?? "null");
      } catch {
        saved = null;
      }
      if (saved?.version === 1) {
        this.store = new MemoryStore(saved.data);
        this.clock = demoClock(saved.offsetMs);
      } else {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Denver";
        this.store = await seedDemo(tz);
        this.clock = demoClock(0);
      }
      this.store.onCommit = () => this.save();
      this.game = demoGame(this.store, this.clock);
      this.save();
    })();
    await this.loading;
  }

  async view(): Promise<ViewResult> {
    await this.ensure();
    const view = await this.game!.view(DEMO_OWNER);
    return view ? { status: "ok", view, photoVerification: true } : { status: "onboarding", photoVerification: true };
  }

  async command<T>(command: Command, idempotencyKey: string) {
    await this.ensure();
    try {
      const res = await this.game!.command(DEMO_OWNER, command, idempotencyKey);
      const view = await this.game!.view(DEMO_OWNER);
      return { result: res.result as T, view, replayed: res.replayed };
    } catch (error) {
      asClientError(error);
    }
  }

  async submitPhoto(challenge: Challenge, image: Blob) {
    await this.ensure();
    try {
      const bytes = new Uint8Array(await image.arrayBuffer());
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      const begun = await this.game!.beginPhoto(DEMO_OWNER, {
        challengeId: challenge.challengeId,
        token: challenge.token,
        sha256,
        dhash: null,
        imagePath: null,
        demo: true,
      });
      let result: AttemptResult;
      if (begun.evaluate) {
        const brightness = await averageBrightness(image).catch(() => 128);
        const verdict =
          brightness < 18
            ? { outcome: "inconclusive" as const, reason: "Demo check: the photo is almost completely dark.", guidance: "Turn on a light or move closer to a window, then retake." }
            : { outcome: "accepted" as const, reason: "Demo check (not AI): accepted. Live mode sends the photo to the configured vision model.", guidance: null };
        result = await this.game!.resolvePhoto(DEMO_OWNER, begun.attempt.id, { kind: "verdict", verdict, provider: "demo", model: "demo-local" });
      } else {
        const a = begun.attempt;
        result = { attemptId: a.id, status: a.status, reason: a.reason, guidance: a.guidance, award: null };
      }
      return { result, view: await this.game!.view(DEMO_OWNER) };
    } catch (error) {
      asClientError(error);
    }
  }

  async retryPhoto(attemptId: string) {
    await this.ensure();
    const view = await this.game!.view(DEMO_OWNER);
    return { result: { attemptId, status: "unavailable" as const, reason: "Nothing to retry in the demo.", guidance: null, award: null }, view };
  }

  /** Demo-only time travel, to see windows close, misses, and recovery. */
  async advance(hours: number) {
    await this.ensure();
    this.clock.offsetMs += hours * 3_600_000;
    this.save();
  }

  get offsetMs() {
    return this.clock.offsetMs;
  }

  reset() {
    try {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {
      // ignore
    }
    this.game = null;
    this.store = null;
    this.loading = null;
  }
}

async function averageBrightness(image: Blob): Promise<number> {
  const bitmap = await createImageBitmap(image);
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, 24, 24);
  const { data } = ctx.getImageData(0, 0, 24, 24);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return sum / (data.length / 4);
}

export const MODE_KEY = "earned-mode";
export const VIEW_CACHE_KEY = "earned-view-cache-v1";

export function storedMode(): "live" | "demo" {
  try {
    return localStorage.getItem(MODE_KEY) === "demo" ? "demo" : "live";
  } catch {
    return "live";
  }
}

export function setStoredMode(mode: "live" | "demo") {
  try {
    if (mode === "demo") localStorage.setItem(MODE_KEY, "demo");
    else localStorage.removeItem(MODE_KEY);
  } catch {
    // ignore
  }
}

/** Clears every piece of user-specific local state (on sign-out). */
export function clearLocalState() {
  try {
    localStorage.removeItem(VIEW_CACHE_KEY);
    localStorage.removeItem(MODE_KEY);
  } catch {
    // ignore
  }
}

export function newKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
