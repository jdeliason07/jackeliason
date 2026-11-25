"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  type Challenge,
  clearLocalState,
  ClientError,
  DemoClient,
  type GameClient,
  LiveClient,
  newKey,
  setStoredMode,
  storedMode,
  VIEW_CACHE_KEY,
} from "@/lib/meros/client/client";
import { type Cue, isMuted, play, setMuted, unlockAudio } from "@/lib/meros/client/sound";
import { useBrowserValue } from "./useBrowserValue";
import { APP_BASE_PATH } from "@/lib/meros/config";
import type { Command } from "@/lib/meros/service/game";
import type { AttemptResult } from "@/lib/meros/service/verification";
import type { GameView } from "@/lib/meros/service/view";

export type Status = "loading" | "ok" | "onboarding" | "signin" | "unconfigured" | "error";

export interface Celebration {
  id: string;
  kind: "verify" | "chest" | "levelup" | "victory" | "info";
  title: string;
  lines: string[];
  levels?: number[];
}

interface GameContextValue {
  mode: "live" | "demo";
  status: Status;
  view: GameView | null;
  photoVerification: boolean;
  missing: string[];
  error: string | null;
  stale: { savedAt: string } | null;
  online: boolean;
  refresh(): Promise<void>;
  run<T = unknown>(command: Command, key: string): Promise<T>;
  submitPhoto(challenge: Challenge, image: Blob): Promise<AttemptResult>;
  retryPhoto(attemptId: string): Promise<AttemptResult>;
  enterDemo(): void;
  exitDemo(): void;
  signOut(): Promise<void>;
  advanceDemo(hours: number): Promise<void>;
  resetDemo(): Promise<void>;
  celebrations: Celebration[];
  celebrate(c: Omit<Celebration, "id">, cue?: Cue): void;
  dismiss(id: string): void;
  muted: boolean;
  setMute(m: boolean): void;
  reducedMotion: boolean;
  setReducedMotion(r: boolean): void;
  sound(cue: Cue): void;
}

const GameContext = createContext<GameContextValue | null>(null);

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame outside GameProvider");
  return ctx;
}

