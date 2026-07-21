/**
 * AppsOnAir Deferred Deep Link & UI Auto-fill Script
 * App ID: 7524077c-f22a-4864-a04b-268ad5222fad
 */

const APPSONAIR_APP_ID = "7524077c-f22a-4864-a04b-268ad5222fad";

/**
 * 1. UI Auto-fill Function
 * Injects referral code into input element (#referral-code or #referral_code) and disables the field.
 */
export function fillReferralCode(refCode) {
    if (!refCode) return;

    const setInput = () => {
        const inputField = document.getElementById('referral-code') || document.getElementById('referral_code');
        if (inputField) {
            inputField.value = refCode;
            inputField.disabled = true;
            
            inputField.setAttribute('data-autofilled', 'true');
            inputField.classList.add('bg-gray-200', 'dark:bg-gray-600', 'cursor-not-allowed', 'opacity-80');
            console.log(`[AppsOnAir] Referral code auto-filled: ${refCode}`);
        } else {
            // Retry if DOM elements are rendered dynamically
            setTimeout(setInput, 300);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setInput);
    } else {
        setInput();
    }
}

/**
 * Helper to parse URL query parameters
 */
function getQueryParam(url, param) {
    try {
        const searchParams = new URL(url, window.location.origin).searchParams;
        return searchParams.get(param);
    } catch (e) {
        return null;
    }
}

/**
 * 2. AppsOnAir SDK & Deep Link Handling
 */
export async function initAppsOnAirDeepLink() {
    try {
        // Option A: AppsOnAir Cordova / Capacitor Plugin / Web SDK
        if (window.AppsOnAir || window.appsonair) {
            const appsOnAirSDK = window.AppsOnAir || window.appsonair;
            
            if (typeof appsOnAirSDK.initialize === 'function') {
                await appsOnAirSDK.initialize({ appId: APPSONAIR_APP_ID });
            }

            if (typeof appsOnAirSDK.getDeepLinkData === 'function') {
                appsOnAirSDK.getDeepLinkData((data) => {
                    console.log('[AppsOnAir] Deep link payload received:', data);
                    const refCode = data?.ref || data?.params?.ref || getQueryParam(data?.url || '', 'ref');
                    if (refCode) {
                        fillReferralCode(refCode);
                    }
                });
            }
        }

        // Option B: Check window URL search query fallback (?ref=...)
        const urlRef = getQueryParam(window.location.href, 'ref');
        if (urlRef) {
            fillReferralCode(urlRef);
        }

        // Option C: Native Android Bridge global callback fallback
        window.onAppsOnAirDeepLinkReceived = function(deepLinkUrl) {
            const refCode = getQueryParam(deepLinkUrl, 'ref');
            if (refCode) {
                fillReferralCode(refCode);
            }
        };

    } catch (err) {
        console.error('[AppsOnAir] Error initializing deep links:', err);
    }
}

// Global window handle for non-module integration
window.fillReferralCode = fillReferralCode;
window.initAppsOnAirDeepLink = initAppsOnAirDeepLink;

// Trigger automatically on device ready / page load
if (window.cordova || window.Capacitor) {
    document.addEventListener('deviceready', initAppsOnAirDeepLink, false);
} else {
    initAppsOnAirDeepLink();
}
