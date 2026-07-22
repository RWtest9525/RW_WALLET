// File: src/core/onesignal.js

const ONESIGNAL_APP_ID = "465e22bd-8540-437b-ba7b-efa14ef4069f";

export const OneSignalManager = {
    init: () => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            try {
                console.log("Initializing OneSignal SDK...");
                await OneSignal.init({
                    appId: ONESIGNAL_APP_ID,
                    serviceWorkerPath: "firebase-messaging-sw.js",
                    allowLocalhostAsSecureOrigin: true,
                    promptOptions: {
                        slidedown: {
                            prompts: [
                                {
                                    type: "push",
                                    autoPrompt: true,
                                    text: {
                                        actionMessage: "We'd like to show you notifications for the latest tasks and updates.",
                                        acceptButton: "Allow",
                                        cancelButton: "Cancel"
                                    }
                                }
                            ]
                        }
                    }
                });
                console.log("OneSignal SDK initialized successfully!");
            } catch (err) {
                console.error("OneSignal init error:", err);
            }

            // Register push subscription observer
            try {
                OneSignal.User.PushSubscription.addEventListener("change", (event) => {
                    console.log("OneSignal Push Subscription changed:", event);
                });
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
                        }
                    }
                });
            } catch (err) {
                console.error("OneSignal click listener error:", err);
            }
        });
    },

    // Manage user identity
    login: (userId) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            if (userId) {
                try {
                    console.log("OneSignal logging in external user:", userId);
                    await OneSignal.login(userId);
                    console.log("OneSignal login completed successfully!");
                } catch (err) {
                    console.error("OneSignal login error:", err);
                }
            }
        });
    },

    logout: () => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            console.log("OneSignal logging out user");
            await OneSignal.logout();
        });
    },

    // Manage user tags
    setTags: (tags) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            console.log("OneSignal setting tags:", tags);
            await OneSignal.User.addTags(tags);
        });
    },

    removeTags: (tagKeys) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            console.log("OneSignal removing tags:", tagKeys);
            await OneSignal.User.removeTags(tagKeys);
        });
    },

    // Handle email subscriptions
    setEmail: (email) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            console.log("OneSignal adding email:", email);
            await OneSignal.User.addEmail(email);
        });
    },

    removeEmail: () => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            console.log("OneSignal removing email");
            await OneSignal.User.removeEmail();
        });
    },

    // Handle SMS subscriptions
    setSms: (smsNumber) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            console.log("OneSignal adding SMS:", smsNumber);
            await OneSignal.User.addSms(smsNumber);
        });
    },

    removeSms: () => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            console.log("OneSignal removing SMS");
            await OneSignal.User.removeSms();
        });
    },

    // Control logging levels
    setLogLevel: (level) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            console.log("OneSignal setting debug log level to:", level);
            OneSignal.Debug.setLogLevel(level);
        });
    }
};

window.OneSignalManager = OneSignalManager;

// Initialize OneSignal
OneSignalManager.init();
