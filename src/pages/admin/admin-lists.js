// File: src/pages/admin/admin-lists.js

let initializeAdminListeners = () => {
            console.log("Initializing admin data...");
            hydrateAdminDashboardMetricsFromCache();
            hydrateAdminUsersFromCache();

            // Defer heavy database listeners and refreshes to unblock UI thread
            setTimeout(() => {
                try {
                    initializeAdminUsersRealtime();
                } catch (e) { console.error("Error starting users realtime:", e); }
            }, 300);

            setTimeout(() => {
                try {
                    initializeAdminFundRequestsRealtime();
                } catch (e) { console.error("Error starting fund requests realtime:", e); }
            }, 600);

            setTimeout(() => {
                try {
                    initializeAdminSecondaryRealtime();
                } catch (e) { console.error("Error starting secondary realtime:", e); }
            }, 900);

            setTimeout(() => {
                refreshAdminDashboardCaches().catch(error => console.error("Admin data refresh failed:", error));
            }, 1500);

            setTimeout(() => {
                loadAdminChatsFromBackend({ silent: true }).catch(error => console.warn("Admin: Cloudflare support chat warmup skipped:", error));
            }, 2500);
        };

// Expose functions to window for global access
window.initializeAdminListeners = initializeAdminListeners;
