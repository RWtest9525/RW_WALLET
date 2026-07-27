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

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background push:', payload);
  const title = (payload && payload.notification && payload.notification.title) || 'REVIEWS WORLD';
  const data = (payload && payload.data) ? payload.data : {};
  const roomId = data.roomId || data.room_id || '';
  const clickUrl = data.url || (roomId ? `/#chat?room=${roomId}` : '/');

  const options = {
    body: (payload && payload.notification && payload.notification.body) || '',
    icon: '/assets/images/logo_512.png',
    badge: '/assets/images/notification_bell.png',
    data: Object.assign({}, data, { url: clickUrl, roomId: roomId })
  };

  return self.registration.showNotification(title, options);
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
