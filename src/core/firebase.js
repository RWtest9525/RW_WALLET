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
        
        // Initialize Firestore with Persistent Cache
        let db;
        if (window.db) {
            db = window.db;
        } else {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache()
            });
        }
        
        const storage = getStorage(app);
        let messaging = null;
        try {
            messaging = getMessaging(app);
        } catch(e) {
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
        
        // Start Auth state change listener
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // If impersonating a sub-admin, use their UID for all Firestore listeners
                const isImpersonating = !!localStorage.getItem('impersonated_sub_admin_uid');
                const effectiveUid = isImpersonating ? localStorage.getItem('impersonated_sub_admin_uid') : user.uid;

                if (!isImpersonating) {
                    currentUser = user;
                }
                localStorage.setItem('lastLoggedInUser', user.uid);
                
                // OneSignal user identification
                if (window.OneSignalManager) {
                    window.OneSignalManager.login(user.uid);
                    if (user.email) {
                        window.OneSignalManager.setEmail(user.email);
                    }
                }
                
                // Set persistence
                setPersistence(auth, browserLocalPersistence).catch(e => console.warn("Persistence set failed:", e));
                
                // Realtime user profile listener — uses effectiveUid (sub-admin uid when impersonating)
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, effectiveUid);
                onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        currentUserData = userData;
                        localStorage.setItem(`rw_wallet_user_cache_${effectiveUid}`, JSON.stringify(userData));
                        
                        // Hydrate UI elements
                        const balanceEl = document.getElementById('user-balance');
                        const adminBalanceEl = document.getElementById('admin-wallet-balance');
                        if (balanceEl && typeof formatCompactInr === 'function') balanceEl.textContent = formatCompactInr(userData.balance || 0);
                        if (adminBalanceEl && typeof formatCompactInr === 'function') adminBalanceEl.textContent = formatCompactInr(userData.balance || 0);
                        
                        // Skip blocked/pending checks for impersonated sessions
                        if (!isImpersonating) {
                            if (userData.isFlagged || userData.isDisabled) {
                                if (typeof showBlockedAccountPage === 'function') showBlockedAccountPage(userData);
                            } else if (userData.approvalStatus === 'pending' || userData.signupApprovalStatus === 'pending' || userData.accountStatus === 'pending_approval') {
                                if (typeof showVerificationPendingPage === 'function') showVerificationPendingPage(userData);
                            } else if (userData.approvalStatus === 'rejected' || userData.signupApprovalStatus === 'rejected' || userData.accountStatus === 'rejected') {
                                if (typeof showVerificationPendingPage === 'function') showVerificationPendingPage(userData);
                            } else {
                                // If page was blocked/pending, return to dashboard
                                if (document.getElementById('verification-pending-container') || document.getElementById('dashboard-content')?.classList.contains('hidden')) {
                                    document.getElementById('dashboard-content')?.classList.remove('hidden');
                                    document.getElementById('bottom-nav')?.classList.remove('hidden');
                                    const pageContainer = document.getElementById('page-container');
                                    if (pageContainer) {
                                        pageContainer.innerHTML = '';
                                        pageContainer.classList.add('hidden');
                                    }
                                }
                            }
                        }
                    }
                });
                
                // Realtime transactions history listener — uses effectiveUid
                const txQuery = query(
                    collection(db, `artifacts/${appId}/public/data/users/${effectiveUid}/transactions`),
                    orderBy('timestamp', 'desc'),
                    firestoreLimit(FIRESTORE_TRANSACTION_READ_LIMIT)
                );
                onSnapshot(txQuery, (snap) => {
                    const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    unifiedHistoryCache = txs;
                    if (typeof renderTransactionsList === 'function') {
                        renderTransactionsList(txs);
                    }
                });
                
                // Initialize messaging/notifications
                if (typeof setupPushNotifications === 'function') setupPushNotifications();
                if (typeof setupNotificationMessageListener === 'function') setupNotificationMessageListener();
                
                // Hydrate dashboard
                if (typeof showHomeMainPage === 'function') showHomeMainPage();
            } else {
                currentUser = null;
                currentUserData = null;
                localStorage.removeItem('lastLoggedInUser');
                
                // OneSignal logout
                if (window.OneSignalManager) {
                    window.OneSignalManager.logout();
                }
                
                if (typeof handleSignOut === 'function') handleSignOut();
            }
        });
        
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
