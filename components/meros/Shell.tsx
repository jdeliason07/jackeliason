"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { APP_BASE_PATH, APP_NAME } from "@/lib/meros/config";
import { useGame } from "./GameProvider";
import Celebrations from "./Celebrations";
import Character from "./art/Character";
import Wordmark from "./art/Wordmark";
import { Count, useMagnetic } from "./motion";
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
  const requested = useRef(false);
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
    // Reload only when the user tapped Update; the first install's clients.claim() must not reload.
    const onChange = () => {
      if (reloaded || !requested.current) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);
  return {
    waiting,
    apply: () => {
      requested.current = true;
      waiting?.postMessage({ type: "SKIP_WAITING" });
    },
  };
}

export default function Shell({ children }: { children: ReactNode }) {
  const game = useGame();
  const path = usePathname();
  const router = useRouter();
  const bare = BARE.some((b) => path.startsWith(b));
  const sw = useServiceWorker();
  useMagnetic();

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
  const activeIndex = NAV.findIndex((item) => isActive(item.href, path));

  if (bare) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-lg px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-10">
        <div key={path} className="m-view">
          {children}
        </div>
        <Celebrations />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-white px-5 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2">
        <Link href={APP_BASE_PATH} aria-label={`${APP_NAME} home`} className="flex min-h-11 items-baseline gap-2 rounded-lg">
          <Wordmark className="text-[1.75rem]" />
          {game.mode === "demo" && <span className="eyebrow">Demo</span>}
        </Link>
        <div className="flex items-center gap-3">
          {v && (
            <Link href={`${APP_BASE_PATH}/estate`} className="flex min-h-11 items-center gap-1 font-display text-lg" aria-label={`${v.profile.credits} Estate Credits`}>
              <Icon name="coin" className="h-5 w-5" /> <Count value={v.profile.credits} />
            </Link>
          )}
          <Link
            href={`${APP_BASE_PATH}/profile`}
            aria-label="Profile and settings"
            data-magnetic
            className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border-[1.5px] border-blood bg-white transition-transform duration-300 ease-spring active:scale-90"
          >
            {v ? (
              <Character appearance={v.profile.appearance} equipped={equipped} level={v.profile.progress.level} energy={v.profile.energy} className="mt-3 h-14 w-14" title="Your avatar" />
            ) : (
              <Icon name="user" />
            )}
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-2 px-5 empty:hidden">
        {(!game.online || game.stale) && (
          <Note tone="warn">
            <strong>Offline.</strong> {game.stale ? `Showing what was saved ${new Date(game.stale.savedAt).toLocaleString()}. ` : ""}Check-ins, chests, and claims need a connection.
          </Note>
        )}
        {sw.waiting && (
          <Note tone="ok" action={<button className="btn btn-secondary min-h-10 px-3 text-sm" onClick={sw.apply}>Update</button>}>
            A new version is ready.
          </Note>
        )}
        {game.error && game.status === "ok" && (
          <Note tone="error" action={<button className="btn btn-secondary min-h-10 px-3 text-sm" onClick={() => void game.refresh()}>Retry</button>}>
            {game.error}
          </Note>
        )}
      </div>

      <main id="content" className="flex-1 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
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
        {game.status === "ok" && v && (
          <div key={path} className="m-view">
            {children}
          </div>
        )}
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-blood bg-white safe-bottom">
        <ul className="relative mx-auto grid max-w-lg grid-cols-4">
          {activeIndex >= 0 && <li aria-hidden="true" className="m-nav-pill" style={{ "--i": activeIndex } as CSSProperties} />}
          {NAV.map((item) => {
            const active = isActive(item.href, path);
            return (
              <li key={item.href} className="relative">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="group flex min-h-[64px] flex-col items-center justify-start gap-1 pt-2 text-[0.75rem] font-bold tracking-wide uppercase"
                >
                  <span className={`grid h-8 w-12 place-items-center transition-[color,transform] duration-300 ease-spring group-active:scale-90 ${active ? "text-white" : ""}`}>
                    <Icon name={item.icon} className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
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
