/* 旅圖 TripCanvas — Service Worker（離線支援）
 * 行程資料本來就存在瀏覽器（localStorage），這裡把網站外殼也快取起來，
 * 沒有網路時一樣能打開網站查看行程、清單、記帳、電話與地址。
 * 需要網路的功能（搜尋、同步、AI）離線時自然暫停，恢復連線後自動繼續。
 */
const CACHE = 'tripcanvas-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // API 都是 POST，不攔截

  const url = new URL(req.url);

  // 頁面導覽：先走網路拿最新版，斷線退回快取
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./', copy));
        return res;
      }).catch(() => caches.match('./').then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // 同源靜態檔與字型：快取優先，背景更新
  const isFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
  if (url.origin === self.location.origin || isFont) {
    e.respondWith(
      caches.match(req).then(hit => {
        const fresh = fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || fresh;
      })
    );
  }
  // 其他跨域請求（地圖/天氣/圖片等）不攔截
});
