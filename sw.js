/* Repère CI — service worker minimal.
   Un seul but : que l'app s'ouvre même sur une connexion lente ou coupée,
   en servant la coque (HTML/CSS/JS/icône) depuis le cache.

   Ne met JAMAIS en cache une réponse de l'API GeoDeliver (geocode, reverse,
   signalements, lieux...) : ces données changent à chaque appel et doivent
   toujours venir du réseau. Seule la coque statique de repere-ci est
   concernée — pas les appels vers onrender.com. */

const CACHE = 'repere-ci-coque-v2';

const FICHIERS_COQUE = [
  './',
  './index.html',
  './lieu.html',
  './repere.css',
  './repere-api.js',
  './repere-app.js',
  './manifest.json',
  './logo-icon.svg',
  './logo-icon-maskable.svg',
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS_COQUE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  const url = new URL(evt.request.url);

  // Jamais l'API : toujours réseau, jamais de cache pour ces réponses.
  if (url.origin !== self.location.origin) {
    return; // laisse la requête partir normalement (réseau)
  }

  // Coque statique du même origine : cache d'abord, réseau en secours,
  // et on rafraîchit le cache quand le réseau répond.
  evt.respondWith(
    caches.match(evt.request).then((reponseEnCache) => {
      const reponseReseau = fetch(evt.request)
        .then((reponse) => {
          if (reponse && reponse.ok) {
            const copie = reponse.clone();
            caches.open(CACHE).then((cache) => cache.put(evt.request, copie));
          }
          return reponse;
        })
        .catch(() => reponseEnCache);
      return reponseEnCache || reponseReseau;
    })
  );
});
