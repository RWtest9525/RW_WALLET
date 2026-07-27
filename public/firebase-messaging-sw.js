importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBzF1agrBFFh4cC2DkmZKePf4-gjE05OQo",
  authDomain: "review-world-1312e.firebaseapp.com",
  projectId: "review-world-1312e",
  storageBucket: "review-world-1312e.firebasestorage.app",
  messagingSenderId: "372772434173",
  appId: "1:372772434173:web:bfeb08e0c96886ace94"
});

const messaging = firebase.messaging();

function showPushNotification(payload) {
  console.log('[firebase-messaging-sw.js] Processing push payload:', payload);
  const data = (payload && payload.data) ? payload.data : {};
  const notification = (payload && payload.notification) ? payload.notification : {};

  const title = notification.title || data.title || 'REVIEWS WORLD';
  const body = notification.body || data.body || data.message || '';
  const roomId = data.roomId || data.room_id || '';
  const clickUrl = data.url || (roomId ? `/#chat?room=${roomId}` : '/');

  const options = {
    body: body,
    icon: '/assets/images/logo_512.png',
    badge: '/assets/images/notification_bell.png',
    vibrate: [200, 100, 200],
    data: Object.assign({}, data, { url: clickUrl, roomId: roomId }),
    tag: roomId || 'rw-chat-push'
  };

  return self.registration.showNotification(title, options);
}

messaging.onBackgroundMessage(function(payload) {
  return showPushNotification(payload);
});

self.addEventListener('push', function(event) {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    console.log('[firebase-messaging-sw.js] Push event caught:', payload);
    event.waitUntil(showPushNotification(payload));
  } catch (e) {
    console.warn('[firebase-messaging-sw.js] Non-JSON push event:', event.data.text());
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  event.notification.close();

  const data = event.notification.data || {};
  const roomId = data.roomId || data.room_id || '';
  const targetUrl = data.url || (roomId ? `/#chat?room=${roomId}` : '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (roomId && typeof client.postMessage === 'function') {
            client.postMessage({ type: 'OPEN_CHAT_ROOM', roomId: roomId, data: data });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
