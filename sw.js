const CACHE_NAME = 'my-game-v1';

// 這裡列出所有遊戲需要用到的檔案和網址
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

// 1. 安裝：把東西存起來
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. 取用：當網頁要東西時，先看看盒子裡有沒有
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果盒子裡有，就直接給（這樣沒網路也能跑！）
        if (response) {
          return response;
        }
        // 如果沒有，就去網路抓
        return fetch(event.request);
      })
  );
});

// 3. 更新：如果有新版本，就把舊的盒子清掉
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});