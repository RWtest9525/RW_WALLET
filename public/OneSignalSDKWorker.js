/* ======================================================================
 * OneSignalSDKWorker.js
 * OPTION A — Let OneSignal handle EVERYTHING (recommended).
 *
 * One single line: import the official OneSignal SDK Service Worker.
 * This prevents ANY conflict with custom SW code, extra event handlers,
 * or duplicate push/notificationclick listeners that could prevent
 * Android APK from displaying incoming OneSignal pushes.
 *
 * IMPORTANT PER BROWSER SW SPEC:
 *   importScripts() must be SYNCHRONOUS at TOP-LEVEL evaluation.
 *   NEVER wrap this in async/await, a callback, or a conditional.
 *
 * CRITICAL FOR APK:
 *   Do NOT add ANY custom addEventListener('message'/'push'/'fetch') code
 *   to this file. Your APK's embedded WebView or its wrapper's injected
 *   custom SW (sw.ts) already emits a warning about late message handler
 *   registration. Keeping this file to ONE line avoids ALL conflicts.
 *   OneSignal's SDK Worker natively handles: push, notificationclick,
 *   subscription updates, and badge counts for Web, PWA, and WebView APK.
 * ====================================================================== */

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
