try {
    importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (e) {
    console.warn("[OneSignalSDKWorker.js] OneSignal SW import skipped:", e);
}
