"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { APP_BASE_PATH, APP_NAME } from "@/lib/earned/config";
import { useGame } from "./GameProvider";
import Celebrations from "./Celebrations";
import Character from "./art/Character";
import { Icon, Note, Spinner } from "./ui";

const NAV = [
  { href: APP_BASE_PATH, label: "Today", icon: "today" },
  { href: `${APP_BASE_PATH}/estate`, label: "Estate", icon: "estate" },
  { href: `${APP_BASE_PATH}/ventures`, label: "Ventures", icon: "ventures" },
  { href: `${APP_BASE_PATH}/quests`, label: "Quests", icon: "quests" },
];

const BARE = [`${APP_BASE_PATH}/sign-in`, `${APP_BASE_PATH}/onboarding`];

function isActive(href: string, path: string) {
  return href === APP_BASE_PATH ? path === APP_BASE_PATH || path === `${APP_BASE_PATH}/` : path.startsWith(href);
}

function useServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let reloaded = false;
    navigator.serviceWorker
      .register(`${APP_BASE_PATH}/sw.js`, { scope: `${APP_BASE_PATH}/`, updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
      })
      .catch(() => undefined);
    const onChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);
  return { waiting, apply: () => waiting?.postMessage({ type: "SKIP_WAITING" }) };
}

export default function Shell({ children }: { children: ReactNode }) {
  const game = useGame();
  const path = usePathname();
  const router = useRouter();
  const bare = BARE.some((b) => path.startsWith(b));
  const sw = useServiceWorker();

  useEffect(() => {
    if (game.status === "signin" && !path.startsWith(`${APP_BASE_PATH}/sign-in`)) router.replace(`${APP_BASE_PATH}/sign-in`);
    if (game.status === "unconfigured" && !path.startsWith(`${APP_BASE_PATH}/sign-in`)) router.replace(`${APP_BASE_PATH}/sign-in`);
    if (game.status === "onboarding" && !path.startsWith(`${APP_BASE_PATH}/onboarding`)) router.replace(`${APP_BASE_PATH}/onboarding`);
    if (game.status === "ok" && (path.startsWith(`${APP_BASE_PATH}/onboarding`) || path.startsWith(`${APP_BASE_PATH}/sign-in`))) {
      router.replace(APP_BASE_PATH);
    }
  }, [game.status, path, router]);

  const v = game.view;
  const equipped = v?.inventory.filter((i) => i.equipped).map((i) => i.itemId) ?? [];

  if (bare) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-10">
        {children}
        <Celebrations />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-paper/85 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 backdrop-blur">
        <Link href={APP_BASE_PATH} className="flex min-h-11 items-center gap-2 rounded-xl font-display text-[1.375rem] font-semibold">
          <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-xl bg-sun text-ink shadow-[0_3px_0_#d99a00]">
            <Icon name="star" className="h-5 w-5" strokeWidth={2.6} />
          </span>
          {APP_NAME}
          {game.mode === "demo" && <span className="chip bg-grape-soft text-grape">Demo</span>}
        </Link>
        <div className="flex items-center gap-1.5">
          {v && (
            <span className="chip bg-sun-soft text-ink" aria-label={`${v.profile.credits} Estate Credits`}>
              <Icon name="coin" className="h-4 w-4" /> {v.profile.credits}
            </span>
          )}
          <Link
            href={`${APP_BASE_PATH}/profile`}
            aria-label="Profile and settings"
            className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border-2 border-line bg-white"
          >
            {v ? (
              <Character appearance={v.profile.appearance} equipped={equipped} level={v.profile.progress.level} energy={v.profile.energy} className="mt-3 h-14 w-14" title="Your avatar" />
            ) : (
              <Icon name="user" />
            )}
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-2 px-4">
        {game.mode === "demo" && (
          <Note tone="info">
            <strong>Demo:</strong> synthetic data in this browser; local stand-in checks, never a real account.
          </Note>
        )}
        {(!game.online || game.stale) && (
          <Note tone="warn">
            <strong>Offline.</strong> {game.stale ? `Showing what was saved ${new Date(game.stale.savedAt).toLocaleString()}. ` : ""}Verified check-ins, chests, and claims need a connection; nothing is queued.
          </Note>
        )}
        {sw.waiting && (
          <Note tone="ok" action={<button className="btn btn-secondary min-h-10 px-3 text-sm" onClick={sw.apply}>Update</button>}>
            A new version of {APP_NAME} is ready.
          </Note>
        )}
        {game.error && game.status === "ok" && (
          <Note tone="error" action={<button className="btn btn-secondary min-h-10 px-3 text-sm" onClick={() => void game.refresh()}>Retry</button>}>
            {game.error}
          </Note>
        )}
      </div>

      <main id="content" className="flex-1 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
        {game.status === "loading" && (
          <div className="grid place-items-center py-24">
            <Spinner label={game.mode === "demo" ? "Building the demo estate…" : "Loading your day…"} />
          </div>
        )}
        {game.status === "error" && (
          <div className="py-10">
            <Note tone="error" action={<button className="btn btn-secondary min-h-10 px-3 text-sm" onClick={() => void game.refresh()}>Retry</button>}>
              {game.error ?? "Couldn't load."}
            </Note>
          </div>
        )}
        {game.status === "ok" && v && children}
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur safe-bottom">
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(item.href, path);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[0.8125rem] font-extrabold ${active ? "text-navy" : "text-muted"}`}
                >
                  <span className={`grid h-8 w-12 place-items-center rounded-full ${active ? "bg-sun-soft" : ""}`}>
                    <Icon name={item.icon} className="h-6 w-6" strokeWidth={active ? 2.6 : 2.1} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Celebrations />
    </div>
  );
}
