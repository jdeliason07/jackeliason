"use client";

import { useState } from "react";

/** Asks for the editor password; the server checks it and sets the session cookie. */
export default function PasswordForm({ onSignedIn, autoFocus = true }: { onSignedIn: () => void; autoFocus?: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/editor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.ok) {
        setPassword("");
        onSignedIn();
      } else {
        setError(result.error ?? "That didn't work. Try again.");
      }
    } catch {
      setError("Couldn't reach the site. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="text-ink">
      <label htmlFor="editor-password" className="block font-display text-[1.75rem] leading-tight">
        Password
      </label>
      <p className="mt-1 text-[0.9375rem] text-muted italic">Only Jack can write here.</p>
      <div className="mt-5 flex gap-2">
        <input
          id="editor-password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus={autoFocus}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-w-0 flex-1 rounded-full border border-rule bg-white px-4 py-2 text-ink"
        />
        <button
          type="submit"
          disabled={busy}
          className="smallcaps shrink-0 cursor-pointer rounded-full bg-ink px-5 py-2 text-white disabled:opacity-60"
        >
          {busy ? "Checking" : "Unlock"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[0.9375rem] text-ink">
          {error}
        </p>
      )}
    </form>
  );
}
