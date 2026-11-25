"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_BASE_PATH, APP_TAGLINE } from "@/lib/meros/config";
import Wordmark from "../art/Wordmark";
import { useGame } from "../GameProvider";
import { Note, Spinner } from "../ui";

export default function SignIn() {
  const game = useGame();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  async function post(path: string, body: unknown) {
    const res = await fetch(`${APP_BASE_PATH}/api/auth/${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res) throw new Error("You're offline. Sign-in needs a connection.");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong.");
    return json;
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const r = await post("otp", { email });
      setStage("code");
      setMessage({ tone: "info", text: r.message });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Failed." });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await post("verify", { email, token: code });
      await game.refresh();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col gap-6 pt-16">
      <header className="flex flex-col items-start gap-4 px-1 pb-6">
        <Wordmark as="h1" stroke className="text-[5rem]" />
        <p className="eyebrow">{APP_TAGLINE}</p>
      </header>

      {game.status === "loading" && (
        <div className="grid place-items-center py-6">
          <Spinner />
        </div>
      )}

      {game.status === "unconfigured" && (
        <Note tone="warn">
          <p className="font-bold">The live app isn’t configured on this server yet.</p>
          <p className="mt-1">Missing: {game.missing.join(", ") || "server settings"}. See the README’s Meros setup section. You can explore everything in the demo meanwhile.</p>
        </Note>
      )}

      {game.status === "signin" && (
        <div className="py-2">
          {stage === "email" ? (
            <form className="flex flex-col gap-3" onSubmit={sendCode}>
              <label className="label" htmlFor="si-email">Owner email</label>
              <input id="si-email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Sending…" : "Email me a sign-in code"}
              </button>
              <p className="hint">Only the allowlisted owner can sign in.</p>
            </form>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={verify}>
              <label className="label" htmlFor="si-code">6-digit code</label>
              <input id="si-code" inputMode="numeric" autoComplete="one-time-code" className="field text-center text-2xl tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))} required />
              <button type="submit" className="btn btn-primary" disabled={busy || code.length < 6}>
                {busy ? "Checking…" : "Sign in"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setStage("email")}>
                Use a different email
              </button>
            </form>
          )}
          {message && <div className="mt-3"><Note tone={message.tone}>{message.text}</Note></div>}
        </div>
      )}

      {game.mode === "demo" ? (
        <Link href={APP_BASE_PATH} className="btn btn-primary">Back to the demo</Link>
      ) : (
        <button className={`btn ${game.status === "signin" ? "btn-secondary" : "btn-primary min-h-14 text-lg"}`} onClick={game.enterDemo}>
          Explore the demo
        </button>
      )}
      <p className="hint text-center">Synthetic data, entirely in this browser.</p>
      <p className="eyebrow mt-auto pt-6 text-center">
        Vates &amp; Korvo portfolio · <Link href="/" className="underline">jackeliason.com</Link>
      </p>
    </div>
  );
}
