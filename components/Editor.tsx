"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import PasswordForm from "./PasswordForm";

type Listed = { slug: string; title: string; date: string; draft: boolean };
type Draft = { slug: string; title: string; date: string; summary: string; updated: string; draft: boolean; body: string; sha?: string };
type Saved = { slug: string; draft: boolean; commitUrl: string };

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const blank = (): Draft => ({ slug: "", title: "", date: today(), summary: "", updated: "", draft: false, body: "" });

/** "On Simplicity" → "on-simplicity": the URL rules the build enforces. */
function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string; problems?: string[] } }> {
  const response = await fetch(path, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
}

const label = "smallcaps block text-muted";
const field = "mt-1.5 w-full rounded-xl border border-rule/70 bg-white px-3.5 py-2.5 text-ink focus:border-ink";

/**
 * Write a new essay or edit one. Saving commits the Markdown file to the repository,
 * which Vercel deploys; the essay is live about a minute later.
 */
export default function Editor() {
  const router = useRouter();
  // The essay in the URL is only where the editor starts. Later URL changes (after a save,
  // or picking another essay) must not re-run start-up, which would reload over unsaved typing.
  const essayInUrl = useSearchParams().get("essay");
  const firstEssay = useRef(essayInUrl);
  const [state, setState] = useState<"checking" | "locked" | "ready">("checking");
  const [essays, setEssays] = useState<Listed[]>([]);
  const [draft, setDraft] = useState<Draft>(blank);
  const [slugEdited, setSlugEdited] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; problems?: string[] } | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const editing = Boolean(draft.sha);

  const loadList = useCallback(async () => {
    const { ok, data } = await api<{ essays: Listed[] }>("/api/editor/essays");
    if (ok) setEssays(data.essays);
    else setError({ message: data.error ?? "Couldn't list the essays." });
  }, []);

  const loadEssay = useCallback(async (slug: string) => {
    setBusy("Opening");
    setError(null);
    setSaved(null);
    const { ok, data } = await api<Draft & { problems: string[] }>(`/api/editor/essays/${encodeURIComponent(slug)}`);
    setBusy(null);
    if (!ok) return setError({ message: data.error ?? "Couldn't open that essay." });
    setDraft({
      slug: data.slug,
      sha: data.sha,
      title: data.title ?? "",
      date: data.date ?? today(),
      summary: data.summary ?? "",
      updated: data.updated ?? "",
      draft: data.draft ?? false,
      body: data.body ?? "",
    });
    setSlugEdited(true);
    setDirty(false);
    if (data.problems?.length) setError({ message: "This essay has problems the site will reject until they're fixed:", problems: data.problems });
  }, []);

  const start = useCallback(async () => {
    setState("ready");
    await loadList();
    if (firstEssay.current) await loadEssay(firstEssay.current);
  }, [loadList, loadEssay]);

  useEffect(() => {
    let cancelled = false;
    api<{ signedIn: boolean }>("/api/editor/session").then(({ data }) => {
      if (cancelled) return;
      if (data.signedIn) void start();
      else setState("locked");
    });
    return () => {
      cancelled = true;
    };
  }, [start]);

  // Warn before leaving with unsaved writing.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const discardOk = () => !dirty || window.confirm("Discard your unsaved changes?");

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDirty(true);
    setSaved(null);
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && !editing && !slugEdited) next.slug = slugify(String(value));
      return next;
    });
  }

  function pick(slug: string) {
    if (!discardOk()) return;
    if (slug) {
      router.replace(`/write?essay=${encodeURIComponent(slug)}`, { scroll: false });
      void loadEssay(slug);
    } else {
      router.replace("/write", { scroll: false });
      setDraft(blank());
      setSlugEdited(false);
      setDirty(false);
      setError(null);
      setSaved(null);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(draft.draft ? "Saving" : "Publishing");
    setError(null);
    const { ok, status, data } = await api<Saved & { sha?: string }>(`/api/editor/essays/${encodeURIComponent(draft.slug)}`, {
      method: "PUT",
      body: JSON.stringify(draft),
    });
    setBusy(null);
    if (status === 401) {
      setState("locked");
      return setError({ message: data.error ?? "Your session ended. Sign in again; your writing is still here." });
    }
    if (!ok) return setError({ message: data.error ?? "Couldn't save.", problems: data.problems });
    setDraft((current) => ({ ...current, sha: data.sha }));
    setSlugEdited(true);
    setDirty(false);
    setSaved({ slug: data.slug, draft: data.draft, commitUrl: data.commitUrl });
    router.replace(`/write?essay=${encodeURIComponent(data.slug)}`, { scroll: false });
    void loadList();
  }

  async function signOut() {
    if (!discardOk()) return;
    await api("/api/editor/session", { method: "DELETE" });
    setDirty(false);
    setState("locked");
  }

  if (state === "checking") return <p className="text-center italic">Opening the editor…</p>;

  if (state === "locked") {
    return (
      <div className="surface mx-auto max-w-[28rem]">
        {error && <p className="mb-5 text-[0.9375rem] text-ink">{error.message}</p>}
        <PasswordForm
          onSignedIn={() => {
            setError(null);
            void start();
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="surface">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-[14rem] flex-1">
          <span className={label}>Essay</span>
          <select className={field} value={editing ? draft.slug : ""} onChange={(event) => pick(event.target.value)}>
            <option value="">New essay</option>
            {essays.map((essay) => (
              <option key={essay.slug} value={essay.slug}>
                {essay.title}
                {essay.draft ? " (draft)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={signOut} className="smallcaps cursor-pointer pb-3 text-muted hover:text-ink">
          Sign out
        </button>
      </div>

      <label className="mt-6 block">
        <span className={label}>Title</span>
        <input required className={`${field} font-display text-[1.5rem]`} value={draft.title} onChange={(event) => change("title", event.target.value)} />
      </label>

      <label className="mt-5 block">
        <span className={label}>URL</span>
        <div className="mt-1.5 flex items-center rounded-xl border border-rule/70 bg-white pl-3.5 text-muted focus-within:border-ink">
          <span className="shrink-0 text-[0.9375rem]">/essays/</span>
          <input
            required
            readOnly={editing}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Lowercase letters, numbers, and single hyphens"
            className="min-w-0 flex-1 rounded-r-xl bg-transparent py-2.5 pr-3.5 text-ink read-only:text-muted"
            value={draft.slug}
            onChange={(event) => {
              setSlugEdited(true);
              change("slug", event.target.value);
            }}
          />
        </div>
        {editing && <span className="mt-1 block text-[0.8125rem] text-muted italic">An essay keeps its URL, so links to it never break.</span>}
      </label>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Date</span>
          <input type="date" required className={field} value={draft.date} onChange={(event) => change("date", event.target.value)} />
        </label>
        <label className="block">
          <span className={label}>Updated (optional)</span>
          <input type="date" className={field} value={draft.updated} min={draft.date} onChange={(event) => change("updated", event.target.value)} />
        </label>
      </div>

      <label className="mt-5 block">
        <span className={label}>Summary</span>
        <input
          required
          className={field}
          placeholder="One line for search results, link previews, and RSS"
          value={draft.summary}
          onChange={(event) => change("summary", event.target.value)}
        />
      </label>

      <label className="mt-5 block">
        <span className={label}>Essay</span>
        <textarea
          required
          rows={18}
          className={`${field} min-h-[24rem] resize-y font-hand text-[1.125rem] leading-[1.9]`}
          placeholder="Write in Markdown: ## for a section, *emphasis*, [a link](https://example.com), > a quote."
          value={draft.body}
          onChange={(event) => change("body", event.target.value)}
        />
      </label>

      <label className="mt-5 flex items-center gap-2.5 text-[0.9375rem]">
        <input type="checkbox" checked={draft.draft} onChange={(event) => change("draft", event.target.checked)} className="size-4 accent-ink" />
        Draft: keep it off the live site
      </label>

      {error && (
        <div role="alert" className="mt-6 rounded-xl bg-ink/5 px-4 py-3 text-[0.9375rem]">
          <p>{error.message}</p>
          {error.problems && (
            <ul className="mt-2 list-disc pl-5">
              {error.problems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {saved && (
        <p role="status" className="mt-6 rounded-xl bg-ink/5 px-4 py-3 text-[0.9375rem]">
          {saved.draft ? "Saved as a draft. It stays off the live site." : "Published."} The site updates in about a minute
          {saved.draft ? "." : ": "}
          {!saved.draft && (
            <Link href={`/essays/${saved.slug}`} className="link">
              /essays/{saved.slug}
            </Link>
          )}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="text-[0.8125rem] text-muted italic">{dirty ? "Unsaved changes" : editing ? "Saved" : ""}</span>
        <button
          type="submit"
          disabled={Boolean(busy)}
          className="smallcaps cursor-pointer rounded-full bg-ink px-6 py-2.5 text-white disabled:opacity-60"
        >
          {busy ?? (draft.draft ? "Save draft" : "Publish")}
        </button>
      </div>
    </form>
  );
}
