"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { type Challenge, ClientError, newKey } from "@/lib/meros/client/client";
import type { AttemptResult } from "@/lib/meros/service/verification";
import type { DueView } from "@/lib/meros/service/view";
import { celebrateAward } from "./awards";
import { PLACE_OF } from "@/lib/meros/content/places";
import EarningPrompt from "./EarningPrompt";
import { useGame } from "./GameProvider";
import { Icon, Note, Sheet, Spinner } from "./ui";

type Phase =
  | { name: "intro" }
  | { name: "starting" }
  | { name: "live" }
  | { name: "preview"; blob: Blob; url: string }
  | { name: "submitting" }
  | { name: "result"; result: AttemptResult }
  | { name: "error"; message: string; hint?: string };

/**
 * Check-in for one occurrence. Photo: a short-lived server challenge, the live camera (switchable),
 * preview and retake, then server-side checking. There is deliberately no gallery upload. GPS: a
 * fresh high-accuracy reading sent to the server, which does the distance math.
 */
export default function VerifySheet({ due, onClose }: { due: DueView; onClose: () => void }) {
  const game = useGame();
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const challengeRef = useRef<Challenge | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const gpsKey = useRef<string | null>(null);
  const challengeKey = useRef<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Attach the live stream once the <video> element has mounted.
  useEffect(() => {
    if (phase.name === "live" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [phase.name]);

  const close = () => {
    stopCamera();
    onClose();
  };

  const finish = (result: AttemptResult) => {
    stopCamera();
    setPhase({ name: "result", result });
    if (result.status === "accepted" && result.award) celebrateAward(game.celebrate, result.award, due.title);
    else if (result.status !== "accepted") game.sound("soft");
  };

  async function freshChallenge(): Promise<Challenge> {
    const c = challengeRef.current;
    if (c && Date.parse(c.expiresAt) - Date.now() > 30_000) return c;
    challengeKey.current = newKey();
    const res = await game.run<Challenge>({ type: "issueChallenge", occurrenceId: due.occurrenceId }, challengeKey.current);
    challengeRef.current = res;
    return res;
  }

  async function startCamera(nextFacing = facing) {
    setPhase({ name: "starting" });
    try {
      await freshChallenge();
    } catch (e) {
      setPhase({ name: "error", message: e instanceof ClientError ? e.message : "Couldn't start a check-in." });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase({ name: "error", message: "This browser can't open the camera.", hint: "Open Meros in Safari on iPhone (or a current browser) over HTTPS." });
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase({ name: "live" });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setPhase({
        name: "error",
        message:
          name === "NotAllowedError"
            ? "Camera permission is off for this site."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera was found on this device."
              : "The camera couldn't start.",
        hint:
          name === "NotAllowedError"
            ? "iPhone: Settings → Safari → Camera → Allow, then try again."
            : "Close other apps using the camera and try again.",
      });
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopCamera();
        setPhase({ name: "preview", blob, url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      0.86,
    );
  }

  /** Demo only: a generated test card stands in for a camera on desktops without one. */
  async function demoTestCard() {
    await freshChallenge().catch(() => undefined);
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 720;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFF1C9";
    ctx.fillRect(0, 0, 960, 720);
    ctx.fillStyle = "#2D3A8C";
    ctx.font = "bold 44px system-ui";
    ctx.fillText("DEMO TEST CARD", 60, 110);
    ctx.font = "32px system-ui";
    ctx.fillText(due.title, 60, 180);
    ctx.fillText(new Date().toLocaleString(), 60, 230);
    ctx.fillStyle = `hsl(${Math.floor(Math.random() * 360)} 70% 60%)`;
    ctx.beginPath();
    ctx.arc(720, 470, 150, 0, Math.PI * 2);
    ctx.fill();
    canvas.toBlob((blob) => blob && setPhase({ name: "preview", blob, url: URL.createObjectURL(blob) }), "image/jpeg", 0.9);
  }

  async function submit(blob: Blob) {
    setPhase({ name: "submitting" });
    try {
      const challenge = await freshChallenge();
      const result = await game.submitPhoto(challenge, blob);
      challengeRef.current = null;
      finish(result);
    } catch (e) {
      if (e instanceof ClientError && e.code === "challenge_invalid") challengeRef.current = null;
      setPhase({ name: "error", message: e instanceof Error ? e.message : "Couldn't submit.", hint: e instanceof ClientError && e.offline ? "Nothing was submitted. Try again when you're online." : undefined });
    }
  }

  async function retry(attemptId: string) {
    setPhase({ name: "submitting" });
    try {
      finish(await game.retryPhoto(attemptId));
    } catch (e) {
      setPhase({ name: "error", message: e instanceof Error ? e.message : "Retry failed." });
    }
  }

  async function checkGps(simulate = false) {
    setPhase({ name: "starting" });
    const send = async (reading: { lat: number; lng: number; accuracyM: number; timestamp: number }) => {
      gpsKey.current ??= newKey();
      try {
        const result = await game.run<AttemptResult>({ type: "submitGps", occurrenceId: due.occurrenceId, reading }, gpsKey.current);
        gpsKey.current = null;
        finish(result);
      } catch (e) {
        if (!(e instanceof ClientError && e.offline)) gpsKey.current = null;
        setPhase({ name: "error", message: e instanceof Error ? e.message : "Couldn't check in." });
      }
    };
    if (simulate) {
      // Demo: arrive at the building's saved spot (where tasks created there point), else the demo gym.
      const spot = game.view?.profile.places[PLACE_OF[due.category]];
      await send({ lat: spot?.lat ?? 40.2338, lng: spot?.lng ?? -111.6585, accuracyM: 12, timestamp: Date.now() });
      return;
    }
    if (!("geolocation" in navigator)) {
      setPhase({ name: "error", message: "This browser can't read your location." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => void send({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy, timestamp: pos.timestamp }),
      (err) =>
        setPhase({
          name: "error",
          message: err.code === err.PERMISSION_DENIED ? "Location permission is off for this site." : err.code === err.TIMEOUT ? "Getting a location fix took too long." : "Your location isn't available right now.",
          hint:
            err.code === err.PERMISSION_DENIED
              ? "iPhone: Settings → Privacy & Security → Location Services → Safari Websites → While Using, Precise on."
              : "Step near a window or outside and try again.",
        }),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  return (
    <Sheet open onClose={close} title={due.mode === "photo" ? "Snap it" : "Check in"}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-display text-xl leading-tight">{due.title}</p>
          <p className="mt-1 text-[0.9375rem] font-normal">{due.minimumAction}</p>
        </div>

        {phase.name === "intro" && due.mode === "photo" && (
          <>
            <ul className="m-list flex flex-col gap-1.5" aria-label="The photo shows">
              {due.criteria.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[0.9375rem]">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" /> {c}
                </li>
              ))}
            </ul>
            <p className="hint inline-flex items-center gap-1.5">
              <Icon name="lock" className="h-4 w-4" />
              {game.mode === "demo" ? "Demo: stays in this browser." : `Private · AI-checked · deleted in ${game.view?.retentionDays ?? 7} days`}
            </p>
            {!game.photoVerification && game.mode === "live" && <Note tone="warn">Photo checking isn’t set up yet. Nothing counts against you.</Note>}
            <button className="btn btn-hero w-full" onClick={() => void startCamera()} disabled={!game.photoVerification && game.mode === "live"}>
              <Icon name="camera" /> Open camera
            </button>
            {game.mode === "demo" && (
              <button className="btn btn-secondary w-full" onClick={() => void demoTestCard()}>
                Demo test card
              </button>
            )}
          </>
        )}

        {phase.name === "intro" && due.mode === "gps" && (
          <>
            <p className="flex items-center gap-2 font-display text-lg">
              <Icon name="pin" /> {due.gpsLabel ?? "Saved spot"}
            </p>
            <button className="btn btn-hero w-full" onClick={() => void checkGps()}>
              <Icon name="pin" /> I’m here
            </button>
            {game.mode === "demo" && (
              <button className="btn btn-secondary w-full" onClick={() => void checkGps(true)}>
                Demo: simulate arriving
              </button>
            )}
          </>
        )}

        {phase.name === "starting" && (
          <div className="grid place-items-center py-10">
            <Spinner label={due.mode === "gps" ? "Locating…" : "Camera…"} />
          </div>
        )}

        {phase.name === "live" && (
          <div className="flex flex-col gap-3">
            <div className="relative overflow-hidden rounded-3xl bg-blood">
              <video ref={videoRef} playsInline muted autoPlay className="aspect-[3/4] w-full object-cover" aria-label="Camera preview" />
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-3">
              <button
                className="btn btn-secondary w-14 px-0"
                aria-label="Switch camera"
                onClick={() => {
                  const next = facing === "environment" ? "user" : "environment";
                  setFacing(next);
                  void startCamera(next);
                }}
              >
                <Icon name="flip" />
              </button>
              <button className="btn btn-hero" onClick={capture} aria-label="Take photo">
                <Icon name="camera" className="h-7 w-7" />
              </button>
            </div>
          </div>
        )}

        {phase.name === "preview" && (
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={phase.url} alt="Your photo, ready to submit" className="aspect-[3/4] w-full rounded-3xl object-cover" />
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-secondary" onClick={() => void startCamera()}>
                Retake
              </button>
              <button className="btn btn-hero" onClick={() => void submit(phase.blob)}>
                <Icon name="check" /> Send
              </button>
            </div>
          </div>
        )}

        {phase.name === "submitting" && (
          <div className="grid place-items-center py-10">
            <Spinner label="Checking…" />
          </div>
        )}

        {phase.name === "result" && (
          <ResultPanel
            result={phase.result}
            due={due}
            onRetake={() => (due.mode === "photo" ? void startCamera() : void checkGps())}
            onRetry={() => void retry(phase.result.attemptId)}
            onDone={close}
          />
        )}

        {phase.name === "error" && (
          <div className="flex flex-col gap-3">
            <Note tone="error">
              <p className="font-bold">{phase.message}</p>
              {phase.hint && <p className="mt-1">{phase.hint}</p>}
            </Note>
            <button className="btn btn-hero w-full" onClick={() => setPhase({ name: "intro" })}>
              <Icon name="refresh" /> Try again
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function ResultPanel({ result, due, onRetake, onRetry, onDone }: { result: AttemptResult; due: DueView; onRetake: () => void; onRetry: () => void; onDone: () => void }) {
  if (result.status === "accepted") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="relative grid h-24 w-24 place-items-center">
          <span aria-hidden="true" className="m-ring absolute inset-0 rounded-full border-2 border-blood" />
          <span className="m-pop grid h-24 w-24 place-items-center rounded-full bg-blood text-white">
            <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" className="m-draw" style={{ "--len": 22 } as CSSProperties} />
            </svg>
          </span>
        </span>
        <p className="m-rise font-display text-3xl [animation-delay:120ms]">Done.</p>
        <p className="m-rise font-display text-xl [animation-delay:180ms]">{result.award ? `+${result.award.xp} XP` : "Already counted"}</p>
        {due.earns ? (
          <div className="w-full text-left">
            <EarningPrompt occurrenceId={due.occurrenceId} org={due.org} suggestedCents={due.lastEarningCents} loggedCents={null} hero onDone={onDone} />
          </div>
        ) : (
          <button className="btn btn-hero w-full" onClick={onDone}>
            <Icon name="check" /> Done
          </button>
        )}
      </div>
    );
  }
  const unavailable = result.status === "unavailable" || result.status === "pending";
  return (
    <div className="flex flex-col gap-3">
      <Note tone={unavailable ? "warn" : "error"}>
        <p className="font-bold">
          {result.status === "rejected" ? "Not accepted" : result.status === "inconclusive" ? "Couldn't tell yet" : "Checker unavailable"}
        </p>
        <p className="mt-1">{result.reason}</p>
        {result.guidance && <p className="mt-1">{result.guidance}</p>}
      </Note>
      {unavailable ? (
        <>
          <p className="hint">Saved. If it can’t be checked in time, the day is excused.</p>
          <button className="btn btn-hero w-full" onClick={onRetry}>
            <Icon name="refresh" /> Retry
          </button>
        </>
      ) : (
        <button className="btn btn-hero w-full" onClick={onRetake}>
          <Icon name={due.mode === "photo" ? "camera" : "pin"} /> {due.mode === "photo" ? "Retake" : "Try again"}
        </button>
      )}
      <button className="btn btn-ghost w-full" onClick={onDone}>
        Close
      </button>
    </div>
  );
}
