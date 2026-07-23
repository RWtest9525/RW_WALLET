// File: src/core/onesignal.js

const ONESIGNAL_APP_ID = "465e22bd-8540-437b-ba7b-efa14ef4069f";

let isOneSignalInitSuccessful = false;

export const OneSignalManager = {
    init: () => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            try {
                console.log("Initializing OneSignal SDK...");
                await OneSignal.init({
                    appId: ONESIGNAL_APP_ID,
                    allowLocalhostAsSecureOrigin: true
                });
                console.log("OneSignal SDK initialized successfully!");
                isOneSignalInitSuccessful = true;
            } catch (err) {
                console.error("OneSignal init error:", err);
                isOneSignalInitSuccessful = false;
            }

            // Register push subscription observer
            try {
                if (isOneSignalInitSuccessful && OneSignal.User && OneSignal.User.PushSubscription) {
                    OneSignal.User.PushSubscription.addEventListener("change", (event) => {
                        console.log("OneSignal Push Subscription changed:", event);
                    });
                }
            } catch (err) {
                console.error("OneSignal subscription observer error:", err);
            }

            // Register notification click listener
            try {
                OneSignal.Notifications.addEventListener("click", (event) => {
                    console.log("OneSignal Notification Clicked:", event);
                    const data = event.notification?.additionalData;
                    if (data) {
                        if (data.type === 'chat') {
                            if (window.currentUser && typeof window.openSupportChatPage === 'function') {
                                const currentUser = window.currentUser;
                                const ADMIN_UID = window.ADMIN_UID || 'REVIEWS_WORLD_ADMIN';
                                const isAdmin = currentUser.uid === ADMIN_UID || (window.currentUserData && (window.currentUserData.role === 'admin' || window.currentUserData.isAdmin));
                                if (isAdmin) {
                                    window.openSupportChatPage(data.userId, 'admin', {
                                        roomId: data.roomId,
                                        userName: data.userName || 'User'
                                    });
                                } else {
                                    window.openSupportChatPage(currentUser.uid, 'user', {
                                        adminId: data.adminId || ADMIN_UID
                                    });
                                }
                            } else {
                                window.pendingChatNotification = data;
                            }
                        } else if (data.type === 'transaction') {
                            if (window.currentUser && typeof window.showAllTransactionsPage === 'function') {
                                window.showAllTransactionsPage();
                            } else {
                                window.pendingTransactionNotification = true;
                            }
                        } else if (data.type === 'admin_withdrawal') {
                            if (window.currentUser && typeof window.showAdminWithdrawalsPage === 'function') {
                                window.showAdminWithdrawalsPage();
                            } else {
                                window.pendingAdminWithdrawalNotification = true;
                            }
                        } else if (data.type === 'task') {
                            if (window.currentUser) {
                                if (data.taskId && typeof window.showUserTaskDetailsPage === 'function') {
                                    window.showUserTaskDetailsPage(data.taskId);
                                } else if (typeof window.showUserTaskPage === 'function') {
                                    window.showUserTaskPage();
                                }
                            } else {
                                window.pendingTaskNotification = data;
                            }
                        } else if (data.type === 'user_approval') {
                            if (window.currentUser && typeof window.showAdminUsersPage === 'function') {
                                window.showAdminUsersPage();
                                if (typeof window.switchUsersTab === 'function') {
                                    window.switchUsersTab('approvals');
                                }
                            } else {
                                window.pendingUserApprovalNotification = true;
                            }
                        }
                    }
                });
            } catch (err) {
                console.error("OneSignal click listener error:", err);
            }
        });
    },

    // Safe execution helper that handles native plugin bridges (Cordova/Capacitor) and deferred Web SDK execution
    executeSafely: (fn) => {
        // 1. Try native Cordova/Capacitor plugin if available
        if (window.plugins && window.plugins.OneSignal) {
            try {
                fn(window.plugins.OneSignal);
            } catch (err) {
                // Catch silently
            }
        }
        // 2. Try direct injected window.OneSignal instance
        if (window.OneSignal) {
            try {
                fn(window.OneSignal);
            } catch (err) {
                // Catch silently
            }
        }

        // 3. Defer for Web SDK execution (for web browser environment)
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            try {
                await fn(OneSignal);
            } catch (err) {
                // Catch silently
            }
        });
    },

    // Manage user identity
    login: (userId) => {
        if (!userId) return;
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal logging in external user:", userId);
            if (typeof OneSignal.login === 'function') {
                await OneSignal.login(userId);
            }
            if (OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === 'function') {
                await OneSignal.Notifications.requestPermission();
            }
            console.log("OneSignal login completed successfully!");
        });
    },

    requestPermission: () => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            if (OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === 'function') {
                await OneSignal.Notifications.requestPermission();
            }
        });
    },

    logout: () => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal logging out user");
            if (typeof OneSignal.logout === 'function') {
                await OneSignal.logout();
            }
        });
    },

    // Manage user tags
    setTags: (tags) => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal setting tags:", tags);
            if (OneSignal.User && typeof OneSignal.User.addTags === 'function') {
                await OneSignal.User.addTags(tags);
            } else if (typeof OneSignal.sendTags === 'function') {
                await OneSignal.sendTags(tags);
            }
        });
    },

    removeTags: (tagKeys) => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal removing tags:", tagKeys);
            if (OneSignal.User && typeof OneSignal.User.removeTags === 'function') {
                await OneSignal.User.removeTags(tagKeys);
            } else if (typeof OneSignal.deleteTags === 'function') {
                await OneSignal.deleteTags(tagKeys);
            }
        });
    },

    // Handle email subscriptions
    setEmail: (email) => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal adding email:", email);
            if (OneSignal.User && typeof OneSignal.User.addEmail === 'function') {
                await OneSignal.User.addEmail(email);
            } else if (typeof OneSignal.setEmail === 'function') {
                await OneSignal.setEmail(email);
            }
        });
    },

    removeEmail: () => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal removing email");
            if (OneSignal.User && typeof OneSignal.User.removeEmail === 'function') {
                await OneSignal.User.removeEmail();
            }
        });
    },

    // Handle SMS subscriptions
    setSms: (smsNumber) => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal adding SMS:", smsNumber);
            if (OneSignal.User && typeof OneSignal.User.addSms === 'function') {
                await OneSignal.User.addSms(smsNumber);
            }
        });
    },

    removeSms: () => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal removing SMS");
            if (OneSignal.User && typeof OneSignal.User.removeSms === 'function') {
                await OneSignal.User.removeSms();
            }
        });
    },

    linkUserPushIdentity: (userId) => {
        if (!userId) return;
        console.log("[OneSignalManager] Linking user push identity for:", userId);

        OneSignalManager.login(userId);
        OneSignalManager.setTags({ userId: userId });

        if (window.JSInterface) {
            try {
                if (typeof window.JSInterface.setExternalUserId === 'function') {
                    window.JSInterface.setExternalUserId(userId);
                    console.log("JSInterface.setExternalUserId called for user:", userId);
                }
            } catch (e) {
                console.warn("JSInterface.setExternalUserId failed:", e);
            }
            try {
                if (typeof window.JSInterface.setOneSignalExternalUserId === 'function') {
                    window.JSInterface.setOneSignalExternalUserId(userId);
                }
            } catch (e) {}
            try {
                if (typeof window.JSInterface.setOneSignalTag === 'function') {
                    window.JSInterface.setOneSignalTag("userId", userId);
                }
            } catch (e) {}
            try {
                if (typeof window.JSInterface.sendOneSignalTag === 'function') {
                    window.JSInterface.sendOneSignalTag("userId", userId);
                }
            } catch (e) {}
        }

        try {
            if (/iphone|ipad|ipod|android/i.test(navigator.userAgent.toLowerCase())) {
                const iframe1 = document.createElement('iframe');
                iframe1.style.display = 'none';
                iframe1.src = `onesignal://external_user_id?id=${encodeURIComponent(userId)}`;
                document.body.appendChild(iframe1);
                setTimeout(() => iframe1.remove(), 800);

                const iframe2 = document.createElement('iframe');
                iframe2.style.display = 'none';
                iframe2.src = `onesignal://tag?key=userId&value=${encodeURIComponent(userId)}`;
                document.body.appendChild(iframe2);
                setTimeout(() => iframe2.remove(), 800);
            }
        } catch (e) {}
    },

    // Control logging levels
    setLogLevel: (level) => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal setting debug log level to:", level);
            if (OneSignal.Debug && typeof OneSignal.Debug.setLogLevel === 'function') {
                OneSignal.Debug.setLogLevel(level);
            }
        });
    }
};

window.OneSignalManager = OneSignalManager;

// Initialize OneSignal
OneSignalManager.init();
