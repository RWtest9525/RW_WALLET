/**
 * Custom IP-based Deferred Deep Linking Client Script
 * Connects to Node.js backend hosted on Render
 */

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? "http://localhost:5000"
    : "https://rw-wallet.onrender.com"; 

export async function verifyAndFillReferral() {
    try {
        console.log('[Custom DeepLink] Checking referral code for client IP...');
        
        const response = await fetch(`${BACKEND_URL}/verify-referral`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn('[Custom DeepLink] Backend endpoint returned status:', response.status);
            return;
        }

        const data = await response.json();

        if (data.success && data.referralCode) {
            console.log(`[Custom DeepLink] Matched Referral Code: ${data.referralCode}`);
            injectReferralCodeToUI(data.referralCode);
        } else {
            console.log('[Custom DeepLink] No referral code stored for this IP address.');
        }
    } catch (error) {
        console.error('[Custom DeepLink] Referral verification failed:', error);
    }
}

function injectReferralCodeToUI(refCode) {
    const applyToInput = () => {
        const inputField = document.getElementById('referral-code') || document.getElementById('referral_code');
        if (inputField) {
            inputField.value = refCode;
            inputField.disabled = true;
            inputField.classList.add('bg-gray-200', 'dark:bg-gray-600', 'cursor-not-allowed', 'opacity-80');
            console.log(`[Custom DeepLink] Auto-filled referral code: ${refCode}`);
        } else {
            // Retry if form elements render dynamically
            setTimeout(applyToInput, 300);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyToInput);
    } else {
        applyToInput();
    }
}

window.verifyAndFillReferral = verifyAndFillReferral;

// Automatic startup network verification disabled to prevent app load stalling on sleeping backend
// if (window.cordova || window.Capacitor) {
//     document.addEventListener('deviceready', verifyAndFillReferral, false);
// } else {
//     verifyAndFillReferral();
// }
