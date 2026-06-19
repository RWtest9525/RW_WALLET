// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

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
        icon: payload.notification?.icon || '/src/assets/logo.png',
        badge: '/src/assets/logo.png',
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
