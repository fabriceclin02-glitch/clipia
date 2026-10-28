/**
 * CLIPIA — service worker.
 *
 * Stratégie : LE RÉSEAU D'ABORD, le cache seulement en secours hors ligne.
 * La version précédente servait le cache en priorité, ce qui figeait
 * l'interface sur une ancienne version après chaque mise à jour.
 */
const CACHE = 'clipia-v35';
const SECOURS = ['/', '/styles.css', '/app.js', '/appel-util.js', '/guide-util.js', '/v4.js','/v5.js','/v6.js','/widgets.js','/v61.js','/recherche.js','/livrable.js','/psy.js','/credit.js','/extensions.js','/studio.js','/depannage.js','/logitheque.js','/dictee.js','/openclaw.js','/telephone-vue.js','/promotion.js', '/travaux.js', '/communaute.js', '/entreprise.js', '/voix-naturelle.js', '/outils-data.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SECOURS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'vider-cache') caches.keys().then(k => k.forEach(x => caches.delete(x)));
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/media/') || u.pathname.startsWith('/uploads/')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copie = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copie));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/')))
  );
});
