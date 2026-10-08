/*
 * オフラインで遊べるようにするサービスワーカー（PWA）。追加ライブラリなし。
 * - はじめて入ったとき：トップのページと、そこから読みこむファイル（JS・CSS）をまとめて保存する
 * - ページ（HTML）：ネットにつながれば新しい版、つながらなければ保存した版
 * - ほかのファイル（名前に版の印が入った /assets/ など）：保存した版を使い、なければ取りに行って保存
 * 新しい版を公開すると、ネットにつながったときにページが新しい版になり、使うファイルも入れかわる。
 */
const CACHE = 'kenki-asobi-v1'

/** トップのページを取りに行き、ページと、ページが読みこむファイルを保存する */
async function cacheApp() {
  const cache = await caches.open(CACHE)
  const res = await fetch('/', { cache: 'no-store' })
  if (!res.ok) return
  const html = await res.clone().text()
  await cache.put('/', res)
  const urls = new Set(['/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/icon-180.png'])
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) urls.add(m[1])
  await Promise.all([...urls].map((u) => cache.add(u).catch(() => {})))
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheApp().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // ページ：ネット優先（新しい版）。つながらなければ保存した版
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          // 新しい版のファイルも、つながっているうちに保存しておく
          cacheApp().catch(() => {})
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // ファイル：保存した版を優先。なければ取りに行って保存
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
