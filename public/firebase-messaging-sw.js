// Firebase Messaging Service Worker
try {
    importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (e) {
    console.warn('[firebase-messaging-sw.js] OneSignal SW import skipped:', e);
}

try {
    importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');
} catch (e) {
    console.warn('[firebase-messaging-sw.js] Firebase SW import skipped:', e);
}

firebase.initializeApp({
    apiKey: "AIzaSyBzF1agrBFFh4cC2DkmZKePf4-gjE05OQo",
    authDomain: "review-world-1312e.firebaseapp.com",
    projectId: "review-world-1312e",
    storageBucket: "review-world-1312e.firebasestorage.app",
    messagingSenderId: "372772434173",
    appId: "1:372772434173:web:bfeb08e0c96886ace94",
    measurementId: "G-X90GP8JTL8"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background message received:', payload);
    
    const notificationTitle = payload.notification?.title || 'Review World Update';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new update.',
        icon: payload.notification?.icon || 'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg',
        badge: 'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg',
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const customData = event.notification?.data;
    let urlToOpen = '/';
    if (customData?.type === 'chat') {
        urlToOpen = '/#support';
    }
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
