// [Final Version] Tag 455667 Chess - Service Worker
const CACHE_PREFIX = 'tag-455667-chess-';
const CACHE_VERSION = 'v3-hotfix'; 
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// 核心資源：必須全部下載成功，App 才能安裝 (包含 index.html 和 JS 庫)
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // 外部工具庫 (React 18.2.0 & Tailwind)
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

// 選用資源：即使下載失敗，也不會阻止 App 安裝 (例如 Icon 和 背景圖)
const OPTIONAL_ASSETS = [
  './icon.png',
  'https://www.transparenttextures.com/patterns/cream-paper.png',
  'https://www.transparenttextures.com/patterns/lined-paper-2.png'
];

// 1. 安裝事件 (Install)
self.addEventListener('install', (event) => {
  console.log(`[Service Worker] 安裝中... ${CACHE_NAME}`);
  self.skipWaiting(); // 強制接管，讓更新立刻生效

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 嘗試下載選用資源，如果失敗則忽略 (不會導致安裝失敗)
      cache.addAll(OPTIONAL_ASSETS).catch(err => console.warn('選用資源下載略過 (非致命):', err));
      
      // 強制下載核心資源，任何一個失敗都會導致安裝中止
      return cache.addAll(CORE_ASSETS);
    })
  );
});

// 2. 啟用事件 (Activate)
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 啟用中... 智能清理舊快取');
  event.waitUntil(
    Promise.all([
      self.clients.claim(), // 立即控制所有頁面
      caches.keys().then((keys) => Promise.all(
        keys.map((key) => {
          // 只刪除 "屬於本 App" 且 "版本過舊" 的快取
          // 這樣就不會誤刪同網域下其他 App 的快取了
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            console.log('[Service Worker] 刪除舊版快取:', key);
            return caches.delete(key);
          }
        })
      ))
    ])
  );
});

// 3. 攔截請求 (Fetch)
self.addEventListener('fetch', (event) => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // 判斷是否為 "網頁本體" (HTML)
  const isHTML = event.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // 【策略 A：Stale-While-Revalidate】 (針對 HTML)
    // 優先給舊快取 (秒開)，同時在背景下載新的並更新快取 (下次開就是新的)
    
    const fetchPromise = fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
      }
      return networkResponse;
    }).catch(() => {
      console.log('[Service Worker] 離線模式: 無法更新 HTML，使用舊版');
    });

    // 告訴瀏覽器：「別殺我，我還在下載更新！」
    event.waitUntil(fetchPromise);

    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        // 如果有快取就用快取，沒有才等待網路請求
        return cachedResponse || fetchPromise;
      })
    );
  } else {
    // 【策略 B：Cache First】 (針對圖片、JS 庫)
    // 優先找雪櫃，沒有才上網買
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then((networkResponse) => {
          // 允許 opaque (跨域圖片，status 0) 通過
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
