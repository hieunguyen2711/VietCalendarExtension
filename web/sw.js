/*
 * Service worker for the hosted web build.
 *
 * Deliberately minimal. Its job is to make the app installable to a phone's
 * home screen (Chrome requires a fetch handler for that) and to let the shell
 * open without a connection. It is NOT an offline mode: creating an event
 * needs Google, and pretending otherwise would just fail later and more
 * confusingly.
 *
 * Network-first for the app's own files, so a deploy is picked up on the next
 * visit rather than being pinned by whatever the cache holds. Anything
 * cross-origin — the Google Identity library, every Calendar API call — is
 * passed straight through and never cached, because a stale token endpoint or
 * a replayed API response is worse than no cache at all.
 */

const CACHE = 'viet-calendar-shell-v1';

// Relative so the worker keeps working under a project subpath such as
// /VietCalendarExtension/web/, where an absolute path would miss.
const SHELL = [
  './',
  'index.html',
  'boot.js',
  'web.css',
  'manifest.webmanifest',
  '../src/popup/popup.html',
  '../src/popup/popup.css',
  '../src/popup/popup.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // addAll is all-or-nothing; a single 404 would leave no cache at all, and
    // the app works fine without one.
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(SHELL.map((url) => cache.add(url))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
