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
  const options = {
    body: (payload && payload.notification && payload.notification.body) || '',
    icon: '/assets/images/logo_512.png',
    badge: '/assets/images/notification_bell.png',
    data: payload ? payload.data : {}
  };

  return self.registration.showNotification(title, options);
});
