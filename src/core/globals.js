import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
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
window.initialTheme = localStorage.getItem('theme') || 'light';
window.firebaseConfig = {
            apiKey: "AIzaSyBzF1agrBFFh4cC2DkmZKePf4-gjE05OQo",
            authDomain: "review-world-1312e.firebaseapp.com",
            projectId: "review-world-1312e",
            storageBucket: "review-world-1312e.firebasestorage.app",
            messagingSenderId: "372772434173",
            appId: "1:372772434173:web:bfeb08e0c96886ace94",
            measurementId: "G-X90GP8JTL8"
        };
window.appId = typeof __app_id !== 'undefined' ? __app_id : 'digital-wallet-prod';
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
            ? 'https://rw-wallet.onrender.com'
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
window.app = initializeApp(firebaseConfig);
window.auth = getAuth(app);
window.db = initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager()
            })
        });
window.storage = getStorage(app);
window.FCM_VAPID_KEY = "";
window.messaging = undefined;
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
window.TASK_COMMENT_RESERVATION_MS = 5 * 60 * 1000;
window.NORMAL_USER_DAILY_TASK_LIMIT = 4;
window.TRANSACTION_PAGE_SIZE = 10;
window.transactionListState = { filter: 'all', visibleCount: TRANSACTION_PAGE_SIZE, items: [] };
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
window.adminUsersRealtimeStarted = false;
window.adminFundRequestsRealtimeStarted = false;
window.adminSecondaryRealtimeStarted = false;
window.publicHomeRealtimeStarted = false;
window.homeAdsAutoTimer = null;
window.homeAdsActiveIndex = 0;
window.localSignupApprovalInProgress = false;
window.revyBotMessages = [];
window.revyBotLastQuestion = '';
window.revyBotTimer = null;
window.revyBotTyping = false;
window.currentMainSection = 'home';
window.notificationTimeout = undefined;
window.appConfigCache = {};
window.maintenanceCountdownTimer = null;
window.adminMaintenanceInterval = null;
window.maintenanceGateActive = false;
window.whatsNewPopupVisible = false;
window.pushNotificationsInitialized = false;
window.unsubscribers = [];
window.PREMIUM_AVATARS = [
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80', // Boy 1
            'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80', // Boy 2
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80', // Boy 3
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80', // Boy 4
            'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&h=150&q=80', // Boy 5
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', // Girl 1
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80', // Girl 2
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80', // Girl 3
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80', // Girl 4
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80'  // Girl 5
        ];
window.ADMIN_USERS_CACHE_KEY = 'rw_admin_users_cache_v2';
window.ADMIN_DASHBOARD_METRICS_CACHE_KEY = 'rw_admin_dashboard_metrics_cache_v1';
window.APP_CONFIG_CACHE_KEY = 'rw_wallet_app_config_cache_v2';
window.usdInrRateCache = null;
window.usdInrRateDate = '';
window.usdRateFetchPromise = null;
window.activeKeyboardInput = null;
window.userTaskHistoryCache = [];
window.userTaskHistoryLoading = false;
window.userLiveListsCache = [];
window.ADMIN_TASK_REVIEW_TYPES = [
            { value: 'app_review', label: 'App Review', logo: PLAY_STORE_LOGO_URL },
            { value: 'map_review', label: 'Map Review', logo: 'https://cdn-icons-png.flaticon.com/512/854/854878.png' },
            { value: 'trustpilot_review', label: 'Trustpilot Review', logo: 'https://cdn-icons-png.flaticon.com/512/5968/5968919.png' },
            { value: 'website_review', label: 'Website Review', logo: 'https://cdn-icons-png.flaticon.com/512/1006/1006771.png' }
        ];
window.ADMIN_TASK_SOCIAL_TYPES = [
            { value: 'instagram_task', label: 'Instagram Task', logo: 'https://cdn-icons-png.flaticon.com/512/2111/2111463.png' },
            { value: 'youtube_task', label: 'YouTube Task', logo: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png' },
            { value: 'app_download_task', label: 'App Download Task', logo: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' },
            { value: 'facebook_task', label: 'Facebook Task', logo: 'https://cdn-icons-png.flaticon.com/512/5968/5968764.png' },
            { value: 'telegram_task', label: 'Telegram Task', logo: 'https://cdn-icons-png.flaticon.com/512/2111/2111646.png' },
            { value: 'read_news', label: 'Earn from read news', logo: 'https://cdn-icons-png.flaticon.com/512/2540/2540832.png' }
        ];
window.adminSubmissionsCache = [];
window.adminSubmissionsLoading = false;
window.adminSubmissionsView = {
            view: 'dates',
            selectedDate: null,
            selectedApp: null
        };
window.SUPPORT_PROFILE_DESCRIPTION = 'Hey, I am Yash Vishal founder Of Reviews World Pvt. Ltd. Working since 2021. I am currently Running more than 5-6 community of Reviews world. I have more than 1000+ active members in our community.Please let me know if you want to do any deal regarding App Reviews work, Map reviews work, and other type of reviews work, web Development, App Developement, etc.Working on making REVIEWS WORLD App since Jan. 2026. It will announced soon..🤗#stay_away_haters';
window.monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
window.shortMonthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
window.CHATBOT_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/2040/2040946.png';
window.WITHDRAW_METHOD_LOGOS = {
            upi: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg',
            bank: 'https://cdn-icons-png.flaticon.com/512/3635/3635987.png',
            play_store: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Google_Play_Arrow_logo.svg',
            amazon_gift: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
            flipkart_gift: 'https://cdn.iconscout.com/icon/free/png-256/free-flipkart-logo-icon-download-in-svg-png-gif-file-formats--online-shopping-brand-logos-pack-icons-226594.png',
            paypal: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
            crypto: 'https://cdn-icons-png.flaticon.com/512/2091/2091665.png'
        };
window.loanPageOpening = false;
window.CURRENT_VERSION_CODE = 2;
window.APP_VERSION = "2.0";
window.pendingRequests = new Set();
window.minWithdrawalAmount = 50;
window.minWithdrawalUpi = 50;
window.minWithdrawalBank = 1000;
window.minWithdrawalRedeem = 100;
window.maxWithdrawalPerDay = 5000;
window.maxPendingWithdrawalsPerUser = 1;
window.withdrawalSettingsLoadedAt = 0;
window.withdrawalSettingsLoadPromise = null;
window.appConfigListenerActive = false;
