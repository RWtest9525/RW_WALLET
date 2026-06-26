const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const mainJsPath = path.join(srcDir, 'main.js');

if (!fs.existsSync(mainJsPath)) {
  console.error('Error: src/main.js not found!');
  process.exit(1);
}

const content = fs.readFileSync(mainJsPath, 'utf8');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 1. Create directories
ensureDir(path.join(srcDir, 'core'));
ensureDir(path.join(srcDir, 'utils'));
ensureDir(path.join(srcDir, 'pages'));
ensureDir(path.join(srcDir, 'pages', 'admin'));

// 2. Function extractor with signature-safe brace matching
function extractFunctions(content) {
  // Regex matches up to => or ) without matching the opening brace {
  const functionRegex = /(?:const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|function\s+([a-zA-Z0-9_]+)\s*\([^)]*\))/g;
  let match;
  const functions = [];
  while ((match = functionRegex.exec(content)) !== null) {
    const name = match[1] || match[2];
    const startIndex = match.index;
    
    // Find the opening brace '{' that starts AFTER the matched signature
    const braceStartIndex = content.indexOf('{', startIndex + match[0].length);
    if (braceStartIndex === -1) continue;
    
    let braceCount = 1;
    let index = braceStartIndex + 1;
    while (braceCount > 0 && index < content.length) {
      const char = content[index];
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
      }
      index++;
    }
    
    const body = content.substring(startIndex, index);
    functions.push({ name, body, start: startIndex, end: index });
  }
  return functions;
}

const allFuncs = extractFunctions(content);
console.log(`Found ${allFuncs.length} functions to refactor.`);

// 3. Classify function to target file
function getTargetFile(funcName) {
  const name = funcName.toLowerCase();
  
  if (name.includes('admintask') || name.includes('admincreatetask')) {
    return 'pages/admin/admin-tasks.js';
  } else if (name.includes('adminsubmission') || name.includes('adminverify') || name.includes('ocr') || name.includes('reviewername')) {
    return 'pages/admin/admin-submissions.js';
  } else if (name.includes('adminrecharge')) {
    return 'pages/admin/admin-recharges.js';
  } else if (name.includes('adminwithdraw')) {
    return 'pages/admin/admin-withdrawals.js';
  } else if (name.includes('adminuser') || name.includes('adminban') || name.includes('adminflag')) {
    return 'pages/admin/admin-users.js';
  } else if (name.includes('adminchat')) {
    return 'pages/admin/admin-chats.js';
  } else if (name.includes('adminsync') || name.includes('audit') || name.includes('summary')) {
    return 'pages/admin/admin-audit.js';
  } else if (name.includes('adminnotification')) {
    return 'pages/admin/admin-notifications.js';
  } else if (name.includes('adminlist') || name.includes('dailylist')) {
    return 'pages/admin/admin-lists.js';
  } else if (name.includes('admin')) {
    return 'pages/admin/admin-dashboard.js';
  } else if (name.includes('recharge')) {
    return 'pages/recharge.js';
  } else if (name.includes('withdraw')) {
    return 'pages/withdraw.js';
  } else if (name.includes('loan')) {
    return 'pages/loan.js';
  } else if (name.includes('partner') || name.includes('investment')) {
    return 'pages/partner.js';
  } else if (name.includes('chat') || name.includes('support') || name.includes('revy')) {
    return 'pages/support.js';
  } else if (name.includes('gift') || name.includes('redeem')) {
    return 'pages/giftcard.js';
  } else if (name.includes('notification')) {
    return 'pages/notifications.js';
  } else if (name.includes('profile') || name.includes('settings') || name.includes('theme')) {
    return 'pages/profile.js';
  } else if (name.includes('auth') || name.includes('login') || name.includes('signout') || name.includes('register') || name.includes('resetlink')) {
    return 'pages/auth.js';
  } else if (name.includes('page') || name.includes('nav') || name.includes('transaction') || name.includes('history') || name.includes('menu')) {
    return 'pages/dashboard.js';
  }
  return 'utils/ui-utils.js';
}

// Group functions by target file
const filesMap = {};
allFuncs.forEach(f => {
  const target = getTargetFile(f.name);
  if (!filesMap[target]) filesMap[target] = [];
  filesMap[target].push(f);
});

