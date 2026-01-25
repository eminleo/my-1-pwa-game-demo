// [Version Bump] 升級為 v3-hotfix，強制重新快取修復後的 index.html
const CACHE_PREFIX = 'tag-455667-chess-';
const CACHE_VERSION = 'v3-hotfix'; 
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// 核心資源：與 index.html 保持嚴格一致
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // 外部工具庫 (React 18.2.0)
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

// 選用資源
const OPTIONAL_ASSETS = [
  './icon.png',
  'https://www.transparenttextures.com/patterns/cream-paper.png',
  'https://www.transparenttextures.com/patterns/lined-paper-2.png'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] 安裝中... Tag 455667 Chess (v3)');
  self.skipWaiting(); 

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      cache.addAll(OPTIONAL_ASSETS).catch(err => console.warn('選用資源下載略過:', err));
      return cache.addAll(CORE_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 啟用中... 清理舊快取');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => Promise.all(
        keys.map((key) => {
          // 只刪除 "屬於本 App (Tag 455667)" 且 "版本過舊" 的快取
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            console.log('[Service Worker] 刪除舊版快取:', key);
            return caches.delete(key);
          }
        })
      ))
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isHTML = event.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // 策略 A：Stale-While-Revalidate (HTML)
    const fetchPromise = fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
      }
      return networkResponse;
    }).catch(() => console.log('[Service Worker] 離線模式'));

    event.waitUntil(fetchPromise);

    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        return cachedResponse || fetchPromise;
      })
    );
  } else {
    // 策略 B：Cache First (靜態資源)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then((networkResponse) => {
          if (
            !networkResponse || 
            (networkResponse.status !== 200 && networkResponse.type !== 'opaque')
          ) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
  }
});
