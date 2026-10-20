// Offline support for the installed app. Game files are fetched fresh when
// online (so updates land right away) and served from the cache when not.
const CACHE = 'tidewhistle-v26';
const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-32.png', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'js/util.js', 'js/lines.js', 'js/config.js', 'js/tune.js', 'js/sprites.js', 'js/iso.js', 'js/world.js', 'js/dialogue.js', 'js/actions.js',
  'js/newcomers.js', 'js/person.js', 'js/cat.js', 'js/social.js', 'js/talk.js', 'js/command.js', 'js/mind.js', 'js/save.js', 'js/events.js',
  'js/gods.js', 'js/content.js', 'js/love.js', 'js/town.js', 'js/build.js', 'js/render.js', 'js/ui.js', 'js/input.js', 'js/menu.js', 'js/main.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // Network first, cache as the fallback
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  } else if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    // Fonts rarely change: cache first
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
  }
});
