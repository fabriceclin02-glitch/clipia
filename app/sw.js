/* Clipia — service worker
   Role : rendre l'application disponible hors ligne et accelerer son ouverture.
   Les appels aux modeles IA ne sont JAMAIS mis en cache. */

const VERSION = 'clipia-8.6.0-mobile';
const CACHE = `${VERSION}-coquille`;

const COQUILLE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/core.js',
  './js/media.js',
  './js/agent.js',
  './js/ui.js',
  './js/systeme.js',
  './icones/clipia-192.png',
  './icones/clipia-512.png',
  './icones/clipia-180.png',
  './icones/clipia-maskable-512.png',
  './icones/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(COQUILLE).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(
        cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'maj-maintenant') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Tout ce qui sort du site (API des modeles, catalogues...) passe directement.
  if (url.origin !== self.location.origin) return;

  // Navigation : on tente le reseau, on retombe sur la version en cache.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copie));
          return rep;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Scripts : reseau d'abord (toujours la derniere version), cache en secours.
  if (url.pathname.endsWith('.js')) {
    e.respondWith(
      fetch(req).then((rep) => {
        if (rep && rep.status === 200) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); }
        return rep;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Fichiers du site : cache d'abord, rafraichi en arriere-plan.
  e.respondWith(
    caches.match(req).then((cache) => {
      const reseau = fetch(req)
        .then((rep) => {
          if (rep && rep.status === 200 && rep.type === 'basic') {
            const copie = rep.clone();
            caches.open(CACHE).then((c) => c.put(req, copie));
          }
          return rep;
        })
        .catch(() => cache);
      return cache || reseau;
    })
  );
});
