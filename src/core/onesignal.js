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

    // Safe execution helper to avoid errors if initialization failed
    executeSafely: (fn) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            if (!isOneSignalInitSuccessful) {
                console.warn("OneSignal operation skipped: SDK not initialized successfully.");
                return;
            }
            try {
                await fn(OneSignal);
            } catch (err) {
                console.error("OneSignal operation error:", err);
            }
        });
    },

    // Manage user identity
    login: (userId) => {
        if (!userId) return;
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal logging in external user:", userId);
            await OneSignal.login(userId);
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
            await OneSignal.logout();
        });
    },

    // Manage user tags
    setTags: (tags) => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal setting tags:", tags);
            await OneSignal.User.addTags(tags);
        });
    },

    removeTags: (tagKeys) => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal removing tags:", tagKeys);
            await OneSignal.User.removeTags(tagKeys);
        });
    },

    // Handle email subscriptions
    setEmail: (email) => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal adding email:", email);
            await OneSignal.User.addEmail(email);
        });
    },

    removeEmail: () => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal removing email");
            await OneSignal.User.removeEmail();
        });
    },

    // Handle SMS subscriptions
    setSms: (smsNumber) => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal adding SMS:", smsNumber);
            await OneSignal.User.addSms(smsNumber);
        });
    },

    removeSms: () => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal removing SMS");
            await OneSignal.User.removeSms();
        });
    },

    // Control logging levels
    setLogLevel: (level) => {
        OneSignalManager.executeSafely(async (OneSignal) => {
            console.log("OneSignal setting debug log level to:", level);
            OneSignal.Debug.setLogLevel(level);
        });
    }
};

window.OneSignalManager = OneSignalManager;

// Initialize OneSignal
OneSignalManager.init();