// 4. Create the core globals.js file
const globalsContent = `import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, getDoc, collection, collectionGroup, addDoc, onSnapshot, query, orderBy, Timestamp, writeBatch, runTransaction, deleteDoc, getDocs, serverTimestamp, where, arrayUnion, updateDoc, deleteField, increment, setLogLevel, limit as firestoreLimit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";

// Mount Firebase imports to window
window.initializeApp = initializeApp;
window.getAuth = getAuth;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.signOut = signOut;
window.onAuthStateChanged = onAuthStateChanged;
window.sendPasswordResetEmail = sendPasswordResetEmail;
window.setPersistence = setPersistence;
window.browserLocalPersistence = browserLocalPersistence;
window.initializeFirestore = initializeFirestore;
window.persistentLocalCache = persistentLocalCache;
window.persistentMultipleTabManager = persistentMultipleTabManager;
window.doc = doc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.collection = collection;
window.collectionGroup = collectionGroup;
window.addDoc = addDoc;
window.onSnapshot = onSnapshot;
window.query = query;
window.orderBy = orderBy;
window.Timestamp = Timestamp;
window.writeBatch = writeBatch;
window.runTransaction = runTransaction;
window.deleteDoc = deleteDoc;
window.getDocs = getDocs;
window.serverTimestamp = serverTimestamp;
window.where = where;
window.arrayUnion = arrayUnion;
window.updateDoc = updateDoc;
window.deleteField = deleteField;
window.increment = increment;
window.setLogLevel = setLogLevel;
window.firestoreLimit = firestoreLimit;
window.getStorage = getStorage;
window.storageRef = storageRef;
window.uploadBytesResumable = uploadBytesResumable;
window.getDownloadURL = getDownloadURL;
window.getMessaging = getMessaging;
window.getToken = getToken;
window.onMessage = onMessage;

// Mount state variables & constants to window
window.appId = 'digital-wallet-prod';
window.ADMIN_UID = "mOs5Fmp4RoRzeBDH4pZLMOpQx7Q2";
window.WEB_APP_BUILD = "rw-web-2026-05-21-tracker";
window.WEB_APP_UPDATE_DATE = "2026-05-21";
window.FIRESTORE_TRANSACTION_READ_LIMIT = 200;
window.LEGACY_WITHDRAWAL_DEDUCTION_CUTOFF = new Date(2026, 4, 20).getTime();
window.RECHARGE_DISCOUNT_RATE = 0.01;
window.PARTNER_INTEREST_RATE = 0.01;
window.PARTNER_MIN_INVESTMENT = 25;
window.LOAN_APPLICATION_VERSION = 2;
window.LOAN_REAPPLY_WAIT_MONTHS = 3;
window.LOAN_DOCUMENT_MAX_SIZE_BYTES = 8 * 1024 * 1024;
window.LOAN_DOCUMENT_UPLOAD_TIMEOUT_MS = 120000;
window.PARTNER_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png';
window.RECHARGE_OPERATORS = ['Jio', 'Airtel', 'Vi', 'BSNL', 'MTNL'];
window.RECHARGE_STATES = [
    'Andhra Pradesh', 'Assam', 'Bihar Jharkhand', 'Delhi NCR', 'Gujarat', 'Haryana',
    'Himachal Pradesh', 'Jammu Kashmir', 'Karnataka', 'Kerala', 'Kolkata', 'Madhya Pradesh Chhattisgarh',
    'Maharashtra Goa', 'Mumbai', 'North East', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu',
    'Uttar Pradesh East', 'Uttar Pradesh West', 'West Bengal'
];
window.BACKEND_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080'
    : 'https://rw-wallet.onrender.com';
window.RW_LOGO_URL = 'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg';
window.PLAY_STORE_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Google_Play_Arrow_logo.svg';
window.REFER_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/929/929610.png';
window.WALLET_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/1946/1946436.png';
window.ADMIN_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
window.TASK_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png';
window.CHAT_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/5962/5962463.png';
window.SETTINGS_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/3524/3524659.png';
window.NOTIFICATION_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/1827/1827370.png';
window.TASK_COMMENT_RESERVATION_MS = 5 * 60 * 1000;
window.NORMAL_USER_DAILY_TASK_LIMIT = 4;
window.TRANSACTION_PAGE_SIZE = 10;

// State Variables
window.currentUser = null;
window.currentUserData = null;
window.allUsersCache = [];
window.allFundRequestsCache = [];
window.allRechargeRequestsCache = [];
window.fundRequestsImportedFromFirebase = false;
window.allLoanRequestsCache = [];
window.adminLoanRequestsLoaded = false;
window.allLoansCache = [];
window.allGiftCodesCache = [];
window.allInvestmentsCache = [];
window.allTasksCache = [];
window.userTaskSubmissionIds = new Set();
window.userTaskTodaySubmissionIds = new Set();
window.userTaskParticipationLoadedFor = '';
window.activeTaskReservation = null;
window.activeTaskReservationTimer = null;
window.allAdsCache = [];
window.allSupportChatsCache = [];
window.unifiedHistoryCache = [];
window.lastManualPageOpenAt = 0;
window.locallyProcessedFundRequestIds = new Set();
window.locallyProcessedFundRequestSignatures = new Set();
window.transactionListState = { filter: 'all', visibleCount: window.TRANSACTION_PAGE_SIZE, items: [] };
window.transactionHistoryPrefetch = { userId: '', promise: null, loadedAt: 0 };
window.withdrawalHistoryCache = [];
window.adminViewedUserTransactions = [];
window.adminViewedUserProfile = null;
window.adminPendingWithdrawalSearch = '';
window.recipientLookupCache = new Map();
window.lastAutoProcessCheckAt = 0;
window.activeWithdrawalHistoryFilter = { filter: 'today', fromDate: null, toDate: null };
window.activeWithdrawMethod = '';
window.activeChatUnsubscribe = null;
window.backendAuthToken = '';
window.backendAuthPromise = null;
window.supportSocket = null;
window.activeSupportRoomId = '';
window.activeSupportMessages = [];
window.supportChatUnreadCount = 0;
window.adminChatUnreadCount = 0;
window.supportChatPreloadUserId = '';
window.supportChatBackgroundHandlers = null;
window.adminChatBackgroundHandlers = null;
window.adminChatSubscribedRooms = new Set();
window.supportSocketClientLoadPromise = null;
window.supportSendingMessage = false;
window.supportLastSendSignature = '';
window.supportLastSendAt = 0;
window.notificationsCache = [];
window.notificationUnreadCount = 0;
window.adminNotificationsCache = [];
window.notificationRefreshTimer = null;
window.loanApplicationDraft = { step: 1, personal: {}, documents: {}, acceptedTerms: false };
window.adminNotificationSelectedUsers = [];
window.PREMIUM_AVATARS = [
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&h=150&q=80'
];
window.unsubscribers = [];
window.revyBotTimer = null;
window.revyBotTyping = false;
window.currentMainSection = 'home';
window.notificationTimeout = null;
window.appConfigCache = {};
window.maintenanceCountdownTimer = null;
window.adminMaintenanceInterval = null;
window.maintenanceGateActive = false;
window.whatsNewPopupVisible = false;
window.pushNotificationsInitialized = false;
`;

