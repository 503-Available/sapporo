/* =========================================================
   오프라인 지원 (NFR-03)
   - 앱 화면 파일: 저장해 둔 것을 먼저 사용 (빠름, 오프라인 OK)
   - 여행 데이터(trip.json): 인터넷이 되면 최신본, 안 되면 저장본
   파일을 수정해서 다시 올릴 때는 VERSION 숫자를 올려 주세요.
   ========================================================= */
var VERSION = 'v1';
var CACHE = 'sapporo2026-' + VERSION;
var FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'data/trip.json',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // 여행 데이터는 최신 우선 (network-first)
  if (req.url.indexOf('data/trip.json') !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('data/trip.json', copy); });
        return res;
      }).catch(function () { return caches.match('data/trip.json'); })
    );
    return;
  }

  // 나머지는 저장본 우선 (cache-first)
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    })
  );
});
