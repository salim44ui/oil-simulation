/* ===========================================================================
   Service worker for the 3D Separator Simulation PWA.

   The app is one self-contained HTML file plus three CDN libraries, so the
   caching is deliberately plain: pre-cache the shell on install, then serve
   cache-first and fall back to the network, adding whatever the network
   returns to the cache as it goes. That is enough to make the simulator start
   and run with no connection once it has been opened once.

   Bump CACHE when the HTML changes — the activate handler deletes every
   cache that is not the current one, which is what makes a new version
   actually reach a device that already has the old one installed.
   ========================================================================= */
const CACHE = 'separator-sim-v2';

/* Relative, so the same worker serves a GitHub Pages project subpath
   (user.github.io/repo/) and a domain root without edit. */
const CORE = [
  'pwa-index.html',
  'manifest.json',
  'icon-512.png'
];

/* Three.js, OrbitControls and Chart.js. They are versioned URLs, so once they
   are in the cache they never need revalidating. */
const VENDOR = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      /* the app shell must all be there or the install is not worth having;
         the vendor scripts are best-effort, because a CDN that is briefly
         unreachable should not stop the worker installing at all */
      cache.addAll(CORE).then(() =>
        Promise.all(VENDOR.map(url =>
          cache.add(new Request(url, { mode: 'cors' })).catch(() => null)))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        /* Only store what is worth storing. An opaque cross-origin response
           has a status of 0 and no readable body, so caching it would put an
           unusable entry in front of a URL that works. */
        if (res && res.status === 200 && res.type !== 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        /* offline and not cached: a navigation still gets the app shell, so
           the simulator opens rather than showing the browser's error page */
        if (req.mode === 'navigate') return caches.match('pwa-index.html');
        return Response.error();
      });
    })
  );
});
