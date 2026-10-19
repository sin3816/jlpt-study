// 서비스 워커: 앱 파일을 모두 미리 저장해 두고 오프라인에서도 실행되게 한다.
// 버전과 파일 목록은 scripts/build-web.js 가 빌드할 때 채운다.
const VERSION = '__VERSION__';
const CACHE = `jlpt-study-${VERSION}`;
const FILES = __FILES__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('jlpt-study-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // GitHub API 등은 그대로 네트워크로
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html');
      return fetch(req);
    }),
  );
});
