// File: src/core/firebase.js

const initFirebaseApp = () => {
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyBzF1agrBFFh4cC2DkmZKePf4-gjE05OQo",
            authDomain: "review-world-1312e.firebaseapp.com",
            projectId: "review-world-1312e",
            storageBucket: "review-world-1312e.firebasestorage.app",
            messagingSenderId: "372772434173",
            appId: "1:372772434173:web:bfeb08e0c96886ace94",
            measurementId: "G-X90GP8JTL8"
        };
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);

        // Initialize Firestore with Persistent Single-Tab Cache (APK/Web Safe)
        let db;
        if (window.db) {
            db = window.db;
        } else {
            try {
                db = initializeFirestore(app, {
                    localCache: persistentLocalCache({
                        tabManager: persistentSingleTabManager({ forceOwnership: true })
                    })
                });
            } catch (cacheErr) {
                console.warn("Firebase.js persistent cache fallback:", cacheErr);
                try {
                    db = initializeFirestore(app, {
                        localCache: memoryLocalCache()
                    });
                } catch (_) {
                    db = initializeFirestore(app, {});
                }
            }
        }

        const storage = getStorage(app);
        let messaging = null;
        try {
            messaging = getMessaging(app);
        } catch (e) {
            console.warn("Messaging not supported on this browser.");
        }

        window.app = app;
        window.auth = auth;
        window.db = db;
        window.storage = storage;
        window.messaging = messaging;

        try {
            setLogLevel('error');
        } catch (e) {
            console.warn("Could not set Firebase log level:", e);
        }

        console.log("Firebase services initialized successfully with persistent cache.");
    } catch (error) {
        console.error("Firebase startup failed:", error);
    }
};

window.initFirebaseApp = initFirebaseApp;

// Auto-run on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebaseApp, { once: true });
} else {
    initFirebaseApp();
}
