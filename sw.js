// 서비스 워커 — 앱 파일을 캐시해서 오프라인에서도 동작하게 한다.
// 앱 파일: 네트워크 우선 + HTTP 캐시 무시(항상 서버에 새 버전 확인), 4초 안에 안 오면 캐시.
// vendor/ (큰 라이브러리·OCR 데이터): 캐시 우선. 버전이 바뀌어도 다시 받지 않게 따로 보관.
// 같은 출처(origin) 요청만 다루고, 외부 요청은 하지 않는다.
// 버전 올릴 때 js/util.js의 APP_VERSION도 같이 바꾼다.

const VERSION = 'v13';
const APP_CACHE = `gifticon-${VERSION}`;
const VENDOR_CACHE = 'gifticon-vendor-1'; // vendor 파일을 바꾸면 숫자를 올린다
const NET_TIMEOUT = 4000;

const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/util.js',
  './js/image.js',
  './js/form.js',
  './js/brands.js',
  './js/barcode.js',
  './js/detail.js',
  './js/backup.js',
  './js/ics.js',
  './js/scan.js',
  './js/ocr.js',
  './js/parse.js',
  './js/notify.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];
const VENDOR_FILES = [
  './vendor/zxing/zxing.min.js',
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/tesseract/tesseract-core-simd-lstm.js',
  './vendor/tesseract/tesseract-core-simd-lstm.wasm',
  './vendor/tesseract/lang/kor.traineddata.gz',
  './vendor/tesseract/lang/eng.traineddata.gz',
];

// HTTP 캐시(GitHub Pages는 10분)를 건너뛰고 서버에서 직접 받는다
const fresh = (url) => new Request(url, { cache: 'reload' });

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const app = await caches.open(APP_CACHE);
    await app.addAll(APP_FILES.map(fresh));
    const vendor = await caches.open(VENDOR_CACHE);
    for (const f of VENDOR_FILES) {
      if (await vendor.match(f)) continue;                 // 이미 있으면 다시 안 받음
      const old = await caches.match(f, { ignoreSearch: true }); // 옛 버전 캐시에 있으면 복사 (8MB 다시 받지 않게)
      if (old) await vendor.put(f, old);
      else await vendor.add(fresh(f));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = [APP_CACHE, VENDOR_CACHE];
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('gifticon-') && !keep.includes(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(req) {
  const cache = await caches.open(APP_CACHE);
  const key = req.url.split('#')[0];
  const fromCache = async () => {
    const hit = await cache.match(key, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return cache.match('./index.html');
    return null;
  };
  const net = fetch(new Request(key, { cache: 'no-cache', credentials: 'same-origin' }))
    .then((res) => { if (res.ok) cache.put(key, res.clone()); return res; });
  // 4초 안에 응답이 없으면 캐시 (느린 네트워크에서 앱이 멈춘 것처럼 보이지 않게)
  const timeout = new Promise((r) => setTimeout(r, NET_TIMEOUT, 'timeout'));
  try {
    const first = await Promise.race([net, timeout]);
    if (first !== 'timeout') return first;
    return (await fromCache()) || (await net);
  } catch {
    const hit = await fromCache();
    if (hit) return hit;
    throw new Error('offline');
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VENDOR_CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(url.pathname.includes('/vendor/') ? cacheFirst(req) : networkFirst(req));
});
