/* GelFigure v1.6.0 Service Worker (GitHub Pages / Web version only).
 * Offline-caches same-origin app shell assets; NEVER intercepts external HTTPS AI endpoints or POST calls. */
const CACHE_NAME = 'gelfigure-v1.6.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-l1.svg',
  './i18n/zh.json',
  './i18n/en.json',
  './css/tokens.css',
  './css/heading-font.css',
  './css/style.css',
  './css/components.css',
  './css/marker-ai.css',
  './css/gel-ai-beta.css',
  './css/workspace.css',
  './css/v13-ai.css',
  './css/v14-layout.css',
  './css/v15-productivity.css',
  './css/v16-densitometry.css',
  './js/storage.js',
  './js/i18n.js',
  './js/notifications.js',
  './js/tiff.js',
  './js/colour.js',
  './js/ladder-cache.js',
  './js/ladders.js',
  './js/engine.js',
  './js/name-text.js',
  './js/render.js',
  './js/export.js',
  './js/pptx.js',
  './js/demo.js',
  './js/app.js',
  './js/library.js',
  './js/editor.js',
  './js/ui.js',
  './js/figedit.js',
  './js/mobile.js',
  './js/perspective.js',
  './js/marker-ui.js',
  './js/ai-reliability.js',
  './js/ai-client.js',
  './js/ai-workspace.js',
  './js/marker-ai.js',
  './js/gel-ai-beta.js',
  './js/auto-flow.js',
  './js/ai-wizard.js',
  './js/review-checklist.js',
  './js/welcome-ai.js',
  './js/layout-v14.js',
  './js/productivity-v15.js',
  './js/densitometry-v16.js',
  './js/history-ui.js',
  './js/support-config.js',
  './js/feedback.js',
  './js/export-support.js',
  './js/onboarding.js',
  './js/help-ui.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('gelfigure-') && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Strictly same-origin only: never touch external AI API endpoints or third-party hosts
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp && resp.ok && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
        }
        return resp;
      });
    })
  );
});
