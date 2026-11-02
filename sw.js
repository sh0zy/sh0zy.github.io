const CACHE_NAME = 'goukaku-compass-v3';
const CORE_ASSETS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

// このSWはドメイン直下(scope "/")に登録されるため、同じドメインの別アプリ
// (/xbp/ や /waseda-route/、/focus-dock/ など)を横取りしないよう、自分のファイルだけを扱う
function isOwnRequest(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  return p === '/' || p === '/index.html' || p === '/manifest.webmanifest' || p.startsWith('/assets/') || p.startsWith('/icons/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 旧バージョン(v2)は別アプリのページまでキャッシュしていたので、ここで削除する
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!isOwnRequest(url)) return;

  // ページ本体は更新が届くようネットワーク優先、オフライン時だけキャッシュを返す
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  // ビルド済みアセット(ハッシュ付きファイル名)はキャッシュ優先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response.ok) return response; // 404等のエラーはキャッシュしない
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
