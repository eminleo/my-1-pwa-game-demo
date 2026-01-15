// 更新版本號，強制瀏覽器抓新檔案
const CACHE_NAME = 'my-game-v2';

// 這是最重要的清單！缺一個就會黑畫面
// 我們要把外部的 React 工具也全部存下來
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  // 以下是外部資源，必須完整存下來
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

// 1. 安裝：這一步會花一點時間下載所有東西
self.addEventListener('install', (event) => {
  console.log('👷 Service Worker: 安裝中...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: 正在快取所有檔案');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // 強制新的 SW 立刻接手
  );
});

// 2. 啟動：清除舊版本的快取 (V1)
self.addEventListener('activate', (event) => {
  console.log('👷 Service Worker: 啟動中...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: 清除舊快取', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // 立刻控制頁面
});

// 3. 取用：離線優先策略 (Offline First)
// 有快取就用快取，沒快取才上網抓
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果快取裡有，直接回傳 (離線成功關鍵！)
        if (response) {
          return response;
        }
        // 沒快取才去網路抓
        return fetch(event.request).catch(() => {
            // 如果連網路都抓不到 (真的離線了)，且又不在快取裡
            // 這裡可以回傳一個自訂的離線頁面，但目前我們先保持簡單
            console.log('❌ 離線且找不到檔案:', event.request.url);
        });
      })
  );
});
