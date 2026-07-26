/* ================================================================
 * OneSignalSDKWorker.js
 * IMPORTANT RULES (per browser + OneSignal technical spec):
 *   1. The 'message' event handler MUST be added at the TOP LEVEL
 *      of this worker script — NOT inside an async callback,
 *      NOT inside a conditional, NOT wrapped in a Promise.then().
 *      Violation = browser shows:
 *        "Event handler of 'message' event must be added on the
 *         initial evaluation of worker script."
 *   2. importScripts() for the OneSignal SW SDK must also happen
 *      synchronously AT TOP LEVEL evaluation.
 * ================================================================ */

'use strict';

/* ---------- 1. TOP-LEVEL message event listener (REQUIRED) ----------
 * Placed BEFORE any other code. This handler allows the main thread
 * (and any Android WebView wrapper) to post messages directly to
 * the service worker. You can add custom handling here.
 */
self.addEventListener('message', function onWorkerMessageTopLevel(event) {
  try {
    var data = (event && event.data) ? event.data : null;
    if (!data) return;

    if (data && data.type === 'rw:ping') {
      if (event.ports && event.ports[0]) {
        try { event.ports[0].postMessage({ type: 'rw:pong', ts: Date.now() }); } catch (_) {}
      }
      return;
    }

    if (data && data.type === 'rw:notification:click' && data.action) {
      try {
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(function (clientList) {
            try {
              for (var i = 0; i < clientList.length; i++) {
                try { clientList[i].postMessage({ type: 'rw:notification:action', action: data.action, payload: data.payload || {} }); } catch (_) {}
              }
            } catch (_) {}
          })
          .catch(function () {});
      } catch (_) {}
      return;
    }
  } catch (e) {
    try { console.error('[OneSignalSDKWorker.js] message handler error:', e); } catch (_) {}
  }
});

/* ---------- 2. TOP-LEVEL notificationclick handler (common UX) ---------- */
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
    try { console.warn('[OneSignalSDKWorker.js] notificationclick error:', e); } catch (_) {}
  }
});

/* ---------- 3. TOP-LEVEL importScripts for OneSignal SDK Service Worker ----------
 * OneSignal v16 SW SDK. MUST be top-level synchronous import.
 * NOTE: Some older WebView/Chromium versions dislike loading SW SDKs
 * from a different origin via importScripts. If you see SW registration
 * failures on certain devices, host this file locally instead.
 */
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (importErr) {
  try {
    console.warn('[OneSignalSDKWorker.js] importScripts() for OneSignal SDK SW failed. Push delivery may fall back to page-scope display. Error:', importErr && importErr.message ? importErr.message : importErr);
  } catch (_) {}
}

/* ---------- 4. install / activate (keep SW fresh for APK WebView) ---------- */
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
