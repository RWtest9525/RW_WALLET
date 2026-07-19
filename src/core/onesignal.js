// File: src/core/onesignal.js

const ONESIGNAL_APP_ID = "465e22bd-8540-437b-ba7b-efa14ef4069f";
let hasShownVerificationDialog = false;

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
                });
                console.log("OneSignal SDK initialized successfully!");
            } catch (err) {
                console.error("OneSignal init error:", err);
                alert("OneSignal init error: " + err.message);
            }

            // Register push subscription observer
            try {
                OneSignal.User.PushSubscription.addEventListener("change", (event) => {
                    console.log("OneSignal Push Subscription changed:", event);
                    OneSignalManager.checkSubscriptionState(OneSignal);
                });
                OneSignalManager.checkSubscriptionState(OneSignal);
            } catch (err) {
                console.error("OneSignal subscription observer error:", err);
            }
        });
    },

    checkSubscriptionState: async (OneSignal) => {
        const id = OneSignal.User.PushSubscription.id;
        const optedIn = OneSignal.User.PushSubscription.optedIn;
        console.log("Current Push Subscription ID:", id, "Opted In:", optedIn);

        // Treat device as registered only if subscription ID is real and not prefixed with 'local-'
        if (id && id.trim() !== "" && !id.startsWith("local-")) {
            if (!hasShownVerificationDialog) {
                hasShownVerificationDialog = true;
                OneSignalManager.showVerificationDialog(OneSignal);
            }
        }
    },

    showVerificationDialog: (OneSignal) => {
        // Platform-native alert/dialog
        setTimeout(() => {
            const message = "You can now send Push Notifications & In-App Messages through OneSignal. Tap below to enable push notifications.";
            alert("Your OneSignal SDK integration is complete!\n\n" + message);
            
            // Request push permission after dismissing
            console.log("Requesting push notification permissions...");
            OneSignal.Notifications.requestPermission();
        }, 100);
    },

    // Manage user identity
    login: (userId) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
            if (userId) {
                try {
                    console.log("OneSignal logging in external user:", userId);
                    alert("OneSignal calling login for user: " + userId);
                    await OneSignal.login(userId);
                    alert("OneSignal login completed successfully!");
                } catch (err) {
                    console.error("OneSignal login error:", err);
                    alert("OneSignal login error: " + err.message);
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
