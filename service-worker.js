/* =========================================================
   오프라인 지원 (NFR-03)
   - 앱 화면 파일: 저장해 둔 것을 먼저 사용 (빠름, 오프라인 OK)
   - 여행 데이터(trip.json): 인터넷이 되면 최신본, 안 되면 저장본
   파일을 수정해서 다시 올릴 때는 VERSION 숫자를 올려 주세요.
   ========================================================= */
var VERSION = 'v10';
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
  'icons/apple-touch-icon.png',
  'img/cover-day1.jpg',
  'img/cover-day2.jpg',
  'img/cover-day3.jpg',
  'img/cover-day4.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('sapporo2026-') === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // 글꼴(Pretendard, jsdelivr CDN)은 한 번 받으면 저장해 두고 오프라인에서도 사용
  if (new URL(req.url).hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
          return res;
        });
      })
    );
    return;
  }
  if (new URL(req.url).origin !== location.origin) return;

  // 여행 데이터는 최신 우선 (network-first)
  if (req.url.indexOf('data/trip.json') !== -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (!res.ok) throw new Error(res.status);
        // JSON이 정상일 때만 저장본을 교체 (수정 실수로 저장본이 망가지지 않게)
        var copy = res.clone();
        return res.clone().json().then(function () {
          return caches.open(CACHE).then(function (c) { return c.put('data/trip.json', copy); });
        }).then(function () { return res; });
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