fs.writeFileSync(path.join(srcDir, 'core', 'globals.js'), globalsContent);
console.log('Created core/globals.js');

// 5. Write grouped functions to their modular files and register window properties
for (const [targetFile, funcs] of Object.entries(filesMap)) {
  const targetPath = path.join(srcDir, targetFile);
  let fileContent = `// File: src/${targetFile}\n\n`;
  
  funcs.forEach(f => {
    fileContent += `${f.body}\n\n`;
  });
  
  // Expose each function to window
  fileContent += `// Expose functions to window for global access\n`;
  funcs.forEach(f => {
    fileContent += `window.${f.name} = ${f.name};\n`;
  });
  
  fs.writeFileSync(targetPath, fileContent);
  console.log(`Created src/${targetFile} with ${funcs.length} functions.`);
}

// 6. Extract Firebase configuration, app initialization and Auth listeners
const firebaseInitContent = `// File: src/core/firebase.js

const initFirebaseApp = () => {
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyBzF1agrBFFh4cC2DkmZKePf4-gjE05OQo",
            authDomain: "review-world-1312e.firebaseapp.com",
            projectId: "review-world-1312e",
            storageBucket: "review-world-1312e.firebasestorage.app",
            messagingSenderId: "372772434173",
            appId: "1:372772434173:web:bfeb08e0c96886ace94",
            measurementId: "G-X90GP8JTL8"
        };
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        
        // Initialize Firestore with Persistent Cache
        const db = initializeFirestore(app, {
            localCache: persistentLocalCache()
        });
        
        const storage = getStorage(app);
        let messaging = null;
        try {
            messaging = getMessaging(app);
        } catch(e) {
            console.warn("Messaging not supported on this browser.");
        }
        
        window.app = app;
        window.auth = auth;
        window.db = db;
        window.storage = storage;
        window.messaging = messaging;
        
        try {
            setLogLevel('error');
        } catch (e) {
            console.warn("Could not set Firebase log level:", e);
        }
        
        console.log("Firebase services initialized successfully with persistent cache.");
        
        // Start Auth state change listener
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                localStorage.setItem('lastLoggedInUser', user.uid);
                
                // Set persistence
                setPersistence(auth, browserLocalPersistence).catch(e => console.warn("Persistence set failed:", e));
                
                // Realtime user profile listener
                const userRef = doc(db, \`artifacts/\${appId}/public/data/users\`, user.uid);
                onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        currentUserData = userData;
                        localStorage.setItem(\`rw_wallet_user_cache_\${user.uid}\`, JSON.stringify(userData));
                        
                        // Hydrate UI elements
                        const balanceEl = document.getElementById('user-balance');
                        const adminBalanceEl = document.getElementById('admin-wallet-balance');
                        if (balanceEl && typeof formatCompactInr === 'function') balanceEl.textContent = formatCompactInr(userData.balance || 0);
                        if (adminBalanceEl && typeof formatCompactInr === 'function') adminBalanceEl.textContent = formatCompactInr(userData.balance || 0);
                        
                        if (userData.isFlagged || userData.isDisabled) {
                            if (typeof showBlockedAccountPage === 'function') showBlockedAccountPage(userData);
                        } else if (userData.approvalStatus === 'pending' || userData.signupApprovalStatus === 'pending' || userData.accountStatus === 'pending_approval') {
                            if (typeof showVerificationPendingPage === 'function') showVerificationPendingPage(userData);
                        } else if (userData.approvalStatus === 'rejected' || userData.signupApprovalStatus === 'rejected' || userData.accountStatus === 'rejected') {
                            if (typeof showVerificationPendingPage === 'function') showVerificationPendingPage(userData);
                        } else {
                            // If page was blocked/pending, return to dashboard
                            if (document.getElementById('verification-pending-container') || document.getElementById('dashboard-content')?.classList.contains('hidden')) {
                                document.getElementById('dashboard-content')?.classList.remove('hidden');
                                document.getElementById('bottom-nav')?.classList.remove('hidden');
                                const pageContainer = document.getElementById('page-container');
                                if (pageContainer) {
                                    pageContainer.innerHTML = '';
                                    pageContainer.classList.add('hidden');
                                }
                            }
                        }
                    }
                });
                
                // Realtime transactions history listener (for UI reactivity)
                const txQuery = query(
                    collection(db, \`artifacts/\${appId}/public/data/users/\${user.uid}/transactions\`),
                    orderBy('timestamp', 'desc'),
                    firestoreLimit(FIRESTORE_TRANSACTION_READ_LIMIT)
                );
                onSnapshot(txQuery, (snap) => {
                    const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    unifiedHistoryCache = txs;
                    if (typeof renderTransactionsList === 'function') {
                        renderTransactionsList(txs);
                    }
                });
                
                // Initialize messaging/notifications
                if (typeof setupPushNotifications === 'function') setupPushNotifications();
                if (typeof setupNotificationMessageListener === 'function') setupNotificationMessageListener();
                
                // Hydrate dashboard
                if (typeof showHomeMainPage === 'function') showHomeMainPage();
            } else {
                currentUser = null;
                currentUserData = null;
                localStorage.removeItem('lastLoggedInUser');
                if (typeof handleSignOut === 'function') handleSignOut();
            }
        });
        
    } catch (error) {
        console.error("Firebase startup failed:", error);
    }
};

window.initFirebaseApp = initFirebaseApp;

// Auto-run on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebaseApp, { once: true });
} else {
    initFirebaseApp();
}
`;

