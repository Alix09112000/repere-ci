/* Repère CI — cache PWA V6.
   Objectif : afficher les mises à jour dès qu'une connexion est disponible,
   et conserver un secours hors ligne pour les seuls fichiers statiques.
   Ni les appels API ni les données personnelles ne sont stockés ici. */
const CACHE = 'repere-ci-coque-v18';
const PREFIXE_CACHE = 'repere-ci-coque-';
const FICHIERS_COQUE = [
  './',
  './index.html',
  './lieu.html',
  './suivi.html',
  './repere.css',
  './repere-maps.css',
  './repere-v8.css',
  './repere-api.js',
  './repere-routing.js',
  './repere-poi.js',
  './repere-3d.js',
  './repere-app.js',
  './repere-maps.js',
  './manifest.json',
  './logo-icon.svg',
  './logo-icon-maskable.svg',
];
const CHEMINS_COQUE = new Set(
  FICHIERS_COQUE.map((fichier) => new URL(fichier, self.registration.scope).pathname)
);
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS_COQUE))
  );
  self.skipWaiting();
});
self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    const noms = await caches.keys();
    // Les caches d'autres projets GitHub Pages partagent ce domaine.
    await Promise.all(noms
      .filter((nom) => nom.startsWith(PREFIXE_CACHE) && nom !== CACHE)
      .map((nom) => caches.delete(nom)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (evt) => {
  const url = new URL(evt.request.url);
  if (evt.request.method !== 'GET' ||
      url.origin !== self.location.origin ||
      !CHEMINS_COQUE.has(url.pathname)) {
    return; // API, tuiles cartographiques et autres URLs : réseau normal.
  }

  evt.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // L'URL canonique ignore les paramètres de suivi (ex. ?utm_source).
    const cleCache = new Request(url.origin + url.pathname);
    try {
      // Network-first : n'affiche plus une ancienne page si le réseau répond.
      const reponse = await fetch(evt.request, { cache: 'no-cache' });
      if (reponse.ok) {
        await cache.put(cleCache, reponse.clone()).catch(() => {});
      }
      return reponse;
    } catch (_) {
      // Mode hors ligne : la coque existante reste accessible.
      const ancienne = await cache.match(cleCache);
      if (ancienne) return ancienne;
      if (evt.request.mode === 'navigate') {
        const accueil = await cache.match('./index.html');
        if (accueil) return accueil;
      }
      return Response.error();
    }
  })());
});
