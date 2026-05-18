import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyBzF1agrBFFh4cC2DkmZKePf4-gjE05OQo",
    authDomain: "review-world-1312e.firebaseapp.com",
    projectId: "review-world-1312e",
    storageBucket: "review-world-1312e.firebasestorage.app",
    messagingSenderId: "372772434173",
    appId: "1:372772434173:web:bfeb08e0c96886ace94",
    measurementId: "G-X90GP8JTL8"
};

export const appId = 'digital-wallet-prod';
export const ADMIN_UID = "mOs5Fmp4RoRzeBDH4pZLMOpQx7Q2";
export const ONE_SIGNAL_APP_ID = "4affd7dd-a2c1-4b94-8253-dde142f4c847";
export const ONE_SIGNAL_REST_API_KEY = "os_v2_app_jl75pxncyffzjast3xquf5gii54sqa6fycmuglew4vp64rdufzqradkcxzgkeff5rti2ejsth3oiqiqnoclktgkj2onvl5kqoxlyvbi";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

try {
    setLogLevel('Debug');
} catch (e) {
    console.warn("Could not set Firebase log level:", e);
}