fs.writeFileSync(path.join(srcDir, 'core', 'firebase.js'), firebaseInitContent);
console.log('Created core/firebase.js');

// 7. Write the entry point main.js importing everything in correct order
const entryPointContent = `// Entry Point: src/main.js
// Imports all modular components and pages in sequence

import './core/globals.js';
import './utils/ui-utils.js';
import './pages/auth.js';
import './pages/dashboard.js';
import './pages/recharge.js';
import './pages/withdraw.js';
import './pages/loan.js';
import './pages/partner.js';
import './pages/support.js';
import './pages/giftcard.js';
import './pages/notifications.js';
import './pages/profile.js';
import './pages/admin/admin-dashboard.js';
import './pages/admin/admin-tasks.js';
import './pages/admin/admin-submissions.js';
import './pages/admin/admin-users.js';
import './pages/admin/admin-recharges.js';
import './pages/admin/admin-withdrawals.js';
import './pages/admin/admin-chats.js';
import './pages/admin/admin-audit.js';
import './pages/admin/admin-lists.js';
import './pages/admin/admin-notifications.js';
import './core/firebase.js';

// Setup Event listeners and routing at DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Theme setup
    const initialTheme = localStorage.getItem('theme') || 'light';
    if (typeof applyTheme === 'function') applyTheme(initialTheme);
    
    // Viewport adjustment listeners
    if (typeof setupViewportAdjustment === 'function') setupViewportAdjustment();
    
    // Auth listeners
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.onsubmit = (e) => {
            e.preventDefault();
            if (typeof handleAuthSubmit === 'function') handleAuthSubmit();
        };
    }
    
    const authToggle = document.getElementById('auth-toggle');
    if (authToggle) {
        authToggle.onclick = (e) => {
            e.preventDefault();
            if (typeof toggleAuthMode === 'function') toggleAuthMode();
        };
    }
    
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.onclick = (e) => {
            e.preventDefault();
            if (typeof showForgotPasswordModal === 'function') showForgotPasswordModal();
        };
    }
    
    const sendResetBtn = document.getElementById('send-reset-btn');
    if (sendResetBtn) {
        sendResetBtn.onclick = () => {
            if (typeof handleSendResetLink === 'function') handleSendResetLink();
        };
    }
    
    // Static and bottom nav button listeners
    const homeBtn = document.getElementById('bottom-home-btn');
    if (homeBtn) homeBtn.onclick = () => {
        if (typeof showHomeMainPage === 'function') showHomeMainPage();
    };
    
    const taskBtn = document.getElementById('bottom-task-btn');
    if (taskBtn) taskBtn.onclick = () => {
        if (typeof showUserTaskPage === 'function') showUserTaskPage();
    };
    
    const adminBtn = document.getElementById('bottom-admin-btn');
    if (adminBtn) adminBtn.onclick = () => {
        if (typeof showAdminMainPage === 'function') showAdminMainPage();
    };
    
    const settingsBtn = document.getElementById('bottom-settings-btn');
    if (settingsBtn) settingsBtn.onclick = () => {
        if (typeof showSettingsPage === 'function') showSettingsPage();
    };
    
    const supportBtn = document.getElementById('bottom-support-btn');
    if (supportBtn) supportBtn.onclick = () => {
        if (typeof showHelpSupportPage === 'function') showHelpSupportPage();
    };
    
    // Master delegation click listeners for action buttons
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.getAttribute('data-action');
        
        switch (action) {
            case 'recharge':
                if (typeof showMobileRechargePage === 'function') showMobileRechargePage();
                break;
            case 'withdraw':
                if (typeof showWithdrawPage === 'function') showWithdrawPage();
                break;
            case 'loan':
                if (typeof showLoanPage === 'function') showLoanPage();
                break;
            case 'partner':
                if (typeof showPartnerPage === 'function') showPartnerPage();
                break;
            case 'giftcard':
                if (typeof showRedeemGiftCodeModal === 'function') showRedeemGiftCodeModal();
                break;
            case 'admin':
                if (typeof showAdminMainPage === 'function') showAdminMainPage();
                break;
            default:
                console.warn("Delegated action not matched:", action);
        }
    });
    
    console.log("Global event handlers and routers registered.");
});
`;

fs.writeFileSync(mainJsPath, entryPointContent);
console.log('Successfully updated src/main.js to be the clean imports entry point!');
console.log('\nRefactoring complete!');
