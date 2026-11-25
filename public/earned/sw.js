/*
 * Earned service worker (scope: /earned/).
 *
 * - Caches the public app shell and hashed static assets so the app opens offline.
 * - NEVER caches /earned/api/* (authenticated data, evidence, verification): those go straight to
 *   the network. The last-synced view lives in the page's own storage and is cleared on sign-out.
 * - Updates wait: a new version installs in the background and activates only when the user taps
 *   "Update" (the page posts SKIP_WAITING), so a check-in is never interrupted mid-flow.
 */
const VERSION = "earned-shell-v1";
const SHELL = ["/earned", "/earned/estate", "/earned/ventures", "/earned/quests", "/earned/sign-in", "/earned/manifest.webmanifest", "/earned/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(SHELL.map((url) => fetch(url, { credentials: "omit" }).then((res) => (res.ok ? cache.put(url, res) : null)).catch(() => null))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("earned-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/earned/api/")) return; // network only, never cached
  if (req.headers.get("RSC") || url.searchParams.has("_rsc")) return; // router payloads: network only

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate" && url.pathname.startsWith("/earned")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic" && !res.redirected) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match("/earned")) || Response.error()),
    );
  }
});
