/* Basic offline-first Service Worker (App Shell + runtime cache).
   Observação: CDNs (Tailwind/jsPDF/Lucide) são cacheados em runtime após o primeiro acesso. */

const CACHE_VERSION = "dttv-agenda-v1-2026-02-19";
const CACHE_APP = `${CACHE_VERSION}:app`;
const CACHE_RUNTIME = `${CACHE_VERSION}:runtime`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.svg",
  "./assets/icons/icon-512.svg",
  "./src/app.js",
  "./src/db.js",
  "./src/storage.js",
  "./src/state.js",
  "./src/utils.js",
  "./src/alerts.js",
  "./src/notifications.js",
  "./src/backupManager.js",
  "./src/ui/components.js",
  "./src/ui/recordUi.js",
  "./src/ui/modal.js",
  "./src/ui/router.js",
  "./src/ui/toast.js",
  "./src/views/backup.js",
  "./src/views/budgets.js",
  "./src/views/clients.js",
  "./src/views/home.js",
  "./src/views/notifications.js",
  "./src/views/records.js",
  "./src/views/services.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_APP)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const OLD_PREFIX = "dt" + "tz-agenda-v1-";
      const NEW_PREFIX = "dttv-agenda-v1-";
      await Promise.all(
        keys
          .filter((k) => {
            const isAppCache = k.startsWith(NEW_PREFIX) || k.startsWith(OLD_PREFIX);
            return isAppCache && !k.startsWith(CACHE_VERSION);
          })
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })
  );
});

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_RUNTIME);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_RUNTIME);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback para navegação SPA
    return caches.match("./index.html");
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(async (response) => {
      const cache = await caches.open(CACHE_RUNTIME);
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  return cached || (await fetchPromise) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Navegação: mantém SPA utilizável offline
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Apenas GET
  if (request.method !== "GET") return;

  if (isSameOrigin(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Cross-origin (CDNs): tenta SWR
  event.respondWith(staleWhileRevalidate(request));
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") self.skipWaiting();
});
