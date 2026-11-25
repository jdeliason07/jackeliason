"use client";

/**
 * Short, original sound effects synthesized with Web Audio (no audio files, nothing autoplays).
 * The AudioContext is created only after a user gesture; mute is remembered.
 */

export type Cue = "verify" | "chest" | "levelup" | "victory" | "tap" | "soft";

const MUTE_KEY = "earned-muted";
let ctx: AudioContext | null = null;

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // ignore
  }
}

/** Call from a click/tap handler so the browser allows audio. */
export function unlockAudio() {
  if (ctx || typeof window === "undefined") return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, gain: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.05);
}

export function play(cue: Cue) {
  if (isMuted() || !ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  switch (cue) {
    case "verify": // bright two-note chime
      tone(659.25, 0, 0.18, "triangle", 0.18);
      tone(987.77, 0.09, 0.28, "triangle", 0.16);
      break;
    case "chest": // shimmer
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.05, 0.22, "sine", 0.1));
      break;
    case "levelup": // ascending triad + octave
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.32, "square", 0.06));
      break;
    case "victory": // short fanfare
      tone(392, 0, 0.12, "sawtooth", 0.05);
      tone(392, 0.13, 0.12, "sawtooth", 0.05);
      tone(523.25, 0.26, 0.4, "sawtooth", 0.06);
      tone(659.25, 0.26, 0.4, "triangle", 0.08);
      break;
    case "tap":
      tone(880, 0, 0.06, "sine", 0.05);
      break;
    case "soft":
      tone(440, 0, 0.12, "sine", 0.05);
      break;
  }
}
