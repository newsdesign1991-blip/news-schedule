// 근무표 PWA 서비스워커 — 푸시 수신 + 알림 표시
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

// Keep the deployed app's existing network-first navigation behavior.
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => fetch(event.request)));
  }
});

self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (_) { d = { title: '근무 알림', body: event.data ? event.data.text() : '' }; }
  const title = d.title || '근무 알림';
  const opts = {
    body: d.body || '',
    icon: d.icon || 'icon-192.png',
    badge: d.badge || 'icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: d.data || { url: './' },
    vibrate: [80, 40, 80]
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope);
  if(url.origin!==self.location.origin)return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c && new URL(c.url).pathname.startsWith(new URL(self.registration.scope).pathname)) return c.navigate(url.href).then(w => w ? w.focus() : c.focus()); }
      if (self.clients.openWindow) return self.clients.openWindow(url.href);
    })
  );
});
