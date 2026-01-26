// [Version Bump] 升級為 v5-final，強制更新所有客戶端的 index.html
const CACHE_PREFIX = 'tag-455667-chess-';
const CACHE_VERSION = 'v5-final'; 
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// 1. 絕對核心：自家檔案 (必須成功，否則 App 根本開不起來)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// 2. 外部資源：CDN (盡力下載，失敗也不要阻止安裝)
const EXTERNAL_LIBS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://www.transparenttextures.com/patterns/cream-paper.png',
  'https://www.transparenttextures.com/patterns/lined-paper-2.png'
];

self.addEventListener('install', (event) => {
  console.log(`[Service Worker] 安裝中... ${CACHE_NAME}`);
  self.skipWaiting(); // 強制接管，讓更新立刻生效

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 策略：分開處理
      
      // A. 外部資源：用 Promise.allSettled (允許失敗)
      // 就算 unpkg 掛了，也不會讓整個 install 流程崩潰
      const externalPromises = EXTERNAL_LIBS.map(url => 
        cache.add(url).catch(err => console.warn(`[SW] 外部資源下載失敗 (非致命): ${url}`, err))
      );
      await Promise.allSettled(externalPromises);

      // B. 核心資源：必須成功 (如果這裡失敗，那真的沒救了，讓它報錯)
      return cache.addAll(APP_SHELL);
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
          // 只刪除 "屬於本 App" 且 "版本過舊" 的快取
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
