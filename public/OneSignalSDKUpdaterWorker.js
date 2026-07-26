/* ================================================================
 * OneSignalSDKUpdaterWorker.js
 * Exact mirror of OneSignalSDKWorker.js.
 * OneSignal SDK looks for BOTH files at scope. If updater is missing,
 * the SDK falls back to Worker-only mode but some browsers show
 * console warnings. Keep identical for best compatibility.
 * ================================================================ */

'use strict';

/* 1. TOP LEVEL message handler */
self.addEventListener('message', function onWorkerMessageTopLevel(event) {
  try {
    var data = (event && event.data) ? event.data : null;
    if (!data) return;
    if (data.type === 'rw:ping') {
      if (event.ports && event.ports[0]) {
        try { event.ports[0].postMessage({ type: 'rw:pong', ts: Date.now() }); } catch (_) {}
      }
    }
  } catch (e) {
    try { console.error('[OneSignalSDKUpdaterWorker.js] message handler error:', e); } catch (_) {}
  }
});

/* 2. TOP LEVEL notificationclick */
self.addEventListener('notificationclick', function onNotificationClickTopLevel(event) {
  try {
    event.notification.close();
    var targetUrl = (event.notification && event.notification.data) ? (event.notification.data.url || event.notification.data.launchURL || '/') : '/';
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
    try { console.warn('[OneSignalSDKUpdaterWorker.js] notificationclick error:', e); } catch (_) {}
  }
});

/* 3. TOP LEVEL OneSignal SDK SW import */
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (importErr) {
  try {
    console.warn('[OneSignalSDKUpdaterWorker.js] importScripts() for OneSignal SDK SW failed:', importErr && importErr.message ? importErr.message : importErr);
  } catch (_) {}
}

/* 4. install / activate */
self.addEventListener('install', function () {
  try { self.skipWaiting(); } catch (_) {}
});
self.addEventListener('activate', function (event) {
  try {
    event.waitUntil(
      Promise.resolve().then(function () {
        try { self.clients.claim(); } catch (_) {}
      })
    );
  } catch (_) {}
});
