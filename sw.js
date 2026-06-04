const CACHE  = 'momentarium-v4';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './core.js',
  './scenes/tiny-cabin/scene.js',
  './scenes/beach/scene.js',
  './scenes/aquarium/scene.js',
  './scenes/tech-ruin/scene.js',
  './scenes/space-church/scene.js',
  './manifest.json',
  './icon.svg',
  './assets/scenes/tiny-cabin/background-placeholder.svg',
  './assets/scenes/beach/background-placeholder.svg',
  './assets/scenes/aquarium/background-placeholder.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always try fresh, fall back to cache if offline
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
