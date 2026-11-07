// 見せる翻訳 service worker
// 画面の外側（HTML・アイコン等）だけをキャッシュし、開く速さとオフライン表示に使う。
// 翻訳APIなど外部への通信はキャッシュしない。
var CACHE_NAME = "miseru-honyaku-v8";
var SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  var isPage =
    event.request.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html");
  if (isPage) {
    // ページ本体はネットワーク優先にする（更新が次の起動で確実に届くように）。失敗した時だけキャッシュを使う。
    event.respondWith(
      fetch(event.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return res;
      }).catch(function () {
        return caches.match(event.request, { ignoreSearch: true });
      })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (hit) {
      var network = fetch(event.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return res;
      }).catch(function () {
        return hit;
      });
      return hit || network;
    })
  );
});
