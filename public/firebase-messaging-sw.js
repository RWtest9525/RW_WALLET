/* ================================================================
 * firebase-messaging-sw.js
 * TOP LEVEL message handler per browser SW spec.
 * Used when Firebase Messaging is enabled for browser push.
 * ================================================================ */

'use strict';

/* 1. TOP LEVEL message handler */
self.addEventListener('message', function onFcmSwMessageTopLevel(event) {
  try {
    if (!event || !event.data) return;
    var data = event.data;
    if (data && data.type === 'rw:ping') {
      if (event.ports && event.ports[0]) {
        try { event.ports[0].postMessage({ type: 'rw:pong', ts: Date.now(), from: 'firebase-messaging-sw' }); } catch (_) {}
      }
    }
  } catch (e) {
    try { console.warn('[firebase-messaging-sw.js] message handler error:', e); } catch (_) {}
  }
});

/* 2. Optional TOP LEVEL importScripts for Firebase Messaging SW (if you ever host it) */
/* importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-sw.js'); */

/* 3. Foreground/background notification display */
self.addEventListener('push', function onPushTopLevel(event) {
  try {
    if (!event || !event.data) return;
    var payload = {};
    try {
      payload = event.data.json() || {};
    } catch (_) {
      try { payload = { body: event.data.text() }; } catch (__) {}
    }
    var title = (payload && payload.notification && payload.notification.title) ? payload.notification.title :
                (payload && payload.title) ? payload.title :
                'REVIEWS WORLD';
    var body = (payload && payload.notification && payload.notification.body) ? payload.notification.body :
               (payload && payload.body) ? payload.body :
               '';
    if (!body) return;
    var options = {
      body: body,
      icon: '/assets/images/notification_bell.png',
      badge: '/assets/images/logo_192.png',
      data: payload.data || payload || {},
      requireInteraction: false,
      tag: payload.tag || ('rw-notif-' + Date.now())
    };
    if (self.registration && self.registration.showNotification) {
      event.waitUntil(self.registration.showNotification(title, options));
    }
  } catch (e) {
    try { console.warn('[firebase-messaging-sw.js] push handler error:', e); } catch (_) {}
  }
});

self.addEventListener('notificationclick', function (event) {
  try {
    event.notification.close();
    var targetUrl = (event.notification && event.notification.data) ? (event.notification.data.url || event.notification.data.click_action || '/') : '/';
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
        try {
          for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if (client && 'focus' in client) {
              try {
                return client.focus().then(function () {
                  try { if (client && 'navigate' in client) return client.navigate(targetUrl); } catch (_) {}
                }).catch(function () {
                  try { if (self.clients.openWindow) return self.clients.openWindow(targetUrl); } catch (__) {}
                });
              } catch (_) {}
            }
          }
        } catch (_) {}
        try { if (self.clients.openWindow) return self.clients.openWindow(targetUrl); } catch (_) { return null; }
        return null;
      })
    );
  } catch (e) {
    try { console.warn('[firebase-messaging-sw.js] notificationclick error:', e); } catch (_) {}
  }
});

self.addEventListener('install', function () { try { self.skipWaiting(); } catch (_) {} });
self.addEventListener('activate', function (event) {
  try {
    event.waitUntil(
      Promise.resolve().then(function () { try { self.clients.claim(); } catch (_) {} })
    );
  } catch (_) {}
});