function readCache(): { savedAt: string; view: GameView } | null {
  try {
    const raw = localStorage.getItem(VIEW_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(view: GameView) {
  try {
    localStorage.setItem(VIEW_CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), view }));
  } catch {
    // ignore
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [modeState, setMode] = useState<"live" | "demo" | null>(null);
  const mode = modeState ?? "live";
  const clientRef = useRef<GameClient | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [view, setView] = useState<GameView | null>(null);
  const [photoVerification, setPhotoVerification] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<{ savedAt: string } | null>(null);
  const online = useBrowserValue(() => navigator.onLine, true, subscribeOnline);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [muted, setMutedState] = useState(false);
  const [reducedMotion, setReducedMotionState] = useState(false);

  const client = useCallback(() => {
    if (!clientRef.current) clientRef.current = mode === "demo" ? new DemoClient() : new LiveClient();
    return clientRef.current;
  }, [mode]);

  const applyView = useCallback(
    (v: GameView | null) => {
      if (!v) return;
      setView(v);
      setStale(null);
      setStatus("ok");
      if (v.mode === "live") writeCache(v);
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const result = await client().view();
      setError(null);
      if (result.status === "ok") {
        setPhotoVerification(result.photoVerification);
        applyView(result.view);
      } else if (result.status === "onboarding") {
        setPhotoVerification(result.photoVerification);
        setStatus("onboarding");
      } else if (result.status === "unconfigured") {
        setMissing(result.missing);
        setStatus("unconfigured");
      } else {
        setStatus("signin");
      }
    } catch (e) {
      const cached = client().mode === "live" ? readCache() : null;
      if (cached && e instanceof ClientError && e.offline) {
        setView(cached.view);
        setStale({ savedAt: cached.savedAt });
        setStatus("ok");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't load.");
        setStatus((s) => (s === "ok" ? "ok" : "error"));
      }
    }
  }, [client, applyView]);

  // Browser-only preferences can't be known during prerendering, so they're read once after mount.
  useEffect(() => {
    let reduce = false;
    try {
      reduce = localStorage.getItem("meros-motion") === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      // ignore
    }
    clientRef.current = null;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage after mount */
    setMutedState(isMuted());
    setReducedMotionState(reduce);
    setMode(storedMode());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!modeState) return;
    clientRef.current = null;
    // Loading data from the server/demo store: state updates happen after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [modeState, refresh]);

  useEffect(() => {
    const update = () => {
      if (navigator.onLine && clientRef.current) void refresh(); // back online: replace any stale view
    };
    window.addEventListener("online", update);
    const onVisible = () => {
      if (document.visibilityState === "visible" && clientRef.current) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Unlock audio on the first user gesture only (never autoplay).
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const sound = useCallback((cue: Cue) => play(cue), []);

  const celebrate = useCallback((c: Omit<Celebration, "id">, cue?: Cue) => {
    const id = newKey();
    setCelebrations((list) => [...list.filter((x) => x.kind !== c.kind || c.kind === "info").slice(-2), { ...c, id }]);
    if (cue) play(cue);
  }, []);

  const dismiss = useCallback((id: string) => setCelebrations((list) => list.filter((c) => c.id !== id)), []);

  const run = useCallback(
    async <T,>(command: Command, key: string): Promise<T> => {
      if (stale || (!navigator.onLine && client().mode === "live")) {
        throw new ClientError("offline", "You're offline. Actions need a connection; nothing was submitted.");
      }
      const res = await client().command<T>(command, key);
      if (res.view) applyView(res.view);
      return res.result;
    },
    [client, applyView, stale],
  );

  const submitPhoto = useCallback(
    async (challenge: Challenge, image: Blob) => {
      const res = await client().submitPhoto(challenge, image);
      if (res.view) applyView(res.view);
      return res.result;
    },
    [client, applyView],
  );

  const retryPhoto = useCallback(
    async (attemptId: string) => {
      const res = await client().retryPhoto(attemptId);
      if (res.view) applyView(res.view);
      return res.result;
    },
    [client, applyView],
  );

  const enterDemo = useCallback(() => {
    setStoredMode("demo");
    clientRef.current = null;
    setView(null);
    setStatus("loading");
    setMode("demo");
  }, []);

  const exitDemo = useCallback(() => {
    setStoredMode("live");
    clientRef.current = null;
    setView(null);
    setStatus("loading");
    setMode("live");
  }, []);

  const signOut = useCallback(async () => {
    await fetch(`${APP_BASE_PATH}/api/auth/signout`, { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    clearLocalState();
    setView(null);
    setStatus("signin");
  }, []);

  const advanceDemo = useCallback(
    async (hours: number) => {
      const c = client();
      if (c instanceof DemoClient) {
        await c.advance(hours);
        await refresh();
      }
    },
    [client, refresh],
  );

  const resetDemo = useCallback(async () => {
    const c = client();
    if (c instanceof DemoClient) {
      c.reset();
      setStatus("loading");
      await refresh();
    }
  }, [client, refresh]);

  const setMute = useCallback((m: boolean) => {
    setMuted(m);
    setMutedState(m);
  }, []);

  const setReducedMotion = useCallback((r: boolean) => {
    try {
      if (r) localStorage.setItem("meros-motion", "reduce");
      else localStorage.removeItem("meros-motion");
    } catch {
      // ignore
    }
    if (r) document.documentElement.setAttribute("data-motion", "reduce");
    else document.documentElement.removeAttribute("data-motion");
    setReducedMotionState(r);
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      mode,
      status,
      view,
      photoVerification,
      missing,
      error,
      stale,
      online,
      refresh,
      run,
      submitPhoto,
      retryPhoto,
      enterDemo,
      exitDemo,
      signOut,
      advanceDemo,
      resetDemo,
      celebrations,
      celebrate,
      dismiss,
      muted,
      setMute,
      reducedMotion,
      setReducedMotion,
      sound,
    }),
    [mode, status, view, photoVerification, missing, error, stale, online, refresh, run, submitPhoto, retryPhoto, enterDemo, exitDemo, signOut, advanceDemo, resetDemo, celebrations, celebrate, dismiss, muted, setMute, reducedMotion, setReducedMotion, sound],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/**
 * One logical user action with a stable idempotency key: double taps are ignored while pending,
 * and a retry after a network failure reuses the same key so the server never applies it twice.
 */
export function useAction<T = unknown>() {
  const { run } = useGame();
  const keyRef = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);

  const execute = useCallback(
    async (command: Command): Promise<T | undefined> => {
      if (pending) return undefined;
      keyRef.current ??= newKey();
      setPending(true);
      setError(null);
      try {
        const result = await run<T>(command, keyRef.current);
        keyRef.current = null;
        return result;
      } catch (e) {
        const err = e instanceof ClientError ? e : new ClientError("server_error", e instanceof Error ? e.message : "Failed.");
        // Keep the key for network failures (retry is safe); drop it for definitive refusals.
        if (!err.offline && err.status !== 0 && err.status < 500) keyRef.current = null;
        setError(err);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [run, pending],
  );

  return { execute, pending, error, clearError: () => setError(null) };
}
