/* ======================================================================
 * OneSignalSDKUpdaterWorker.js
 * OPTION A — exact mirror of OneSignalSDKWorker.js.
 * OneSignal SDK checks for BOTH files at the configured scope. Missing
 * updater file causes spurious console warnings and missed SW updates on
 * some Android WebView versions. Keep to ONE LINE (import only).
 * ====================================================================== */

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
