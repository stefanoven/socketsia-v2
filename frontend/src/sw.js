/**
 * Custom Service Worker — SurveyeSSM
 * Uses Workbox for precaching (injected by VitePWA) + Web Push handler.
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Clean up old precache entries on activation
cleanupOutdatedCaches();

// Workbox will inject the precache manifest here at build time
precacheAndRoute(self.__WB_MANIFEST);

// ── Push notification handler ───────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'SurveyeSSM', body: event.data.text(), url: '/' }; }

  const {
    title = 'SurveyeSSM',
    body  = '',
    url   = '/',
    icon  = '/favicon.svg',   // default icon; each event type passes its own
  } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/sy20.png',      // small monochrome icon for the notification bar
      vibrate: [200, 100, 200],
      data: { url },
      requireInteraction: true,
    }),
  );
});

// ── Notification click: open/focus the app ──────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          return existing.navigate(targetUrl);
        }
        return clients.openWindow(targetUrl);
      }),
  );
});
