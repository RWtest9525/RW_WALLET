import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, setDoc, getDoc, collection, collectionGroup, addDoc, onSnapshot, query, orderBy, Timestamp, writeBatch, runTransaction, deleteDoc, getDocs, serverTimestamp, where, arrayUnion, updateDoc, deleteField, increment, setLogLevel, limit as firestoreLimit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

        // --- THEME LOGIC ---
        const applyTheme = (theme) => {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            localStorage.setItem('theme', theme);

            const lightIcon = document.getElementById('settings-theme-icon-light');
            const darkIcon = document.getElementById('settings-theme-icon-dark');

            if (lightIcon && darkIcon) {
                if (theme === 'dark') {
                    lightIcon.classList.add('hidden');
                    darkIcon.classList.remove('hidden');
                } else {
                    lightIcon.classList.remove('hidden');
                    darkIcon.classList.add('hidden');
                }
            }
        };
        const toggleTheme = () => {
            const currentTheme = localStorage.getItem('theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
        };
        // Set default theme to LIGHT
        const initialTheme = localStorage.getItem('theme') || 'light';
        applyTheme(initialTheme);
        // --- END THEME ---

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
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'digital-wallet-prod';
        const ADMIN_UID = "mOs5Fmp4RoRzeBDH4pZLMOpQx7Q2";
        const WEB_APP_BUILD = "rw-web-2026-05-21-tracker";
        const WEB_APP_UPDATE_DATE = "2026-05-21";
        const LEGACY_WITHDRAWAL_DEDUCTION_CUTOFF = new Date(2026, 4, 20).getTime();
        const RECHARGE_DISCOUNT_RATE = 0.01;
        const PARTNER_INTEREST_RATE = 0.01;
        const PARTNER_MIN_INVESTMENT = 25;
        const LOAN_APPLICATION_VERSION = 2;
        const LOAN_REAPPLY_WAIT_MONTHS = 3;
        const LOAN_DOCUMENT_MAX_SIZE_BYTES = 8 * 1024 * 1024;
        const LOAN_DOCUMENT_UPLOAD_TIMEOUT_MS = 120000;
        const PARTNER_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png';
        const RECHARGE_OPERATORS = ['Jio', 'Airtel', 'Vi', 'BSNL', 'MTNL'];
        const RECHARGE_STATES = [
            'Andhra Pradesh', 'Assam', 'Bihar Jharkhand', 'Delhi NCR', 'Gujarat', 'Haryana',
            'Himachal Pradesh', 'Jammu Kashmir', 'Karnataka', 'Kerala', 'Kolkata', 'Madhya Pradesh Chhattisgarh',
            'Maharashtra Goa', 'Mumbai', 'North East', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu',
            'Uttar Pradesh East', 'Uttar Pradesh West', 'West Bengal'
        ];
        const BACKEND_BASE_URL = 'https://rw-wallet.onrender.com';
        const RW_LOGO_URL = 'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg';

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        const storage = getStorage(app);
        setPersistence(auth, browserLocalPersistence).catch(error => {
            console.warn('Could not enable local auth persistence:', error);
        });

        try {
            setLogLevel('error');
        } catch (e) {
            console.warn("Could not set Firebase log level:", e);
        }

        let currentUser = null;
        let currentUserData = null;
        let allUsersCache = [];
        let allFundRequestsCache = [];
        let allRechargeRequestsCache = [];
        let fundRequestsImportedFromFirebase = false;
        let allLoanRequestsCache = [];
        let allLoansCache = [];
        let allGiftCodesCache = [];
        let allInvestmentsCache = [];
        let allTasksCache = [];
        let allAdsCache = [];
        let allSupportChatsCache = [];
        let unifiedHistoryCache = [];
        const TRANSACTION_PAGE_SIZE = 10;
        let transactionListState = { filter: 'all', visibleCount: TRANSACTION_PAGE_SIZE, items: [] };
        let transactionHistoryPrefetch = { userId: '', promise: null, loadedAt: 0 };
        let withdrawalHistoryCache = [];
        let adminViewedUserTransactions = [];
        let adminViewedUserProfile = null;
        let adminPendingWithdrawalSearch = '';
        const recipientLookupCache = new Map();
        let lastAutoProcessCheckAt = 0;
        let activeWithdrawalHistoryFilter = { filter: 'today', fromDate: null, toDate: null };
        let activeWithdrawMethod = '';
        let activeChatUnsubscribe = null;
        let backendAuthToken = '';
        let backendAuthPromise = null;
        let supportSocket = null;
        let activeSupportRoomId = '';
        let activeSupportMessages = [];
        let supportChatUnreadCount = 0;
        let adminChatUnreadCount = 0;
        let supportChatPreloadUserId = '';
        let supportChatBackgroundHandlers = null;
        let adminChatBackgroundHandlers = null;
        let adminChatSubscribedRooms = new Set();
        let supportSocketClientLoadPromise = null;
        let supportSendingMessage = false;
        let supportLastSendSignature = '';
        let supportLastSendAt = 0;
        let notificationsCache = [];
        let notificationUnreadCount = 0;
        let adminNotificationsCache = [];
        let notificationRefreshTimer = null;
        let loanApplicationDraft = { step: 1, personal: {}, documents: {}, acceptedTerms: false };
        let adminNotificationSelectedUsers = [];
        let adminUsersRealtimeStarted = false;
        let adminFundRequestsRealtimeStarted = false;
        let adminSecondaryRealtimeStarted = false;
        let publicHomeRealtimeStarted = false;
        let homeAdsAutoTimer = null;
        let homeAdsActiveIndex = 0;
        let localSignupApprovalInProgress = false;
        let revyBotMessages = [];
        let revyBotLastQuestion = '';
        let revyBotTimer = null;
        let currentMainSection = 'home';
        let notificationTimeout;
        let appConfigCache = {};
        let maintenanceCountdownTimer = null;
        let maintenanceGateActive = false;
        let whatsNewPopupVisible = false;

        const unsubscribers = [];

        // --- LOADING OVERLAY ---
        const showLoading = () => {
            document.getElementById('loading-overlay').classList.remove('hidden');
        };
        const hideLoading = () => {
            document.getElementById('loading-overlay').classList.add('hidden');
        };
        const friendlyErrorMessage = (fallback = 'Something went wrong. Please try again.') => fallback;
        const showFriendlyError = (fallback = 'Something went wrong. Please try again.') => {
            showNotification(friendlyErrorMessage(fallback), true);
        };

        // --- UI UTILS ---
        const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
        const numericAmount = (amount) => Number(amount || 0);
        const absoluteAmount = (amount) => Math.abs(numericAmount(amount));
        const formatCurrencyAbs = (amount) => formatCurrency(absoluteAmount(amount));
        const getUserAvailableBalance = (user = {}) => {
            const candidates = [user.balance, user.walletBalance, user.wallet_balance, user.availableBalance, user.available_balance];
            for (const value of candidates) {
                const amount = Number(value);
                if (Number.isFinite(amount)) return amount;
            }
            return 0;
        };
        const getLoanReservedAmount = (user = currentUserData || {}) => {
            if (Number(user.activeLoanVersion || 0) < LOAN_APPLICATION_VERSION) return 0;
            const dueAt = timestampToMillis(user.activeLoanDueDate || user.loanDueDate || user.loan_due_date || 0);
            if (!dueAt || dueAt > Date.now()) return 0;
            const explicit = Number(user.loanLockedAmount ?? user.loan_locked_amount ?? 0);
            const activeRepayable = Number(user.activeLoanRepayable ?? user.active_loan_repayable ?? 0);
            const rawReserve = Number.isFinite(explicit) && explicit > 0 ? explicit : activeRepayable;
            return Math.max(0, Math.min(Number(user.balance || 0), Number.isFinite(rawReserve) ? rawReserve : 0));
        };
        const getSpendableWalletBalance = (user = currentUserData || {}) =>
            Math.max(0, Number(user.balance || 0) - getLoanReservedAmount(user));
        const getInsufficientWalletMessage = (user = currentUserData || {}) => {
            const reservedAmount = getLoanReservedAmount(user);
            if (reservedAmount > 0) {
                return `Insufficient available balance. ${formatCurrency(reservedAmount)} is reserved for loan repayment.`;
            }
            return 'Insufficient wallet balance.';
        };
        const getInsufficientRechargeMessage = (user = currentUserData || {}, requiredAmount = 0) => {
            const balance = Number(user.balance || 0);
            const reservedAmount = getLoanReservedAmount(user);
            if (reservedAmount > 0 && balance >= Number(requiredAmount || 0)) {
                return `Insufficient available balance. ${formatCurrency(reservedAmount)} is reserved for loan repayment.`;
            }
            return 'Insufficient wallet balance for mobile recharge.';
        };
        const withTimeout = (promise, timeoutMs, message) => {
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
            });
            return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
        };
        const getLoanLimitAmount = (user = currentUserData || {}) => {
            user = user || {};
            return Math.max(0, Number(user.maxLoanAmount || user.loanMaxAmount || user.creditLimit || user.loanCreditLimit || 0));
        };
        const hasLoanDocumentFile = (documentInfo = null) => {
            if (!documentInfo) return false;
            if (typeof documentInfo === 'string') return !!documentInfo.trim();
            return !!(documentInfo.url || documentInfo.downloadURL || documentInfo.path || documentInfo.storage || documentInfo.name);
        };
        const hasSubmittedLoanDocuments = (request = {}) => {
            request = request || {};
            if (request.loanDocumentsSubmitted === true || request.loanDocumentsVerified === true || request.loanDocumentsApproved === true) return true;
            const aadhaarDocument = request.documents?.aadhaar || request.aadhaarDocument || request.aadhaarDoc || request.aadhaarFile;
            const selfieDocument = request.documents?.selfie || request.selfieDocument || request.selfiePhoto || request.selfieFile;
            return hasLoanDocumentFile(aadhaarDocument) && hasLoanDocumentFile(selfieDocument);
        };
        const hasSubmittedLoanDetails = (request = {}) => {
            request = request || {};
            const hasPersonalDetails = !!(
                request.personalDetails ||
                request.fatherName ||
                request.aadhaar ||
                request.aadhaarNumber
            );
            return hasPersonalDetails && hasSubmittedLoanDocuments(request);
        };
        const isModernLoanRequest = (request = {}) => {
            request = request || {};
            const version = Number(request.requestVersion || request.loanApplicationVersion || request.latestLoanRequestVersion || 0);
            if (version >= LOAN_APPLICATION_VERSION) return hasSubmittedLoanDetails(request);
            const status = String(request.status || request.loanRequestStatus || '').trim().toLowerCase();
            return ['pending', 'approved', 'rejected', 'cancelled', 'canceled', 'failed', 'denied'].includes(status) && hasSubmittedLoanDetails(request);
        };
        const isApprovedModernLoanRequest = (request = {}) => isModernLoanRequest(request) && String(request.status || request.loanRequestStatus || '').trim().toLowerCase() === 'approved';
        const hasModernLoanApproval = (user = currentUserData || {}) => {
            user = user || {};
            return getLoanLimitAmount(user) > 0 && Number(user.loanApplicationVersion || user.loanRequestVersion || 0) >= LOAN_APPLICATION_VERSION;
        };
        const hasDocumentedModernLoanApproval = (user = currentUserData || {}, requests = []) =>
            hasModernLoanApproval(user) && (
                user.loanDocumentsVerified === true ||
                user.loanDocumentsApproved === true ||
                requests.some(isApprovedModernLoanRequest)
            );
        const isModernLoanRecord = (loan = {}) => {
            loan = loan || {};
            return Number(loan.loanApplicationVersion || loan.loanRequestVersion || loan.requestVersion || loan.latestLoanRequestVersion || 0) >= LOAN_APPLICATION_VERSION;
        };
        const isActiveLoanRecord = (loan = {}) => {
            loan = loan || {};
            return String(loan.status || '').toLowerCase() === 'active';
        };
        const getLoanPrincipal = (loan = {}) => {
            loan = loan || {};
            return Number(loan.amount || loan.principal || 0);
        };
        const getUserLoanRecords = (userId, loans = allLoansCache) => loans
            .filter(loan => loan && loan.userId === userId && isModernLoanRecord(loan))
            .sort((a, b) => timestampToMillis(b.createdAt || b.paidAt) - timestampToMillis(a.createdAt || a.paidAt));
        const getLatestModernLoanRequest = (userId, requests = allLoanRequestsCache) => requests
            .filter(request => request && request.userId === userId && isModernLoanRequest(request))
            .sort((a, b) => timestampToMillis(b.requestedAt || b.processedAt) - timestampToMillis(a.requestedAt || a.processedAt))[0] || null;
        const isAdminUserRecord = (user = {}) => {
            const email = String(user.email || '').trim().toLowerCase();
            return user.id === ADMIN_UID || user.uid === ADMIN_UID || email === 'reviewsworld01@gmail.com';
        };
        const formatCompactBalance = (amount) => {
            const value = Number(amount || 0);
            if (Math.abs(value) < 10000) return formatCurrency(value);
            const compact = new Intl.NumberFormat('en-IN', {
                maximumFractionDigits: value % 1000 === 0 ? 0 : 1
            }).format(value / 1000);
            return `₹${compact}k`;
        };
        const formatUsd = (amount) => `$${Number(amount || 0).toFixed(2)}`;
        const escapeHtml = (value = '') => String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        const getUserCacheKey = (userId) => `rw_wallet_user_cache_${userId}`;
        const getHistoryCacheKey = (userId) => `rw_wallet_history_cache_${userId}`;
        const getHistoryDataCacheKey = (userId) => `rw_wallet_history_data_cache_${userId}`;
        const ADMIN_USERS_CACHE_KEY = 'rw_admin_users_cache_v2';
        const APP_CONFIG_CACHE_KEY = 'rw_wallet_app_config_cache_v2';

        const readJsonCache = (key) => {
            try {
                return JSON.parse(localStorage.getItem(key) || 'null');
            } catch (e) {
                console.warn('Cache read failed:', e);
                return null;
            }
        };

        const writeJsonCache = (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.warn('Cache write failed:', e);
            }
        };

        const timestampToMillis = (timestamp) => {
            if (!timestamp) return 0;
            if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
            if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
            if (typeof timestamp === 'number') return timestamp;
            if (typeof timestamp === 'object' && Number.isFinite(Number(timestamp.seconds))) {
                return (Number(timestamp.seconds) * 1000) + Math.floor(Number(timestamp.nanoseconds || 0) / 1000000);
            }
            const parsed = new Date(timestamp).getTime();
            return Number.isNaN(parsed) ? 0 : parsed;
        };

        const normalizeAppConfigForCache = (config = {}) => {
            const normalized = { ...(config || {}) };
            const maintenanceEndMillis = timestampToMillis(
                normalized.maintenanceEndsAt || normalized.maintenance_ends_at || normalized.maintenanceEndAt || normalized.maintenanceEndsAtMillis || 0
            );
            const whatsNewUpdatedMillis = timestampToMillis(
                normalized.whatsNewUpdatedAt || normalized.whats_new_updated_at || normalized.whatsNewUpdatedAtMillis || 0
            );
            if (maintenanceEndMillis) normalized.maintenanceEndsAtMillis = maintenanceEndMillis;
            if (whatsNewUpdatedMillis) normalized.whatsNewUpdatedAtMillis = whatsNewUpdatedMillis;
            normalized.cachedAt = Date.now();
            return normalized;
        };

        const rememberAppConfig = (config = {}) => {
            const normalized = normalizeAppConfigForCache(config);
            writeJsonCache(APP_CONFIG_CACHE_KEY, normalized);
            return normalized;
        };

        const applyCachedAppConfigForStartup = () => {
            const cached = readJsonCache(APP_CONFIG_CACHE_KEY);
            if (!cached || typeof cached !== 'object') return false;
            appConfigCache = { ...(appConfigCache || {}), ...cached };
            return true;
        };

        const loadAppConfigForStartup = async () => {
            applyCachedAppConfigForStartup();
            try {
                const snapshot = await getDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'));
                if (snapshot.exists()) {
                    appConfigCache = rememberAppConfig(snapshot.data());
                }
            } catch (error) {
                console.warn('Initial app config load skipped:', error);
            }
            return appConfigCache;
        };

        const reviveCachedTimestamp = (value) => {
            const millis = timestampToMillis(value);
            if (!millis) return null;
            return {
                toMillis: () => millis,
                toDate: () => new Date(millis)
            };
        };

        const normalizeHistoryItemForCache = (item = {}) => {
            const cached = { ...item };
            ['timestamp', 'requestedAt', 'processedAt'].forEach(field => {
                if (cached[field]) cached[field] = timestampToMillis(cached[field]);
            });
            return cached;
        };

        const reviveHistoryItemFromCache = (item = {}) => {
            const revived = { ...item };
            ['timestamp', 'requestedAt', 'processedAt'].forEach(field => {
                if (revived[field]) revived[field] = reviveCachedTimestamp(revived[field]);
            });
            return revived;
        };

        const readHistoryItemsFromCache = (userId) => {
            const cached = readJsonCache(getHistoryDataCacheKey(userId));
            return Array.isArray(cached) ? cached.map(reviveHistoryItemFromCache) : [];
        };

        const writeHistoryItemsToCache = (userId, items) => {
            if (!userId || !Array.isArray(items)) return;
            writeJsonCache(getHistoryDataCacheKey(userId), items.map(normalizeHistoryItemForCache));
        };

        const normalizeTransactionType = (item = {}) => {
            const rawType = String(item.type || '').toLowerCase().replace(/\s+/g, '_');
            const comment = String(item.comment || item.remarks || '').toLowerCase();
            if (rawType.includes('withdraw') || comment.includes('withdraw')) return 'withdrawal';
            if (rawType.includes('recharge') || comment.includes('recharge')) return 'mobile_recharge';
            if (rawType.includes('gift')) return 'gift_card';
            if (rawType.includes('wallet_transfer') || rawType === 'transfer') return 'wallet_transfer';
            if (rawType === 'credit' || rawType.includes('credit') || rawType.includes('received') || rawType.includes('deposit') || rawType.includes('add_fund')) return 'credit';
            if (rawType === 'debit' || rawType.includes('debit') || rawType.includes('deduct') || rawType.includes('cut')) return 'debit';
            if (rawType.includes('sent') || comment.includes('money sent')) return 'debit';
            if (comment.includes('admin credit')) return 'credit';
            if (comment.includes('admin debit') || comment.includes('balance cut') || comment.includes('deduct')) return 'debit';
            if (Number(item.amount || 0) > 0) return 'credit';
            if (Number(item.amount || 0) < 0) return 'debit';
            return rawType || 'transaction';
        };

        const normalizeTransactionForHistory = (item = {}, index = 0) => {
            const timestamp = timestampToMillis(item.timestamp || item.requestedAt || item.createdAt || item.processedAt || item.date) || Date.now();
            const type = normalizeTransactionType(item);
            const amount = Number(item.amount || item.chargeAmount || 0);
            const transactionId = String(item.transaction_id || item.transactionId || item.adminTransactionId || item.id || `TX-${timestamp}-${index}`);
            return {
                ...item,
                id: item.id || transactionId,
                userId: item.user_id || item.userId || currentUser?.uid || '',
                transactionId,
                type,
                timestamp,
                amount,
                status: item.status || 'completed',
                comment: item.comment || item.remarks || item.description || (type === 'credit' ? 'Money Received' : type === 'withdrawal' ? 'Withdrawal' : 'Wallet Transaction')
            };
        };

        const getTransactionBalanceEffect = (item = {}) => {
            const type = normalizeTransactionType(item);
            const amount = Number(item.chargeAmount || item.amount || 0);
            const status = String(item.status || '').toLowerCase();
            if (!Number.isFinite(amount) || amount === 0) return 0;
            if (status === 'rejected' || status === 'failed') {
                if (type === 'withdrawal' || type === 'mobile_recharge') return amount;
                return 0;
            }
            if (type === 'credit' || type === 'wallet_transfer' || type === 'add_fund' || type === 'gift_card') return amount;
            if (type === 'debit' || type === 'withdrawal' || type === 'mobile_recharge') return -amount;
            return amount > 0 ? amount : 0;
        };

        const getExplicitBalanceAfter = (item = {}) => {
            const raw = item.balanceAfter ?? item.remainingBalance ?? item.remainingFund ?? item.walletBalanceAfter ?? item.balance_after;
            const value = Number(raw);
            return Number.isFinite(value) ? value : null;
        };

        const annotateTransactionsWithRemainingBalance = (items = [], currentBalance = 0) => {
            let runningBalance = Number(currentBalance || 0);
            return items.map(item => {
                const explicitBalanceAfter = getExplicitBalanceAfter(item);
                const balanceAfter = explicitBalanceAfter !== null ? explicitBalanceAfter : runningBalance;
                const effect = getTransactionBalanceEffect(item);
                runningBalance = Number((balanceAfter - effect).toFixed(2));
                return {
                    ...item,
                    balanceAfter,
                    balanceBefore: item.balanceBefore ?? item.balance_before ?? Number((balanceAfter - effect).toFixed(2))
                };
            });
        };

        const normalizeCloudTransaction = (item = {}) => normalizeTransactionForHistory(item);

        const getTransactionKey = (item = {}, index = 0) => {
            const timestamp = timestampToMillis(item.timestamp || item.requestedAt || item.createdAt || item.processedAt) || Date.now();
            const existingKey = String(item.key || '');
            if (existingKey.startsWith('req-')) return existingKey;
            const requestId = item.requestId || item.request_id;
            const type = normalizeTransactionType(item);
            if (requestId && (type === 'withdrawal' || type === 'mobile_recharge')) return `req-${requestId}`;
            return String(item.transactionId || item.adminTransactionId || item.requestId || item.id || existingKey || `${item.type || 'tx'}-${timestamp}-${item.amount || 0}-${index}`);
        };

        const mergeTransactionsByKey = (...groups) => {
            const merged = new Map();
            const statusRank = (item = {}) => ['completed', 'rejected', 'failed'].includes(String(item.status || '').toLowerCase()) ? 2 : 1;
            const getOriginalRequestTime = (...items) => {
                const times = items
                    .flat()
                    .map(item => timestampToMillis(item?.requestedAt || item?.requested_at || item?.createdAt || item?.timestamp))
                    .filter(time => Number.isFinite(time) && time > 0);
                return times.length ? Math.min(...times) : null;
            };
            groups.flat().forEach((item, index) => {
                if (!item) return;
                const normalized = normalizeTransactionForHistory(item, index);
                const key = getTransactionKey(normalized, index);
                const existing = merged.get(key) || {};
                let next = statusRank(normalized) >= statusRank(existing)
                    ? { ...existing, ...normalized, key }
                    : { ...normalized, ...existing, key };
                const type = normalizeTransactionType(next);
                if ((next.requestId || next.request_id) && (type === 'withdrawal' || type === 'mobile_recharge')) {
                    const requestedAt = getOriginalRequestTime(existing, normalized, item);
                    if (requestedAt) {
                        next = {
                            ...next,
                            requestedAt,
                            timestamp: requestedAt
                        };
                    }
                }
                merged.set(key, next);
            });
            return Array.from(merged.values())
                .sort((a, b) => timestampToMillis(b.timestamp || b.requestedAt) - timestampToMillis(a.timestamp || a.requestedAt));
        };

        const normalizePendingRequestForHistory = (request = {}) => {
            const requestType = request.type || 'withdrawal';
            const timestamp = request.requestedAt || request.requested_at || request.timestamp || request.createdAt || Date.now();
            const requestId = request.id || request.requestId || request.request_id || `${requestType}-${timestampToMillis(timestamp)}-${request.amount || 0}`;
            return {
                ...request,
                id: requestId,
                requestId,
                key: `req-${requestId}`,
                type: requestType,
                comment: requestType === 'mobile_recharge' ? 'Mobile Recharge Request' : 'Withdrawal Request',
                timestamp,
                status: request.status || 'pending'
            };
        };

        const loadFirebaseTransactions = async (userId, maxItems = 5000) => {
            const docsByPath = new Map();
            const addSnapshot = (snap, source) => {
                snap.docs.forEach((docSnap, index) => {
                    docsByPath.set(`${source}:${docSnap.ref.path}`, {
                        id: docSnap.id,
                        sourcePath: docSnap.ref.path,
                        ...docSnap.data(),
                        _sourceIndex: index
                    });
                });
            };

            const directCollections = [
                `artifacts/${appId}/public/data/users/${userId}/transactions`,
                'artifacts/digital-wallet-prod/public/data/users/' + userId + '/transactions',
                'users/' + userId + '/transactions',
                'wallet_users/' + userId + '/transactions'
            ];

            for (const path of [...new Set(directCollections)]) {
                try {
                    addSnapshot(await getDocs(collection(db, path)), path);
                } catch (error) {
                    console.warn('Transaction path load skipped:', path, error);
                }
            }

            const rootTransactionCollections = ['transactions', 'transaction_history', 'wallet_transactions'];
            const userFields = ['userId', 'uid', 'user_id'];
            for (const rootPath of rootTransactionCollections) {
                for (const field of userFields) {
                    try {
                        const snap = await getDocs(query(collection(db, rootPath), where(field, '==', userId)));
                        addSnapshot(snap, `${rootPath}:${field}`);
                    } catch (error) {
                        console.warn('Root transaction query skipped:', rootPath, field, error);
                    }
                }
            }

            return mergeTransactionsByKey(Array.from(docsByPath.values()))
                .slice(0, maxItems);
        };

        const serializeCloudTransaction = (item = {}, userId = currentUser?.uid) => {
            const timestamp = timestampToMillis(item.timestamp || item.requestedAt || item.createdAt || item.processedAt) || Date.now();
            const transactionId = String(item.transactionId || item.adminTransactionId || item.requestId || item.id || `${item.type || 'tx'}-${timestamp}`);
            return {
                userId,
                transactionId,
                type: item.type || 'transaction',
                amount: Number(item.amount || 0),
                status: item.status || 'completed',
                timestamp,
                details: normalizeHistoryItemForCache({ ...item, transactionId, timestamp })
            };
        };

        const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
                return await fetch(url, { ...options, signal: controller.signal });
            } finally {
                clearTimeout(timeoutId);
            }
        };

        const fetchCloudTransactionHistory = async (userId, limit = 100) => {
            const token = await getBackendAuthToken();
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/transactions/${encodeURIComponent(userId)}?limit=${limit}`, {
                headers: { Authorization: `Bearer ${token}` }
            }, 7000);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Cloudflare history load failed');
            return (data.history || []).map(normalizeCloudTransaction);
        };

        const importFirestoreTransactionsToCloud = async (userId, items) => {
            if (!items.length) return;
            try {
                const token = await getBackendAuthToken();
                for (let index = 0; index < items.length; index += 500) {
                    const chunk = items.slice(index, index + 500);
                    await fetch(`${BACKEND_BASE_URL}/api/transactions/import`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userId,
                            transactions: chunk.map(item => serializeCloudTransaction(item, userId))
                        })
                    });
                }
            } catch (error) {
                console.warn('Cloudflare history import failed:', error);
            }
        };

        const recordCloudTransaction = async (userId, item) => {
            try {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/transactions`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(serializeCloudTransaction(item, userId))
                }, 5000);
            } catch (error) {
                console.warn('Cloudflare transaction save failed:', error);
            }
        };

        const getSafeTransactionDocId = (id = '') => String(id || generateTransactionId()).replace(/[\/\\#?[\]]/g, '-').slice(0, 120);

        const recordUserFirestoreTransaction = async (userId, item = {}) => {
            const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
            const transactionId = item.transactionId || generateTransactionId();
            const txRef = doc(collection(userRef, 'transactions'), getSafeTransactionDocId(transactionId));
            await setDoc(txRef, {
                ...item,
                transactionId,
                timestamp: item.timestamp || serverTimestamp()
            }, { merge: true });
            return { ...item, transactionId };
        };

        const recordCloudTransfer = async (senderItem, recipientItem, recipientUserId) => {
            try {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/transactions/transfer`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sender: serializeCloudTransaction(senderItem, currentUser.uid),
                        recipient: serializeCloudTransaction(recipientItem, recipientUserId)
                    })
                }, 5000);
            } catch (error) {
                console.warn('Cloudflare transfer save failed:', error);
            }
        };

        const serializeCloudFundRequest = (request = {}) => {
            const requestedAt = timestampToMillis(request.requestedAt || request.timestamp || request.createdAt) || Date.now();
            const processedAt = request.processedAt ? timestampToMillis(request.processedAt) : null;
            const requestId = String(request.requestId || request.id || `${request.type || 'request'}-${requestedAt}`);
            return {
                requestId,
                userId: request.userId || currentUser?.uid || '',
                type: request.type || 'withdrawal',
                amount: Number(request.amount || 0),
                status: request.status || 'pending',
                requestedAt,
                processedAt,
                details: {
                    ...normalizeHistoryItemForCache({ ...request, id: requestId, requestedAt, processedAt }),
                    id: requestId
                }
            };
        };

        const normalizeCloudFundRequest = (request = {}) => {
            const details = request.details && typeof request.details === 'object' ? request.details : {};
            const merged = { ...details, ...request };
            return {
                ...merged,
                id: request.request_id || request.requestId || request.id || details.id || details.requestId,
                userId: request.user_id || request.userId || details.userId,
                requestedAt: Number(request.requested_at || request.requestedAt || details.requestedAt || Date.now()),
                processedAt: request.processed_at || request.processedAt || details.processedAt || null,
                amount: Number(request.amount || details.amount || 0),
                status: request.status || details.status || 'pending',
                type: request.type || details.type || 'withdrawal',
                method: getWithdrawalDisplayMethodName({ ...details, ...request }, 'N/A'),
                methodId: details.methodId || request.methodId || details.paymentMethod || request.paymentMethod || '',
                userName: details.userName || request.userName || request.user_name || 'No Name',
                userEmail: details.userEmail || request.userEmail || request.user_email || '',
                userMobile: details.userMobile || request.userMobile || request.user_mobile || ''
            };
        };

        const upsertCloudFundRequest = async (request) => {
            try {
                const token = await getBackendAuthToken();
                await fetch(`${BACKEND_BASE_URL}/api/fund-requests`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(serializeCloudFundRequest(request))
                });
            } catch (error) {
                console.warn('Cloudflare fund request save failed:', error);
            }
        };

        const importCloudFundRequests = async (requests) => {
            if (!requests.length || currentUser?.uid !== ADMIN_UID) return;
            try {
                const token = await getBackendAuthToken();
                await fetch(`${BACKEND_BASE_URL}/api/fund-requests/import`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ requests: requests.map(serializeCloudFundRequest) })
                });
            } catch (error) {
                console.warn('Cloudflare fund request import failed:', error);
            }
        };

        const loadCloudFundRequests = async ({ status = 'pending', type = '', userId = '', limit = 300, timeoutMs = 8000 } = {}) => {
            const token = await getBackendAuthToken();
            const params = new URLSearchParams({ status, limit: String(limit) });
            if (type) params.set('type', type);
            if (userId) params.set('userId', userId);
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/fund-requests?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            }, timeoutMs);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Cloudflare fund request load failed');
            return (data.requests || []).map(normalizeCloudFundRequest);
        };

        const updateCloudFundRequestStatus = async (requestId, status, details = {}) => {
            try {
                const token = await getBackendAuthToken();
                await fetch(`${BACKEND_BASE_URL}/api/fund-requests/${encodeURIComponent(requestId)}`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status, details })
                });
            } catch (error) {
                console.warn('Cloudflare fund request update failed:', error);
            }
        };

        const loadFirebasePendingFundRequests = async (userId = '') => {
            const conditions = [where("status", "==", "pending")];
            if (userId) conditions.push(where("userId", "==", userId));
            const pendingQuery = query(collection(db, `artifacts/${appId}/public/data/fund_requests`), ...conditions);
            const snap = await getDocs(pendingQuery);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        };

        const loadUserPendingWithdrawalsMerged = async (userId) => {
            if (!userId) return [];
            const [cloudRequests, firebaseRequests] = await Promise.all([
                loadCloudFundRequests({ status: 'pending', type: 'withdrawal', userId, limit: 200 }).catch(error => {
                    console.warn('User cloud pending withdrawals skipped:', error);
                    return [];
                }),
                loadFirebasePendingFundRequests(userId).catch(error => {
                    console.warn('User Firebase pending withdrawals skipped:', error);
                    return [];
                })
            ]);
            return mergeFundRequestsById(cloudRequests, firebaseRequests)
                .filter(req => (req.type || 'withdrawal') === 'withdrawal' && (req.status || 'pending') === 'pending');
        };

        const mergeFundRequestsById = (...groups) => {
            const merged = new Map();
            const signatureToKey = new Map();
            const getRequestSignature = (request = {}) => {
                const timestamp = timestampToMillis(request.requestedAt || request.requested_at || request.timestamp || request.createdAt);
                const minuteBucket = timestamp ? Math.floor(timestamp / 60000) : 'no-time';
                const userId = request.userId || request.uid || request.user_id || '';
                const type = request.type || 'withdrawal';
                const amount = Number(request.amount || 0).toFixed(2);
                const method = String(request.method || request.methodId || request.paymentMethod || request.payment_method || '').toLowerCase().trim();
                const detail = String(getWithdrawalDetailText(request) || '').toLowerCase().trim();
                return `${userId}|${type}|${amount}|${method}|${detail}|${minuteBucket}`;
            };
            groups.flat().forEach((request) => {
                const id = request.id || request.requestId || request.request_id;
                const signature = getRequestSignature(request);
                const existingKey = signatureToKey.get(signature);
                const key = existingKey || id || signature;
                if (!key) return;
                signatureToKey.set(signature, key);
                merged.set(key, { ...(merged.get(key) || {}), ...request, id: id || key });
            });
            return Array.from(merged.values())
                .filter(req => (req.status || 'pending') === 'pending')
                .sort((a, b) => timestampToMillis(b.requestedAt || b.requested_at) - timestampToMillis(a.requestedAt || a.requested_at));
        };

        const refreshAdminFundRequestsFromCloud = async () => {
            if (currentUser?.uid !== ADMIN_UID) return;
            try {
                const cloudRequests = await loadCloudFundRequests({ status: 'pending' });
                let firebasePendingRequests = [];
                if (!fundRequestsImportedFromFirebase) {
                    firebasePendingRequests = await loadFirebasePendingFundRequests();
                    const cloudIds = new Set(cloudRequests.map(req => req.id || req.requestId || req.request_id));
                    const missingFirebaseRequests = firebasePendingRequests.filter(req => !cloudIds.has(req.id));
                    if (missingFirebaseRequests.length) {
                        await importCloudFundRequests(missingFirebaseRequests);
                    }
                    fundRequestsImportedFromFirebase = true;
                }
                const allRequests = mergeFundRequestsById(cloudRequests, firebasePendingRequests);
                allFundRequestsCache = allRequests.filter(req => (req.type || 'withdrawal') === 'withdrawal');
                allRechargeRequestsCache = allRequests.filter(req => req.type === 'mobile_recharge');
                updateAdminPendingRequestSummary();
                if (document.getElementById('admin-fund-requests-list-page')) renderAdminFundRequests(allFundRequestsCache);
                if (document.getElementById('admin-recharge-requests-list-page')) renderAdminRechargeRequests(allRechargeRequestsCache);
            } catch (error) {
                console.error('Cloudflare fund request load failed:', error);
                try {
                    await importFirebaseFundRequestsForAdmin();
                } catch (fallbackError) {
                    console.error('Firebase pending fund request fallback failed:', fallbackError);
                    if (document.getElementById('admin-fund-requests-list-page')) {
                        renderAdminFundRequests(allFundRequestsCache || []);
                    }
                }
            }
        };

        const importFirebaseFundRequestsForAdmin = async () => {
            const allRequests = await loadFirebasePendingFundRequests();
            await importCloudFundRequests(allRequests);
            fundRequestsImportedFromFirebase = true;
            allFundRequestsCache = allRequests.filter(req => req.status === 'pending' && (req.type || 'withdrawal') === 'withdrawal');
            allRechargeRequestsCache = allRequests.filter(req => req.status === 'pending' && req.type === 'mobile_recharge');
            updateAdminPendingRequestSummary();
            if (document.getElementById('admin-fund-requests-list-page')) renderAdminFundRequests(allFundRequestsCache);
            if (document.getElementById('admin-recharge-requests-list-page')) renderAdminRechargeRequests(allRechargeRequestsCache);
        };

        const updateAdminPendingRequestSummary = () => {
            const totalPendingAmount = allFundRequestsCache.reduce((total, req) => total + (req.amount || 0), 0);
            const pendingElement = document.getElementById('admin-pending-withdrawals');
            if (pendingElement) {
                pendingElement.innerHTML = `${allFundRequestsCache.length}<br><span class="text-sm font-normal">${formatCurrency(totalPendingAmount)}</span>`;
            }
            const analyticsPendingElement = document.getElementById('analytics-pending-reqs');
            if (analyticsPendingElement) {
                analyticsPendingElement.textContent = allFundRequestsCache.length;
            }
            ['admin-withdrawal-request-badge'].forEach((id) => {
                const badge = document.getElementById(id);
                if (!badge) return;
                badge.textContent = allFundRequestsCache.length > 99 ? '99+' : String(allFundRequestsCache.length || '');
                badge.classList.toggle('hidden', allFundRequestsCache.length <= 0);
            });
            const analyticsPendingAmountElement = document.getElementById('analytics-pending-amount');
            if (analyticsPendingAmountElement) {
                analyticsPendingAmountElement.textContent = formatCurrency(totalPendingAmount);
            }
        };

        const syncRecentTransactionsToCloud = async (userId = currentUser?.uid) => {
            if (!userId) return;
            try {
                const items = await loadFirebaseTransactions(userId, 2000);
                await importFirestoreTransactionsToCloud(userId, items);
                const mergedUserHistory = mergeTransactionsByKey(readHistoryItemsFromCache(userId), items);
                writeHistoryItemsToCache(userId, mergedUserHistory);
                if (currentUser?.uid === userId) {
                    unifiedHistoryCache = mergeTransactionsByKey(unifiedHistoryCache, mergedUserHistory);
                }
            } catch (error) {
                console.warn('Firebase transaction cache sync failed:', error);
            }
        };

        const prefetchTransactionHistory = (userId = currentUser?.uid, { force = false } = {}) => {
            if (!userId) return Promise.resolve([]);
            if (!force && transactionHistoryPrefetch.userId === userId && transactionHistoryPrefetch.promise) {
                return transactionHistoryPrefetch.promise;
            }
            if (!force && transactionHistoryPrefetch.userId === userId && transactionHistoryPrefetch.loadedAt && Date.now() - transactionHistoryPrefetch.loadedAt < 60000) {
                return Promise.resolve(unifiedHistoryCache);
            }
            const cached = readHistoryItemsFromCache(userId);
            if (cached.length) {
                unifiedHistoryCache = mergeTransactionsByKey(unifiedHistoryCache, cached);
            }
            transactionHistoryPrefetch.userId = userId;
            transactionHistoryPrefetch.promise = (async () => {
                const [firebaseTransactions, cloudTransactions, pendingWithdrawals] = await Promise.all([
                    loadFirebaseTransactions(userId, 5000).catch(error => {
                        console.warn('Firebase transaction prefetch skipped:', error);
                        return [];
                    }),
                    fetchCloudTransactionHistory(userId, 5000).catch(error => {
                        console.warn('Cloud transaction prefetch skipped:', error);
                        return [];
                    }),
                    loadUserPendingWithdrawalsMerged(userId).catch(error => {
                        console.warn('Pending withdrawal prefetch skipped:', error);
                        return [];
                    })
                ]);
                const activeHistoryCache = currentUser?.uid === userId ? unifiedHistoryCache : readHistoryItemsFromCache(userId);
                const cachedPending = (activeHistoryCache || []).filter(item => String(item.key || '').startsWith('req-') || item.status === 'pending');
                const pendingHistoryItems = pendingWithdrawals.map(normalizePendingRequestForHistory);
                const mergedUserHistory = mergeTransactionsByKey(firebaseTransactions, cloudTransactions, cachedPending, pendingHistoryItems);
                writeHistoryItemsToCache(userId, mergedUserHistory);
                if (currentUser?.uid === userId) {
                    unifiedHistoryCache = mergedUserHistory;
                }
                if (firebaseTransactions.length) importFirestoreTransactionsToCloud(userId, firebaseTransactions);
                transactionHistoryPrefetch.loadedAt = Date.now();
                return mergedUserHistory;
            })().finally(() => {
                transactionHistoryPrefetch.promise = null;
            });
            return transactionHistoryPrefetch.promise;
        };

        const addInstantTransactionToHistory = (userId, item = {}) => {
            if (!userId || !item) return null;
            const normalized = normalizeTransactionForHistory({
                ...item,
                timestamp: item.timestamp || Date.now()
            });
            const mergedUserHistory = mergeTransactionsByKey([normalized], readHistoryItemsFromCache(userId), currentUser?.uid === userId ? unifiedHistoryCache : []);
            writeHistoryItemsToCache(userId, mergedUserHistory);
            if (currentUser?.uid === userId) {
                unifiedHistoryCache = mergedUserHistory;
            }
            transactionHistoryPrefetch = { userId, promise: null, loadedAt: 0 };
            if (document.getElementById('transactions-list')) {
                document.getElementById('transactions-list').innerHTML = unifiedHistoryCache.slice(0, 5).map(tx => renderTransactionItem(tx)).join('');
                try {
                    localStorage.setItem(getHistoryCacheKey(userId), document.getElementById('transactions-list').innerHTML);
                } catch (error) {
                    console.warn('Instant history html cache skipped:', error);
                }
            }
            if (document.getElementById('all-transactions-list')) {
                const activeFilter = document.querySelector('#filter-bar .active-filter')?.dataset.filter || 'all';
                renderFilteredTransactions(activeFilter, { reset: false });
            }
            return unifiedHistoryCache.find(tx => tx.transactionId === normalized.transactionId) || normalized;
        };

        const sanitizeUserForCache = (data = {}, uid = '') => ({
            uid,
            email: data.email || '',
            name: data.name || '',
            mobile: data.mobile || '',
            balance: data.balance || 0,
            paymentMethod: data.paymentMethod || '',
            paymentDetails: data.paymentDetails || {},
            whatsappNumber: data.whatsappNumber || data.mobile || '',
            websiteLinks: Array.isArray(data.websiteLinks) ? data.websiteLinks.slice(0, 3) : [],
            isProProfile: !!data.isProProfile,
            isFlagged: !!data.isFlagged,
            isDisabled: !!data.isDisabled,
            banReason: data.banReason || '',
            banExpiry: timestampToMillis(data.banExpiry) || null,
            approvalStatus: data.approvalStatus || '',
            signupApprovalStatus: data.signupApprovalStatus || '',
            accountStatus: data.accountStatus || '',
            isApproved: data.isApproved === true,
            approvalRejectionReason: data.approvalRejectionReason || '',
            signupRequestedAt: timestampToMillis(data.signupRequestedAt) || null,
            loanEligible: !!data.loanEligible,
            maxLoanAmount: data.maxLoanAmount || data.loanMaxAmount || 0,
            loanMaxAmount: data.loanMaxAmount || data.maxLoanAmount || 0,
            activeLoanId: data.activeLoanId || '',
            activeLoanRepayable: data.activeLoanRepayable || 0,
            loanLockedAmount: data.loanLockedAmount || 0,
            dueLoanBlocked: !!data.dueLoanBlocked,
            dueLoanReason: data.dueLoanReason || ''
        });

        const hydrateUserFromCache = (userId) => {
            const cached = readJsonCache(getUserCacheKey(userId));
            if (!cached) return false;
            if (cached.isFlagged || cached.isDisabled || isUserApprovalPending(cached) || isUserApprovalRejected(cached)) {
                return false;
            }

            currentUserData = cached;
            document.getElementById('user-balance').textContent = formatCompactBalance(cached.balance || 0);
            updateDollarBalanceDisplay(cached.balance || 0);
            if (userId === ADMIN_UID) {
                document.getElementById('admin-wallet-balance').textContent = formatCompactBalance(cached.balance || 0);
            }
            return true;
        };

        const getBackendProfilePayload = () => ({
            name: currentUserData?.name || currentUser?.displayName || '',
            mobile: currentUserData?.mobile || '',
            phoneNumber: currentUserData?.mobile || ''
        });

        const getBackendAuthToken = async (forceRefresh = false) => {
            if (!currentUser) throw new Error('Login required');
            if (backendAuthToken && !forceRefresh) return backendAuthToken;
            if (backendAuthPromise && !forceRefresh) return backendAuthPromise;

            backendAuthPromise = currentUser.getIdToken(forceRefresh)
                .then(idToken => fetchWithTimeout(`${BACKEND_BASE_URL}/api/session/firebase`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idToken,
                        profile: getBackendProfilePayload()
                    })
                }, 7000))
                .then(async res => {
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data.ok || !data.token) {
                        throw new Error(data.error || 'Backend session failed');
                    }
                    backendAuthToken = data.token;
                    return backendAuthToken;
                })
                .finally(() => {
                    backendAuthPromise = null;
                });

            return backendAuthPromise;
        };

        const loadSocketIoClient = (timeoutMs = 2500) => {
            if (typeof window.io === 'function') return Promise.resolve(window.io);
            if (supportSocketClientLoadPromise) return supportSocketClientLoadPromise;

            supportSocketClientLoadPromise = new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-rw-socket-io-client="true"]');
                const script = existing || document.createElement('script');
                let done = false;
                const finish = (callback, value) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    script.onload = null;
                    script.onerror = null;
                    callback(value);
                };
                const timer = setTimeout(() => {
                    if (!existing) script.remove();
                    finish(reject, new Error('Support chat realtime client timed out.'));
                }, timeoutMs);

                script.onload = () => {
                    if (typeof window.io === 'function') {
                        finish(resolve, window.io);
                    } else {
                        finish(reject, new Error('Support chat realtime client is not available.'));
                    }
                };
                script.onerror = () => {
                    if (!existing) script.remove();
                    finish(reject, new Error('Support chat realtime client failed to load.'));
                };

                if (!existing) {
                    script.src = `${BACKEND_BASE_URL}/socket.io/socket.io.js`;
                    script.async = true;
                    script.defer = true;
                    script.dataset.rwSocketIoClient = 'true';
                    document.head.appendChild(script);
                }
            }).catch(error => {
                supportSocketClientLoadPromise = null;
                throw error;
            });

            return supportSocketClientLoadPromise;
        };

        const getSupportSocket = async ({ timeoutMs = 2500 } = {}) => {
            await loadSocketIoClient(timeoutMs);
            const token = await getBackendAuthToken();
            if (supportSocket?.connected) return supportSocket;

            supportSocket = window.io(BACKEND_BASE_URL, {
                transports: ['websocket', 'polling'],
                auth: { token }
            });

            supportSocket.on('connect_error', async (error) => {
                console.warn('Support socket connection failed:', error?.message || error);
                if (/token|auth/i.test(error.message || '')) {
                    backendAuthToken = '';
                }
            });

            return supportSocket;
        };

        let usdInrRateCache = null;
        let usdInrRateDate = '';
        let usdRateFetchPromise = null;

        const updateDollarBalanceDisplay = async (balance) => {
            const usdEl = document.getElementById('user-balance-usd');
            if (!usdEl) return;
            usdEl.textContent = '$--';

            try {
                const rate = await fetchUsdInrRate();
                usdEl.textContent = formatUsd((balance || 0) / rate);
            } catch (e) {
                console.error('USD balance update failed:', e);
                usdEl.textContent = '$--';
            }
        };

        const fetchUsdInrRate = async () => {
            const today = new Date().toISOString().slice(0, 10);
            if (usdInrRateCache && usdInrRateDate === today) return usdInrRateCache;
            if (usdRateFetchPromise) return usdRateFetchPromise;

            usdRateFetchPromise = fetch('https://open.er-api.com/v6/latest/USD')
                .then(res => {
                    if (!res.ok) throw new Error(`Rate API error ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    const rate = data?.rates?.INR;
                    if (!rate) throw new Error('INR rate missing');
                    usdInrRateCache = rate;
                    usdInrRateDate = today;
                    return rate;
                })
                .finally(() => {
                    usdRateFetchPromise = null;
                });

            return usdRateFetchPromise;
        };

        const formatDate = (timestamp) => {
            if (!timestamp) return 'N/A';
            const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const date = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
            const time = d.toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            return `${date} ${time}`;
        };

        const formatDateDDMMYY = (timestamp) => {
            if (!timestamp) return 'N/A';
            const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yy = String(d.getFullYear()).slice(-2);
            const time = d.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            return `${dd}/${mm}/${yy} ${time}`;
        };

        const getTimeFromTimestamp = (timestamp) => {
            if (!timestamp) return 'N/A';
            const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return d.toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        };

        // Function to mask mobile number
        const normalizePhoneDigits = (value = '') => String(value || '').replace(/\D/g, '').slice(-10);
        const getUserMobileValue = (user = {}) =>
            user.mobile || user.phoneNumber || user.phone || user.userMobile || user.contactNumber || '';
        const findExistingUserByMobile = async (mobile, excludeUid = '') => {
            const digits = normalizePhoneDigits(mobile);
            if (!/^\d{10}$/.test(digits)) return null;
            const localMatch = allUsersCache.find(user =>
                (user.id || user.uid) !== excludeUid && normalizePhoneDigits(getUserMobileValue(user)) === digits
            );
            if (localMatch) return localMatch;
            const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
            const directQueries = [
                query(usersRef, where('mobile', '==', digits)),
                query(usersRef, where('phoneNumber', '==', digits))
            ];
            for (const mobileQuery of directQueries) {
                const snap = await getDocs(mobileQuery);
                const match = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .find(user => (user.id || user.uid) !== excludeUid);
                if (match) return match;
            }
            const allSnap = await getDocs(usersRef);
            return allSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .find(user => (user.id || user.uid) !== excludeUid && normalizePhoneDigits(getUserMobileValue(user)) === digits) || null;
        };
        const userMatchesSearch = (user = {}, searchTerm = '') => {
            const rawSearch = String(searchTerm || '').trim().toLowerCase();
            if (!rawSearch) return true;
            const digitSearch = normalizePhoneDigits(rawSearch);
            const userDigits = normalizePhoneDigits(getUserMobileValue(user));
            return [
                user.email,
                user.name,
                user.fullName,
                user.displayName,
                user.mobile,
                user.phoneNumber,
                user.phone,
                user.userMobile,
                user.contactNumber,
                user.id,
                user.uid
            ].some(value => String(value || '').toLowerCase().includes(rawSearch))
                || (!!digitSearch && userDigits.includes(digitSearch));
        };

        const maskMobile = (mobile) => {
            if (!mobile || mobile.length < 10) return '******';
            const digits = normalizePhoneDigits(mobile);
            if (digits.length < 10) return '******';
            return digits.substring(0, 3) + '****' + digits.substring(7);
        };

        // Function to mask UPI ID
        const maskUpi = (upiId) => {
            if (!upiId) return '******';
            const atIndex = upiId.indexOf('@');
            if (atIndex <= 2) return '****' + upiId.substring(atIndex);
            return upiId.substring(0, 2) + '****' + upiId.substring(atIndex);
        };

        // Generate transaction ID
        const generateTransactionId = () => {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 8);
            return `TXN${timestamp}${random}`.toUpperCase();
        };

        // Keep toast feedback visual-only so startup never pulls blocked external media.
        const playSuccessSound = () => {};
        const playErrorSound = () => {};

        const closeNotification = () => {
            if (notificationTimeout) clearTimeout(notificationTimeout);
            document.getElementById('notification-toast').classList.remove('show');
        };
        window.closeNotification = closeNotification;

        // Toast helper with sound
        const showNotification = (message, isError = false, playSound = true) => {
            const toast = document.getElementById('notification-toast');
            if (notificationTimeout) clearTimeout(notificationTimeout);
            const rawMessage = String(message || '');
            const displayMessage = isError && /(^Error:|Firebase|permission-denied|network-request-failed|failed:|Transaction failed:|Redeem failed:|undefined|null|already processed)/i.test(rawMessage)
                ? friendlyErrorMessage()
                : rawMessage;
            const safeMessage = escapeHtml(displayMessage);

            const toastClass = isError ? 'toast-error' : 'toast-success';
            const iconPath = isError
                ? 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
                : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';

            toast.innerHTML = `
                <div class="toast-content ${toastClass}">
                    <div class="toast-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}" />
                        </svg>
                    </div>
                    <div class="toast-message">${safeMessage}</div>
                    <button class="toast-close" onclick="closeNotification()">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <div class="toast-progress"></div>
                </div>`;

            toast.classList.add('show');

            // Play sound if requested
            if (playSound) {
                if (isError) {
                    playErrorSound();
                } else {
                    playSuccessSound();
                }
            }

            notificationTimeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        };

        const renderModal = (title, content, actions, size = 'max-w-md', colorfulBorder = false) => {
            const borderClass = colorfulBorder ? 'colorful-border' : '';
            document.getElementById('modal-container').innerHTML = `
                <div id="app-modal" class="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div class="fixed inset-0 modal-backdrop" onclick="window.closeModal()"></div>
                    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-[90] w-full ${size} max-h-[88dvh] overflow-hidden border border-gray-100 dark:border-gray-700 p-0 transform transition-all scale-95 opacity-0 animate-modal-in ${borderClass}">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold px-6 pt-6">${title}</h3>
                            <button onclick="window.closeModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl px-6 pt-6">&times;</button>
                        </div>
                        <div class="px-6 ${actions ? 'max-h-[62dvh]' : 'max-h-[70dvh] pb-6'} overflow-y-auto">${content}</div>
                        ${actions ? `<div class="mt-6 flex justify-end space-x-3 border-t border-gray-100 dark:border-gray-700 px-6 py-4 bg-white dark:bg-gray-800">${actions}</div>` : ''}
                    </div>
                </div>
                <style> 
                    @keyframes animate-modal-in { to { scale: 1; opacity: 1; } } 
                    .animate-modal-in { animation: animate-modal-in 0.2s ease-out forwards; } 
                </style>`;
            setTimeout(keepFocusedInputVisible, 80);
        };
        window.closeModal = () => {
            document.getElementById('modal-container').innerHTML = '';
        };

        const renderTransactionItem = (item, isFullPage = false) => {
            const hasDetailKey = !!item.key;
            const clickableClass = hasDetailKey ? 'tx-item-clickable cursor-pointer' : '';
            const dataKey = hasDetailKey ? `data-key="${item.key}"` : '';

            if (item.type === 'mobile_recharge') {
                const isPending = item.status === 'pending';
                const isRejected = item.status === 'rejected';
                const statusText = isPending ? 'Pending' : isRejected ? 'Rejected' : 'Completed';
                const statusColor = isPending ? 'text-yellow-600' : isRejected ? 'text-red-500' : 'text-green-500';
                const bgColor = isPending ? 'bg-sky-50 dark:bg-sky-900/20' : isRejected ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/50';
                const chargeAmount = item.chargeAmount || item.amount || 0;

                return `
                    <div class="flex justify-between items-center p-3 ${bgColor} rounded-lg text-sm ${clickableClass}" ${dataKey}>
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold">Mobile Recharge</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${item.mobileNumber || ''} ${item.operator ? `| ${item.operator}` : ''}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp || item.requestedAt)}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-red-500">-${formatCurrencyAbs(chargeAmount)}</p>
                            <p class="text-xs font-semibold ${statusColor}">${statusText}</p>
                        </div>
                    </div>`;
            }

            if (item.status === 'pending') {
                return `
                    <div class="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm ${clickableClass}" ${dataKey}>
                        <div class="flex-1">
                            <p class="font-semibold capitalize">Withdrawal Request</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${formatDate(item.timestamp)}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-yellow-600">${formatCurrencyAbs(item.amount)}</p>
                            <p class="text-xs font-semibold text-yellow-600">Pending</p>
                        </div>
                    </div>`;
            }

            // Handle withdrawal status
            if (item.type === 'withdrawal') {
                let statusText = 'Completed';
                let statusColor = 'text-red-500';
                let bgColor = 'bg-red-50 dark:bg-red-900/20';
                let txnIdBadge = '';

                if (item.adminTransactionId) {
                    txnIdBadge = `<span class="txn-id-badge text-xs ml-2">${item.adminTransactionId}</span>`;
                }

                if (item.status === 'rejected') {
                    statusText = 'Rejected';
                    statusColor = 'text-red-500';
                    bgColor = 'bg-red-50 dark:bg-red-900/20';
                }

                return `
                    <div class="flex justify-between items-center p-3 ${bgColor} rounded-lg text-sm ${clickableClass}" ${dataKey}>
                        <div class="flex-1">
                            <p class="font-semibold">Withdrawal ${txnIdBadge}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp)}</p>
                            ${item.rejectionReason ? `<p class="text-xs text-red-400 mt-1">Reason: ${escapeHtml(item.rejectionReason)}</p>` : ''}
                        </div>
                        <div class="text-right">
                            <p class="font-bold ${statusColor}">-${formatCurrencyAbs(item.amount)}</p>
                            <p class="text-xs font-semibold ${statusColor}">${statusText}</p>
                        </div>
                    </div>`;
            }

            // Handle wallet transfers (Pay to Wallet) - Show clear From/To information
            if (item.type === 'wallet_transfer') {
                const isCredit = item.amount > 0;
                const sign = isCredit ? '+' : '-';
                const colorClass = isCredit ? 'text-green-500' : 'text-red-500';
                const actionText = isCredit ? 'From: ' : 'To: ';
                const userName = isCredit ? (item.senderName || 'User') : (item.recipientName || 'User');

                return `
                    <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm ${clickableClass}" ${dataKey}>
                        <div class="flex-1">
                            <p class="font-semibold">${actionText}${escapeHtml(userName)}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp)}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Wallet Transfer</p>
                        </div>
                        <p class="font-bold ${colorClass}">
                            ${sign}${formatCurrency(Math.abs(item.amount))}
                        </p>
                    </div>`;
            }

            // Handle debit transactions (when user sends money) - Show To information
            if (item.type === 'debit' && item.recipientName) {
                return `
                    <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm ${clickableClass}" ${dataKey}>
                        <div class="flex-1">
                            <p class="font-semibold">To: ${escapeHtml(item.recipientName || 'User')}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp)}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Money Sent</p>
                        </div>
                        <p class="font-bold text-red-500">
                            -${formatCurrencyAbs(item.amount)}
                        </p>
                    </div>`;
            }

            // Handle other transaction types
            const normalizedType = normalizeTransactionType(item);
            const isCredit = ['credit', 'gift_card'].includes(normalizedType) || (Number(item.amount || 0) > 0 && !['debit', 'withdrawal', 'mobile_recharge'].includes(normalizedType));
            const sign = isCredit ? '+' : '-';
            const colorClass = isCredit ? 'text-green-500' : 'text-red-500';

            // Check if this is a debit (wallet send) and use recipientName if available
            let displayText = (item.comment || item.type || 'Wallet Transaction').replace(/_/g, ' ');
            if (item.type === 'debit' && item.recipientName) {
                displayText = item.recipientName;
            }

            return `
                <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm ${clickableClass}" ${dataKey}>
                    <div class="flex-1">
                        <p class="font-semibold capitalize">${escapeHtml(displayText)}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp)}</p>
                    </div>
                    <p class="font-bold ${colorClass}">
                        ${sign}${formatCurrencyAbs(item.amount)}
                    </p>
                </div>`;
        };


        // --- PAGE NAVIGATION ---
        const setBottomNavActive = (activeId) => {
            document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.id === activeId);
            });
        };

        const setMainChrome = (show) => {
            document.getElementById('bottom-nav')?.classList.toggle('hidden', !show);
        };

        const applyAdminBottomChrome = (isAdmin) => {
            document.getElementById('admin-tab-button')?.classList.toggle('hidden', !isAdmin);
            const bottomAdminButton = document.getElementById('bottom-admin-btn');
            if (bottomAdminButton) {
                bottomAdminButton.hidden = !isAdmin;
                bottomAdminButton.classList.toggle('hidden', !isAdmin);
            }
            document.getElementById('bottom-task-btn')?.classList.remove('hidden');
            const bottomHomeLabel = document.getElementById('bottom-home-label');
            if (bottomHomeLabel) bottomHomeLabel.textContent = 'Wallet';
            const bottomGrid = document.getElementById('bottom-nav-grid');
            if (bottomGrid) {
                bottomGrid.style.setProperty('--bottom-nav-count', isAdmin ? '5' : '4');
                bottomGrid.className = `mx-auto grid w-full max-w-xl ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} items-center px-2 pt-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400`;
            }
        };

        let activeKeyboardInput = null;
        const isKeyboardLiftTarget = (element) =>
            element?.matches?.('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea, select')
            && !element.closest?.('#support-chat-shell, #revy-chat-shell');

        const keepFocusedInputVisible = () => {
            const target = isKeyboardLiftTarget(activeKeyboardInput) ? activeKeyboardInput : null;
            if (!target) return;
            const keyboardHeight = window.visualViewport
                ? Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop)
                : 0;
            const pageContainer = document.getElementById('page-container');
            if (pageContainer && !pageContainer.classList.contains('hidden')) {
                pageContainer.style.scrollPaddingBottom = keyboardHeight > 40 ? `${keyboardHeight + 96}px` : '7rem';
            }
            const modalScroller = target.closest('#app-modal [class*="overflow-y-auto"]');
            if (modalScroller) {
                modalScroller.style.scrollPaddingBottom = keyboardHeight > 40 ? `${keyboardHeight + 80}px` : '5rem';
            }
            setTimeout(() => {
                target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
            }, 80);
        };

        const installGlobalKeyboardLift = () => {
            document.addEventListener('focusin', (event) => {
                if (!isKeyboardLiftTarget(event.target)) return;
                activeKeyboardInput = event.target;
                keepFocusedInputVisible();
                setTimeout(keepFocusedInputVisible, 250);
            });
            document.addEventListener('input', (event) => {
                if (event.target === activeKeyboardInput) keepFocusedInputVisible();
            });
            document.addEventListener('focusout', (event) => {
                if (event.target !== activeKeyboardInput) return;
                setTimeout(() => {
                    if (document.activeElement === activeKeyboardInput) return;
                    activeKeyboardInput = null;
                    const pageContainer = document.getElementById('page-container');
                    if (pageContainer) pageContainer.style.scrollPaddingBottom = '';
                    document.querySelectorAll('#app-modal [class*="overflow-y-auto"]').forEach(el => {
                        el.style.scrollPaddingBottom = '';
                    });
                }, 180);
            });
            window.visualViewport?.addEventListener('resize', keepFocusedInputVisible);
            window.visualViewport?.addEventListener('scroll', keepFocusedInputVisible);
        };
        installGlobalKeyboardLift();

        const installChatViewportLock = ({ shellId, composerId, inputId, messagesId }) => {
            const shell = document.getElementById(shellId);
            const composer = document.getElementById(composerId);
            const input = document.getElementById(inputId);
            const messages = document.getElementById(messagesId);
            const pageContainer = document.getElementById('page-container');
            if (!shell || !composer || !input || !messages) return null;
            try {
                if ('virtualKeyboard' in navigator) {
                    navigator.virtualKeyboard.overlaysContent = true;
                }
            } catch (error) {
                console.warn('Virtual keyboard overlay setup skipped:', error);
            }

            const resetTypingPosition = () => {
                shell.style.position = '';
                shell.style.left = '';
                shell.style.top = '';
                shell.style.width = '';
                shell.style.height = '';
                shell.style.maxHeight = '';
                shell.style.zIndex = '';
                shell.style.transform = '';
                shell.classList.remove('chat-keyboard-active');
                composer.style.position = '';
                composer.style.left = '';
                composer.style.width = '';
                composer.style.top = '';
                composer.style.bottom = '';
                composer.style.paddingBottom = '';
                composer.style.zIndex = '';
                composer.style.boxShadow = '';
                composer.style.transform = '';
                composer.classList.remove('chat-composer-floating');
                messages.style.paddingBottom = '';
                if (pageContainer) pageContainer.style.overflowY = 'hidden';
            };

            let focusStartedAt = 0;
            let focusBaseHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0, window.visualViewport?.height || 0);
            let lastKnownKeyboardHeight = 0;
            let lastKnownKeyboardTop = 0;
            let scheduledFrame = 0;
            let keyboardClosedForFocus = false;

            const getLayoutHeight = () => Math.max(
                window.innerHeight || 0,
                document.documentElement.clientHeight || 0,
                window.visualViewport?.height || 0
            );

            const getKeyboardMetrics = () => {
                const viewport = window.visualViewport;
                const currentLayoutHeight = getLayoutHeight();
                focusBaseHeight = Math.max(focusBaseHeight, currentLayoutHeight);
                const visualBottom = viewport ? viewport.height + viewport.offsetTop : currentLayoutHeight;
                const vkRect = navigator.virtualKeyboard?.boundingRect;
                const virtualKeyboardHeight = Number(vkRect?.height || 0);
                const virtualKeyboardTop = Number(vkRect?.y || 0);
                const viewportKeyboardHeight = viewport ? Math.max(0, focusBaseHeight - visualBottom) : 0;
                const resizedKeyboardHeight = Math.max(0, focusBaseHeight - currentLayoutHeight);
                const keyboardHeight = Math.max(virtualKeyboardHeight, viewportKeyboardHeight, resizedKeyboardHeight);
                const hasViewportKeyboard = visualBottom < focusBaseHeight - 48 || currentLayoutHeight < focusBaseHeight - 48;
                const keyboardTop = virtualKeyboardHeight >= 60 && virtualKeyboardTop > 0
                    ? virtualKeyboardTop
                    : Math.max(0, focusBaseHeight - keyboardHeight);

                if (keyboardHeight >= 60) {
                    keyboardClosedForFocus = false;
                    lastKnownKeyboardHeight = keyboardHeight;
                    lastKnownKeyboardTop = keyboardTop;
                    return { height: keyboardHeight, top: keyboardTop, layoutHeight: focusBaseHeight };
                }

                if (lastKnownKeyboardHeight && hasViewportKeyboard) {
                    return {
                        height: lastKnownKeyboardHeight,
                        top: lastKnownKeyboardTop || Math.max(0, focusBaseHeight - lastKnownKeyboardHeight),
                        layoutHeight: focusBaseHeight
                    };
                }

                if (lastKnownKeyboardHeight && !hasViewportKeyboard) {
                    lastKnownKeyboardHeight = 0;
                    lastKnownKeyboardTop = 0;
                    keyboardClosedForFocus = true;
                    return { height: 0, top: focusBaseHeight, layoutHeight: focusBaseHeight };
                }

                const isTouchPhone = window.matchMedia?.('(pointer: coarse) and (max-width: 768px)')?.matches;
                if (isTouchPhone && document.activeElement === input && focusStartedAt && !keyboardClosedForFocus) {
                    const fallbackHeight = lastKnownKeyboardHeight || Math.round(focusBaseHeight * 0.43);
                    const fallbackTop = Math.max(0, focusBaseHeight - fallbackHeight);
                    return { height: fallbackHeight, top: fallbackTop, layoutHeight: focusBaseHeight };
                }

                return { height: 0, top: focusBaseHeight, layoutHeight: focusBaseHeight };
            };

            const keepTypingVisible = () => {
                if (document.activeElement !== input) {
                    resetTypingPosition();
                    return;
                }

                const keyboard = getKeyboardMetrics();
                if (keyboard.height < 60) {
                    resetTypingPosition();
                    return;
                }

                const layoutHeight = Math.max(keyboard.layoutHeight, getLayoutHeight());
                const width = Math.min(window.innerWidth || 0, 576);
                const left = Math.max(0, ((window.innerWidth || width) - width) / 2);
                const lockedHeight = Math.max(240, layoutHeight - 1);
                shell.style.position = 'fixed';
                shell.style.left = `${left}px`;
                shell.style.top = '0px';
                shell.style.width = `${width}px`;
                shell.style.height = `${lockedHeight}px`;
                shell.style.maxHeight = `${lockedHeight}px`;
                shell.style.zIndex = '80';
                shell.classList.add('chat-keyboard-active');

                const composerHeight = composer.offsetHeight || 64;
                const composerTop = Math.max(0, Math.round(keyboard.top - composerHeight));
                composer.style.position = 'fixed';
                composer.style.left = `${left}px`;
                composer.style.width = `${width}px`;
                composer.style.top = `${composerTop}px`;
                composer.style.bottom = '';
                composer.style.paddingBottom = '0.75rem';
                composer.style.zIndex = '120';
                composer.style.boxShadow = '0 -10px 28px rgba(15, 23, 42, 0.14)';
                composer.style.transform = 'translateZ(0)';
                composer.classList.add('chat-composer-floating');
                messages.style.paddingBottom = `${Math.max(composerHeight + 16, layoutHeight - composerTop + 16)}px`;
                if (pageContainer) pageContainer.style.overflowY = 'hidden';

                requestAnimationFrame(() => {
                    messages.scrollTop = messages.scrollHeight;
                });
            };

            const requestKeepTypingVisible = () => {
                if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
                scheduledFrame = requestAnimationFrame(() => {
                    scheduledFrame = 0;
                    keepTypingVisible();
                });
            };

            const scheduleKeepTypingVisible = () => {
                if (!focusStartedAt) focusStartedAt = Date.now();
                requestKeepTypingVisible();
                setTimeout(requestKeepTypingVisible, 80);
                setTimeout(requestKeepTypingVisible, 180);
                setTimeout(requestKeepTypingVisible, 360);
                setTimeout(requestKeepTypingVisible, 700);
                setTimeout(requestKeepTypingVisible, 1200);
                setTimeout(requestKeepTypingVisible, 1800);
            };
            const refreshTypingVisible = () => {
                scheduleKeepTypingVisible();
            };
            const handleFocus = () => {
                focusStartedAt = Date.now();
                focusBaseHeight = Math.max(focusBaseHeight, getLayoutHeight());
                lastKnownKeyboardHeight = 0;
                lastKnownKeyboardTop = 0;
                keyboardClosedForFocus = false;
                scheduleKeepTypingVisible();
            };
            const handleBlur = () => {
                focusStartedAt = 0;
                lastKnownKeyboardHeight = 0;
                lastKnownKeyboardTop = 0;
                keyboardClosedForFocus = false;
                setTimeout(resetTypingPosition, 24);
            };
            const handlePointerDown = (event) => {
                if (event.target === input) {
                    keyboardClosedForFocus = false;
                    scheduleKeepTypingVisible();
                    return;
                }
                if (composer.contains(event.target)) return;
                input.blur();
                resetTypingPosition();
            };
            const handleViewportChange = () => {
                scheduleKeepTypingVisible();
            };

            input.addEventListener('focus', handleFocus);
            input.addEventListener('input', refreshTypingVisible);
            input.addEventListener('blur', handleBlur);
            document.addEventListener('pointerdown', handlePointerDown, true);
            window.visualViewport?.addEventListener('resize', handleViewportChange);
            window.visualViewport?.addEventListener('scroll', handleViewportChange);
            navigator.virtualKeyboard?.addEventListener?.('geometrychange', handleViewportChange);
            window.addEventListener('orientationchange', handleViewportChange);

            return () => {
                input.removeEventListener('focus', handleFocus);
                input.removeEventListener('input', refreshTypingVisible);
                input.removeEventListener('blur', handleBlur);
                document.removeEventListener('pointerdown', handlePointerDown, true);
                window.visualViewport?.removeEventListener('resize', handleViewportChange);
                window.visualViewport?.removeEventListener('scroll', handleViewportChange);
                navigator.virtualKeyboard?.removeEventListener?.('geometrychange', handleViewportChange);
                window.removeEventListener('orientationchange', handleViewportChange);
                resetTypingPosition();
            };
        };

        const showPage = (content, options = {}) => {
            document.getElementById('dashboard-content').classList.add('hidden');
            const pageContainer = document.getElementById('page-container');
            const returnSection = options.returnTo || currentMainSection;
            pageContainer.innerHTML = content;
            pageContainer.classList.remove('hidden');
            pageContainer.style.paddingBottom = options.fullHeight ? '0' : (options.keepBottomNav ? '6.5rem' : '1.5rem');
            pageContainer.style.overflowY = options.fullHeight ? 'hidden' : 'auto';
            pageContainer.style.scrollPaddingBottom = '7rem';
            setMainChrome(!!options.keepBottomNav);
            document.getElementById('app-footer')?.classList.add('app-footer-hidden');
            const backButton = pageContainer.querySelector('.page-back-btn');
            if (backButton) {
                backButton.onclick = options.onBack || (() => {
                    if (returnSection === 'settings') {
                        showSettingsPage();
                    } else if (returnSection === 'transactions') {
                        showAllTransactionsPage();
                    } else if (returnSection === 'help') {
                        showHelpSupportPage();
                    } else if (returnSection === 'admin') {
                        showAdminMainPage();
                    } else {
                        hidePage();
                    }
                });
            }
        };

        const hidePage = () => {
            if (activeChatUnsubscribe) {
                activeChatUnsubscribe();
                activeChatUnsubscribe = null;
            }
            document.getElementById('dashboard-content').classList.remove('hidden');
            document.getElementById('page-container').classList.add('hidden');
            document.getElementById('page-container').innerHTML = '';
            document.getElementById('page-container').style.overflowY = 'auto';
            document.getElementById('page-container').style.scrollPaddingBottom = '';
            updateDollarBalanceDisplay(currentUserData?.balance || 0);
            setMainChrome(true);
            document.getElementById('app-footer')?.classList.add('app-footer-hidden');
            const selectedTab = document.querySelector('.tab-button[aria-selected="true"]');
            if (selectedTab) {
                switchTab(selectedTab.dataset.tab);
                setBottomNavActive(selectedTab.dataset.tab === 'admin-panel' ? 'bottom-admin-btn' : 'bottom-home-btn');
            } else {
                const fallbackTab = currentUser.uid === ADMIN_UID && currentMainSection === 'admin'
                    ? 'admin-panel'
                    : 'user-panel';
                switchTab(fallbackTab);
                setBottomNavActive(fallbackTab === 'admin-panel' ? 'bottom-admin-btn' : 'bottom-home-btn');
            }
        };

        // --- SLIDE MENU ---
        const openSlideMenu = () => {
            const menu = document.getElementById('slide-menu');
            const isAdmin = currentUser && currentUser.uid === ADMIN_UID;

            let adminItems = '';
            if (isAdmin) {
                adminItems = `
                    <hr class="border-gray-200 dark:border-gray-700 my-2">
                    <p class="text-xs font-semibold text-gray-400 uppercase px-4 pt-2">Admin</p>
                    <button id="slide-menu-admin-withdrawals" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>
                        Pending Requests
                    </button>
                    <button id="slide-menu-admin-users" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        User Management
                    </button>
                    <button id="slide-menu-admin-gift-codes" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
                        Gift Codes
                    </button>
                    <button id="slide-menu-admin-withdrawal-history" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        Withdrawal History
                    </button>
                    `;
            }

            menu.innerHTML = `
                <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 class="text-lg font-semibold">Menu</h3>
                    <button id="slide-menu-close-btn" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="p-2 space-y-1">
                    <button id="slide-menu-profile-btn" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        My Profile
                    </button>
                    <button id="slide-menu-settings-btn" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Settings
                    </button>
                    
                    ${adminItems}

                    <hr class="border-gray-200 dark:border-gray-700 my-2">
                    
                    <button id="slide-menu-logout-btn" class="flex items-center w-full text-left p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        Logout
                    </button>
                </div>
            `;

            document.getElementById('menu-overlay').classList.remove('hidden');
            menu.classList.remove('translate-x-full');

            // Add listeners
            document.getElementById('slide-menu-close-btn').onclick = closeSlideMenu;
            document.getElementById('slide-menu-profile-btn').onclick = () => { showProfilePage(); closeSlideMenu(); };
            document.getElementById('slide-menu-settings-btn').onclick = () => { showSettingsPage(); closeSlideMenu(); };
            if (isAdmin) {
                document.getElementById('slide-menu-admin-withdrawals').onclick = () => { showAdminWithdrawalsPage(); closeSlideMenu(); };
                document.getElementById('slide-menu-admin-users').onclick = () => { showAdminUsersPage(); closeSlideMenu(); };
                document.getElementById('slide-menu-admin-gift-codes').onclick = () => { showAdminGiftCodesPage(); closeSlideMenu(); };
                document.getElementById('slide-menu-admin-withdrawal-history').onclick = () => { showWithdrawalHistoryPage(); closeSlideMenu(); };
            }
            document.getElementById('slide-menu-logout-btn').onclick = () => {
                signOut(auth);
            };
        };

        const closeSlideMenu = () => {
            document.getElementById('slide-menu').classList.add('translate-x-full');
            document.getElementById('menu-overlay').classList.add('hidden');
        };
        window.closeSlideMenu = closeSlideMenu;

        // --- AUTHENTICATION ---
        const handleAuth = async (e) => {
            e.preventDefault();

            // Get button elements
            const authButton = document.getElementById('auth-button');
            const buttonText = authButton.querySelector('.button-text');
            const loader = authButton.querySelector('.loader');

            // --- Show loading spinner ---
            authButton.disabled = true;
            buttonText.classList.add('hidden');
            loader.classList.remove('hidden');

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const name = document.getElementById('name').value;
            const mobile = normalizePhoneDigits(document.getElementById('mobile').value);
            document.getElementById('auth-error').textContent = '';

            try {
                await setPersistence(auth, browserLocalPersistence);
                if (e.target.dataset.authMode === 'login') {
                    sessionStorage.removeItem('rw_signup_in_progress');
                    const cred = await signInWithEmailAndPassword(auth, email, password);

                    // Check if user is banned
                    const userDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/users`, cred.user.uid));
                    if (userDoc.exists() && (isUserApprovalPending(userDoc.data()) || isUserApprovalRejected(userDoc.data()))) {
                        currentUser = cred.user;
                        currentUserData = { uid: cred.user.uid, id: cred.user.uid, email: cred.user.email, ...userDoc.data() };
                        localStorage.setItem('lastLoggedInUser', cred.user.uid);
                        writeJsonCache(getUserCacheKey(cred.user.uid), sanitizeUserForCache(currentUserData, cred.user.uid));
                        showVerificationPendingPage(currentUserData);
                        return;
                    }
                    if (userDoc.exists() && userDoc.data().isFlagged) {
                        const data = userDoc.data();
                        if (data.banExpiry) {
                            const expiry = getBanExpiryDate(data.banExpiry);
                            // Check if ban has expired
                            if (expiry && new Date() < expiry) {
                                currentUser = cred.user;
                                currentUserData = { uid: cred.user.uid, id: cred.user.uid, email: cred.user.email, ...data };
                                showBlockedAccountPage(currentUserData);
                                return;
                            } else {
                                // Ban expired, auto-unflag
                                await updateDoc(userDoc.ref, {
                                    isFlagged: false,
                                    isDisabled: false,
                                    banReason: deleteField(),
                                    banExpiry: deleteField(),
                                    disabledAt: deleteField(),
                                    disabledBy: deleteField()
                                });
                            }
                        } else {
                            currentUser = cred.user;
                            currentUserData = { uid: cred.user.uid, id: cred.user.uid, email: cred.user.email, ...data };
                            showBlockedAccountPage(currentUserData);
                            return;
                        }
                    }
                } else {
                    if (!name || !mobile) {
                        // This is an error, so reset the button
                        throw new Error('Name and Mobile Number are required.');
                    }
                    if (!/^\d{10}$/.test(mobile)) {
                        throw new Error('Mobile number must be exactly 10 digits.');
                    }
                    const existingMobileUser = await findExistingUserByMobile(mobile);
                    if (existingMobileUser) {
                        throw new Error('This mobile number is already registered. Please use another number.');
                    }
                    localSignupApprovalInProgress = true;
                    const cred = await createUserWithEmailAndPassword(auth, email, password);
                    const pendingUserData = {
                        uid: cred.user.uid,
                        email: cred.user.email,
                        name,
                        mobile,
                        phoneNumber: mobile,
                        paymentMethod: '',
                        paymentDetails: {},
                        balance: 0,
                        approvalStatus: 'pending',
                        signupApprovalStatus: 'pending',
                        accountStatus: 'pending_approval',
                        isApproved: false,
                        signupSource: 'web',
                        webAppBuild: WEB_APP_BUILD,
                        webAppUpdatedOn: WEB_APP_UPDATE_DATE,
                        webAppLastSeenAt: serverTimestamp(),
                        signupRequestedAt: serverTimestamp(),
                        createdAt: serverTimestamp()
                    };
                    await setDoc(doc(db, `artifacts/${appId}/public/data/users`, cred.user.uid), pendingUserData, { merge: true });
                    currentUser = cred.user;
                    currentUserData = {
                        ...pendingUserData,
                        signupRequestedAt: Date.now(),
                        createdAt: Date.now()
                    };
                    localStorage.setItem('lastLoggedInUser', cred.user.uid);
                    writeJsonCache(getUserCacheKey(cred.user.uid), sanitizeUserForCache(currentUserData, cred.user.uid));
                    showVerificationPendingPage(currentUserData);
                    setTimeout(() => initializeUserListeners(cred.user.uid), 100);
                    localSignupApprovalInProgress = false;
                    return;
                }
            } catch (error) {
                localSignupApprovalInProgress = false;
                document.getElementById('auth-error').textContent = error.message;
                console.error("Auth failed:", error);

                // --- THIS IS IMPORTANT: Hide spinner on error ---
                authButton.disabled = false;
                buttonText.classList.remove('hidden');
                loader.classList.add('hidden');
            }
        };

        const toggleAuthMode = () => {
            const form = document.getElementById('auth-form');
            const isLogin = form.dataset.authMode === 'signup';
            form.dataset.authMode = isLogin ? 'login' : 'signup';
            form.classList.toggle('signup-mode', !isLogin);
            document.getElementById('auth-error').textContent = '';
            form.reset();
            document.getElementById('auth-title').textContent = isLogin ? 'Login to your Wallet' : 'Create a New Wallet';
            document.getElementById('forgot-password-row')?.classList.toggle('hidden', !isLogin);

            // Get button elements
            const authButton = document.getElementById('auth-button');
            const buttonText = authButton.querySelector('.button-text');
            const loader = authButton.querySelector('.loader');

            // Set the new button text
            buttonText.textContent = isLogin ? 'Login' : 'Sign Up';

            // Reset the button to its normal state
            authButton.disabled = false;
            buttonText.classList.remove('hidden');
            loader.classList.add('hidden');

            document.getElementById('auth-prompt').textContent = isLogin ? "Don't have an account? " : 'Already have an account? ';
            document.getElementById('auth-toggle').textContent = isLogin ? 'Sign Up' : 'Login';
        };

        // Check if user has pending withdrawal
        const checkPendingWithdrawal = async (userId) => {
            try {
                const pendingQuery = query(
                    collection(db, `artifacts/${appId}/public/data/fund_requests`),
                    where("userId", "==", userId),
                    where("status", "==", "pending")
                );
                const snapshot = await getDocs(pendingQuery);
                return !snapshot.empty;
            } catch (e) {
                console.error("Error checking pending withdrawal:", e);
                return false;
            }
        };

        const getBanExpiryDate = (banExpiry) => {
            if (!banExpiry) return null;
            if (banExpiry.toDate) return banExpiry.toDate();
            const date = new Date(banExpiry);
            return Number.isNaN(date.getTime()) ? null : date;
        };

        const getBanMessage = (data = {}) => {
            const reason = data.banReason || 'No reason specified.';
            const expiry = getBanExpiryDate(data.banExpiry);
            let message = `Your account has been suspended.\nReason: ${reason}`;
            message += expiry ? `\nSuspension ends on: ${expiry.toLocaleString('en-IN')}` : '\nThis is a permanent suspension.';
            return message;
        };

        const getBanDetails = (data = {}) => {
            const expiry = getBanExpiryDate(data.banExpiry);
            return {
                reason: data.banReason || 'No reason specified.',
                time: expiry ? expiry.toLocaleString('en-IN') : 'Permanent suspension'
            };
        };

        const showBlockedAccountPage = (data = currentUserData || {}) => {
            const details = getBanDetails(data);
            hideLoading();
            setMainChrome(false);
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('main-content')?.classList.remove('hidden');
            document.getElementById('dashboard-content')?.classList.add('hidden');
            document.getElementById('menu-overlay')?.classList.add('hidden');
            document.getElementById('slide-menu')?.classList.add('translate-x-full');
            const pageContainer = document.getElementById('page-container');
            pageContainer.innerHTML = `
                <div class="min-h-[100dvh] flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
                    <div class="w-full max-w-md rounded-3xl bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900/50 shadow-xl overflow-hidden">
                        <div class="bg-gradient-to-br from-red-600 to-rose-700 p-6 text-white">
                            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path>
                                </svg>
                            </div>
                            <h2 class="text-center text-2xl font-black">Account Blocked</h2>
                            <p class="mt-2 text-center text-sm text-white/80">Your wallet access is currently limited by admin.</p>
                        </div>
                        <div class="space-y-4 p-5">
                            <div class="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4">
                                <p class="text-xs font-black uppercase text-red-500 dark:text-red-300">Reason</p>
                                <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(details.reason)}</p>
                            </div>
                            <div class="rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 p-4">
                                <p class="text-xs font-black uppercase text-gray-400">Ban Time</p>
                                <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(details.time)}</p>
                            </div>
                            <button id="blocked-contact-admin-btn" class="w-full rounded-2xl bg-blue-600 px-4 py-3 font-black text-white shadow-sm hover:bg-blue-700 transition">Contact Admin</button>
                        </div>
                    </div>
                </div>`;
            pageContainer.classList.remove('hidden');
            pageContainer.style.paddingBottom = '0';
            pageContainer.style.overflowY = 'hidden';
            document.getElementById('blocked-contact-admin-btn').onclick = () => {
                openSupportChatPage(currentUser.uid, 'user', {
                    initialMessage: `My account is blocked. Reason: ${details.reason}. Ban time: ${details.time}. Please help.`,
                    returnToBlocked: true,
                    blockedData: data
                });
            };
            if (currentUser?.uid) {
                preloadSupportChatForUser(currentUser.uid).catch(error => console.warn('Blocked support chat preload skipped:', error));
            }
        };

        const isUserApprovalPending = (data = {}) =>
            data.approvalStatus === 'pending' || data.signupApprovalStatus === 'pending' || data.accountStatus === 'pending_approval';

        const isUserApprovalRejected = (data = {}) =>
            data.approvalStatus === 'rejected' || data.signupApprovalStatus === 'rejected' || data.accountStatus === 'rejected';

        const getApprovalHoldMessage = (data = {}) => {
            if (isUserApprovalRejected(data)) {
                return data.approvalRejectionReason || 'Your account creation request was cancelled by admin.';
            }
            return 'Your account creation is pending. Please wait, admin will approve it soon.';
        };

        const getApprovalDetails = (data = {}) => ({
            title: isUserApprovalRejected(data) ? 'Verification Cancelled' : 'Verification Pending',
            message: isUserApprovalRejected(data)
                ? (data.approvalRejectionReason || 'Your account verification request was cancelled by admin.')
                : 'Your account has been sent to admin and it will be verified soon. After approval, your wallet will open automatically.',
            requestedAt: timestampToMillis(data.signupRequestedAt || data.createdAt)
        });

        const showVerificationPendingPage = (data = currentUserData || {}) => {
            const details = getApprovalDetails(data);
            hideLoading();
            setMainChrome(false);
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('main-content')?.classList.remove('hidden');
            document.getElementById('dashboard-content')?.classList.add('hidden');
            document.getElementById('menu-overlay')?.classList.add('hidden');
            document.getElementById('slide-menu')?.classList.add('translate-x-full');
            const pageContainer = document.getElementById('page-container');
            pageContainer.innerHTML = `
                <div class="min-h-[100dvh] flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
                    <div class="w-full max-w-md rounded-3xl bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900/50 shadow-xl overflow-hidden">
                        <div class="bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white">
                            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 12l2 2 4-4"></path><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
                                </svg>
                            </div>
                            <h2 class="text-center text-2xl font-black">${escapeHtml(details.title)}</h2>
                            <p class="mt-2 text-center text-sm text-white/85">Admin review is required before wallet access.</p>
                        </div>
                        <div class="space-y-4 p-5">
                            <div class="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4">
                                <p class="text-xs font-black uppercase text-amber-600 dark:text-amber-200">Status</p>
                                <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(details.message)}</p>
                            </div>
                            <div class="rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 p-4">
                                <p class="text-xs font-black uppercase text-gray-400">Account</p>
                                <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(data.name || data.email || 'New user')}</p>
                                ${details.requestedAt ? `<p class="mt-1 text-xs text-gray-500 dark:text-gray-300">Sent: ${new Date(details.requestedAt).toLocaleString('en-IN')}</p>` : ''}
                            </div>
                        </div>
                    </div>
                </div>`;
            pageContainer.classList.remove('hidden');
            pageContainer.style.paddingBottom = '0';
            pageContainer.style.overflowY = 'hidden';
        };

        const showApprovedDashboardAfterHold = (isAdmin = false) => {
            const dashboard = document.getElementById('dashboard-content');
            const pageContainer = document.getElementById('page-container');
            if (!dashboard?.classList.contains('hidden') || !pageContainer?.innerHTML.includes('Verification')) return;
            applyAdminBottomChrome(isAdmin);
            currentMainSection = 'home';
            switchTab('user-panel');
            setBottomNavActive('bottom-home-btn');
            setMainChrome(true);
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('main-content')?.classList.remove('hidden');
            dashboard.classList.remove('hidden');
            pageContainer.classList.add('hidden');
            pageContainer.innerHTML = '';
            pageContainer.style.overflowY = 'auto';
            document.getElementById('app-footer')?.classList.add('app-footer-hidden');
        };

        const enforceCurrentUserApproval = async (userId, userRef, data = {}) => {
            if (userId === ADMIN_UID) return false;
            if (!isUserApprovalPending(data) && !isUserApprovalRejected(data)) return false;
            currentUserData = { ...(currentUserData || {}), ...data, uid: userId, id: userId };
            localStorage.setItem('lastLoggedInUser', userId);
            writeJsonCache(getUserCacheKey(userId), sanitizeUserForCache(currentUserData, userId));
            showVerificationPendingPage(currentUserData);
            return true;
        };

        const enforceCurrentUserBan = async (userId, userRef, data = {}) => {
            if (userId === ADMIN_UID || !data.isFlagged) return false;
            const expiry = getBanExpiryDate(data.banExpiry);
            if (expiry && new Date() >= expiry) {
                await updateDoc(userRef, {
                    isFlagged: false,
                    isDisabled: false,
                    banReason: deleteField(),
                    banExpiry: deleteField(),
                    disabledAt: deleteField(),
                    disabledBy: deleteField()
                });
                return false;
            }
            currentUserData = { ...(currentUserData || {}), ...data, uid: userId, id: userId };
            localStorage.setItem('lastLoggedInUser', userId);
            writeJsonCache(getUserCacheKey(userId), sanitizeUserForCache(currentUserData, userId));
            showBlockedAccountPage(currentUserData);
            return true;
        };

        const getUserWebSeenMillis = (user = {}) => timestampToMillis(user.webAppLastSeenAt || user.web_app_last_seen_at || user.lastWebAppSeenAt || user.last_web_app_seen_at);
        const isUserOnUpdatedWebApp = (user = {}) => {
            if (user.webAppUpdatedOn === WEB_APP_UPDATE_DATE || user.web_app_updated_on === WEB_APP_UPDATE_DATE) return true;
            const build = user.webAppBuild || user.web_app_build || user.lastWebAppBuild || '';
            return !!build || !!getUserWebSeenMillis(user);
        };

        const markUpdatedWebAppSeen = async (userId, userRef, data = {}) => {
            if (!userId || userId === ADMIN_UID) return;
            if (isUserOnUpdatedWebApp(data)) return;
            const cacheKey = `rw_web_updated_${userId}_${WEB_APP_UPDATE_DATE}`;
            if (localStorage.getItem(cacheKey)) return;
            localStorage.setItem(cacheKey, '1');
            await updateDoc(userRef, {
                webAppBuild: WEB_APP_BUILD,
                webAppUpdatedOn: WEB_APP_UPDATE_DATE,
                webAppLastSeenAt: serverTimestamp(),
                webAppLastSeenUserAgent: navigator.userAgent.slice(0, 180)
            });
        };

        // FIXED: Improved auth state change handler without freezing
        onAuthStateChanged(auth, async (user) => {
            console.log("Auth state changed, user:", user ? user.uid : 'null');
            const pageContainerAtAuth = document.getElementById('page-container');
            const shouldPreserveOpenPage = !!(
                user &&
                pageContainerAtAuth &&
                !pageContainerAtAuth.classList.contains('hidden') &&
                pageContainerAtAuth.innerHTML.trim()
            );

            // Clean up previous listeners
            unsubscribers.forEach(unsub => unsub());
            unsubscribers.length = 0;

            // Reset caches
            allUsersCache = [];
            allFundRequestsCache = [];
            allRechargeRequestsCache = [];
            fundRequestsImportedFromFirebase = false;
            allLoanRequestsCache = [];
            allLoansCache = [];
            allInvestmentsCache = [];
            allTasksCache = [];
            allAdsCache = [];
            allSupportChatsCache = [];
            currentUserData = null;
            unifiedHistoryCache = [];
            transactionHistoryPrefetch = { userId: '', promise: null, loadedAt: 0 };
            if (activeChatUnsubscribe && !shouldPreserveOpenPage) {
                activeChatUnsubscribe();
                activeChatUnsubscribe = null;
            }
            if (!shouldPreserveOpenPage) {
                activeSupportRoomId = '';
                activeSupportMessages = [];
            }
            supportChatUnreadCount = 0;
            adminChatUnreadCount = 0;
            supportChatPreloadUserId = '';
            supportChatBackgroundHandlers = null;
            adminChatBackgroundHandlers = null;
            adminChatSubscribedRooms = new Set();
            supportSendingMessage = false;
            supportLastSendSignature = '';
            supportLastSendAt = 0;
            notificationsCache = [];
            notificationUnreadCount = 0;
            adminNotificationsCache = [];
            adminNotificationSelectedUsers = [];
            adminUsersRealtimeStarted = false;
            adminFundRequestsRealtimeStarted = false;
            adminSecondaryRealtimeStarted = false;
            publicHomeRealtimeStarted = false;
            if (homeAdsAutoTimer) {
                clearInterval(homeAdsAutoTimer);
                homeAdsAutoTimer = null;
            }
            if (notificationRefreshTimer) {
                clearInterval(notificationRefreshTimer);
                notificationRefreshTimer = null;
            }
            if (supportSocket) {
                supportSocket.off('chat_history');
                supportSocket.off('new_message');
                supportSocket.off('chat_read');
            }
            updateSupportChatUnreadBadges();
            updateAdminChatUnreadBadges();
            updateNotificationUnreadBadge();

            if (user) {
                currentUser = user;
                localStorage.setItem('lastLoggedInUser', user.uid);
                if (user.uid !== ADMIN_UID && localSignupApprovalInProgress) return;

                const isAdmin = user.uid === ADMIN_UID;
                await loadAppConfigForStartup();
                const maintenanceActiveForUser = !isAdmin && isMaintenanceConfigActive(appConfigCache);

                // Hide loading overlay only after maintenance status is known.
                hideLoading();

                applyAdminBottomChrome(isAdmin);
                applyMaintenanceMode();
                showWhatsNewPopupIfNeeded();
                hydrateUserFromCache(user.uid);
                const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, user.uid);
                const userDocSnap = await getDoc(userDocRef).catch(error => {
                    console.warn('Initial user approval check skipped:', error);
                    return null;
                });
                if (userDocSnap?.exists()) {
                    const approvalBlocked = await enforceCurrentUserApproval(user.uid, userDocRef, userDocSnap.data()).catch(error => {
                        console.error('Approval enforcement failed:', error);
                        return false;
                    });
                    if (approvalBlocked) {
                        setTimeout(() => {
                            try {
                                initializeUserListeners(user.uid);
                            } catch (err) {
                                console.error("Error initializing approval listener:", err);
                            }
                        }, 100);
                        return;
                    }
                }
                notificationsCache = readNotificationsCache(user.uid);
                refreshNotificationUnreadCount(notificationsCache);
                preloadNotificationsForUser(user.uid).catch(e => console.warn('Initial notification preload skipped:', e));
                startNotificationAutoRefresh(user.uid);
                applyAdminBottomChrome(isAdmin);
                if (maintenanceActiveForUser) {
                    maintenanceGateActive = true;
                    currentMainSection = 'home';
                    setMainChrome(false);
                } else if (!shouldPreserveOpenPage) {
                    currentMainSection = 'home';
                    switchTab('user-panel');
                    setBottomNavActive('bottom-home-btn');
                    setMainChrome(true);
                }

                // Show main content after admin/user chrome is already ready.
                document.getElementById('auth-screen').classList.add('hidden');
                document.getElementById('main-content').classList.remove('hidden');
                if (maintenanceActiveForUser) {
                    document.getElementById('dashboard-content').classList.add('hidden');
                    const pageContainer = document.getElementById('page-container');
                    pageContainer.classList.add('hidden');
                    pageContainer.innerHTML = '';
                    pageContainer.style.overflowY = 'auto';
                    applyMaintenanceMode();
                } else if (shouldPreserveOpenPage) {
                    document.getElementById('dashboard-content').classList.add('hidden');
                    document.getElementById('page-container').classList.remove('hidden');
                } else {
                    document.getElementById('dashboard-content').classList.remove('hidden');
                    document.getElementById('page-container').classList.add('hidden');
                    document.getElementById('page-container').innerHTML = '';
                    document.getElementById('page-container').style.overflowY = 'auto';
                }
                document.getElementById('app-footer')?.classList.add('app-footer-hidden');

                // Initialize user listeners (non-blocking)
                setTimeout(() => {
                    try {
                        initializeUserListeners(user.uid);
                        initializePublicHomeRealtime();
                    } catch (err) {
                        console.error("Error initializing user listeners:", err);
                    }
                }, 100);

                if (isAdmin) {
                    console.log("User is Admin, initializing admin listeners...");
                    // Initialize admin listeners immediately
                    try {
                        initializeAdminListeners();
                    } catch (err) {
                        console.error("Error initializing admin listeners:", err);
                    }
                }

            } else {
                currentUser = null;
                backendAuthToken = '';
                removeMaintenanceOverlay();
                closeWhatsNewPopup(false);
                if (supportSocket) {
                    supportSocket.disconnect();
                    supportSocket = null;
                }
                hideLoading();
                const hadCachedUser = !!localStorage.getItem('lastLoggedInUser');
                if (hadCachedUser) {
                    console.warn('Saved login was found but Firebase session is not active. Showing login again.');
                }
                localStorage.removeItem('lastLoggedInUser');

                // Show auth screen immediately
                document.getElementById('auth-screen').classList.remove('hidden');
                document.getElementById('main-content').classList.add('hidden');
                applyAdminBottomChrome(false);
                setMainChrome(false);
                document.getElementById('app-footer')?.classList.add('app-footer-hidden');
                const banMessage = sessionStorage.getItem('lastBanMessage');
                if (banMessage) {
                    const authError = document.getElementById('auth-error');
                    if (authError) authError.textContent = banMessage;
                    sessionStorage.removeItem('lastBanMessage');
                }
                const approvalMessage = sessionStorage.getItem('lastApprovalMessage');
                if (approvalMessage) {
                    const authError = document.getElementById('auth-error');
                    if (authError) authError.textContent = approvalMessage;
                    sessionStorage.removeItem('lastApprovalMessage');
                }

                closeSlideMenu();
            }
        });

        // --- LISTENERS SETUP ---
        const initializeUserListeners = (userId) => {
            console.log(`Initializing user listeners for ${userId}`);

            const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
            unsubscribers.push(onSnapshot(userDocRef, async (doc) => {
                if (doc.exists()) {
                    console.log("User data snapshot received");
                    const data = doc.data();
                    currentUserData = { id: userId, uid: userId, ...data };
                    applyMaintenanceMode();
                    showWhatsNewPopupIfNeeded();
                    const isBanned = await enforceCurrentUserBan(userId, userDocRef, data).catch(e => {
                        console.error('Ban enforcement failed:', e);
                        return false;
                    });
                    if (isBanned) return;
                    const approvalBlocked = await enforceCurrentUserApproval(userId, userDocRef, data).catch(e => {
                        console.error('Approval enforcement failed:', e);
                        return false;
                    });
                    if (approvalBlocked) return;
                    showApprovedDashboardAfterHold(userId === ADMIN_UID);
                    if (!data.isFlagged && data.isDisabled && !data.dueLoanBlocked) {
                        updateDoc(userDocRef, {
                            isDisabled: false,
                            disabledAt: deleteField(),
                            disabledBy: deleteField()
                        }).catch(e => console.warn('Stale disabled flag cleanup skipped:', e));
                    }
                    markUpdatedWebAppSeen(userId, userDocRef, data).catch(e => console.warn('Web app usage marker skipped:', e));
                    document.getElementById('user-balance').textContent = formatCompactBalance(data.balance);
                    updateDollarBalanceDisplay(data.balance);
                    currentUserData = { id: userId, uid: userId, ...data };
                    writeJsonCache(getUserCacheKey(userId), sanitizeUserForCache(data, userId));
                    getBackendAuthToken().catch(e => console.error('Backend session warmup failed:', e));
                    preloadSupportChatForUser(userId).catch(e => console.warn('Support chat preload skipped:', e));
                    preloadNotificationsForUser(userId).catch(e => console.warn('Notification preload skipped:', e));
                    const now = Date.now();
                    if (now - lastAutoProcessCheckAt > 60000) {
                        lastAutoProcessCheckAt = now;
                        processDuePartnerInvestmentsForUser(userId).catch(e => console.error('Auto partner interest check failed:', e));
                        processDueLoansForUser(userId).catch(e => console.error('Auto loan debit check failed:', e));
                    }
                    if (userId === ADMIN_UID) {
                        document.getElementById('admin-wallet-balance').textContent = formatCompactBalance(data.balance);
                    }
                } else {
                    console.warn(`User document not found for ${userId} (snapshot listener)`);
                }
            }, (error) => console.error("Error listening to user doc:", error)));

            let transactions = [];
            let pendingRequests = [];
            const renderUnifiedHistory = (limit) => {
                let combined = [
                    ...mergeTransactionsByKey(transactions),
                    ...pendingRequests.map(normalizePendingRequestForHistory)
                ];
                combined.sort((a, b) => timestampToMillis(b.timestamp) - timestampToMillis(a.timestamp));
                unifiedHistoryCache = combined;
                writeHistoryItemsToCache(userId, combined);

                const listElement = document.getElementById('transactions-list');
                if (document.getElementById('all-transactions-list')) {
                    const activeFilter = document.querySelector('#filter-bar .active-filter')?.dataset.filter || 'all';
                    renderFilteredTransactions(activeFilter, { reset: false });
                }
                const limitedList = limit ? combined.slice(0, limit) : combined;
                if (!listElement) return;

                listElement.innerHTML = limitedList.length === 0
                    ? `<p class="text-gray-500 dark:text-gray-400">No transactions yet.</p>`
                    : limitedList.map(item => renderTransactionItem(item)).join('');
                if (limit) {
                    try {
                        localStorage.setItem(getHistoryCacheKey(userId), listElement.innerHTML);
                    } catch (e) {
                        console.warn('History cache write failed:', e);
                    }
                }
            };

            const cachedHistoryHtml = localStorage.getItem(getHistoryCacheKey(userId));
            if (cachedHistoryHtml && document.getElementById('transactions-list')) {
                document.getElementById('transactions-list').innerHTML = cachedHistoryHtml;
            }
            const cachedHistoryItems = readHistoryItemsFromCache(userId);
            if (cachedHistoryItems.length) {
                unifiedHistoryCache = cachedHistoryItems;
                transactions = cachedHistoryItems.filter(item => !String(item.key || '').startsWith('req-') && item.status !== 'pending');
                pendingRequests = cachedHistoryItems.filter(item => String(item.key || '').startsWith('req-') || item.status === 'pending');
                renderUnifiedHistory(5);
            }
            prefetchTransactionHistory(userId).catch(error => console.warn('Transaction history background prefetch skipped:', error));

            const userTransactionsQuery = query(
                collection(db, `artifacts/${appId}/public/data/users/${userId}/transactions`),
                orderBy('timestamp', 'desc'),
                firestoreLimit(200)
            );
            unsubscribers.push(onSnapshot(userTransactionsQuery, (snapshot) => {
                transactions = mergeTransactionsByKey(transactions, snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                renderUnifiedHistory(5);
            }, (error) => console.warn('Realtime transaction listener skipped:', error)));

            const userPendingRequestsQuery = query(
                collection(db, `artifacts/${appId}/public/data/fund_requests`),
                where('userId', '==', userId),
                where('status', '==', 'pending')
            );
            unsubscribers.push(onSnapshot(userPendingRequestsQuery, (snapshot) => {
                pendingRequests = mergeFundRequestsById(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                renderUnifiedHistory(5);
            }, (error) => console.warn('Realtime pending request listener skipped:', error)));

            Promise.all([
                loadFirebaseTransactions(userId, 2000).catch(error => {
                    console.warn('Firebase transaction history preload skipped:', error);
                    return [];
                }),
                fetchCloudTransactionHistory(userId, 2000).catch(error => {
                    console.warn('Cloud transaction history preload skipped:', error);
                    return [];
                })
            ])
                .then(([firebaseTransactions, cloudTransactions]) => {
                    transactions = mergeTransactionsByKey(cachedHistoryItems.filter(item => !String(item.key || '').startsWith('req-')), firebaseTransactions, cloudTransactions);
                    renderUnifiedHistory(5);
                    if (firebaseTransactions.length) return importFirestoreTransactionsToCloud(userId, firebaseTransactions);
                })
                .catch((error) => {
                    console.error("Firebase transaction history load failed:", error);
                    if (cachedHistoryItems.length) {
                        renderUnifiedHistory(5);
                        return;
                    }
                    console.warn('Using realtime/cache after transaction preload failure.');
                });

            loadCloudFundRequests({ status: 'pending', userId })
                .then(async (requests) => {
                    if (!requests.length) {
                        const firebasePending = await loadFirebasePendingFundRequests(userId);
                        if (firebasePending.length) {
                            pendingRequests = firebasePending;
                            firebasePending.forEach(request => upsertCloudFundRequest(request));
                        } else {
                            pendingRequests = requests;
                        }
                    } else {
                        pendingRequests = requests;
                    }
                    renderUnifiedHistory(5);
                })
                .catch((error) => {
                    console.error("Cloud pending fund request load failed:", error);
                    if (cachedHistoryItems.length) {
                        renderUnifiedHistory(5);
                        return;
                    }
                    loadFirebasePendingFundRequests(userId)
                        .then((requests) => {
                            pendingRequests = requests;
                            renderUnifiedHistory(5);
                        })
                        .catch((firebaseError) => console.error("Error loading pending fund requests:", firebaseError));
                });
        };

        const refreshAdminDashboardCaches = async () => {
            const usersQuery = query(collection(db, `artifacts/${appId}/public/data/users`));
            const usersSnap = await getDocs(usersQuery);
            applyAdminUsersCache(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            await refreshAdminSecondaryCaches();
        };

        const applyAdminUsersCache = (users = []) => {
            if (!Array.isArray(users)) return;
            const normalizedUsers = users.map(user => ({
                ...user,
                mobile: getUserMobileValue(user),
                phoneNumber: user.phoneNumber || getUserMobileValue(user)
            }));
            allUsersCache = normalizedUsers;
            writeJsonCache(ADMIN_USERS_CACHE_KEY, normalizedUsers.map(user => ({
                ...user,
                createdAt: timestampToMillis(user.createdAt),
                webAppLastSeenAt: timestampToMillis(user.webAppLastSeenAt)
            })));
            let totalFunds = 0;
            let newMembersCount = 0;
            let minusBalanceCount = 0;
            let minusBalanceTotal = 0;
            const fifteenDaysAgo = new Date();
            fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

            const otherUsers = allUsersCache.filter(u => !isAdminUserRecord(u));
            otherUsers.forEach(u => {
                    const balance = getUserAvailableBalance(u);
                    totalFunds += balance;
                    if (balance < 0) {
                        minusBalanceCount++;
                        minusBalanceTotal += Math.abs(balance);
                    }

                    if (u.createdAt) {
                        const createdDate = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
                        if (createdDate >= fifteenDaysAgo) {
                            newMembersCount++;
                        }
                    }
            });

            const totalUsersEl = document.getElementById('analytics-total-users');
            const totalFundsEl = document.getElementById('analytics-total-funds');
            const newMembersEl = document.getElementById('analytics-new-members');
            if (totalUsersEl) totalUsersEl.textContent = otherUsers.length;
            if (totalFundsEl) totalFundsEl.textContent = formatCompactBalance(totalFunds);
            if (newMembersEl) newMembersEl.textContent = newMembersCount;
            const minusCountEl = document.getElementById('analytics-minus-balance-users');
            const minusTotalEl = document.getElementById('analytics-minus-balance-total');
            if (minusCountEl) minusCountEl.textContent = minusBalanceCount;
            if (minusTotalEl) minusTotalEl.textContent = `Total minus: ${formatCurrency(minusBalanceTotal)}`;
            const pendingSignupCount = otherUsers.filter(isUserApprovalPending).length;
            const signupBadge = document.getElementById('admin-signup-approval-badge');
            if (signupBadge) {
                signupBadge.textContent = pendingSignupCount > 99 ? '99+' : String(pendingSignupCount || '');
                signupBadge.classList.toggle('hidden', pendingSignupCount <= 0);
            }

            if (document.getElementById('admin-users-list-page')) {
                updateAdminUserListView();
            }
            if (document.getElementById('signup-approvals-list')) {
                showAdminSignupApprovalsPage();
            }
            if (document.getElementById('admin-chats-list')) {
                renderAdminChatsList();
            }
            if (document.getElementById('admin-notification-target-preview')) {
                updateAdminNotificationTargetPreview();
                renderAdminNotificationSelectedUsers();
                renderAdminNotificationSearchResults();
            }
        };

        const hydrateAdminUsersFromCache = () => {
            const cached = readJsonCache(ADMIN_USERS_CACHE_KEY);
            if (!Array.isArray(cached) || !cached.length) return;
            applyAdminUsersCache(cached.map(user => ({
                ...user,
                createdAt: reviveCachedTimestamp(user.createdAt),
                webAppLastSeenAt: reviveCachedTimestamp(user.webAppLastSeenAt)
            })));
        };

        const initializeAdminUsersRealtime = () => {
            if (currentUser?.uid !== ADMIN_UID || adminUsersRealtimeStarted) return;
            adminUsersRealtimeStarted = true;
            const usersQuery = query(collection(db, `artifacts/${appId}/public/data/users`));
            unsubscribers.push(onSnapshot(usersQuery, (snapshot) => {
                applyAdminUsersCache(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            }, (error) => {
                console.error('Admin realtime users failed:', error);
                hydrateAdminUsersFromCache();
            }));
        };

        const initializeAdminFundRequestsRealtime = () => {
            if (currentUser?.uid !== ADMIN_UID || adminFundRequestsRealtimeStarted) return;
            adminFundRequestsRealtimeStarted = true;
            const pendingRequestsQuery = query(
                collection(db, `artifacts/${appId}/public/data/fund_requests`),
                where('status', '==', 'pending')
            );
            unsubscribers.push(onSnapshot(pendingRequestsQuery, (snapshot) => {
                const pendingRequests = mergeFundRequestsById(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                allFundRequestsCache = pendingRequests.filter(req => (req.type || 'withdrawal') === 'withdrawal');
                allRechargeRequestsCache = pendingRequests.filter(req => req.type === 'mobile_recharge');
                updateAdminPendingRequestSummary();
                if (document.getElementById('admin-fund-requests-list-page')) renderAdminFundRequests(allFundRequestsCache);
                if (document.getElementById('admin-recharge-requests-list-page')) renderAdminRechargeRequests(allRechargeRequestsCache);
            }, (error) => {
                console.warn('Admin realtime fund requests skipped:', error);
                refreshAdminFundRequestsFromCloud().catch(refreshError => console.warn('Admin fund request fallback refresh skipped:', refreshError));
            }));
        };

        const applyAdminGiftCodesSnapshot = (docs = []) => {
            allGiftCodesCache = docs;
            const totalRedeemed = docs.reduce((acc, doc) => acc + (doc.data().timesUsed || 0), 0);
            const giftCardsEl = document.getElementById('analytics-gift-cards');
            if (giftCardsEl) giftCardsEl.textContent = totalRedeemed;
            if (document.getElementById('gift-codes-list-page')) {
                renderAdminGiftCodesList(docs);
            }
        };

        const updateAdminLoanRequestBadge = () => {
            const badge = document.getElementById('admin-loan-request-badge');
            if (!badge) return;
            const pendingCount = allLoanRequestsCache.filter(request =>
                isModernLoanRequest(request) &&
                String(request.status || request.loanRequestStatus || '').trim().toLowerCase() === 'pending'
            ).length;
            badge.textContent = pendingCount > 99 ? '99+' : String(pendingCount || '');
            badge.classList.toggle('hidden', pendingCount <= 0);
        };

        const applyAdminLoanRequestsSnapshot = (docs = []) => {
            allLoanRequestsCache = docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateAdminLoanRequestBadge();
            if (document.getElementById('admin-loan-page')) {
                renderAdminLoanPage();
            }
        };

        const applyAdminLoansSnapshot = (docs = []) => {
            allLoansCache = docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(isModernLoanRecord);
            if (document.getElementById('admin-loan-page')) {
                renderAdminLoanPage();
            }
        };

        const applyAdminInvestmentsSnapshot = (docs = []) => {
            allInvestmentsCache = docs.map(doc => ({ id: doc.id, ...doc.data() }));
            processDuePartnerInvestmentsForAdmin();
            if (document.getElementById('admin-investments-page')) {
                renderAdminInvestmentsPage();
            }
        };

        const applyAdminTasksSnapshot = (docs = []) => {
            allTasksCache = docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (document.getElementById('admin-task-list')) {
                renderAdminTaskList();
            }
            renderHomeTaskCategories();
        };

        const applyAdsSnapshot = (docs = []) => {
            allAdsCache = docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
            renderHomeAdsCarousel();
            if (document.getElementById('admin-ads-list')) {
                renderAdminAdsList();
            }
        };

        const getYoutubeEmbedUrl = (url = '') => {
            const value = String(url || '').trim();
            const match = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
            return match ? `https://www.youtube.com/embed/${match[1]}?mute=1&playsinline=1&rel=0` : '';
        };

        const getAdType = (ad = {}) => {
            if ((ad.type || '').toLowerCase() === 'youtube') return 'youtube';
            return getYoutubeEmbedUrl(ad.mediaUrl || ad.link || ad.url) ? 'youtube' : 'image';
        };

        const getAdMediaUrl = (ad = {}) => ad.mediaUrl || ad.link || ad.url || '';

        const renderHomeAdsCarousel = () => {
            const carousel = document.getElementById('home-ads-carousel');
            const dots = document.getElementById('home-ads-dots');
            if (!carousel || !dots) return;
            const activeAds = allAdsCache.filter(ad => (ad.status || 'active') === 'active');
            const ads = activeAds.length ? activeAds : [{
                title: 'REVIEWS WORLD',
                subtitle: 'Latest offers and work updates will appear here.',
                mediaUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
                type: 'image',
                status: 'active'
            }];
            homeAdsActiveIndex = Math.min(homeAdsActiveIndex, ads.length - 1);
            const render = () => {
                const ad = ads[homeAdsActiveIndex] || ads[0];
                const mediaUrl = getAdMediaUrl(ad);
                const youtubeUrl = getYoutubeEmbedUrl(mediaUrl);
                const isYoutube = getAdType(ad) === 'youtube' && youtubeUrl;
                carousel.innerHTML = `
                    <div class="relative mx-auto aspect-[16/7] w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-white dark:border-gray-800 bg-gray-950 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                        ${isYoutube ? `
                            <iframe src="${youtubeUrl}" title="${escapeHtml(ad.title || 'Advertisement')}" class="absolute inset-0 h-full w-full" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>
                        ` : `
                            <img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(ad.title || 'Advertisement')}" class="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" onerror="this.src='https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80'">
                        `}
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-4 text-white">
                            <p class="text-[10px] font-black uppercase tracking-wide text-white/70">Sponsored</p>
                            <h3 class="mt-1 line-clamp-1 text-base font-black">${escapeHtml(ad.title || 'Advertisement')}</h3>
                            ${ad.subtitle ? `<p class="mt-0.5 line-clamp-1 text-xs font-semibold text-white/80">${escapeHtml(ad.subtitle)}</p>` : ''}
                        </div>
                    </div>`;
                dots.innerHTML = ads.map((_, index) => `
                    <button data-action="home-ad-dot" data-index="${index}" class="h-2 rounded-full transition-all ${index === homeAdsActiveIndex ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300 dark:bg-gray-600'}" aria-label="Ad ${index + 1}"></button>
                `).join('');
            };
            render();
            if (homeAdsAutoTimer) clearInterval(homeAdsAutoTimer);
            homeAdsAutoTimer = ads.length > 1 ? setInterval(() => {
                homeAdsActiveIndex = (homeAdsActiveIndex + 1) % ads.length;
                renderHomeAdsCarousel();
            }, 2000) : null;
        };

        const renderHomeTaskCategories = () => {
            const container = document.getElementById('home-task-category-list');
            if (!container) return;
            const activeTasks = allTasksCache
                .filter(task => (task.status || 'active') === 'active')
                .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
            if (!activeTasks.length) {
                container.innerHTML = '<p class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-6 text-center text-sm font-bold text-gray-500 dark:text-gray-400">No live missions right now.</p>';
                return;
            }
            const categories = ['All', ...Array.from(new Set(activeTasks.map(task => task.category || 'Other'))).slice(0, 8)];
            container.innerHTML = `
                <div class="mb-3 flex items-center justify-between gap-3 px-1">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-300">Task Categories</p>
                        <h3 class="text-lg font-black text-slate-950 dark:text-white">Live Missions</h3>
                    </div>
                    <span class="text-[11px] font-bold text-gray-400">${activeTasks.length} available</span>
                </div>
                <label class="mb-3 flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 shadow-sm">
                    <svg class="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"></path></svg>
                    <input id="user-task-search" type="search" placeholder="Search app tasks..." class="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-500">
                </label>
                <div id="user-task-category-chips" class="mb-3 flex gap-2 overflow-x-auto pb-1">
                    ${categories.map((category, index) => `
                        <button type="button" data-task-category="${escapeHtml(category)}" class="user-task-category-chip shrink-0 rounded-full px-3 py-2 text-xs font-black ${index === 0 ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'bg-white text-slate-600 border border-gray-200 dark:bg-gray-800 dark:text-slate-200 dark:border-gray-700'}">${escapeHtml(category)}</button>
                    `).join('')}
                </div>
                <div id="user-task-results" class="space-y-3"></div>`;

            let selectedCategory = 'All';
            const renderList = () => {
                const term = (document.getElementById('user-task-search')?.value || '').trim().toLowerCase();
                const filtered = activeTasks.filter(task => {
                    const matchesCategory = selectedCategory === 'All' || String(task.category || 'Other') === selectedCategory;
                    const matchesSearch = !term || [task.title, task.category, task.instructions, task.appName].some(value => String(value || '').toLowerCase().includes(term));
                    return matchesCategory && matchesSearch;
                });
                const results = document.getElementById('user-task-results');
                if (!results) return;
                results.innerHTML = filtered.length ? filtered.map(task => {
                    const image = task.imageUrl || task.logoUrl || task.iconUrl || 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png';
                    return `
                        <button data-action="open-user-task" data-taskid="${task.id}" class="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-left shadow-sm transition hover:border-slate-400 dark:hover:border-slate-500">
                            <div class="flex items-center gap-3">
                                <span class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                                    <img src="${escapeHtml(image)}" alt="${escapeHtml(task.title || 'Task')}" class="h-full w-full object-cover" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3176/3176366.png'">
                                </span>
                                <span class="min-w-0 flex-1">
                                    <span class="block truncate text-sm font-black text-slate-950 dark:text-white">${escapeHtml(task.title || 'Task')}</span>
                                    <span class="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-200">Instant</span>
                                </span>
                                <span class="text-right">
                                    <span class="block text-[8px] font-black uppercase text-slate-400">Reward</span>
                                    <span class="block text-lg font-black text-slate-950 dark:text-white">${formatCurrency(task.rate || task.reward || 0).replace('.00', '')}</span>
                                </span>
                            </div>
                        </button>`;
                }).join('') : '<p class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-5 text-center text-sm font-bold text-gray-500">No matching mission found.</p>';
            };
            renderList();
            document.getElementById('user-task-search')?.addEventListener('input', renderList);
            document.querySelectorAll('.user-task-category-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    selectedCategory = chip.dataset.taskCategory || 'All';
                    document.querySelectorAll('.user-task-category-chip').forEach(btn => {
                        const isActive = btn.dataset.taskCategory === selectedCategory;
                        btn.className = `user-task-category-chip shrink-0 rounded-full px-3 py-2 text-xs font-black ${isActive ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'bg-white text-slate-600 border border-gray-200 dark:bg-gray-800 dark:text-slate-200 dark:border-gray-700'}`;
                    });
                    renderList();
                });
            });
        };

        const initializePublicHomeRealtime = () => {
            if (publicHomeRealtimeStarted) return;
            publicHomeRealtimeStarted = true;
            unsubscribers.push(onSnapshot(
                query(collection(db, `artifacts/${appId}/public/data/ads`), orderBy("createdAt", "desc")),
                (snapshot) => applyAdsSnapshot(snapshot.docs),
                (error) => console.warn('Public ads realtime skipped:', error)
            ));
            unsubscribers.push(onSnapshot(
                query(collection(db, `artifacts/${appId}/public/data/tasks`), orderBy("createdAt", "desc")),
                (snapshot) => applyAdminTasksSnapshot(snapshot.docs),
                (error) => console.warn('Public tasks realtime skipped:', error)
            ));
        };

        const initializeAdminSecondaryRealtime = () => {
            if (currentUser?.uid !== ADMIN_UID || adminSecondaryRealtimeStarted) return;
            adminSecondaryRealtimeStarted = true;

            unsubscribers.push(onSnapshot(
                query(collection(db, `artifacts/${appId}/public/data/gift_codes`)),
                (snapshot) => applyAdminGiftCodesSnapshot(snapshot.docs),
                (error) => console.warn('Admin realtime gift codes skipped:', error)
            ));

            unsubscribers.push(onSnapshot(
                query(collection(db, `artifacts/${appId}/public/data/loan_requests`), orderBy("requestedAt", "desc")),
                (snapshot) => applyAdminLoanRequestsSnapshot(snapshot.docs),
                (error) => console.warn('Admin realtime loan requests skipped:', error)
            ));

            unsubscribers.push(onSnapshot(
                query(collection(db, `artifacts/${appId}/public/data/loans`), orderBy("createdAt", "desc")),
                (snapshot) => applyAdminLoansSnapshot(snapshot.docs),
                (error) => console.warn('Admin realtime loans skipped:', error)
            ));

            unsubscribers.push(onSnapshot(
                query(collection(db, `artifacts/${appId}/public/data/partner_investments`), orderBy("createdAt", "desc")),
                (snapshot) => applyAdminInvestmentsSnapshot(snapshot.docs),
                (error) => console.warn('Admin realtime partner investments skipped:', error)
            ));

            unsubscribers.push(onSnapshot(
                query(collection(db, `artifacts/${appId}/public/data/tasks`), orderBy("createdAt", "desc")),
                (snapshot) => applyAdminTasksSnapshot(snapshot.docs),
                (error) => console.warn('Admin realtime tasks skipped:', error)
            ));

            unsubscribers.push(onSnapshot(
                query(collection(db, `artifacts/${appId}/public/data/ads`), orderBy("createdAt", "desc")),
                (snapshot) => applyAdsSnapshot(snapshot.docs),
                (error) => console.warn('Admin realtime ads skipped:', error)
            ));
        };

        const refreshAdminSecondaryCaches = async () => {
            const codesQuery = query(collection(db, `artifacts/${appId}/public/data/gift_codes`));
            const codesSnap = await getDocs(codesQuery);
            applyAdminGiftCodesSnapshot(codesSnap.docs);

            await refreshAdminFundRequestsFromCloud();

            const loanRequestsQuery = query(collection(db, `artifacts/${appId}/public/data/loan_requests`), orderBy("requestedAt", "desc"));
            const loanRequestsSnap = await getDocs(loanRequestsQuery);
            applyAdminLoanRequestsSnapshot(loanRequestsSnap.docs);

            const loansQuery = query(collection(db, `artifacts/${appId}/public/data/loans`), orderBy("createdAt", "desc"));
            const loansSnap = await getDocs(loansQuery);
            applyAdminLoansSnapshot(loansSnap.docs);

            const investmentsQuery = query(collection(db, `artifacts/${appId}/public/data/partner_investments`), orderBy("createdAt", "desc"));
            const investmentsSnap = await getDocs(investmentsQuery);
            applyAdminInvestmentsSnapshot(investmentsSnap.docs);

            const tasksQuery = query(collection(db, `artifacts/${appId}/public/data/tasks`), orderBy("createdAt", "desc"));
            const tasksSnap = await getDocs(tasksQuery);
            applyAdminTasksSnapshot(tasksSnap.docs);

            const adsQuery = query(collection(db, `artifacts/${appId}/public/data/ads`), orderBy("createdAt", "desc"));
            const adsSnap = await getDocs(adsQuery);
            applyAdsSnapshot(adsSnap.docs);
        };

        let initializeAdminListeners = () => {
            console.log("Initializing admin data...");
            hydrateAdminUsersFromCache();
            initializeAdminUsersRealtime();
            initializeAdminFundRequestsRealtime();
            initializeAdminSecondaryRealtime();
            refreshAdminDashboardCaches().catch(error => console.error("Admin data refresh failed:", error));
            loadAdminChatsFromBackend({ silent: true }).catch(error => console.error("Admin: Error loading Cloudflare support chats:", error));
        };

        // --- FULL PAGE RENDERERS ---

        const getPageHeader = (title, options = {}) => `
            <header class="flex items-center mb-6 p-4 bg-white dark:bg-gray-800 shadow-md page-header-fixed">
                ${options.showBack === false ? '' : `
                    <button class="page-back-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                    </button>
                `}
                <h2 class="text-xl font-bold">${title}</h2>
            </header>
            <div class="p-4 pt-0">`;

        const getPartnerInvestmentHeader = () => `
            <header class="flex items-center justify-between gap-3 mb-6 p-4 bg-white dark:bg-gray-800 shadow-md page-header-fixed">
                <div class="flex items-center min-w-0">
                    <button class="page-back-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-2 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                    </button>
                    <h2 class="text-xl font-bold truncate">Partner Investment</h2>
                </div>
                <div class="shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-3 py-2 text-right">
                    <p class="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-300">Wallet Balance</p>
                    <p class="text-sm font-bold text-gray-900 dark:text-white">${formatCurrency(currentUserData?.balance || 0)}</p>
                </div>
            </header>
            <div class="p-4 pt-0">`;

        const getPageFooter = () => `</div>`;

        const getProfilePaymentDetails = (method, data = currentUserData || {}) => {
            const details = data.paymentDetails && typeof data.paymentDetails === 'object' ? { ...data.paymentDetails } : {};
            if (method === 'upi') {
                return {
                    ...details,
                    upiId: details.upiId || data.upiId || (typeof data.paymentDetails === 'string' ? data.paymentDetails : '')
                };
            }
            if (method === 'bank') {
                return {
                    ...details,
                    accountNumber: details.accountNumber || data.accountNumber || '',
                    ifsc: details.ifsc || data.ifsc || '',
                    bankName: details.bankName || data.bankName || '',
                    accountName: details.accountName || data.accountName || ''
                };
            }
            if (['play_store', 'amazon_gift', 'flipkart_gift', 'paypal'].includes(method)) {
                const stringDetails = typeof data.paymentDetails === 'string' ? data.paymentDetails : '';
                return {
                    ...details,
                    email: details.email || data.paymentEmail || (stringDetails.includes('@') ? stringDetails : '')
                };
            }
            return details;
        };

        const normalizeProfilePaymentMethod = (data = currentUserData || {}) => {
            const rawMethod = String(
                data.paymentMethod ||
                data.payment_method ||
                data.selectedPaymentMethod ||
                data.withdrawalMethod ||
                data.withdrawMethod ||
                data.withdraw_method ||
                data.methodId ||
                data.method ||
                ''
            )
                .trim()
                .toLowerCase()
                .replace(/[\s-]+/g, '_');
            const methodAliases = {
                upi: 'upi',
                upi_id: 'upi',
                bank: 'bank',
                bank_account: 'bank',
                account: 'bank',
                play_store: 'play_store',
                playstore: 'play_store',
                redeem_code: 'play_store',
                amazon: 'amazon_gift',
                amazon_gift: 'amazon_gift',
                amazon_gift_card: 'amazon_gift',
                flipkart: 'flipkart_gift',
                flipkart_gift: 'flipkart_gift',
                flipkart_gift_card: 'flipkart_gift',
                paypal: 'paypal'
            };
            if (methodAliases[rawMethod]) return methodAliases[rawMethod];
            if (rawMethod.includes('upi')) return 'upi';
            if (rawMethod.includes('bank') || rawMethod.includes('account')) return 'bank';
            if (rawMethod.includes('play')) return 'play_store';
            if (rawMethod.includes('amazon')) return 'amazon_gift';
            if (rawMethod.includes('flipkart')) return 'flipkart_gift';
            if (rawMethod.includes('paypal')) return 'paypal';

            const details = data.paymentDetails && typeof data.paymentDetails === 'object' ? data.paymentDetails : {};
            const stringDetails = typeof data.paymentDetails === 'string' ? data.paymentDetails : '';
            if (details.upiId || data.upiId) return 'upi';
            if (details.accountNumber || details.ifsc || data.accountNumber || data.ifsc) return 'bank';
            if (details.email || data.paymentEmail || stringDetails.includes('@')) return 'paypal';
            return '';
        };

        const toTitleText = (value = '') => String(value)
            .replace(/[_-]+/g, ' ')
            .trim()
            .replace(/\b\w/g, char => char.toUpperCase());

        const getRawProfilePaymentMethod = (data = currentUserData || {}) =>
            data.paymentMethod || data.payment_method || data.selectedPaymentMethod || data.withdrawalMethod ||
            data.withdrawMethod || data.withdraw_method || data.methodId || data.method || '';

        const getProfilePaymentMethodLabel = (method, data = currentUserData || {}) => ({
            upi: 'UPI ID',
            bank: 'Bank Account',
            play_store: 'Play Store Redeem Code',
            amazon_gift: 'Amazon Gift Card',
            flipkart_gift: 'Flipkart Gift Card',
            paypal: 'PayPal',
            crypto: 'Crypto Currency'
        }[method] || toTitleText(getRawProfilePaymentMethod(data)) || 'Payment Method');

        const getProfilePaymentSummaryText = (method, data = currentUserData || {}) => {
            const details = getProfilePaymentDetails(method, data);
            if (method === 'upi') return details.upiId || data.upiId || '';
            if (method === 'bank') {
                return [
                    details.accountNumber || data.accountNumber,
                    details.ifsc || data.ifsc,
                    details.bankName || data.bankName,
                    details.accountName || data.accountName
                ].filter(Boolean).join(' | ');
            }
            if (['play_store', 'amazon_gift', 'flipkart_gift', 'paypal'].includes(method)) {
                return details.email || data.paymentEmail || '';
            }
            if (typeof data.paymentDetails === 'string') return data.paymentDetails;
            if (data.paymentDetails && typeof data.paymentDetails === 'object') {
                const detailLabels = {
                    upiId: 'UPI',
                    accountNumber: 'A/C',
                    ifsc: 'IFSC',
                    bankName: 'Bank',
                    accountName: 'Name',
                    email: 'Email'
                };
                return Object.entries(data.paymentDetails)
                    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
                    .map(([key, value]) => `${detailLabels[key] || toTitleText(key)}: ${value}`)
                    .join(' | ');
            }
            return [
                data.upiId && `UPI: ${data.upiId}`,
                data.accountNumber && `A/C: ${data.accountNumber}`,
                data.ifsc && `IFSC: ${data.ifsc}`,
                data.bankName && `Bank: ${data.bankName}`,
                data.accountName && `Name: ${data.accountName}`,
                data.paymentEmail && `Email: ${data.paymentEmail}`
            ].filter(Boolean).join(' | ');
        };

        const renderWebsiteLinkInputs = (links = []) => {
            const cleanLinks = Array.isArray(links) ? links.slice(0, 3) : [];
            const visibleCount = Math.max(1, cleanLinks.length);
            const inputs = Array.from({ length: visibleCount }, (_, i) => `
                <div class="flex items-center gap-2">
                    <input type="url" value="${escapeHtml(cleanLinks[i] || '')}" placeholder="https://example.com" class="profile-website-input w-full px-4 py-3 bg-white dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    ${i > 0 ? '<button type="button" class="remove-website-link-btn h-10 w-10 shrink-0 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-200 font-bold">-</button>' : ''}
                </div>
            `).join('');
            const addButton = visibleCount < 3
                ? '<button type="button" id="add-website-link-btn" class="w-full rounded-xl border border-dashed border-blue-300 dark:border-blue-700 py-2 text-sm font-bold text-blue-700 dark:text-blue-200">+ Add website link</button>'
                : '';
            return `${inputs}${addButton}`;
        };

        const bindWebsiteLinkControls = () => {
            const container = document.getElementById('website-links-container');
            if (!container) return;
            const readLinks = () => Array.from(container.querySelectorAll('.profile-website-input'))
                .map(input => input.value.trim())
                .filter((value, index) => value || index === 0)
                .slice(0, 3);
            const rerender = (links) => {
                container.innerHTML = renderWebsiteLinkInputs(links);
                bindWebsiteLinkControls();
            };
            document.getElementById('add-website-link-btn')?.addEventListener('click', () => {
                const links = readLinks();
                if (links.length < 3) links.push('');
                rerender(links);
            });
            container.querySelectorAll('.remove-website-link-btn').forEach((btn, index) => {
                btn.addEventListener('click', () => {
                    const links = readLinks();
                    links.splice(index + 1, 1);
                    rerender(links);
                });
            });
        };

        const showProfilePage = (focusMethod = '') => {
            if (!currentUserData) return showNotification('User data not loaded. Please wait.', true);
            const isAdminProfile = currentUser?.uid === ADMIN_UID;
            const websiteLinks = Array.isArray(currentUserData.websiteLinks) ? currentUserData.websiteLinks.slice(0, 3) : [];
            const activePaymentMethod = focusMethod || normalizeProfilePaymentMethod(currentUserData);

            const paymentMethods = [
                { value: '', label: 'Select Payment Method' },
                { value: 'upi', label: 'UPI ID' },
                { value: 'bank', label: 'Bank Account' },
                { value: 'play_store', label: 'Play Store Redeem Code' },
                { value: 'amazon_gift', label: 'Amazon Gift Card' },
                { value: 'flipkart_gift', label: 'Flipkart Gift Card' },
                { value: 'paypal', label: 'PayPal' },
                { value: 'crypto', label: 'Crypto Currency (Coming Soon)', disabled: true }
            ];

            const paymentOptions = paymentMethods.map(method =>
                `<option value="${method.value}" ${method.disabled ? 'disabled' : ''} ${activePaymentMethod === method.value ? 'selected' : ''}>${method.label}</option>`
            ).join('');

            let paymentDetailsForm = '';
            if (activePaymentMethod) {
                paymentDetailsForm = renderPaymentDetailsForm(activePaymentMethod, getProfilePaymentDetails(activePaymentMethod));
            }
            const savedPaymentSummary = activePaymentMethod ? getProfilePaymentSummaryText(activePaymentMethod) : '';
            const savedPaymentCard = activePaymentMethod ? `
                    <div class="rounded-xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
                        <p class="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-300">Saved Payment Method</p>
                        <p class="mt-1 text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(getProfilePaymentMethodLabel(activePaymentMethod, currentUserData))}</p>
                        ${savedPaymentSummary ? `<p class="mt-1 text-sm text-gray-600 dark:text-gray-300 break-words">${escapeHtml(savedPaymentSummary)}</p>` : ''}
                        <button type="button" id="delete-payment-method-btn" class="mt-3 w-full rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm font-bold text-red-600 dark:text-red-200">Delete payment method</button>
                    </div>` : '';
            const paymentMethodControl = activePaymentMethod ? `
                    <input type="hidden" id="profile-payment-method" value="${escapeHtml(activePaymentMethod)}">` : `
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Method</label>
                        <select id="profile-payment-method" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
                            ${paymentOptions}
                        </select>
                    </div>`;

            const content = `
                ${getPageHeader('My Profile')}
                <div class="max-w-lg mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Email Address</label>
                        <input type="email" value="${escapeHtml(currentUserData.email || '')}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg cursor-not-allowed" readonly>
                    </div>
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name</label>
                        <input type="text" id="profile-name-input" value="${escapeHtml(currentUserData.name || '')}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Mobile Number</label>
                        <input type="tel" id="profile-mobile-input" value="${escapeHtml(currentUserData.mobile || '')}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    ${paymentMethodControl}
                    ${savedPaymentCard}
                    <div id="payment-details-container">
                        ${paymentDetailsForm}
                    </div>
                    ${isAdminProfile ? `
                    <div class="rounded-2xl border border-blue-100 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 p-4 space-y-3">
                        <div>
                            <p class="text-sm font-bold text-blue-900 dark:text-blue-100">Support Profile</p>
                            <p class="text-xs text-blue-600 dark:text-blue-300">Shown in chat profile details.</p>
                        </div>
                        <div class="space-y-1">
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">WhatsApp Number</label>
                            <input type="tel" id="profile-whatsapp-input" value="${escapeHtml(currentUserData.whatsappNumber || currentUserData.mobile || '')}" maxlength="15" placeholder="WhatsApp number" class="w-full px-4 py-3 bg-white dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div class="space-y-2">
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Website Links (optional, max 3)</label>
                            <div id="website-links-container" class="space-y-2">${renderWebsiteLinkInputs(websiteLinks)}</div>
                        </div>
                    </div>` : ''}
                    <button id="save-profile-btn" class="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition">Save Changes</button>
                </div>
                ${getPageFooter()}`;
            showPage(content);

            const paymentSelect = document.getElementById('profile-payment-method');
            if (paymentSelect?.tagName === 'SELECT') {
                paymentSelect.value = activePaymentMethod;
                paymentSelect.addEventListener('change', function () {
                    const method = this.value;
                    document.getElementById('payment-details-container').innerHTML = renderPaymentDetailsForm(method, getProfilePaymentDetails(method));
                });
            }

            document.getElementById('save-profile-btn').onclick = handleUpdateProfile;
            document.getElementById('delete-payment-method-btn')?.addEventListener('click', async () => {
                if (!confirm('Delete saved payment method? You can add a new one after deleting it.')) return;
                try {
                    const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                    await updateDoc(userRef, {
                        paymentMethod: '',
                        paymentDetails: {},
                        upiId: deleteField(),
                        accountNumber: deleteField(),
                        ifsc: deleteField(),
                        bankName: deleteField(),
                        accountName: deleteField(),
                        paymentEmail: deleteField()
                    });
                    currentUserData = { ...(currentUserData || {}), paymentMethod: '', paymentDetails: {} };
                    ['upiId', 'accountNumber', 'ifsc', 'bankName', 'accountName', 'paymentEmail'].forEach(key => delete currentUserData[key]);
                    writeJsonCache(getUserCacheKey(currentUser.uid), sanitizeUserForCache(currentUserData, currentUser.uid));
                    showNotification('Payment method deleted. You can add a new one now.');
                    showProfilePage();
                } catch (error) {
                    console.error('Delete payment method failed:', error);
                    showNotification('Could not delete payment method.', true);
                }
            });
            bindWebsiteLinkControls();
            if (focusMethod) {
                if (paymentSelect) paymentSelect.value = focusMethod;
                document.getElementById('payment-details-container').innerHTML = renderPaymentDetailsForm(focusMethod, getProfilePaymentDetails(focusMethod));
                setTimeout(() => document.getElementById('payment-details-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
            }
        };

        const renderPaymentDetailsForm = (method, currentDetails) => {
            switch (method) {
                case 'upi':
                    return `
                        <div class="space-y-1">
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">UPI ID</label>
                            <input type="text" id="payment-upi-id" value="${escapeHtml(currentDetails.upiId || '')}" placeholder="e.g. yourname@bank" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>`;
                case 'bank':
                    return `
                        <div class="space-y-3">
                            <div class="space-y-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Bank Account Number</label>
                                <input type="text" id="payment-bank-account" value="${escapeHtml(currentDetails.accountNumber || '')}" placeholder="Enter bank account number" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div class="space-y-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">IFSC Code</label>
                                <input type="text" id="payment-ifsc" value="${escapeHtml(currentDetails.ifsc || '')}" placeholder="Enter IFSC code" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div class="space-y-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Bank Name</label>
                                <input type="text" id="payment-bank-name" value="${escapeHtml(currentDetails.bankName || '')}" placeholder="Enter bank name" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div class="space-y-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Account Holder Name</label>
                                <input type="text" id="payment-account-name" value="${escapeHtml(currentDetails.accountName || '')}" placeholder="Enter account holder name" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>`;
                case 'play_store':
                case 'amazon_gift':
                case 'flipkart_gift':
                case 'paypal':
                    return `
                        <div class="space-y-1">
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Email Address</label>
                            <input type="email" id="payment-email" value="${escapeHtml(currentDetails.email || '')}" placeholder="Enter your email" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>`;
                case 'crypto':
                    return `<div class="text-center py-4 text-gray-500 dark:text-gray-400">Crypto Currency withdrawal is coming soon.</div>`;
                default:
                    return '';
            }
        };

        const isWithdrawMethodDetailsComplete = (method) => {
            const details = getProfilePaymentDetails(method);
            if (method === 'upi') return !!String(details.upiId || '').trim();
            if (method === 'bank') {
                return ['accountNumber', 'ifsc', 'bankName', 'accountName'].every(key => !!String(details[key] || '').trim());
            }
            if (['play_store', 'amazon_gift', 'flipkart_gift', 'paypal'].includes(method)) {
                return !!String(details.email || '').trim();
            }
            return false;
        };

        const showWithdrawDetailsMissingModal = (method, methodName) => {
            renderModal('Update Withdraw Method',
                `<div class="space-y-3">
                    <div class="rounded-2xl border border-yellow-100 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                        <p class="text-sm font-bold text-yellow-800 dark:text-yellow-100">${escapeHtml(methodName)} details are missing.</p>
                        <p class="text-sm text-yellow-700 dark:text-yellow-200 mt-1">Please update your withdraw method first, then request withdrawal.</p>
                    </div>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="set-withdraw-method-now-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Set Now</button>`,
                'max-w-sm');
            document.getElementById('set-withdraw-method-now-btn').onclick = () => {
                window.closeModal();
                showProfilePage(method);
            };
        };

        const renderSettingAction = (id, label, iconUrl, tone = 'gray') => `
            <button id="${id}" class="flex items-center w-full gap-3 p-4 bg-${tone}-50 dark:bg-${tone}-900/20 hover:bg-${tone}-100 dark:hover:bg-${tone}-900/30 border border-${tone}-100 dark:border-${tone}-800 rounded-xl transition text-left">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-gray-800 shadow-sm">
                    <img src="${iconUrl}" alt="${label}" class="h-7 w-7 object-contain">
                </span>
                <span class="font-semibold text-gray-900 dark:text-white">${label}</span>
            </button>`;

        const showSettingsPage = () => {
            const currentTheme = localStorage.getItem('theme') || 'light';
            const isAdmin = currentUser && currentUser.uid === ADMIN_UID;
            const content = `
                ${getPageHeader('Setting', { showBack: false })}
                <div class="max-w-lg mx-auto space-y-4">
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-3">
                        ${renderSettingAction('settings-profile-btn', 'My Profile', 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', 'blue')}
                        ${renderSettingAction('settings-track-income-btn', 'Track Income', 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png', 'emerald')}
                        ${renderSettingAction('settings-invoice-btn', 'Invoice', 'https://cdn-icons-png.flaticon.com/512/337/337946.png', 'yellow')}
                        <button id="settings-theme-btn" class="flex items-center justify-between w-full text-left p-4 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium">
                            <span>Toggle Light/Dark Mode</span>
                        <div class="relative w-5 h-5">
                            <svg id="settings-theme-icon-light" class="w-5 h-5 ${currentTheme === 'dark' ? 'hidden' : ''}" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m18.66 18.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>
                            <svg id="settings-theme-icon-dark" class="w-5 h-5 ${currentTheme === 'light' ? 'hidden' : ''}" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>
                        </div>
                        </button>
                    </div>
                    ${isAdmin ? `
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-3">
                        <p class="text-xs font-bold uppercase text-gray-400 px-1">Admin</p>
                        ${renderSettingAction('settings-admin-withdrawals', 'Pending Requests', 'https://cdn-icons-png.flaticon.com/512/7939/7939990.png', 'blue')}
                        ${renderSettingAction('settings-admin-users', 'User Management', 'https://cdn-icons-png.flaticon.com/512/681/681494.png', 'green')}
                        ${renderSettingAction('settings-admin-gift-codes', 'Gift Codes', 'https://cdn-icons-png.flaticon.com/512/2611/2611152.png', 'purple')}
                        ${renderSettingAction('settings-admin-history', 'Withdrawal History', 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png', 'yellow')}
                        ${renderSettingAction('settings-admin-chat', 'Manage Chat', 'https://cdn-icons-png.flaticon.com/512/5962/5962463.png', 'rose')}
                        ${renderSettingAction('settings-admin-maintenance', 'Maintenance Mode', 'https://cdn-icons-png.flaticon.com/512/2099/2099058.png', 'red')}
                        ${renderSettingAction('settings-admin-whats-new', "What's New Popup", 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png', 'blue')}
                    </div>` : ''}
                    <button id="settings-logout-btn" class="flex items-center justify-center w-full p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-300 font-bold">Logout</button>
                </div>
                ${getPageFooter()}`;
            showPage(content, { keepBottomNav: true });
            currentMainSection = 'settings';
            setBottomNavActive('bottom-settings-btn');
            document.getElementById('settings-profile-btn').onclick = showProfilePage;
            document.getElementById('settings-track-income-btn').onclick = showTrackIncomePage;
            document.getElementById('settings-invoice-btn').onclick = showWithdrawalInvoicesPage;
            document.getElementById('settings-theme-btn').onclick = toggleTheme;
            document.getElementById('settings-logout-btn').onclick = () => signOut(auth);
            if (isAdmin) {
                document.getElementById('settings-admin-withdrawals').onclick = showAdminWithdrawalsPage;
                document.getElementById('settings-admin-users').onclick = showAdminUsersPage;
                document.getElementById('settings-admin-gift-codes').onclick = showAdminGiftCodesPage;
                document.getElementById('settings-admin-history').onclick = showWithdrawalHistoryPage;
                document.getElementById('settings-admin-chat').onclick = showAdminChatsPage;
                document.getElementById('settings-admin-maintenance').onclick = showMaintenanceSettingsPage;
                document.getElementById('settings-admin-whats-new').onclick = showWhatsNewSettingsPage;
            }
        };

        const getMaintenanceEndMillis = (config = appConfigCache) =>
            timestampToMillis(config.maintenanceEndsAtMillis || config.maintenance_ends_at_millis || config.maintenanceEndsAt || config.maintenance_ends_at || config.maintenanceEndAt || 0);

        const isMaintenanceConfigActive = (config = appConfigCache) => {
            const enabled = !!(config.maintenanceEnabled || config.maintenance_enabled);
            if (!enabled) return false;
            const endMillis = getMaintenanceEndMillis(config);
            return !endMillis || endMillis > Date.now();
        };

        const getMaintenanceCountdownParts = (millis) => {
            const totalSeconds = Math.max(0, Math.floor(Number(millis || 0) / 1000));
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return { hours, minutes, seconds, totalSeconds };
        };

        const formatMaintenanceCountdown = (millis) => {
            const { hours, minutes, seconds } = getMaintenanceCountdownParts(millis);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };

        const formatMaintenanceDurationInput = (totalSeconds = 1800) => {
            const safeSeconds = Math.min(4320 * 60, Math.max(60, Math.floor(Number(totalSeconds) || 1800)));
            return formatMaintenanceCountdown(safeSeconds * 1000);
        };

        const parseMaintenanceDurationInput = (value) => {
            const match = String(value || '').trim().match(/^(\d{1,2}):([0-5]?\d):([0-5]?\d)$/);
            if (!match) return null;
            const hours = Number(match[1]);
            const minutes = Number(match[2]);
            const seconds = Number(match[3]);
            const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
            if (!Number.isFinite(totalSeconds) || totalSeconds < 60 || totalSeconds > 4320 * 60) return null;
            return totalSeconds;
        };

        const updateMaintenanceCountdownUi = (endMillis) => {
            const countdown = endMillis ? formatMaintenanceCountdown(endMillis - Date.now()) : 'Updating now';
            const countdownEl = document.getElementById('maintenance-countdown-text');
            if (countdownEl) countdownEl.textContent = countdown;

            const progressEl = document.getElementById('maintenance-progress-fill');
            if (progressEl) {
                const configuredSeconds = Number(appConfigCache.maintenanceDurationSeconds || appConfigCache.maintenance_duration_seconds || 0);
                const remainingSeconds = endMillis ? Math.max(0, Math.ceil((endMillis - Date.now()) / 1000)) : 0;
                const progress = configuredSeconds > 0
                    ? Math.min(100, Math.max(6, ((configuredSeconds - remainingSeconds) / configuredSeconds) * 100))
                    : 35;
                progressEl.style.width = `${progress}%`;
            }
        };

        const removeMaintenanceOverlay = () => {
            if (maintenanceCountdownTimer) {
                clearInterval(maintenanceCountdownTimer);
                maintenanceCountdownTimer = null;
            }
            document.getElementById('app-maintenance-overlay')?.remove();
            document.body.classList.remove('overflow-hidden');
        };

        const renderMaintenanceOverlay = () => {
            if (!currentUser || currentUser.uid === ADMIN_UID || !isMaintenanceConfigActive(appConfigCache)) {
                removeMaintenanceOverlay();
                return;
            }
            const endMillis = getMaintenanceEndMillis(appConfigCache);
            if (endMillis && endMillis <= Date.now()) {
                removeMaintenanceOverlay();
                return;
            }

            let overlay = document.getElementById('app-maintenance-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'app-maintenance-overlay';
                overlay.className = 'fixed inset-0 z-[9999] overflow-y-auto bg-slate-950 text-white';
                document.body.appendChild(overlay);
            }
            document.body.classList.add('overflow-hidden');

            const message = appConfigCache.maintenanceMessage || 'We are improving your wallet experience. Please wait until the maintenance window is complete.';
            const countdown = endMillis ? formatMaintenanceCountdown(endMillis - Date.now()) : 'Updating now';
            const signature = `${message}|${endMillis || 0}`;
            if (overlay.dataset.maintenanceSignature === signature) {
                updateMaintenanceCountdownUi(endMillis);
                if (!maintenanceCountdownTimer) {
                    maintenanceCountdownTimer = setInterval(renderMaintenanceOverlay, 1000);
                }
                return;
            }
            overlay.dataset.maintenanceSignature = signature;
            const endText = endMillis
                ? new Date(endMillis).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s(am|pm)$/i, value => value.toUpperCase())
                : 'In progress';
            overlay.innerHTML = `
                <div class="maintenance-premium-bg min-h-[100dvh] px-4 py-6 text-white">
                    <div class="relative z-10 mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-xl items-center justify-center">
                        <section class="w-full overflow-hidden rounded-[2rem] border border-white/20 bg-white/95 p-6 text-center text-slate-950 shadow-2xl sm:p-8">
                            <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-950 p-2 shadow-xl">
                                <img src="${RW_LOGO_URL}" alt="REVIEWS WORLD" class="h-full w-full rounded-2xl object-cover">
                            </div>
                            <p class="mt-6 text-xs font-extrabold uppercase text-blue-600">App Under Maintenance</p>
                            <h1 class="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">We will be back soon</h1>
                            <p class="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-slate-600">${escapeHtml(message)}</p>

                            <div class="mt-7 rounded-[1.5rem] bg-slate-950 px-5 py-6 text-white shadow-xl">
                                <p id="maintenance-countdown-text" class="text-5xl font-extrabold leading-none tabular-nums sm:text-6xl">${escapeHtml(countdown)}</p>
                                <p class="mt-3 text-xs font-extrabold uppercase text-cyan-100/80">Remaining Time</p>
                                <div class="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
                                    <div id="maintenance-progress-fill" class="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-emerald-300 transition-[width] duration-500" style="width: 6%"></div>
                                </div>
                            </div>

                            <p class="mt-5 flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 px-3 py-3 text-[12px] font-semibold text-slate-600 sm:text-sm">
                                <span class="shrink-0">Expected opening:</span>
                                <span class="whitespace-nowrap font-extrabold text-slate-950">${escapeHtml(endText)}</span>
                            </p>
                        </section>
                    </div>
                </div>`;
            updateMaintenanceCountdownUi(endMillis);

            if (!maintenanceCountdownTimer) {
                maintenanceCountdownTimer = setInterval(renderMaintenanceOverlay, 1000);
            }
        };

        const restoreDashboardAfterMaintenanceIfNeeded = () => {
            if (!maintenanceGateActive || !currentUser || currentUser.uid === ADMIN_UID || isMaintenanceConfigActive(appConfigCache)) return;
            maintenanceGateActive = false;
            if (currentUserData && (currentUserData.isFlagged || isUserApprovalPending(currentUserData) || isUserApprovalRejected(currentUserData))) return;
            const dashboard = document.getElementById('dashboard-content');
            const pageContainer = document.getElementById('page-container');
            currentMainSection = 'home';
            switchTab('user-panel');
            setBottomNavActive('bottom-home-btn');
            setMainChrome(true);
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('main-content')?.classList.remove('hidden');
            dashboard?.classList.remove('hidden');
            if (pageContainer) {
                pageContainer.classList.add('hidden');
                pageContainer.innerHTML = '';
                pageContainer.style.overflowY = 'auto';
            }
            document.getElementById('app-footer')?.classList.add('app-footer-hidden');
        };

        const applyMaintenanceMode = () => {
            renderMaintenanceOverlay();
            restoreDashboardAfterMaintenanceIfNeeded();
        };

        const getWhatsNewId = (config = appConfigCache) => {
            const explicit = String(config.whatsNewId || config.whats_new_id || '').trim();
            if (explicit) return explicit;
            const updatedMillis = timestampToMillis(config.whatsNewUpdatedAtMillis || config.whats_new_updated_at_millis || config.whatsNewUpdatedAt || config.whats_new_updated_at || 0);
            if (updatedMillis) return String(updatedMillis);
            const message = String(config.whatsNewMessage || config.whats_new_message || '').trim();
            return message ? `msg-${message.length}-${message.slice(0, 32)}` : '';
        };

        const getWhatsNewSeenKey = (userId = currentUser?.uid || '') => `rw_wallet_whats_new_seen_${userId}`;

        const closeWhatsNewPopup = (markSeen = true) => {
            const id = getWhatsNewId(appConfigCache);
            if (markSeen && currentUser?.uid && id) {
                localStorage.setItem(getWhatsNewSeenKey(currentUser.uid), id);
            }
            whatsNewPopupVisible = false;
            document.getElementById('whats-new-overlay')?.remove();
        };

        window.closeWhatsNewPopup = () => closeWhatsNewPopup(true);

        const showWhatsNewPopupIfNeeded = () => {
            const enabled = appConfigCache.whatsNewEnabled !== false && appConfigCache.whats_new_enabled !== false;
            const message = String(appConfigCache.whatsNewMessage || appConfigCache.whats_new_message || '').trim();
            const id = getWhatsNewId(appConfigCache);
            if (!currentUser || currentUser.uid === ADMIN_UID) {
                closeWhatsNewPopup(false);
                return;
            }
            if (!enabled || !message || !id) {
                closeWhatsNewPopup(false);
                return;
            }
            if (isMaintenanceConfigActive(appConfigCache)) {
                closeWhatsNewPopup(false);
                return;
            }
            if (whatsNewPopupVisible) return;
            if (localStorage.getItem(getWhatsNewSeenKey(currentUser.uid)) === id) return;

            const title = String(appConfigCache.whatsNewTitle || appConfigCache.whats_new_title || "What's New").trim() || "What's New";
            const overlay = document.createElement('div');
            overlay.id = 'whats-new-overlay';
            overlay.className = 'fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm';
            overlay.innerHTML = `
                <div class="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900 dark:text-white">
                    <div class="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-emerald-500 px-6 py-6 text-white">
                        <button type="button" onclick="window.closeWhatsNewPopup()" class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-2xl font-light text-white hover:bg-white/30" aria-label="Close">&times;</button>
                        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg">
                            <img src="${RW_LOGO_URL}" alt="REVIEWS WORLD" class="h-11 w-11 rounded-xl object-cover">
                        </div>
                        <p class="mt-5 text-xs font-black uppercase tracking-[0.25em] text-white/70">REVIEWS WORLD</p>
                        <h2 class="mt-2 pr-10 text-2xl font-black leading-tight">${escapeHtml(title)}</h2>
                    </div>
                    <div class="space-y-4 px-6 py-5">
                        <p class="whitespace-pre-line text-sm font-medium leading-6 text-gray-600 dark:text-gray-300">${escapeHtml(message)}</p>
                        <button type="button" onclick="window.closeWhatsNewPopup()" class="w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white shadow-lg dark:bg-white dark:text-slate-950">Got it</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            whatsNewPopupVisible = true;
        };

        const showMaintenanceSettingsPage = () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const parentSection = currentMainSection === 'admin' ? 'admin' : 'settings';
            const handleBack = parentSection === 'admin' ? showAdminMainPage : showSettingsPage;
            const active = isMaintenanceConfigActive(appConfigCache);
            const endMillis = getMaintenanceEndMillis(appConfigCache);
            const remainingSeconds = active && endMillis ? Math.max(60, Math.ceil((endMillis - Date.now()) / 1000)) : 30 * 60;
            const durationValue = formatMaintenanceDurationInput(remainingSeconds);
            const endText = active && endMillis ? new Date(endMillis).toLocaleString('en-IN') : 'Not scheduled';
            const message = appConfigCache.maintenanceMessage || 'We are improving your wallet experience. Please wait until the maintenance window is complete.';

            showPage(`
                ${getPageHeader('Maintenance Mode')}
                <div class="max-w-lg mx-auto space-y-4">
                    <div class="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-900 to-emerald-700 p-5 text-white shadow-xl">
                        <p class="text-xs font-extrabold uppercase text-white/70">Admin Control</p>
                        <div class="mt-4 flex items-center justify-between gap-3">
                            <div>
                                <h3 class="text-2xl font-extrabold">${active ? 'Maintenance is ON' : 'Maintenance is OFF'}</h3>
                                <p class="mt-1 text-sm text-white/70">${active ? `Ends: ${escapeHtml(endText)}` : 'Users can open the app normally.'}</p>
                            </div>
                            <span class="rounded-2xl px-4 py-2 text-xs font-extrabold ${active ? 'bg-red-500 text-white' : 'bg-emerald-400 text-slate-950'}">${active ? 'LIVE' : 'OPEN'}</span>
                        </div>
                        <div class="mt-5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                            <p class="text-xs font-extrabold uppercase text-cyan-100/75">Selected Duration</p>
                            <p class="mt-1 text-3xl font-extrabold tabular-nums">${durationValue}</p>
                        </div>
                    </div>
                    <div class="rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-md border border-gray-100 dark:border-gray-700 space-y-4">
                        <div>
                            <label class="text-sm font-extrabold text-gray-700 dark:text-gray-200">Maintenance time (HH:MM:SS)</label>
                            <input id="maintenance-duration-input" type="text" inputmode="numeric" maxlength="8" value="${durationValue}" placeholder="00:30:00" class="mt-2 w-full rounded-2xl bg-gray-100 dark:bg-gray-700 px-4 py-3 text-2xl font-extrabold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <p class="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Example: 01:30:00 for 1 hour 30 minutes. Maximum 72:00:00.</p>
                        </div>
                        <div class="grid grid-cols-4 gap-2">
                            <button type="button" data-maintenance-duration="00:15:00" class="maintenance-quick-btn rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-extrabold">15m</button>
                            <button type="button" data-maintenance-duration="00:30:00" class="maintenance-quick-btn rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-extrabold">30m</button>
                            <button type="button" data-maintenance-duration="01:00:00" class="maintenance-quick-btn rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-extrabold">1h</button>
                            <button type="button" data-maintenance-duration="02:00:00" class="maintenance-quick-btn rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-extrabold">2h</button>
                        </div>
                        <div>
                            <label class="text-sm font-extrabold text-gray-700 dark:text-gray-200">Message for users</label>
                            <textarea id="maintenance-message-input" rows="3" maxlength="180" class="mt-2 w-full rounded-2xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500">${escapeHtml(message)}</textarea>
                        </div>
                        <div class="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 text-sm text-blue-800 dark:text-blue-100">
                            Users will see a full-screen maintenance page with countdown. Admin account will keep working normally.
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button id="maintenance-off-btn" class="rounded-2xl bg-gray-100 dark:bg-gray-700 px-4 py-4 font-extrabold text-gray-700 dark:text-gray-100">Turn Off</button>
                        <button id="maintenance-save-btn" class="rounded-2xl bg-blue-600 px-4 py-4 font-extrabold text-white shadow-lg shadow-blue-200 dark:shadow-none">${active ? 'Update Timer' : 'Start Maintenance'}</button>
                    </div>
                </div>
                ${getPageFooter()}`, { returnTo: parentSection, keepBottomNav: true, onBack: handleBack });

            const durationInput = document.getElementById('maintenance-duration-input');
            durationInput?.addEventListener('blur', () => {
                const seconds = parseMaintenanceDurationInput(durationInput.value);
                if (seconds) durationInput.value = formatMaintenanceDurationInput(seconds);
            });
            document.querySelectorAll('.maintenance-quick-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const input = document.getElementById('maintenance-duration-input');
                    if (input) input.value = button.dataset.maintenanceDuration || '00:30:00';
                });
            });
            document.getElementById('maintenance-off-btn')?.addEventListener('click', handleTurnOffMaintenance);
            document.getElementById('maintenance-save-btn')?.addEventListener('click', handleSaveMaintenanceSettings);
        };

        const handleSaveMaintenanceSettings = async () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const saveBtn = document.getElementById('maintenance-save-btn');
            const durationSeconds = parseMaintenanceDurationInput(document.getElementById('maintenance-duration-input')?.value || '');
            const message = String(document.getElementById('maintenance-message-input')?.value || '').trim()
                || 'We are improving your wallet experience. Please wait until the maintenance window is complete.';
            if (!durationSeconds) {
                return showNotification('Please enter time as HH:MM:SS between 00:01:00 and 72:00:00.', true);
            }
            try {
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Saving...';
                }
                const endDate = new Date(Date.now() + durationSeconds * 1000);
                await setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
                    maintenanceEnabled: true,
                    maintenanceEndsAt: Timestamp.fromDate(endDate),
                    maintenanceDurationSeconds: durationSeconds,
                    maintenanceMessage: message,
                    maintenanceUpdatedAt: serverTimestamp(),
                    maintenanceUpdatedBy: currentUser.uid
                }, { merge: true });
                showNotification('Maintenance mode started.');
                appConfigCache = {
                    ...appConfigCache,
                    maintenanceEnabled: true,
                    maintenanceEndsAt: Timestamp.fromDate(endDate),
                    maintenanceEndsAtMillis: endDate.getTime(),
                    maintenanceDurationSeconds: durationSeconds,
                    maintenanceMessage: message
                };
                rememberAppConfig(appConfigCache);
                applyMaintenanceMode();
                showMaintenanceSettingsPage();
            } catch (error) {
                console.error('Maintenance settings save failed:', error);
                showNotification('Could not save maintenance settings. Please try again.', true);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = isMaintenanceConfigActive(appConfigCache) ? 'Update Timer' : 'Start Maintenance';
                }
            }
        };

        const handleTurnOffMaintenance = async () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const offBtn = document.getElementById('maintenance-off-btn');
            try {
                if (offBtn) {
                    offBtn.disabled = true;
                    offBtn.textContent = 'Turning Off...';
                }
                await setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
                    maintenanceEnabled: false,
                    maintenanceEndsAt: null,
                    maintenanceUpdatedAt: serverTimestamp(),
                    maintenanceUpdatedBy: currentUser.uid
                }, { merge: true });
                appConfigCache = { ...appConfigCache, maintenanceEnabled: false, maintenanceEndsAt: null, maintenanceEndsAtMillis: 0 };
                rememberAppConfig(appConfigCache);
                applyMaintenanceMode();
                showNotification('Maintenance mode turned off.');
                showMaintenanceSettingsPage();
            } catch (error) {
                console.error('Maintenance off failed:', error);
                showNotification('Could not turn off maintenance mode. Please try again.', true);
            } finally {
                if (offBtn) {
                    offBtn.disabled = false;
                    offBtn.textContent = 'Turn Off';
                }
            }
        };

        const showWhatsNewSettingsPage = () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const parentSection = currentMainSection === 'admin' ? 'admin' : 'settings';
            const handleBack = parentSection === 'admin' ? showAdminMainPage : showSettingsPage;
            const enabled = appConfigCache.whatsNewEnabled !== false && appConfigCache.whats_new_enabled !== false;
            const title = appConfigCache.whatsNewTitle || appConfigCache.whats_new_title || "What's New";
            const message = appConfigCache.whatsNewMessage || appConfigCache.whats_new_message || '';
            const updatedMillis = timestampToMillis(appConfigCache.whatsNewUpdatedAt || appConfigCache.whats_new_updated_at || 0);
            const updatedText = updatedMillis ? new Date(updatedMillis).toLocaleString('en-IN') : 'Not sent yet';

            showPage(`
                ${getPageHeader("What's New")}
                <div class="mx-auto max-w-lg space-y-4">
                    <div class="rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-600 to-emerald-500 p-5 text-white shadow-xl">
                        <p class="text-xs font-black uppercase tracking-[0.25em] text-white/70">User Popup</p>
                        <h3 class="mt-2 text-2xl font-black">What's New Message</h3>
                        <p class="mt-2 text-sm text-white/75">Last update: ${escapeHtml(updatedText)}</p>
                    </div>
                    <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800">
                        <label class="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-black dark:bg-gray-700">
                            <span>Show popup to users</span>
                            <input id="whats-new-enabled-input" type="checkbox" ${enabled ? 'checked' : ''} class="h-5 w-5 accent-indigo-600">
                        </label>
                        <div class="mt-4">
                            <label class="text-sm font-black text-gray-700 dark:text-gray-200">Popup title</label>
                            <input id="whats-new-title-input" maxlength="80" value="${escapeHtml(title)}" class="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700">
                        </div>
                        <div class="mt-4">
                            <label class="text-sm font-black text-gray-700 dark:text-gray-200">Message</label>
                            <textarea id="whats-new-message-input" rows="7" maxlength="1200" placeholder="Type new update for users..." class="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700">${escapeHtml(message)}</textarea>
                            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Saving creates a new update ID, so every user will see it once. After they close it, it will not repeat until you save another update.</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button id="whats-new-disable-btn" class="rounded-2xl bg-gray-100 px-4 py-4 font-black text-gray-700 dark:bg-gray-700 dark:text-gray-100">Turn Off</button>
                        <button id="whats-new-save-btn" class="rounded-2xl bg-indigo-600 px-4 py-4 font-black text-white shadow-lg shadow-indigo-200 dark:shadow-none">Save & Show</button>
                    </div>
                </div>
                ${getPageFooter()}`, { returnTo: parentSection, keepBottomNav: true, onBack: handleBack });

            document.getElementById('whats-new-save-btn')?.addEventListener('click', handleSaveWhatsNewSettings);
            document.getElementById('whats-new-disable-btn')?.addEventListener('click', handleDisableWhatsNew);
        };

        const handleSaveWhatsNewSettings = async () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const saveBtn = document.getElementById('whats-new-save-btn');
            const title = String(document.getElementById('whats-new-title-input')?.value || '').trim() || "What's New";
            const message = String(document.getElementById('whats-new-message-input')?.value || '').trim();
            const enabled = !!document.getElementById('whats-new-enabled-input')?.checked;
            if (!message) return showNotification('Please type What\'s New message.', true);
            const whatsNewId = `wn-${Date.now()}`;
            try {
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Saving...';
                }
                await setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
                    whatsNewEnabled: enabled,
                    whatsNewTitle: title,
                    whatsNewMessage: message,
                    whatsNewId,
                    whatsNewUpdatedAt: serverTimestamp(),
                    whatsNewUpdatedBy: currentUser.uid
                }, { merge: true });
                appConfigCache = {
                    ...appConfigCache,
                    whatsNewEnabled: enabled,
                    whatsNewTitle: title,
                    whatsNewMessage: message,
                    whatsNewId,
                    whatsNewUpdatedAt: Date.now()
                };
                showNotification(enabled ? "What's New popup saved." : "What's New saved but turned off.");
                showWhatsNewSettingsPage();
            } catch (error) {
                console.error("What's New save failed:", error);
                showNotification("Could not save What's New message. Please try again.", true);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save & Show';
                }
            }
        };

        const handleDisableWhatsNew = async () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const offBtn = document.getElementById('whats-new-disable-btn');
            try {
                if (offBtn) {
                    offBtn.disabled = true;
                    offBtn.textContent = 'Turning Off...';
                }
                await setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
                    whatsNewEnabled: false,
                    whatsNewUpdatedAt: serverTimestamp(),
                    whatsNewUpdatedBy: currentUser.uid
                }, { merge: true });
                appConfigCache = { ...appConfigCache, whatsNewEnabled: false };
                closeWhatsNewPopup(false);
                showNotification("What's New popup turned off.");
                showWhatsNewSettingsPage();
            } catch (error) {
                console.error("What's New off failed:", error);
                showNotification("Could not turn off What's New popup. Please try again.", true);
            } finally {
                if (offBtn) {
                    offBtn.disabled = false;
                    offBtn.textContent = 'Turn Off';
                }
            }
        };

        const showHomeMainPage = () => {
            if (activeChatUnsubscribe) {
                activeChatUnsubscribe();
                activeChatUnsubscribe = null;
            }
            document.getElementById('dashboard-content').classList.remove('hidden');
            document.getElementById('page-container').classList.add('hidden');
            document.getElementById('page-container').innerHTML = '';
            setMainChrome(true);
            document.getElementById('app-footer')?.classList.add('app-footer-hidden');
            currentMainSection = 'home';
            switchTab('user-panel');
            setBottomNavActive('bottom-home-btn');
        };

        const showAdminMainPage = () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            if (activeChatUnsubscribe) {
                activeChatUnsubscribe();
                activeChatUnsubscribe = null;
            }
            document.getElementById('dashboard-content').classList.remove('hidden');
            document.getElementById('page-container').classList.add('hidden');
            document.getElementById('page-container').innerHTML = '';
            setMainChrome(true);
            document.getElementById('app-footer')?.classList.add('app-footer-hidden');
            currentMainSection = 'admin';
            switchTab('admin-panel');
            setBottomNavActive('bottom-admin-btn');
            updateAdminLoanRequestBadge();
        };

        const showUserTaskPageLegacy = () => {
            if (!currentUser) return showNotification('Please login first.', true);
            currentMainSection = 'task';
            const content = `
                <header class="mb-4 flex items-center justify-between bg-white dark:bg-gray-800 px-4 py-3 shadow-sm page-header-fixed">
                    <h2 class="text-base font-extrabold uppercase text-slate-950 dark:text-white">Task Mission</h2>
                    <span class="h-9 w-9 overflow-hidden rounded-full bg-slate-100 p-1 dark:bg-slate-700">
                        <img src="${RW_LOGO_URL}" alt="REVIEWS WORLD" class="h-full w-full rounded-full object-cover">
                    </span>
                </header>
                <div class="px-4 pt-1 pb-28">
                    <div class="mx-auto max-w-xl space-y-4">
                        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-gray-800">
                            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 p-3 shadow-lg">
                                <img src="https://cdn-icons-png.flaticon.com/512/3176/3176366.png" alt="Tasks" class="h-full w-full object-contain">
                            </div>
                            <p class="mt-5 text-xs font-extrabold uppercase text-blue-600">Coming Soon</p>
                            <h3 class="mt-2 text-2xl font-extrabold text-slate-950 dark:text-white">Live missions are being prepared</h3>
                            <p class="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">Task work will open here after admin makes it live.</p>
                        </section>

                        <section class="space-y-3 opacity-60">
                            <div class="flex items-center justify-between px-1">
                                <p class="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-300">Live Missions</p>
                                <span class="text-[11px] font-bold text-gray-400">0 available</span>
                            </div>
                            <label class="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <svg class="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"></path></svg>
                                <input type="search" disabled placeholder="Search app tasks..." class="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-500">
                            </label>
                            <div class="pointer-events-none rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-gray-900">
                                <div class="flex items-center gap-3">
                                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-400 dark:border-slate-700 dark:bg-gray-800">APP</span>
                                    <span class="min-w-0 flex-1">
                                        <span class="block text-sm font-extrabold text-slate-700 dark:text-slate-200">Sample Task</span>
                                        <span class="mt-1 inline-flex rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-300">Instant</span>
                                    </span>
                                    <span class="text-right">
                                        <span class="block text-[8px] font-extrabold uppercase text-slate-400">Reward</span>
                                        <span class="block text-lg font-extrabold text-slate-400">₹--</span>
                                    </span>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: currentUser?.uid === ADMIN_UID ? 'admin' : 'home', keepBottomNav: true });
            setBottomNavActive('bottom-task-btn');
        };

        const showUserTaskPage = () => {
            if (!currentUser) return showNotification('Please login first.', true);
            currentMainSection = 'task';
            const taskCategories = [
                {
                    label: 'App Review',
                    accent: 'task-accent-blue',
                    logo: 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png',
                    items: [
                        { title: 'App Review', reward: 'Rs 8' },
                        { title: 'App Review', reward: 'Rs 10' },
                        { title: 'App Review', reward: 'Rs 12' }
                    ]
                },
                {
                    label: 'Map Review',
                    accent: 'task-accent-emerald',
                    logo: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
                    items: [
                        { title: 'Map Review', reward: 'Rs 15' },
                        { title: 'Map Review', reward: 'Rs 20' },
                        { title: 'Map Review', reward: 'Rs 10' }
                    ]
                },
                {
                    label: 'Social Media Task',
                    accent: 'task-accent-rose',
                    logo: 'https://cdn-icons-png.flaticon.com/512/4187/4187336.png',
                    items: [
                        { title: 'Social Task', reward: 'Rs 5' },
                        { title: 'Social Task', reward: 'Rs 8' },
                        { title: 'Social Task', reward: 'Rs 7' }
                    ]
                }
            ];
            const renderTaskCard = (category, task, index) => `
                <article class="task-preview-card" style="--task-card-delay:${index * 90}ms" aria-disabled="true">
                    <div class="task-card-main">
                        <span class="task-card-logo">
                            <img src="${escapeHtml(category.logo)}" alt="${escapeHtml(category.label)}" loading="lazy" decoding="async">
                        </span>
                        <span class="task-rate-pill">${escapeHtml(task.reward)}</span>
                        <h4>${escapeHtml(task.title)}</h4>
                    </div>
                    <div class="task-card-coming">Coming Soon</div>
                </article>`;
            const renderCategory = (category) => `
                <section class="task-category-block ${category.accent}">
                    <div class="task-category-title">
                        <span class="task-category-mark"></span>
                        <h3>${escapeHtml(category.label)}</h3>
                    </div>
                    <div class="task-preview-rail">
                        ${category.items.map((task, index) => renderTaskCard(category, task, index)).join('')}
                    </div>
                </section>`;
            const content = `
                <header class="mb-4 bg-white/95 px-4 py-3 shadow-sm backdrop-blur page-header-fixed dark:bg-gray-900/95">
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-lg font-black uppercase text-slate-950 dark:text-white">RW TASK</p>
                        </div>
                        <div class="task-header-actions">
                            <button type="button" data-action="open-task-ads-page" class="task-mini-action">
                                <img src="https://cdn-icons-png.flaticon.com/512/2659/2659360.png" alt="Ads" loading="eager" decoding="async">
                                <span>Ads</span>
                            </button>
                            <button type="button" data-action="open-task-bonus-page" class="task-mini-action">
                                <img src="https://cdn-icons-png.flaticon.com/512/2611/2611152.png" alt="Bonus" loading="eager" decoding="async">
                                <span>Bonus</span>
                            </button>
                        </div>
                    </div>
                </header>
                <div class="task-page-shell px-4 pt-1 pb-28">
                    <div class="mx-auto max-w-4xl space-y-4">
                        ${taskCategories.map(renderCategory).join('')}
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: currentUser?.uid === ADMIN_UID ? 'admin' : 'home', keepBottomNav: true });
            setBottomNavActive('bottom-task-btn');
        };

        const showTaskFeatureComingSoonPage = (feature = 'ads') => {
            const isAds = feature === 'ads';
            const title = isAds ? 'Watch Ads & Earn' : 'Daily Bonus';
            const icon = isAds
                ? 'https://cdn-icons-png.flaticon.com/512/2659/2659360.png'
                : 'https://cdn-icons-png.flaticon.com/512/2611/2611152.png';
            const headline = isAds
                ? 'Earn from watching banner Ads, videos ads.'
                : 'Claim daily bonus, spin wheel and earn money upto 5 rupees.';
            const content = `
                ${getPageHeader(title)}
                <div class="mx-auto max-w-md pb-24">
                    <section class="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 text-center shadow-xl dark:border-slate-700 dark:bg-gray-800">
                        <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 shadow-inner dark:bg-gray-900">
                            <img src="${icon}" alt="${title}" class="h-12 w-12 object-contain" loading="eager" decoding="async">
                        </div>
                        <p class="mt-5 text-[10px] font-black uppercase text-blue-600 dark:text-blue-300">Coming Soon</p>
                        <h3 class="mt-2 text-2xl font-black leading-tight text-slate-950 dark:text-white">${headline}</h3>
                        <div class="mt-5 rounded-2xl bg-blue-50 px-4 py-4 text-sm font-bold leading-6 text-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
                            This feature is not available yet. It will be announced soon...
                        </div>
                    </section>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: 'task', keepBottomNav: true, onBack: showUserTaskPage });
            setBottomNavActive('bottom-task-btn');
        };

        const showUserTaskDetailsPage = (taskId) => {
            const task = allTasksCache.find(item => item.id === taskId);
            if (!task) return showNotification('Task not found. Please refresh tasks.', true);
            const reward = task.rate || task.reward || 0;
            const taskTitle = task.title || 'Task Mission';
            const appName = task.appName || taskTitle;
            const reviewText = task.reviewText || task.copyText || task.instructions || 'good app';
            const taskLink = task.taskLink || task.link || task.url || '';
            const image = task.imageUrl || task.logoUrl || task.iconUrl || 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png';
            const content = `
                <header class="mb-4 flex items-center justify-between bg-white dark:bg-gray-800 px-4 py-3 shadow-sm page-header-fixed">
                    <div class="flex items-center gap-3">
                        <button class="page-back-btn rounded-full p-2 text-slate-900 dark:text-white">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5m7 7-7-7 7-7"></path></svg>
                        </button>
                        <h2 class="text-base font-black uppercase text-slate-950 dark:text-white">Task Mission</h2>
                    </div>
                    <span class="h-9 w-9 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <img src="${escapeHtml(image)}" alt="${escapeHtml(appName)}" class="h-full w-full object-cover" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3176/3176366.png'">
                    </span>
                </header>
                <div class="px-5 pb-28">
                    <div class="mx-auto max-w-xl space-y-5">
                        <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                            <div class="flex items-center gap-3">
                                <span class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-white">
                                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 2m6-2A9 9 0 1 1 3 12a9 9 0 0 1 18 0z"></path></svg>
                                </span>
                                <div>
                                    <p class="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Session Timer</p>
                                    <p id="task-session-timer" class="text-lg font-black text-slate-950 dark:text-white">4:40</p>
                                </div>
                            </div>
                        </section>
                        <section class="overflow-hidden rounded-[1.75rem] border-t-4 border-slate-950 bg-white shadow-xl dark:border-white dark:bg-gray-800">
                            <div class="flex items-start justify-between bg-slate-50 p-5 dark:bg-slate-900">
                                <div>
                                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-950 dark:text-white">${escapeHtml(task.category || 'Active App Review')}</p>
                                    <h3 class="mt-2 text-lg font-black text-slate-950 dark:text-white">${escapeHtml(appName)}</h3>
                                    <span class="mt-1 inline-flex rounded bg-white px-2 py-0.5 text-[9px] font-black uppercase text-slate-600 shadow-sm dark:bg-slate-700 dark:text-white">Instant</span>
                                </div>
                                <div class="rounded-2xl bg-slate-950 px-5 py-3 text-center text-white shadow-lg">
                                    <p class="text-[8px] font-black uppercase text-white/60">Reward</p>
                                    <p class="text-xl font-black">${formatCurrency(reward).replace('.00', '')}</p>
                                </div>
                            </div>
                            <div class="space-y-5 p-5">
                                <div>
                                    <p class="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><span class="mr-2 rounded-full bg-slate-100 px-2 py-1">1</span> Get App</p>
                                    <button id="task-download-btn" class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-950 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4m-1-9h-6m6 0v6m0-6L10 12"></path></svg>
                                        Download Application
                                    </button>
                                </div>
                                <div>
                                    <p class="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><span class="mr-2 rounded-full bg-slate-100 px-2 py-1">2</span> Copy & Review</p>
                                    <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-900">
                                        <p class="mb-4 text-sm font-bold italic text-slate-950 dark:text-white">"${escapeHtml(reviewText)}"</p>
                                        <button id="task-copy-review-btn" class="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-wide text-white">
                                            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16h8M8 12h8m-7 8h6a2 2 0 0 0 2-2V7l-5-5H9a2 2 0 0 0-2 2v16z"></path></svg>
                                            Copy Review
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <p class="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500"><span class="mr-2 rounded-full bg-slate-100 px-2 py-1">3</span> Upload Proof</p>
                                    <label class="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-900">
                                        <input id="task-proof-input" type="file" accept="image/*" class="hidden">
                                        <svg class="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path></svg>
                                        <span id="task-proof-label" class="mt-2 text-[10px] font-black uppercase text-slate-600 dark:text-slate-200">Select Screenshot</span>
                                        <span class="text-[10px] text-slate-400">Duplicate screenshots will be detected</span>
                                    </label>
                                </div>
                                <button id="task-submit-mission-btn" class="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-4 text-sm font-black uppercase tracking-wide text-white disabled:bg-slate-400" disabled>Submit Mission</button>
                            </div>
                        </section>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: 'task', keepBottomNav: true, onBack: showUserTaskPage });
            setBottomNavActive('bottom-task-btn');
            const downloadBtn = document.getElementById('task-download-btn');
            downloadBtn.onclick = () => taskLink ? window.open(taskLink, '_blank', 'noopener') : showNotification('Task link is not added yet.', true);
            document.getElementById('task-copy-review-btn').onclick = async () => {
                try {
                    await navigator.clipboard.writeText(reviewText);
                    showNotification('Review copied.');
                } catch {
                    showNotification('Copy failed. Please copy manually.', true);
                }
            };
            document.getElementById('task-proof-input').onchange = (event) => {
                const file = event.target.files?.[0];
                document.getElementById('task-proof-label').textContent = file ? file.name : 'Select Screenshot';
                document.getElementById('task-submit-mission-btn').disabled = !file;
            };
            document.getElementById('task-submit-mission-btn').onclick = async () => {
                const file = document.getElementById('task-proof-input')?.files?.[0];
                if (!file) return showNotification('Please select screenshot proof first.', true);
                try {
                    await addDoc(collection(db, `artifacts/${appId}/public/data/task_submissions`), {
                        taskId: task.id,
                        taskTitle,
                        userId: currentUser.uid,
                        userName: currentUserData?.name || currentUser.email || 'User',
                        userMobile: currentUserData?.mobile || '',
                        reward: Number(reward || 0),
                        proofFileName: file.name,
                        proofFileSize: file.size,
                        status: 'pending',
                        submittedAt: serverTimestamp()
                    });
                    showNotification('Mission submitted for admin review.');
                    showUserTaskPage();
                } catch (error) {
                    console.error('Task submission failed:', error);
                    showNotification('Could not submit mission. Please contact admin.', true);
                }
            };
        };

        const setAdminTaskPanel = (panel = 'manage') => {
            const normalized = panel === 'add' ? 'add' : 'manage';
            window.adminTaskPanel = normalized;
            const addSection = document.getElementById('admin-task-add-section');
            const manageSection = document.getElementById('admin-task-manage-section');
            if (addSection) addSection.classList.toggle('hidden', normalized !== 'add');
            if (manageSection) manageSection.classList.toggle('hidden', normalized !== 'manage');
            document.querySelectorAll('[data-admin-task-panel]').forEach(button => {
                const isActive = button.dataset.adminTaskPanel === normalized;
                button.classList.toggle('bg-cyan-600', isActive);
                button.classList.toggle('text-white', isActive);
                button.classList.toggle('shadow-md', isActive);
                button.classList.toggle('bg-white', !isActive);
                button.classList.toggle('text-gray-700', !isActive);
                button.classList.toggle('dark:bg-gray-800', !isActive);
                button.classList.toggle('dark:text-gray-200', !isActive);
            });
        };

        const showAdminTaskPage = () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            currentMainSection = 'admin';
            const content = `
                ${getPageHeader('Manage Task')}
                <div class="pb-24">
                <div class="max-w-5xl mx-auto space-y-4 sm:space-y-5">
                    <section class="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-cyan-900 to-emerald-700 p-5 text-white shadow-xl">
                        <p class="text-[10px] font-black uppercase text-white/60">Admin Control</p>
                        <div class="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h3 class="text-2xl font-black">Manage Task Board</h3>
                                <p class="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/70">Add task, choose category, rate, proof type, status and limit from here only. User Task page stays separate.</p>
                            </div>
                            <div class="grid grid-cols-3 gap-2 text-center text-xs">
                                <div class="rounded-2xl bg-white/12 px-4 py-3">
                                    <p class="font-black text-white" id="admin-task-total-count">0</p>
                                    <p class="text-white/60">Total</p>
                                </div>
                                <div class="rounded-2xl bg-white/12 px-4 py-3">
                                    <p class="font-black text-emerald-200" id="admin-task-active-count">0</p>
                                    <p class="text-white/60">Active</p>
                                </div>
                                <div class="rounded-2xl bg-white/12 px-4 py-3">
                                    <p class="font-black text-amber-200" id="admin-task-draft-count">0</p>
                                    <p class="text-white/60">Draft</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div class="grid grid-cols-2 gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                        <button type="button" data-admin-task-panel="manage" class="rounded-xl px-3 py-3 text-sm font-black transition">Managing Tasks</button>
                        <button type="button" data-admin-task-panel="add" class="rounded-xl px-3 py-3 text-sm font-black transition">Add New Task</button>
                    </div>

                    <section id="admin-task-add-section" class="hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <div>
                                <h3 class="text-lg font-black text-gray-900 dark:text-white">Add New Task</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Create earning tasks with category, rate, proof, and status.</p>
                            </div>
                        </div>

                        <form id="admin-task-form" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input type="hidden" id="admin-task-edit-id" value="">
                            <div class="sm:col-span-2">
                                <label class="text-xs font-black uppercase text-gray-400">Task Title</label>
                                <input id="admin-task-title" placeholder="Example: Install app and submit screenshot" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Category</label>
                                <select id="admin-task-category" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                    <option value="App Review Task">App Review Task</option>
                                    <option value="Map Review">Map Review</option>
                                    <option value="Social Media Task">Social Media Task</option>
                                    <option value="Watch Ads & Earn">Watch Ads & Earn</option>
                                    <option value="Daily Bonus">Daily Bonus</option>
                                    <option value="Instant Payment Task">Instant Payment Task</option>
                                    <option value="Review Task">Review Task</option>
                                    <option value="App Install">App Install</option>
                                    <option value="Map Review">Map Review</option>
                                    <option value="Like Comment">Like Comment</option>
                                    <option value="Signup Task">Signup Task</option>
                                    <option value="Survey">Survey</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Rate / Reward</label>
                                <input id="admin-task-rate" type="number" min="0" step="1" placeholder="Amount in rupees" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Task Limit</label>
                                <input id="admin-task-limit" type="number" min="1" step="1" placeholder="Total slots" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Status</label>
                                <select id="admin-task-status" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                    <option value="active">Active</option>
                                    <option value="draft">Draft</option>
                                    <option value="paused">Paused</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Proof Required</label>
                                <select id="admin-task-proof" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                    <option value="Screenshot">Screenshot</option>
                                    <option value="Link">Link</option>
                                    <option value="Screenshot + Link">Screenshot + Link</option>
                                    <option value="Text Proof">Text Proof</option>
                                    <option value="No Proof">No Proof</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Priority</label>
                                <select id="admin-task-priority" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                            <div class="sm:col-span-2">
                                <label class="text-xs font-black uppercase text-gray-400">Task Link</label>
                                <input id="admin-task-link" placeholder="https://..." class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            </div>
                            <div class="sm:col-span-2">
                                <label class="text-xs font-black uppercase text-gray-400">Instructions</label>
                                <textarea id="admin-task-instructions" rows="4" placeholder="Write exact steps users must follow..." class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"></textarea>
                            </div>
                            <div class="sm:col-span-2 flex flex-col sm:flex-row gap-2">
                                <button type="submit" id="admin-task-save-btn" class="flex-1 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white hover:bg-cyan-700 transition">Add Task</button>
                                <button type="button" id="admin-task-reset-btn" class="rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 text-sm font-black text-gray-700 dark:text-gray-200">Clear</button>
                            </div>
                        </form>
                    </section>

                    <section id="admin-task-manage-section" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <h3 class="text-lg font-black text-gray-900 dark:text-white">Managing Tasks</h3>
                            <div class="flex gap-2">
                                <input id="admin-task-search" placeholder="Search task..." class="min-w-0 flex-1 sm:w-64 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                <select id="admin-task-filter" class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                    <option value="all">All</option>
                                    <option value="active">Active</option>
                                    <option value="draft">Draft</option>
                                    <option value="paused">Paused</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>
                        </div>
                        <div id="admin-task-list" class="space-y-3 max-h-[72vh] overflow-y-auto"></div>
                    </section>
                </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: 'admin', keepBottomNav: true });
            setBottomNavActive('bottom-admin-btn');
            document.querySelectorAll('[data-admin-task-panel]').forEach(button => {
                button.addEventListener('click', () => setAdminTaskPanel(button.dataset.adminTaskPanel));
            });
            setAdminTaskPanel(window.adminTaskPanel || 'manage');
            document.getElementById('admin-task-form')?.addEventListener('submit', handleSaveAdminTask);
            document.getElementById('admin-task-reset-btn')?.addEventListener('click', resetAdminTaskForm);
            document.getElementById('admin-task-search')?.addEventListener('input', renderAdminTaskList);
            document.getElementById('admin-task-filter')?.addEventListener('change', renderAdminTaskList);
            renderAdminTaskList();
            getDocs(query(collection(db, `artifacts/${appId}/public/data/tasks`), orderBy("createdAt", "desc")))
                .then(snapshot => applyAdminTasksSnapshot(snapshot.docs))
                .catch(error => console.warn('Task refresh skipped:', error));
        };

        const getAdminTaskFormData = () => {
            const title = document.getElementById('admin-task-title')?.value.trim() || '';
            const rate = Number(document.getElementById('admin-task-rate')?.value || 0);
            const limitValue = Number(document.getElementById('admin-task-limit')?.value || 0);
            return {
                title,
                category: document.getElementById('admin-task-category')?.value || 'Other',
                rate,
                reward: rate,
                limit: Number.isFinite(limitValue) && limitValue > 0 ? limitValue : null,
                status: document.getElementById('admin-task-status')?.value || 'active',
                proofRequired: document.getElementById('admin-task-proof')?.value || 'Screenshot',
                priority: document.getElementById('admin-task-priority')?.value || 'normal',
                taskLink: document.getElementById('admin-task-link')?.value.trim() || '',
                instructions: document.getElementById('admin-task-instructions')?.value.trim() || ''
            };
        };

        const resetAdminTaskForm = () => {
            document.getElementById('admin-task-form')?.reset();
            const editId = document.getElementById('admin-task-edit-id');
            if (editId) editId.value = '';
            const saveBtn = document.getElementById('admin-task-save-btn');
            if (saveBtn) saveBtn.textContent = 'Add Task';
        };

        const handleSaveAdminTask = async (event) => {
            event.preventDefault();
            if (currentUser?.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const saveBtn = document.getElementById('admin-task-save-btn');
            const editId = document.getElementById('admin-task-edit-id')?.value || '';
            const payload = getAdminTaskFormData();
            if (!payload.title) return showNotification('Please enter task title.', true);
            if (!Number.isFinite(payload.rate) || payload.rate <= 0) return showNotification('Please enter a valid task rate.', true);
            if (!payload.instructions) return showNotification('Please add task instructions.', true);
            if (payload.taskLink && !/^https?:\/\//i.test(payload.taskLink)) return showNotification('Task link must start with http:// or https://', true);

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = editId ? 'Updating...' : 'Adding...';
            }
            try {
                if (editId) {
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/tasks`, editId), {
                        ...payload,
                        updatedAt: serverTimestamp(),
                        updatedBy: currentUser.uid
                    });
                    allTasksCache = allTasksCache.map(task => task.id === editId ? { ...task, ...payload, updatedAt: Date.now() } : task);
                    showNotification('Task updated.');
                } else {
                    const taskRef = doc(collection(db, `artifacts/${appId}/public/data/tasks`));
                    const task = {
                        id: taskRef.id,
                        ...payload,
                        submissions: 0,
                        completed: 0,
                        createdAt: Date.now(),
                        createdBy: currentUser.uid
                    };
                    allTasksCache = [task, ...allTasksCache];
                    renderAdminTaskList();
                    await setDoc(taskRef, {
                        ...payload,
                        submissions: 0,
                        completed: 0,
                        createdAt: serverTimestamp(),
                        createdBy: currentUser.uid
                    });
                    showNotification('Task added.');
                }
                resetAdminTaskForm();
                renderAdminTaskList();
                setAdminTaskPanel('manage');
            } catch (error) {
                console.error('Task save failed:', error);
                showNotification(`Could not save task: ${error.message}`, true);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = document.getElementById('admin-task-edit-id')?.value ? 'Update Task' : 'Add Task';
                }
            }
        };

        const editAdminTask = (taskId) => {
            const task = allTasksCache.find(item => item.id === taskId);
            if (!task) return;
            document.getElementById('admin-task-edit-id').value = task.id;
            document.getElementById('admin-task-title').value = task.title || '';
            document.getElementById('admin-task-category').value = task.category || 'Other';
            document.getElementById('admin-task-rate').value = task.rate || task.reward || '';
            document.getElementById('admin-task-limit').value = task.limit || '';
            document.getElementById('admin-task-status').value = task.status || 'active';
            document.getElementById('admin-task-proof').value = task.proofRequired || 'Screenshot';
            document.getElementById('admin-task-priority').value = task.priority || 'normal';
            document.getElementById('admin-task-link').value = task.taskLink || '';
            document.getElementById('admin-task-instructions').value = task.instructions || '';
            document.getElementById('admin-task-save-btn').textContent = 'Update Task';
            setAdminTaskPanel('add');
            document.getElementById('admin-task-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

        const handleToggleAdminTaskStatus = async (taskId) => {
            const task = allTasksCache.find(item => item.id === taskId);
            if (!task) return;
            const nextStatus = task.status === 'active' ? 'paused' : 'active';
            allTasksCache = allTasksCache.map(item => item.id === taskId ? { ...item, status: nextStatus } : item);
            renderAdminTaskList();
            try {
                await updateDoc(doc(db, `artifacts/${appId}/public/data/tasks`, taskId), {
                    status: nextStatus,
                    updatedAt: serverTimestamp(),
                    updatedBy: currentUser.uid
                });
                showNotification(nextStatus === 'active' ? 'Task activated.' : 'Task paused.');
            } catch (error) {
                console.error('Task status update failed:', error);
                showNotification(`Could not update task: ${error.message}`, true);
            }
        };

        const handleDeleteAdminTask = async (taskId) => {
            const task = allTasksCache.find(item => item.id === taskId);
            if (!task) return;
            renderModal('Delete Task',
                `<p class="text-sm text-gray-600 dark:text-gray-300">Delete <strong>${escapeHtml(task.title || 'this task')}</strong>? This removes it from the manage task list.</p>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-delete-admin-task-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Delete</button>`);
            document.getElementById('confirm-delete-admin-task-btn').onclick = async () => {
                try {
                    allTasksCache = allTasksCache.filter(item => item.id !== taskId);
                    renderAdminTaskList();
                    window.closeModal();
                    await deleteDoc(doc(db, `artifacts/${appId}/public/data/tasks`, taskId));
                    showNotification('Task deleted.');
                } catch (error) {
                    console.error('Task delete failed:', error);
                    showNotification(`Could not delete task: ${error.message}`, true);
                }
            };
        };

        const renderAdminTaskList = () => {
            const listEl = document.getElementById('admin-task-list');
            if (!listEl) return;
            const search = (document.getElementById('admin-task-search')?.value || '').trim().toLowerCase();
            const filter = document.getElementById('admin-task-filter')?.value || 'all';
            const tasks = [...allTasksCache].filter(task => {
                const status = task.status || 'active';
                if (filter !== 'all' && status !== filter) return false;
                if (!search) return true;
                return [task.title, task.category, task.instructions, task.proofRequired, task.status]
                    .some(value => String(value || '').toLowerCase().includes(search));
            });
            const activeCount = allTasksCache.filter(task => (task.status || 'active') === 'active').length;
            const draftCount = allTasksCache.filter(task => (task.status || 'active') === 'draft').length;
            const totalEl = document.getElementById('admin-task-total-count');
            const activeEl = document.getElementById('admin-task-active-count');
            const draftEl = document.getElementById('admin-task-draft-count');
            if (totalEl) totalEl.textContent = allTasksCache.length;
            if (activeEl) activeEl.textContent = activeCount;
            if (draftEl) draftEl.textContent = draftCount;

            if (!tasks.length && !allTasksCache.length) {
                listEl.innerHTML = `
                    <div class="space-y-3">
                        <div class="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
                            No task added yet. The faded missions below are preview only and are not clickable.
                        </div>
                        ${[
                            { title: 'PopClub', category: 'Active App Review', rate: '₹8', image: 'Pop' },
                            { title: 'Map Review Work', category: 'Review Task', rate: '₹12', image: 'Map' },
                            { title: 'App Install Mission', category: 'Instant Payment Task', rate: '₹10', image: 'App' }
                        ].map(item => `
                            <div class="pointer-events-none rounded-2xl border border-slate-100 bg-slate-50 p-4 opacity-55 dark:border-slate-700 dark:bg-gray-900">
                                <div class="flex items-center gap-3">
                                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-400 dark:border-slate-700 dark:bg-gray-800">${item.image}</span>
                                    <span class="min-w-0 flex-1">
                                        <span class="block truncate text-sm font-extrabold text-slate-700 dark:text-slate-200">${item.title}</span>
                                        <span class="mt-1 inline-flex rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-300">${item.category}</span>
                                    </span>
                                    <span class="text-right">
                                        <span class="block text-[8px] font-extrabold uppercase text-slate-400">Reward</span>
                                        <span class="block text-lg font-extrabold text-slate-500 dark:text-slate-300">${item.rate}</span>
                                    </span>
                                </div>
                            </div>
                        `).join('')}
                    </div>`;
                return;
            }

            listEl.innerHTML = tasks.length ? tasks.map(task => {
                const status = task.status || 'active';
                const statusClass = {
                    active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
                    draft: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
                    paused: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
                    closed: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                }[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
                return `
                    <div class="rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
                        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="rounded-full bg-cyan-50 dark:bg-cyan-900/30 px-2.5 py-1 text-[11px] font-black text-cyan-700 dark:text-cyan-200">${escapeHtml(task.category || 'Other')}</span>
                                    <span class="rounded-full ${statusClass} px-2.5 py-1 text-[11px] font-black">${escapeHtml(status)}</span>
                                    <span class="rounded-full bg-white dark:bg-gray-800 px-2.5 py-1 text-[11px] font-black text-gray-500 dark:text-gray-300">${escapeHtml(task.proofRequired || 'Screenshot')}</span>
                                </div>
                                <h4 class="mt-2 text-base font-black leading-snug text-gray-900 dark:text-white">${escapeHtml(task.title || 'Untitled Task')}</h4>
                                <p class="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">${escapeHtml(task.instructions || 'No instructions added.')}</p>
                                ${task.taskLink ? `<p class="mt-2 truncate text-xs font-bold text-blue-600 dark:text-blue-300">${escapeHtml(task.taskLink)}</p>` : ''}
                            </div>
                            <div class="shrink-0 sm:text-right">
                                <p class="text-xs font-bold text-gray-400">Rate</p>
                                <p class="text-xl font-black text-emerald-600 dark:text-emerald-300">${formatCurrency(task.rate || task.reward || 0)}</p>
                                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Limit: ${task.limit || 'Open'} | Priority: ${escapeHtml(task.priority || 'normal')}</p>
                            </div>
                        </div>
                        <div class="mt-4 flex flex-wrap gap-2">
                            <button data-action="edit-admin-task" data-taskid="${task.id}" class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-slate-900">Edit</button>
                            <button data-action="toggle-admin-task-status" data-taskid="${task.id}" class="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-black text-white">${status === 'active' ? 'Pause' : 'Activate'}</button>
                            <button data-action="delete-admin-task" data-taskid="${task.id}" class="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-600 dark:bg-red-900/30 dark:text-red-200">Delete</button>
                        </div>
                    </div>`;
            }).join('') : '<p class="rounded-2xl border border-dashed border-gray-200 py-8 text-center text-sm font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">No matching task found.</p>';
        };

        const showAdminAdsPage = () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            currentMainSection = 'admin';
            const content = `
                ${getPageHeader('Manage Ads')}
                <div class="max-w-5xl mx-auto space-y-4 pb-24">
                    <section class="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm">
                        <div class="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h3 class="text-lg font-black">Add Advertisement</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Paste image link or YouTube link. Users see it instantly in the home carousel.</p>
                            </div>
                            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-50 text-2xl font-black text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-200">+</span>
                        </div>
                        <form id="admin-ad-form" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input type="hidden" id="admin-ad-edit-id" value="">
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Ad Title</label>
                                <input id="admin-ad-title" placeholder="Ad title" class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Type</label>
                                <select id="admin-ad-type" class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                                    <option value="auto">Auto detect</option>
                                    <option value="image">Image / Banner</option>
                                    <option value="youtube">YouTube Video</option>
                                </select>
                            </div>
                            <div class="sm:col-span-2">
                                <label class="text-xs font-black uppercase text-gray-400">Image / YouTube Link</label>
                                <input id="admin-ad-media-url" placeholder="https://..." class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                            </div>
                            <div class="sm:col-span-2">
                                <label class="text-xs font-black uppercase text-gray-400">Subtitle</label>
                                <input id="admin-ad-subtitle" placeholder="Small text shown on ad" class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Order</label>
                                <input id="admin-ad-order" type="number" min="0" step="1" value="0" class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Status</label>
                                <select id="admin-ad-status" class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                                    <option value="active">Active</option>
                                    <option value="paused">Paused</option>
                                </select>
                            </div>
                            <div class="sm:col-span-2 flex flex-col sm:flex-row gap-2">
                                <button id="admin-ad-save-btn" type="submit" class="flex-1 rounded-xl bg-fuchsia-600 px-4 py-3 text-sm font-black text-white hover:bg-fuchsia-700 transition">Add Ad</button>
                                <button id="admin-ad-reset-btn" type="button" class="rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 text-sm font-black text-gray-700 dark:text-gray-200">Clear</button>
                            </div>
                        </form>
                    </section>
                    <section class="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm">
                        <div class="mb-4 flex items-center justify-between">
                            <h3 class="text-lg font-black">Active Ads</h3>
                            <span id="admin-ads-count" class="text-xs font-bold text-gray-400">0 ads</span>
                        </div>
                        <div id="admin-ads-list" class="space-y-3"></div>
                    </section>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: 'admin', keepBottomNav: true });
            setBottomNavActive('bottom-admin-btn');
            document.getElementById('admin-ad-form')?.addEventListener('submit', handleSaveAdminAd);
            document.getElementById('admin-ad-reset-btn')?.addEventListener('click', resetAdminAdForm);
            renderAdminAdsList();
            getDocs(query(collection(db, `artifacts/${appId}/public/data/ads`), orderBy("createdAt", "desc")))
                .then(snapshot => applyAdsSnapshot(snapshot.docs))
                .catch(error => console.warn('Ads refresh skipped:', error));
        };

        const resetAdminAdForm = () => {
            document.getElementById('admin-ad-form')?.reset();
            const editId = document.getElementById('admin-ad-edit-id');
            if (editId) editId.value = '';
            const saveBtn = document.getElementById('admin-ad-save-btn');
            if (saveBtn) saveBtn.textContent = 'Add Ad';
        };

        const getAdminAdPayload = () => {
            const title = document.getElementById('admin-ad-title')?.value.trim() || '';
            const mediaUrl = document.getElementById('admin-ad-media-url')?.value.trim() || '';
            const typeValue = document.getElementById('admin-ad-type')?.value || 'auto';
            return {
                title,
                subtitle: document.getElementById('admin-ad-subtitle')?.value.trim() || '',
                mediaUrl,
                type: typeValue === 'auto' ? (getYoutubeEmbedUrl(mediaUrl) ? 'youtube' : 'image') : typeValue,
                order: Number(document.getElementById('admin-ad-order')?.value || 0),
                status: document.getElementById('admin-ad-status')?.value || 'active'
            };
        };

        const handleSaveAdminAd = async (event) => {
            event.preventDefault();
            if (currentUser?.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const editId = document.getElementById('admin-ad-edit-id')?.value || '';
            const payload = getAdminAdPayload();
            if (!payload.title) return showNotification('Please enter ad title.', true);
            if (!/^https?:\/\//i.test(payload.mediaUrl)) return showNotification('Please paste a valid image or YouTube link.', true);
            const saveBtn = document.getElementById('admin-ad-save-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = editId ? 'Updating...' : 'Adding...';
            }
            try {
                if (editId) {
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/ads`, editId), {
                        ...payload,
                        updatedAt: serverTimestamp(),
                        updatedBy: currentUser.uid
                    });
                    allAdsCache = allAdsCache.map(ad => ad.id === editId ? { ...ad, ...payload } : ad);
                    showNotification('Ad updated.');
                } else {
                    const adRef = doc(collection(db, `artifacts/${appId}/public/data/ads`));
                    allAdsCache = [{ id: adRef.id, ...payload, createdAt: Date.now(), createdBy: currentUser.uid }, ...allAdsCache];
                    renderAdminAdsList();
                    renderHomeAdsCarousel();
                    await setDoc(adRef, {
                        ...payload,
                        createdAt: serverTimestamp(),
                        createdBy: currentUser.uid
                    });
                    showNotification('Ad added.');
                }
                resetAdminAdForm();
                renderAdminAdsList();
                renderHomeAdsCarousel();
            } catch (error) {
                console.error('Ad save failed:', error);
                showNotification(`Could not save ad: ${error.message}`, true);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = document.getElementById('admin-ad-edit-id')?.value ? 'Update Ad' : 'Add Ad';
                }
            }
        };

        const editAdminAd = (adId) => {
            const ad = allAdsCache.find(item => item.id === adId);
            if (!ad) return;
            document.getElementById('admin-ad-edit-id').value = ad.id;
            document.getElementById('admin-ad-title').value = ad.title || '';
            document.getElementById('admin-ad-type').value = ad.type || 'auto';
            document.getElementById('admin-ad-media-url').value = getAdMediaUrl(ad);
            document.getElementById('admin-ad-subtitle').value = ad.subtitle || '';
            document.getElementById('admin-ad-order').value = ad.order || 0;
            document.getElementById('admin-ad-status').value = ad.status || 'active';
            document.getElementById('admin-ad-save-btn').textContent = 'Update Ad';
            document.getElementById('admin-ad-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

        const handleDeleteAdminAd = async (adId) => {
            const ad = allAdsCache.find(item => item.id === adId);
            if (!ad) return;
            renderModal('Delete Ad',
                `<p class="text-sm text-gray-600 dark:text-gray-300">Delete <strong>${escapeHtml(ad.title || 'this ad')}</strong>?</p>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-delete-admin-ad-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Delete</button>`);
            document.getElementById('confirm-delete-admin-ad-btn').onclick = async () => {
                try {
                    allAdsCache = allAdsCache.filter(item => item.id !== adId);
                    renderAdminAdsList();
                    renderHomeAdsCarousel();
                    window.closeModal();
                    await deleteDoc(doc(db, `artifacts/${appId}/public/data/ads`, adId));
                    showNotification('Ad deleted.');
                } catch (error) {
                    console.error('Ad delete failed:', error);
                    showNotification(`Could not delete ad: ${error.message}`, true);
                }
            };
        };

        const renderAdminAdsList = () => {
            const listEl = document.getElementById('admin-ads-list');
            if (!listEl) return;
            const countEl = document.getElementById('admin-ads-count');
            if (countEl) countEl.textContent = `${allAdsCache.length} ad${allAdsCache.length === 1 ? '' : 's'}`;
            listEl.innerHTML = allAdsCache.length ? allAdsCache.map(ad => {
                const mediaUrl = getAdMediaUrl(ad);
                const isYoutube = getAdType(ad) === 'youtube';
                return `
                    <div class="rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
                        <div class="flex gap-3">
                            <div class="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-white dark:border-gray-700 bg-gray-950">
                                ${isYoutube ? `<div class="flex h-full w-full items-center justify-center bg-red-600 text-xs font-black text-white">YouTube</div>` : `<img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(ad.title || 'Ad')}" class="h-full w-full object-cover">`}
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-black text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-200">${escapeHtml(ad.type || 'image')}</span>
                                    <span class="rounded-full ${ad.status === 'paused' ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'} px-2 py-0.5 text-[10px] font-black">${escapeHtml(ad.status || 'active')}</span>
                                </div>
                                <h4 class="mt-1 truncate text-sm font-black">${escapeHtml(ad.title || 'Advertisement')}</h4>
                                <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">${escapeHtml(mediaUrl)}</p>
                                <div class="mt-2 flex flex-wrap gap-2">
                                    <button data-action="edit-admin-ad" data-adid="${ad.id}" class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-black text-white dark:bg-white dark:text-slate-900">Edit</button>
                                    <button data-action="delete-admin-ad" data-adid="${ad.id}" class="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 dark:bg-red-900/30 dark:text-red-200">Delete</button>
                                </div>
                            </div>
                        </div>
                    </div>`;
            }).join('') : '<p class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No ads added yet.</p>';
        };

        const SUPPORT_PROFILE_DESCRIPTION = 'Hey, I am Yash Vishal founder Of Reviews World Pvt. Ltd. Working since 2021. I am currently Running more than 5-6 community of Reviews world. I have more than 1000+ active members in our community.Please let me know if you want to do any deal regarding App Reviews work, Map reviews work, and other type of reviews work, web Development, App Developement, etc.Working on making REVIEWS WORLD App since Jan. 2026. It will announced soon..🤗#stay_away_haters';

        const getSafeDate = (value) => value?.toDate ? value.toDate() : value ? new Date(value) : null;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const shortMonthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

        const getUserCreatedYear = () => {
            const created = getSafeDate(currentUserData?.createdAt);
            return created ? created.getFullYear() : new Date().getFullYear();
        };

        const getIncomeTransactions = () => unifiedHistoryCache.filter(item => {
            if (item.status && item.status !== 'completed') return false;
            const type = normalizeTransactionType(item);
            return type === 'credit' || type === 'gift_card' || (type === 'wallet_transfer' && Number(item.amount || 0) > 0);
        });

        const getWithdrawalTransactions = () => unifiedHistoryCache.filter(item => {
            if (item.status && item.status !== 'completed') return false;
            return normalizeTransactionType(item) === 'withdrawal';
        });

        const showTrackIncomePage = () => {
            const createdYear = getUserCreatedYear();
            const currentYear = new Date().getFullYear();
            const years = [];
            for (let year = createdYear; year <= currentYear; year++) years.push(year);
            const content = `
                ${getPageHeader('Track Income')}
                <div class="max-w-lg mx-auto space-y-4">
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
                        <label class="text-sm font-semibold text-gray-500 dark:text-gray-400">Choose Year</label>
                        <select id="income-year-select" class="mt-2 w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            ${years.map(year => `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`).join('')}
                        </select>
                    </div>
                    <div id="income-month-list" class="space-y-3"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { onBack: showSettingsPage });
            const renderIncomeYear = (year) => {
                const created = getSafeDate(currentUserData?.createdAt);
                const current = new Date();
                const totals = Array(12).fill(0);
                getIncomeTransactions().forEach(item => {
                    const date = getSafeDate(item.timestamp || item.createdAt);
                    if (!date || date.getFullYear() !== Number(year)) return;
                    totals[date.getMonth()] += absoluteAmount(item.amount || item.chargeAmount || 0);
                });
                const rows = totals.map((amount, monthIndex) => {
                    if (created && Number(year) === created.getFullYear() && monthIndex < created.getMonth()) return '';
                    if (Number(year) === current.getFullYear() && monthIndex > current.getMonth()) return '';
                    return `
                        <div class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <span class="font-semibold text-gray-900 dark:text-white">${monthNames[monthIndex]}</span>
                            <span class="font-bold text-emerald-600 dark:text-emerald-300">${formatCurrency(amount)}</span>
                        </div>`;
                }).join('');
                document.getElementById('income-month-list').innerHTML = rows || '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No income records for this year.</p>';
            };
            document.getElementById('income-year-select').onchange = (e) => renderIncomeYear(e.target.value);
            renderIncomeYear(currentYear);
        };

        const getInvoiceGroups = () => {
            const groups = {};
            getWithdrawalTransactions().forEach(item => {
                const date = getSafeDate(item.timestamp || item.requestedAt || item.processedAt);
                if (!date) return;
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (!groups[key]) groups[key] = { year: date.getFullYear(), month: date.getMonth(), items: [], total: 0 };
                groups[key].items.push(item);
                groups[key].total += absoluteAmount(item.amount || 0);
            });
            return Object.entries(groups).map(([key, value]) => ({ key, ...value })).sort((a, b) => b.key.localeCompare(a.key));
        };

        const showWithdrawalInvoicesPage = () => {
            const groups = getInvoiceGroups();
            const content = `
                ${getPageHeader('Invoice')}
                <div class="max-w-lg mx-auto space-y-4">
                    <div class="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-800 p-5 text-white shadow-xl">
                        <p class="text-xs font-bold uppercase text-white/60">Withdrawal Statements</p>
                        <h3 class="mt-1 text-2xl font-bold">Monthly Invoice</h3>
                        <p class="mt-2 text-sm text-white/70">Open a month to see full withdrawal details and download PDF.</p>
                    </div>
                    ${groups.length === 0 ? '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No withdrawal invoices available yet.</p>' : groups.map(group => `
                        <button data-invoice-key="${group.key}" class="invoice-month-card group w-full overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 text-left shadow-md hover:shadow-xl transition">
                            <div class="flex items-center gap-4 p-4">
                                <div class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800">
                                    <span class="text-xs font-bold text-blue-500">${shortMonthNames[group.month]}</span>
                                    <span class="text-lg font-black text-blue-900 dark:text-blue-100">${String(group.year).slice(-2)}</span>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <h3 class="text-base font-bold text-gray-900 dark:text-white">${shortMonthNames[group.month]} - ${group.year}</h3>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">${group.items.length} withdrawal${group.items.length === 1 ? '' : 's'} generated</p>
                                    <p class="mt-1 text-sm font-bold text-red-600 dark:text-red-300">${formatCurrency(group.total)}</p>
                                </div>
                                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition group-hover:translate-x-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                                </div>
                            </div>
                        </button>`).join('')}
                </div>
                ${getPageFooter()}`;
            showPage(content, { onBack: showSettingsPage });
            document.querySelectorAll('.invoice-month-card').forEach(card => {
                card.onclick = () => showWithdrawalInvoiceDetails(card.dataset.invoiceKey);
            });
        };

        const showWithdrawalInvoiceDetails = (invoiceKey) => {
            const group = getInvoiceGroups().find(item => item.key === invoiceKey);
            if (!group) return showNotification('Invoice not found.', true);
            const first = group.items[0] || {};
            const content = `
                ${getPageHeader(`${shortMonthNames[group.month]} - ${group.year}`)}
                <div class="max-w-4xl mx-auto space-y-4">
                    <div class="overflow-hidden rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-slate-200 dark:border-slate-700">
                        <div class="bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-800 p-5 text-white">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <p class="text-xs font-bold uppercase text-white/60">Withdrawal Invoice</p>
                                <h3 class="text-xl font-bold mt-1">${shortMonthNames[group.month]} - ${group.year}</h3>
                                <p class="text-sm text-white/70 mt-1">${escapeHtml(currentUserData?.name || 'User')} - ${escapeHtml(currentUserData?.email || currentUser?.email || '')}</p>
                            </div>
                            <button id="download-withdrawal-invoice-btn" class="px-4 py-2 rounded-xl bg-white text-slate-950 text-sm font-bold shadow-sm">Download PDF</button>
                        </div>
                        <div class="mt-4 grid grid-cols-2 gap-3">
                            <div class="rounded-2xl bg-white/10 border border-white/15 p-3">
                                <p class="text-xs text-white/60">Total Withdrawal</p>
                                <p class="font-bold text-lg">${formatCurrency(group.total)}</p>
                            </div>
                            <div class="rounded-2xl bg-white/10 border border-white/15 p-3">
                                <p class="text-xs text-white/60">Primary Mode</p>
                                <p class="font-bold text-lg">${escapeHtml(first.method || first.paymentMethod || 'Multiple')}</p>
                            </div>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full min-w-[760px] text-left text-sm">
                            <thead class="bg-slate-50 dark:bg-gray-900/70 text-xs uppercase text-slate-500 dark:text-slate-400">
                                <tr>
                                    <th class="px-4 py-3 font-bold">Amount</th>
                                    <th class="px-4 py-3 font-bold">Requested</th>
                                    <th class="px-4 py-3 font-bold">Processed</th>
                                    <th class="px-4 py-3 font-bold">Mode</th>
                                    <th class="px-4 py-3 font-bold">Details</th>
                                    <th class="px-4 py-3 font-bold">Txn ID</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                                ${group.items.map(item => `
                                    <tr class="bg-white dark:bg-gray-800 hover:bg-blue-50/60 dark:hover:bg-blue-900/10 transition">
                                        <td class="px-4 py-4 font-black text-red-600 dark:text-red-300">${formatCurrencyAbs(item.amount || 0)}</td>
                                        <td class="px-4 py-4 text-slate-600 dark:text-slate-300">${formatDateDDMMYY(item.timestamp || item.requestedAt)}</td>
                                        <td class="px-4 py-4 text-slate-600 dark:text-slate-300">${formatDateDDMMYY(item.processedAt || item.timestamp)}</td>
                                        <td class="px-4 py-4"><span class="rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 px-3 py-1 text-xs font-bold">${escapeHtml(getWithdrawalDisplayMethodName(item, 'N/A'))}</span></td>
                                        <td class="px-4 py-4 text-slate-600 dark:text-slate-300 max-w-[220px] break-words">${escapeHtml(getWithdrawalDetailText(item))}</td>
                                        <td class="px-4 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">${escapeHtml(item.adminTransactionId || item.transactionId || 'N/A')}</td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-gray-900/60 p-4">
                        <div class="rounded-2xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-700 p-3">
                            <p class="text-xs text-slate-500">Transactions</p>
                            <p class="font-bold">${group.items.length}</p>
                        </div>
                        <div class="rounded-2xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-700 p-3">
                            <p class="text-xs text-slate-500">Total</p>
                            <p class="font-bold">${formatCurrency(group.total)}</p>
                        </div>
                        <div class="rounded-2xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-700 p-3">
                            <p class="text-xs text-slate-500">Status</p>
                            <p class="font-bold text-emerald-600 dark:text-emerald-300">Completed</p>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { onBack: showWithdrawalInvoicesPage });
            document.getElementById('download-withdrawal-invoice-btn').onclick = () => downloadWithdrawalInvoicePdf(group);
        };

        const truncatePdfText = (text = '', max = 26) => {
            const value = String(text || 'N/A');
            return value.length > max ? `${value.slice(0, max - 3)}...` : value;
        };

        const createWithdrawalInvoicePdf = (group) => {
            const commands = [];
            const text = (value, x, y, size = 10, font = 'F1', color = '0 0 0') => {
                commands.push('BT', `/${font} ${size} Tf`, `${color} rg`, `${x} ${y} Td`, `(${escapePdfText(value)}) Tj`, 'ET');
            };
            const fillRect = (x, y, w, h, color) => commands.push('q', `${color} rg`, `${x} ${y} ${w} ${h} re f`, 'Q');
            const strokeRect = (x, y, w, h, color = '0.85 0.88 0.92') => commands.push('q', `${color} RG`, `${x} ${y} ${w} ${h} re S`, 'Q');
            const line = (x1, y1, x2, y2, color = '0.85 0.88 0.92') => commands.push('q', `${color} RG`, `${x1} ${y1} m ${x2} ${y2} l S`, 'Q');

            fillRect(0, 0, 595, 842, '0.96 0.98 1');
            fillRect(36, 690, 523, 110, '0.02 0.08 0.18');
            fillRect(36, 690, 523, 18, '0.02 0.45 0.36');
            text('REVIEWS WORLD', 58, 758, 22, 'F2', '1 1 1');
            text('WITHDRAWAL INVOICE', 58, 734, 14, 'F2', '0.75 0.9 1');
            text(`Generated: ${new Date().toLocaleString('en-IN')}`, 58, 712, 9, 'F1', '0.8 0.86 0.94');
            text(`Invoice Month: ${shortMonthNames[group.month]} - ${group.year}`, 382, 758, 11, 'F2', '1 1 1');
            text(`Status: COMPLETED`, 382, 738, 9, 'F2', '0.55 0.95 0.78');

            fillRect(36, 620, 250, 50, '1 1 1');
            strokeRect(36, 620, 250, 50);
            text('Billed To', 52, 650, 9, 'F2', '0.25 0.35 0.5');
            text(truncatePdfText(currentUserData?.name || 'User', 34), 52, 635, 12, 'F2', '0.05 0.1 0.18');
            text(truncatePdfText(currentUserData?.email || currentUser?.email || 'N/A', 38), 52, 622, 8, 'F1', '0.35 0.42 0.52');

            fillRect(310, 620, 249, 50, '1 1 1');
            strokeRect(310, 620, 249, 50);
            text('Total Withdrawal', 326, 650, 9, 'F2', '0.25 0.35 0.5');
            text(formatPdfCurrency(group.total), 326, 631, 18, 'F2', '0.78 0.12 0.12');
            text(`${group.items.length} transaction${group.items.length === 1 ? '' : 's'}`, 470, 631, 9, 'F1', '0.35 0.42 0.52');

            fillRect(36, 560, 523, 34, '0.9 0.95 1');
            strokeRect(36, 560, 523, 34, '0.72 0.8 0.9');
            text('Amount', 50, 573, 9, 'F2', '0.1 0.18 0.3');
            text('Requested', 125, 573, 9, 'F2', '0.1 0.18 0.3');
            text('Processed', 225, 573, 9, 'F2', '0.1 0.18 0.3');
            text('Mode', 325, 573, 9, 'F2', '0.1 0.18 0.3');
            text('Details', 395, 573, 9, 'F2', '0.1 0.18 0.3');
            text('Txn ID', 505, 573, 9, 'F2', '0.1 0.18 0.3');

            let y = 532;
            group.items.slice(0, 12).forEach((item, index) => {
                fillRect(36, y - 9, 523, 30, index % 2 === 0 ? '1 1 1' : '0.98 0.99 1');
                line(36, y - 10, 559, y - 10);
                text(formatPdfCurrency(item.amount || 0), 50, y, 8, 'F2', '0.78 0.12 0.12');
                text(truncatePdfText(formatDateDDMMYY(item.timestamp || item.requestedAt), 16), 125, y, 8, 'F1', '0.18 0.24 0.33');
                text(truncatePdfText(formatDateDDMMYY(item.processedAt || item.timestamp), 16), 225, y, 8, 'F1', '0.18 0.24 0.33');
                text(truncatePdfText(getWithdrawalDisplayMethodName(item, 'N/A'), 10), 325, y, 8, 'F2', '0.05 0.35 0.75');
                text(truncatePdfText(getWithdrawalDetailText(item), 18), 395, y, 8, 'F1', '0.18 0.24 0.33');
                text(truncatePdfText(item.adminTransactionId || item.transactionId || 'N/A', 10), 505, y, 8, 'F1', '0.18 0.24 0.33');
                y -= 30;
            });
            if (group.items.length > 12) {
                text(`+ ${group.items.length - 12} more transactions in this month`, 50, y - 4, 9, 'F2', '0.78 0.12 0.12');
            }

            fillRect(36, 62, 523, 42, '0.02 0.08 0.18');
            text('This invoice is generated by RW Wallet for completed withdrawal records.', 54, 84, 9, 'F1', '0.8 0.86 0.94');
            text('REVIEWS WORLD | Digital Wallet', 54, 70, 9, 'F2', '1 1 1');

            const objects = [];
            const addObject = (body) => {
                objects.push(body);
                return objects.length;
            };
            addObject('<< /Type /Catalog /Pages 2 0 R >>');
            addObject('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
            addObject('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>');
            addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
            addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
            const content = commands.join('\n');
            addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
            let pdf = '%PDF-1.4\n';
            const offsets = [0];
            objects.forEach((obj, index) => {
                offsets.push(pdf.length);
                pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
            });
            const xref = pdf.length;
            pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
            offsets.slice(1).forEach(offset => {
                pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
            });
            pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
            return new Blob([pdf], { type: 'application/pdf' });
        };

        const downloadWithdrawalInvoicePdf = (group) => {
            const blob = createWithdrawalInvoicePdf(group);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `RW-WITHDRAWAL-${shortMonthNames[group.month]}-${group.year}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        };

        const getSupportLogo = () => 'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg';
        const CHATBOT_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/2040/2040946.png';
        const getVerifiedBadge = (extraClass = '') => `
            <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center align-middle ${extraClass}" title="Verified">
                <svg class="h-full w-full block" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#1683ff" d="M12 1.35 14.05 3.55l2.95-.72.88 2.9 2.89.88-.72 2.95L22.65 12l-2.6 2.44.72 2.95-2.89.88-.88 2.9-2.95-.72L12 22.65l-2.05-2.2-2.95.72-.88-2.9-2.89-.88.72-2.95L1.35 12l2.6-2.44-.72-2.95 2.89-.88.88-2.9 2.95.72L12 1.35Z"/>
                    <path fill="none" stroke="#fff" stroke-width="2.55" stroke-linecap="round" stroke-linejoin="round" d="m7.25 12.15 3.05 3.05 6.55-6.65"/>
                </svg>
            </span>`;
        const getPremiumLogoFrame = (innerHtml, sizeClass = 'h-14 w-14', extraClass = '') => `
            <div class="${sizeClass} ${extraClass} rounded-full bg-gradient-to-br from-indigo-600 via-blue-600 to-emerald-500 p-[2px] shadow-sm">
                <div class="h-full w-full rounded-full bg-white dark:bg-gray-900 p-[5px] flex items-center justify-center overflow-hidden">
                    ${innerHtml}
                </div>
            </div>`;
        const getRevyBotLogo = (sizeClass = 'h-14 w-14') => `
            ${getPremiumLogoFrame(`<img src="${CHATBOT_ICON_URL}" alt="REVY AI" class="max-h-full max-w-full rounded-full object-contain" loading="eager" fetchpriority="high" decoding="async">`, sizeClass)}`;
        const getSupportLogoFrame = (sizeClass = 'h-14 w-14', extraClass = '') => `
            ${getPremiumLogoFrame(`<img src="${getSupportLogo()}" alt="REVIEWS WORLD" class="h-full w-full rounded-full object-cover" loading="eager" fetchpriority="high" decoding="async">`, sizeClass, extraClass)}`;
        const getSupportAdminEmail = () => {
            const adminProfile = allUsersCache.find(u => u.id === ADMIN_UID) || {};
            return adminProfile.email || 'reviewsworld01@gmail.com';
        };

        const showSupportProfileModal = async () => {
            let supportProfile = allUsersCache.find(u => u.id === ADMIN_UID) || {};
            try {
                const adminDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/users`, ADMIN_UID));
                if (adminDoc.exists()) supportProfile = { id: ADMIN_UID, ...adminDoc.data() };
            } catch (e) {
                console.error('Support profile load failed:', e);
            }

            const whatsappNumber = supportProfile.whatsappNumber || supportProfile.mobile || '';
            const whatsappDigits = whatsappNumber.replace(/\D/g, '');
            const whatsappHrefNumber = whatsappDigits.length > 10 ? whatsappDigits : `91${whatsappDigits.slice(-10)}`;
            const websiteLinks = Array.isArray(supportProfile.websiteLinks) ? supportProfile.websiteLinks.slice(0, 3) : [];
            const renderSupportLink = (link) => {
                const safeLink = escapeHtml(link);
                return `<a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="block rounded-xl border border-blue-100 dark:border-blue-800 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 break-all hover:underline">${safeLink}</a>`;
            };
            renderModal('REVIEWS WORLD',
                `<div class="space-y-4 text-center">
                    ${getSupportLogoFrame('h-20 w-20', 'mx-auto')}
                    <div class="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4">
                        <h3 class="text-lg font-bold text-blue-900 dark:text-blue-100 inline-flex items-center justify-center gap-1">REVIEWS WORLD ${getVerifiedBadge()}</h3>
                        <p class="text-sm text-blue-600 dark:text-blue-300">${escapeHtml(supportProfile.email || 'reviewsworld01@gmail.com')}</p>
                    </div>
                    <div class="grid grid-cols-1 gap-3 text-left">
                        <div class="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4">
                            <p class="text-xs font-bold uppercase text-green-600 dark:text-green-300 mb-2">WhatsApp</p>
                            ${whatsappNumber
                                ? `<a href="https://wa.me/${escapeHtml(whatsappHrefNumber)}" target="_blank" rel="noopener noreferrer" class="text-sm font-bold text-green-800 dark:text-green-100 hover:underline">${escapeHtml(whatsappNumber)}</a>`
                                : '<p class="text-sm text-gray-500 dark:text-gray-400">Not added yet</p>'}
                        </div>
                        <div class="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4">
                            <p class="text-xs font-bold uppercase text-blue-600 dark:text-blue-300 mb-2">Website Links</p>
                            <div class="space-y-2">
                                ${websiteLinks.length ? websiteLinks.map(renderSupportLink).join('') : '<p class="text-sm text-gray-500 dark:text-gray-400">No website links added</p>'}
                            </div>
                        </div>
                    </div>
                    <div class="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-4 text-left">
                        <p class="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-300 mb-2">Description</p>
                        <p class="text-sm leading-6 text-gray-700 dark:text-gray-200">${escapeHtml(SUPPORT_PROFILE_DESCRIPTION)}</p>
                    </div>
                </div>`,
                ``,
                'max-w-md');
        };

        const formatChatTime = (timestamp) => {
            if (!timestamp) return '';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };
        const formatChatDate = (timestamp) => {
            if (!timestamp) return '';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            if (Number.isNaN(date.getTime())) return '';
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        };

        const renderMessageTicks = (message, isMine, viewerRole) => {
            if (!isMine) return '';
            const isReadByOppositeSide = !!message.readAt;
            const tickClass = isReadByOppositeSide ? 'text-blue-500' : 'text-gray-400';
            return `<span class="${tickClass} font-bold tracking-[-3px] ml-1">✓✓</span>`;
        };

        const markChatMessagesRead = async (messageDocs, readerRole) => {
            const batch = writeBatch(db);
            let hasUpdates = false;
            messageDocs.forEach(messageDoc => {
                const data = messageDoc.data();
                if (data.senderRole !== readerRole && !data.readAt) {
                    batch.update(messageDoc.ref, { readAt: serverTimestamp() });
                    hasUpdates = true;
                }
            });
            if (hasUpdates) {
                await batch.commit();
            }
        };

        const renderSupportMessages = (messages, viewerRole) => {
            const list = document.getElementById('support-chat-messages');
            if (!list) return;
            const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 90;
            list.innerHTML = messages.length === 0
                ? '<p class="text-center text-sm text-gray-500 dark:text-gray-400 py-8">Start a chat with Reviews World support.</p>'
                : messages.map((message, index) => {
                    const isMine = message.senderRole === viewerRole;
                    const messageDate = formatChatDate(message.createdAt);
                    const previousDate = index > 0 ? formatChatDate(messages[index - 1].createdAt) : '';
                    const dateDivider = messageDate && messageDate !== previousDate
                        ? `<div class="flex justify-center py-1">
                                <span class="rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 shadow-sm">${messageDate}</span>
                           </div>`
                        : '';
                    return `
                        ${dateDivider}
                        <div class="flex ${isMine ? 'justify-end' : 'justify-start'}" data-message-id="${message.id}">
                            <div class="w-fit max-w-[82%] px-3 py-1.5 shadow-sm ${isMine ? 'chat-bubble-user bg-emerald-50 dark:bg-emerald-900/40 text-gray-900 dark:text-white border border-emerald-100 dark:border-emerald-800' : 'chat-bubble-admin bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700'}">
                                <span class="text-sm leading-5 break-words align-baseline">${escapeHtml(message.text || '')}</span>
                                <span class="inline-flex items-center text-[10px] ml-2 text-gray-400 align-baseline">
                                    <span>${formatChatTime(message.createdAt)}</span>
                                    ${renderMessageTicks(message, isMine, viewerRole)}
                                </span>
                            </div>
                        </div>`;
                }).join('');
            if (wasNearBottom) {
                list.scrollTop = list.scrollHeight;
            }
        };

        const getSupportRoomId = (chatUserId) => `support_${chatUserId}`;
        const getSupportChatCacheKey = (roomId) => `rw_support_chat_${roomId}`;
        const getSupportChatSeenKey = (roomId) => `rw_support_seen_${roomId}`;
        const getAdminSupportChatSeenKey = (roomId) => `rw_admin_support_seen_${roomId}`;

        const readSupportChatCache = (roomId) => {
            try {
                const cached = JSON.parse(localStorage.getItem(getSupportChatCacheKey(roomId)) || '[]');
                return Array.isArray(cached) ? cached : [];
            } catch {
                return [];
            }
        };

        const writeSupportChatCache = (roomId, messages) => {
            try {
                localStorage.setItem(getSupportChatCacheKey(roomId), JSON.stringify(messages.slice(-200)));
            } catch (error) {
                console.warn('Support chat cache write failed:', error);
            }
        };

        const normalizeBackendMessage = (message) => ({
            id: message.id || `${message.roomId || message.room_id || activeSupportRoomId}-${message.timestamp || message.createdAt || Date.now()}-${message.senderId || message.sender_id || ''}`,
            roomId: message.roomId || message.room_id || activeSupportRoomId,
            text: message.message || message.text || '',
            senderId: message.senderId || message.sender_id || '',
            senderRole: (message.senderId || message.sender_id) === ADMIN_UID ? 'admin' : 'user',
            createdAt: message.timestamp || message.createdAt || Date.now(),
            readAt: message.readAt
                || ((message.senderId || message.sender_id) === ADMIN_UID
                    ? (message.readByUserAt || message.read_by_user_at)
                    : (message.readByAdminAt || message.read_by_admin_at))
                || null,
            clientMessageId: message.clientMessageId || message.client_message_id || null
        });

        const getSupportMessageDedupeKey = (message) => {
            const normalized = normalizeBackendMessage(message);
            if (normalized.clientMessageId) return `client:${normalized.clientMessageId}`;
            const text = String(normalized.text || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const timestamp = timestampToMillis(normalized.createdAt) || Date.now();
            const closeTimeBucket = Math.floor(timestamp / 120000);
            return `${normalized.roomId || activeSupportRoomId}|${normalized.senderId}|${closeTimeBucket}|${text}`;
        };

        const mergeSupportMessages = (...groups) => {
            const merged = new Map();
            groups.flat().forEach((message) => {
                if (!message) return;
                const normalized = normalizeBackendMessage(message);
                if (!String(normalized.text || '').trim()) return;
                const key = getSupportMessageDedupeKey(normalized);
                const existing = merged.get(key);
                if (!existing) {
                    merged.set(key, normalized);
                    return;
                }
                const existingTime = timestampToMillis(existing.createdAt);
                const normalizedTime = timestampToMillis(normalized.createdAt);
                merged.set(key, {
                    ...existing,
                    ...normalized,
                    id: existing.id || normalized.id,
                    clientMessageId: existing.clientMessageId || normalized.clientMessageId,
                    createdAt: existingTime && normalizedTime ? Math.min(existingTime, normalizedTime) : (existing.createdAt || normalized.createdAt),
                    readAt: existing.readAt || normalized.readAt
                });
            });
            return Array.from(merged.values()).sort((a, b) => timestampToMillis(a.createdAt) - timestampToMillis(b.createdAt));
        };

        const applySupportReadReceipt = (roomId, readerRole, readAt = Date.now()) => {
            const receiptTime = timestampToMillis(readAt) || Date.now();
            const updateMessages = (messages = []) => mergeSupportMessages(messages.map(message => {
                const normalized = normalizeBackendMessage(message);
                if (normalized.roomId !== roomId) return normalized;
                if (normalized.senderRole === readerRole) return normalized;
                if (timestampToMillis(normalized.createdAt) > receiptTime) return normalized;
                return { ...normalized, readAt: normalized.readAt || receiptTime };
            }));
            const cached = updateMessages(readSupportChatCache(roomId));
            writeSupportChatCache(roomId, cached);
            if (activeSupportRoomId === roomId && document.getElementById('support-chat-messages')) {
                activeSupportMessages = updateMessages(activeSupportMessages);
            }
        };

        const fetchSupportChatHistory = async (roomId, limit = 80) => {
            const token = await getBackendAuthToken();
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/chats/${encodeURIComponent(roomId)}?limit=${limit}`, {
                headers: { Authorization: `Bearer ${token}` }
            }, 6000);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Chat history load failed');
            return data.history || [];
        };

        const getLatestAdminMessageTime = (messages = []) => Math.max(0, ...messages
            .map(normalizeBackendMessage)
            .filter(message => message.senderRole === 'admin')
            .map(message => timestampToMillis(message.createdAt)));

        const calculateSupportUnreadCount = (roomId, messages = readSupportChatCache(roomId)) => {
            const lastSeen = Number(localStorage.getItem(getSupportChatSeenKey(roomId)) || 0);
            return messages
                .map(normalizeBackendMessage)
                .filter(message => message.senderRole === 'admin' && timestampToMillis(message.createdAt) > lastSeen)
                .length;
        };

        const updateSupportChatUnreadBadges = () => {
            const countText = supportChatUnreadCount > 99 ? '99+' : String(supportChatUnreadCount || '');
            ['bottom-help-unread-badge', 'support-chat-unread-badge'].forEach(id => {
                const badge = document.getElementById(id);
                if (!badge) return;
                badge.textContent = countText;
                badge.classList.toggle('hidden', supportChatUnreadCount <= 0);
            });
        };

        const updateAdminChatUnreadBadges = () => {
            const badge = document.getElementById('admin-chat-unread-badge');
            if (!badge) return;
            badge.textContent = adminChatUnreadCount > 99 ? '99+' : String(adminChatUnreadCount || '');
            badge.classList.toggle('hidden', adminChatUnreadCount <= 0);
        };

        const calculateAdminChatUnreadCount = (chats = allSupportChatsCache) => chats.filter(chat => {
            const roomId = chat.roomId || chat.room_id || getSupportRoomId(chat.userId || chat.id);
            const lastSenderId = chat.lastSenderId || chat.last_sender_id || '';
            const updatedAt = timestampToMillis(chat.updatedAt || chat.updated_at);
            const seenAt = Number(localStorage.getItem(getAdminSupportChatSeenKey(roomId)) || 0);
            return lastSenderId && lastSenderId !== ADMIN_UID && updatedAt > seenAt;
        }).length;

        const refreshAdminChatUnreadCount = () => {
            adminChatUnreadCount = calculateAdminChatUnreadCount();
            updateAdminChatUnreadBadges();
        };

        const markSupportChatSeen = (roomId, messages = readSupportChatCache(roomId)) => {
            const latestAdminTime = getLatestAdminMessageTime(messages);
            if (latestAdminTime) {
                localStorage.setItem(getSupportChatSeenKey(roomId), String(latestAdminTime));
            }
            supportChatUnreadCount = 0;
            updateSupportChatUnreadBadges();
        };

        const markAdminSupportChatSeen = (roomId, messages = readSupportChatCache(roomId)) => {
            const latestUserTime = Math.max(0, ...messages
                .map(normalizeBackendMessage)
                .filter(message => message.senderRole !== 'admin')
                .map(message => timestampToMillis(message.createdAt)));
            const room = allSupportChatsCache.find(chat => (chat.roomId || getSupportRoomId(chat.userId || chat.id)) === roomId);
            const fallbackTime = room && (room.lastSenderId || room.last_sender_id) !== ADMIN_UID ? timestampToMillis(room.updatedAt || room.updated_at) : 0;
            const seenAt = Math.max(latestUserTime, fallbackTime);
            if (seenAt) localStorage.setItem(getAdminSupportChatSeenKey(roomId), String(seenAt));
            refreshAdminChatUnreadCount();
        };

        const refreshSupportUnreadFromCache = (roomId) => {
            supportChatUnreadCount = calculateSupportUnreadCount(roomId);
            updateSupportChatUnreadBadges();
        };

        const preloadSupportChatForUser = async (userId = currentUser?.uid) => {
            if (!userId || userId === ADMIN_UID) return;
            const roomId = getSupportRoomId(userId);
            const cached = readSupportChatCache(roomId);
            if (supportChatPreloadUserId === userId && cached.length) return;
            supportChatPreloadUserId = userId;
            if (cached.length) refreshSupportUnreadFromCache(roomId);

            await fetchSupportChatHistory(roomId, 200)
                .then((history) => {
                const merged = mergeSupportMessages(cached, history);
                writeSupportChatCache(roomId, merged);
                refreshSupportUnreadFromCache(roomId);
                    return merged;
                })
                .catch((error) => {
                    console.warn('Support chat preload failed:', error);
                    return cached;
                });
        };

        const preloadAdminChatRooms = (chats = allSupportChatsCache) => {
            if (currentUser?.uid !== ADMIN_UID) return;
            chats.slice(0, 25).forEach(chat => {
                const roomId = chat.roomId || getSupportRoomId(chat.userId || chat.id);
                if (!roomId) return;
                const cached = readSupportChatCache(roomId);
                fetchSupportChatHistory(roomId, 120)
                    .then(history => {
                        const merged = mergeSupportMessages(cached, history);
                        writeSupportChatCache(roomId, merged);
                        refreshAdminChatUnreadCount();
                    })
                    .catch(error => console.warn('Admin chat room preload skipped:', error));
            });
        };

        const subscribeAdminChatRooms = async (chats = allSupportChatsCache) => {
            if (currentUser?.uid !== ADMIN_UID) return;
            const socket = await getSupportSocket();
            if (adminChatBackgroundHandlers) {
                socket.off('new_message', adminChatBackgroundHandlers.message);
                socket.off('chat_read', adminChatBackgroundHandlers.read);
            }

            const updateRoomFromMessage = (message) => {
                const normalized = normalizeBackendMessage(message);
                if (!normalized.roomId) return;
                const userId = normalized.roomId.replace(/^support_/, '');
                const isActiveRoomOpen = activeSupportRoomId === normalized.roomId && document.getElementById('support-chat-messages');
                const cachedMessages = mergeSupportMessages(readSupportChatCache(normalized.roomId), [normalized]);
                writeSupportChatCache(normalized.roomId, cachedMessages);

                const existingIndex = allSupportChatsCache.findIndex(chat => (chat.roomId || getSupportRoomId(chat.userId || chat.id)) === normalized.roomId);
                const existing = existingIndex >= 0 ? allSupportChatsCache[existingIndex] : {};
                const userProfile = allUsersCache.find(user => (user.id || user.uid) === userId) || {};
                const updatedChat = {
                    ...existing,
                    id: existing.id || userId,
                    userId: existing.userId || userId,
                    roomId: normalized.roomId,
                    userName: existing.userName || userProfile.name || 'User',
                    userEmail: existing.userEmail || userProfile.email || '',
                    userMobile: existing.userMobile || getUserMobileValue(userProfile) || '',
                    lastMessage: normalized.text,
                    lastSenderId: normalized.senderId,
                    updatedAt: timestampToMillis(normalized.createdAt) || Date.now()
                };

                if (existingIndex >= 0) {
                    allSupportChatsCache[existingIndex] = updatedChat;
                } else {
                    allSupportChatsCache.unshift(updatedChat);
                }
                allSupportChatsCache.sort((a, b) => timestampToMillis(b.updatedAt || b.updated_at) - timestampToMillis(a.updatedAt || a.updated_at));
                if (!isActiveRoomOpen) refreshAdminChatUnreadCount();
                renderAdminChatsList();
            };

            const handleAdminBackgroundRead = ({ roomId, readerRole, readAt }) => {
                applySupportReadReceipt(roomId, readerRole, readAt);
                renderAdminChatsList();
            };

            adminChatBackgroundHandlers = {
                message: updateRoomFromMessage,
                read: handleAdminBackgroundRead
            };
            socket.on('new_message', updateRoomFromMessage);
            socket.on('chat_read', handleAdminBackgroundRead);

            chats.slice(0, 200).forEach(chat => {
                const roomId = chat.roomId || getSupportRoomId(chat.userId || chat.id);
                if (!roomId || adminChatSubscribedRooms.has(roomId)) return;
                adminChatSubscribedRooms.add(roomId);
                socket.emit('join_room', { roomId, limit: 1, markRead: false });
            });
        };

        const openSupportChatPage = async (chatUserId, viewerRole = 'user', chatMeta = {}) => {
            if (activeChatUnsubscribe) {
                activeChatUnsubscribe();
                activeChatUnsubscribe = null;
            }
            const isAdminView = viewerRole === 'admin';
            const displayName = isAdminView ? (chatMeta.userName || 'User') : 'REVIEWS WORLD';
            const displayEmail = isAdminView
                ? (chatMeta.userEmail || '')
                : getSupportAdminEmail();
            const logo = isAdminView ? 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' : getSupportLogo();
            const initialMessage = chatMeta.initialMessage || '';
            const returnToBlocked = !!chatMeta.returnToBlocked;
            const content = `
                <div id="support-chat-shell" class="max-w-xl mx-auto bg-gray-100 dark:bg-gray-900 h-[100dvh] flex flex-col">
                    <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col h-full min-h-0">
                        <div class="relative flex items-center gap-3 px-3 pb-3 pt-[calc(1.85rem+env(safe-area-inset-top))] border-b border-gray-100 dark:border-gray-700">
                            <button class="page-back-btn h-10 w-10 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                            </button>
                            ${isAdminView ? `<img src="${logo}" alt="${escapeHtml(displayName)}" class="h-10 w-10 rounded-full object-cover">` : getSupportLogoFrame('h-10 w-10 shrink-0')}
                            <button id="support-profile-btn" class="min-w-0 flex-1 text-left">
                                <h3 class="font-bold truncate inline-flex items-center gap-1">${escapeHtml(displayName)} ${!isAdminView ? getVerifiedBadge() : ''}</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(displayEmail)}</p>
                            </button>
                            <button id="chat-disappear-info-btn" class="h-9 w-9 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600" title="Disappearing chat">15d</button>
                            <div id="chat-disappear-info-popup" class="hidden absolute right-3 top-14 z-20 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs leading-5 text-gray-600 dark:text-gray-300 shadow-xl">
                                All chat will automatically delete after 15 days after read by admin.
                            </div>
                        </div>
                        <div id="support-chat-messages" class="flex-1 min-h-0 space-y-3 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900"></div>
                        <div id="emoji-panel" class="hidden flex flex-wrap gap-2 p-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                            ${['😀','😁','🙏','👍','❤️','🔥','🎉','😊','🤗','✅','💰','📞'].map(emoji => `<button class="emoji-choice text-xl">${emoji}</button>`).join('')}
                        </div>
                        <div id="support-chat-composer" class="shrink-0 flex items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 transition-transform duration-150">
                            <button id="emoji-toggle-btn" class="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 text-xl">☺</button>
                            <input id="support-message-input" type="text" placeholder="Type a message" class="flex-1 min-w-0 px-4 py-2.5 text-[16px] bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <button id="support-send-btn" class="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`;
            const goBackFromSupportChat = () => {
                if (activeChatUnsubscribe) {
                    activeChatUnsubscribe();
                    activeChatUnsubscribe = null;
                }
                if (isAdminView) {
                    showAdminChatsPage();
                } else if (returnToBlocked) {
                    showBlockedAccountPage(chatMeta.blockedData || currentUserData || {});
                } else {
                    showHelpSupportPage();
                }
            };
            showPage(content, { fullHeight: true, onBack: goBackFromSupportChat });
            if (!returnToBlocked) setBottomNavActive(isAdminView ? 'bottom-settings-btn' : 'bottom-help-btn');
            const chatBackBtn = document.querySelector('#page-container .page-back-btn');
            if (chatBackBtn) {
                chatBackBtn.onclick = goBackFromSupportChat;
            }

            document.getElementById('support-profile-btn').onclick = () => {
                if (isAdminView) {
                    renderModal('User Details',
                        `<div class="space-y-3">
                            <p><strong>Name:</strong> ${escapeHtml(chatMeta.userName || 'User')}</p>
                            <p><strong>Email:</strong> ${escapeHtml(chatMeta.userEmail || '')}</p>
                            <p><strong>Mobile:</strong> ${escapeHtml(chatMeta.userMobile || '')}</p>
                        </div>`,
                        `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Close</button>`);
                } else {
                    showSupportProfileModal();
                }
            };
            document.getElementById('chat-disappear-info-btn').onclick = (event) => {
                event.stopPropagation();
                document.getElementById('chat-disappear-info-popup').classList.toggle('hidden');
            };
            document.addEventListener('click', function closeDisappearPopup(event) {
                const popup = document.getElementById('chat-disappear-info-popup');
                const button = document.getElementById('chat-disappear-info-btn');
                if (!popup || !button) {
                    document.removeEventListener('click', closeDisappearPopup);
                    return;
                }
                if (!popup.contains(event.target) && !button.contains(event.target)) {
                    popup.classList.add('hidden');
                }
            });

            const keyboardCleanup = installChatViewportLock({
                shellId: 'support-chat-shell',
                composerId: 'support-chat-composer',
                inputId: 'support-message-input',
                messagesId: 'support-chat-messages'
            });

            activeSupportRoomId = getSupportRoomId(chatUserId);
            activeSupportMessages = mergeSupportMessages(readSupportChatCache(activeSupportRoomId));
            writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
            renderSupportMessages(activeSupportMessages, viewerRole);
            if (!isAdminView) markSupportChatSeen(activeSupportRoomId, activeSupportMessages);
            if (isAdminView) markAdminSupportChatSeen(activeSupportRoomId, activeSupportMessages);
            fetchSupportChatHistory(activeSupportRoomId, 200)
                .then((history) => {
                    if (!history.length && activeSupportMessages.length) return;
                    activeSupportMessages = mergeSupportMessages(activeSupportMessages, history);
                    writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
                    renderSupportMessages(activeSupportMessages, viewerRole);
                    if (!isAdminView) markSupportChatSeen(activeSupportRoomId, activeSupportMessages);
                    if (isAdminView) markAdminSupportChatSeen(activeSupportRoomId, activeSupportMessages);
                })
                .catch((error) => console.warn('Fast chat history fetch failed:', error));
            const handleHistory = ({ roomId, history = [] }) => {
                if (roomId !== activeSupportRoomId) return;
                if (!history.length && activeSupportMessages.length) return;
                activeSupportMessages = mergeSupportMessages(activeSupportMessages, history);
                writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
                renderSupportMessages(activeSupportMessages, viewerRole);
                if (!isAdminView) markSupportChatSeen(activeSupportRoomId, activeSupportMessages);
                if (isAdminView) markAdminSupportChatSeen(activeSupportRoomId, activeSupportMessages);
            };
            const handleNewMessage = (message) => {
                if (message.roomId !== activeSupportRoomId) return;
                activeSupportMessages = mergeSupportMessages(activeSupportMessages, [message]);
                writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
                renderSupportMessages(activeSupportMessages, viewerRole);
                if (!isAdminView) markSupportChatSeen(activeSupportRoomId, activeSupportMessages);
                if (isAdminView) markAdminSupportChatSeen(activeSupportRoomId, activeSupportMessages);
            };
            const handleReadReceipt = ({ roomId, readerRole, readAt }) => {
                if (roomId !== activeSupportRoomId) return;
                applySupportReadReceipt(activeSupportRoomId, readerRole, readAt);
                renderSupportMessages(activeSupportMessages, viewerRole);
            };
            let socket = null;
            try {
                socket = await getSupportSocket({ timeoutMs: 5000 });
                socket.on('chat_history', handleHistory);
                socket.on('new_message', handleNewMessage);
                socket.on('chat_read', handleReadReceipt);
                socket.emit('join_room', { roomId: activeSupportRoomId, limit: 200, markRead: true }, (response) => {
                    if (!response?.ok) {
                        console.warn('Join support room failed:', response?.error);
                    }
                });
            } catch (error) {
                console.warn('Support chat realtime is not ready:', error?.message || error);
            }
            activeChatUnsubscribe = () => {
                if (keyboardCleanup) keyboardCleanup();
                if (socket) {
                    socket.off('chat_history', handleHistory);
                    socket.off('new_message', handleNewMessage);
                    socket.off('chat_read', handleReadReceipt);
                    socket.emit('leave_room', { roomId: activeSupportRoomId });
                }
            };

            const sendMessage = async () => {
                const input = document.getElementById('support-message-input');
                const sendBtn = document.getElementById('support-send-btn');
                const text = input.value.trim();
                if (!text) return;
                const now = Date.now();
                const sendSignature = `${activeSupportRoomId}|${currentUser?.uid || ''}|${text}`;
                if ((supportSendingMessage && supportLastSendSignature === sendSignature) || (supportLastSendSignature === sendSignature && now - supportLastSendAt < 1800)) {
                    return;
                }
                supportSendingMessage = true;
                supportLastSendSignature = sendSignature;
                supportLastSendAt = now;
                if (sendBtn) {
                    sendBtn.disabled = true;
                    sendBtn.classList.add('opacity-70');
                }
                const unlockSend = () => {
                    supportSendingMessage = false;
                    if (sendBtn) {
                        sendBtn.disabled = false;
                        sendBtn.classList.remove('opacity-70');
                    }
                };
                input.value = '';
                const userMeta = {
                    userId: chatUserId,
                    userName: chatMeta.userName || currentUserData?.name || currentUser?.email || 'User',
                    userEmail: chatMeta.userEmail || currentUserData?.email || currentUser?.email || '',
                    userMobile: chatMeta.userMobile || currentUserData?.mobile || ''
                };
                if (!socket?.connected) {
                    try {
                        socket = await getSupportSocket({ timeoutMs: 5000 });
                        socket.on('chat_history', handleHistory);
                        socket.on('new_message', handleNewMessage);
                        socket.on('chat_read', handleReadReceipt);
                        socket.emit('join_room', { roomId: activeSupportRoomId, limit: 200, markRead: true });
                    } catch (error) {
                        unlockSend();
                        input.value = text;
                        showNotification('Chat is still connecting. Please try again.', true);
                        return;
                    }
                }
                socket.emit('send_message', {
                    roomId: activeSupportRoomId,
                    message: text,
                    userMeta,
                    clientMessageId: `${activeSupportRoomId}-${currentUser?.uid || 'user'}-${Date.now()}-${Math.random().toString(36).slice(2)}`
                }, (response) => {
                    unlockSend();
                    if (!response?.ok) {
                        console.error('Send support message failed:', response?.error);
                        showNotification('Message not sent. Please try again.', true);
                    }
                });
                setTimeout(unlockSend, 4000);
                const updatedChat = {
                    userId: chatUserId,
                    roomId: activeSupportRoomId,
                    userName: userMeta.userName,
                    userEmail: userMeta.userEmail,
                    userMobile: userMeta.userMobile,
                    lastMessage: text,
                    lastSenderId: currentUser?.uid || '',
                    lastSenderRole: viewerRole,
                    updatedAt: Date.now()
                };
                const index = allSupportChatsCache.findIndex(chat => (chat.userId || chat.id) === chatUserId);
                if (index >= 0) {
                    allSupportChatsCache[index] = { ...allSupportChatsCache[index], ...updatedChat };
                } else {
                    allSupportChatsCache.unshift({ id: chatUserId, ...updatedChat });
                }
            };

            document.getElementById('support-send-btn').onclick = sendMessage;
            document.getElementById('support-message-input').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
            document.getElementById('emoji-toggle-btn').onclick = () => {
                document.getElementById('emoji-panel').classList.toggle('hidden');
                document.getElementById('support-message-input').focus();
            };
            document.querySelectorAll('.emoji-choice').forEach(btn => {
                btn.onclick = () => {
                    const input = document.getElementById('support-message-input');
                    input.value += btn.textContent;
                    input.focus();
                };
            });
            if (initialMessage) {
                const input = document.getElementById('support-message-input');
                input.value = initialMessage;
                sendMessage();
            }
        };

        const resetRevyBotTimer = () => {
            if (revyBotTimer) clearTimeout(revyBotTimer);
            revyBotTimer = setTimeout(() => closeRevyBotSession(), 10 * 60 * 1000);
        };

        const closeRevyBotSession = () => {
            if (revyBotTimer) clearTimeout(revyBotTimer);
            revyBotTimer = null;
            revyBotMessages = [];
            revyBotLastQuestion = '';
            hidePage();
            currentMainSection = 'home';
            switchTab('user-panel');
            setBottomNavActive('bottom-home-btn');
        };

        const getPendingWithdrawalForBot = async () => {
            if (!currentUser) return null;
            try {
                const pending = await loadUserPendingWithdrawalsMerged(currentUser.uid);
                return pending[0] || null;
            } catch (error) {
                console.error('Bot pending withdrawal check failed:', error);
                return null;
            }
        };

        const getLatestTransactionsForBot = async (limit = 5) => {
            if (!currentUser?.uid) return [];
            const cachedHistory = mergeTransactionsByKey(
                unifiedHistoryCache || [],
                readHistoryItemsFromCache(currentUser.uid)
            );

            try {
                const mergedHistory = await prefetchTransactionHistory(currentUser.uid, { force: !cachedHistory.length });
                const combinedHistory = mergeTransactionsByKey(mergedHistory || [], cachedHistory);
                return combinedHistory.slice(0, limit);
            } catch (error) {
                console.warn('Bot merged transaction lookup failed:', error);
                return cachedHistory.slice(0, limit);
            }
        };

        const getBotTransactionSummary = (item = {}) => {
            const type = normalizeTransactionType(item);
            const amountValue = Number(item.chargeAmount ?? item.amount ?? 0);
            const amountText = formatCurrencyAbs(amountValue);
            const status = String(item.status || 'completed').toLowerCase();
            const statusText = status.charAt(0).toUpperCase() + status.slice(1);
            const senderName = item.senderName || item.fromName || item.payerName || item.senderMobile || '';
            const recipientName = item.recipientName || item.toName || item.payeeName || item.recipientMobile || '';
            const methodName = getWithdrawalDisplayMethodName(item, '');
            const adminName = 'REVIEWS WORLD';
            const dateText = formatDateDDMMYY(item.timestamp || item.requestedAt || item.processedAt);

            let title = 'Wallet transaction';
            let sign = amountValue < 0 ? '-' : '+';

            if (type === 'wallet_transfer') {
                const isOutgoing = amountValue < 0 || item.direction === 'sent' || item.isSender;
                sign = isOutgoing ? '-' : '+';
                title = isOutgoing
                    ? `Payment to ${recipientName || 'user'}`
                    : `Received from ${senderName || 'user'}`;
            } else if (type === 'debit') {
                sign = '-';
                title = recipientName
                    ? `Debit to ${recipientName}`
                    : (item.comment || item.remarks || 'Admin debit');
            } else if (type === 'withdrawal') {
                sign = '-';
                title = methodName ? `Withdrawal (${methodName})` : 'Withdrawal request';
            } else if (type === 'mobile_recharge') {
                sign = '-';
                title = `Mobile recharge${item.mobileNumber ? ` for ${item.mobileNumber}` : ''}`;
            } else if (type === 'gift_card') {
                sign = '+';
                title = `Gift code redeemed${item.giftCode ? ` (${item.giftCode})` : ''}`;
            } else if (type === 'credit') {
                sign = '+';
                title = senderName && senderName !== adminName
                    ? `Received from ${senderName}`
                    : (item.comment || item.remarks || `Received from ${adminName}`);
            } else if (amountValue < 0) {
                sign = '-';
                title = item.comment || item.remarks || String(item.type || 'Debit').replace(/_/g, ' ');
            } else if (item.type) {
                title = item.comment || item.remarks || String(item.type).replace(/_/g, ' ');
            }

            const balanceAfter = getExplicitBalanceAfter(item);
            const balanceText = balanceAfter !== null ? `, balance ${formatCurrency(balanceAfter)}` : '';
            const reasonText = item.rejectionReason ? `, reason: ${item.rejectionReason}` : '';
            return `${title} - ${sign}${amountText} - ${statusText} - ${dateText}${balanceText}${reasonText}`;
        };

        const getRevyBotReply = async (question) => {
            const text = String(question || '').toLowerCase();
            const compactText = text.replace(/[^a-z0-9]+/g, ' ').trim();
            const hasAny = (...words) => words.some(word => compactText.includes(String(word).toLowerCase()));
            const activeLoan = allLoansCache.find(loan => loan.userId === currentUser?.uid && loan.status === 'active' && isModernLoanRecord(loan));
            const activeInvestment = allInvestmentsCache.find(item => item.userId === currentUser?.uid && item.status === 'active');

            if (hasAny('earn', 'earning', 'income', 'make money', 'track income', 'work', 'task', 'review work', 'reviews work', 'map review', 'download work', 'like comment')) {
                return 'Main earning work in REVIEWS WORLD is app reviews work, map review work, app download work, and like/comment work. Work updates are shared on the WhatsApp channel by admin. Complete the given task properly, then admin verifies it and wallet income/payment records can be tracked in the app. You can also check Track Income, Gift Codes if admin gives codes, and Become Partner if investment options are available.';
            }

            if (hasAny('add money', 'add fund', 'add funds', 'deposit', 'recharge wallet', 'top up', 'load wallet', 'add balance')) {
                return 'To add wallet funds, open Add Fund from the dashboard, enter amount and payment details, then submit. After admin verifies your payment, balance is credited. If delayed, send payment proof in REVIEWS WORLD support chat.';
            }

            if (hasAny('send money', 'pay to wallet', 'transfer money', 'wallet transfer', 'pay user', 'send fund')) {
                return 'Use Pay to Wallet to send money to another RW Wallet user. Enter recipient mobile number, amount, and note/details. The app finds the user, asks confirmation, transfers wallet balance, and saves the record in both users transaction history.';
            }

            if (hasAny('withdraw', 'withdrawal', 'payout', 'payment pending', 'pending')) {
                const pendingWithdrawal = await getPendingWithdrawalForBot();
                if (pendingWithdrawal) {
                    return `Your withdrawal request of ${formatCurrency(pendingWithdrawal.amount || 0)} is pending. Method: ${getWithdrawalDisplayMethodName(pendingWithdrawal, 'saved payout method')}. It is not rejected. Admin will process it soon if details are correct.`;
                }
                return 'I do not see a pending withdrawal request right now. To withdraw, first add your payout details in Settings > My Profile, then open Withdraw Fund, choose UPI/Bank/Gift Card/PayPal, enter the amount, and submit. The amount is deducted immediately and stays pending until admin approves or rejects it.';
            }
            if (hasAny('balance', 'wallet', 'fund')) {
                return `Your current wallet balance is ${formatCurrency(currentUserData?.balance || 0)}. If a withdrawal is submitted, the amount is deducted immediately and shown as pending until admin approves or rejects it.`;
            }
            if (hasAny('transaction', 'history', 'invoice', 'receipt', 'last transaction', 'latest transaction', 'recent transaction', 'last 5', 'latest 5')) {
                const latestTransactions = await getLatestTransactionsForBot(5);
                const latestHistory = latestTransactions[0];
                if (latestHistory) {
                    if (hasAny('last 5', 'latest 5', 'recent transaction', 'recent transactions', 'latest transactions', 'transaction history')) {
                        const summary = latestTransactions.map((item, index) =>
                            `${index + 1}. ${getBotTransactionSummary(item)}`
                        ).join('\n');
                        return `Your latest ${latestTransactions.length} wallet records:\n${summary}\nOpen Transaction History to view full details, IDs, and receipts.`;
                    }
                    return `Your latest wallet activity is ${getBotTransactionSummary(latestHistory)}. Open Transaction History to view full details and receipts.`;
                }
                return 'You can check all wallet activity from Transaction History. It shows deposits, withdrawals, transfers, recharge, gift code, and other wallet records.';
            }
            if (hasAny('payment method', 'upi', 'bank', 'ifsc', 'paypal', 'gift card', 'voucher', 'profile')) {
                return 'To update payout details, open Settings, then My Profile. You can add UPI, bank account with IFSC, PayPal or gift-card email details. Withdrawals use the details saved in your profile at request time.';
            }
            if (hasAny('setting', 'settings', 'change name', 'mobile number', 'whatsapp', 'website link', 'account details')) {
                return 'Open Settings to manage your profile, payout method, WhatsApp number, website links, invoices, theme, and support options. Keep your mobile number and payment details correct before requesting withdrawal.';
            }
            if (hasAny('password', 'login', 'reset', 'email')) {
                return 'For password help, use Forgot Password on the login page. A reset link will be sent to your email, and you should also check the spam folder.';
            }
            if (hasAny('recharge', 'mobile recharge')) {
                return 'For mobile recharge, open Mobile Recharge, enter number, choose operator and circle/state, select or type plan details, then submit. Wallet amount is deducted and the request stays pending until admin completes or rejects it.';
            }
            if (hasAny('loan', 'borrow')) {
                if (activeLoan) {
                    return `You have an active loan record of ${formatCurrency(activeLoan.amount || activeLoan.principal || 0)}. Please check the Loan section for repayment status and due details.`;
                }
                return 'Loan options depend on your account eligibility. If your account is eligible, open the Loan section and submit the request from there.';
            }
            if (hasAny('partner', 'investment', 'invest', 'interest', 'monthly income')) {
                if (activeInvestment) {
                    return `Your partner investment of ${formatCurrency(activeInvestment.amount || 0)} is active. Monthly interest is processed after completed periods according to the app rules. Open Become Partner or Track Income for details.`;
                }
                return 'Become Partner lets eligible users create a partner investment. The app calculates monthly interest using the platform rule, shows expected income, and admin manages active investment records. Open Become Partner from the dashboard to check the options.';
            }
            if (hasAny('gift', 'code', 'redeem')) {
                return 'Gift codes can be redeemed from the Gift Code section when you have a valid code. Gift card withdrawals use the email saved in your profile payout details.';
            }
            if (hasAny('admin', 'support', 'contact', 'help from admin', 'human', 'whatsapp')) {
                return 'For direct help, open REVIEWS WORLD chat from Help. Work updates are shared on the WhatsApp channel, and you can check the REVIEWS WORLD profile in chat for WhatsApp number and website links added by admin.';
            }
            if (hasAny('delete chat', 'chat delete', 'disappear', '15 days', 'privacy')) {
                return 'Support chat messages are kept until admin reads them. After admin reads a chat, those read messages automatically become eligible for deletion after 15 days to save storage.';
            }
            if (hasAny('company', 'reviews world', 'rw wallet', 'app', 'developer', 'yash', 'about', 'platform')) {
                return 'RW Wallet is the digital wallet platform of REVIEWS WORLD, developed by YASH VISHAL. It supports wallet balance, add fund, pay to wallet, withdrawals, transaction history, mobile recharge, gift codes, partner investment, loan tools, withdrawal invoices, payout profile details, support chat, and REVY instant help. REVIEWS WORLD work includes app review, map review, app download, and like/comment tasks shared by admin.';
            }
            if (hasAny('hello', 'hi', 'hey', 'help', 'start')) {
                return 'Hi, I am REVY, RW AI BOT. I can help with earning, add fund, pay to wallet, wallet balance, pending withdrawals, transaction history, payout details, password reset, recharge, gift codes, loans, partner investment, invoices, and how to use the app.';
            }

            if (hasAny('how to', 'where is', 'where to', 'can i', 'why', 'what is')) {
                return 'I can help with RW Wallet features like earning, Add Fund, Withdraw Fund, Pay to Wallet, Mobile Recharge, Gift Codes, Loan, Become Partner, Track Income, Transaction History, Invoices, Profile, password reset, and admin support. Please ask using one of these app sections, for example “how to earn” or “where is transaction history”.';
            }

            return {
                unsupported: true,
                text: 'Sorry, I can help only with RW Wallet, REVIEWS WORLD, earning, account, wallet, transaction, withdrawal, add fund, pay to wallet, recharge, gift code, loan, partner investment, profile, and app usage questions. Would you like me to transfer your problem to ADMIN?'
            };
        };

        const renderRevyBotMessages = () => {
            const list = document.getElementById('revy-bot-messages');
            if (!list) return;
            list.innerHTML = revyBotMessages.map((message, index) => {
                const isMine = message.senderRole === 'user';
                const showActions = message.actions === 'escalate' && index === revyBotMessages.length - 1;
                return `
                    <div class="flex ${isMine ? 'justify-end' : 'justify-start'}">
                        <div class="w-fit max-w-[84%] rounded-2xl px-3 py-2 shadow-sm ${isMine ? 'chat-bubble-user bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800' : 'chat-bubble-admin bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'}">
                            <p class="text-sm leading-5 break-words whitespace-pre-line">${escapeHtml(message.text)}</p>
                            <p class="text-[10px] mt-1 text-gray-400">${formatChatTime(message.createdAt)}</p>
                            ${showActions ? `
                                <div class="mt-3 flex flex-wrap gap-2">
                                    <button id="revy-transfer-yes" class="px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold">Yes, I need help</button>
                                    <button id="revy-transfer-no" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold">No</button>
                                    <button id="revy-edit-question" class="px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-200 text-xs font-bold">Edit</button>
                                    <button id="revy-exit-chat" class="px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-200 text-xs font-bold">Exit</button>
                                </div>` : ''}
                        </div>
                    </div>`;
            }).join('');
            list.scrollTop = list.scrollHeight;
            document.getElementById('revy-transfer-yes')?.addEventListener('click', () => {
                const question = revyBotLastQuestion || 'I need admin help.';
                revyBotMessages = [];
                if (revyBotTimer) clearTimeout(revyBotTimer);
                openSupportChatPage(currentUser.uid, 'user', {
                    initialMessage: `REVY - RW AI BOT could not answer this issue. User question: ${question}`
                });
            });
            document.getElementById('revy-transfer-no')?.addEventListener('click', () => {
                addRevyBotMessage('No problem. Please ask any other RW Wallet question, I will try to help instantly.');
            });
            document.getElementById('revy-edit-question')?.addEventListener('click', () => {
                const input = document.getElementById('revy-message-input');
                if (input) {
                    input.value = revyBotLastQuestion;
                    input.focus();
                }
            });
            document.getElementById('revy-exit-chat')?.addEventListener('click', closeRevyBotSession);
        };

        const addRevyBotMessage = (text, senderRole = 'bot', actions = '') => {
            revyBotMessages.push({
                id: `revy-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                text,
                senderRole,
                actions,
                createdAt: Date.now()
            });
            renderRevyBotMessages();
            resetRevyBotTimer();
        };

        const openRevyBotChatPage = () => {
            if (activeChatUnsubscribe) {
                activeChatUnsubscribe();
                activeChatUnsubscribe = null;
            }
            revyBotMessages = [];
            const content = `
                <div id="revy-chat-shell" class="max-w-xl mx-auto bg-gray-100 dark:bg-gray-900 h-[100dvh] flex flex-col">
                    <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col h-full min-h-0">
                        <div class="flex items-center gap-3 px-3 pb-3 pt-[calc(1.85rem+env(safe-area-inset-top))] border-b border-gray-100 dark:border-gray-700">
                            <button id="revy-back-btn" class="h-10 w-10 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                            </button>
                            ${getRevyBotLogo('h-10 w-10')}
                            <div class="min-w-0 flex-1">
                                <h3 class="font-bold truncate inline-flex items-center gap-1">REVY - RW AI BOT ${getVerifiedBadge()}</h3>
                                <p class="text-xs text-emerald-600 dark:text-emerald-300 truncate">Instant help solution</p>
                            </div>
                            <button id="revy-close-btn" class="px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-200 text-xs font-bold">Exit</button>
                        </div>
                        <div id="revy-bot-messages" class="flex-1 min-h-0 space-y-3 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900"></div>
                        <div id="revy-quick-options" class="shrink-0 flex gap-2 overflow-x-auto px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                            ${[
                                ['how to earn', 'Earn'],
                                ['how to add fund', 'Add Fund'],
                                ['how to withdraw', 'Withdraw'],
                                ['pending withdrawal', 'Pending'],
                                ['pay to wallet', 'Pay'],
                                ['transaction history', 'History'],
                                ['payment method', 'Profile'],
                                ['become partner investment', 'Partner'],
                                ['loan help', 'Loan'],
                                ['contact admin', 'Admin']
                            ].map(([question, label]) => `<button data-revy-question="${question}" class="revy-option shrink-0 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 text-xs font-bold">${label}</button>`).join('')}
                        </div>
                        <div id="revy-chat-composer" class="shrink-0 flex items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                            <input id="revy-message-input" type="text" placeholder="Or type your question" class="flex-1 min-w-0 px-4 py-2.5 text-[16px] bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <button id="revy-send-btn" class="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { fullHeight: true });
            setBottomNavActive('bottom-help-btn');
            const revyKeyboardCleanup = installChatViewportLock({
                shellId: 'revy-chat-shell',
                composerId: 'revy-chat-composer',
                inputId: 'revy-message-input',
                messagesId: 'revy-bot-messages'
            });
            const sendBotMessage = async () => {
                const input = document.getElementById('revy-message-input');
                const text = input.value.trim();
                if (!text) return;
                input.value = '';
                revyBotLastQuestion = text;
                addRevyBotMessage(text, 'user');
                const reply = await getRevyBotReply(text);
                if (reply?.unsupported) {
                    addRevyBotMessage(reply.text, 'bot', 'escalate');
                } else {
                    addRevyBotMessage(reply, 'bot');
                }
            };
            document.getElementById('revy-send-btn').onclick = sendBotMessage;
            document.querySelectorAll('.revy-option').forEach(btn => {
                btn.onclick = () => {
                    const input = document.getElementById('revy-message-input');
                    input.value = btn.dataset.revyQuestion;
                    sendBotMessage();
                };
            });
            document.getElementById('revy-message-input').addEventListener('keydown', (e) => {
                resetRevyBotTimer();
                if (e.key === 'Enter') sendBotMessage();
            });
            document.getElementById('revy-back-btn').onclick = () => {
                if (revyKeyboardCleanup) revyKeyboardCleanup();
                showHelpSupportPage();
            };
            document.getElementById('revy-close-btn').onclick = () => {
                if (revyKeyboardCleanup) revyKeyboardCleanup();
                closeRevyBotSession();
            };
            addRevyBotMessage(`Hi ${currentUserData?.name || 'there'}, I am REVY, RW AI BOT. I can instantly help with wallet balance, withdrawal status, transaction history, payment details, recharge, gift code, loan, invoices, password reset, and app usage.`);
        };

        const showHelpSupportPage = () => {
            const content = `
                ${getPageHeader('Help', { showBack: false })}
                <div class="max-w-lg mx-auto space-y-4">
                    <button id="revy-ai-chat-card" class="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-md text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                        ${getRevyBotLogo('h-14 w-14 shrink-0')}
                        <div class="flex-1 min-w-0">
                            <h3 class="font-bold text-gray-900 dark:text-white inline-flex items-center gap-1">REVY - RW AI BOT ${getVerifiedBadge()}</h3>
                            <p class="text-sm text-emerald-600 dark:text-emerald-300 truncate">Instant help solution</p>
                        </div>
                        <span class="text-blue-600 dark:text-blue-300 font-bold">Ask</span>
                    </button>
                    <button id="reviews-world-chat-card" class="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-md text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                        ${getSupportLogoFrame('h-14 w-14 shrink-0')}
                        <div class="flex-1 min-w-0">
                            <h3 class="font-bold text-gray-900 dark:text-white inline-flex items-center gap-1">REVIEWS WORLD ${getVerifiedBadge()}</h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400 truncate">Chat with admin support</p>
                        </div>
                        <span id="support-chat-unread-badge" class="hidden min-w-6 h-6 rounded-full bg-red-600 px-2 text-center text-xs font-black leading-6 text-white shadow"></span>
                        <span class="text-blue-600 dark:text-blue-300 font-bold">Chat</span>
                    </button>
                </div>
                ${getPageFooter()}`;
            showPage(content, { keepBottomNav: true });
            currentMainSection = 'help';
            setBottomNavActive('bottom-help-btn');
            updateSupportChatUnreadBadges();
            document.getElementById('revy-ai-chat-card').onclick = openRevyBotChatPage;
            document.getElementById('reviews-world-chat-card').onclick = () => openSupportChatPage(currentUser.uid, 'user');
        };

        const loadAdminChatsFromBackend = async ({ silent = false, retry = true, subscribeRealtime = false } = {}) => {
            if (currentUser?.uid !== ADMIN_UID) return;
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/chats?limit=200`, {
                    headers: { Authorization: `Bearer ${token}` }
                }, 8000);
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) {
                    throw new Error(data.error || 'Admin chat load failed');
                }
                allSupportChatsCache = (data.chats || []).map(chat => ({
                    id: chat.user_id || chat.room_id?.replace(/^support_/, ''),
                    userId: chat.user_id || chat.room_id?.replace(/^support_/, ''),
                    roomId: chat.room_id || getSupportRoomId(chat.user_id || ''),
                    userName: chat.user_name || 'User',
                    userEmail: chat.user_email || '',
                    userMobile: chat.user_mobile || '',
                    lastMessage: chat.last_message || '',
                    lastSenderId: chat.last_sender_id || '',
                    updatedAt: chat.updated_at || Date.now()
                }));
                refreshAdminChatUnreadCount();
                renderAdminChatsList();
                preloadAdminChatRooms(allSupportChatsCache);
                if (subscribeRealtime) {
                    subscribeAdminChatRooms(allSupportChatsCache).catch(error => console.warn('Admin chat socket subscribe skipped:', error));
                }
            } catch (error) {
                const log = silent ? console.warn : console.error;
                log('Cloudflare admin chat list failed:', error);
                if (retry) {
                    setTimeout(() => loadAdminChatsFromBackend({ silent, retry: false, subscribeRealtime }).catch(() => {}), 2500);
                }
                if (!silent && document.getElementById('admin-chats-list')) {
                    showNotification('Could not load chat list from backend. Retrying once...', true);
                }
            }
        };

        const getAdminChatUserMeta = (user = {}) => ({
            id: user.id || user.uid || '',
            userId: user.id || user.uid || '',
            userName: user.name || user.fullName || user.displayName || user.email || 'User',
            userEmail: user.email || '',
            userMobile: user.mobile || user.phoneNumber || user.phone || ''
        });

        const ensureAdminChatUsersLoaded = async () => {
            if (currentUser?.uid !== ADMIN_UID || allUsersCache.length) return;
            try {
                const usersSnap = await getDocs(query(collection(db, `artifacts/${appId}/public/data/users`)));
                allUsersCache = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (error) {
                console.warn('Admin chat user search load failed:', error);
            }
        };

        const renderAdminChatsList = () => {
            const list = document.getElementById('admin-chats-list');
            if (!list) return;
            const searchTerm = (document.getElementById('admin-chat-search')?.value || '').trim().toLowerCase();
            const chatsToRender = searchTerm
                ? allSupportChatsCache.filter(chat => [
                    chat.userName,
                    chat.userEmail,
                    chat.userMobile,
                    chat.lastMessage
                ].some(value => String(value || '').toLowerCase().includes(searchTerm)))
                : allSupportChatsCache;
            const existingChatUserIds = new Set(allSupportChatsCache.map(chat => String(chat.userId || chat.id || '')));
            const usersToStartChat = searchTerm
                ? allUsersCache
                    .filter(user => !isAdminUserRecord(user))
                    .map(getAdminChatUserMeta)
                    .filter(user => user.userId && !existingChatUserIds.has(String(user.userId)))
                    .filter(user => [
                        user.userName,
                        user.userEmail,
                        user.userMobile
                    ].some(value => String(value || '').toLowerCase().includes(searchTerm)))
                    .slice(0, 20)
                : [];

            const chatRows = chatsToRender.map(chat => {
                    const roomId = chat.roomId || getSupportRoomId(chat.userId || chat.id);
                    const isUnread = (chat.lastSenderId || '') !== ADMIN_UID && timestampToMillis(chat.updatedAt) > Number(localStorage.getItem(getAdminSupportChatSeenKey(roomId)) || 0);
                    return `
                    <button data-chat-userid="${chat.userId || chat.id}" class="admin-chat-row w-full flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                        <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="${escapeHtml(chat.userName || 'User')}" class="h-12 w-12 rounded-full object-contain bg-blue-50 p-2">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                                <h3 class="font-bold truncate">${escapeHtml(chat.userName || 'User')}</h3>
                                <div class="flex items-center gap-2">
                                    ${isUnread ? '<span class="min-w-5 h-5 rounded-full bg-red-600 px-1.5 text-center text-[10px] font-black leading-5 text-white shadow">1</span>' : ''}
                                    <span class="text-[10px] text-gray-400">${formatChatTime(chat.updatedAt)}</span>
                                </div>
                            </div>
                            <p class="text-xs text-gray-400 dark:text-gray-500 truncate">${escapeHtml(chat.userMobile || chat.userEmail || '')}</p>
                            <p class="text-sm ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'} truncate">${escapeHtml(chat.lastMessage || 'No message')}</p>
                        </div>
                    </button>`;
                }).join('');
            const userRows = usersToStartChat.map(user => `
                    <button data-chat-userid="${user.userId}" data-chat-source="user-search" class="admin-chat-row w-full flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl shadow-sm text-left hover:bg-blue-100 dark:hover:bg-blue-900/40 transition">
                        <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="${escapeHtml(user.userName || 'User')}" class="h-12 w-12 rounded-full object-contain bg-white dark:bg-gray-800 p-2">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                                <h3 class="font-bold truncate">${escapeHtml(user.userName || 'User')}</h3>
                                <span class="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-black uppercase text-white">Start chat</span>
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(user.userMobile || user.userEmail || '')}</p>
                            <p class="text-sm text-blue-700 dark:text-blue-300 truncate">Send a new message to this user</p>
                        </div>
                    </button>`).join('');

            if (!chatRows && !userRows) {
                list.innerHTML = searchTerm
                    ? '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No user or chat found.</p>'
                    : '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No chats received yet.</p>';
            } else {
                list.innerHTML = `
                    ${chatRows ? `<div class="space-y-3">${chatRows}</div>` : ''}
                    ${userRows ? `<div class="pt-2">
                        <p class="px-1 pb-2 text-xs font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">Users</p>
                        <div class="space-y-3">${userRows}</div>
                    </div>` : ''}`;
            }
            document.querySelectorAll('.admin-chat-row').forEach(row => {
                row.onclick = () => {
                    const chat = allSupportChatsCache.find(item => (item.userId || item.id) === row.dataset.chatUserid);
                    const searchedUser = allUsersCache.map(getAdminChatUserMeta).find(item => item.userId === row.dataset.chatUserid);
                    const chatMeta = chat || searchedUser || {};
                    markAdminSupportChatSeen(chatMeta.roomId || getSupportRoomId(row.dataset.chatUserid), readSupportChatCache(chatMeta.roomId || getSupportRoomId(row.dataset.chatUserid)));
                    openSupportChatPage(row.dataset.chatUserid, 'admin', chatMeta);
                };
            });
        };

        const showAdminChatsPage = () => {
            const content = `
                ${getPageHeader('Manage Chat')}
                <div class="max-w-2xl mx-auto space-y-3">
                    <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-3">
                        <input id="admin-chat-search" type="search" placeholder="Search chat or any user by name, email, phone" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div id="admin-chats-list" class="space-y-3"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            setBottomNavActive('bottom-settings-btn');
            document.getElementById('admin-chat-search').addEventListener('input', renderAdminChatsList);
            renderAdminChatsList();
            loadAdminChatsFromBackend({ silent: false, subscribeRealtime: true });
            ensureAdminChatUsersLoaded().then(renderAdminChatsList);
        };

        const getNotificationCacheKey = (userId) => `rw_notifications_cache_${userId}`;
        const normalizeNotification = (notification = {}) => ({
            id: notification.id || '',
            title: notification.title || 'REVIEWS WORLD',
            message: notification.message || '',
            senderId: notification.senderId || notification.sender_id || '',
            audience: notification.audience || '',
            createdAt: timestampToMillis(notification.createdAt || notification.created_at) || Date.now(),
            expiresAt: timestampToMillis(notification.expiresAt || notification.expires_at) || (Date.now() + 7 * 24 * 60 * 60 * 1000),
            deliveredAt: timestampToMillis(notification.deliveredAt || notification.delivered_at) || 0,
            readAt: timestampToMillis(notification.readAt || notification.read_at) || null,
            deliveredCount: Number(notification.deliveredCount || notification.delivered_count || 0),
            readCount: Number(notification.readCount || notification.read_count || 0),
            unreadCount: Number(notification.unreadCount || notification.unread_count || 0)
        });

        const readNotificationsCache = (userId = currentUser?.uid) => {
            if (!userId) return [];
            const cached = readJsonCache(getNotificationCacheKey(userId));
            const now = Date.now();
            return Array.isArray(cached)
                ? cached.map(normalizeNotification).filter(item => item.id && item.expiresAt > now)
                : [];
        };

        const writeNotificationsCache = (userId = currentUser?.uid, notifications = []) => {
            if (!userId) return;
            const now = Date.now();
            writeJsonCache(getNotificationCacheKey(userId), notifications
                .map(normalizeNotification)
                .filter(item => item.id && item.expiresAt > now)
                .slice(0, 120));
        };

        const mergeNotifications = (...groups) => {
            const merged = new Map();
            groups.flat().forEach(item => {
                const normalized = normalizeNotification(item);
                if (!normalized.id) return;
                merged.set(normalized.id, { ...(merged.get(normalized.id) || {}), ...normalized });
            });
            return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
        };

        const updateNotificationUnreadBadge = () => {
            const badge = document.getElementById('notification-unread-badge');
            if (!badge) return;
            badge.textContent = notificationUnreadCount > 99 ? '99+' : String(notificationUnreadCount || 0);
            badge.classList.toggle('hidden', notificationUnreadCount <= 0);
        };

        const refreshNotificationUnreadCount = (notifications = notificationsCache) => {
            notificationUnreadCount = notifications.filter(item => !item.readAt && item.expiresAt > Date.now()).length;
            updateNotificationUnreadBadge();
        };

        const fetchUserNotifications = async () => {
            const token = await getBackendAuthToken();
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/notifications?limit=200`, {
                headers: { Authorization: `Bearer ${token}` }
            }, 6000);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Notification load failed');
            return (data.notifications || []).map(normalizeNotification);
        };

        const preloadNotificationsForUser = async (userId = currentUser?.uid) => {
            if (!userId) return;
            const cached = readNotificationsCache(userId);
            if (cached.length) {
                notificationsCache = cached;
                refreshNotificationUnreadCount(cached);
            }
            const fresh = await fetchUserNotifications();
            notificationsCache = mergeNotifications(fresh, cached);
            writeNotificationsCache(userId, notificationsCache);
            refreshNotificationUnreadCount(notificationsCache);
            renderUserNotificationsList();
        };

        const startNotificationAutoRefresh = (userId = currentUser?.uid) => {
            if (!userId) return;
            if (notificationRefreshTimer) clearInterval(notificationRefreshTimer);
            notificationRefreshTimer = setInterval(() => {
                if (!currentUser || currentUser.uid !== userId) return;
                preloadNotificationsForUser(userId).catch(error => console.warn('Notification background refresh skipped:', error));
            }, 45000);
        };

        const markNotificationRead = async (notificationId) => {
            if (!notificationId) return;
            notificationsCache = notificationsCache.map(item => item.id === notificationId ? { ...item, readAt: item.readAt || Date.now() } : item);
            writeNotificationsCache(currentUser?.uid, notificationsCache);
            refreshNotificationUnreadCount(notificationsCache);
            renderUserNotificationsList();
            try {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/notifications/${encodeURIComponent(notificationId)}/read`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                }, 5000);
            } catch (error) {
                console.warn('Notification read sync failed:', error);
            }
        };

        const renderUserNotificationsList = () => {
            const list = document.getElementById('user-notifications-list');
            if (!list) return;
            const notifications = notificationsCache.filter(item => item.expiresAt > Date.now());
            list.innerHTML = notifications.length
                ? notifications.map(item => `
                    <article class="rounded-2xl border ${item.readAt ? 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800' : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'} p-4 shadow-sm">
                        <div class="flex items-start gap-3">
                            <div class="h-12 w-12 shrink-0 rounded-2xl bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-800 p-2 shadow-sm">
                                <img src="https://cdn-icons-png.flaticon.com/512/1827/1827370.png" alt="Notification" class="h-full w-full object-contain">
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center justify-between gap-2">
                                    <h3 class="font-black text-gray-900 dark:text-white truncate">${escapeHtml(item.title || 'REVIEWS WORLD')}</h3>
                                    ${item.readAt ? '<span class="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300">READ</span>' : '<span class="rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">NEW</span>'}
                                </div>
                                <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">${formatDateDDMMYY(item.createdAt)}</p>
                                <p class="mt-3 whitespace-pre-line break-words text-sm leading-6 text-gray-700 dark:text-gray-200">${escapeHtml(item.message)}</p>
                                <p class="mt-3 text-[10px] font-semibold uppercase text-gray-400 dark:text-gray-500">Auto deletes after 7 days</p>
                            </div>
                        </div>
                    </article>`).join('')
                : '<div class="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400 shadow-sm">No notifications yet.</div>';
        };

        const showNotificationsPage = async () => {
            if (!currentUser) return;
            if (currentUser.uid === ADMIN_UID) return showAdminNotificationsPage();
            notificationsCache = readNotificationsCache(currentUser.uid);
            refreshNotificationUnreadCount(notificationsCache);
            const content = `
                ${getPageHeader('Notifications')}
                <div class="max-w-2xl mx-auto space-y-3">
                    <div class="rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 p-4 text-white shadow-lg">
                        <div class="flex items-center gap-3">
                            <div class="h-14 w-14 rounded-2xl bg-white/95 p-2 shadow-sm">
                                <img src="https://cdn-icons-png.flaticon.com/512/1827/1827370.png" alt="Notifications" class="h-full w-full object-contain">
                            </div>
                            <div>
                                <h3 class="text-lg font-black">REVIEWS WORLD Updates</h3>
                                <p class="text-sm text-white/80">Read-only messages from admin</p>
                            </div>
                        </div>
                    </div>
                    <div id="user-notifications-list" class="space-y-3"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { keepBottomNav: true, returnTo: currentMainSection });
            renderUserNotificationsList();
            preloadNotificationsForUser(currentUser.uid)
                .then(() => {
                    const unread = notificationsCache.filter(item => !item.readAt).map(item => item.id);
                    unread.forEach(id => markNotificationRead(id));
                })
                .catch(error => {
                    console.warn('Notification page refresh failed:', error);
                    showNotification('Could not refresh notifications right now.', true);
                });
        };

        const sendSystemNotificationToUser = async ({ userId, title = 'REVIEWS WORLD', message = '' } = {}) => {
            if (!userId || !message || currentUser?.uid !== ADMIN_UID) return;
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/notifications`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        title,
                        message,
                        audience: 'system_withdrawal_status',
                        recipients: [userId]
                    })
                }, 7000);
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) throw new Error(data.error || 'Notification send failed');
            } catch (error) {
                console.warn('System notification skipped:', error);
            }
        };

        const notifyWithdrawalStatus = ({ userId, status, amount, txnId, requestId, rejectionReason = '', processedAt = Date.now() }) => {
            if (status === 'completed') return;
            const title = 'Withdrawal Rejected';
            const message = [
                `Your withdrawal of ${formatCurrency(amount)} was rejected.`,
                `Reason: ${rejectionReason || 'Not specified'}`,
                `Request ID: ${requestId || 'N/A'}`,
                `Updated on: ${formatDateDDMMYY(processedAt)}`
            ].join('\n');
            sendSystemNotificationToUser({ userId, title, message });
        };

        const fetchAdminNotifications = async () => {
            const token = await getBackendAuthToken();
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/notifications?limit=100`, {
                headers: { Authorization: `Bearer ${token}` }
            }, 6000);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Admin notifications load failed');
            adminNotificationsCache = (data.notifications || []).map(normalizeNotification);
            renderAdminNotificationsList();
        };

        const getNotificationRecipients = async () => {
            await ensureAdminChatUsersLoaded();
            return allUsersCache.filter(user => !isAdminUserRecord(user) && isUserOnUpdatedWebApp(user));
        };

        const getNotificationSearchMatches = () => {
            const search = (document.getElementById('admin-notification-user-search')?.value || '').trim().toLowerCase();
            if (search.length < 2) return [];
            const selectedIds = new Set(adminNotificationSelectedUsers.map(user => String(user.id || user.uid || '')));
            return allUsersCache
                .filter(user => !isAdminUserRecord(user) && !selectedIds.has(String(user.id || user.uid || '')))
                .filter(user => userMatchesSearch(user, search))
                .slice(0, 10);
        };

        const renderAdminNotificationSelectedUsers = () => {
            const list = document.getElementById('admin-notification-selected-users');
            if (!list) return;
            list.innerHTML = adminNotificationSelectedUsers.length
                ? adminNotificationSelectedUsers.map(user => `
                    <span class="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-200">
                        ${escapeHtml(user.name || user.email || user.mobile || 'User')}
                        <button data-remove-notification-user="${escapeHtml(user.id || user.uid || '')}" class="text-blue-400 hover:text-red-500" type="button">&times;</button>
                    </span>`).join('')
                : '<span class="text-xs text-gray-400 dark:text-gray-500">No selected users yet.</span>';
            list.querySelectorAll('[data-remove-notification-user]').forEach(button => {
                button.onclick = () => {
                    adminNotificationSelectedUsers = adminNotificationSelectedUsers.filter(user => String(user.id || user.uid || '') !== button.dataset.removeNotificationUser);
                    renderAdminNotificationSelectedUsers();
                    renderAdminNotificationSearchResults();
                    updateAdminNotificationTargetPreview();
                };
            });
        };

        const renderAdminNotificationSearchResults = () => {
            const list = document.getElementById('admin-notification-search-results');
            if (!list) return;
            const matches = getNotificationSearchMatches();
            const search = (document.getElementById('admin-notification-user-search')?.value || '').trim();
            if (!search) {
                list.innerHTML = '';
                return;
            }
            if (search.length < 2) {
                list.innerHTML = '<p class="rounded-xl bg-gray-50 dark:bg-gray-700/60 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">Type at least 2 letters or digits.</p>';
                return;
            }
            list.innerHTML = matches.length
                ? matches.map(user => `
                    <button data-add-notification-user="${escapeHtml(user.id || user.uid || '')}" type="button" class="w-full rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                        <p class="font-bold text-sm text-gray-900 dark:text-white">${escapeHtml(user.name || 'User')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(user.mobile || user.phoneNumber || user.email || user.id || '')}</p>
                    </button>`).join('')
                : '<p class="rounded-xl bg-gray-50 dark:bg-gray-700/60 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No matching user found.</p>';
            list.querySelectorAll('[data-add-notification-user]').forEach(button => {
                button.onclick = () => {
                    const user = allUsersCache.find(item => String(item.id || item.uid || '') === button.dataset.addNotificationUser);
                    if (!user) return;
                    adminNotificationSelectedUsers = [...adminNotificationSelectedUsers, user];
                    const input = document.getElementById('admin-notification-user-search');
                    if (input) input.value = '';
                    renderAdminNotificationSelectedUsers();
                    renderAdminNotificationSearchResults();
                    updateAdminNotificationTargetPreview();
                };
            });
        };

        const renderAdminNotificationsList = () => {
            const list = document.getElementById('admin-notifications-list');
            if (!list) return;
            list.innerHTML = adminNotificationsCache.length
                ? adminNotificationsCache.map(item => `
                    <article class="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <h3 class="font-black text-gray-900 dark:text-white truncate">${escapeHtml(item.title || 'REVIEWS WORLD')}</h3>
                                <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">${formatDateDDMMYY(item.createdAt)} · Deletes ${formatDateDDMMYY(item.expiresAt)}</p>
                                <p class="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-200 whitespace-pre-line break-words">${escapeHtml(item.message)}</p>
                            </div>
                            <button data-delete-notification="${item.id}" class="shrink-0 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-black text-red-600 dark:text-red-300">Delete</button>
                        </div>
                        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
                            <button data-notification-recipients="${item.id}" data-recipient-filter="all" class="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3 hover:ring-2 hover:ring-blue-300 transition"><p class="text-[10px] font-black uppercase text-blue-600 dark:text-blue-300">Delivered</p><p class="text-lg font-black">${item.deliveredCount}</p></button>
                            <button data-notification-recipients="${item.id}" data-recipient-filter="read" class="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 hover:ring-2 hover:ring-emerald-300 transition"><p class="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-300">Read</p><p class="text-lg font-black">${item.readCount}</p></button>
                            <button data-notification-recipients="${item.id}" data-recipient-filter="unread" class="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 hover:ring-2 hover:ring-red-300 transition"><p class="text-[10px] font-black uppercase text-red-600 dark:text-red-300">Unread</p><p class="text-lg font-black">${item.unreadCount}</p></button>
                        </div>
                    </article>`).join('')
                : '<div class="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400 shadow-sm">No notifications sent yet.</div>';
            list.querySelectorAll('[data-notification-recipients]').forEach(button => {
                button.onclick = () => showNotificationRecipientsModal(button.dataset.notificationRecipients, button.dataset.recipientFilter || 'all');
            });
            list.querySelectorAll('[data-delete-notification]').forEach(button => {
                button.onclick = () => deleteAdminNotification(button.dataset.deleteNotification);
            });
        };

        const fetchNotificationRecipients = async (notificationId) => {
            const token = await getBackendAuthToken();
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/notifications/${encodeURIComponent(notificationId)}/recipients?limit=3000`, {
                headers: { Authorization: `Bearer ${token}` }
            }, 8000);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Recipient list load failed');
            return data.recipients || [];
        };

        const showNotificationRecipientsModal = async (notificationId, filter = 'all') => {
            const notification = adminNotificationsCache.find(item => item.id === notificationId);
            renderModal('Notification Readers',
                `<div class="space-y-3">
                    <div class="rounded-xl bg-gray-50 dark:bg-gray-700/60 p-3">
                        <p class="text-xs font-black uppercase text-gray-400">Message</p>
                        <p class="mt-1 text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(notification?.title || 'REVIEWS WORLD')}</p>
                    </div>
                    <div id="notification-reader-list" class="space-y-2">
                        <p class="text-center text-sm text-gray-500 dark:text-gray-400 py-6">Loading readers...</p>
                    </div>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Close</button>`,
                'max-w-lg'
            );
            try {
                await ensureAdminChatUsersLoaded();
                const recipients = await fetchNotificationRecipients(notificationId);
                const filtered = recipients.filter(row => {
                    if (filter === 'read') return !!row.readAt;
                    if (filter === 'unread') return !row.readAt;
                    return true;
                });
                const userMap = new Map(allUsersCache.map(user => [String(user.id || user.uid || ''), user]));
                const list = document.getElementById('notification-reader-list');
                if (!list) return;
                list.innerHTML = filtered.length
                    ? filtered.map(row => {
                        const user = userMap.get(String(row.userId)) || {};
                        return `
                            <div class="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                                <div class="h-10 w-10 shrink-0 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-xs font-black text-blue-700 dark:text-blue-200">${escapeHtml((user.name || user.email || 'U').slice(0, 2).toUpperCase())}</div>
                                <div class="min-w-0 flex-1">
                                    <p class="font-bold text-sm text-gray-900 dark:text-white truncate">${escapeHtml(user.name || 'User')}</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(user.mobile || user.phoneNumber || user.email || row.userId)}</p>
                                    <p class="text-[10px] text-gray-400 dark:text-gray-500">${row.readAt ? `Read: ${formatDateDDMMYY(row.readAt)}` : `Delivered: ${formatDateDDMMYY(row.deliveredAt)}`}</p>
                                </div>
                                <span class="rounded-full px-2 py-1 text-[10px] font-black ${row.readAt ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}">${row.readAt ? 'READ' : 'UNREAD'}</span>
                            </div>`;
                    }).join('')
                    : `<p class="text-center text-sm text-gray-500 dark:text-gray-400 py-6">No ${filter === 'all' ? 'delivered users' : filter + ' users'} found.</p>`;
            } catch (error) {
                console.error('Notification readers load failed:', error);
                const list = document.getElementById('notification-reader-list');
                if (list) list.innerHTML = '<p class="text-center text-sm text-red-500 py-6">Could not load reader list.</p>';
            }
        };

        const updateAdminNotificationTargetPreview = async () => {
            const mode = document.getElementById('admin-notification-target')?.value || 'all_new_version';
            const searchWrap = document.getElementById('admin-notification-user-wrap');
            const preview = document.getElementById('admin-notification-target-preview');
            if (searchWrap) searchWrap.classList.toggle('hidden', mode !== 'single');
            if (!preview) return;
            if (mode === 'all_new_version') {
                const recipients = await getNotificationRecipients();
                preview.textContent = `Will deliver to ${recipients.length} new version members.`;
            } else {
                preview.textContent = adminNotificationSelectedUsers.length
                    ? `Will deliver to ${adminNotificationSelectedUsers.length} selected user${adminNotificationSelectedUsers.length > 1 ? 's' : ''}.`
                    : 'Search and select one or more users.';
            }
        };

        const sendAdminNotification = async () => {
            const title = (document.getElementById('admin-notification-title')?.value || '').trim() || 'REVIEWS WORLD';
            const message = (document.getElementById('admin-notification-message')?.value || '').trim();
            const mode = document.getElementById('admin-notification-target')?.value || 'all_new_version';
            if (!message) return showNotification('Please write notification message.', true);
            await ensureAdminChatUsersLoaded();
            const recipients = mode === 'all_new_version'
                ? (await getNotificationRecipients()).map(user => user.id)
                : adminNotificationSelectedUsers.map(user => user.id || user.uid).filter(Boolean);
            if (!recipients.length) return showNotification('No matching receiver found.', true);

            const button = document.getElementById('admin-send-notification-btn');
            if (button) {
                button.disabled = true;
                button.textContent = 'Sending...';
            }
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/notifications`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ title, message, audience: mode, recipients })
                }, 10000);
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) throw new Error(data.error || 'Send failed');
                document.getElementById('admin-notification-message').value = '';
                adminNotificationSelectedUsers = [];
                renderAdminNotificationSelectedUsers();
                renderAdminNotificationSearchResults();
                showNotification(`Notification sent to ${recipients.length} member${recipients.length > 1 ? 's' : ''}.`);
                await fetchAdminNotifications();
                updateAdminNotificationTargetPreview();
            } catch (error) {
                console.error('Notification send failed:', error);
                showNotification('Could not send notification.', true);
            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = 'Send Notification';
                }
            }
        };

        const deleteAdminNotification = async (notificationId) => {
            if (!notificationId || !confirm('Delete this notification from every user?')) return;
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/notifications/${encodeURIComponent(notificationId)}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                }, 6000);
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) throw new Error(data.error || 'Delete failed');
                adminNotificationsCache = adminNotificationsCache.filter(item => item.id !== notificationId);
                renderAdminNotificationsList();
                showNotification('Notification deleted.');
            } catch (error) {
                console.error('Notification delete failed:', error);
                showNotification('Could not delete notification.', true);
            }
        };

        const showAdminNotificationsPage = async () => {
            if (currentUser?.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const content = `
                ${getPageHeader('Notifications')}
                <div class="max-w-3xl mx-auto space-y-4">
                    <section class="rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 p-2">
                                <img src="https://cdn-icons-png.flaticon.com/512/1827/1827370.png" alt="Notification" class="h-full w-full object-contain">
                            </div>
                            <div>
                                <h3 class="text-lg font-black">Send Notification</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Users can only read. Messages auto delete after 7 days.</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 gap-3">
                            <select id="admin-notification-target" class="w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="all_new_version">All new version members</option>
                                <option value="single">Selected users</option>
                            </select>
                            <div id="admin-notification-user-wrap" class="hidden space-y-2">
                                <input id="admin-notification-user-search" type="search" autocomplete="off" placeholder="Search name, mobile, email, then select user" class="w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <div id="admin-notification-search-results" class="grid grid-cols-1 gap-2"></div>
                                <div id="admin-notification-selected-users" class="flex flex-wrap gap-2"></div>
                            </div>
                            <p id="admin-notification-target-preview" class="text-xs font-bold text-blue-600 dark:text-blue-300">Loading members...</p>
                            <input id="admin-notification-title" type="text" maxlength="120" value="REVIEWS WORLD" placeholder="Title" class="w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <textarea id="admin-notification-message" rows="4" placeholder="Write notification message..." class="w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                            <button id="admin-send-notification-btn" class="rounded-xl bg-blue-600 px-4 py-3 font-black text-white shadow-sm hover:bg-blue-700 transition">Send Notification</button>
                        </div>
                    </section>
                    <section>
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="font-black text-gray-900 dark:text-white">Sent Notifications</h3>
                            <button id="admin-refresh-notifications-btn" class="rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-black">Refresh</button>
                        </div>
                        <div id="admin-notifications-list" class="space-y-3"></div>
                    </section>
                </div>
                ${getPageFooter()}`;
            showPage(content, { keepBottomNav: true, returnTo: 'admin' });
            setBottomNavActive('bottom-admin-btn');
            document.getElementById('admin-notification-target').addEventListener('change', updateAdminNotificationTargetPreview);
            document.getElementById('admin-notification-user-search').addEventListener('input', () => {
                renderAdminNotificationSearchResults();
                updateAdminNotificationTargetPreview();
            });
            document.getElementById('admin-send-notification-btn').onclick = sendAdminNotification;
            document.getElementById('admin-refresh-notifications-btn').onclick = fetchAdminNotifications;
            ensureAdminChatUsersLoaded().then(() => {
                renderAdminNotificationSelectedUsers();
                renderAdminNotificationSearchResults();
                updateAdminNotificationTargetPreview();
            });
            renderAdminNotificationsList();
            fetchAdminNotifications().catch(error => {
                console.error('Admin notifications load failed:', error);
                showNotification('Could not load sent notifications.', true);
            });
        };

        const getFilteredTransactions = (filter) => {
            if ((!unifiedHistoryCache || unifiedHistoryCache.length === 0) && currentUser?.uid) {
                unifiedHistoryCache = readHistoryItemsFromCache(currentUser.uid);
            }

            if (filter === 'all') {
                return unifiedHistoryCache;
            }

            if (filter === 'withdrawal') {
                return unifiedHistoryCache.filter(item =>
                    normalizeTransactionType(item) === 'withdrawal' ||
                    (item.status === 'pending' && normalizeTransactionType(item) !== 'loan')
                );
            }

            if (filter === 'received') {
                return unifiedHistoryCache.filter(item => {
                    const type = normalizeTransactionType(item);
                    return ['credit', 'gift_card'].includes(type) || (type === 'wallet_transfer' && Number(item.amount || 0) > 0);
                });
            }

            if (filter === 'sent') {
                return unifiedHistoryCache.filter(item => {
                    const type = normalizeTransactionType(item);
                    return type === 'debit' || type === 'mobile_recharge' || type === 'withdrawal' || (type === 'wallet_transfer' && Number(item.amount || 0) < 0);
                });
            }

            if (filter === 'debit') {
                return unifiedHistoryCache.filter(item => normalizeTransactionType(item) === 'debit');
            }

            return unifiedHistoryCache;
        };

        const renderFilteredTransactions = (filter, options = {}) => {
            const { reset = true } = options;
            const filteredList = getFilteredTransactions(filter);
            transactionListState.filter = filter;
            transactionListState.items = filteredList;
            if (reset) {
                transactionListState.visibleCount = TRANSACTION_PAGE_SIZE;
            }

            const listElement = document.getElementById('all-transactions-list');
            if (listElement) {
                const visibleItems = filteredList.slice(0, transactionListState.visibleCount);
                const hasMore = transactionListState.visibleCount < filteredList.length;
                listElement.innerHTML = filteredList.length === 0
                    ? '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No transactions found for this filter.</p>'
                    : `${visibleItems.map(item => renderTransactionItem(item, true)).join('')}
                       ${hasMore ? '<p id="transactions-load-hint" class="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-3">Scroll to load more</p>' : ''}`;
            }
        };

        const loadMoreTransactionsIfNeeded = () => {
            if (!document.getElementById('all-transactions-list')) return;
            if (transactionListState.visibleCount >= transactionListState.items.length) return;

            transactionListState.visibleCount += TRANSACTION_PAGE_SIZE;
            renderFilteredTransactions(transactionListState.filter, { reset: false });
        };

        const refreshTransactionHistoryFromFirebase = async (userId = currentUser?.uid) => {
            if (!userId) return [];
            return prefetchTransactionHistory(userId, { force: true });
        };

        const showAllTransactionsPage = () => {
            if ((!unifiedHistoryCache || unifiedHistoryCache.length === 0) && currentUser?.uid) {
                unifiedHistoryCache = readHistoryItemsFromCache(currentUser.uid);
            }

            const content = `
                ${getPageHeader('Transaction History')}
                <div class="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    
                    <div id="filter-bar" class="flex space-x-2 overflow-x-auto pb-2 mb-4">
                        <button data-filter="all" class="filter-btn active-filter">All</button>
                        <button data-filter="withdrawal" class="filter-btn">Withdrawal</button>
                        <button data-filter="debit" class="filter-btn">Debit</button>
                        <button data-filter="received" class="filter-btn">Received</button>
                        <button data-filter="sent" class="filter-btn">Sent</button>
                    </div>
                    
                    <div id="all-transactions-list" class="space-y-3 pr-1">
                        </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { keepBottomNav: true });
            currentMainSection = 'transactions';
            setBottomNavActive('bottom-home-btn');
            const pageContainer = document.getElementById('page-container');

            // Initial render of all transactions
            renderFilteredTransactions('all');
            prefetchTransactionHistory(currentUser?.uid)
                .then(() => {
                    const activeFilter = document.querySelector('#filter-bar .active-filter')?.dataset.filter || 'all';
                    renderFilteredTransactions(activeFilter, { reset: false });
                })
                .catch((error) => {
                    console.error('Background transaction refresh failed:', error);
                });

            // Add click listener for filter buttons
            document.getElementById('filter-bar').addEventListener('click', (e) => {
                if (e.target.matches('.filter-btn')) {
                    // Update active button
                    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active-filter'));
                    e.target.classList.add('active-filter');

                    // Filter the list
                    const filter = e.target.dataset.filter;
                    renderFilteredTransactions(filter);
                    pageContainer.scrollTop = 0;
                }
            });

            pageContainer.onscroll = () => {
                if (currentMainSection !== 'transactions') return;
                const distanceFromBottom = pageContainer.scrollHeight - pageContainer.scrollTop - pageContainer.clientHeight;
                if (distanceFromBottom < 180) {
                    loadMoreTransactionsIfNeeded();
                }
            };

            // Keep the click listener for transaction details
            document.getElementById('all-transactions-list').addEventListener('click', (e) => {
                const itemEl = e.target.closest('.tx-item-clickable');
                if (itemEl) {
                    showTransactionDetails(itemEl.dataset.key);
                }
            });
        };

        const WITHDRAW_METHOD_LOGOS = {
            upi: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg',
            bank: 'https://cdn-icons-png.flaticon.com/512/3635/3635987.png',
            play_store: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Google_Play_Arrow_logo.svg',
            amazon_gift: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
            flipkart_gift: 'https://cdn.iconscout.com/icon/free/png-256/free-flipkart-logo-icon-download-in-svg-png-gif-file-formats--online-shopping-brand-logos-pack-icons-226594.png',
            paypal: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
            crypto: 'https://cdn-icons-png.flaticon.com/512/2091/2091665.png'
        };

        const getWithdrawMethodLogo = (methodId) => WITHDRAW_METHOD_LOGOS[methodId] || '';
        const renderWithdrawMethodLogo = (methodId, altText, extraClass = '') => {
            const logo = getWithdrawMethodLogo(methodId);
            return logo ? `<img src="${logo}" class="w-full h-full object-contain ${extraClass}" alt="${altText}" loading="eager" fetchpriority="high" decoding="async">` : '';
        };
        const getWithdrawalMethodName = (methodId, fallback = '') => {
            const names = {
                upi: 'UPI',
                bank: 'Bank Account',
                play_store: 'Google Play Gift Card',
                amazon_gift: 'Amazon Gift Card',
                flipkart_gift: 'Flipkart Gift Card',
                paypal: 'PayPal',
                crypto: 'Crypto'
            };
            return names[methodId] || fallback || 'Withdrawal Method';
        };
        const normalizeWithdrawalMethodId = (item = {}) => {
            const candidates = [
                item.giftCardType,
                item.gift_card_type,
                item.giftCardName,
                item.gift_card_name,
                item.methodId,
                item.paymentMethod,
                item.withdrawMethod,
                item.withdraw_method,
                item.method,
                item.paymentDetails,
                item.comment
            ].map(value => String(value || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));
            for (const raw of candidates) {
                if (!raw || raw === 'gift_card' || raw === 'gift') continue;
                if (raw.includes('upi')) return 'upi';
                if (raw.includes('bank') || raw.includes('account')) return 'bank';
                if (raw.includes('play') || raw.includes('google')) return 'play_store';
                if (raw.includes('amazon')) return 'amazon_gift';
                if (raw.includes('flipkart')) return 'flipkart_gift';
                if (raw.includes('paypal')) return 'paypal';
            }
            if (item.upiId) return 'upi';
            if (item.accountNumber || item.ifsc) return 'bank';
            if (item.email || item.paymentEmail) return 'paypal';
            return candidates.find(Boolean) || '';
        };
        const getWithdrawalDisplayMethodName = (item = {}, fallback = 'N/A') => {
            const methodId = normalizeWithdrawalMethodId(item);
            const knownMethodIds = ['upi', 'bank', 'play_store', 'amazon_gift', 'flipkart_gift', 'paypal', 'crypto'];
            const specificName = knownMethodIds.includes(methodId) ? getWithdrawalMethodName(methodId, '') : '';
            const rawName = String(item.method || item.paymentMethod || fallback || '').trim();
            if (specificName && !['gift card', 'gift_card', 'withdrawal method'].includes(rawName.toLowerCase())) {
                return specificName;
            }
            if (!specificName && ['gift card', 'gift_card'].includes(rawName.toLowerCase())) {
                return 'Gift Card - type not saved';
            }
            return specificName || rawName || fallback;
        };
        const getWithdrawalDetailText = (item = {}) => {
            const methodId = normalizeWithdrawalMethodId(item);
            const details = item.paymentDetails && typeof item.paymentDetails === 'object' ? item.paymentDetails : {};
            const detailText = typeof item.paymentDetails === 'string' ? item.paymentDetails : '';
            if (methodId === 'upi') return item.upiId || item.paymentDetails || 'N/A';
            if (methodId === 'bank') {
                return [
                    (item.accountNumber || details.accountNumber) ? `A/C: ${item.accountNumber || details.accountNumber}` : '',
                    (item.ifsc || details.ifsc) ? `IFSC: ${item.ifsc || details.ifsc}` : '',
                    item.bankName || details.bankName || '',
                    (item.accountName || details.accountName) ? `Name: ${item.accountName || details.accountName}` : ''
                ].filter(Boolean).join(' | ') || detailText || 'N/A';
            }
            if (['play_store', 'amazon_gift', 'flipkart_gift', 'paypal'].includes(methodId)) {
                return item.email || item.paymentEmail || details.email || detailText || 'N/A';
            }
            return detailText || item.upiId || item.accountNumber || item.email || item.paymentEmail || 'N/A';
        };
        const getWithdrawalSnapshot = (data = {}) => ({
            method: getWithdrawalDisplayMethodName(data, getWithdrawalMethodName(data.methodId)),
            methodId: data.methodId || data.paymentMethod || '',
            upiId: data.upiId || '',
            accountNumber: data.accountNumber || '',
            ifsc: data.ifsc || '',
            bankName: data.bankName || '',
            accountName: data.accountName || '',
            email: data.email || '',
            paymentDetails: data.paymentDetails || ''
        });

        // Show Withdraw Page with Professional Logos
        const showWithdrawPage = () => {
            if (!currentUserData) return showNotification('User data not loaded. Please wait.', true);
            loadWithdrawalSettingsOnce().catch(error => console.warn('Withdrawal settings background load skipped:', error));

            if (currentUserData.isFlagged) {
                return showNotification('Your account is flagged. Please contact support.', true);
            }

            if (!currentUserData.paymentMethod) {
                showNotification('Please set your payment method in your profile.', true);
                showProfilePage();
                return;
            }

            const content = `
                ${getPageHeader('Withdraw Funds')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-6">
                    <div class="text-center">
                        <h3 class="text-lg font-semibold">Choose Withdrawal Method</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Select how you want to receive your funds</p>
                    </div>
                    
                    <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-400 transition-all duration-200" data-method="upi">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('upi', 'UPI')}
                            </div>
                        </div>

                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-green-400 transition-all duration-200" data-method="bank">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('bank', 'Bank')}
                            </div>
                        </div>

                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-purple-400 transition-all duration-200" data-method="play_store">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('play_store', 'Play Store')}
                            </div>
                        </div>

                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-orange-400 transition-all duration-200" data-method="amazon_gift">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('amazon_gift', 'Amazon')}
                            </div>
                        </div>

                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-400 transition-all duration-200" data-method="flipkart_gift">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('flipkart_gift', 'Flipkart')}
                            </div>
                        </div>

                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-500 transition-all duration-200" data-method="paypal">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('paypal', 'PayPal')}
                            </div>
                        </div>

                        <div class="payment-option coming-soon border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-not-allowed opacity-70" data-method="crypto">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('crypto', 'Crypto')}
                            </div>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content);

            document.querySelectorAll('.payment-option:not(.coming-soon)').forEach(option => {
                option.addEventListener('click', function () {
                    document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
                    this.classList.add('selected');
                    const method = this.dataset.method;
                    showWithdrawAmountPage(method);
                });
            });

            loadUserPendingWithdrawalsMerged(currentUser.uid)
                .then((pendingWithdrawals) => {
                    const pendingWithdrawalCount = pendingWithdrawals.length;
                    if (pendingWithdrawalCount >= maxPendingWithdrawalsPerUser && document.getElementById('page-container')?.textContent.includes('Choose Withdrawal Method')) {
                        showNotification(`You already have ${pendingWithdrawalCount} pending withdrawal request(s).`, true);
                        hidePage();
                    }
                })
                .catch(error => console.warn('Pending withdrawal background check skipped:', error));
        };


        const showWithdrawAmountPage = (method) => {
            loadWithdrawalSettingsOnce().then(() => applyWithdrawalConfig({})).catch(error => console.warn('Withdrawal settings background load skipped:', error));
            activeWithdrawMethod = method;
            let methodName = '';
            let methodDetails = '';
            const minForMethod = getMinWithdrawalForMethod(method);
            const methodIconMap = {
                upi: renderWithdrawMethodLogo('upi', 'UPI'),
                bank: renderWithdrawMethodLogo('bank', 'Bank'),
                play_store: renderWithdrawMethodLogo('play_store', 'Play Store'),
                amazon_gift: renderWithdrawMethodLogo('amazon_gift', 'Amazon'),
                flipkart_gift: renderWithdrawMethodLogo('flipkart_gift', 'Flipkart'),
                paypal: renderWithdrawMethodLogo('paypal', 'PayPal'),
                crypto: renderWithdrawMethodLogo('crypto', 'Crypto'),
            };

            switch (method) {
                case 'upi':
                    methodName = 'UPI';
                    methodDetails = getProfilePaymentDetails(method).upiId || 'Not set';
                    break;
                case 'bank':
                    methodName = 'Bank Account';
                    const bankDetails = getProfilePaymentDetails(method);
                    methodDetails = `${bankDetails.accountNumber || 'Not set'} - ${bankDetails.bankName || 'Not set'}`;
                    break;
                case 'play_store':
                    methodName = 'Google Play Gift Card';
                    methodDetails = getProfilePaymentDetails(method).email || 'Not set';
                    break;
                case 'amazon_gift':
                    methodName = 'Amazon Gift Card';
                    methodDetails = getProfilePaymentDetails(method).email || 'Not set';
                    break;
                case 'flipkart_gift':
                    methodName = 'Flipkart Gift Card';
                    methodDetails = getProfilePaymentDetails(method).email || 'Not set';
                    break;
                case 'paypal':
                    methodName = 'PayPal';
                    methodDetails = getProfilePaymentDetails(method).email || 'Not set';
                    break;
            }

            if (!isWithdrawMethodDetailsComplete(method)) {
                showWithdrawDetailsMissingModal(method, methodName || getWithdrawalMethodName(method));
                return;
            }

            const content = `
                ${getPageHeader(`Withdraw to ${methodName}`)}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-6">
                    
                    <div class="flex flex-col items-center text-center space-y-4">
                        
                        <div class="p-3 bg-white dark:bg-gray-700 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                            <div class="w-14 h-14 rounded-lg flex items-center justify-center ${method === 'upi' ? 'bg-purple-100' : method === 'bank' ? 'bg-green-100' : 'bg-blue-100'}">
                                ${methodIconMap[method] || `<span class="text-2xl font-bold ${method === 'upi' ? 'text-purple-600' : method === 'bank' ? 'text-green-600' : 'text-blue-600'}">${methodName.charAt(0)}</span>`}
                            </div>
                        </div>
                        
                        <div class="w-full">
                            <h3 class="text-lg font-semibold">Withdraw to ${methodName}</h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">${methodDetails}</p>
                        </div>
                    </div>
                    
                    <hr class="border-gray-200 dark:border-gray-700">
                    
                    <div class="space-y-4">
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Amount to Withdraw</label>
                            <input type="number" id="withdraw-amount-input" placeholder="Enter amount (₹)" min="${minForMethod}" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum withdrawal: ₹${minForMethod}</p>
                        </div>
                    </div>
                    
                    <button id="confirm-withdraw-btn" class="w-full bg-yellow-500 text-white font-semibold py-3 rounded-lg hover:bg-yellow-600 transition">Proceed to Withdraw</button>
                </div>
                ${getPageFooter()}`;

            showPage(content);
            document.getElementById('confirm-withdraw-btn').onclick = () => {
                const amount = parseFloat(document.getElementById('withdraw-amount-input').value);
                handleWithdrawConfirmation(amount, method, methodName);
            };
        };

        const handleWithdrawConfirmation = (amount, method, methodName) => {
            const minForMethod = getMinWithdrawalForMethod(method);
            if (isNaN(amount) || amount < minForMethod) {
                return showNotification(`Minimum withdrawal for ${methodName} is ₹${minForMethod}.`, true);
            }

            if (!currentUserData || getSpendableWalletBalance(currentUserData) < amount) {
                return showNotification(getInsufficientWalletMessage(currentUserData), true);
            }

            let methodDetails = '';
            switch (method) {
                case 'upi':
                    methodDetails = currentUserData.paymentDetails?.upiId || 'Not set';
                    break;
                case 'bank':
                    methodDetails = `A/C: ${currentUserData.paymentDetails?.accountNumber || 'Not set'}, ${currentUserData.paymentDetails?.bankName || 'Not set'}`;
                    break;
                default:
                    methodDetails = currentUserData.paymentDetails?.email || 'Not set';
            }

            renderModal('Confirm Withdrawal',
                `<div class="space-y-4">
                    <div class="text-center">
                        <p class="text-lg font-semibold">Confirm Withdrawal Request</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Transaction ID will be generated after approval</p>
                    </div>
                    <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                        <div class="flex justify-between mb-2">
                            <span class="text-gray-600 dark:text-gray-300">Amount:</span>
                            <span class="font-semibold">${formatCurrency(amount)}</span>
                        </div>
                        <div class="flex justify-between mb-2">
                            <span class="text-gray-600 dark:text-gray-300">Method:</span>
                            <span class="font-semibold">${methodName}</span>
                        </div>
                        <div class="flex justify-between mb-2">
                            <span class="text-gray-600 dark:text-gray-300">Details:</span>
                            <span class="font-semibold text-sm">${methodDetails}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600 dark:text-gray-300">Current Balance:</span>
                            <span class="font-semibold">${formatCurrency(getSpendableWalletBalance(currentUserData))}</span>
                        </div>
                        <div class="flex justify-between mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                            <span class="text-gray-600 dark:text-gray-300">Balance After:</span>
                            <span class="font-semibold">${formatCurrency(getSpendableWalletBalance(currentUserData) - amount)}</span>
                        </div>
                    </div>
                    <p class="text-sm text-gray-500 dark:text-gray-400 text-center">Your withdrawal request will be sent for admin approval. You can only have one pending withdrawal at a time.</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="final-withdraw-btn" class="px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg">Confirm Withdrawal</button>`,
                'max-w-md', true
            );
            document.getElementById('final-withdraw-btn').onclick = () => {
                handleWithdrawRequest(amount, method, methodName);
            };
        };

        // Handle Pay to Wallet Page
        const showPayToWalletPage = () => {
            const content = `
                ${getPageHeader('Pay to Wallet')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-6">
                    <div class="text-center">
                        <h3 class="text-lg font-semibold">Send Money to Another User</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Enter the recipient's mobile number to send money</p>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Recipient Mobile Number</label>
                            <input type="tel" id="recipient-mobile-input" placeholder="Enter mobile number" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Amount</label>
                            <input type="number" id="pay-amount-input" placeholder="Enter amount (₹)" min="1" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum amount: ₹1</p>
                        </div>
                        
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Remarks (Optional)</label>
                            <input type="text" id="pay-comment-input" placeholder="Add a note" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <button id="find-recipient-btn" class="w-full bg-purple-500 text-white font-semibold py-3 rounded-lg hover:bg-purple-600 transition">Find Recipient</button>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            document.getElementById('find-recipient-btn').onclick = handleFindRecipient;
        };

        const getRechargeSummary = () => {
            const amount = parseFloat(document.getElementById('recharge-amount-input')?.value || '0') || 0;
            const discount = Number((amount * RECHARGE_DISCOUNT_RATE).toFixed(2));
            const chargeAmount = Number((amount - discount).toFixed(2));
            return { amount, discount, chargeAmount };
        };

        const updateRechargeSummary = () => {
            const summaryEl = document.getElementById('recharge-summary');
            if (!summaryEl) return;
            const { amount, discount, chargeAmount } = getRechargeSummary();
            summaryEl.innerHTML = `
                <div class="flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">Recharge Amount</span>
                    <span class="font-semibold">${formatCurrency(amount)}</span>
                </div>
                <div class="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>1% Discount</span>
                    <span>-${formatCurrency(discount)}</span>
                </div>
                <div class="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span class="font-semibold">Wallet Deduction</span>
                    <span class="font-bold text-sky-600 dark:text-sky-300">${formatCurrency(chargeAmount)}</span>
                </div>`;
        };

        const showMobileRechargePage = () => {
            if (!currentUserData) return showNotification('User data not loaded. Please wait.', true);
            if (currentUserData.isFlagged) {
                return showNotification('Your account is flagged. Please contact support.', true);
            }

            const operatorOptions = RECHARGE_OPERATORS.map(op => `<option value="${op}">${op}</option>`).join('');
            const stateOptions = RECHARGE_STATES.map(state => `<option value="${state}">${state}</option>`).join('');
            const content = `
                ${getPageHeader('Mobile Recharge')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-5">
                    <div class="text-center">
                        <div class="mx-auto w-14 h-14 rounded-2xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center mb-3 p-2">
                            <img src="https://cdn-icons-png.flaticon.com/512/4108/4108841.png" alt="Mobile recharge" class="w-full h-full object-contain">
                        </div>
                        <h3 class="text-lg font-semibold">Place Recharge Request</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Fill the plan details. Admin will complete it manually.</p>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Mobile Number</label>
                            <input type="tel" id="recharge-mobile-input" maxlength="10" placeholder="Enter 10 digit mobile number" value="${currentUserData.mobile || ''}" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Operator</label>
                                <select id="recharge-operator-select" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
                                    <option value="">Select operator</option>
                                    ${operatorOptions}
                                </select>
                            </div>
                            <div>
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">State / Circle</label>
                                <select id="recharge-state-select" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
                                    <option value="">Select state</option>
                                    ${stateOptions}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Recharge Amount</label>
                            <input type="number" id="recharge-amount-input" min="1" placeholder="Enter plan amount (₹)" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Validity / Plan Details</label>
                            <textarea id="recharge-details-input" rows="3" placeholder="Example: 28 days, 1.5GB/day, unlimited calls" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"></textarea>
                        </div>
                    </div>

                    <div id="recharge-summary" class="space-y-2 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 rounded-xl p-4"></div>
                    <button id="submit-recharge-btn" class="w-full bg-sky-600 text-white font-semibold py-3 rounded-lg hover:bg-sky-700 transition">Continue to Checkout</button>
                </div>
                ${getPageFooter()}`;

            showPage(content);
            updateRechargeSummary();
            document.getElementById('recharge-amount-input').addEventListener('input', updateRechargeSummary);
            document.getElementById('submit-recharge-btn').onclick = handleRechargeCheckout;
        };

        const handleRechargeCheckout = () => {
            const mobileNumber = document.getElementById('recharge-mobile-input').value.trim();
            const operator = document.getElementById('recharge-operator-select').value;
            const state = document.getElementById('recharge-state-select').value;
            const planDetails = document.getElementById('recharge-details-input').value.trim();
            const { amount, discount, chargeAmount } = getRechargeSummary();

            if (!/^\d{10}$/.test(mobileNumber)) return showNotification('Please enter a valid 10 digit mobile number.', true);
            if (!operator) return showNotification('Please select operator.', true);
            if (!state) return showNotification('Please select state.', true);
            if (amount <= 0) return showNotification('Please enter a valid recharge amount.', true);
            if (!planDetails) return showNotification('Please enter validity or plan details.', true);
            if (getSpendableWalletBalance(currentUserData) < chargeAmount) return showNotification(getInsufficientRechargeMessage(currentUserData, chargeAmount), true);

            renderModal('Confirm Mobile Recharge',
                `<div class="space-y-4">
                    <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg space-y-2 text-sm">
                        <div class="flex justify-between gap-3"><span class="text-gray-500 dark:text-gray-400">Mobile</span><span class="font-semibold">${mobileNumber}</span></div>
                        <div class="flex justify-between gap-3"><span class="text-gray-500 dark:text-gray-400">Operator</span><span class="font-semibold">${operator}</span></div>
                        <div class="flex justify-between gap-3"><span class="text-gray-500 dark:text-gray-400">State</span><span class="font-semibold text-right">${state}</span></div>
                        <div class="flex justify-between gap-3"><span class="text-gray-500 dark:text-gray-400">Plan</span><span class="font-semibold text-right">${planDetails}</span></div>
                        <div class="pt-2 mt-2 border-t border-gray-300 dark:border-gray-600 space-y-2">
                            <div class="flex justify-between"><span>Recharge Amount</span><span>${formatCurrency(amount)}</span></div>
                            <div class="flex justify-between text-green-600"><span>1% Discount</span><span>-${formatCurrency(discount)}</span></div>
                            <div class="flex justify-between font-bold"><span>Wallet Deduction</span><span>${formatCurrency(chargeAmount)}</span></div>
                        </div>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 text-center">Recharge will stay pending until admin completes it and enters transaction ID.</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-recharge-btn" class="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg">Place Request</button>`,
                'max-w-md', true
            );

            document.getElementById('confirm-recharge-btn').onclick = () => {
                handleSubmitRechargeRequest({ mobileNumber, operator, state, planDetails, amount, discount, chargeAmount });
            };
        };

        const showAdminWithdrawalsPage = () => {
            const content = `
                ${getPageHeader('Pending Withdrawal Requests')}
                <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
                    <div class="relative flex items-center gap-2">
                        <input type="search" id="pending-withdrawal-search" value="${escapeHtml(adminPendingWithdrawalSearch)}" placeholder="Search name, mobile, email, amount, method" class="min-w-0 flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500">
                        <button id="pending-withdrawal-actions-btn" class="h-10 w-10 shrink-0 rounded-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-xl font-black text-yellow-700 dark:text-yellow-200 shadow-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/40" title="More actions">&#8942;</button>
                        <div id="pending-withdrawal-actions-menu" class="hidden absolute right-0 top-12 z-20 w-64 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-xl">
                            <p id="legacy-pending-withdrawal-summary" class="mb-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-[11px] leading-4 text-yellow-800 dark:text-yellow-100">Checking pending withdrawals without balance cut...</p>
                            <button id="fix-legacy-pending-withdrawals-btn" class="w-full rounded-lg px-3 py-2 text-left text-xs font-black text-yellow-700 dark:text-yellow-200 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 disabled:opacity-50 disabled:cursor-not-allowed">Deduct Uncut Pending</button>
                            <button id="refresh-pending-withdrawals-btn" class="w-full rounded-lg px-3 py-2 text-left text-xs font-black text-blue-700 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/30">Refresh List</button>
                        </div>
                    </div>
                    <div id="admin-fund-requests-list-page" class="max-h-[75vh] overflow-y-auto"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            const searchInput = document.getElementById('pending-withdrawal-search');
            const applySearch = () => {
                adminPendingWithdrawalSearch = (searchInput?.value || '').trim().toLowerCase();
                renderAdminFundRequests(allFundRequestsCache);
            };
            searchInput?.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') applySearch();
            });
            searchInput?.addEventListener('input', () => {
                adminPendingWithdrawalSearch = (searchInput.value || '').trim().toLowerCase();
                renderAdminFundRequests(allFundRequestsCache);
            });
            const actionBtn = document.getElementById('pending-withdrawal-actions-btn');
            const actionMenu = document.getElementById('pending-withdrawal-actions-menu');
            actionBtn?.addEventListener('click', (event) => {
                event.stopPropagation();
                actionMenu?.classList.toggle('hidden');
            });
            document.addEventListener('click', (event) => {
                if (!actionMenu || !actionBtn || actionMenu.classList.contains('hidden')) return;
                if (!actionMenu.contains(event.target) && !actionBtn.contains(event.target)) {
                    actionMenu.classList.add('hidden');
                }
            });
            document.getElementById('fix-legacy-pending-withdrawals-btn')?.addEventListener('click', handleFixLegacyPendingWithdrawals);
            document.getElementById('refresh-pending-withdrawals-btn')?.addEventListener('click', () => refreshAdminFundRequestsFromCloud());
            renderAdminFundRequests(allFundRequestsCache);
            updateLegacyWithdrawalFixSummary();
            refreshAdminFundRequestsFromCloud();
        };

        const showAdminRechargeRequestsPage = () => {
            const content = `
                ${getPageHeader('Pending Recharge Requests')}
                <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
                    <div id="admin-recharge-requests-list-page" class="max-h-[75vh] overflow-y-auto"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            renderAdminRechargeRequests(allRechargeRequestsCache);
            refreshAdminFundRequestsFromCloud();
        };

        const getNextMonthRepaymentDate = (fromDate = new Date()) => {
            const year = fromDate.getFullYear();
            const month = fromDate.getMonth();
            const day = fromDate.getDate();
            const daysInNextMonth = new Date(year, month + 2, 0).getDate();
            return new Date(year, month + 1, Math.min(day, daysInNextMonth), 23, 59, 59);
        };

        const addMonthsClamped = (date, months) => {
            const start = new Date(date);
            const day = start.getDate();
            const target = new Date(start.getFullYear(), start.getMonth() + months + 1, 0);
            return new Date(start.getFullYear(), start.getMonth() + months, Math.min(day, target.getDate()), 23, 59, 59);
        };

        const addDays = (date, days) => {
            const next = new Date(date);
            next.setDate(next.getDate() + days);
            return next;
        };

        const toDate = (value) => value?.toDate ? value.toDate() : value ? new Date(value) : null;

        const getLoanRequestStatus = (request = {}) => {
            request = request || {};
            return String(request.status || request.loanRequestStatus || '').trim().toLowerCase();
        };
        const isPendingModernLoanRequest = (request = {}) => isModernLoanRequest(request) && getLoanRequestStatus(request) === 'pending';
        const isRejectedModernLoanRequest = (request = {}) =>
            isModernLoanRequest(request) && ['rejected', 'cancelled', 'canceled', 'failed', 'denied'].includes(getLoanRequestStatus(request));
        const getValidDateFromMillis = (millis) => millis ? new Date(millis) : null;
        const getLoanRequestReapplyDate = (request = {}) => {
            request = request || {};
            const explicitMillis = timestampToMillis(request.reapplyAfter || request.loanReapplyAfter || request.reapplyAt || request.cooldownUntil);
            const explicitDate = getValidDateFromMillis(explicitMillis);
            if (explicitDate && !Number.isNaN(explicitDate.getTime())) return explicitDate;
            const baseMillis = timestampToMillis(
                request.processedAt || request.rejectedAt || request.cancelledAt || request.canceledAt ||
                request.requestedAt || request.timestamp || request.createdAt
            );
            const baseDate = getValidDateFromMillis(baseMillis) || new Date();
            return addMonthsClamped(baseDate, LOAN_REAPPLY_WAIT_MONTHS);
        };
        const getLoanReapplyBlock = (request = {}) => {
            request = request || {};
            if (!isRejectedModernLoanRequest(request)) return null;
            const reapplyAt = getLoanRequestReapplyDate(request);
            if (!reapplyAt || Number.isNaN(reapplyAt.getTime()) || reapplyAt <= new Date()) return null;
            return {
                reapplyAt,
                reason: request.rejectionReason || request.reason || request.adminReason || 'Admin cancelled or rejected your loan request.'
            };
        };
        const getUserLoanRequestMarker = (user = currentUserData || {}) => {
            user = user || {};
            return {
                userId: user.id || user.uid || currentUser?.uid || '',
                status: user.loanRequestStatus || '',
                latestLoanRequestVersion: user.latestLoanRequestVersion || user.loanRequestVersion || user.loanApplicationVersion || 0,
                reapplyAfter: user.loanReapplyAfter || user.reapplyAfter || null,
                processedAt: user.loanProcessedAt || user.processedAt || null,
                rejectionReason: user.loanRejectionReason || user.loanRequestRejectionReason || user.rejectionReason || '',
                loanDocumentsSubmitted: user.loanDocumentsSubmitted === true,
                loanDocumentsVerified: user.loanDocumentsVerified === true,
                loanDocumentsApproved: user.loanDocumentsApproved === true,
                personalDetails: (user.loanDocumentsSubmitted === true || user.loanDocumentsVerified === true || user.loanDocumentsApproved === true) ? {
                    name: user.name || '',
                    mobile: getUserMobileValue(user) || ''
                } : null
            };
        };

        const getActiveLoanFromUserMarker = (user = currentUserData || {}) => {
            user = user || {};
            if (Number(user.activeLoanVersion || 0) < LOAN_APPLICATION_VERSION) return null;
            const activeLoanId = String(user.activeLoanId || '').trim();
            const totalRepayable = Number(user.activeLoanRepayable ?? user.loanLockedAmount ?? 0);
            if (!activeLoanId && totalRepayable <= 0) return null;
            const amount = Number(user.activeLoanAmount ?? user.activeLoanPrincipal ?? user.loanPrincipal ?? 0);
            return {
                id: activeLoanId || `active-${user.id || user.uid || currentUser?.uid || 'loan'}`,
                userId: user.id || user.uid || currentUser?.uid || '',
                userName: user.name || 'User',
                userMobile: user.mobile || '',
                amount,
                principal: amount,
                interest: Number(user.activeLoanInterest ?? Math.max(0, totalRepayable - amount)),
                totalRepayable,
                lockedAmount: totalRepayable,
                dueDate: user.activeLoanDueDate || user.loanDueDate || null,
                status: 'active',
                loanApplicationVersion: LOAN_APPLICATION_VERSION,
                loanRequestVersion: LOAN_APPLICATION_VERSION,
                createdAt: user.activeLoanCreatedAt || Date.now()
            };
        };

        const getPartnerInvestmentSummary = () => {
            const amount = parseFloat(document.getElementById('partner-amount-input')?.value || '0') || 0;
            const months = parseInt(document.getElementById('partner-months-input')?.value || '0') || 0;
            const startDate = new Date();
            const endDate = months > 0 ? addMonthsClamped(startDate, months) : null;
            const monthlyInterest = Number((amount * PARTNER_INTEREST_RATE).toFixed(2));
            const totalInterest = Number((monthlyInterest * months).toFixed(2));
            return { amount, months, startDate, endDate, monthlyInterest, totalInterest };
        };

        const updatePartnerInvestmentSummary = () => {
            const summaryEl = document.getElementById('partner-investment-summary');
            if (!summaryEl) return;
            const { amount, months, startDate, endDate, monthlyInterest, totalInterest } = getPartnerInvestmentSummary();
            summaryEl.innerHTML = `
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div class="rounded-xl bg-white/80 dark:bg-gray-800 p-3 border border-emerald-100 dark:border-emerald-800">
                        <p class="text-xs text-gray-500">Start Month</p>
                        <p class="font-bold">${startDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div class="rounded-xl bg-white/80 dark:bg-gray-800 p-3 border border-emerald-100 dark:border-emerald-800">
                        <p class="text-xs text-gray-500">Ending Month</p>
                        <p class="font-bold">${endDate ? endDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Select months'}</p>
                    </div>
                    <div class="rounded-xl bg-white/80 dark:bg-gray-800 p-3 border border-emerald-100 dark:border-emerald-800">
                        <p class="text-xs text-gray-500">Monthly Interest</p>
                        <p class="font-bold">${formatCurrency(monthlyInterest)}</p>
                    </div>
                    <div class="rounded-xl bg-white/80 dark:bg-gray-800 p-3 border border-emerald-100 dark:border-emerald-800">
                        <p class="text-xs text-gray-500">Total Interest</p>
                        <p class="font-bold text-emerald-600">${formatCurrency(totalInterest)}</p>
                    </div>
                </div>
                <div class="mt-3 flex justify-between rounded-xl bg-emerald-600 text-white p-3">
                    <span>Total Maturity Value</span>
                    <span class="font-bold">${formatCurrency(amount + totalInterest)}</span>
                </div>`;
        };

        const buildLoanSummary = (user = currentUserData || {}, loans = []) => {
            const modernLoans = loans.filter(isModernLoanRecord);
            const activeLoans = modernLoans.filter(isActiveLoanRecord);
            const maxLimit = getLoanLimitAmount(user);
            const usedAmount = activeLoans.reduce((sum, loan) => sum + getLoanPrincipal(loan), 0);
            const repayableAmount = activeLoans.reduce((sum, loan) => sum + Number(loan.totalRepayable || 0), 0);
            return {
                maxLimit,
                usedAmount,
                repayableAmount,
                availableAmount: Math.max(0, maxLimit - usedAmount),
                activeLoans,
                loans: modernLoans
            };
        };

        const normalizeLoanDob = (dob = '') => {
            const value = String(dob || '').trim();
            const match = /^(\d{1,2})[\/_-](\d{1,2})[\/_-](\d{4})$/.exec(value);
            if (!match) return value;
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            return `${day}/${month}/${year}`;
        };

        const getLoanRequestPersonal = () => ({
            name: document.getElementById('loan-name-input')?.value.trim() || '',
            fatherName: document.getElementById('loan-father-input')?.value.trim() || '',
            mobile: document.getElementById('loan-mobile-input')?.value.trim() || '',
            alternateMobile: document.getElementById('loan-alt-mobile-input')?.value.trim() || '',
            dob: normalizeLoanDob(document.getElementById('loan-dob-input')?.value || ''),
            aadhaar: document.getElementById('loan-aadhaar-input')?.value.trim() || ''
        });

        const saveLoanApplicationDraftFromDom = (step = loanApplicationDraft.step || 1) => {
            if (step === 1) {
                loanApplicationDraft.personal = getLoanRequestPersonal();
            }
            if (step === 3) {
                loanApplicationDraft.acceptedTerms = !!document.getElementById('loan-final-terms-checkbox')?.checked;
            }
        };

        const validateLoanApplicationStep = (step) => {
            if (step === 1) {
                const { name, fatherName, mobile, alternateMobile, dob, aadhaar } = loanApplicationDraft.personal || {};
                if (!name || !fatherName || !/^\d{10}$/.test(mobile) || !/^\d{10}$/.test(alternateMobile) || !isValidLoanDob(dob) || !/^\d{12}$/.test(aadhaar)) {
                    showNotification('Please fill all personal details correctly.', true);
                    return false;
                }
            }
            if (step === 2) {
                const docs = loanApplicationDraft.documents || {};
                const documentError = validateLoanDocumentSelection(docs.aadhaarFile, 'aadhaar') || validateLoanDocumentSelection(docs.selfieFile, 'selfie');
                if (documentError) {
                    showNotification(documentError, true);
                    return false;
                }
            }
            if (step === 3 && !loanApplicationDraft.acceptedTerms) {
                showNotification('Please accept loan terms before applying.', true);
                return false;
            }
            return true;
        };

        const renderLoanStepCircles = (step) => {
            const steps = [
                { id: 1, title: 'Personal Details' },
                { id: 2, title: 'Documents' },
                { id: 3, title: 'Done' }
            ];
            const progressWidth = step <= 1 ? '0%' : step === 2 ? '50%' : '100%';
            return `
                <div class="relative px-3 pb-1 pt-2">
                    <div class="absolute left-[18%] right-[18%] top-7 h-1 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                    <div class="absolute left-[18%] top-7 h-1 rounded-full bg-gradient-to-r from-indigo-600 via-blue-500 to-emerald-500 transition-all duration-300" style="width:${progressWidth}; max-width:64%;"></div>
                    <div class="relative grid grid-cols-3 gap-2">
                    ${steps.map(item => {
                        const active = item.id === step;
                        const complete = item.id < step;
                        return `
                            <div class="flex flex-col items-center text-center">
                                <div class="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-black shadow-sm transition-all duration-300 ${complete ? 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-200 dark:shadow-none' : active ? 'border-indigo-600 bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none scale-105' : 'border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900'}">${complete ? '&#10003;' : item.id}</div>
                                <p class="mt-3 text-[10px] font-black uppercase leading-tight ${active ? 'text-indigo-700 dark:text-indigo-300' : complete ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400'}">${item.title}</p>
                            </div>`;
                    }).join('')}
                    </div>
                </div>`;
        };

        const showLoanPendingPage = () => {
            showPage(`
                ${getPageHeader('Take Loan')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md text-center space-y-3">
                    <div class="w-14 h-14 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 mx-auto flex items-center justify-center">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"></path></svg>
                    </div>
                    <h3 class="text-lg font-semibold">Loan Request Pending</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Your updated details and documents have been sent to admin. After approval, your credit limit will appear here.</p>
                </div>
                ${getPageFooter()}`);
        };

        const showLoanRejectedCooldownPage = (request = {}) => {
            const block = getLoanReapplyBlock(request);
            const reapplyText = block?.reapplyAt
                ? block.reapplyAt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : 'after 3 months';
            showPage(`
                ${getPageHeader('Take Loan')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md text-center space-y-4">
                    <div class="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 mx-auto flex items-center justify-center">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path></svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold">You are currently not eligible.</h3>
                        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Your loan request was cancelled or rejected by admin.</p>
                    </div>
                    <div class="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 text-left text-sm">
                        <p class="text-xs font-black uppercase text-red-500">Reason</p>
                        <p class="mt-1 text-gray-700 dark:text-gray-200">${escapeHtml(block?.reason || 'Admin cancelled or rejected your loan request.')}</p>
                    </div>
                    <div class="rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4">
                        <p class="text-xs font-black uppercase text-indigo-600 dark:text-indigo-300">Apply Again</p>
                        <p class="mt-1 font-black text-gray-900 dark:text-white">${escapeHtml(reapplyText)}</p>
                        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">After 3 months you can submit a fresh loan form.</p>
                    </div>
                </div>
                ${getPageFooter()}`);
        };

        const showLoanCreditDashboardPage = (loans = []) => {
            const summary = buildLoanSummary(currentUserData, loans);
            const activeLoan = summary.activeLoans[0] || null;
            const canTakeLoan = hasModernLoanApproval(currentUserData) && summary.activeLoans.length === 0 && summary.availableAmount > 0;
            const historyCards = summary.loans.length ? summary.loans.map(loan => {
                const dueDate = toDate(loan.dueDate);
                const createdAt = toDate(loan.createdAt);
                const isActive = isActiveLoanRecord(loan);
                return `
                    <button data-action="user-view-loan-detail" data-loanid="${loan.id}" class="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-left shadow-sm">
                        <div class="flex justify-between gap-3">
                            <div>
                                <p class="text-sm font-black text-gray-900 dark:text-white">${formatCurrency(loan.amount || 0)}</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400">${createdAt ? createdAt.toLocaleDateString('en-IN') : 'Loan date N/A'} | Due ${dueDate ? dueDate.toLocaleDateString('en-IN') : 'N/A'}</p>
                            </div>
                            <span class="h-fit rounded-full px-3 py-1 text-[10px] font-black uppercase ${isActive ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'}">${escapeHtml(loan.status || 'active')}</span>
                        </div>
                        <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div class="rounded-xl bg-gray-50 dark:bg-gray-700 p-2"><span class="text-gray-500">Interest</span><p class="font-bold">${formatCurrency(loan.interest || 0)}</p></div>
                            <div class="rounded-xl bg-gray-50 dark:bg-gray-700 p-2"><span class="text-gray-500">Repay</span><p class="font-bold">${formatCurrency(loan.totalRepayable || 0)}</p></div>
                        </div>
                    </button>`;
            }).join('') : '<p class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-5 text-center text-sm font-bold text-gray-500">No loan history yet.</p>';

            showPage(`
                ${getPageHeader('Take Loan')}
                <div class="max-w-md mx-auto space-y-5">
                    <div class="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-900 to-blue-700 p-5 text-white shadow-xl">
                        <p class="text-xs font-black uppercase tracking-widest text-white/60">RW Pay Later</p>
                        <div class="mt-4 grid grid-cols-2 gap-3">
                            <div>
                                <p class="text-xs text-white/60">Max Limit</p>
                                <p class="text-2xl font-black">${formatCurrency(summary.maxLimit)}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-xs text-white/60">Available</p>
                                <p class="text-2xl font-black">${formatCurrency(summary.availableAmount)}</p>
                            </div>
                        </div>
                        <div class="mt-4 rounded-2xl bg-white/10 p-3 text-sm">
                            <div class="flex justify-between"><span>Used Amount</span><span class="font-black">${formatCurrency(summary.usedAmount)}</span></div>
                            <div class="mt-1 flex justify-between"><span>Total Repayable</span><span class="font-black">${formatCurrency(summary.repayableAmount)}</span></div>
                        </div>
                    </div>
                    <button id="loan-dashboard-action-btn" ${canTakeLoan || activeLoan ? '' : 'disabled'} class="w-full rounded-2xl ${canTakeLoan ? 'bg-indigo-600 hover:bg-indigo-700' : activeLoan ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 cursor-not-allowed'} py-3 font-black text-white transition">
                        ${canTakeLoan ? 'Take Loan' : activeLoan ? 'Repay Active Loan' : 'No Available Limit'}
                    </button>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between px-1">
                            <h3 class="text-sm font-black text-gray-900 dark:text-white">Loan History</h3>
                            <span class="text-xs font-bold text-gray-400">${summary.loans.length} record(s)</span>
                        </div>
                        ${historyCards}
                    </div>
                </div>
                ${getPageFooter()}`);

            document.getElementById('loan-dashboard-action-btn')?.addEventListener('click', () => {
                if (canTakeLoan) return showTakeLoanPage();
                if (activeLoan) return showActiveLoanPage(activeLoan);
            });
        };

        const runAfterFirstPaint = (callback) => {
            const run = () => setTimeout(callback, 0);
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(run);
            } else {
                run();
            }
        };

        const showLoanPage = () => {
            if (!currentUser || !currentUserData) return showNotification('User data not loaded. Please wait.', true);

            const showLoanApplicationStart = () => {
                loanApplicationDraft = {
                    step: 1,
                    personal: {
                        name: currentUserData.name || '',
                        mobile: currentUserData.mobile || '',
                        fatherName: '',
                        alternateMobile: '',
                        dob: '',
                        aadhaar: ''
                    },
                    documents: {},
                    acceptedTerms: false
                };
                showLoanApplicationPage(1);
            };

            const markerLoan = getActiveLoanFromUserMarker(currentUserData);
            const markerRequest = getUserLoanRequestMarker(currentUserData);
            const markerRequests = isModernLoanRequest(markerRequest) ? [markerRequest] : [];
            const markerLoans = markerLoan ? [markerLoan] : [];

            const renderLoanState = (loans = markerLoans, requests = markerRequests) => {
                const pendingModernRequest = requests.find(isPendingModernLoanRequest) || null;
                const latestModernRequest = getLatestModernLoanRequest(currentUser.uid, requests);
                const userLoanMarker = getUserLoanRequestMarker(currentUserData);
                const activeLoans = loans.filter(isActiveLoanRecord);
                if (activeLoans.length || hasDocumentedModernLoanApproval(currentUserData, requests)) {
                    showLoanCreditDashboardPage(loans);
                    return;
                }
                if (pendingModernRequest || isPendingModernLoanRequest(userLoanMarker)) {
                    showLoanPendingPage();
                    return;
                }
                const reapplyBlock = getLoanReapplyBlock(latestModernRequest) || getLoanReapplyBlock(userLoanMarker);
                if (reapplyBlock) {
                    showLoanRejectedCooldownPage(latestModernRequest || userLoanMarker);
                    return;
                }
                showLoanApplicationStart();
            };

            renderLoanState(markerLoans, markerRequests);

            runAfterFirstPaint(async () => {
                let userLoans = getUserLoanRecords(currentUser.uid);
                if (markerLoan && !userLoans.some(loan => loan.id === markerLoan.id)) {
                    userLoans = [markerLoan, ...userLoans];
                }
                let userLoanRequests = allLoanRequestsCache
                    .filter(request => request && request.userId === currentUser.uid && isModernLoanRequest(request))
                    .sort((a, b) => timestampToMillis(b.requestedAt || b.processedAt) - timestampToMillis(a.requestedAt || a.processedAt));
                if (markerRequests.length && !userLoanRequests.some(request => request.id && request.id === markerRequests[0].id)) {
                    userLoanRequests = [...markerRequests, ...userLoanRequests];
                }
                renderLoanState(userLoans, userLoanRequests);

                try {
                    const [freshUserSnap, loanSnap, loanReqSnap] = await Promise.all([
                        getDoc(doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid)),
                        getDocs(query(collection(db, `artifacts/${appId}/public/data/loans`), where("userId", "==", currentUser.uid))),
                        getDocs(query(collection(db, `artifacts/${appId}/public/data/loan_requests`), where("userId", "==", currentUser.uid)))
                    ]);
                    if (freshUserSnap.exists()) {
                        currentUserData = { ...currentUserData, ...freshUserSnap.data(), id: currentUser.uid, uid: currentUser.uid };
                        writeCache(getUserCacheKey(currentUser.uid), currentUserData);
                    }
                    userLoans = loanSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                        .filter(isModernLoanRecord)
                        .sort((a, b) => timestampToMillis(b.createdAt || b.paidAt) - timestampToMillis(a.createdAt || a.paidAt));
                    const freshMarkerLoan = getActiveLoanFromUserMarker(currentUserData);
                    if (freshMarkerLoan && !userLoans.some(loan => loan.id === freshMarkerLoan.id)) {
                        userLoans = [freshMarkerLoan, ...userLoans];
                    }
                    allLoansCache = [
                        ...allLoansCache.filter(loan => loan && loan.userId !== currentUser.uid),
                        ...userLoans
                    ];
                    userLoanRequests = loanReqSnap.docs
                        .map(d => ({ id: d.id, ...d.data() }))
                        .filter(isModernLoanRequest)
                        .sort((a, b) => timestampToMillis(b.requestedAt || b.processedAt) - timestampToMillis(a.requestedAt || a.processedAt));
                    const freshMarkerRequest = getUserLoanRequestMarker(currentUserData);
                    if (isModernLoanRequest(freshMarkerRequest) && !userLoanRequests.some(request => request.id && request.id === freshMarkerRequest.id)) {
                        userLoanRequests = [freshMarkerRequest, ...userLoanRequests];
                    }
                    allLoanRequestsCache = [
                        ...allLoanRequestsCache.filter(request => request && request.userId !== currentUser.uid),
                        ...userLoanRequests
                    ].sort((a, b) => timestampToMillis(b.requestedAt || b.processedAt) - timestampToMillis(a.requestedAt || a.processedAt));
                    renderLoanState(userLoans, userLoanRequests);
                } catch (error) {
                    console.warn('Fresh loan state check skipped:', error);
                }
            });
        };

        const showLoanApplicationPage = (step = 1) => {
            loanApplicationDraft.step = step;
            const personal = {
                name: currentUserData?.name || '',
                mobile: currentUserData?.mobile || '',
                fatherName: '',
                alternateMobile: '',
                dob: '',
                aadhaar: '',
                ...(loanApplicationDraft.personal || {})
            };
            personal.dob = normalizeLoanDob(personal.dob);
            const docs = loanApplicationDraft.documents || {};
            const inputClass = 'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base font-semibold text-slate-950 shadow-inner outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40';
            const stepContent = step === 1 ? `
                <div class="space-y-3">
                    <input id="loan-name-input" value="${escapeHtml(personal.name)}" placeholder="Your name" class="${inputClass}">
                    <input id="loan-father-input" value="${escapeHtml(personal.fatherName)}" placeholder="Father's name" class="${inputClass}">
                    <input id="loan-mobile-input" value="${escapeHtml(personal.mobile)}" maxlength="10" inputmode="numeric" placeholder="Mobile no." class="${inputClass}">
                    <input id="loan-alt-mobile-input" value="${escapeHtml(personal.alternateMobile)}" maxlength="10" inputmode="numeric" placeholder="Alternate no." class="${inputClass}">
                    <input id="loan-dob-input" value="${escapeHtml(personal.dob)}" maxlength="10" autocomplete="bday" placeholder="Date of birth (DD/MM/YYYY)" class="${inputClass}">
                    <input id="loan-aadhaar-input" value="${escapeHtml(personal.aadhaar)}" maxlength="12" inputmode="numeric" placeholder="Aadhaar number" class="${inputClass}">
                </div>` : step === 2 ? `
                <div class="space-y-3">
                    <label class="group block rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/70 p-5 text-center shadow-inner transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/10">
                        <input id="loan-aadhaar-file-input" type="file" accept="image/*,.pdf" class="hidden">
                        <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-gray-900">
                            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01.88-7.9A5 5 0 1117 11h1a3 3 0 010 6h-4m-4-4l2-2m0 0l2 2m-2-2v8"></path></svg>
                        </span>
                        <span class="mt-3 block text-sm font-black text-gray-900 dark:text-white">Upload Aadhaar Card</span>
                        <span id="loan-aadhaar-file-label" class="mt-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">${escapeHtml(docs.aadhaarName || 'Tap to select Aadhaar image/PDF')}</span>
                    </label>
                    <label class="group block rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/70 p-5 text-center shadow-inner transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10">
                        <input id="loan-selfie-file-input" type="file" accept="image/*" capture="user" class="hidden">
                        <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm dark:bg-gray-900">
                            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 1116.5 0"></path></svg>
                        </span>
                        <span class="mt-3 block text-sm font-black text-gray-900 dark:text-white">Upload Selfie</span>
                        <span id="loan-selfie-file-label" class="mt-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">${escapeHtml(docs.selfieName || 'Tap to select live selfie')}</span>
                    </label>
                    <p class="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">Admin will verify Aadhaar and selfie match before approving loan limit.</p>
                </div>` : `
                <div class="space-y-4">
                    <div class="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 text-sm shadow-inner dark:border-indigo-900/40 dark:from-indigo-900/20 dark:to-blue-900/10">
                        <div class="flex justify-between gap-3"><span>Name</span><span class="font-bold text-right">${escapeHtml(personal.name || 'N/A')}</span></div>
                        <div class="mt-2 flex justify-between gap-3"><span>Mobile</span><span class="font-bold text-right">${escapeHtml(personal.mobile || 'N/A')}</span></div>
                        <div class="mt-2 flex justify-between gap-3"><span>Documents</span><span class="font-bold text-right">${docs.aadhaarFile && docs.selfieFile ? 'Aadhaar + Selfie ready' : 'Missing'}</span></div>
                    </div>
                    <label class="flex items-center gap-3 rounded-3xl border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900">
                        <input type="checkbox" id="loan-final-terms-checkbox" class="h-5 w-5" ${loanApplicationDraft.acceptedTerms ? 'checked' : ''}>
                        <span>I agree to the <button id="loan-final-agreement-link" type="button" class="text-indigo-600 dark:text-indigo-300 font-black underline">loan agreement and security terms</button>.</span>
                    </label>
                </div>`;

            const content = `
                ${getPageHeader('Take Loan')}
                <div class="max-w-md mx-auto overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-[0_22px_55px_rgba(15,23,42,0.12)] dark:border-gray-700 dark:bg-gray-800">
                    <div class="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-blue-700 to-emerald-600 px-5 pb-7 pt-6 text-white">
                        <div class="absolute -right-8 -top-10 h-28 w-28 rounded-full border border-white/20"></div>
                        <div class="absolute right-8 bottom-3 h-12 w-12 rounded-2xl bg-white/10"></div>
                        <p class="relative text-[10px] font-black uppercase tracking-[0.22em] text-white/65">Loan Request</p>
                        <h3 class="relative mt-1 text-2xl font-black">Verify & Apply</h3>
                        <p class="relative mt-1 text-xs font-semibold text-white/75">Complete all 3 steps for admin approval.</p>
                    </div>
                    <div class="-mt-4 space-y-5 rounded-t-[1.75rem] bg-white p-5 dark:bg-gray-800">
                    ${renderLoanStepCircles(step)}
                    <div class="overflow-hidden">
                        <div class="transition-transform duration-200 ease-out">${stepContent}</div>
                    </div>
                    <div class="flex gap-2">
                        ${step > 1 ? '<button id="loan-back-step-btn" class="flex-1 rounded-2xl bg-gray-100 py-3.5 text-sm font-black text-gray-700 shadow-sm transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">Back</button>' : ''}
                        ${step < 3 ? '<button id="loan-next-step-btn" class="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-700 hover:to-blue-700 dark:shadow-none">Next</button>' : '<button id="submit-loan-request-btn" class="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-700 hover:to-emerald-700 dark:shadow-none">Apply Now</button>'}
                    </div>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content);

            document.getElementById('loan-back-step-btn')?.addEventListener('click', () => {
                saveLoanApplicationDraftFromDom(step);
                showLoanApplicationPage(step - 1);
            });
            document.getElementById('loan-next-step-btn')?.addEventListener('click', () => {
                saveLoanApplicationDraftFromDom(step);
                if (validateLoanApplicationStep(step)) showLoanApplicationPage(step + 1);
            });
            document.getElementById('submit-loan-request-btn')?.addEventListener('click', () => {
                saveLoanApplicationDraftFromDom(step);
                if (validateLoanApplicationStep(step)) handleSubmitLoanRequest();
            });
            document.getElementById('loan-final-agreement-link')?.addEventListener('click', showLoanAgreementModal);
            document.getElementById('loan-dob-input')?.addEventListener('blur', (event) => {
                event.target.value = normalizeLoanDob(event.target.value);
            });
            document.getElementById('loan-aadhaar-file-input')?.addEventListener('change', (event) => {
                const file = event.target.files?.[0] || null;
                if (!file) return;
                const error = validateLoanDocumentSelection(file, 'aadhaar');
                if (error) {
                    event.target.value = '';
                    showNotification(error, true);
                    return;
                }
                loanApplicationDraft.documents = { ...(loanApplicationDraft.documents || {}), aadhaarFile: file, aadhaarName: file?.name || '' };
                const label = document.getElementById('loan-aadhaar-file-label');
                if (label) label.textContent = file?.name || 'Tap to select Aadhaar image/PDF';
            });
            document.getElementById('loan-selfie-file-input')?.addEventListener('change', (event) => {
                const file = event.target.files?.[0] || null;
                if (!file) return;
                const error = validateLoanDocumentSelection(file, 'selfie');
                if (error) {
                    event.target.value = '';
                    showNotification(error, true);
                    return;
                }
                loanApplicationDraft.documents = { ...(loanApplicationDraft.documents || {}), selfieFile: file, selfieName: file?.name || '' };
                const label = document.getElementById('loan-selfie-file-label');
                if (label) label.textContent = file?.name || 'Tap to select live selfie';
            });
        };

        const showTakeLoanPage = () => {
            if (!hasModernLoanApproval(currentUserData)) {
                loanApplicationDraft = {
                    step: 1,
                    personal: {
                        name: currentUserData?.name || '',
                        mobile: currentUserData?.mobile || '',
                        fatherName: '',
                        alternateMobile: '',
                        dob: '',
                        aadhaar: ''
                    },
                    documents: {},
                    acceptedTerms: false
                };
                showLoanApplicationPage(1);
                return;
            }
            const dueDate = getNextMonthRepaymentDate();
            const maxLoanAmount = Math.max(1, getLoanLimitAmount(currentUserData));
            const content = `
                ${getPageHeader('Take Loan')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-5">
                    <div class="text-center">
                        <h3 class="text-lg font-semibold">Choose Loan Amount</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Amount between 1 and your approved limit. Interest is 2% for 1 month.</p>
                    </div>
                    <div class="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500 dark:text-gray-400">Approved Limit</span>
                            <span class="font-black text-indigo-700 dark:text-indigo-200">${formatCurrency(maxLoanAmount)}</span>
                        </div>
                        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">If admin increases this limit later, you can use the higher limit without applying again.</p>
                    </div>
                    <input type="number" id="loan-amount-input" min="1" max="${maxLoanAmount}" placeholder="Enter amount up to ${formatCurrency(maxLoanAmount)}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <div id="loan-summary" class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 space-y-2 text-sm"></div>
                    <label class="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-sm">
                        <input type="checkbox" id="loan-agreement-checkbox" class="h-5 w-5">
                        <span>I agree to the <button id="loan-agreement-link" type="button" class="text-indigo-600 dark:text-indigo-300 font-black underline">loan agreement</button>.</span>
                    </label>
                    <button id="confirm-take-loan-btn" class="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition">Take Loan</button>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            const amountInput = document.getElementById('loan-amount-input');
            if (amountInput) {
                amountInput.max = String(maxLoanAmount);
                amountInput.placeholder = `Enter amount up to ${formatCurrency(maxLoanAmount)}`;
            }
            const loanHelpText = amountInput?.closest('.space-y-5')?.querySelector('.text-center p');
            if (loanHelpText) loanHelpText.textContent = `Amount between 1 and ${formatCurrency(maxLoanAmount)}. Interest is 2% for 1 month.`;
            const updateSummary = () => {
                const amount = parseFloat(document.getElementById('loan-amount-input').value) || 0;
                const interest = Number((amount * 0.02).toFixed(2));
                document.getElementById('loan-summary').innerHTML = `
                    <div class="flex justify-between"><span>Loan Amount</span><span>${formatCurrency(amount)}</span></div>
                    <div class="flex justify-between"><span>2% Interest</span><span>${formatCurrency(interest)}</span></div>
                    <div class="flex justify-between font-bold pt-2 border-t border-indigo-200 dark:border-indigo-800"><span>Total Repay</span><span>${formatCurrency(amount + interest)}</span></div>
                    <div class="flex justify-between"><span>Due Date</span><span>${dueDate.toLocaleDateString('en-IN')}</span></div>`;
            };
            updateSummary();
            document.getElementById('loan-amount-input').addEventListener('input', updateSummary);
            document.getElementById('loan-agreement-link').onclick = showLoanAgreementModal;
            document.getElementById('confirm-take-loan-btn').onclick = handleTakeLoan;
        };

        const showLoanAgreementModal = () => {
            renderModal('Loan Agreement',
                `<div class="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <p><strong>Credit limit:</strong> Admin approves your maximum loan limit. You may choose any amount within that limit when no active loan is open.</p>
                    <p><strong>Repayment:</strong> Loan repayment is due on the same date next month. If that date does not exist, the nearest last date is used.</p>
                    <p><strong>Security reserve:</strong> Loan money credited to your wallet remains usable. After the repayment due date, available wallet funds may be reserved or auto-debited for the active loan repayment.</p>
                    <p><strong>Missed due date:</strong> If repayment is due and wallet balance is insufficient, the account can be blocked until admin reviews and unlocks it.</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg">I Understand</button>`,
                'max-w-md');
        };

        const showActiveLoanPage = (loan) => {
            const dueDate = loan.dueDate?.toDate ? loan.dueDate.toDate() : new Date(loan.dueDate);
            showPage(`
                ${getPageHeader('Loan Repayment')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
                    <h3 class="text-lg font-semibold">Active Loan</h3>
                    <div class="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 space-y-2 text-sm">
                        <div class="flex justify-between"><span>Loan Amount</span><span>${formatCurrency(loan.amount)}</span></div>
                        <div class="flex justify-between"><span>Interest</span><span>${formatCurrency(loan.interest)}</span></div>
                        <div class="flex justify-between font-bold"><span>Total Payable</span><span>${formatCurrency(loan.totalRepayable)}</span></div>
                        <div class="flex justify-between"><span>Reserved Wallet Fund</span><span>${formatCurrency(getLoanReservedAmount(currentUserData))}</span></div>
                        <div class="flex justify-between"><span>Available Balance</span><span>${formatCurrency(getSpendableWalletBalance(currentUserData))}</span></div>
                        <div class="flex justify-between"><span>Due Date</span><span>${dueDate.toLocaleDateString('en-IN')}</span></div>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Repayment option: pay all amount on the same date in next month.</p>
                    <button id="repay-loan-btn" class="w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 transition">Repay Full Loan</button>
                </div>
                ${getPageFooter()}`);
            document.getElementById('repay-loan-btn').onclick = () => handleRepayLoan(loan);
        };

        const showUserLoanDetailModal = async (loanId) => {
            let loan = allLoansCache.find(item => item.id === loanId) || getUserLoanRecords(currentUser?.uid || '').find(item => item.id === loanId);
            if (!loan && loanId) {
                try {
                    const loanSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/loans`, loanId));
                    if (loanSnap.exists()) {
                        loan = { id: loanSnap.id, ...loanSnap.data() };
                        if (loan.userId === currentUser?.uid && isModernLoanRecord(loan)) {
                            allLoansCache = [
                                ...allLoansCache.filter(item => item.id !== loan.id),
                                loan
                            ].sort((a, b) => timestampToMillis(b.createdAt || b.paidAt) - timestampToMillis(a.createdAt || a.paidAt));
                        }
                    }
                } catch (error) {
                    console.error('Loan detail lookup failed:', error);
                }
            }
            if (!loan || loan.userId !== currentUser?.uid) return showNotification('Loan details not found. Please refresh.', true);
            const dueDate = toDate(loan.dueDate);
            const createdAt = toDate(loan.createdAt);
            const paidAt = toDate(loan.paidAt);
            renderModal('Loan Details',
                `<div class="space-y-3 text-sm">
                    <div class="rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4">
                        <div class="flex justify-between"><span>Loan Amount</span><span class="font-black">${formatCurrency(loan.amount || 0)}</span></div>
                        <div class="mt-2 flex justify-between"><span>Interest</span><span class="font-black">${formatCurrency(loan.interest || 0)}</span></div>
                        <div class="mt-2 flex justify-between text-base"><span>Total Repay</span><span class="font-black">${formatCurrency(loan.totalRepayable || 0)}</span></div>
                    </div>
                    <div class="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                        <div class="flex justify-between gap-3"><span>Status</span><span class="font-bold text-right">${escapeHtml(loan.status || 'active')}</span></div>
                        <div class="flex justify-between gap-3"><span>Credit Limit</span><span class="font-bold text-right">${formatCurrency(loan.creditLimitAtBorrow || getLoanLimitAmount(currentUserData))}</span></div>
                        <div class="flex justify-between gap-3"><span>Created</span><span class="font-bold text-right">${createdAt ? createdAt.toLocaleDateString('en-IN') : 'N/A'}</span></div>
                        <div class="flex justify-between gap-3"><span>Due Date</span><span class="font-bold text-right">${dueDate ? dueDate.toLocaleDateString('en-IN') : 'N/A'}</span></div>
                        ${paidAt ? `<div class="flex justify-between gap-3"><span>Paid At</span><span class="font-bold text-right">${paidAt.toLocaleDateString('en-IN')}</span></div>` : ''}
                    </div>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg">Close</button>`,
                'max-w-md');
        };

        const attachInvestmentInvoiceButtons = (investments = []) => {
            document.querySelectorAll('[data-action="download-investment-invoice"]').forEach(btn => {
                btn.onclick = () => {
                    const inv = investments.find(i => i.id === btn.dataset.investmentid);
                    if (inv) downloadInvestmentInvoice(inv);
                };
            });
        };

        const renderPartnerTrackList = (investments = []) => {
            const list = document.getElementById('partner-track-list');
            if (!list) return;
            list.innerHTML = investments.length ? investments.map(inv => renderUserInvestmentCard(inv)).join('') : `
                <div class="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-800 p-5 text-center bg-emerald-50/60 dark:bg-emerald-900/10">
                    <p class="font-semibold">No investment yet</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Start with wallet funds and track monthly returns here.</p>
                </div>`;
            attachInvestmentInvoiceButtons(investments);
        };

        const showPartnerPage = () => {
            if (!currentUser || !currentUserData) return showNotification('User data not loaded. Please wait.', true);

            const investments = allInvestmentsCache
                .filter(inv => inv.userId === currentUser.uid)
                .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));

            const activeCards = investments.length ? investments.map(inv => renderUserInvestmentCard(inv)).join('') : `
                <div class="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-800 p-5 text-center bg-emerald-50/60 dark:bg-emerald-900/10">
                    <p class="font-semibold">No investment yet</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Start with wallet funds and track monthly returns here.</p>
                </div>`;

            showPage(`
                ${getPageHeader('Become Partner')}
                <div class="max-w-md mx-auto space-y-5">
                    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-700 to-slate-900 text-white p-6 shadow-xl">
                        <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full border border-white/20"></div>
                        <div class="relative flex items-center gap-4">
                            <div class="w-16 h-16 rounded-2xl bg-white/90 p-3 shadow-lg">
                                <img src="${PARTNER_ICON_URL}" alt="Become Partner" class="w-full h-full object-contain">
                            </div>
                            <div>
                                <p class="text-xs uppercase tracking-wide text-white/70">RW Partner Plan</p>
                                <h3 class="text-2xl font-bold">Invest wallet funds</h3>
                                <p class="text-sm text-white/75 mt-1">Earn 1% monthly interest after every 30 days.</p>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button id="new-investment-btn" class="rounded-2xl bg-emerald-600 text-white py-3 font-semibold shadow-sm">Create Investment</button>
                        <button id="track-investment-btn" class="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-3 font-semibold">Track Investment</button>
                    </div>
                    <div id="partner-track-list" class="space-y-3">${activeCards}</div>
                </div>
                ${getPageFooter()}`);

            document.getElementById('new-investment-btn').onclick = showCreatePartnerInvestmentPage;
            document.getElementById('track-investment-btn').onclick = () => document.getElementById('partner-track-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            attachInvestmentInvoiceButtons(investments);

            processDuePartnerInvestmentsForUser(currentUser.uid)
                .catch(error => console.warn('Partner due processing skipped:', error))
                .finally(() => getDocs(query(
                    collection(db, `artifacts/${appId}/public/data/partner_investments`),
                    where("userId", "==", currentUser.uid)
                ))
                    .then((snap) => {
                        const freshInvestments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                            .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
                        renderPartnerTrackList(freshInvestments);
                    })
                    .catch(error => console.warn('Partner investment background refresh skipped:', error)));
        };

        const renderUserInvestmentCard = (inv) => {
            const start = toDate(inv.startDate) || toDate(inv.createdAt) || new Date();
            const end = toDate(inv.endDate);
            const next = toDate(inv.nextPayoutAt);
            const paidInterest = inv.paidInterest || 0;
            const totalInterest = inv.totalInterest || 0;
            const progress = totalInterest > 0 ? Math.min(100, Math.round((paidInterest / totalInterest) * 100)) : 0;
            return `
                <div class="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                    <div class="flex justify-between gap-3">
                        <div>
                            <p class="text-xs uppercase text-gray-500">Investment</p>
                            <p class="text-xl font-bold">${formatCurrency(inv.amount || 0)}</p>
                            <p class="text-xs text-gray-500 mt-1">${start.toLocaleDateString('en-IN')} - ${end ? end.toLocaleDateString('en-IN') : 'N/A'}</p>
                        </div>
                        <span class="h-fit rounded-full px-3 py-1 text-xs font-bold ${inv.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-emerald-100 text-emerald-700'}">${inv.status || 'active'}</span>
                    </div>
                    <div class="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div class="h-full bg-emerald-500" style="width:${progress}%"></div>
                    </div>
                    <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div class="rounded-xl bg-gray-50 dark:bg-gray-700 p-2"><span class="text-gray-500">Interest got</span><p class="font-bold">${formatCurrency(paidInterest)}</p></div>
                        <div class="rounded-xl bg-gray-50 dark:bg-gray-700 p-2"><span class="text-gray-500">Next interest</span><p class="font-bold">${next && inv.status === 'active' ? next.toLocaleDateString('en-IN') : 'Done'}</p></div>
                    </div>
                    <button data-action="download-investment-invoice" data-investmentid="${inv.id}" class="mt-3 w-full rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-2 text-sm font-semibold">Download PDF Invoice</button>
                </div>`;
        };

        const showCreatePartnerInvestmentPage = () => {
            showPage(`
                ${getPartnerInvestmentHeader()}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md space-y-5">
                    <div class="text-center">
                        <div class="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 p-3">
                            <img src="${PARTNER_ICON_URL}" alt="Partner" class="w-full h-full object-contain">
                        </div>
                        <h3 class="text-xl font-bold mt-3">Create Investment</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">1% monthly interest, processed every 30 days.</p>
                    </div>
                    <div class="space-y-3">
                        <input type="number" id="partner-amount-input" min="${PARTNER_MIN_INVESTMENT}" placeholder="Minimum investment ${formatCurrency(PARTNER_MIN_INVESTMENT)}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <input type="number" id="partner-months-input" min="1" max="60" placeholder="Type no. of months e.g. 1, 2, 3" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    </div>
                    <div id="partner-investment-summary" class="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-3"></div>
                    <label class="flex gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm">
                        <input type="checkbox" id="partner-terms-checkbox" class="mt-1">
                        <span>I am confirming that I do this after reading all documents and accept the <button id="partner-terms-link" type="button" class="text-emerald-600 font-semibold underline">terms and conditions</button>.</span>
                    </label>
                    <button id="confirm-partner-investment-btn" class="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 transition">Invest Now</button>
                </div>
                ${getPageFooter()}`);

            updatePartnerInvestmentSummary();
            document.getElementById('partner-amount-input').addEventListener('input', updatePartnerInvestmentSummary);
            document.getElementById('partner-months-input').addEventListener('input', updatePartnerInvestmentSummary);
            document.getElementById('partner-terms-link').onclick = showPartnerTermsModal;
            document.getElementById('confirm-partner-investment-btn').onclick = handleCreatePartnerInvestment;
        };

        const showPartnerTermsModal = () => {
            renderModal('Partner Terms & Conditions',
                `<div class="space-y-3 text-sm">
                    <p class="font-semibold">Please read before investing wallet funds.</p>
                    <ul class="list-disc pl-5 space-y-2 text-gray-600 dark:text-gray-300">
                        <li>Interest rate is 1% per month on invested wallet amount.</li>
                        <li>Interest is processed after each completed 30 day cycle.</li>
                        <li>If you withdraw before the selected end date, no pending interest is paid.</li>
                        <li>Early withdrawal has a 2% charge deducted from principal.</li>
                        <li>Principal remains locked until maturity unless admin closes early under these conditions.</li>
                        <li>You confirm that you invested after reading all documents and conditions.</li>
                    </ul>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg">I Understand</button>`,
                'max-w-md'
            );
        };

        const showAdminUsersPageWithFilter = (filter) => {
            showAdminUsersPage();
            setTimeout(() => {
                const select = document.getElementById('user-filter-select-page');
                if (select) {
                    select.value = filter;
                    updateAdminUserListView();
                }
            }, 100);
        };

        const getPendingSignupUsers = () =>
            allUsersCache.filter(u => !isAdminUserRecord(u) && isUserApprovalPending(u));

        const isNewSignupUser = (user = {}) =>
            user.signupSource === 'web' ||
            user.signup_source === 'web' ||
            user.webAppUpdatedOn === WEB_APP_UPDATE_DATE ||
            user.web_app_updated_on === WEB_APP_UPDATE_DATE ||
            !!(user.webAppBuild || user.web_app_build || user.webAppLastSeenAt || user.web_app_last_seen_at);

        const getSignupUserCategory = (user = {}) => isNewSignupUser(user) ? 'New Web User' : 'Old User';

        const showAdminSignupApprovalsPage = () => {
            const pendingUsers = getPendingSignupUsers()
                .sort((a, b) => timestampToMillis(b.signupRequestedAt || b.createdAt) - timestampToMillis(a.signupRequestedAt || a.createdAt));
            const newPendingCount = pendingUsers.filter(isNewSignupUser).length;
            const oldPendingCount = pendingUsers.length - newPendingCount;
            const content = `
                ${getPageHeader('Approve User Signup')}
                <div class="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h3 class="text-lg font-bold">Pending Account Creation</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${pendingUsers.length} user(s) waiting for admin approval.</p>
                        </div>
                        <button id="refresh-signup-approvals-btn" class="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-bold">Refresh</button>
                    </div>
                    <div class="mb-4 grid grid-cols-2 gap-2 text-xs font-black">
                        <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
                            New Web Users: ${newPendingCount}
                        </div>
                        <div class="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
                            Old Users: ${oldPendingCount}
                        </div>
                    </div>
                    <div id="signup-approvals-list" class="space-y-2 max-h-[70vh] overflow-y-auto">
                        ${pendingUsers.length ? pendingUsers.map(user => {
                            const category = getSignupUserCategory(user);
                            const isOld = category === 'Old User';
                            return `
                            <div class="rounded-xl border border-amber-100 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div class="min-w-0 flex items-start gap-3">
                                    <span class="${isOld ? 'signup-old-pulse bg-red-600' : 'bg-emerald-500'} mt-1 h-3 w-3 shrink-0 rounded-full shadow"></span>
                                    <div class="min-w-0">
                                    <span class="mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${isOld ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'}">${category}</span>
                                    <p class="font-bold text-gray-900 dark:text-gray-100 truncate">${escapeHtml(user.name || 'No Name')}</p>
                                    <p class="text-xs text-gray-600 dark:text-gray-300 truncate">${escapeHtml(user.email || '')}</p>
                                    <p class="text-xs text-gray-600 dark:text-gray-300 truncate">${escapeHtml(user.mobile || 'No Mobile')}</p>
                                    <p class="text-[10px] font-semibold text-amber-700 dark:text-amber-200 mt-1">Requested: ${formatDateDDMMYY(user.signupRequestedAt || user.createdAt || Date.now())}</p>
                                    </div>
                                </div>
                                <div class="flex gap-2 shrink-0">
                                    <button data-action="approve-signup-user" data-userid="${user.id || user.uid}" class="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black">Approve</button>
                                    <button data-action="cancel-signup-user" data-userid="${user.id || user.uid}" data-username="${escapeHtml(user.name || user.email || 'User')}" class="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-black">Cancel</button>
                                </div>
                            </div>
                        `;
                        }).join('') : '<p class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">No pending signup approval.</p>'}
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: 'admin', keepBottomNav: true });
            setBottomNavActive('bottom-admin-btn');
            document.getElementById('refresh-signup-approvals-btn')?.addEventListener('click', () => {
                showAdminSignupApprovalsPage();
                refreshAdminDashboardCaches().catch(error => console.warn('Signup approval refresh skipped:', error));
            });
        };

        const handleSignupApprovalAction = async (userId, action) => {
            if (currentUser?.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
            try {
                if (action === 'approve') {
                    await updateDoc(userRef, {
                        approvalStatus: 'approved',
                        accountStatus: 'active',
                        signupApprovalStatus: 'approved',
                        isApproved: true,
                        approvedAt: serverTimestamp(),
                        approvedBy: currentUser.uid
                    });
                    showNotification('User signup approved.');
                } else {
                    await updateDoc(userRef, {
                        approvalStatus: 'rejected',
                        accountStatus: 'rejected',
                        signupApprovalStatus: 'rejected',
                        isApproved: false,
                        isFlagged: true,
                        isDisabled: true,
                        approvalRejectionReason: 'Account creation cancelled by admin.',
                        rejectedAt: serverTimestamp(),
                        rejectedBy: currentUser.uid
                    });
                    showNotification('User signup cancelled.');
                }
                allUsersCache = allUsersCache.map(user => {
                    if ((user.id || user.uid) !== userId) return user;
                    return {
                        ...user,
                        approvalStatus: action === 'approve' ? 'approved' : 'rejected',
                        accountStatus: action === 'approve' ? 'active' : 'rejected',
                        signupApprovalStatus: action === 'approve' ? 'approved' : 'rejected',
                        isApproved: action === 'approve',
                        ...(action === 'cancel' ? { isFlagged: true, isDisabled: true } : {})
                    };
                });
                showAdminSignupApprovalsPage();
                refreshAdminDashboardCaches().catch(error => console.warn('Admin cache refresh skipped:', error));
            } catch (error) {
                console.error('Signup approval action failed:', error);
                showNotification(`Could not update signup: ${error.message}`, true);
            }
        };

        const showAdminUsersPage = () => {
            const content = `
                ${getPageHeader('User Management')}
                <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <div class="flex flex-col sm:flex-row gap-3 mb-4">
                        <input type="text" id="user-search-input-page" placeholder="Search by name, email, or mobile..." class="flex-grow px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <select id="user-filter-select-page" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                            <option value="all">All Users</option>
                            <option value="pending_signup">Pending Signup Approval</option>
                            <option value="new">New Members (15 Days)</option>
                            <option value="active">Active Users</option>
                            <option value="inactive">Inactive Users</option>
                            <option value="flagged">Flagged Users</option>
                            <option value="pro">Pro Verified Users</option>
                            <option value="updated_web">New Version</option>
                            <option value="not_updated_web">Old Version</option>
                            <option value="minus_balance">Minus Balance Users</option>
                            <option value="zero_balance">0 Balance Users</option>
                        </select>
                    </div>
                    <div id="admin-users-list-page" class="max-h-[70vh] overflow-y-auto"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            const usersToRender = allUsersCache
                .filter(u => !isAdminUserRecord(u))
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            renderAdminUsersList(usersToRender);
            document.getElementById('user-search-input-page').oninput = updateAdminUserListView;
            document.getElementById('user-filter-select-page').onchange = updateAdminUserListView;
        };

        const showAdminGiftCodesPage = () => {
            const content = `
                ${getPageHeader('Gift Codes')}
                <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <button id="create-gift-code-btn-page" class="px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition">Create New</button>
                        <button id="copy-active-gift-codes-btn" class="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">Copy Active Codes</button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                        <input type="number" id="bulk-gift-code-count" min="1" max="200" placeholder="How many codes?" class="w-full px-4 py-3 bg-white dark:bg-gray-800 rounded-lg">
                        <input type="number" id="bulk-gift-code-amount" min="1" placeholder="Amount (₹)" class="w-full px-4 py-3 bg-white dark:bg-gray-800 rounded-lg">
                        <button id="bulk-gift-code-generate-btn" class="px-4 py-3 text-sm bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition">Generate</button>
                    </div>
                    <div id="gift-codes-list-page" class="space-y-2 max-h-[70vh] overflow-y-auto"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            renderAdminGiftCodesList(allGiftCodesCache);
            getDocs(collection(db, `artifacts/${appId}/public/data/gift_codes`))
                .then(snap => applyAdminGiftCodesSnapshot(snap.docs))
                .catch(error => console.warn('Gift code refresh skipped:', error));
            document.getElementById('create-gift-code-btn-page').onclick = showCreateGiftCodeModal;
            document.getElementById('bulk-gift-code-generate-btn').onclick = handleGenerateGiftCodes;
            document.getElementById('copy-active-gift-codes-btn').onclick = (e) => handleCopyActiveGiftCodes(e.currentTarget);
        };
        // Show Withdrawal History Page with filters
        const showWithdrawalHistoryPage = () => {
            const content = `
                ${getPageHeader('Withdrawal History')}
                <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <!-- Filters -->
                    <div class="mb-6 space-y-4">
                        <div class="flex flex-wrap gap-2">
                            <button data-filter="today" class="filter-btn active-filter">Today</button>
                            <button data-filter="yesterday" class="filter-btn">Yesterday</button>
                            <button data-filter="week" class="filter-btn">This Week</button>
                            <button data-filter="month" class="filter-btn">This Month</button>
                            <button data-filter="all" class="filter-btn">All Time</button>
                        </div>
                        <div class="flex flex-col sm:flex-row gap-3">
                            <div class="flex-[1.5]">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Search User</label>
                                <input type="search" id="withdrawal-history-search" placeholder="Name, mobile, email" class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            </div>
                            <div class="flex-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">From Date</label>
                                <input type="date" id="filter-from-date" class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            </div>
                            <div class="flex-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">To Date</label>
                                <input type="date" id="filter-to-date" class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            </div>
                            <div class="flex items-end">
                                <button id="apply-date-filter" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Apply</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Statistics -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <p class="text-sm text-blue-600 dark:text-blue-400">Total Withdrawals</p>
                            <p id="total-withdrawals-count" class="text-2xl font-bold">0</p>
                        </div>
                        <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                            <p class="text-sm text-green-600 dark:text-green-400">Approved</p>
                            <p id="approved-withdrawals-count" class="text-2xl font-bold">0</p>
                        </div>
                        <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                            <p class="text-sm text-red-600 dark:text-red-400">Rejected</p>
                            <p id="rejected-withdrawals-count" class="text-2xl font-bold">0</p>
                        </div>
                    </div>
                    
                    <!-- Withdrawal History List -->
                    <div id="withdrawal-history-list" class="max-h-[60vh] overflow-y-auto"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content);

            // Set today as default active
            document.querySelector('[data-filter="today"]').classList.add('active-filter');
            if (withdrawalHistoryCache.length) {
                renderWithdrawalHistoryList();
            } else {
                document.getElementById('withdrawal-history-list').innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-8">Loading withdrawal history...</p>';
            }
            loadWithdrawalHistory('today');
            document.getElementById('withdrawal-history-search').addEventListener('input', renderWithdrawalHistoryList);

            // Add event listeners for filters
            document.querySelectorAll('[data-filter]').forEach(btn => {
                btn.addEventListener('click', function () {
                    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active-filter'));
                    this.classList.add('active-filter');
                    const filter = this.dataset.filter;
                    loadWithdrawalHistory(filter);
                });
            });

            document.getElementById('apply-date-filter').addEventListener('click', () => {
                const fromDate = document.getElementById('filter-from-date').value;
                const toDate = document.getElementById('filter-to-date').value;
                if (fromDate && toDate) {
                    loadWithdrawalHistory('custom', fromDate, toDate);
                } else {
                    showNotification('Please select both from and to dates.', true);
                }
            });
        };

        const isWithdrawalHistorySourceRecord = (record = {}) => {
            const rawType = String(record.type || record.requestType || record.request_type || '').toLowerCase().replace(/\s+/g, '_');
            const normalizedType = normalizeTransactionType(record);
            const hasRechargeFields = !!(
                record.mobileNumber ||
                record.operator ||
                record.planDetails ||
                record.discountRate ||
                rawType.includes('recharge') ||
                normalizedType === 'mobile_recharge'
            );
            if (hasRechargeFields) return false;
            if (normalizedType === 'withdrawal' || rawType.includes('withdraw')) return true;

            // Compatibility for old withdrawal rows that stored only payout fields.
            return !rawType && !!(
                record.methodId ||
                record.paymentMethod ||
                record.paymentDetails ||
                record.upiId ||
                record.accountNumber ||
                record.ifsc ||
                record.bankName ||
                record.giftCardType
            );
        };

        const normalizeWithdrawalHistoryRecord = (record = {}) => {
            const sourceType = normalizeTransactionType(record);
            const requestedAt = record.requestedAt || record.timestamp || record.createdAt || record.processedAt || Date.now();
            const userProfile = allUsersCache.find(u =>
                (record.userId && u.id === record.userId) ||
                (record.userMobile && normalizePhoneDigits(getUserMobileValue(u)) === normalizePhoneDigits(record.userMobile)) ||
                (record.userEmail && u.email === record.userEmail)
            ) || {};
            return {
                ...record,
                id: record.id || record.requestId || record.request_id || record.transactionId || record.transaction_id || `${sourceType}-${timestampToMillis(requestedAt)}-${record.amount || 0}`,
                userId: record.userId || record.user_id || userProfile.id || '',
                userName: record.userName || record.senderName || record.recipientName || userProfile.name || 'N/A',
                userMobile: record.userMobile || record.mobile || getUserMobileValue(userProfile) || '',
                userEmail: record.userEmail || record.emailAddress || userProfile.email || '',
                type: 'withdrawal',
                amount: absoluteAmount(record.amount || 0),
                method: getWithdrawalDisplayMethodName(record, record.paymentMethod || 'N/A'),
                status: record.status || 'completed',
                requestedAt,
                processedAt: ['completed', 'rejected'].includes(record.status) ? (record.processedAt || null) : null
            };
        };

        const mergeWithdrawalHistoryRecords = (...groups) => {
            const merged = new Map();
            groups.flat().forEach((record, index) => {
                if (!record) return;
                if (!isWithdrawalHistorySourceRecord(record)) return;
                const normalized = normalizeWithdrawalHistoryRecord(record);
                const key = normalized.requestId || normalized.request_id || normalized.transactionId || normalized.transaction_id || normalized.id || `withdrawal-${timestampToMillis(normalized.requestedAt)}-${normalized.amount}-${index}`;
                const existing = merged.get(String(key)) || {};
                const requestedAtCandidates = [existing.requestedAt, existing.requested_at, existing.timestamp, normalized.requestedAt, normalized.requested_at, normalized.timestamp]
                    .map(timestampToMillis)
                    .filter(time => Number.isFinite(time) && time > 0);
                const requestedAt = requestedAtCandidates.length ? Math.min(...requestedAtCandidates) : normalized.requestedAt;
                merged.set(String(key), {
                    ...existing,
                    ...normalized,
                    requestedAt,
                    timestamp: requestedAt
                });
            });
            return Array.from(merged.values())
                .sort((a, b) => timestampToMillis(b.requestedAt || b.timestamp || b.processedAt) - timestampToMillis(a.requestedAt || a.timestamp || a.processedAt));
        };

        const loadLegacyWithdrawalTransactionsForAdmin = async () => {
            if (currentUser?.uid !== ADMIN_UID) return [];
            const records = [];
            try {
                const snap = await getDocs(query(collectionGroup(db, 'transactions'), where('type', '==', 'withdrawal')));
                snap.docs.forEach(docSnap => records.push({ id: docSnap.id, sourcePath: docSnap.ref.path, ...docSnap.data() }));
            } catch (error) {
                console.warn('Legacy withdrawal collection group load skipped:', error);
            }

            for (const rootPath of ['transactions', 'transaction_history', 'wallet_transactions']) {
                try {
                    const snap = await getDocs(query(collection(db, rootPath), where('type', '==', 'withdrawal')));
                    snap.docs.forEach(docSnap => records.push({ id: docSnap.id, sourcePath: docSnap.ref.path, ...docSnap.data() }));
                } catch (error) {
                    console.warn('Legacy root withdrawal load skipped:', rootPath, error);
                }
            }
            return records;
        };

        // Load Withdrawal History function
        const loadWithdrawalHistory = async (filter = 'today', fromDate = null, toDate = null) => {
            activeWithdrawalHistoryFilter = { filter, fromDate, toDate };
            try {
                const needsDeepHistoryScan = filter === 'all' || filter === 'custom';
                const historyLimit = needsDeepHistoryScan ? 1200 : 450;
                const withdrawalQuery = query(
                    collection(db, `artifacts/${appId}/public/data/fund_requests`),
                    orderBy("requestedAt", "desc"),
                    firestoreLimit(historyLimit)
                );

                const [snap, cloudRequests, legacyWithdrawals] = await Promise.all([
                    getDocs(withdrawalQuery),
                    loadCloudFundRequests({ status: 'all', type: 'withdrawal', limit: historyLimit, timeoutMs: needsDeepHistoryScan ? 8000 : 3000 }).catch(error => {
                        console.warn('Cloud withdrawal history load skipped:', error);
                        return [];
                    }),
                    needsDeepHistoryScan
                        ? loadLegacyWithdrawalTransactionsForAdmin()
                        : Promise.resolve([])
                ]);
                const firebaseRequests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                let withdrawals = mergeWithdrawalHistoryRecords(firebaseRequests, cloudRequests, legacyWithdrawals);

                // Apply filters
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);

                if (filter === 'today') {
                    withdrawals = withdrawals.filter(w => {
                        if (!w.requestedAt) return false;
                        const reqDate = getSafeDate(w.requestedAt);
                        return reqDate >= today;
                    });
                } else if (filter === 'yesterday') {
                    withdrawals = withdrawals.filter(w => {
                        if (!w.requestedAt) return false;
                        const reqDate = getSafeDate(w.requestedAt);
                        return reqDate >= yesterday && reqDate < today;
                    });
                } else if (filter === 'week') {
                    withdrawals = withdrawals.filter(w => {
                        if (!w.requestedAt) return false;
                        const reqDate = getSafeDate(w.requestedAt);
                        return reqDate >= weekAgo;
                    });
                } else if (filter === 'month') {
                    withdrawals = withdrawals.filter(w => {
                        if (!w.requestedAt) return false;
                        const reqDate = getSafeDate(w.requestedAt);
                        return reqDate >= monthAgo;
                    });
                } else if (filter === 'custom' && fromDate && toDate) {
                    const from = new Date(fromDate);
                    const to = new Date(toDate);
                    to.setDate(to.getDate() + 1); // Include the entire to date

                    withdrawals = withdrawals.filter(w => {
                        if (!w.requestedAt) return false;
                        const reqDate = getSafeDate(w.requestedAt);
                        return reqDate >= from && reqDate < to;
                    });
                }
                // 'all' filter shows all withdrawals

                withdrawalHistoryCache = withdrawals;
                renderWithdrawalHistoryList();
            } catch (error) {
                console.error("Error loading withdrawal history:", error);
                showNotification('Error loading withdrawal history: ' + error.message, true);

                // Show error in the list
                const listEl = document.getElementById('withdrawal-history-list');
                if (listEl) {
                    listEl.innerHTML = `
                        <div class="text-center py-8">
                            <p class="text-red-500">Error loading withdrawal history</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Please check console for details</p>
                        </div>`;
                }
            }
        };

        const renderWithdrawalHistoryList = () => {
            const listEl = document.getElementById('withdrawal-history-list');
            if (!listEl) return;
            const search = (document.getElementById('withdrawal-history-search')?.value || '').trim().toLowerCase();
            const withdrawals = withdrawalHistoryCache.filter(w => !search || [
                w.userName,
                w.userMobile,
                w.userEmail
            ].some(value => String(value || '').toLowerCase().includes(search)));

            const totalWithdrawals = withdrawals.length;
            const approvedWithdrawals = withdrawals.filter(w => w.status === 'completed').length;
            const rejectedWithdrawals = withdrawals.filter(w => w.status === 'rejected').length;

            document.getElementById('total-withdrawals-count').textContent = totalWithdrawals;
            document.getElementById('approved-withdrawals-count').textContent = approvedWithdrawals;
            document.getElementById('rejected-withdrawals-count').textContent = rejectedWithdrawals;

            if (withdrawals.length === 0) {
                listEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No withdrawal history found.</p>';
                return;
            }

            listEl.innerHTML = withdrawals.map(w => {
                    const statusColor = w.status === 'completed' ? 'text-green-500' :
                        w.status === 'rejected' ? 'text-red-500' : 'text-yellow-500';
                    const statusBg = w.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                        w.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30';
                    const statusText = w.status === 'completed' ? 'Approved' :
                        w.status === 'rejected' ? 'Rejected' : 'Pending';
                    const payoutDetails = getWithdrawalDetailText(w);

                    // Format date safely
                    let requestDate = 'N/A';
                    let requestTime = 'N/A';
                    if (w.requestedAt) {
                        requestDate = formatDate(w.requestedAt).split(' ')[0];
                        requestTime = getTimeFromTimestamp(w.requestedAt);
                    }

                    return `
                        <div class="p-4 mb-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <p class="font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(w.userName || 'N/A')}</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Mobile: ${escapeHtml(maskMobile(w.userMobile || ''))}</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">Email: ${escapeHtml((w.userEmail || 'N/A').split('@')[0])}***</p>
                                </div>
                                <span class="px-2 py-1 text-xs ${statusBg} ${statusColor} rounded-full font-semibold">${statusText}</span>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-3 text-sm mb-3">
                                <div class="bg-white dark:bg-gray-800 p-2 rounded">
                                    <p class="text-gray-500 dark:text-gray-400 text-xs">Amount</p>
                                    <p class="font-semibold text-gray-800 dark:text-gray-200">${formatCurrencyAbs(w.amount)}</p>
                                </div>
                                <div class="bg-white dark:bg-gray-800 p-2 rounded">
                                    <p class="text-gray-500 dark:text-gray-400 text-xs">Method</p>
                                    <p class="font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(w.method || 'N/A')}</p>
                                </div>
                                <div class="bg-white dark:bg-gray-800 p-2 rounded">
                                    <p class="text-gray-500 dark:text-gray-400 text-xs">Payout Details</p>
                                    <p class="font-semibold text-gray-800 dark:text-gray-200 text-sm break-words">${escapeHtml(payoutDetails)}</p>
                                </div>
                                <div class="bg-white dark:bg-gray-800 p-2 rounded">
                                    <p class="text-gray-500 dark:text-gray-400 text-xs">Date</p>
                                    <p class="font-semibold text-gray-800 dark:text-gray-200">${requestDate}</p>
                                </div>
                            </div>
                            
                            <div class="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                                <span>Requested: ${requestDate} ${requestTime}</span>
                                ${w.adminTransactionId ?
                            `<span class="txn-id-badge">${w.adminTransactionId}</span>` :
                            ''
                        }
                            </div>
                            
                            ${w.rejectionReason ? `
                                <div class="rejection-badge mt-3">
                                    <p class="font-semibold">Rejection Reason:</p>
                                    <p class="text-sm">${escapeHtml(w.rejectionReason)}</p>
                                </div>
                            ` : ''}
                            
                            ${w.processedAt ? `
                                <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                                    Processed: ${formatDate(w.processedAt)}
                                </div>
                            ` : ''}
                        </div>
                    `;
            }).join('');
        };

        // --- DYNAMIC RENDERING (for pages) ---
        const renderAdminUsersList = (users) => {
            const listEl = document.getElementById('admin-users-list-page');
            if (!listEl) return;

            // Group users by active/inactive
            const activeUsers = users.filter(u => !u.isFlagged && (getUserAvailableBalance(u) > 0 || u.hasRecentActivity));
            const inactiveUsers = users.filter(u => !activeUsers.includes(u));

            const renderUser = (u) => {
                const balance = getUserAvailableBalance(u);
                const isMinusBalance = balance < 0;
                const updatedWeb = isUserOnUpdatedWebApp(u);
                const webSeenAt = getUserWebSeenMillis(u);
                return `
                <div class="relative p-3 mb-2 ${u.isFlagged || isMinusBalance ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700'} rounded-xl flex items-start gap-3 overflow-visible">
                    <div class="min-w-0 flex-grow">
                        <div class="flex flex-wrap items-center gap-1.5 pr-1">
                            <p class="font-semibold text-sm truncate max-w-full">${escapeHtml(u.name || 'No Name')}</p>
                            ${u.isFlagged ? '<span class="px-1.5 py-0.5 text-[10px] bg-red-600 text-white rounded uppercase font-bold">Flagged</span>' : ''}
                            ${isUserApprovalPending(u) ? '<span class="px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded uppercase font-bold">Pending Approval</span>' : ''}
                            ${isUserApprovalRejected(u) ? '<span class="px-1.5 py-0.5 text-[10px] bg-gray-600 text-white rounded uppercase font-bold">Signup Cancelled</span>' : ''}
                            ${isMinusBalance ? '<span class="px-1.5 py-0.5 text-[10px] bg-red-600 text-white rounded uppercase font-bold">Minus</span>' : ''}
                            ${u.isProProfile ? '<span class="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded-full uppercase font-bold">Pro</span>' : ''}
                            ${updatedWeb ? '<span class="px-1.5 py-0.5 text-[10px] bg-emerald-600 text-white rounded uppercase font-bold">New Version</span>' : '<span class="px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded uppercase font-bold">Old Version</span>'}
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(u.email || '')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(u.mobile || 'No Mobile')}</p>
                        <p class="text-[10px] font-semibold ${updatedWeb ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'} mt-1">${updatedWeb ? `New version seen: ${webSeenAt ? formatDateDDMMYY(webSeenAt) : 'Yes'}` : 'Old version'}</p>
                        <p class="text-xs font-bold ${isMinusBalance ? 'text-red-600 dark:text-red-300' : 'text-blue-600 dark:text-blue-400'} mt-1">Balance: ${formatCompactBalance(balance)}</p>
                        ${isMinusBalance ? '<p class="text-[10px] font-semibold text-red-500 dark:text-red-300 mt-0.5">Check pending withdrawals before approving more payouts.</p>' : ''}
                    </div>
                    <details class="admin-user-actions relative shrink-0">
                        <summary class="list-none h-9 w-9 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm flex items-center justify-center cursor-pointer text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <span class="text-xl leading-none -mt-1">...</span>
                        </summary>
                        <div class="absolute right-0 top-10 z-30 w-36 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-1.5 text-xs font-bold">
                            <button data-action="view-user-dashboard" data-userid="${u.id}" class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-emerald-700 dark:text-emerald-300">View</button>
                            <button data-action="edit-user-balance" data-userid="${u.id}" class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-700 dark:text-blue-300">Edit</button>
                            <button data-action="flag-user" data-userid="${u.id}" data-flagged="${u.isFlagged || false}" class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-orange-600 dark:text-orange-300">${u.isFlagged ? 'Unflag' : 'Flag'}</button>
                            <button data-action="toggle-pro-user" data-userid="${u.id}" data-pro="${u.isProProfile || false}" class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-indigo-700 dark:text-indigo-300">${u.isProProfile ? 'Remove Pro' : 'Make Pro'}</button>
                            <button data-action="delete-user" data-userid="${u.id}" data-username="${escapeHtml(u.name || u.email || 'User')}" class="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-300">Delete</button>
                        </div>
                    </details>
                </div>`;
            };

            listEl.innerHTML = users.length === 0
                ? '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No users found.</p>'
                : `
                <div class="space-y-4">
                    <div class="border-b border-gray-200 dark:border-gray-700 pb-2">
                        <h4 class="text-xs font-bold uppercase text-gray-400 px-1">Active Users (${activeUsers.length})</h4>
                    </div>
                    ${activeUsers.map(renderUser).join('')}
                    
                    ${inactiveUsers.length > 0 ? `
                        <div class="border-b border-gray-200 dark:border-gray-700 pb-2 mt-6">
                            <h4 class="text-xs font-bold uppercase text-gray-400 px-1">Inactive/Other Users (${inactiveUsers.length})</h4>
                        </div>
                        ${inactiveUsers.map(renderUser).join('')}
                    ` : ''}
                </div>`;
        };

        const updateAdminUserListView = () => {
            const searchTerm = document.getElementById('user-search-input-page').value.toLowerCase();
            const filterValue = document.getElementById('user-filter-select-page').value;

            let usersToRender = allUsersCache.filter(u => !isAdminUserRecord(u) && (
                !searchTerm || userMatchesSearch(u, searchTerm)
            ));

            // Apply filter
            if (filterValue === 'active') {
                usersToRender = usersToRender.filter(u => !u.isFlagged && (getUserAvailableBalance(u) > 0 || u.hasRecentActivity));
            } else if (filterValue === 'pending_signup') {
                usersToRender = usersToRender.filter(isUserApprovalPending);
            } else if (filterValue === 'inactive') {
                usersToRender = usersToRender.filter(u => u.isFlagged || (getUserAvailableBalance(u) <= 0 && !u.hasRecentActivity));
            } else if (filterValue === 'flagged') {
                usersToRender = usersToRender.filter(u => !!u.isFlagged);
            } else if (filterValue === 'zero_balance') {
                usersToRender = usersToRender.filter(u => getUserAvailableBalance(u) === 0);
            } else if (filterValue === 'minus_balance') {
                usersToRender = usersToRender.filter(u => getUserAvailableBalance(u) < 0);
            } else if (filterValue === 'pro') {
                usersToRender = usersToRender.filter(u => !!u.isProProfile);
            } else if (filterValue === 'updated_web') {
                usersToRender = usersToRender.filter(isUserOnUpdatedWebApp);
            } else if (filterValue === 'not_updated_web') {
                usersToRender = usersToRender.filter(u => !isUserOnUpdatedWebApp(u));
            } else if (filterValue === 'new') {
                const fifteenDaysAgo = new Date();
                fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
                usersToRender = usersToRender.filter(u => {
                    if (!u.createdAt) return false;
                    const createdDate = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
                    return createdDate >= fifteenDaysAgo;
                });
            }

            // Sort by balance (highest first)
            usersToRender.sort((a, b) => filterValue === 'minus_balance'
                ? getUserAvailableBalance(a) - getUserAvailableBalance(b)
                : getUserAvailableBalance(b) - getUserAvailableBalance(a));
            renderAdminUsersList(usersToRender);
        };

        const showAdminUserDashboardPage = async (userId) => {
            const user = allUsersCache.find(u => u.id === userId) || {};
            adminViewedUserProfile = user;
            const content = `
                ${getPageHeader('User Dashboard')}
                <div class="max-w-3xl mx-auto space-y-4">
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
                        <p class="text-xs uppercase font-bold text-gray-400">User Details</p>
                        <h3 class="text-xl font-bold mt-1">${escapeHtml(user.name || 'User')}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${escapeHtml(user.email || '')}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${escapeHtml(user.mobile || '')}</p>
                        <p class="mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${isUserOnUpdatedWebApp(user) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'}">${isUserOnUpdatedWebApp(user) ? `Updated web app${getUserWebSeenMillis(user) ? ` - ${formatDateDDMMYY(getUserWebSeenMillis(user))}` : ''}` : 'Old app / not updated'}</p>
                        <p class="mt-3 text-2xl font-black text-blue-600 dark:text-blue-300">${formatCurrency(getUserAvailableBalance(user))}</p>
                    </div>
                    <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-2xl shadow-md border border-yellow-100 dark:border-yellow-800">
                        <div class="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <p class="text-xs uppercase font-bold text-yellow-600 dark:text-yellow-300">Pending Withdrawals</p>
                                <p class="text-xs text-yellow-700 dark:text-yellow-200">Check this before approving duplicate requests.</p>
                            </div>
                            <span id="admin-user-pending-withdraw-count" class="rounded-full bg-yellow-200 dark:bg-yellow-800 px-3 py-1 text-xs font-black text-yellow-800 dark:text-yellow-100">0</span>
                        </div>
                        <div id="admin-user-pending-withdrawals" class="space-y-2">
                            <p class="text-sm text-yellow-700 dark:text-yellow-200">Loading pending withdrawals...</p>
                        </div>
                    </div>
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
                        <input id="admin-user-tx-search" placeholder="Search transaction text..." class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl mb-3">
                        <div id="admin-user-tx-filters" class="flex flex-wrap gap-2 mb-4">
                            ${[
                                ['all', 'All'],
                                ['credit', 'Credit'],
                                ['withdrawal', 'Withdrawal'],
                                ['sent', 'Sent'],
                                ['received', 'Received']
                            ].map(([filter, label]) => `<button data-admin-user-tx-filter="${filter}" class="admin-user-tx-filter px-3 py-1.5 rounded-lg text-sm font-bold ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}">${label}</button>`).join('')}
                        </div>
                        <div id="admin-user-transactions-list" class="space-y-2 max-h-[62vh] overflow-y-auto">
                            <p class="text-center text-gray-500 py-6">Loading transactions...</p>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: 'admin', onBack: showAdminUsersPage });
            window.adminUserTxFilter = 'all';
            document.getElementById('admin-user-tx-filters').addEventListener('click', (event) => {
                const btn = event.target.closest('[data-admin-user-tx-filter]');
                if (!btn) return;
                window.adminUserTxFilter = btn.dataset.adminUserTxFilter;
                renderAdminUserTransactions();
            });
            document.getElementById('admin-user-tx-search').addEventListener('input', renderAdminUserTransactions);
            document.getElementById('admin-user-transactions-list').addEventListener('click', (event) => {
                const itemEl = event.target.closest('.tx-item-clickable');
                if (itemEl?.dataset.key) showTransactionDetails(itemEl.dataset.key, 'admin-user');
            });
            loadAdminUserPendingWithdrawals(userId);
            try {
                const [firebaseItems, cloudItems, cloudPendingRequests, firebasePendingRequests] = await Promise.all([
                    loadFirebaseTransactions(userId, 5000).catch(error => {
                        console.warn('Admin user Firebase transactions skipped:', error);
                        return [];
                    }),
                    fetchCloudTransactionHistory(userId, 5000).catch(error => {
                        console.warn('Admin user Cloud transactions skipped:', error);
                        return [];
                    }),
                    loadCloudFundRequests({ status: 'pending', type: 'withdrawal', userId, limit: 5000 }).catch(error => {
                        console.warn('Admin user Cloud pending history skipped:', error);
                        return [];
                    }),
                    loadFirebasePendingFundRequests(userId).catch(error => {
                        console.warn('Admin user Firebase pending history skipped:', error);
                        return [];
                    })
                ]);
                const cachedPendingRequests = allFundRequestsCache.filter(req => req.userId === userId && (req.status || 'pending') === 'pending');
                const pendingHistoryItems = mergeFundRequestsById(cachedPendingRequests, cloudPendingRequests, firebasePendingRequests)
                    .filter(req => (req.type || 'withdrawal') === 'withdrawal' && (req.status || 'pending') === 'pending')
                    .map(normalizePendingRequestForHistory);
                adminViewedUserTransactions = annotateTransactionsWithRemainingBalance(
                    mergeTransactionsByKey(firebaseItems, cloudItems, pendingHistoryItems),
                    getUserAvailableBalance(user)
                );
                renderAdminUserTransactions();
            } catch (error) {
                console.error('Admin user transaction load failed:', error);
                document.getElementById('admin-user-transactions-list').innerHTML = '<p class="text-center text-red-500 py-6">Could not load transactions.</p>';
            }
        };

        const loadAdminUserPendingWithdrawals = async (userId) => {
            const listEl = document.getElementById('admin-user-pending-withdrawals');
            const countEl = document.getElementById('admin-user-pending-withdraw-count');
            if (!listEl) return;
            try {
                const cached = allFundRequestsCache.filter(req => req.userId === userId && (req.status || 'pending') === 'pending');
                const [cloudRequests, firebaseRequests] = await Promise.all([
                    loadCloudFundRequests({ status: 'pending', type: 'withdrawal', userId, limit: 50 }).catch(error => {
                        console.warn('Admin user cloud pending withdrawals skipped:', error);
                        return [];
                    }),
                    loadFirebasePendingFundRequests(userId).catch(error => {
                        console.warn('Admin user Firebase pending withdrawals skipped:', error);
                        return [];
                    })
                ]);
                const pending = mergeFundRequestsById(cached, cloudRequests, firebaseRequests)
                    .filter(req => (req.type || 'withdrawal') === 'withdrawal' && (req.status || 'pending') === 'pending');
                if (countEl) countEl.textContent = String(pending.length);
                if (!pending.length) {
                    listEl.innerHTML = '<p class="text-sm text-yellow-700 dark:text-yellow-200">No pending withdrawal for this user.</p>';
                    return;
                }
                const total = pending.reduce((sum, req) => sum + Number(req.amount || 0), 0);
                const deductedPending = pending.filter(req => isWithdrawalBalanceDeducted(req));
                const uncutPending = pending.filter(req => !isWithdrawalBalanceDeducted(req));
                const deductedTotal = deductedPending.reduce((sum, req) => sum + Number(req.amount || 0), 0);
                const uncutTotal = uncutPending.reduce((sum, req) => sum + Number(req.amount || 0), 0);
                listEl.innerHTML = `
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div class="rounded-xl bg-white/70 dark:bg-gray-800/70 border border-yellow-200 dark:border-yellow-700 p-3">
                            <p class="text-[10px] uppercase font-black text-yellow-600 dark:text-yellow-300">Payable Pending</p>
                            <p class="text-sm font-black text-yellow-800 dark:text-yellow-100">${formatCurrency(total)}</p>
                        </div>
                        <div class="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-3">
                            <p class="text-[10px] uppercase font-black text-green-600 dark:text-green-300">Balance Cut Done</p>
                            <p class="text-sm font-black text-green-700 dark:text-green-100">${deductedPending.length} / ${formatCurrency(deductedTotal)}</p>
                        </div>
                        <div class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-3">
                            <p class="text-[10px] uppercase font-black text-red-600 dark:text-red-300">Uncut Old-App Risk</p>
                            <p class="text-sm font-black text-red-700 dark:text-red-100">${uncutPending.length} / ${formatCurrency(uncutTotal)}</p>
                        </div>
                    </div>
                    ${pending.map(req => `
                        <div class="rounded-xl bg-white dark:bg-gray-800 border border-yellow-100 dark:border-yellow-800 p-3 text-sm">
                            <div class="flex justify-between gap-3">
                                <div>
                                    <p class="font-bold text-gray-900 dark:text-white">${formatCurrency(req.amount || 0)}</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(getWithdrawalDisplayMethodName(req, 'Withdrawal'))}</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(req.requestedAt || req.requested_at)}</p>
                                </div>
                                <div class="flex flex-col items-end gap-1 shrink-0">
                                    <span class="h-fit rounded-full bg-yellow-100 dark:bg-yellow-900/40 px-2 py-1 text-[10px] font-black uppercase text-yellow-700 dark:text-yellow-200">Pending</span>
                                    ${isWithdrawalBalanceDeducted(req)
                                        ? '<span class="h-fit rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-1 text-[10px] font-black uppercase text-green-700 dark:text-green-200">Balance Cut</span>'
                                        : '<span class="h-fit rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-1 text-[10px] font-black uppercase text-red-700 dark:text-red-200">Not Cut</span>'}
                                </div>
                            </div>
                            <p class="mt-2 text-xs break-words text-gray-600 dark:text-gray-300">${escapeHtml(getWithdrawalDetailText(req))}</p>
                            <p class="mt-1 text-[10px] text-gray-400">Request ID: ${escapeHtml(req.id || req.requestId || '')}</p>
                        </div>
                    `).join('')}`;
            } catch (error) {
                console.error('Admin user pending withdrawal load failed:', error);
                listEl.innerHTML = '<p class="text-sm text-red-600 dark:text-red-300">Could not load pending withdrawals.</p>';
            }
        };

        const renderAdminUserTransactions = () => {
            const listEl = document.getElementById('admin-user-transactions-list');
            if (!listEl) return;
            const filter = window.adminUserTxFilter || 'all';
            const search = (document.getElementById('admin-user-tx-search')?.value || '').trim().toLowerCase();
            document.querySelectorAll('.admin-user-tx-filter').forEach(btn => {
                const active = btn.dataset.adminUserTxFilter === filter;
                btn.className = `admin-user-tx-filter px-3 py-1.5 rounded-lg text-sm font-bold ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`;
            });
            const items = adminViewedUserTransactions.filter(item => {
                const type = normalizeTransactionType(item);
                const text = [item.comment, item.senderName, item.recipientName, item.method, item.status, item.transactionId].join(' ').toLowerCase();
                const filterMatch =
                    filter === 'all' ||
                    (filter === 'credit' && ['credit', 'add_fund', 'wallet_transfer'].includes(type)) ||
                    (filter === 'withdrawal' && type === 'withdrawal') ||
                    (filter === 'sent' && ['debit', 'sent'].includes(type)) ||
                    (filter === 'received' && ['wallet_transfer', 'credit'].includes(type));
                return filterMatch && (!search || text.includes(search));
            });
            listEl.innerHTML = items.length ? items.map(item => {
                const type = normalizeTransactionType(item);
                const isCredit = ['credit', 'wallet_transfer', 'add_fund'].includes(type);
                const amountClass = isCredit ? 'text-green-600' : 'text-red-600';
                const sign = isCredit ? '+' : '-';
                const balanceAfter = getExplicitBalanceAfter(item) ?? item.balanceAfter;
                const balanceBefore = item.balanceBefore ?? item.balance_before;
                const showRemaining = Number.isFinite(Number(balanceAfter));
                const amount = Math.abs(Number(item.amount || 0));
                const hasBalanceRisk = type === 'withdrawal'
                    && Number.isFinite(Number(balanceBefore))
                    && amount > Number(balanceBefore)
                    && !['rejected', 'failed'].includes(String(item.status || '').toLowerCase());
                return `
                    <div class="tx-item-clickable p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700" data-key="${item.key}">
                        <div class="flex justify-between gap-3">
                            <div class="min-w-0">
                                <p class="font-bold text-sm truncate">${escapeHtml(item.comment || type || 'Transaction')}</p>
                                <p class="text-xs text-gray-500">${escapeHtml(item.senderName || item.recipientName || item.method || '')}</p>
                                <p class="text-xs text-gray-400">${formatDateDDMMYY(item.timestamp || item.requestedAt || item.processedAt)}</p>
                                ${showRemaining ? `<p class="mt-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">Remaining Balance: <span class="text-blue-600 dark:text-blue-300">${formatCurrency(balanceAfter)}</span></p>` : ''}
                                ${Number.isFinite(Number(balanceBefore)) ? `<p class="text-[10px] text-gray-400">Before: ${formatCurrency(balanceBefore)}</p>` : ''}
                                ${hasBalanceRisk ? `<p class="mt-1 inline-flex rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-black uppercase text-red-700 dark:text-red-200">Risk: requested more than available balance</p>` : ''}
                            </div>
                            <div class="text-right shrink-0">
                                <p class="font-black ${amountClass}">${sign}${formatCurrencyAbs(item.amount || 0)}</p>
                                <p class="text-[10px] uppercase text-gray-400">${escapeHtml(item.status || 'completed')}</p>
                            </div>
                        </div>
                    </div>`;
            }).join('') : '<p class="text-center text-gray-500 py-6">No transactions found.</p>';
        };

        const renderAdminFundRequests = (requests) => {
            const listEl = document.getElementById('admin-fund-requests-list-page');
            if (!listEl) return;

            const search = adminPendingWithdrawalSearch;
            const pendingRequests = [...requests].filter(r => {
                if (!search) return true;
                return [
                    r.userName,
                    r.userEmail,
                    r.userMobile,
                    r.mobile,
                    r.amount,
                    r.method,
                    getWithdrawalMethodName(r.methodId, ''),
                    getWithdrawalMethodName(normalizeWithdrawalMethodId(r), ''),
                    getWithdrawalDetailText(r),
                    r.paymentDetails,
                    r.paymentEmail,
                    r.upiId,
                    r.email,
                    r.accountNumber,
                    r.ifsc,
                    r.accountName,
                    r.bankName
                ].some(value => String(value || '').toLowerCase().includes(search));
            });
            pendingRequests.sort((a, b) => timestampToMillis(a.requestedAt || a.requested_at) - timestampToMillis(b.requestedAt || b.requested_at));

            const formatWithdrawalDateOnly = (value) => {
                const date = getSafeDate(value) || new Date();
                const dd = String(date.getDate()).padStart(2, '0');
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const yyyy = date.getFullYear();
                return `${dd}/${mm}/${yyyy}`;
            };
            const groupedByDate = pendingRequests.reduce((groups, request) => {
                const dateKey = formatWithdrawalDateOnly(request.requestedAt || request.requested_at);
                if (!groups.has(dateKey)) groups.set(dateKey, []);
                groups.get(dateKey).push(request);
                return groups;
            }, new Map());
            const renderRequestCard = (r) => {
                const methodId = normalizeWithdrawalMethodId(r);
                const methodName = getWithdrawalDisplayMethodName(r, 'N/A');
                const detailText = getWithdrawalDetailText({ ...r, methodId });
                const needsBalanceCut = shouldDeductLegacyWithdrawal(r);
                const isGiftOrEmailMethod = ['play_store', 'amazon_gift', 'flipkart_gift', 'paypal'].includes(methodId);
                const isGenericGiftCard = String(r.method || r.paymentMethod || '').toLowerCase().replace(/[\s-]+/g, '_') === 'gift_card';
                const payoutDetailLabel = methodId === 'upi' ? 'UPI' : methodId === 'bank' ? 'Bank Details' : (isGiftOrEmailMethod || isGenericGiftCard) ? 'Email / Gift Card Details' : 'Payment Details';
                const escapedDetail = escapeHtml(detailText);
                const giftTypeControl = isGenericGiftCard ? `
                    <select data-action="set-gift-card-type" data-userid="${r.userId}" data-requestid="${r.id}" class="text-xs font-bold bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-100 border border-yellow-200 dark:border-yellow-700 px-2 py-1 rounded outline-none">
                        <option value="">Set gift card type</option>
                        <option value="amazon_gift">Amazon Gift Card</option>
                        <option value="play_store">Google Play Gift Card</option>
                        <option value="flipkart_gift">Flipkart Gift Card</option>
                    </select>
                ` : '';
                return `
                <div class="relative p-3 pl-5 mb-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border ${needsBalanceCut ? 'border-red-200 dark:border-red-900/50' : 'border-gray-100 dark:border-gray-700'}">
                    ${needsBalanceCut ? '<span class="signup-old-pulse absolute left-2 top-5 h-2.5 w-2.5 rounded-full bg-red-600 shadow" title="Old wallet, balance cut pending"></span>' : ''}
                    <div class="flex flex-col sm:flex-row justify-between sm:items-start">
                        <div class="text-sm flex-grow mb-3 sm:mb-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="font-semibold capitalize text-yellow-600">Withdrawal of ${formatCurrency(r.amount)}</p>
                                ${needsBalanceCut ? '<span class="rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 px-2 py-0.5 text-[10px] font-black uppercase">Old wallet: balance cut pending</span>' : ''}
                            </div>
                            <p class="font-semibold text-gray-700 dark:text-gray-200">${r.userName || 'No Name'}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${r.userEmail || 'No Email'}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${r.userMobile || 'No Mobile'}</p>
                            <div class="flex flex-col mt-2 gap-2">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-xs font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded w-fit">Method: ${escapeHtml(methodName)}</p>
                                    ${giftTypeControl}
                                    <p class="text-xs font-mono bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 px-2 py-1 rounded w-fit">${escapeHtml(payoutDetailLabel)}: ${escapedDetail}</p>
                                    ${detailText && detailText !== 'N/A' ? `
                                        <button data-action="copy-text" data-text="${escapedDetail}" class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700" title="Copy payout detail" aria-label="Copy payout detail">
                                            <svg class="h-4 w-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                                <rect x="9" y="9" width="11" height="11" rx="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                            </svg>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-row sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 flex-shrink-0">
                            <button data-action="mark-as-paid" data-userid="${r.userId}" data-requestid="${r.id}" class="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 font-semibold">Confirm Payment</button>
                            <button data-action="reject-request" data-userid="${r.userId}" data-requestid="${r.id}" class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 font-semibold">Reject</button>
                        </div>
                    </div>
                </div>`;
            };

            listEl.innerHTML = pendingRequests.length === 0
                ? `<p class="text-gray-500 dark:text-gray-400 text-sm p-4 text-center">${search ? 'No pending requests match your search.' : 'No pending requests.'}</p>`
                : Array.from(groupedByDate.entries()).map(([date, dateRequests]) => `
                    <section class="mb-5">
                        <div class="mb-2 flex items-center gap-3">
                            <span class="shrink-0 rounded-full bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-800 px-3 py-1 text-xs font-black text-yellow-700 dark:text-yellow-200">Withdrawal Date: ${date}</span>
                            <span class="h-px flex-1 bg-yellow-100 dark:bg-yellow-900/50"></span>
                            <span class="shrink-0 text-[10px] font-bold uppercase text-gray-400">${dateRequests.length} pending</span>
                        </div>
                        ${dateRequests.map(renderRequestCard).join('')}
                    </section>
                `).join('');
            updateLegacyWithdrawalFixSummary();
        };

        const isLegacyWithdrawalRequest = (request = {}) => {
            return (request.type || 'withdrawal') === 'withdrawal';
        };

        const isWithdrawalBalanceDeducted = (request = {}) => {
            if (request.balanceDeducted === true || request.balance_deducted === true || request.legacyBalanceAdjusted === true || request.legacy_balance_adjusted === true) return true;
            const balanceAfter = Number(request.balanceAfter ?? request.balance_after);
            if (Number.isFinite(balanceAfter)) return true;
            return !isLegacyWithdrawalRequest(request);
        };

        const shouldDeductLegacyWithdrawal = (request = {}) =>
            isLegacyWithdrawalRequest(request) && !isWithdrawalBalanceDeducted(request);

        const getLegacyWithdrawalTargets = () =>
            allFundRequestsCache.filter(req => (req.status || 'pending') === 'pending' && shouldDeductLegacyWithdrawal(req));

        const updateLegacyWithdrawalFixSummary = () => {
            const summaryEl = document.getElementById('legacy-pending-withdrawal-summary');
            const fixBtn = document.getElementById('fix-legacy-pending-withdrawals-btn');
            if (!summaryEl || !fixBtn) return;
            const targets = getLegacyWithdrawalTargets();
            const total = targets.reduce((sum, req) => sum + Number(req.amount || 0), 0);
            if (!targets.length) {
                summaryEl.textContent = 'No pending withdrawal needs balance cut. All pending requests are already adjusted.';
                fixBtn.textContent = 'Nothing To Fix';
                fixBtn.disabled = true;
                return;
            }
            summaryEl.textContent = `${targets.length} pending withdrawal(s) still need one-time balance cut. Total: ${formatCurrency(total)}.`;
            fixBtn.textContent = `Cut ${targets.length} Uncut Pending`;
            fixBtn.disabled = false;
        };

        const handleSetWithdrawalGiftCardType = async (userId, requestId, methodId) => {
            const allowed = ['amazon_gift', 'play_store', 'flipkart_gift'];
            if (!allowed.includes(methodId)) return;
            const giftCardName = getWithdrawalMethodName(methodId, 'Gift Card');
            const updatePayload = {
                methodId,
                paymentMethod: methodId,
                method: giftCardName,
                giftCardType: methodId,
                giftCardName,
                updatedAt: serverTimestamp()
            };
            try {
                const reqRef = doc(db, `artifacts/${appId}/public/data/fund_requests`, requestId);
                await updateDoc(reqRef, updatePayload);
                const existing = allFundRequestsCache.find(req => req.id === requestId) || {};
                const updatedRequest = { ...existing, ...updatePayload, updatedAt: Date.now() };
                allFundRequestsCache = allFundRequestsCache.map(req => req.id === requestId ? updatedRequest : req);
                renderAdminFundRequests(allFundRequestsCache);
                updateCloudFundRequestStatus(requestId, updatedRequest.status || 'pending', updatedRequest)
                    .catch(error => console.warn('Cloud gift card type update skipped:', error));
                if (userId) syncRecentTransactionsToCloud(userId).catch(error => console.warn('Gift card transaction sync skipped:', error));
                showNotification(`${giftCardName} saved for this withdrawal.`);
            } catch (error) {
                console.error('Gift card type update failed:', error);
                showNotification(`Could not save gift card type: ${error.message}`, true);
                renderAdminFundRequests(allFundRequestsCache);
            }
        };

        const applyLegacyWithdrawalDeduction = async (userId, requestId, requestData = {}) => {
            if (!shouldDeductLegacyWithdrawal(requestData)) return requestData;
            const amount = Number(requestData.amount || 0);
            if (!amount || amount <= 0) return requestData;

            const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
            const reqRef = doc(db, `artifacts/${appId}/public/data/fund_requests`, requestId);
            const cachedUser = allUsersCache.find(u => u.id === userId || u.uid === userId) || {};
            const currentBalance = Number.isFinite(Number(requestData.balanceBefore ?? requestData.balance_before))
                ? Number(requestData.balanceBefore ?? requestData.balance_before)
                : (Number.isFinite(Number(cachedUser.balance)) ? Number(cachedUser.balance) : null);
            const balanceAfter = currentBalance !== null ? Number((currentBalance - amount).toFixed(2)) : null;
            const cutTransactionId = `ADMIN-CUT-${requestId}`;
            const adjustment = {
                ...(currentBalance !== null ? { balanceBefore: currentBalance } : {}),
                ...(balanceAfter !== null ? { balanceAfter } : {}),
                balanceDeducted: true,
                legacyBalanceAdjusted: true,
                legacyBalanceAdjustedAt: serverTimestamp(),
                legacyBalanceAdjustedBy: currentUser?.uid || ADMIN_UID
            };
            const updatedRequest = { ...requestData, ...adjustment, legacyBalanceAdjustedAt: Date.now() };

            await Promise.all([
                updateDoc(userRef, { balance: increment(-amount) }),
                updateDoc(reqRef, adjustment).catch(error => {
                    console.warn('Legacy withdrawal request marker skipped:', error);
                })
            ]);

            await updateCloudFundRequestStatus(requestId, 'pending', {
                ...updatedRequest,
                balanceBefore: updatedRequest.balanceBefore,
                balanceAfter: updatedRequest.balanceAfter,
                balanceDeducted: true,
                legacyBalanceAdjusted: true,
                legacyBalanceAdjustedAt: Date.now()
            });
            const debitHistory = {
                type: 'debit',
                amount,
                comment: 'Admin Debit - Pending Withdrawal Balance Cut',
                adminComment: 'Balance deducted for pending withdrawal request',
                timestamp: Date.now(),
                transactionId: cutTransactionId,
                requestId,
                method: getWithdrawalDisplayMethodName(requestData, 'Withdrawal'),
                status: 'completed',
                balanceBefore: currentBalance,
                balanceAfter,
                isAdminTransaction: true,
                isWithdrawalBalanceCut: true
            };
            await recordUserFirestoreTransaction(userId, debitHistory);
            recordCloudTransaction(userId, debitHistory).catch(error => {
                console.warn('Legacy withdrawal debit cloud history skipped:', error);
            });
            allFundRequestsCache = allFundRequestsCache.map(req => req.id === requestId ? { ...req, ...updatedRequest } : req);
            allUsersCache = allUsersCache.map(u => (u.id === userId || u.uid === userId) ? { ...u, balance: Number(u.balance || 0) - amount } : u);
            return updatedRequest;
        };

        const handleFixLegacyPendingWithdrawals = async () => {
            if (currentUser?.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const targets = getLegacyWithdrawalTargets();
            if (!targets.length) return showNotification('No pending withdrawals need balance correction.');
            const total = targets.reduce((sum, req) => sum + Number(req.amount || 0), 0);
            renderModal('Fix Uncut Pending Withdrawals',
                `<div class="space-y-3 text-sm">
                    <p>This will deduct pending withdrawal amounts that are not already marked as balance cut. Use this for old app withdrawals where balance was not deducted.</p>
                    <div class="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
                        <p class="font-bold">${targets.length} request(s)</p>
                        <p class="text-yellow-700 dark:text-yellow-200">Total to deduct: ${formatCurrency(total)}</p>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">A completed admin debit entry will be added to each user's transaction history with before/after balance.</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-legacy-withdrawal-fix-btn" class="px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg">Deduct Uncut Pending</button>`,
                'max-w-md'
            );
            document.getElementById('confirm-legacy-withdrawal-fix-btn').onclick = async () => {
                const btn = document.getElementById('confirm-legacy-withdrawal-fix-btn');
                btn.disabled = true;
                btn.textContent = 'Fixing...';
                let fixed = 0;
                try {
                    for (const req of targets) {
                        await applyLegacyWithdrawalDeduction(req.userId, req.id, req);
                        fixed++;
                    }
                    renderAdminFundRequests(allFundRequestsCache);
                    updateLegacyWithdrawalFixSummary();
                    refreshAdminDashboardCaches().catch(error => console.warn('Admin cache refresh after legacy fix skipped:', error));
                    showNotification(`Fixed ${fixed} old pending withdrawal(s).`);
                    window.closeModal();
                } catch (error) {
                    console.error('Legacy withdrawal fix failed:', error);
                    showNotification(`Error: ${error.message}`, true);
                    btn.disabled = false;
                    btn.textContent = 'Deduct Old Pending';
                }
            };
        };

        const renderAdminRechargeRequests = (requests) => {
            const listEl = document.getElementById('admin-recharge-requests-list-page');
            if (!listEl) return;

            const pendingRequests = [...requests];
            pendingRequests.sort((a, b) => timestampToMillis(a.requestedAt || a.requested_at) - timestampToMillis(b.requestedAt || b.requested_at));

            listEl.innerHTML = pendingRequests.length === 0 ? '<p class="text-gray-500 dark:text-gray-400 text-sm p-4 text-center">No pending recharge requests.</p>' : pendingRequests.map(r => `
                <div class="p-4 mb-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-100 dark:border-sky-800">
                    <div class="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                        <div class="text-sm flex-grow space-y-2">
                            <div>
                                <p class="font-semibold text-sky-700 dark:text-sky-300">Recharge ${formatCurrency(r.amount)}</p>
                                <p class="font-semibold text-gray-700 dark:text-gray-200">${r.userName || 'No Name'}</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400">${r.userEmail || 'No Email'} | ${r.userMobile || 'No Mobile'}</p>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <p class="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">Recharge Mobile: <span class="font-mono font-semibold">${r.mobileNumber || 'N/A'}</span></p>
                                <p class="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">Operator: <span class="font-semibold">${r.operator || 'N/A'}</span></p>
                                <p class="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">State: <span class="font-semibold">${r.state || 'N/A'}</span></p>
                                <p class="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">Wallet Cut: <span class="font-semibold">${formatCurrency(r.chargeAmount || r.amount || 0)}</span></p>
                            </div>
                            <div class="text-xs bg-white dark:bg-gray-800 px-2 py-2 rounded">
                                <p class="text-gray-500 dark:text-gray-400">Plan Details</p>
                                <p class="font-semibold">${r.planDetails || 'N/A'}</p>
                            </div>
                            <div class="flex flex-wrap gap-2 text-xs">
                                <span class="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">1% discount: ${formatCurrency(r.discount || 0)}</span>
                                <button data-action="copy-text" data-text="${r.mobileNumber || ''}" class="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600">Copy Mobile</button>
                            </div>
                        </div>
                        <div class="flex flex-row sm:flex-col gap-2 flex-shrink-0">
                            <button data-action="complete-recharge" data-userid="${r.userId}" data-requestid="${r.id}" class="px-3 py-1 text-xs bg-sky-600 text-white rounded hover:bg-sky-700 font-semibold">Mark Done</button>
                            <button data-action="reject-recharge" data-userid="${r.userId}" data-requestid="${r.id}" class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 font-semibold">Reject</button>
                        </div>
                    </div>
                </div>`).join('');
        };

        const showAdminLoanPage = () => {
            const content = `
                ${getPageHeader('Manage Loan')}
                <div id="admin-loan-page" class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
                    <div class="flex flex-wrap gap-2">
                        <button data-loan-filter="pending" class="loan-filter-btn px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Pending</button>
                        <button data-loan-filter="approved" class="loan-filter-btn px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-semibold">Approved</button>
                        <button data-loan-filter="rejected" class="loan-filter-btn px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-semibold">Rejected</button>
                        <button data-loan-filter="loans" class="loan-filter-btn px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-semibold">Active/Paid Loans</button>
                    </div>
                    <input id="loan-admin-search" placeholder="Search name, mobile, Aadhaar..." class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <div id="admin-loan-list" class="max-h-[70vh] overflow-y-auto"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            window.currentLoanFilter = window.currentLoanFilter || 'pending';
            document.getElementById('admin-loan-page').addEventListener('click', (e) => {
                const btn = e.target.closest('.loan-filter-btn');
                if (!btn) return;
                window.currentLoanFilter = btn.dataset.loanFilter;
                renderAdminLoanPage();
            });
            document.getElementById('loan-admin-search').addEventListener('input', renderAdminLoanPage);
            renderAdminLoanPage();
        };

        const renderAdminLoanPage = () => {
            const listEl = document.getElementById('admin-loan-list');
            if (!listEl) return;
            updateAdminLoanRequestBadge();
            const filter = window.currentLoanFilter || 'pending';
            document.querySelectorAll('.loan-filter-btn').forEach(btn => {
                const active = btn.dataset.loanFilter === filter;
                btn.className = `loan-filter-btn px-3 py-2 rounded-lg text-sm font-semibold ${active ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`;
            });
            const search = (document.getElementById('loan-admin-search')?.value || '').toLowerCase();

            if (filter === 'loans') {
                const grouped = new Map();
                [...allLoansCache].filter(isModernLoanRecord).forEach(loan => {
                    const userId = loan.userId || 'unknown';
                    const current = grouped.get(userId) || { userId, loans: [], user: allUsersCache.find(user => (user.id || user.uid) === userId) || {} };
                    current.loans.push(loan);
                    grouped.set(userId, current);
                });
                let groups = Array.from(grouped.values()).map(group => {
                    const loans = group.loans.sort((a, b) => timestampToMillis(b.createdAt || b.paidAt) - timestampToMillis(a.createdAt || a.paidAt));
                    const activeLoans = loans.filter(isActiveLoanRecord);
                    const totalUsed = activeLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
                    const totalRepayable = activeLoans.reduce((sum, loan) => sum + Number(loan.totalRepayable || 0), 0);
                    const latest = loans[0] || {};
                    const user = group.user || {};
                    return { ...group, loans, activeLoans, totalUsed, totalRepayable, latest, user };
                }).filter(group => !search || [
                    group.user.name,
                    group.user.mobile,
                    group.user.email,
                    group.latest.userName,
                    group.latest.userMobile,
                    group.latest.status
                ].some(v => String(v || '').toLowerCase().includes(search)));

                groups.sort((a, b) => timestampToMillis(b.latest.createdAt || b.latest.paidAt) - timestampToMillis(a.latest.createdAt || a.latest.paidAt));
                listEl.innerHTML = groups.length ? groups.map(group => {
                    const displayName = group.user.name || group.latest.userName || 'User';
                    const displayMobile = group.user.mobile || group.latest.userMobile || '';
                    return `
                        <button data-action="view-admin-loan-user" data-userid="${group.userId}" class="w-full p-4 mb-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-left text-sm border border-gray-100 dark:border-gray-700">
                            <div class="flex justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="font-black truncate">${escapeHtml(displayName)}</p>
                                    <p class="text-xs text-gray-500 truncate">${escapeHtml(displayMobile || group.user.email || '')}</p>
                                    <p class="mt-1 text-xs text-gray-500">${group.loans.length} loan record(s) | ${group.activeLoans.length} active</p>
                                </div>
                                <div class="text-right shrink-0">
                                    <p class="font-black">${formatCurrency(group.totalUsed)}</p>
                                    <p class="text-xs text-gray-500">Used now</p>
                                    <p class="text-xs font-semibold text-indigo-600 dark:text-indigo-300">Limit ${formatCurrency(getLoanLimitAmount(group.user))}</p>
                                </div>
                            </div>
                            ${group.totalRepayable ? `<div class="mt-3 rounded-xl bg-white dark:bg-gray-800 px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300">Active repayable: ${formatCurrency(group.totalRepayable)}</div>` : ''}
                        </button>`;
                }).join('') : '<p class="text-center text-gray-500 py-6">No loan users found.</p>';
                return;
            }

            const getLoanAdminRequestTime = (request = {}) => Math.max(
                timestampToMillis(request.reopenedAt || request.reopened_at),
                timestampToMillis(request.processedAt || request.processed_at),
                timestampToMillis(request.requestedAt || request.requested_at || request.createdAt || request.timestamp)
            );
            const getLoanAdminRequestKey = (request = {}) => String(
                request.userId ||
                request.uid ||
                request.userEmail ||
                request.mobile ||
                request.aadhaar ||
                request.id ||
                ''
            ).trim().toLowerCase();
            const latestRequestByUser = new Map();
            [...allLoanRequestsCache]
                .filter(isModernLoanRequest)
                .sort((a, b) => getLoanAdminRequestTime(b) - getLoanAdminRequestTime(a))
                .forEach((request) => {
                    const key = getLoanAdminRequestKey(request);
                    if (!key || latestRequestByUser.has(key)) return;
                    latestRequestByUser.set(key, request);
                });
            let requests = Array.from(latestRequestByUser.values()).filter(r => getLoanRequestStatus(r) === filter);
            requests = requests.filter(r => !search || [r.name, r.fatherName, r.mobile, r.alternateMobile, r.dob, r.aadhaar].some(v => (v || '').toString().toLowerCase().includes(search)));
            listEl.innerHTML = requests.length ? requests.map(r => {
                const status = getLoanRequestStatus(r);
                return `
                <div class="p-4 mb-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-sm">
                    <div class="flex flex-col sm:flex-row justify-between gap-3">
                        <div class="space-y-1">
                            <p class="font-semibold">${r.name || 'No Name'}</p>
                            <p class="text-xs text-gray-500">Father: ${r.fatherName || 'N/A'}</p>
                            <p class="text-xs text-gray-500">Mobile: ${r.mobile || 'N/A'} | Alt: ${r.alternateMobile || 'N/A'}</p>
                            <p class="text-xs text-gray-500">DOB: ${r.dob || 'N/A'}</p>
                            <p class="text-xs text-gray-500">Aadhaar: ${r.aadhaar || 'N/A'}</p>
                            <p class="text-xs text-gray-500">User: ${r.userEmail || 'N/A'}</p>
                            <div class="flex flex-wrap gap-2 pt-1">
                                ${r.documents?.aadhaar?.url ? `<button type="button" data-action="preview-loan-doc" data-requestid="${r.id}" data-doctype="aadhaar" class="rounded bg-indigo-100 px-2 py-1 text-[10px] font-black text-indigo-700">View Aadhaar</button>` : '<span class="rounded bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-500">No Aadhaar file</span>'}
                                ${r.documents?.selfie?.url ? `<button type="button" data-action="preview-loan-doc" data-requestid="${r.id}" data-doctype="selfie" class="rounded bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">View Selfie</button>` : '<span class="rounded bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-500">No selfie file</span>'}
                            </div>
                            ${r.maxLoanAmount ? `<p class="text-xs font-semibold text-indigo-600 dark:text-indigo-300">Approved Max: ${formatCurrency(r.maxLoanAmount)}</p>` : ''}
                            ${status === 'rejected' && r.rejectionReason ? `<p class="text-xs font-semibold text-red-600 dark:text-red-300">Reason: ${escapeHtml(r.rejectionReason)}</p>` : ''}
                        </div>
                        ${status === 'pending' ? `
                            <div class="flex sm:flex-col gap-2">
                                <button data-action="approve-loan-request" data-requestid="${r.id}" data-userid="${r.userId}" class="px-3 py-1 text-xs bg-green-600 text-white rounded font-semibold">Approve</button>
                                <button data-action="reject-loan-request" data-requestid="${r.id}" data-userid="${r.userId}" class="px-3 py-1 text-xs bg-red-600 text-white rounded font-semibold">Reject</button>
                            </div>` : ''}
                        ${status === 'rejected' ? `
                            <div class="flex flex-wrap sm:flex-col gap-2">
                                <button data-action="approve-loan-request" data-requestid="${r.id}" data-userid="${r.userId}" class="px-3 py-1 text-xs bg-green-600 text-white rounded font-semibold" title="Approve rejected request">&#10003; Approve</button>
                                <button data-action="give-loan-chance" data-requestid="${r.id}" data-userid="${r.userId}" class="px-3 py-1 text-xs bg-indigo-600 text-white rounded font-semibold">Give Chance</button>
                            </div>` : ''}
                    </div>
                </div>`;
            }).join('') : '<p class="text-center text-gray-500 py-6">No loan requests found.</p>';
        };

        const showAdminLoanUserDetailsPage = (userId) => {
            const user = allUsersCache.find(item => (item.id || item.uid) === userId) || {};
            const loans = getUserLoanRecords(userId);
            const summary = buildLoanSummary(user, loans);
            const request = getLatestModernLoanRequest(userId);
            const loanRows = loans.length ? loans.map(loan => {
                const dueDate = toDate(loan.dueDate);
                const createdAt = toDate(loan.createdAt);
                const canAutoDebit = isActiveLoanRecord(loan) && dueDate && dueDate <= new Date();
                return `
                    <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm">
                        <div class="flex justify-between gap-3">
                            <div>
                                <p class="font-black">${formatCurrency(loan.amount || 0)} <span class="text-[10px] uppercase text-gray-500">${escapeHtml(loan.status || 'active')}</span></p>
                                <p class="text-xs text-gray-500">${createdAt ? createdAt.toLocaleDateString('en-IN') : 'N/A'} | Due ${dueDate ? dueDate.toLocaleDateString('en-IN') : 'N/A'}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-black">${formatCurrency(loan.totalRepayable || 0)}</p>
                                <p class="text-xs text-gray-500">Repay</p>
                            </div>
                        </div>
                        <div class="mt-3 flex flex-wrap gap-2">
                            <button data-action="admin-view-loan-detail" data-loanid="${loan.id}" class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white dark:bg-slate-100 dark:text-slate-900">Full Details</button>
                            ${isActiveLoanRecord(loan) ? `<button data-action="admin-loan-auto-debit" data-loanid="${loan.id}" ${canAutoDebit ? '' : 'disabled'} class="rounded-lg px-3 py-2 text-xs font-black ${canAutoDebit ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'}">Auto Debit</button>` : ''}
                        </div>
                    </div>`;
            }).join('') : '<p class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-5 text-center text-sm font-bold text-gray-500">No loan history.</p>';

            showPage(`
                ${getPageHeader('Loan User Details')}
                <div class="max-w-3xl mx-auto space-y-4">
                    <div class="rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 class="text-lg font-black text-gray-900 dark:text-white">${escapeHtml(user.name || request?.name || 'User')}</h3>
                                <p class="text-xs text-gray-500">${escapeHtml(user.mobile || request?.mobile || '')} ${user.email ? `| ${escapeHtml(user.email)}` : ''}</p>
                            </div>
                            <button data-action="admin-add-loan-limit" data-userid="${userId}" class="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white">Add / Change Limit</button>
                        </div>
                        <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div class="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-3"><p class="text-xs text-gray-500">Max Limit</p><p class="font-black">${formatCurrency(summary.maxLimit)}</p></div>
                            <div class="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3"><p class="text-xs text-gray-500">Used</p><p class="font-black">${formatCurrency(summary.usedAmount)}</p></div>
                            <div class="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3"><p class="text-xs text-gray-500">Available</p><p class="font-black">${formatCurrency(summary.availableAmount)}</p></div>
                            <div class="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3"><p class="text-xs text-gray-500">Repayable</p><p class="font-black">${formatCurrency(summary.repayableAmount)}</p></div>
                        </div>
                    </div>
                    <div class="rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 class="text-sm font-black text-gray-900 dark:text-white">Uploaded Documents</h3>
                        <div class="mt-3 flex flex-wrap gap-2 text-xs">
                            ${request?.documents?.aadhaar?.url ? `<button type="button" data-action="preview-loan-doc" data-requestid="${request.id}" data-doctype="aadhaar" class="rounded-lg bg-indigo-100 px-3 py-2 font-black text-indigo-700">Open Aadhaar</button>` : '<span class="rounded-lg bg-gray-100 px-3 py-2 font-black text-gray-500">Aadhaar not uploaded</span>'}
                            ${request?.documents?.selfie?.url ? `<button type="button" data-action="preview-loan-doc" data-requestid="${request.id}" data-doctype="selfie" class="rounded-lg bg-emerald-100 px-3 py-2 font-black text-emerald-700">Open Selfie</button>` : '<span class="rounded-lg bg-gray-100 px-3 py-2 font-black text-gray-500">Selfie not uploaded</span>'}
                            <span class="rounded-lg bg-yellow-100 px-3 py-2 font-black text-yellow-700">Match: ${escapeHtml(request?.documents?.aadhaarSelfieMatchStatus || 'pending_admin_review')}</span>
                        </div>
                    </div>
                    <div class="space-y-3">
                        <h3 class="px-1 text-sm font-black text-gray-900 dark:text-white">Loan History</h3>
                        ${loanRows}
                    </div>
                </div>
                ${getPageFooter()}`, { returnTo: 'admin', onBack: showAdminLoanPage });
            setBottomNavActive('bottom-admin-btn');
        };

        const showLoanDocumentPreviewModal = (requestId, docType) => {
            const request = allLoanRequestsCache.find(item => item.id === requestId);
            const documentInfo = request?.documents?.[docType];
            const url = String(documentInfo?.url || '').trim();
            if (!url) return showNotification('Document not found.', true);

            const label = docType === 'selfie' ? 'Selfie' : 'Aadhaar';
            const source = escapeHtml(url);
            const filename = String(documentInfo?.name || url || '').toLowerCase();
            const fileType = String(documentInfo?.type || documentInfo?.contentType || '').toLowerCase();
            const isPdf = fileType.includes('pdf') || /\.pdf(?:[?#].*)?$/i.test(filename);
            const isImage = fileType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|heif)(?:[?#].*)?$/i.test(filename) || !isPdf;
            const preview = isPdf
                ? `<iframe src="${source}" title="${label} document" class="h-[70vh] w-full rounded-2xl border border-gray-200 bg-white dark:border-gray-700"></iframe>`
                : `<div class="max-h-[72vh] overflow-auto rounded-2xl bg-gray-100 dark:bg-gray-900 p-2">
                        <img src="${source}" alt="${label} document" class="mx-auto max-h-[68vh] w-auto max-w-full rounded-xl object-contain">
                   </div>`;

            renderModal(`${label} Document`,
                `<div class="space-y-3">
                    <div class="rounded-2xl bg-indigo-50 px-4 py-3 text-sm dark:bg-indigo-900/20">
                        <p class="font-black text-gray-900 dark:text-white">${escapeHtml(request?.name || 'Loan Applicant')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(request?.mobile || request?.userEmail || '')}</p>
                    </div>
                    ${preview}
                </div>`,
                `<a href="${source}" target="_blank" rel="noopener" class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-black text-gray-700 dark:bg-gray-700 dark:text-gray-100">Open Link</a>
                 <button onclick="window.closeModal()" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black text-white">Close</button>`,
                'max-w-4xl');
        };

        const showAdminLoanDetailModal = (loanId) => {
            const loan = allLoansCache.find(item => item.id === loanId);
            if (!loan) return showNotification('Loan details not found.', true);
            const dueDate = toDate(loan.dueDate);
            const createdAt = toDate(loan.createdAt);
            const paidAt = toDate(loan.paidAt);
            renderModal('Admin Loan Details',
                `<div class="space-y-3 text-sm">
                    <div class="rounded-2xl bg-gray-50 dark:bg-gray-700 p-4 space-y-2">
                        <div class="flex justify-between gap-3"><span>User</span><span class="font-bold text-right">${escapeHtml(loan.userName || 'User')}</span></div>
                        <div class="flex justify-between gap-3"><span>Mobile</span><span class="font-bold text-right">${escapeHtml(loan.userMobile || 'N/A')}</span></div>
                        <div class="flex justify-between gap-3"><span>Status</span><span class="font-bold text-right">${escapeHtml(loan.status || 'active')}</span></div>
                    </div>
                    <div class="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                        <div class="flex justify-between gap-3"><span>Principal</span><span class="font-black">${formatCurrency(loan.amount || 0)}</span></div>
                        <div class="flex justify-between gap-3"><span>Interest</span><span class="font-black">${formatCurrency(loan.interest || 0)}</span></div>
                        <div class="flex justify-between gap-3"><span>Total Repay</span><span class="font-black">${formatCurrency(loan.totalRepayable || 0)}</span></div>
                        <div class="flex justify-between gap-3"><span>Credit Limit</span><span class="font-black">${formatCurrency(loan.creditLimitAtBorrow || 0)}</span></div>
                        <div class="flex justify-between gap-3"><span>Created</span><span class="font-black">${createdAt ? createdAt.toLocaleDateString('en-IN') : 'N/A'}</span></div>
                        <div class="flex justify-between gap-3"><span>Due Date</span><span class="font-black">${dueDate ? dueDate.toLocaleDateString('en-IN') : 'N/A'}</span></div>
                        ${paidAt ? `<div class="flex justify-between gap-3"><span>Paid</span><span class="font-black">${paidAt.toLocaleDateString('en-IN')}</span></div>` : ''}
                    </div>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg">Close</button>`,
                'max-w-md');
        };

        const showAdminAddLoanLimitModal = (userId) => {
            const user = allUsersCache.find(item => (item.id || item.uid) === userId) || {};
            renderModal('Update Loan Limit',
                `<div class="space-y-4">
                    <div class="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-3 text-sm">
                        <p class="font-black">${escapeHtml(user.name || 'User')}</p>
                        <p class="text-xs text-gray-500">${escapeHtml(user.mobile || user.email || '')}</p>
                    </div>
                    <input type="number" id="admin-loan-limit-input" min="1" step="1" value="${getLoanLimitAmount(user) || ''}" placeholder="New max credit limit" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-admin-loan-limit-btn" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg">Save Limit</button>`,
                'max-w-md');
            document.getElementById('confirm-admin-loan-limit-btn').onclick = async () => {
                const amount = Number(document.getElementById('admin-loan-limit-input')?.value || 0);
                if (!Number.isFinite(amount) || amount < 1) return showNotification('Enter a valid loan limit.', true);
                await updateAdminLoanLimit(userId, amount);
            };
        };

        const updateAdminLoanLimit = async (userId, amount) => {
            try {
                await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, userId), {
                    loanEligible: true,
                    maxLoanAmount: Number(amount),
                    loanMaxAmount: Number(amount),
                    loanApplicationVersion: LOAN_APPLICATION_VERSION,
                    loanRequestStatus: 'approved',
                    loanLimitUpdatedAt: serverTimestamp(),
                    loanLimitUpdatedBy: currentUser.uid
                });
                allUsersCache = allUsersCache.map(user => (user.id || user.uid) === userId ? {
                    ...user,
                    loanEligible: true,
                    maxLoanAmount: Number(amount),
                    loanMaxAmount: Number(amount),
                    loanApplicationVersion: LOAN_APPLICATION_VERSION,
                    loanRequestStatus: 'approved'
                } : user);
                showNotification('Loan limit updated.');
                window.closeModal();
                showAdminLoanUserDetailsPage(userId);
            } catch (error) {
                console.error('Loan limit update failed:', error);
                showNotification(`Error: ${error.message}`, true);
            }
        };

        const showAdminInvestmentsPage = () => {
            const content = `
                ${getPageHeader('Manage Partner')}
                <div id="admin-investments-page" class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
                    <div class="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                        <input id="investment-admin-search" placeholder="Search user, mobile, invoice..." class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Interest button unlocks only after 30 days.</span>
                    </div>
                    <div id="admin-investments-list" class="max-h-[72vh] overflow-y-auto"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            document.getElementById('investment-admin-search').addEventListener('input', renderAdminInvestmentsPage);
            renderAdminInvestmentsPage();
        };

        const renderAdminInvestmentsPage = () => {
            const listEl = document.getElementById('admin-investments-list');
            if (!listEl) return;
            const search = (document.getElementById('investment-admin-search')?.value || '').toLowerCase();
            let investments = [...allInvestmentsCache].filter(i => !search || [i.userName, i.userMobile, i.userEmail, i.invoiceId, i.status].some(v => (v || '').toString().toLowerCase().includes(search)));

            const grouped = new Map();
            investments.forEach(inv => {
                const userId = inv.userId || 'unknown';
                const group = grouped.get(userId) || { userId, user: allUsersCache.find(user => (user.id || user.uid) === userId) || {}, investments: [] };
                group.investments.push(inv);
                grouped.set(userId, group);
            });
            const groups = Array.from(grouped.values()).map(group => {
                const active = group.investments.filter(inv => (inv.status || 'active') === 'active');
                const totalAmount = group.investments.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
                const activeAmount = active.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
                const paidInterest = group.investments.reduce((sum, inv) => sum + Number(inv.paidInterest || 0), 0);
                const latest = group.investments.sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt))[0] || {};
                return { ...group, active, totalAmount, activeAmount, paidInterest, latest };
            }).sort((a, b) => timestampToMillis(b.latest.createdAt) - timestampToMillis(a.latest.createdAt));

            listEl.innerHTML = groups.length ? groups.map(group => {
                const name = group.user.name || group.latest.userName || 'User';
                const mobile = group.user.mobile || group.latest.userMobile || '';
                return `
                    <button data-action="view-admin-investment-user" data-userid="${group.userId}" class="w-full p-4 mb-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-left text-sm border border-gray-100 dark:border-gray-700">
                        <div class="flex justify-between gap-3">
                            <div class="min-w-0">
                                <p class="font-black truncate">${escapeHtml(name)}</p>
                                <p class="text-xs text-gray-500 truncate">${escapeHtml(mobile || group.user.email || group.latest.userEmail || '')}</p>
                                <p class="mt-1 text-xs text-gray-500">${group.investments.length} investment record(s) | ${group.active.length} active</p>
                            </div>
                            <div class="text-right shrink-0">
                                <p class="font-black">${formatCurrency(group.activeAmount)}</p>
                                <p class="text-xs text-gray-500">Active</p>
                            </div>
                        </div>
                        <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div class="rounded-xl bg-white dark:bg-gray-800 p-2"><span class="text-gray-500">Total Invested</span><p class="font-bold">${formatCurrency(group.totalAmount)}</p></div>
                            <div class="rounded-xl bg-white dark:bg-gray-800 p-2"><span class="text-gray-500">Interest Paid</span><p class="font-bold">${formatCurrency(group.paidInterest)}</p></div>
                        </div>
                    </button>`;
            }).join('') : '<p class="text-center text-gray-500 py-6">No partner investments found.</p>';
        };

        const showAdminInvestmentUserDetailsPage = (userId) => {
            const user = allUsersCache.find(item => (item.id || item.uid) === userId) || {};
            const investments = allInvestmentsCache
                .filter(inv => inv.userId === userId)
                .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
            const active = investments.filter(inv => (inv.status || 'active') === 'active');
            const totalAmount = investments.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
            const activeAmount = active.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
            const paidInterest = investments.reduce((sum, inv) => sum + Number(inv.paidInterest || 0), 0);
            const cards = investments.length ? investments.map(inv => {
                const next = toDate(inv.nextPayoutAt);
                const end = toDate(inv.endDate);
                const due = inv.status === 'active' && next && next <= new Date();
                return `
                    <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm">
                        <div class="flex justify-between gap-3">
                            <div>
                                <p class="font-black">${formatCurrency(inv.amount || 0)} <span class="text-[10px] uppercase text-gray-500">${escapeHtml(inv.status || 'active')}</span></p>
                                <p class="text-xs text-gray-500">Invoice: ${escapeHtml(inv.invoiceId || inv.id)}</p>
                                <p class="text-xs text-gray-500">Next: ${next && inv.status === 'active' ? next.toLocaleDateString('en-IN') : 'Done'} | End: ${end ? end.toLocaleDateString('en-IN') : 'N/A'}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-black">${formatCurrency(inv.paidInterest || 0)}</p>
                                <p class="text-xs text-gray-500">Interest paid</p>
                            </div>
                        </div>
                        <div class="mt-3 flex flex-wrap gap-2">
                            <button data-action="process-investment-interest" data-investmentid="${inv.id}" ${due ? '' : 'disabled'} class="rounded-lg px-3 py-2 text-xs font-black ${due ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'}">Give Interest</button>
                            <button data-action="download-admin-investment-invoice" data-investmentid="${inv.id}" class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white dark:bg-slate-100 dark:text-slate-900">Invoice</button>
                        </div>
                    </div>`;
            }).join('') : '<p class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-5 text-center text-sm font-bold text-gray-500">No investment history.</p>';

            showPage(`
                ${getPageHeader('Partner User Details')}
                <div class="max-w-3xl mx-auto space-y-4">
                    <div class="rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 class="text-lg font-black text-gray-900 dark:text-white">${escapeHtml(user.name || investments[0]?.userName || 'User')}</h3>
                        <p class="text-xs text-gray-500">${escapeHtml(user.mobile || investments[0]?.userMobile || '')} ${user.email ? `| ${escapeHtml(user.email)}` : ''}</p>
                        <div class="mt-4 grid grid-cols-3 gap-3 text-sm">
                            <div class="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3"><p class="text-xs text-gray-500">Active</p><p class="font-black">${formatCurrency(activeAmount)}</p></div>
                            <div class="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3"><p class="text-xs text-gray-500">Total</p><p class="font-black">${formatCurrency(totalAmount)}</p></div>
                            <div class="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3"><p class="text-xs text-gray-500">Interest</p><p class="font-black">${formatCurrency(paidInterest)}</p></div>
                        </div>
                    </div>
                    <div class="space-y-3">${cards}</div>
                </div>
                ${getPageFooter()}`, { returnTo: 'admin', onBack: showAdminInvestmentsPage });
            setBottomNavActive('bottom-admin-btn');
        };

        const processDuePartnerInvestmentsForAdmin = async (showToast = false) => {
            const dueInvestments = allInvestmentsCache.filter(inv => inv.status === 'active' && toDate(inv.nextPayoutAt) && toDate(inv.nextPayoutAt) <= new Date());
            let processed = 0;
            for (const inv of dueInvestments) {
                try {
                    await processPartnerInterest(inv.id);
                    processed++;
                } catch (e) {
                    console.error('Due partner interest failed:', e);
                }
            }
            if (showToast) showNotification(processed ? `Processed ${processed} due investment(s).` : 'No investment has completed 30 days yet.', !processed);
        };

        const renderAdminGiftCodesList = (docs) => {
            const listEl = document.getElementById('gift-codes-list-page');
            if (!listEl) return;
            listEl.innerHTML = docs.length === 0 ? '<p class="text-xs text-gray-500 dark:text-gray-400">No codes.</p>' : docs.map(d => {
                const c = d.data();
                const status = (c.timesUsed || 0) >= (c.usageLimit || 1) ? 'Fully Redeemed' : `${c.timesUsed || 0}/${c.usageLimit || 1} Used`;
                return `
                    <div class="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex justify-between items-center text-sm">
                        <div>
                            <p class="font-mono font-semibold">${c.code}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${formatCurrency(c.amount)} - ${status}</p>
                        </div>
                        <button data-action="delete-gift-code" data-id="${d.id}" class="text-red-500 hover:text-red-700 text-xs font-semibold">Delete</button>
                    </div>`;
            }).join('');
        };

        // --- ACTIONS & EVENT HANDLERS ---

        const handleSubmitRechargeRequest = async ({ mobileNumber, operator, state, planDetails, amount, discount, chargeAmount }) => {
            if (!currentUser) return showNotification('Error: You are not logged in.', true);
            if (!currentUserData) return showNotification('Your user data is still loading. Please try again.', true);

            try {
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                const reqRef = doc(collection(db, `artifacts/${appId}/public/data/fund_requests`));
                const requestedAt = Date.now();
                const requestPayload = {
                    id: reqRef.id,
                    userId: currentUser.uid,
                    userName: currentUserData.name || 'N/A',
                    userMobile: currentUserData.mobile || 'N/A',
                    userEmail: currentUserData.email || 'N/A',
                    type: 'mobile_recharge',
                    mobileNumber,
                    operator,
                    state,
                    planDetails,
                    amount,
                    discount,
                    discountRate: RECHARGE_DISCOUNT_RATE,
                    chargeAmount,
                    status: 'pending',
                    requestedAt
                };

                await runTransaction(db, async (tx) => {
                    const userDoc = await tx.get(userRef);
                    if (!userDoc.exists()) throw new Error("User account not found!");

                    const currentBalance = userDoc.data().balance || 0;
                    if (getSpendableWalletBalance(userDoc.data()) < chargeAmount) throw new Error(getInsufficientRechargeMessage(userDoc.data(), chargeAmount));

                    const balanceAfter = currentBalance - chargeAmount;
                    requestPayload.balanceBefore = currentBalance;
                    requestPayload.balanceAfter = balanceAfter;
                    tx.update(userRef, { balance: balanceAfter });

                    const { id, ...firebaseRequestPayload } = requestPayload;
                    tx.set(reqRef, {
                        ...firebaseRequestPayload,
                        requestedAt: serverTimestamp()
                    });

                    tx.set(doc(collection(userRef, 'transactions')), {
                        type: 'mobile_recharge',
                        amount,
                        discount,
                        chargeAmount,
                        mobileNumber,
                        operator,
                        state,
                        planDetails,
                        comment: `Mobile Recharge (${operator})`,
                        timestamp: serverTimestamp(),
                        status: 'pending',
                        requestId: reqRef.id,
                        balanceBefore: currentBalance,
                        balanceAfter,
                        transactionId: generateTransactionId()
                    });
                });

                upsertCloudFundRequest(requestPayload).catch(error => {
                    console.warn('Recharge cloud request sync skipped:', error);
                });
                syncRecentTransactionsToCloud(currentUser.uid).catch(error => {
                    console.warn('Recharge cloud transaction sync skipped:', error);
                });
                showNotification('Recharge request submitted and wallet amount deducted!', false, true);
                window.closeModal();
                hidePage();
            } catch (e) {
                console.error("Recharge request failed:", e);
                const message = String(e?.message || '').trim();
                showNotification(message && !/permission|firebase|internal|network/i.test(message)
                    ? message
                    : 'Could not submit recharge request. Please try again.', true);
            }
        };

        const isValidLoanDob = (dob) => {
            const normalizedDob = normalizeLoanDob(dob);
            const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalizedDob);
            if (!match) return false;

            const day = Number(match[1]);
            const month = Number(match[2]);
            const year = Number(match[3]);
            const date = new Date(year, month - 1, day);

            return year >= 1900 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
        };

        const getLoanDocumentFileKind = (file) => {
            const type = String(file?.type || '').toLowerCase();
            const name = String(file?.name || '').toLowerCase();
            const isImage = type.startsWith('image/') || /\.(png|jpe?g|webp|heic|heif)$/i.test(name);
            const isPdf = type === 'application/pdf' || /\.pdf$/i.test(name);
            return { isImage, isPdf };
        };

        const validateLoanDocumentSelection = (file, documentType) => {
            const label = documentType === 'selfie' ? 'Selfie photo' : 'Aadhaar document';
            if (!file) return `${label} is required.`;
            const { isImage, isPdf } = getLoanDocumentFileKind(file);
            if (Number(file.size || 0) > LOAN_DOCUMENT_MAX_SIZE_BYTES && !isImage) {
                return `${label} is too large. Please upload a file under 8 MB.`;
            }
            if (documentType === 'selfie' && !isImage) {
                return 'Selfie photo must be an image file.';
            }
            if (documentType === 'aadhaar' && !isImage && !isPdf) {
                return 'Aadhaar document must be an image or PDF file.';
            }
            return '';
        };

        const compressLoanImageFile = async (file, documentType) => {
            const { isImage } = getLoanDocumentFileKind(file);
            const type = String(file?.type || '').toLowerCase();
            const name = String(file?.name || '').toLowerCase();
            const canDrawImage = /image\/(jpeg|jpg|png|webp)/i.test(type) || /\.(png|jpe?g|webp)$/i.test(name);
            if (!isImage || !canDrawImage || Number(file.size || 0) <= 700 * 1024) {
                return file;
            }
            return new Promise((resolve) => {
                const image = new Image();
                const objectUrl = URL.createObjectURL(file);
                image.onload = () => {
                    try {
                        const maxSide = documentType === 'selfie' ? 1080 : 1400;
                        const ratio = Math.min(1, maxSide / Math.max(image.width || maxSide, image.height || maxSide));
                        const width = Math.max(1, Math.round((image.width || maxSide) * ratio));
                        const height = Math.max(1, Math.round((image.height || maxSide) * ratio));
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(image, 0, 0, width, height);
                        canvas.toBlob((blob) => {
                            URL.revokeObjectURL(objectUrl);
                            if (!blob || blob.size >= file.size) return resolve(file);
                            const baseName = String(file.name || `${documentType}.jpg`).replace(/\.[^.]+$/, '');
                            resolve(new File([blob], `${baseName}-compressed.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
                        }, 'image/jpeg', 0.76);
                    } catch (error) {
                        URL.revokeObjectURL(objectUrl);
                        console.warn('Loan image compression skipped:', error);
                        resolve(file);
                    }
                };
                image.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(file);
                };
                image.src = objectUrl;
            });
        };

        const getLoanUploadErrorMessage = (error, label) => {
            const code = String(error?.code || '');
            if (code.includes('unauthorized')) return `${label} upload is blocked by storage permission. Please contact admin.`;
            if (code.includes('quota-exceeded')) return `${label} upload failed because storage quota is full. Please contact admin.`;
            if (code.includes('retry-limit-exceeded')) return `${label} upload failed because network is unstable. Please try again.`;
            if (code.includes('canceled')) return `${label} upload was cancelled. Please try again.`;
            return String(error?.message || `${label} upload failed. Please try again.`);
        };

        const uploadFileWithProgress = (ref, file, metadata, label, onProgress = () => {}) => new Promise((resolve, reject) => {
            const uploadTask = uploadBytesResumable(ref, file, metadata);
            uploadTask.on('state_changed', (snapshot) => {
                const total = Number(snapshot.totalBytes || 0);
                const transferred = Number(snapshot.bytesTransferred || 0);
                if (total > 0) {
                    onProgress(Math.max(1, Math.min(99, Math.round((transferred / total) * 100))));
                }
            }, (error) => {
                reject(new Error(getLoanUploadErrorMessage(error, label)));
            }, () => {
                onProgress(100);
                resolve(uploadTask.snapshot);
            });
        });

        const uploadLoanDocumentToCloudflare = (file, originalFile, documentType, label, onProgress = () => {}) => new Promise(async (resolve, reject) => {
            try {
                const token = await getBackendAuthToken();
                const params = new URLSearchParams({
                    documentType,
                    fileName: file.name || originalFile?.name || `${documentType}.jpg`,
                    contentType: file.type || originalFile?.type || 'application/octet-stream',
                    size: String(file.size || originalFile?.size || 0)
                });
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${BACKEND_BASE_URL}/api/uploads/loan-document?${params.toString()}`, true);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.setRequestHeader('Content-Type', file.type || originalFile?.type || 'application/octet-stream');
                xhr.timeout = LOAN_DOCUMENT_UPLOAD_TIMEOUT_MS;
                xhr.upload.onprogress = (event) => {
                    if (!event.lengthComputable) return;
                    onProgress(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))));
                };
                xhr.onload = () => {
                    const payload = (() => {
                        try {
                            return JSON.parse(xhr.responseText || '{}');
                        } catch {
                            return {};
                        }
                    })();
                    if (xhr.status >= 200 && xhr.status < 300 && payload?.ok && payload?.document?.url) {
                        onProgress(100);
                        resolve({
                            name: originalFile?.name || payload.document.name || file.name || `${documentType}.jpg`,
                            size: payload.document.size || file.size || originalFile?.size || 0,
                            type: payload.document.type || file.type || originalFile?.type || '',
                            path: payload.document.path || payload.document.key || '',
                            key: payload.document.key || payload.document.path || '',
                            url: payload.document.url,
                            storage: payload.document.storage || 'cloudflare-r2',
                            uploadedAt: payload.document.uploadedAt || Date.now()
                        });
                        return;
                    }
                    const errorCode = payload?.error || xhr.statusText || 'CLOUDFLARE_UPLOAD_FAILED';
                    const error = new Error(`${label} Cloudflare upload failed: ${errorCode}`);
                    error.code = errorCode;
                    error.canUseFirebaseFallback = xhr.status >= 500 || xhr.status === 401 || xhr.status === 403 || [
                        'R2_NOT_CONFIGURED',
                        'R2_PUBLIC_URL_NOT_CONFIGURED',
                        'LOAN_DOCUMENT_UPLOAD_FAILED',
                        'BACKEND_TEMPORARILY_UNAVAILABLE'
                    ].includes(errorCode);
                    reject(error);
                };
                xhr.onerror = () => {
                    const error = new Error(`${label} Cloudflare upload failed because backend was unreachable.`);
                    error.canUseFirebaseFallback = true;
                    reject(error);
                };
                xhr.ontimeout = () => {
                    const error = new Error(`${label} Cloudflare upload is taking too long.`);
                    error.canUseFirebaseFallback = true;
                    reject(error);
                };
                onProgress(1);
                xhr.send(file);
            } catch (error) {
                const uploadError = error instanceof Error ? error : new Error(String(error || `${label} Cloudflare upload failed.`));
                uploadError.canUseFirebaseFallback = true;
                reject(uploadError);
            }
        });

        const uploadLoanDocumentToFirebase = async (file, originalFile, documentType, label, onProgress = () => {}) => {
            const safeName = String(file.name || `${documentType}.jpg`).replace(/[^\w.-]+/g, '_').slice(-80);
            const path = `artifacts/${appId}/loan_documents/${currentUser.uid}/${Date.now()}-${documentType}-${safeName}`;
            const ref = storageRef(storage, path);
            onProgress(1);
            await withTimeout(
                uploadFileWithProgress(ref, file, {
                    contentType: file.type || 'application/octet-stream',
                    customMetadata: {
                        userId: currentUser.uid,
                        documentType
                    }
                }, label, onProgress),
                LOAN_DOCUMENT_UPLOAD_TIMEOUT_MS,
                `${label} upload is taking too long. Please check internet or use a smaller file.`
            );
            const url = await withTimeout(
                getDownloadURL(ref),
                10000,
                `${label} uploaded but link was not ready. Please try again.`
            );
            return {
                name: originalFile?.name || safeName,
                size: file.size || originalFile?.size || 0,
                type: file.type || originalFile?.type || '',
                path,
                url,
                storage: 'firebase-storage',
                uploadedAt: Date.now()
            };
        };

        const uploadLoanDocumentFile = async (file, documentType, onProgress = () => {}) => {
            if (!file) return null;
            const validationError = validateLoanDocumentSelection(file, documentType);
            if (validationError) throw new Error(validationError);
            const label = documentType === 'selfie' ? 'Selfie photo' : 'Aadhaar document';
            const preparedFile = await withTimeout(
                compressLoanImageFile(file, documentType),
                10000,
                `${label} could not be prepared. Please try a smaller file.`
            );
            if (Number(preparedFile.size || 0) > LOAN_DOCUMENT_MAX_SIZE_BYTES) {
                throw new Error(`${label} is too large. Please upload a file under 8 MB.`);
            }
            try {
                return await uploadLoanDocumentToCloudflare(preparedFile, file, documentType, label, onProgress);
            } catch (cloudflareError) {
                console.warn('Cloudflare loan document upload failed, using Firebase Storage fallback:', cloudflareError);
                if (cloudflareError?.canUseFirebaseFallback === false) {
                    throw new Error(getLoanUploadErrorMessage(cloudflareError, label));
                }
                return uploadLoanDocumentToFirebase(preparedFile, file, documentType, label, onProgress);
            }
        };

        const handleSubmitLoanRequest = async () => {
            const btn = document.getElementById('submit-loan-request-btn');
            const { name, fatherName, mobile, alternateMobile, dob, aadhaar } = loanApplicationDraft.personal || {};
            const documents = loanApplicationDraft.documents || {};

            if (!name || !fatherName || !/^\d{10}$/.test(mobile) || !/^\d{10}$/.test(alternateMobile) || !isValidLoanDob(dob) || !/^\d{12}$/.test(aadhaar)) {
                return showNotification('Please fill all loan details correctly.', true);
            }
            const documentError = validateLoanDocumentSelection(documents.aadhaarFile, 'aadhaar') || validateLoanDocumentSelection(documents.selfieFile, 'selfie');
            if (documentError) {
                return showNotification(documentError, true);
            }

            try {
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Checking...';
                }
                const existingRequestSnap = await withTimeout(
                    getDocs(query(
                        collection(db, `artifacts/${appId}/public/data/loan_requests`),
                        where("userId", "==", currentUser.uid)
                    )),
                    15000,
                    'Could not check your loan request status. Please try again.'
                );
                const existingModernRequests = existingRequestSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(isModernLoanRequest)
                    .sort((a, b) => timestampToMillis(b.requestedAt || b.processedAt) - timestampToMillis(a.requestedAt || a.processedAt));
                const pendingModernRequest = existingModernRequests.find(isPendingModernLoanRequest);
                const userLoanMarker = getUserLoanRequestMarker(currentUserData);
                if (pendingModernRequest || isPendingModernLoanRequest(userLoanMarker)) {
                    showLoanPendingPage();
                    return;
                }
                const latestModernRequest = getLatestModernLoanRequest(currentUser.uid, existingModernRequests);
                const reapplyBlock = getLoanReapplyBlock(latestModernRequest) || getLoanReapplyBlock(userLoanMarker);
                if (reapplyBlock) {
                    showLoanRejectedCooldownPage(latestModernRequest || userLoanMarker);
                    return;
                }
                if (btn) btn.textContent = 'Preparing...';
                const aadhaarDocument = await uploadLoanDocumentFile(documents.aadhaarFile, 'aadhaar', (percent) => {
                    if (btn) btn.textContent = `Aadhaar ${percent}%`;
                });
                const selfieDocument = await uploadLoanDocumentFile(documents.selfieFile, 'selfie', (percent) => {
                    if (btn) btn.textContent = `Selfie ${percent}%`;
                });
                if (btn) btn.textContent = 'Submitting...';
                await withTimeout(addDoc(collection(db, `artifacts/${appId}/public/data/loan_requests`), {
                    requestVersion: LOAN_APPLICATION_VERSION,
                    loanApplicationVersion: LOAN_APPLICATION_VERSION,
                    userId: currentUser.uid,
                    userEmail: currentUserData.email || currentUser.email || '',
                    name,
                    fatherName,
                    mobile,
                    alternateMobile,
                    dob,
                    aadhaar,
                    personalDetails: { name, fatherName, mobile, alternateMobile, dob, aadhaar },
                    documents: {
                        aadhaar: aadhaarDocument,
                        selfie: selfieDocument,
                        aadhaarSelfieMatchStatus: 'pending_admin_review'
                    },
                    loanDocumentsSubmitted: true,
                    status: 'pending',
                    requestedAt: serverTimestamp()
                }), 15000, 'Could not save loan request. Please try again.');
                await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid), {
                    latestLoanRequestVersion: LOAN_APPLICATION_VERSION,
                    loanRequestStatus: 'pending',
                    loanRequestedAt: serverTimestamp(),
                    loanDocumentsSubmitted: true
                }).catch(error => console.warn('Loan request user marker skipped:', error));

                renderModal('Loan Request Submitted',
                    `<div class="text-center space-y-3">
                        <div class="w-14 h-14 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 mx-auto flex items-center justify-center">
                            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"></path></svg>
                        </div>
                        <h3 class="font-semibold">Loan Request Pending</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Your account details and documents have been sent to admin. You will continue after approval.</p>
                    </div>`,
                    `<button onclick="window.closeModal(); hidePage();" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg">OK</button>`,
                    'max-w-sm', true
                );
            } catch (e) {
                console.error('Loan request failed:', e);
                const message = String(e?.message || '').trim();
                showNotification(message || 'Could not submit loan request. Please try again.', true);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Apply Now';
                }
            }
        };

        const handleTakeLoan = async () => {
            if (!currentUser || !currentUserData) return showNotification('User data not loaded. Please wait and try again.', true);
            const takeLoanBtn = document.getElementById('confirm-take-loan-btn');
            if (takeLoanBtn?.disabled) return;
            const amount = parseFloat(document.getElementById('loan-amount-input').value);
            const maxLoanAmount = Math.max(1, getLoanLimitAmount(currentUserData));
            if (isNaN(amount) || amount < 1 || amount > maxLoanAmount) {
                return showNotification(`Loan amount must be between ₹1 and ${formatCurrency(maxLoanAmount)}.`, true);
            }
            if (!document.getElementById('loan-agreement-checkbox')?.checked) {
                return showNotification('Please accept the loan agreement and security terms.', true);
            }
            const interest = Number((amount * 0.02).toFixed(2));
            const totalRepayable = Number((amount + interest).toFixed(2));
            const dueDate = getNextMonthRepaymentDate();

            try {
                if (takeLoanBtn) {
                    takeLoanBtn.disabled = true;
                    takeLoanBtn.textContent = 'Processing...';
                }
                const hasDocumentedApprovalFlag = currentUserData.loanDocumentsVerified === true || currentUserData.loanDocumentsApproved === true;
                const documentedApprovalSnap = hasDocumentedApprovalFlag ? null : await withTimeout(
                    getDocs(query(
                        collection(db, `artifacts/${appId}/public/data/loan_requests`),
                        where("userId", "==", currentUser.uid)
                    )),
                    12000,
                    'Could not verify your updated loan documents. Please try again.'
                );
                const hasDocumentedApprovalRequest = documentedApprovalSnap
                    ? documentedApprovalSnap.docs.map(docItem => ({ id: docItem.id, ...docItem.data() })).some(isApprovedModernLoanRequest)
                    : true;
                if (!hasDocumentedApprovalRequest) {
                    throw new Error('Please submit Aadhaar and selfie details again, then wait for admin approval.');
                }
                const activeLoanSnap = await getDocs(query(
                    collection(db, `artifacts/${appId}/public/data/loans`),
                    where("userId", "==", currentUser.uid),
                    where("status", "==", "active")
                ));
                const activeModernLoan = activeLoanSnap.docs
                    .map(docItem => ({ id: docItem.id, ...docItem.data() }))
                    .find(isModernLoanRecord);
                if (activeModernLoan) {
                    const activeLoan = activeModernLoan;
                    showActiveLoanPage(activeLoan);
                    throw new Error('You already have an active loan. Repay it before taking another loan.');
                }
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                await runTransaction(db, async (tx) => {
                    const userDoc = await tx.get(userRef);
                    if (!userDoc.exists()) throw new Error('User not found.');
                    const userData = userDoc.data();
                    const existingActiveLoanId = String(userData.activeLoanId || '').trim();
                    const existingRepayable = Number(userData.activeLoanRepayable || userData.loanLockedAmount || 0);
                    const hasModernActiveLoanMarker = Number(userData.activeLoanVersion || 0) >= LOAN_APPLICATION_VERSION;
                    if ((existingActiveLoanId || existingRepayable > 0) && hasModernActiveLoanMarker) {
                        throw new Error('You already have an active loan. Repay it before taking another loan.');
                    }
                    if (!hasModernLoanApproval(userData)) throw new Error('Please submit updated loan details and wait for admin approval.');
                    if (!userData.loanEligible && getLoanLimitAmount(userData) <= 0) throw new Error('Loan is not approved for your account.');
                    const approvedMaxLoan = Math.max(0, getLoanLimitAmount(userData));
                    if (approvedMaxLoan < 1) throw new Error('Loan limit is not approved for your account.');
                    if (amount > approvedMaxLoan) throw new Error(`Loan amount cannot exceed ${formatCurrency(approvedMaxLoan)}.`);

                    const loanRef = doc(collection(db, `artifacts/${appId}/public/data/loans`));
                    tx.update(userRef, {
                        balance: (userData.balance || 0) + amount,
                        loanEligible: true,
                        activeLoanId: loanRef.id,
                        activeLoanVersion: LOAN_APPLICATION_VERSION,
                        activeLoanAmount: amount,
                        activeLoanInterest: interest,
                        activeLoanRepayable: totalRepayable,
                        activeLoanDueDate: Timestamp.fromDate(dueDate),
                        activeLoanCreatedAt: serverTimestamp(),
                        loanLockedAmount: 0,
                        loanReserveStartsAt: Timestamp.fromDate(dueDate)
                    });
                    tx.set(loanRef, {
                        loanApplicationVersion: LOAN_APPLICATION_VERSION,
                        loanRequestVersion: LOAN_APPLICATION_VERSION,
                        userId: currentUser.uid,
                        userName: currentUserData.name || 'User',
                        userMobile: currentUserData.mobile || '',
                        amount,
                        interest,
                        totalRepayable,
                        lockedAmount: 0,
                        reserveStartsAt: Timestamp.fromDate(dueDate),
                        creditLimitAtBorrow: approvedMaxLoan,
                        dueDate: Timestamp.fromDate(dueDate),
                        status: 'active',
                        createdAt: serverTimestamp()
                    });
                    tx.set(doc(collection(userRef, 'transactions')), {
                        type: 'credit',
                        amount,
                        comment: 'Loan Amount Credited',
                        timestamp: serverTimestamp(),
                        transactionId: loanRef.id,
                        status: 'completed',
                        isAdminTransaction: true,
                        senderName: 'Reviews World',
                        recipientName: currentUserData.name || 'User',
                        recipientMobile: currentUserData.mobile || ''
                    });
                });
                await syncRecentTransactionsToCloud(currentUser.uid);
                showNotification('Loan amount added to wallet.');
                hidePage();
            } catch (e) {
                console.error('Take loan failed:', e);
                const message = /permission|insufficient/i.test(e.message || '')
                    ? 'Loan credit could not be completed for this account. Please contact admin to refresh your loan approval.'
                    : (e.message || 'Could not take loan. Please try again.');
                showNotification(message, true);
                if (takeLoanBtn) {
                    takeLoanBtn.disabled = false;
                    takeLoanBtn.textContent = 'Take Loan';
                }
            }
        };

        const handleRepayLoan = async (loan) => {
            if ((currentUserData.balance || 0) < (loan.totalRepayable || 0)) {
                return showNotification('Insufficient balance to repay full loan.', true);
            }
            try {
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                const loanRef = doc(db, `artifacts/${appId}/public/data/loans`, loan.id);
                await runTransaction(db, async (tx) => {
                    const userDoc = await tx.get(userRef);
                    const loanDoc = await tx.get(loanRef);
                    if (!loanDoc.exists() || loanDoc.data().status !== 'active') throw new Error('Loan is already closed.');
                    tx.update(userRef, {
                        balance: (userDoc.data().balance || 0) - loan.totalRepayable,
                        activeLoanId: deleteField(),
                        activeLoanVersion: deleteField(),
                        activeLoanAmount: deleteField(),
                        activeLoanInterest: deleteField(),
                        activeLoanRepayable: deleteField(),
                        activeLoanDueDate: deleteField(),
                        activeLoanCreatedAt: deleteField(),
                        loanLockedAmount: deleteField()
                    });
                    tx.update(loanRef, {
                        status: 'paid',
                        paidAt: serverTimestamp()
                    });
                    tx.set(doc(collection(userRef, 'transactions')), {
                        type: 'debit',
                        amount: loan.totalRepayable,
                        comment: 'Loan Repayment',
                        timestamp: serverTimestamp(),
                        transactionId: `REPAY-${loan.id}`,
                        status: 'completed',
                        recipientName: 'Reviews World',
                        recipientMobile: ''
                    });
                });
                await syncRecentTransactionsToCloud(currentUser.uid);
                showNotification('Loan repaid successfully.');
                hidePage();
            } catch (e) {
                console.error('Repay loan failed:', e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

        const handleCreatePartnerInvestment = async () => {
            const { amount, months, startDate, endDate, monthlyInterest, totalInterest } = getPartnerInvestmentSummary();
            if (amount <= 0 || months <= 0 || months > 60 || !endDate) {
                return showNotification('Enter valid amount and months.', true);
            }
            if (amount < PARTNER_MIN_INVESTMENT) {
                return showNotification(`Minimum partner investment is ${formatCurrency(PARTNER_MIN_INVESTMENT)}.`, true);
            }
            if (!document.getElementById('partner-terms-checkbox').checked) {
                return showNotification('Please accept partner terms and conditions.', true);
            }
            if (getSpendableWalletBalance(currentUserData) < amount) {
                return showNotification(getInsufficientWalletMessage(currentUserData), true);
            }

            try {
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                const investmentRef = doc(collection(db, `artifacts/${appId}/public/data/partner_investments`));
                const invoiceId = `INV-${investmentRef.id.slice(0, 8).toUpperCase()}`;

                await runTransaction(db, async (tx) => {
                    const userDoc = await tx.get(userRef);
                    if (!userDoc.exists()) throw new Error('User account not found.');
                    const balance = userDoc.data().balance || 0;
                    if (amount < PARTNER_MIN_INVESTMENT) throw new Error(`Minimum partner investment is ${formatCurrency(PARTNER_MIN_INVESTMENT)}.`);
                    if (getSpendableWalletBalance(userDoc.data()) < amount) throw new Error(getInsufficientWalletMessage(userDoc.data()));

                    tx.update(userRef, { balance: balance - amount });
                    tx.set(investmentRef, {
                        userId: currentUser.uid,
                        userName: currentUserData.name || 'User',
                        userEmail: currentUserData.email || currentUser.email || '',
                        userMobile: currentUserData.mobile || '',
                        amount,
                        months,
                        interestRate: PARTNER_INTEREST_RATE,
                        monthlyInterest,
                        totalInterest,
                        paidInterest: 0,
                        monthsPaid: 0,
                        startDate: Timestamp.fromDate(startDate),
                        endDate: Timestamp.fromDate(endDate),
                        nextPayoutAt: Timestamp.fromDate(addDays(startDate, 30)),
                        status: 'active',
                        invoiceId,
                        createdAt: serverTimestamp()
                    });
                    tx.set(doc(collection(userRef, 'transactions')), {
                        type: 'debit',
                        amount,
                        comment: 'Partner Investment Started',
                        timestamp: serverTimestamp(),
                        transactionId: investmentRef.id,
                        status: 'completed',
                        recipientName: 'Reviews World Partner Plan',
                        recipientMobile: ''
                    });
                });

                const invoiceData = {
                    id: investmentRef.id,
                    invoiceId,
                    userName: currentUserData.name || 'User',
                    userEmail: currentUserData.email || currentUser.email || '',
                    userMobile: currentUserData.mobile || '',
                    amount,
                    months,
                    interestRate: PARTNER_INTEREST_RATE,
                    monthlyInterest,
                    totalInterest,
                    paidInterest: 0,
                    startDate,
                    endDate,
                    status: 'active',
                    createdAt: new Date()
                };
                await syncRecentTransactionsToCloud(currentUser.uid);
                renderModal('Investment Created',
                    `<div class="text-center space-y-3">
                        <div class="w-16 h-16 rounded-full bg-emerald-100 mx-auto p-3"><img src="${PARTNER_ICON_URL}" class="w-full h-full object-contain" alt="Partner"></div>
                        <h3 class="font-bold text-lg">Investment successful</h3>
                        <p class="text-sm text-gray-500">Your invoice is ready. Interest starts after 30 days.</p>
                    </div>`,
                    `<button onclick="window.closeModal(); showPartnerPage();" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Close</button>
                     <button id="download-new-investment-invoice-btn" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg">Download PDF Invoice</button>`,
                    'max-w-sm'
                );
                document.getElementById('download-new-investment-invoice-btn').onclick = () => downloadInvestmentInvoice(invoiceData);
            } catch (e) {
                console.error('Partner investment failed:', e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

        const processDuePartnerInvestmentsForUser = async (userId) => {
            const snap = await getDocs(query(
                collection(db, `artifacts/${appId}/public/data/partner_investments`),
                where("userId", "==", userId),
                where("status", "==", "active")
            ));
            for (const d of snap.docs) {
                const inv = { id: d.id, ...d.data() };
                if (toDate(inv.nextPayoutAt) && toDate(inv.nextPayoutAt) <= new Date()) {
                    await processPartnerInterest(inv.id);
                }
            }
        };

        const processDueLoansForUser = async (userId) => {
            const snap = await getDocs(query(
                collection(db, `artifacts/${appId}/public/data/loans`),
                where("userId", "==", userId),
                where("status", "==", "active")
            ));
            for (const d of snap.docs) {
                const loan = { id: d.id, ...d.data() };
                if (!isModernLoanRecord(loan)) continue;
                if (toDate(loan.dueDate) && toDate(loan.dueDate) <= new Date()) {
                    try {
                        await processDueLoanRepayment(loan.id);
                    } catch (e) {
                        console.error('Due loan auto debit skipped:', e);
                    }
                }
            }
        };

        const processPartnerInterest = async (investmentId) => {
            const investmentRef = doc(db, `artifacts/${appId}/public/data/partner_investments`, investmentId);
            await runTransaction(db, async (tx) => {
                const invDoc = await tx.get(investmentRef);
                if (!invDoc.exists()) throw new Error('Investment not found.');
                const inv = invDoc.data();
                if (inv.status !== 'active') throw new Error('Investment is not active.');
                const nextPayout = toDate(inv.nextPayoutAt);
                if (!nextPayout || nextPayout > new Date()) throw new Error('30 days are not completed yet.');

                const userRef = doc(db, `artifacts/${appId}/public/data/users`, inv.userId);
                const userDoc = await tx.get(userRef);
                if (!userDoc.exists()) throw new Error('User not found.');

                const monthsPaid = inv.monthsPaid || 0;
                const nextMonthsPaid = monthsPaid + 1;
                const monthlyInterest = inv.monthlyInterest || Number(((inv.amount || 0) * (inv.interestRate || PARTNER_INTEREST_RATE)).toFixed(2));
                const isFinal = nextMonthsPaid >= (inv.months || 1);
                const creditAmount = isFinal ? Number((monthlyInterest + (inv.amount || 0)).toFixed(2)) : monthlyInterest;

                tx.update(userRef, { balance: (userDoc.data().balance || 0) + creditAmount });
                tx.update(investmentRef, {
                    paidInterest: Number(((inv.paidInterest || 0) + monthlyInterest).toFixed(2)),
                    monthsPaid: nextMonthsPaid,
                    nextPayoutAt: isFinal ? deleteField() : Timestamp.fromDate(addDays(nextPayout, 30)),
                    status: isFinal ? 'completed' : 'active',
                    completedAt: isFinal ? serverTimestamp() : (inv.completedAt || null)
                });
                tx.set(doc(collection(userRef, 'transactions')), {
                    type: 'credit',
                    amount: creditAmount,
                    comment: isFinal ? 'Partner Investment Maturity' : 'Partner Investment Interest',
                    timestamp: serverTimestamp(),
                    transactionId: `PARTNER-${investmentId}-${nextMonthsPaid}`,
                    status: 'completed',
                    isAdminTransaction: true,
                    senderName: 'Reviews World',
                    recipientName: inv.userName || 'User',
                    recipientMobile: inv.userMobile || ''
                });
            });
        };

        const processDueLoanRepayment = async (loanId) => {
            const loanRef = doc(db, `artifacts/${appId}/public/data/loans`, loanId);
            let accountLockedForInsufficientBalance = false;
            await runTransaction(db, async (tx) => {
                const loanDoc = await tx.get(loanRef);
                if (!loanDoc.exists()) throw new Error('Loan not found.');
                const loan = loanDoc.data();
                if (!isModernLoanRecord(loan)) throw new Error('Legacy loan record is not processed by the new loan system.');
                if (loan.status !== 'active') throw new Error('Loan is already closed.');
                const dueDate = toDate(loan.dueDate);
                if (!dueDate || dueDate > new Date()) throw new Error('Loan due date is not completed yet.');

                const userRef = doc(db, `artifacts/${appId}/public/data/users`, loan.userId);
                const userDoc = await tx.get(userRef);
                if (!userDoc.exists()) throw new Error('User not found.');
                const balance = userDoc.data().balance || 0;
                if (balance < (loan.totalRepayable || 0)) {
                    accountLockedForInsufficientBalance = true;
                    const reason = `You have not paid due loan amount of ${formatCurrency(loan.totalRepayable || 0)}. Please contact admin to unlock your account.`;
                    tx.update(userRef, {
                        isFlagged: true,
                        isDisabled: true,
                        dueLoanBlocked: true,
                        dueLoanId: loanId,
                        dueLoanReason: reason,
                        banReason: reason,
                        banExpiry: null,
                        disabledAt: serverTimestamp(),
                        disabledBy: 'loan-auto-debit'
                    });
                    tx.update(loanRef, {
                        overdueAt: serverTimestamp(),
                        overdueReason: 'Insufficient wallet balance for automatic loan debit.'
                    });
                    return;
                }

                tx.update(userRef, {
                    balance: balance - (loan.totalRepayable || 0),
                    activeLoanId: deleteField(),
                    activeLoanVersion: deleteField(),
                    activeLoanAmount: deleteField(),
                    activeLoanInterest: deleteField(),
                    activeLoanRepayable: deleteField(),
                    activeLoanDueDate: deleteField(),
                    activeLoanCreatedAt: deleteField(),
                    loanLockedAmount: deleteField()
                });
                tx.update(loanRef, {
                    status: 'paid',
                    paidAt: serverTimestamp(),
                    autoDebited: true
                });
                tx.set(doc(collection(userRef, 'transactions')), {
                    type: 'debit',
                    amount: loan.totalRepayable || 0,
                    comment: 'Loan Auto Debit',
                    timestamp: serverTimestamp(),
                    transactionId: `AUTO-REPAY-${loanId}`,
                    status: 'completed',
                    recipientName: 'Reviews World',
                    recipientMobile: ''
                });
            });
            if (accountLockedForInsufficientBalance) {
                throw new Error('User has insufficient balance for automatic loan debit. Account locked.');
            }
        };

        const escapePdfText = (text = '') => String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
        const formatPdfCurrency = (amount = 0) => `Rs. ${Number(amount || 0).toFixed(2)}`;

        const createSimplePdf = (lines) => {
            const objects = [];
            const addObject = (body) => {
                objects.push(body);
                return objects.length;
            };
            addObject('<< /Type /Catalog /Pages 2 0 R >>');
            addObject('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
            addObject('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>');
            addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
            addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

            const content = [
                'BT',
                '/F2 20 Tf',
                '50 790 Td',
                `(${escapePdfText(lines.title)}) Tj`,
                '/F1 10 Tf',
                '0 -24 Td',
                ...lines.body.map(line => `(${escapePdfText(line)}) Tj 0 -18 Td`),
                'ET'
            ].join('\n');
            addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

            let pdf = '%PDF-1.4\n';
            const offsets = [0];
            objects.forEach((obj, index) => {
                offsets.push(pdf.length);
                pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
            });
            const xref = pdf.length;
            pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
            offsets.slice(1).forEach(offset => {
                pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
            });
            pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
            return new Blob([pdf], { type: 'application/pdf' });
        };

        const createPartnerInvestmentInvoicePdf = (investment) => {
            const start = toDate(investment.startDate) || toDate(investment.createdAt) || new Date();
            const end = toDate(investment.endDate) || addMonthsClamped(start, investment.months || 1);
            const invoiceId = investment.invoiceId || `INV-${(investment.id || generateTransactionId()).slice(0, 8).toUpperCase()}`;
            const amount = Number(investment.amount || 0);
            const monthlyInterest = Number(investment.monthlyInterest || (amount * (investment.interestRate || PARTNER_INTEREST_RATE)) || 0);
            const totalInterest = Number(investment.totalInterest || (monthlyInterest * (investment.months || 0)) || 0);
            const paidInterest = Number(investment.paidInterest || 0);
            const maturityValue = amount + totalInterest;
            const status = String(investment.status || 'active').toUpperCase();
            const statusColor = status === 'COMPLETED' ? '0.05 0.55 0.32' : status === 'CANCELLED' ? '0.78 0.12 0.12' : '0.03 0.35 0.85';
            const userName = investment.userName || currentUserData?.name || 'User';
            const userMobile = investment.userMobile || currentUserData?.mobile || 'N/A';
            const userEmail = investment.userEmail || currentUserData?.email || currentUser?.email || 'N/A';

            const commands = [];
            const text = (value, x, y, size = 10, font = 'F1', color = '0 0 0') => {
                commands.push('BT', `/${font} ${size} Tf`, `${color} rg`, `${x} ${y} Td`, `(${escapePdfText(value)}) Tj`, 'ET');
            };
            const fillRect = (x, y, w, h, color) => commands.push('q', `${color} rg`, `${x} ${y} ${w} ${h} re f`, 'Q');
            const strokeRect = (x, y, w, h, color = '0.84 0.88 0.94') => commands.push('q', `${color} RG`, `${x} ${y} ${w} ${h} re S`, 'Q');
            const line = (x1, y1, x2, y2, color = '0.84 0.88 0.94') => commands.push('q', `${color} RG`, `${x1} ${y1} m ${x2} ${y2} l S`, 'Q');
            const labelValue = (label, value, x, y, w, accent = '0.02 0.45 0.36') => {
                fillRect(x, y, w, 58, '1 1 1');
                fillRect(x, y, 5, 58, accent);
                strokeRect(x, y, w, 58, '0.88 0.91 0.96');
                text(label, x + 16, y + 36, 8, 'F2', '0.42 0.49 0.6');
                text(truncatePdfText(value, 28), x + 16, y + 17, 14, 'F2', '0.06 0.1 0.18');
            };

            fillRect(0, 0, 595, 842, '0.95 0.98 1');
            fillRect(34, 708, 527, 96, '0.02 0.08 0.18');
            fillRect(34, 708, 527, 14, '0.02 0.62 0.45');
            fillRect(402, 742, 128, 28, '0.07 0.18 0.35');
            fillRect(46, 654, 503, 34, '0.9 0.98 0.95');
            text('REVIEWS WORLD', 54, 766, 22, 'F2', '1 1 1');
            text('PARTNER INVESTMENT INVOICE', 54, 741, 13, 'F2', '0.74 0.92 1');
            text(`Invoice ID: ${invoiceId}`, 410, 753, 9, 'F2', '1 1 1');
            text(`Generated: ${new Date().toLocaleString('en-IN')}`, 54, 720, 8, 'F1', '0.78 0.84 0.93');
            text(`Status: ${status}`, 410, 720, 9, 'F2', '0.55 0.95 0.78');
            text('Partner investment receipt for RW Wallet records', 62, 668, 10, 'F2', '0.02 0.45 0.36');

            labelValue('Billed To', truncatePdfText(userName, 34), 46, 574, 244, '0.02 0.45 0.36');
            text(truncatePdfText(userEmail, 40), 62, 582, 8, 'F1', '0.35 0.42 0.52');
            labelValue('Mobile Number', userMobile, 305, 574, 244, '0.03 0.35 0.85');
            text(`Duration: ${investment.months || 0} month(s)`, 321, 582, 8, 'F1', '0.35 0.42 0.52');

            labelValue('Investment Amount', formatPdfCurrency(amount), 46, 496, 156, '0.02 0.62 0.45');
            labelValue('Monthly Interest', formatPdfCurrency(monthlyInterest), 220, 496, 156, '0.03 0.35 0.85');
            labelValue('Maturity Value', formatPdfCurrency(maturityValue), 393, 496, 156, '0.92 0.5 0.08');

            fillRect(46, 416, 503, 38, '0.02 0.08 0.18');
            text('Field', 62, 431, 9, 'F2', '1 1 1');
            text('Details', 216, 431, 9, 'F2', '1 1 1');
            text('Amount / Value', 410, 431, 9, 'F2', '1 1 1');
            const rows = [
                ['Start Date', start.toLocaleDateString('en-IN'), '-'],
                ['End Date', end.toLocaleDateString('en-IN'), '-'],
                ['Interest Rate', `${((investment.interestRate || PARTNER_INTEREST_RATE) * 100).toFixed(1)}% per month`, '-'],
                ['Total Expected Interest', `${investment.months || 0} month period`, formatPdfCurrency(totalInterest)],
                ['Interest Got', 'Already processed', formatPdfCurrency(paidInterest)],
                ['Current Status', status, formatPdfCurrency(maturityValue)]
            ];
            let y = 382;
            rows.forEach((row, index) => {
                fillRect(46, y - 10, 503, 34, index % 2 === 0 ? '1 1 1' : '0.98 0.99 1');
                line(46, y - 11, 549, y - 11);
                text(row[0], 62, y + 2, 8, 'F2', '0.12 0.18 0.3');
                text(truncatePdfText(row[1], 32), 216, y + 2, 8, 'F1', row[0] === 'Current Status' ? statusColor : '0.22 0.28 0.38');
                text(truncatePdfText(row[2], 20), 410, y + 2, 8, 'F2', row[0] === 'Current Status' ? statusColor : '0.02 0.45 0.36');
                y -= 34;
            });

            fillRect(46, 126, 503, 88, '1 1 1');
            strokeRect(46, 126, 503, 88);
            fillRect(46, 196, 503, 18, '0.9 0.95 1');
            text('Important Terms', 62, 201, 9, 'F2', '0.08 0.18 0.32');
            text('1. Interest is processed after every completed 30 days.', 62, 176, 8, 'F1', '0.25 0.32 0.42');
            text('2. Early withdrawal before end date gives no pending interest and 2% charge is deducted.', 62, 158, 8, 'F1', '0.25 0.32 0.42');
            text('3. User confirmed this investment after reading all documents and terms.', 62, 140, 8, 'F1', '0.25 0.32 0.42');

            fillRect(34, 54, 527, 44, '0.02 0.08 0.18');
            text('This invoice is computer generated by RW Wallet.', 54, 80, 8, 'F1', '0.78 0.84 0.93');
            text('REVIEWS WORLD | Partner Investment Records', 54, 65, 9, 'F2', '1 1 1');
            text(`Invoice: ${invoiceId}`, 410, 65, 8, 'F1', '0.78 0.84 0.93');

            const objects = [];
            const addObject = (body) => {
                objects.push(body);
                return objects.length;
            };
            addObject('<< /Type /Catalog /Pages 2 0 R >>');
            addObject('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
            addObject('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>');
            addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
            addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
            const content = commands.join('\n');
            addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
            let pdf = '%PDF-1.4\n';
            const offsets = [0];
            objects.forEach((obj, index) => {
                offsets.push(pdf.length);
                pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
            });
            const xref = pdf.length;
            pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
            offsets.slice(1).forEach(offset => {
                pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
            });
            pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
            return { blob: new Blob([pdf], { type: 'application/pdf' }), invoiceId };
        };

        const downloadInvestmentInvoice = (investment) => {
            const { blob, invoiceId } = createPartnerInvestmentInvoicePdf(investment);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${invoiceId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        };

        let handleWithdrawRequest = async (amount, method, methodName) => {
            if (!currentUser) return showNotification('Error: You are not logged in.', true);
            if (!currentUserData) {
                return showNotification('Your user data is still loading. Please try again.', true);
            }

            const pendingWithdrawalCount = (await loadUserPendingWithdrawalsMerged(currentUser.uid)).length;
            if (pendingWithdrawalCount >= maxPendingWithdrawalsPerUser) {
                return showNotification(`You already have ${pendingWithdrawalCount} pending withdrawal request(s). Please wait for them to be processed.`, true);
            }

            let paymentDetails = '';
            let methodSpecificDetails = {};

            switch (method) {
                case 'upi':
                    paymentDetails = getProfilePaymentDetails(method).upiId || 'Not set';
                    methodSpecificDetails = { upiId: paymentDetails };
                    if (amount < minWithdrawalUpi) return showNotification(`Minimum withdrawal for UPI is ₹${minWithdrawalUpi}`, true);
                    break;
                case 'bank':
                    const bankData = getProfilePaymentDetails(method);
                    // If bank details are missing in current profile, try to fetch from user data
                    const accountNumber = bankData.accountNumber || currentUserData.accountNumber || 'N/A';
                    const ifsc = bankData.ifsc || currentUserData.ifsc || 'N/A';
                    const bankName = bankData.bankName || currentUserData.bankName || 'N/A';
                    const accountName = bankData.accountName || currentUserData.accountName || 'N/A';

                    paymentDetails = `A/C: ${accountNumber}, IFSC: ${ifsc}, Name: ${accountName}`;
                    methodSpecificDetails = {
                        accountNumber: accountNumber,
                        ifsc: ifsc,
                        bankName: bankName,
                        accountName: accountName
                    };
                    if (amount < minWithdrawalBank) return showNotification(`Minimum withdrawal for Bank is ₹${minWithdrawalBank}`, true);
                    break;
                default:
                    paymentDetails = getProfilePaymentDetails(method).email || 'Not set';
                    methodSpecificDetails = { email: paymentDetails };
                    if (['play_store', 'amazon_gift', 'flipkart_gift'].includes(method)) {
                        methodSpecificDetails.giftCardType = method;
                        methodSpecificDetails.giftCardName = methodName || getWithdrawalMethodName(method);
                    }
                    if (amount < minWithdrawalRedeem) return showNotification(`Minimum withdrawal for this method is ₹${minWithdrawalRedeem}`, true);
            }

            try {
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                const reqRef = doc(collection(db, `artifacts/${appId}/public/data/fund_requests`));
                const requestedAt = Date.now();
                const requestPayload = {
                    id: reqRef.id,
                    userId: currentUser.uid,
                    userName: currentUserData.name || 'N/A',
                    userMobile: currentUserData.mobile || 'N/A',
                    userEmail: currentUserData.email || 'N/A',
                    type: 'withdrawal',
                    amount,
                    method: methodName,
                    methodId: method,
                    upiId: method === 'upi' ? paymentDetails : '',
                    paymentDetails,
                    ...methodSpecificDetails,
                    status: 'pending',
                    requestedAt
                };

                await runTransaction(db, async (tx) => {
                    const userDoc = await tx.get(userRef);
                    if (!userDoc.exists()) throw new Error("User account not found!");

                    const currentBalance = userDoc.data().balance || 0;
                    if (getSpendableWalletBalance(userDoc.data()) < amount) throw new Error(getInsufficientWalletMessage(userDoc.data()));

                    // 1. Deduct balance immediately
                    const balanceAfter = currentBalance - amount;
                    requestPayload.balanceBefore = currentBalance;
                    requestPayload.balanceAfter = balanceAfter;
                    tx.update(userRef, { balance: balanceAfter });

                    // 2. Add fund request (with snapshot of payment details)
                    const { id, ...firebaseRequestPayload } = requestPayload;
                    tx.set(reqRef, {
                        ...firebaseRequestPayload,
                        requestedAt: serverTimestamp()
                    });

                    // 3. Add a pending transaction record for the user
                    const txRef = doc(collection(userRef, 'transactions'));
                    tx.set(txRef, {
                        type: 'withdrawal',
                        amount: amount,
                        comment: `Withdrawal Request (${methodName})`,
                        timestamp: serverTimestamp(),
                        status: 'pending',
                        requestId: reqRef.id,
                        transactionId: generateTransactionId(),
                        method: methodName,
                        methodId: method,
                        // Save a snapshot of details here too
                        paymentDetails: paymentDetails,
                        balanceBefore: currentBalance,
                        balanceAfter,
                        ...methodSpecificDetails
                    });
                });

                await upsertCloudFundRequest(requestPayload);
                await syncRecentTransactionsToCloud(currentUser.uid);
                showNotification('Withdrawal Request Submitted and balance deducted!', false, true);
                window.closeModal();
                hidePage();
            } catch (e) {
                console.error("Withdraw request failed: ", e);
                showFriendlyError('Could not submit withdrawal request. Please try again.');
            }
        };

        // Handle Find Recipient for Pay to Wallet with minimum amount validation
        const handleFindRecipient = async () => {
            if (currentUserData.isFlagged) {
                return showNotification('Your account is flagged. Please contact support.', true);
            }
            const findBtn = document.getElementById('find-recipient-btn');
            const recipientMobile = document.getElementById('recipient-mobile-input').value.trim().replace(/\D/g, '');
            const amount = parseFloat(document.getElementById('pay-amount-input').value);
            const comment = document.getElementById('pay-comment-input').value.trim();

            if (!recipientMobile) {
                return showNotification('Please enter recipient mobile number.', true);
            }

            if (isNaN(amount) || amount < 1) {
                return showNotification('Minimum amount to send is ₹1.', true);
            }

            // Check if user has sufficient balance
            if (!currentUserData || getSpendableWalletBalance(currentUserData) < amount) {
                return showNotification(getInsufficientWalletMessage(currentUserData), true);
            }

            try {
                if (findBtn) {
                    findBtn.disabled = true;
                    findBtn.textContent = 'Finding...';
                }

                let recipientData = recipientLookupCache.get(recipientMobile);
                if (!recipientData) {
                    const recipientQuery = query(
                        collection(db, `artifacts/${appId}/public/data/users`),
                        where("mobile", "==", recipientMobile)
                    );
                    const recipientSnap = await getDocs(recipientQuery);

                    if (recipientSnap.empty) {
                        return showNotification('Recipient mobile number not found in our system.', true);
                    }

                    recipientData = { uid: recipientSnap.docs[0].id, ...recipientSnap.docs[0].data() };
                    recipientLookupCache.set(recipientMobile, recipientData);
                }

                // Don't allow sending to yourself
                if (recipientData.uid === currentUser.uid) {
                    return showNotification('You cannot send money to yourself.', true);
                }

                // Show confirmation modal
                renderModal('Confirm Payment details',
                    `<div class="space-y-4">
                       
                        <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600 dark:text-gray-300">User:</span>
                               <span class="font-semibold flex items-center">
    ${recipientData.name || 'N/A'}
    ${recipientData.name && recipientData.name.toLowerCase().includes('reviews world') ? `
        <svg class="w-4 h-4 inline-block text-blue-500 fill-current ml-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.7 4.8l-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6z"/>
        </svg>
    ` : ''}
</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600 dark:text-gray-300">Mobile:</span>
                                <span class="font-semibold">${recipientData.mobile || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600 dark:text-gray-300">Email:</span>
                                <span class="font-semibold">${(recipientData.email || 'N/A').split('@')[0]}</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600 dark:text-gray-300">Amount:</span>
                                <span class="font-semibold">${formatCurrency(amount)}</span>
                            </div>
                            ${comment ? `
                            <div class="flex justify-between">
                                <span class="text-gray-600 dark:text-gray-300">Remarks:</span>
                                <span class="font-semibold">${comment}</span>
                            </div>` : ''}
                            <div class="flex justify-between mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                                <span class="text-gray-600 dark:text-gray-300">Your Balance After:</span>
                                <span class="font-semibold">${formatCurrency(getSpendableWalletBalance(currentUserData) - amount)}</span>
                            </div>
                        </div>
                        <p class="text-sm text-gray-500 dark:text-gray-400 text-center">This transaction cannot be undone.</p>
                    </div>`,
                    `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                     <button id="final-pay-btn" class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg">Confirm & Send</button>`,
                    'max-w-md', true
                );

                document.getElementById('final-pay-btn').onclick = () => {
                    handlePayToWallet(recipientData, amount, comment);
                };

            } catch (e) {
                console.error("Find recipient failed:", e);
                showNotification(`Error: ${e.message}`, true);
            } finally {
                if (findBtn) {
                    findBtn.disabled = false;
                    findBtn.textContent = 'Find Recipient';
                }
            }
        };

        const handlePayToWallet = async (recipientData, amount, comment) => {
            if (!preventDuplicateRequest('pay-to-wallet')) return;

            const btn = document.getElementById('final-pay-btn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="flex items-center justify-center"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...</span>';
            }

            try {
                const senderTxnId = generateTransactionId();
                const recipientTxnId = generateTransactionId();
                let senderCloudTxn = null;
                let recipientCloudTxn = null;
                await runTransaction(db, async (tx) => {
                    // Get sender and recipient documents
                    const senderRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                    const recipientRef = doc(db, `artifacts/${appId}/public/data/users`, recipientData.uid);

                    const senderDoc = await tx.get(senderRef);
                    const recipientDoc = await tx.get(recipientRef);

                    if (!senderDoc.exists() || !recipientDoc.exists()) {
                        throw new Error("User accounts not found!");
                    }

                    const senderBalance = senderDoc.data().balance || 0;
                    const recipientBalance = recipientDoc.data().balance || 0;

                    // Check if sender has sufficient balance
                    if (getSpendableWalletBalance(senderDoc.data()) < amount) {
                        throw new Error(getInsufficientWalletMessage(senderDoc.data()));
                    }

                    // Update balances
                    tx.update(senderRef, { balance: senderBalance - amount });
                    tx.update(recipientRef, { balance: recipientBalance + amount });

                    // Add transaction records for both users with proper details
                    const senderComment = comment || `Sent to ${recipientData.name || recipientData.mobile}`;
                    const recipientComment = comment || `Received from ${currentUserData.name || currentUser.email}`;

                    // Generate transaction IDs
                    senderCloudTxn = {
                        type: 'debit',
                        amount,
                        comment: senderComment,
                        timestamp: Date.now(),
                        recipientName: recipientData.name,
                        recipientMobile: recipientData.mobile,
                        recipientIsProProfile: !!recipientData.isProProfile,
                        senderName: currentUserData.name,
                        senderMobile: currentUserData.mobile,
                        senderIsProProfile: !!currentUserData.isProProfile,
                        transactionId: senderTxnId,
                        balanceBefore: senderBalance,
                        balanceAfter: senderBalance - amount,
                        status: 'completed'
                    };
                    recipientCloudTxn = {
                        type: 'wallet_transfer',
                        amount,
                        comment: recipientComment,
                        timestamp: Date.now(),
                        senderName: currentUserData.name,
                        senderMobile: currentUserData.mobile,
                        senderIsProProfile: !!currentUserData.isProProfile,
                        recipientName: recipientData.name,
                        recipientMobile: recipientData.mobile,
                        recipientIsProProfile: !!recipientData.isProProfile,
                        transactionId: recipientTxnId,
                        balanceBefore: recipientBalance,
                        balanceAfter: recipientBalance + amount,
                        status: 'completed'
                    };

                    // For sender - debit transaction with recipient details
                    tx.set(doc(collection(senderRef, 'transactions')), {
                        type: 'debit',
                        amount,
                        comment: senderComment,
                        timestamp: serverTimestamp(),
                        recipientName: recipientData.name,
                        recipientMobile: recipientData.mobile,
                        recipientIsProProfile: !!recipientData.isProProfile,
                        senderName: currentUserData.name,
                        senderMobile: currentUserData.mobile,
                        senderIsProProfile: !!currentUserData.isProProfile,
                        transactionId: senderTxnId,
                        balanceBefore: senderBalance,
                        balanceAfter: senderBalance - amount,
                        status: 'completed'
                    });

                    // For recipient - wallet transfer (credit) with sender details
                    tx.set(doc(collection(recipientRef, 'transactions')), {
                        type: 'wallet_transfer',
                        amount,
                        comment: recipientComment,
                        timestamp: serverTimestamp(),
                        senderName: currentUserData.name,
                        senderMobile: currentUserData.mobile,
                        senderIsProProfile: !!currentUserData.isProProfile,
                        recipientName: recipientData.name,
                        recipientMobile: recipientData.mobile,
                        recipientIsProProfile: !!recipientData.isProProfile,
                        transactionId: recipientTxnId,
                        balanceBefore: recipientBalance,
                        balanceAfter: recipientBalance + amount,
                        status: 'completed'
                    });
                });

                currentUserData = {
                    ...(currentUserData || {}),
                    balance: Math.max(0, Number(currentUserData?.balance || 0) - amount)
                };
                document.getElementById('user-balance').textContent = formatCompactBalance(currentUserData.balance);
                updateDollarBalanceDisplay(currentUserData.balance);
                writeJsonCache(getUserCacheKey(currentUser.uid), sanitizeUserForCache(currentUserData, currentUser.uid));
                const instantTransaction = addInstantTransactionToHistory(currentUser.uid, senderCloudTxn);
                Promise.allSettled([
                    recordCloudTransfer(senderCloudTxn, recipientCloudTxn, recipientData.uid),
                    syncRecentTransactionsToCloud(currentUser.uid)
                ]).catch(error => console.warn('Pay to wallet background sync failed:', error));
                showNotification(`Success! Sent ${formatCurrency(amount)} to ${recipientData.name || recipientData.mobile}`, false, true);
                window.closeModal();
                showTransactionDetails(instantTransaction?.key || senderTxnId);
            } catch (e) {
                console.error("Pay to wallet failed:", e);
                showNotification(`Transaction failed: ${e.message}`, true);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Confirm & Send';
                }
            } finally {
                pendingRequests.delete('pay-to-wallet');
            }
        };

        const handleRedeem = async () => {
            const code = document.getElementById('gift-code-input').value.trim().toUpperCase();
            if (!code) return;
            let redeemedAmount = 0;
            try {
                const q = query(collection(db, `artifacts/${appId}/public/data/gift_codes`), where("code", "==", code));
                const snap = await getDocs(q);
                if (snap.empty) throw new Error("Invalid code.");
                const giftCodeRef = snap.docs[0].ref;
                await runTransaction(db, async (tx) => {
                    const giftCodeDoc = await tx.get(giftCodeRef);
                    if (!giftCodeDoc.exists()) throw new Error("Gift code not found.");
                    const giftCodeData = giftCodeDoc.data();
                    if ((giftCodeData.redeemedBy || []).includes(currentUser.uid)) throw new Error("You have already redeemed this code.");
                    if ((giftCodeData.timesUsed || 0) >= (giftCodeData.usageLimit || 1)) throw new Error("This gift code has reached its usage limit.");

                    const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                    const userDoc = await tx.get(userRef);
                    if (!userDoc.exists()) throw new Error("Current user not found.");

                    const amount = giftCodeData.amount;
                    redeemedAmount = amount;

                    const currentBalance = userDoc.data().balance || 0;
                    const balanceAfter = currentBalance + amount;
                    tx.update(userRef, { balance: balanceAfter });
                    tx.update(giftCodeRef, { timesUsed: (giftCodeData.timesUsed || 0) + 1, redeemedBy: arrayUnion(currentUser.uid) });
                    tx.set(doc(collection(userRef, 'transactions')), {
                        type: 'gift_card',
                        amount,
                        comment: `Redeemed code ${code}`,
                        timestamp: serverTimestamp(),
                        transactionId: code,
                        giftCode: code,
                        senderName: 'Reviews World',
                        recipientName: currentUserData.name || 'User',
                        recipientMobile: currentUserData.mobile || '',
                        recipientIsProProfile: !!currentUserData.isProProfile,
                        balanceBefore: currentBalance,
                        balanceAfter,
                        status: 'completed'
                    });
                });
                await syncRecentTransactionsToCloud(currentUser.uid);
                showNotification(`Success! Added ${formatCurrency(redeemedAmount)} to your wallet.`, false, true);
                window.closeModal();
            } catch (e) {
                console.error("Redeem failed:", e);
                if (e.message.includes("permission-denied") || e.message.includes("insufficient permissions")) {
                    showNotification('Redeem failed. Please contact support.', true);
                } else {
                    showNotification(`Redeem failed: ${e.message}`, true);
                }
            }
        };

        const showCreateGiftCodeModal = () => {
            renderModal('Create Gift Code',
                `<div class="space-y-3">
                    <input type="text" id="new-code-input" placeholder="Code (e.g., DIWALI500)" class="w-full uppercase px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <input type="number" id="new-code-amount" placeholder="Amount (₹)" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <input type="number" id="new-code-limit" placeholder="Usage Limit (e.g., 10)" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg" value="1">
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="modal-submit-btn" class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg">Create</button>`);
            document.getElementById('modal-submit-btn').onclick = handleCreateGiftCode;
        };

        const handleCreateGiftCode = async () => {
            const code = document.getElementById('new-code-input').value.trim().toUpperCase();
            const amount = parseFloat(document.getElementById('new-code-amount').value);
            const limit = parseInt(document.getElementById('new-code-limit').value);
            if (!code || isNaN(amount) || amount <= 0 || isNaN(limit) || limit <= 0) {
                return showNotification('Invalid code, amount, or usage limit.', true);
            }

            await addDoc(collection(db, `artifacts/${appId}/public/data/gift_codes`), {
                code,
                amount,
                usageLimit: limit,
                timesUsed: 0,
                redeemedBy: [],
                createdAt: serverTimestamp()
            });
            showNotification(`Code ${code} created.`);
            window.closeModal();
        };

        const generateUniqueGiftCodeValue = (existingCodes) => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';

            do {
                code = 'RW';
                for (let i = 0; i < 8; i++) {
                    code += chars[Math.floor(Math.random() * chars.length)];
                }
            } while (existingCodes.has(code));

            existingCodes.add(code);
            return code;
        };

        const handleGenerateGiftCodes = async () => {
            const count = parseInt(document.getElementById('bulk-gift-code-count').value);
            const amount = parseFloat(document.getElementById('bulk-gift-code-amount').value);

            if (isNaN(count) || count <= 0 || count > 200 || isNaN(amount) || amount <= 0) {
                return showNotification('Enter valid count (1-200) and amount.', true);
            }

            try {
                const codesRef = collection(db, `artifacts/${appId}/public/data/gift_codes`);
                const snap = await getDocs(codesRef);
                const existingCodes = new Set(snap.docs.map(d => (d.data().code || '').toUpperCase()));
                const batch = writeBatch(db);

                for (let i = 0; i < count; i++) {
                    const code = generateUniqueGiftCodeValue(existingCodes);
                    batch.set(doc(codesRef), {
                        code,
                        amount,
                        usageLimit: 1,
                        timesUsed: 0,
                        redeemedBy: [],
                        createdAt: serverTimestamp()
                    });
                }

                await batch.commit();
                document.getElementById('bulk-gift-code-count').value = '';
                document.getElementById('bulk-gift-code-amount').value = '';
                const freshSnap = await getDocs(codesRef);
                allGiftCodesCache = freshSnap.docs;
                renderAdminGiftCodesList(freshSnap.docs);
                showNotification(`${count} unique gift code(s) generated.`);
            } catch (e) {
                console.error('Bulk gift code generation failed:', e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

        const handleCopyActiveGiftCodes = async (button) => {
            try {
                let docs = allGiftCodesCache;
                if (!docs.length) {
                    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/gift_codes`));
                    docs = snap.docs;
                    allGiftCodesCache = docs;
                }

                const activeCodes = docs
                    .map(d => d.data())
                    .filter(c => (c.timesUsed || 0) < (c.usageLimit || 1))
                    .map(c => c.code)
                    .filter(Boolean);

                if (!activeCodes.length) return showNotification('No active gift codes to copy.', true);
                await handleCopyText(activeCodes.join('\n'), button);
                showNotification('Active gift codes copied line by line.');
            } catch (e) {
                console.error('Copy active gift codes failed:', e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

        const handleDeleteGiftCode = (docId) => {
            renderModal('Delete Code',
                '<p>Are you sure? This cannot be undone.</p>',
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-action-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Delete</button>`,
                'max-w-sm'
            );
            document.getElementById('confirm-action-btn').onclick = async () => {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/gift_codes`, docId));
                showNotification('Gift code deleted.');
                window.closeModal();
            };
        };

        const handleCopyText = async (text, button) => {
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
                const originalContent = button.innerHTML;
                button.innerHTML = '<span class="text-[10px] text-green-500 font-bold">Copied!</span>';
                setTimeout(() => { button.innerHTML = originalContent; }, 2000);
            } catch (err) {
                console.error('Failed to copy!', err);
                showNotification('Failed to copy text.', true);
            }
        };

        const handleCopyUpi = async (upiId, button) => {
            const ta = document.createElement('textarea');
            ta.value = upiId;
            ta.style.position = 'absolute';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                button.textContent = 'Copied!';
                setTimeout(() => { button.textContent = 'Copy'; }, 2000);
            } catch (err) {
                console.error('Failed to copy!', err);
                showNotification('Failed to copy UPI ID.', true);
            }
            document.body.removeChild(ta);
        };

        const handleRequestAction = (userId, requestId, newStatus) => {
            if (newStatus === 'completed') {
                const reqData = allFundRequestsCache.find(r => r.id === requestId);
                if (!reqData) return showNotification('Error: Request not found.', true);

                renderModal('Confirm Payment',
                    `<div class="space-y-4">
                        <p class="mb-2">Enter the Transaction ID after sending ${formatCurrency(reqData.amount)} to ${reqData.userName}.</p>
                        <div class="space-y-2">
                            <input type="text" id="admin-tx-id-input" placeholder="Enter Transaction ID" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <p class="text-xs text-gray-500 dark:text-gray-400">This transaction ID will be shown to the user as proof of payment.</p>
                        </div>
                    </div>`,
                    `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                     <button id="modal-confirm-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Confirm & Approve</button>`,
                    'max-w-md'
                );
                document.getElementById('modal-confirm-btn').onclick = () => {
                    const txnId = document.getElementById('admin-tx-id-input').value.trim();
                    if (!txnId) return showNotification('Transaction ID is required.', true);
                    proceedWithRequestAction(userId, requestId, newStatus, txnId, reqData);
                };
            } else if (newStatus === 'rejected') {
                renderModal('Reject Withdrawal Request',
                    `<div class="space-y-4">
                        <p class="font-semibold text-red-500">Are you sure you want to reject this request?</p>
                        <div class="space-y-2">
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Rejection Reason</label>
                            <textarea id="rejection-reason-input" placeholder="Enter reason for rejection (this will be shown to the user)" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" rows="3"></textarea>
                            <p class="text-xs text-gray-500 dark:text-gray-400">This reason will be visible to the user in their transaction history.</p>
                        </div>
                    </div>`,
                    `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                     <button id="confirm-action-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Reject Request</button>`,
                    'max-w-md'
                );
                document.getElementById('confirm-action-btn').onclick = () => {
                    const rejectionReason = document.getElementById('rejection-reason-input').value.trim();
                    if (!rejectionReason) {
                        return showNotification('Please provide a rejection reason.', true);
                    }
                    proceedWithRequestAction(userId, requestId, newStatus, null, null, rejectionReason);
                };
            }
        };

        const handleRechargeAction = (userId, requestId, newStatus) => {
            const reqData = allRechargeRequestsCache.find(r => r.id === requestId);
            if (!reqData) return showNotification('Error: Recharge request not found.', true);

            if (newStatus === 'completed') {
                renderModal('Complete Recharge',
                    `<div class="space-y-4">
                        <p class="mb-2">Enter the recharge transaction ID after completing ${formatCurrency(reqData.amount)} recharge for ${reqData.mobileNumber}.</p>
                        <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-xs space-y-1">
                            <p><strong>Operator:</strong> ${reqData.operator}</p>
                            <p><strong>State:</strong> ${reqData.state}</p>
                            <p><strong>Plan:</strong> ${reqData.planDetails}</p>
                            <p><strong>Wallet Deducted:</strong> ${formatCurrency(reqData.chargeAmount || reqData.amount || 0)}</p>
                        </div>
                        <input type="text" id="admin-recharge-tx-id-input" placeholder="Enter Transaction ID" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    </div>`,
                    `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                     <button id="modal-recharge-confirm-btn" class="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg">Mark Done</button>`,
                    'max-w-md'
                );
                document.getElementById('modal-recharge-confirm-btn').onclick = () => {
                    const txnId = document.getElementById('admin-recharge-tx-id-input').value.trim();
                    if (!txnId) return showNotification('Transaction ID is required.', true);
                    proceedWithRechargeAction(userId, requestId, newStatus, txnId, reqData);
                };
            } else {
                renderModal('Reject Recharge Request',
                    `<div class="space-y-4">
                        <p class="font-semibold text-red-500">Reject this recharge request and refund wallet deduction?</p>
                        <textarea id="recharge-rejection-reason-input" placeholder="Enter rejection reason" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" rows="3"></textarea>
                    </div>`,
                    `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                     <button id="modal-recharge-reject-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Reject & Refund</button>`,
                    'max-w-md'
                );
                document.getElementById('modal-recharge-reject-btn').onclick = () => {
                    const reason = document.getElementById('recharge-rejection-reason-input').value.trim();
                    if (!reason) return showNotification('Please provide a rejection reason.', true);
                    proceedWithRechargeAction(userId, requestId, newStatus, null, reqData, reason);
                };
            }
        };

        const showLoanActionConfirmModal = ({ title, message, confirmLabel = 'OK', confirmClass = 'bg-indigo-600', onConfirm }) => {
            renderModal(title,
                `<div class="space-y-3 text-sm">
                    <div class="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200">
                        <p class="font-black">Please confirm before continuing.</p>
                        <p class="mt-1">${message}</p>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Click OK only if this action is correct.</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-loan-action-btn" class="px-4 py-2 text-sm ${confirmClass} text-white rounded-lg">${confirmLabel}</button>`,
                'max-w-md');
            document.getElementById('confirm-loan-action-btn').onclick = async () => {
                const btn = document.getElementById('confirm-loan-action-btn');
                btn.disabled = true;
                btn.textContent = 'Working...';
                window.closeModal();
                await onConfirm?.();
            };
        };

        const showApproveLoanRequestModal = (userId, requestId) => {
            const request = allLoanRequestsCache.find(item => item.id === requestId) || {};
            const requestStatus = getLoanRequestStatus(request);
            renderModal('Approve Loan Request',
                `<div class="space-y-4">
                    <div class="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-3 text-sm">
                        <p class="font-bold text-gray-900 dark:text-white">${escapeHtml(request.name || 'User')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(request.mobile || request.userEmail || '')}</p>
                        ${requestStatus === 'rejected' ? '<p class="mt-2 inline-flex rounded-full bg-red-100 px-2 py-1 text-[10px] font-black uppercase text-red-600">Rejected request</p>' : ''}
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Maximum loan amount for this user</label>
                        <input type="number" id="approve-loan-max-input" min="1" step="1" placeholder="Enter maximum amount" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">User can take loan only up to this approved amount.</p>
                    </div>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-approve-loan-btn" class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg">Approve</button>`,
                'max-w-md');
            document.getElementById('confirm-approve-loan-btn').onclick = () => {
                const maxLoanAmount = parseFloat(document.getElementById('approve-loan-max-input')?.value || '0');
                if (!Number.isFinite(maxLoanAmount) || maxLoanAmount < 1) {
                    return showNotification('Please enter a valid maximum loan amount.', true);
                }
                window.closeModal();
                showLoanActionConfirmModal({
                    title: 'Confirm Loan Approval',
                    message: `Approve ${escapeHtml(request.name || 'this user')} and set loan limit to ${formatCurrency(maxLoanAmount)}?`,
                    confirmLabel: 'OK, Approve',
                    confirmClass: 'bg-green-600',
                    onConfirm: () => handleLoanRequestAction(userId, requestId, 'approved', maxLoanAmount)
                });
            };
        };

        const showRejectLoanRequestConfirmModal = (userId, requestId) => {
            const request = allLoanRequestsCache.find(item => item.id === requestId) || {};
            renderModal('Reject Loan Request',
                `<div class="space-y-4 text-sm">
                    <div class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-3">
                        <p class="font-black text-gray-900 dark:text-white">${escapeHtml(request.name || 'User')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(request.mobile || request.userEmail || '')}</p>
                        <p class="mt-2 font-semibold text-red-600 dark:text-red-300">Are you sure you want to reject this loan request?</p>
                    </div>
                    <textarea id="loan-rejection-reason-input" placeholder="Reason shown to user (optional)" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" rows="3"></textarea>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-reject-loan-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">OK, Reject</button>`,
                'max-w-md');
            document.getElementById('confirm-reject-loan-btn').onclick = () => {
                const reason = document.getElementById('loan-rejection-reason-input')?.value.trim() || 'Loan request cancelled by admin.';
                window.closeModal();
                handleLoanRequestAction(userId, requestId, 'rejected', 0, reason);
            };
        };

        const showGiveLoanChanceConfirmModal = (userId, requestId) => {
            const request = allLoanRequestsCache.find(item => item.id === requestId) || {};
            showLoanActionConfirmModal({
                title: 'Give Loan Chance',
                message: `Move ${escapeHtml(request.name || 'this user')} rejected loan request back to pending so it can be checked again?`,
                confirmLabel: 'OK, Give Chance',
                confirmClass: 'bg-indigo-600',
                onConfirm: () => handleLoanGiveChanceAction(userId, requestId)
            });
        };

        const handleLoanRequestAction = async (userId, requestId, newStatus, maxLoanAmount = 0, rejectionReason = 'Loan request cancelled by admin.') => {
            try {
                if (newStatus === 'approved' && (!Number.isFinite(Number(maxLoanAmount)) || Number(maxLoanAmount) < 1)) {
                    return showApproveLoanRequestModal(userId, requestId);
                }
                const rejectedAt = newStatus === 'approved' ? null : new Date();
                const reapplyAfter = rejectedAt ? addMonthsClamped(rejectedAt, LOAN_REAPPLY_WAIT_MONTHS) : null;
                const cleanRejectionReason = String(rejectionReason || 'Loan request cancelled by admin.').trim();
                const requestRef = doc(db, `artifacts/${appId}/public/data/loan_requests`, requestId);
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                await runTransaction(db, async (tx) => {
                    const requestDoc = await tx.get(requestRef);
                    if (!requestDoc.exists()) throw new Error('Loan request not found.');
                    const requestData = requestDoc.data();
                    const currentStatus = getLoanRequestStatus(requestData);
                    const rejectedStatuses = ['rejected', 'cancelled', 'canceled', 'failed', 'denied'];
                    if (newStatus === 'approved' && !['pending', ...rejectedStatuses].includes(currentStatus)) {
                        throw new Error('Loan request is already processed.');
                    }
                    if (newStatus !== 'approved' && currentStatus !== 'pending') {
                        throw new Error('Only pending loan requests can be rejected.');
                    }
                    tx.update(requestRef, {
                        status: newStatus,
                        processedAt: serverTimestamp(),
                        processedBy: currentUser.uid,
                        ...(newStatus === 'approved' ? {
                            reapplyAfter: deleteField(),
                            rejectionReason: deleteField()
                        } : {
                            reapplyAfter: Timestamp.fromDate(reapplyAfter),
                            rejectionReason: cleanRejectionReason
                        })
                    });
                    if (newStatus === 'approved') {
                        tx.update(userRef, {
                            loanEligible: true,
                            maxLoanAmount: Number(maxLoanAmount),
                            loanMaxAmount: Number(maxLoanAmount),
                            loanApplicationVersion: LOAN_APPLICATION_VERSION,
                            loanRequestStatus: 'approved',
                            loanApprovedAt: serverTimestamp(),
                            loanApprovedBy: currentUser.uid,
                            loanDocumentsSubmitted: true,
                            loanDocumentsVerified: true,
                            loanDocumentsApprovedAt: serverTimestamp(),
                            loanReapplyAfter: deleteField(),
                            loanRejectionReason: deleteField(),
                            loanProcessedAt: deleteField(),
                            loanProcessedBy: deleteField()
                        });
                        tx.update(requestRef, {
                            maxLoanAmount: Number(maxLoanAmount),
                            loanApplicationVersion: LOAN_APPLICATION_VERSION,
                            loanDocumentsSubmitted: true,
                            loanDocumentsVerified: true,
                            loanDocumentsApproved: true
                        });
                    } else {
                        tx.update(userRef, {
                            loanEligible: false,
                            maxLoanAmount: 0,
                            loanMaxAmount: 0,
                            loanRequestStatus: newStatus,
                            latestLoanRequestVersion: LOAN_APPLICATION_VERSION,
                            loanApplicationVersion: LOAN_APPLICATION_VERSION,
                            loanProcessedAt: serverTimestamp(),
                            loanProcessedBy: currentUser.uid,
                            loanReapplyAfter: Timestamp.fromDate(reapplyAfter),
                            loanRejectionReason: cleanRejectionReason,
                            loanDocumentsVerified: false
                        });
                    }
                });
                showNotification(`Loan request ${newStatus}.`);
                refreshAdminDashboardCaches().catch(error => console.error('Admin cache refresh failed:', error));
            } catch (e) {
                console.error('Loan action failed:', e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

        const handleLoanGiveChanceAction = async (userId, requestId) => {
            try {
                const requestRef = doc(db, `artifacts/${appId}/public/data/loan_requests`, requestId);
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                await runTransaction(db, async (tx) => {
                    const requestDoc = await tx.get(requestRef);
                    if (!requestDoc.exists()) throw new Error('Loan request not found.');
                    const currentStatus = getLoanRequestStatus(requestDoc.data());
                    if (!['rejected', 'cancelled', 'canceled', 'failed', 'denied'].includes(currentStatus)) {
                        throw new Error('Only rejected loan requests can be given another chance.');
                    }
                    tx.update(requestRef, {
                        status: 'pending',
                        reopenedAt: serverTimestamp(),
                        reopenedBy: currentUser.uid,
                        processedAt: deleteField(),
                        processedBy: deleteField(),
                        reapplyAfter: deleteField(),
                        rejectionReason: deleteField()
                    });
                    tx.update(userRef, {
                        loanEligible: false,
                        maxLoanAmount: 0,
                        loanMaxAmount: 0,
                        loanRequestStatus: 'pending',
                        latestLoanRequestVersion: LOAN_APPLICATION_VERSION,
                        loanApplicationVersion: LOAN_APPLICATION_VERSION,
                        loanDocumentsSubmitted: true,
                        loanDocumentsVerified: false,
                        loanProcessedAt: deleteField(),
                        loanProcessedBy: deleteField(),
                        loanReapplyAfter: deleteField(),
                        loanRejectionReason: deleteField()
                    });
                });
                showNotification('Loan request moved back to pending.');
                window.currentLoanFilter = 'pending';
                refreshAdminDashboardCaches().catch(error => console.error('Admin cache refresh failed:', error));
                renderAdminLoanPage();
            } catch (e) {
                console.error('Give loan chance failed:', e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

        const proceedWithRechargeAction = async (userId, requestId, newStatus, txnId, reqData, rejectionReason = '') => {
            try {
                const reqRef = doc(db, `artifacts/${appId}/public/data/fund_requests`, requestId);
                await runTransaction(db, async (tx) => {
                    const reqDoc = await tx.get(reqRef);
                    if (!reqDoc.exists() || reqDoc.data().status !== 'pending') throw new Error("Recharge request not found or already processed.");

                    const data = reqDoc.data();
                    const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                    const userDoc = await tx.get(userRef);
                    const chargeAmount = data.chargeAmount || data.amount || 0;

                    if (newStatus === 'completed') {
                        tx.update(reqRef, {
                            status: 'completed',
                            processedAt: serverTimestamp(),
                            adminTransactionId: txnId
                        });
                    } else {
                        tx.update(reqRef, {
                            status: 'rejected',
                            processedAt: serverTimestamp(),
                            rejectionReason
                        });
                        if (userDoc.exists()) {
                            tx.update(userRef, { balance: (userDoc.data().balance || 0) + chargeAmount });
                        }
                    }

                    if (userDoc.exists()) {
                        const txQuery = query(collection(userRef, 'transactions'), where("requestId", "==", requestId));
                        const txSnap = await getDocs(txQuery);
                        const txUpdate = newStatus === 'completed'
                            ? {
                                status: 'completed',
                                adminTransactionId: txnId,
                                transactionId: txnId,
                                processedAt: serverTimestamp()
                            }
                            : {
                                status: 'rejected',
                                rejectionReason,
                                processedAt: serverTimestamp(),
                                comment: `Mobile Recharge Rejected: ${rejectionReason}`
                            };

                        if (!txSnap.empty) {
                            tx.update(txSnap.docs[0].ref, txUpdate);
                        } else {
                            tx.set(doc(collection(userRef, 'transactions')), {
                                type: 'mobile_recharge',
                                amount: data.amount,
                                chargeAmount,
                                discount: data.discount || 0,
                                mobileNumber: data.mobileNumber,
                                operator: data.operator,
                                state: data.state,
                                planDetails: data.planDetails,
                                comment: newStatus === 'completed' ? `Mobile Recharge (${data.operator})` : `Mobile Recharge Rejected: ${rejectionReason}`,
                                timestamp: serverTimestamp(),
                                requestId,
                                transactionId: txnId || generateTransactionId(),
                                status: newStatus,
                                adminTransactionId: txnId || ''
                            });
                        }
                    }
                });
                await updateCloudFundRequestStatus(requestId, newStatus, {
                    ...(reqData || {}),
                    status: newStatus,
                    adminTransactionId: txnId || '',
                    rejectionReason,
                    processedAt: Date.now()
                });
                syncRecentTransactionsToCloud(userId).catch(error => console.warn('Recharge transaction background sync skipped:', error));
                allRechargeRequestsCache = allRechargeRequestsCache.filter(req => req.id !== requestId);
                renderAdminRechargeRequests(allRechargeRequestsCache);
                updateAdminPendingRequestSummary();
                refreshAdminFundRequestsFromCloud().catch(error => console.warn('Recharge request background refresh skipped:', error));
                showNotification(`Recharge request has been ${newStatus === 'completed' ? 'completed' : 'rejected'}.`);
                window.closeModal();
            } catch (e) {
                console.error("Recharge action failed:", e);
                showFriendlyError('Could not update recharge request. Please try again.');
                window.closeModal();
            }
        };

        const proceedWithRequestAction = async (userId, requestId, newStatus, txnId, reqData, rejectionReason = '') => {
            let processedAmount = reqData?.amount || 0;
            try {
                const reqRef = doc(db, `artifacts/${appId}/public/data/fund_requests`, requestId);
                let requestData = reqData || allFundRequestsCache.find(r => r.id === requestId) || {};
                const amount = Number(requestData.amount || 0);
                processedAmount = amount;
                if (newStatus === 'completed' && shouldDeductLegacyWithdrawal(requestData)) {
                    requestData = await applyLegacyWithdrawalDeduction(userId, requestId, requestData);
                }
                const withdrawalSnapshot = getWithdrawalSnapshot(requestData);
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                const requestBalanceBefore = Number(requestData.balanceBefore ?? requestData.balance_before);
                const requestBalanceAfter = Number(requestData.balanceAfter ?? requestData.balance_after);
                const balanceWasDeducted = isWithdrawalBalanceDeducted(requestData);
                const transactionBalanceBefore = Number.isFinite(requestBalanceBefore) ? requestBalanceBefore : null;
                const transactionBalanceAfter = newStatus === 'rejected'
                    ? (balanceWasDeducted && Number.isFinite(requestBalanceBefore) ? requestBalanceBefore : null)
                    : (Number.isFinite(requestBalanceAfter) ? requestBalanceAfter : null);
                const requestedAt = requestData.requestedAt || requestData.requested_at || requestData.timestamp || requestData.createdAt || Date.now();
                const processedAt = Date.now();
                const transactionPayload = {
                    type: 'withdrawal',
                    amount,
                    timestamp: requestedAt,
                    requestedAt,
                    status: newStatus === 'completed' ? 'completed' : 'rejected',
                    requestId,
                    transactionId: txnId || generateTransactionId(),
                    adminTransactionId: txnId || '',
                    rejectionReason: rejectionReason || '',
                    comment: newStatus === 'completed' ? 'Payment by Reviews World' : `Withdrawal Rejected: ${rejectionReason}`,
                    processedAt,
                    ...withdrawalSnapshot,
                    ...(transactionBalanceBefore !== null ? { balanceBefore: transactionBalanceBefore } : {}),
                    ...(transactionBalanceAfter !== null ? { balanceAfter: transactionBalanceAfter } : {})
                };

                if (newStatus === 'completed') {
                    await updateDoc(reqRef, {
                        status: newStatus,
                        processedAt: serverTimestamp(),
                        requestedAt,
                        adminTransactionId: txnId,
                        ...(transactionBalanceBefore !== null ? { balanceBefore: transactionBalanceBefore } : {}),
                        ...(transactionBalanceAfter !== null ? { balanceAfter: transactionBalanceAfter } : {}),
                        balanceDeducted: balanceWasDeducted
                    });
                } else {
                    await updateDoc(reqRef, {
                        status: newStatus,
                        processedAt: serverTimestamp(),
                        requestedAt,
                        rejectionReason: rejectionReason,
                        ...(transactionBalanceBefore !== null ? { balanceBefore: transactionBalanceBefore } : {}),
                        ...(transactionBalanceAfter !== null ? { balanceAfter: transactionBalanceAfter } : {}),
                        balanceDeducted: balanceWasDeducted
                    });
                    if (balanceWasDeducted) {
                        await updateDoc(userRef, { balance: increment(amount) });
                    }
                }
                await setDoc(doc(collection(userRef, 'transactions'), getSafeTransactionDocId(`withdrawal-${requestId}`)), transactionPayload, { merge: true });

                await updateCloudFundRequestStatus(requestId, newStatus, {
                    ...(requestData || {}),
                    status: newStatus,
                    adminTransactionId: txnId || '',
                    rejectionReason,
                    requestedAt,
                    processedAt,
                    amount: processedAmount,
                    ...(transactionBalanceBefore !== null ? { balanceBefore: transactionBalanceBefore } : {}),
                    ...(transactionBalanceAfter !== null ? { balanceAfter: transactionBalanceAfter } : {}),
                    balanceDeducted: balanceWasDeducted
                });
                syncRecentTransactionsToCloud(userId).catch(error => console.warn('Withdraw transaction background sync skipped:', error));
                if (currentUser?.uid && currentUser.uid !== userId) {
                    unifiedHistoryCache = readHistoryItemsFromCache(currentUser.uid);
                }
                notifyWithdrawalStatus({
                    userId,
                    status: newStatus,
                    amount: processedAmount,
                    txnId: transactionPayload.transactionId,
                    requestId,
                    rejectionReason,
                    processedAt
                });
                allFundRequestsCache = allFundRequestsCache.filter(req => req.id !== requestId);
                renderAdminFundRequests(allFundRequestsCache);
                updateAdminPendingRequestSummary();
                refreshAdminFundRequestsFromCloud().catch(error => console.warn('Pending withdrawal refresh skipped:', error));
                showNotification(`Success! Request has been ${newStatus}.`);
                window.closeModal();
            } catch (e) {
                console.error("Request action failed:", e);
                showFriendlyError('Could not update withdrawal request. Please try again.');
                window.closeModal();
            }
        };

        // Handle Disable User without deleting financial history.
        const handleDeleteUser = (userId, userName) => {
            renderModal('Disable User',
                `<div class="space-y-4">
                    <p class="text-red-600 font-semibold">This will block the user from using the wallet.</p>
                    <p>Are you sure you want to disable <strong>${escapeHtml(userName)}</strong>?</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Financial records, transaction history, invoices, and wallet audit data will be preserved.</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-action-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Disable User</button>`,
                'max-w-md'
            );
            document.getElementById('confirm-action-btn').onclick = async () => {
                try {
                    const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                    await updateDoc(userRef, {
                        isFlagged: true,
                        isDisabled: true,
                        disabledAt: serverTimestamp(),
                        disabledBy: currentUser.uid,
                        banReason: 'Account disabled by admin. Financial records retained for audit.'
                    });
                    showNotification('User disabled. Transaction history was preserved.');
                    refreshAdminDashboardCaches().catch(error => console.error('Admin cache refresh failed:', error));
                    window.closeModal();
                } catch (e) {
                    console.error("Disable user failed:", e);
                    showNotification(`Error disabling user: ${e.message}`, true);
                }
            };
        };

        const showAdminWithdrawSettingsModal = async () => {
            await loadWithdrawalSettingsOnce(true);
            const content = `
                <div class="space-y-4">
                    <p class="text-sm text-gray-500 dark:text-gray-400">Configure withdrawal limits and rules for all users.</p>
                    
                    <div class="space-y-3">
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Min. Withdrawal (UPI)</label>
                            <input type="number" id="setting-min-upi" value="${minWithdrawalUpi}" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Min. Withdrawal (Bank)</label>
                            <input type="number" id="setting-min-bank" value="${minWithdrawalBank}" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Min. Withdrawal (Gift Cards)</label>
                            <input type="number" id="setting-min-redeem" value="${minWithdrawalRedeem}" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Max. Withdrawal Per Day (Total)</label>
                            <input type="number" id="setting-max-day" value="${maxWithdrawalPerDay}" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Max. Pending Requests Per User</label>
                            <input type="number" id="setting-max-pending" value="${maxPendingWithdrawalsPerUser}" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <p class="text-[10px] text-gray-400 mt-1">Set to 1 to allow only one pending request at a time.</p>
                        </div>
                    </div>
                </div>`;
            const actions = `
                <button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                <button id="modal-save-settings-btn" class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg">Save Settings</button>`;
            renderModal('Withdrawal Settings', content, actions);
            document.getElementById('modal-save-settings-btn').onclick = handleSaveWithdrawSettings;
        };

        const handleSaveWithdrawSettings = async () => {
            const minUpi = parseInt(document.getElementById('setting-min-upi').value);
            const minBank = parseInt(document.getElementById('setting-min-bank').value);
            const minRedeem = parseInt(document.getElementById('setting-min-redeem').value);
            const maxDay = parseInt(document.getElementById('setting-max-day').value);
            const maxPending = parseInt(document.getElementById('setting-max-pending').value);

            if (isNaN(minUpi) || isNaN(minBank) || isNaN(minRedeem) || isNaN(maxDay) || isNaN(maxPending)) {
                return showNotification('Please enter valid numbers for all settings.', true);
            }

            try {
                const configRef = doc(db, `artifacts/${appId}/settings`, 'app_config');
                await setDoc(configRef, {
                    min_withdrawal_upi: minUpi,
                    min_withdrawal_bank: minBank,
                    min_withdrawal_redeem: minRedeem,
                    min_withdrawal_amount: Math.min(minUpi, minBank, minRedeem),
                    max_withdrawal_per_day: maxDay,
                    max_pending_withdrawals: maxPending,
                    updatedAt: serverTimestamp()
                }, { merge: true });

                applyWithdrawalConfig({
                    min_withdrawal_upi: minUpi,
                    min_withdrawal_bank: minBank,
                    min_withdrawal_redeem: minRedeem,
                    min_withdrawal_amount: Math.min(minUpi, minBank, minRedeem),
                    max_withdrawal_per_day: maxDay,
                    max_pending_withdrawals: maxPending
                });
                withdrawalSettingsLoadedAt = Date.now();

                showNotification('Withdrawal settings saved successfully!');
                window.closeModal();
            } catch (e) {
                console.error("Save settings failed:", e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

        const showAdminAddFundsModal = () => {
            let options = allUsersCache
                .filter(u => !isAdminUserRecord(u))
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map(u => `<option value="${u.id}">${u.name || u.email}</option>`)
                .join('');
            const content = `
                <div class="space-y-4">
                    <p class="text-sm text-gray-500 dark:text-gray-400">Select a user to add funds to their wallet directly.</p>
                    <select id="user-select-dropdown" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">${options}</select>
                    <input type="number" id="fund-amount-input" placeholder="Amount (₹)" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <input type="text" id="fund-comment-input" placeholder="Remarks (e.g., Bonus)" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                </div>`;
            const actions = `
                <button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                <button id="modal-submit-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Add Funds</button>`;
            renderModal('Add Funds to User', content, actions);
            document.getElementById('modal-submit-btn').onclick = handleAdminAddFunds;
        };

        const handleAdminAddFunds = async () => {
            const userId = document.getElementById('user-select-dropdown').value;
            const amount = parseFloat(document.getElementById('fund-amount-input').value);
            let comment = document.getElementById('fund-comment-input').value.trim();

            // Auto-fill remarks if empty
            if (!comment) {
                comment = "Payment By reviews World";
            }

            if (!userId || isNaN(amount) || amount <= 0) {
                return showNotification('Please fill all fields correctly.', true);
            }

            try {
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                await runTransaction(db, async (tx) => {
                    const userDoc = await tx.get(userRef);
                    if (!userDoc.exists()) throw new Error("User not found!");
                    const oldBalance = userDoc.data().balance || 0;
                    const newBalance = oldBalance + amount;
                    tx.update(userRef, { balance: newBalance });
                    tx.set(doc(collection(userRef, 'transactions')), {
                        type: 'credit',
                        amount,
                        comment,
                        timestamp: serverTimestamp(),
                        transactionId: generateTransactionId(),
                        status: 'completed',
                        senderName: 'REVIEWS WORLD',
                        senderMobile: 'Admin Wallet',
                        recipientName: userDoc.data().name || 'User',
                        recipientMobile: userDoc.data().mobile || '',
                        recipientIsProProfile: !!userDoc.data().isProProfile,
                        mode: 'Admin Credit',
                        balanceBefore: oldBalance,
                        balanceAfter: newBalance,
                        isAdminTransaction: true
                    });
                });
                allUsersCache = allUsersCache.map(u => u.id === userId ? { ...u, balance: (Number(u.balance || 0) + amount) } : u);
                syncRecentTransactionsToCloud(userId).catch(error => console.warn('Admin add funds cloud sync skipped:', error));
                showNotification('Funds added successfully!');
                window.closeModal();
                if (document.getElementById('admin-users-list-page')) updateAdminUserListView();
            } catch (e) {
                console.error("Admin add funds failed:", e);
                showFriendlyError('Could not add funds. Please try again.');
            }
        };

        const showEditUserBalanceModal = (userId) => {
            const user = allUsersCache.find(u => u.id === userId);
            if (!user) return showNotification('Error: User not found.', true);
            const currentBalance = Number.isFinite(Number(user.balance)) ? Number(user.balance) : getUserAvailableBalance(user);

            const content = `
                <div class="space-y-4">
                    <p class="text-sm">Editing balance for:</p>
                    <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                        <p class="font-semibold">${user.name || 'No Name'}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${user.email}</p>
                    </div>
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Current Balance:</label>
                        <input type="text" value="${formatCurrency(currentBalance)}" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-not-allowed" readonly>
                    </div>
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">New Balance:</label>
                        <input type="number" id="edit-balance-input" step="0.01" placeholder="Enter new total balance (e.g., -50.00)" class="w-full px-4 py-2 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value="${currentBalance}">
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">This will SET the user's total wallet balance. Negative balance is allowed and future credits will recover it automatically.</p>
                </div>`;
            const actions = `
                <button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                <button id="modal-submit-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Set New Balance</button>`;

            renderModal('Edit User Balance', content, actions, 'max-w-md');

            document.getElementById('modal-submit-btn').onclick = () => {
                handleEditUserBalance(userId);
            };
        };

        const handleEditUserBalance = async (userId) => {
            const newBalanceInput = document.getElementById('edit-balance-input').value;

            if (newBalanceInput === '' || isNaN(parseFloat(newBalanceInput))) {
                return showNotification('Please enter a valid number for the new balance.', true);
            }

            const newBalance = parseFloat(newBalanceInput);

            const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);

            try {
                let transactionPayload = null;
                await runTransaction(db, async (tx) => {
                    const freshUserDoc = await tx.get(userRef);
                    if (!freshUserDoc.exists()) throw new Error('User not found!');
                    const userData = freshUserDoc.data();
                    const oldBalance = Number.isFinite(Number(userData.balance)) ? Number(userData.balance) : getUserAvailableBalance(userData);
                    const changeAmount = Number((newBalance - oldBalance).toFixed(2));
                    if (changeAmount === 0) throw new Error('NO_BALANCE_CHANGE');
                    transactionPayload = {
                        type: changeAmount > 0 ? 'credit' : 'debit',
                        amount: Math.abs(changeAmount),
                        comment: changeAmount > 0 ? 'Admin Balance Credit' : 'Admin Balance Debit',
                        timestamp: serverTimestamp(),
                        adminComment: "Manual balance adjustment",
                        transactionId: generateTransactionId(),
                        balanceBefore: oldBalance,
                        balanceAfter: newBalance,
                        status: 'completed',
                        senderName: changeAmount > 0 ? 'REVIEWS WORLD' : (userData.name || 'User'),
                        senderMobile: changeAmount > 0 ? 'Admin Wallet' : (userData.mobile || ''),
                        recipientName: changeAmount > 0 ? (userData.name || 'User') : 'REVIEWS WORLD',
                        recipientMobile: changeAmount > 0 ? (userData.mobile || '') : 'Admin Wallet',
                        recipientIsProProfile: changeAmount > 0 ? !!userData.isProProfile : true,
                        mode: changeAmount > 0 ? 'Admin Credit' : 'Admin Debit',
                        isAdminTransaction: true
                    };
                    tx.update(userRef, { balance: newBalance });
                    tx.set(doc(collection(userRef, 'transactions'), getSafeTransactionDocId(transactionPayload.transactionId)), transactionPayload, { merge: true });
                });
                recordCloudTransaction(userId, { ...transactionPayload, timestamp: Date.now() }).catch(error => {
                    console.warn('Admin balance adjustment cloud history skipped:', error);
                });

                allUsersCache = allUsersCache.map(u => u.id === userId ? { ...u, balance: newBalance } : u);
                if (currentUserData?.uid === userId) {
                    currentUserData.balance = newBalance;
                    document.getElementById('user-balance').textContent = formatCompactBalance(newBalance);
                    updateDollarBalanceDisplay(newBalance);
                    writeUserCache(userId, currentUserData);
                }

                showNotification('User balance updated successfully!', false, true);
                window.closeModal();
                if (document.getElementById('admin-users-list-page')) updateAdminUserListView();
            } catch (e) {
                if (e.message === 'NO_BALANCE_CHANGE') {
                    return showNotification("New balance is the same as the old balance.", true);
                }
                console.error("Edit balance failed:", e);
                showFriendlyError('Could not update balance. Please try again.');
            }
        };

        const handleToggleProUser = (userId, currentlyPro) => {
            const user = allUsersCache.find(u => u.id === userId);
            if (!user) return showNotification('Error: User not found.', true);

            const action = currentlyPro ? 'Remove Pro Verification' : 'Make Pro Verified';
            const content = `
                <div class="space-y-4">
                    <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                        <p class="font-semibold">${user.name || 'No Name'}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${user.email || ''}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${user.mobile || ''}</p>
                    </div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        ${currentlyPro
                    ? 'This user will go back to normal initials in transaction details.'
                    : 'This user will show the Reviews World logo and verified badge in transaction details.'}
                    </p>
                </div>`;

            renderModal(action, content,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-pro-btn" class="px-4 py-2 text-sm ${currentlyPro ? 'bg-gray-700' : 'bg-blue-600'} text-white rounded-lg">${currentlyPro ? 'Remove Pro' : 'Make Pro'}</button>`,
                'max-w-md'
            );

            document.getElementById('confirm-pro-btn').onclick = async () => {
                try {
                    const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                    await updateDoc(userRef, {
                        isProProfile: !currentlyPro,
                        proProfileUpdatedAt: serverTimestamp()
                    });
                    showNotification(currentlyPro ? 'Pro verification removed.' : 'User promoted to pro verified.');
                    window.closeModal();
                } catch (e) {
                    console.error('Toggle pro user failed:', e);
                    showNotification(`Error: ${e.message}`, true);
                }
            };
        };

        const showManageAdminWalletModal = () => {
            if (!currentUserData) return showNotification("Your admin data is not loaded yet. Please wait.", true);
            const content = `
                <div class="space-y-3 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                    <p>Current Balance: <strong>${formatCompactBalance(currentUserData.balance)}</strong></p>
                    <input type="number" id="admin-fund-amount-input" placeholder="Amount (e.g., 10000 or -50)" class="w-full px-4 py-2 bg-white dark:bg-gray-700 rounded-lg">
                    <input type="text" id="admin-fund-comment-input" placeholder="Remarks (e.g., Initial Deposit)" class="w-full px-4 py-2 bg-white dark:bg-gray-700 rounded-lg">
                </div>`;
            const actions = `
                <button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 font-semibold rounded-lg">Cancel</button>
                <button id="modal-submit-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Update My Balance</button>`;
            renderModal('Manage My Admin Wallet', content, actions);
            document.getElementById('modal-submit-btn').onclick = handleUpdateAdminWallet;
        };

        const handleUpdateAdminWallet = async () => {
            const amount = parseFloat(document.getElementById('admin-fund-amount-input').value);
            const comment = document.getElementById('admin-fund-comment-input').value.trim();
            if (isNaN(amount) || !comment) return showNotification('Invalid amount or remarks.', true);

            const adminRef = doc(db, `artifacts/${appId}/public/data/users`, ADMIN_UID);
            try {
                await runTransaction(db, async (tx) => {
                    const adminDoc = await tx.get(adminRef);
                    if (!adminDoc.exists()) throw new Error("Admin user not found!");
                    const newBalance = (adminDoc.data().balance || 0) + amount;
                    if (newBalance < 0) throw new Error("Admin balance cannot be negative.");
                    tx.update(adminRef, { balance: newBalance });
                    tx.set(doc(collection(adminRef, 'transactions')), {
                        type: amount > 0 ? 'credit' : 'debit',
                        amount: Math.abs(amount),
                        comment: comment,
                        timestamp: serverTimestamp(),
                        transactionId: generateTransactionId(),
                        status: 'completed'
                    });
                });
                showNotification('Admin balance updated successfully!');
                window.closeModal();
            } catch (e) {
                console.error("Update admin wallet failed:", e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

        const handleFlagUser = async (userId, currentlyFlagged) => {
            const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
            if (currentlyFlagged) {
                try {
                    await updateDoc(userRef, {
                        isFlagged: false,
                        isDisabled: false,
                        banReason: deleteField(),
                        banExpiry: deleteField(),
                        disabledAt: deleteField(),
                        disabledBy: deleteField()
                    });
                    allUsersCache = allUsersCache.map(u => u.id === userId ? {
                        ...u,
                        isFlagged: false,
                        isDisabled: false,
                        banReason: undefined,
                        banExpiry: undefined,
                        disabledAt: undefined,
                        disabledBy: undefined
                    } : u);
                    applyAdminUsersCache(allUsersCache);
                    updateAdminUserListView();
                    showNotification('User unflagged successfully!');
                } catch (e) {
                    console.error("Unflag user failed:", e);
                    showNotification(`Error: ${e.message}`, true);
                }
                return;
            }

            const action = currentlyFlagged ? 'Unban' : 'Ban/Suspend';
            const content = `
                <div class="space-y-4">
                    <p class="${currentlyFlagged ? 'text-blue-600' : 'text-red-600'} font-semibold">
                        ${currentlyFlagged ? 'Are you sure you want to unban this user?' : 'Are you sure you want to ban this user?'}
                    </p>
                    ${!currentlyFlagged ? `
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Reason for Ban</label>
                            <textarea id="ban-reason-input" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm" placeholder="e.g. Fraudulent activity, Suspicious transfers..."></textarea>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Duration (Days, optional)</label>
                            <input type="number" id="ban-duration-input" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm" placeholder="Leave empty for permanent">
                        </div>
                    ` : ''}
                </div>`;

            renderModal(`${action} User`, content,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-flag-btn" class="px-4 py-2 text-sm ${currentlyFlagged ? 'bg-blue-600' : 'bg-red-600'} text-white rounded-lg">Confirm ${action}</button>`,
                'max-w-md'
            );

            document.getElementById('confirm-flag-btn').onclick = async () => {
                try {
                    let updateData = { isFlagged: !currentlyFlagged };

                    if (!currentlyFlagged) {
                        const reason = document.getElementById('ban-reason-input').value.trim() || 'No reason provided';
                        const duration = parseInt(document.getElementById('ban-duration-input').value);

                        updateData.banReason = reason;
                        updateData.isDisabled = true;
                        updateData.disabledAt = serverTimestamp();
                        updateData.disabledBy = currentUser.uid;
                        if (!isNaN(duration) && duration > 0) {
                            const expiryDate = new Date();
                            expiryDate.setDate(expiryDate.getDate() + duration);
                            updateData.banExpiry = Timestamp.fromDate(expiryDate);
                        } else {
                            updateData.banExpiry = null; // Permanent
                        }

                        // Automatically cancel all pending withdrawals for this user
                        const q = query(
                            collection(db, `artifacts/${appId}/public/data/fund_requests`),
                            where("userId", "==", userId),
                            where("status", "==", "pending")
                        );
                        const snap = await getDocs(q);
                        for (const d of snap.docs) {
                            await proceedWithRequestAction(userId, d.id, 'rejected', null, null, `Account suspended: ${reason}`);
                        }
                    } else {
                        updateData.banReason = deleteField();
                        updateData.banExpiry = deleteField();
                        updateData.isDisabled = false;
                        updateData.disabledAt = deleteField();
                        updateData.disabledBy = deleteField();
                        updateData.dueLoanBlocked = deleteField();
                        updateData.dueLoanReason = deleteField();
                        updateData.dueLoanId = deleteField();
                    }

                    await updateDoc(userRef, updateData);
                    allUsersCache = allUsersCache.map(u => u.id === userId ? {
                        ...u,
                        isFlagged: !currentlyFlagged,
                        isDisabled: !currentlyFlagged ? true : false,
                        banReason: updateData.banReason,
                        banExpiry: updateData.banExpiry || null,
                        disabledAt: !currentlyFlagged ? Date.now() : undefined,
                        disabledBy: !currentlyFlagged ? currentUser.uid : undefined
                    } : u);
                    applyAdminUsersCache(allUsersCache);
                    updateAdminUserListView();
                    showNotification(`User ${currentlyFlagged ? 'unbanned' : 'banned'} successfully!`);
                    window.closeModal();
                } catch (e) {
                    console.error("Ban user failed:", e);
                    showNotification(`Error: ${e.message}`, true);
                }
            };
        };

        const handleUpdateProfile = async () => {
            const newName = document.getElementById('profile-name-input').value.trim();
            const newMobile = normalizePhoneDigits(document.getElementById('profile-mobile-input').value);
            const selectedPaymentMethod = document.getElementById('profile-payment-method').value;
            const paymentMethod = selectedPaymentMethod || normalizeProfilePaymentMethod(currentUserData);
            const isAdminProfile = currentUser?.uid === ADMIN_UID;

            if (!newName || !newMobile) {
                return showNotification('Name and Mobile are required.', true);
            }

            // Phone number validation: must be exactly 10 digits
            const phoneRegex = /^\d{10}$/;
            if (!phoneRegex.test(newMobile)) {
                return showNotification('Mobile number must be exactly 10 digits.', true);
            }
            let existingMobileUser = null;
            try {
                existingMobileUser = await findExistingUserByMobile(newMobile, currentUser?.uid);
            } catch (error) {
                console.warn('Mobile duplicate check failed:', error);
                return showNotification('Could not verify mobile number. Please try again.', true);
            }
            if (existingMobileUser) return showNotification('This mobile number is already used by another account.', true);

            let paymentDetails = getProfilePaymentDetails(paymentMethod);

            // Collect payment details based on selected method
            switch (paymentMethod) {
                case 'upi':
                    const upiId = document.getElementById('payment-upi-id')?.value.trim();
                    if (!upiId) {
                        return showNotification('UPI ID is required for UPI payments.', true);
                    }
                    paymentDetails = { upiId };
                    break;

                case 'bank':
                    const accountNumber = document.getElementById('payment-bank-account')?.value.trim();
                    const ifsc = document.getElementById('payment-ifsc')?.value.trim();
                    const bankName = document.getElementById('payment-bank-name')?.value.trim();
                    const accountName = document.getElementById('payment-account-name')?.value.trim();

                    if (!accountNumber || !ifsc || !bankName || !accountName) {
                        return showNotification('All bank details are required.', true);
                    }
                    paymentDetails = { accountNumber, ifsc, bankName, accountName };
                    break;

                case 'play_store':
                case 'amazon_gift':
                case 'flipkart_gift':
                case 'paypal':
                    const email = document.getElementById('payment-email')?.value.trim();
                    if (!email) {
                        return showNotification('Email is required for this payment method.', true);
                    }
                    paymentDetails = { email };
                    break;
            }
            const profileUpdate = {
                name: newName,
                mobile: newMobile,
                phoneNumber: newMobile,
                paymentMethod: paymentMethod,
                paymentDetails: paymentMethod ? paymentDetails : getProfilePaymentDetails(currentUserData?.paymentMethod || '')
            };
            if (paymentMethod === 'upi') {
                profileUpdate.upiId = paymentDetails.upiId || '';
            } else if (paymentMethod === 'bank') {
                profileUpdate.accountNumber = paymentDetails.accountNumber || '';
                profileUpdate.ifsc = paymentDetails.ifsc || '';
                profileUpdate.bankName = paymentDetails.bankName || '';
                profileUpdate.accountName = paymentDetails.accountName || '';
            } else if (['play_store', 'amazon_gift', 'flipkart_gift', 'paypal'].includes(paymentMethod)) {
                profileUpdate.paymentEmail = paymentDetails.email || '';
            }

            if (isAdminProfile) {
                const whatsappNumber = document.getElementById('profile-whatsapp-input')?.value.trim() || newMobile;
                if (!/^\d{10,15}$/.test(whatsappNumber)) {
                    return showNotification('WhatsApp number must be 10 to 15 digits.', true);
                }

                const websiteLinks = Array.from(document.querySelectorAll('.profile-website-input'))
                    .map(input => input.value.trim())
                    .filter(Boolean)
                    .slice(0, 3);
                const invalidLink = websiteLinks.find(link => !/^https?:\/\/.+\..+/.test(link));
                if (invalidLink) {
                    return showNotification('Website links must start with http:// or https://', true);
                }
                profileUpdate.whatsappNumber = whatsappNumber;
                profileUpdate.websiteLinks = websiteLinks.slice(0, 3);
            }

            try {
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                await updateDoc(userRef, profileUpdate);
                currentUserData = { ...(currentUserData || {}), ...profileUpdate };
                writeJsonCache(getUserCacheKey(currentUser.uid), sanitizeUserForCache(currentUserData, currentUser.uid));
                showNotification('Profile updated successfully!');
                hidePage();
            } catch (e) {
                console.error('Failed to update profile:', e);
                showNotification('Error: Could not update profile.', true);
            }
        };

        // IMPROVED: Transaction Details Popup with From/To information
        // IMPROVED: Transaction Details Popup with PhonePe Style Receipt
        const showTransactionDetails = (key, source = 'user') => {
            const item = source === 'admin-user'
                ? (adminViewedUserTransactions.find(i => i.key === key) || unifiedHistoryCache.find(i => i.key === key))
                : (unifiedHistoryCache.find(i => i.key === key) || adminViewedUserTransactions.find(i => i.key === key));
            if (!item) {
                console.error("Could not find transaction with key:", key);
                return;
            }
            const viewedUser = source === 'admin-user' ? (adminViewedUserProfile || {}) : (currentUserData || {});

            const rwLogoUrl = 'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg';
            const isReviewsWorldName = (name = '') => name.toLowerCase().includes('reviews world');
            const getInitials = (name = 'User') => {
                const parts = name.trim().split(/\s+/).filter(Boolean);
                if (!parts.length) return 'US';
                if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
                return (parts[0][0] + parts[1][0]).toUpperCase();
            };
            const verifiedBadge = getVerifiedBadge();
            const isVerifiedTransactionParty = (party = {}) =>
                !!party.appLogo ||
                isReviewsWorldName(party.name || '') ||
                /admin wallet|rw wallet|digital wallet/i.test(`${party.detail || ''} ${party.name || ''}`);
            const renderTransactionAvatar = (name, forceAppLogo = false, logoUrl = '') => logoUrl ? `
                <div class="w-10 h-10 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center shadow-inner shrink-0 border border-gray-100 dark:border-gray-600 p-1.5">
                    <img src="${logoUrl}" class="w-full h-full object-contain rounded-full" alt="${name}" loading="eager">
                </div>` : (forceAppLogo || isReviewsWorldName(name)) ? `
                <div class="shrink-0">
                    <img src="${rwLogoUrl}" class="w-10 h-10 rounded-full border-2 border-gray-100 dark:border-gray-700 shadow-sm object-cover" alt="Reviews World Logo" loading="eager" fetchpriority="high" decoding="sync">
                </div>` : `
                <div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-base shadow-inner shrink-0">
                    ${getInitials(name)}
                </div>`;
            const findUserProfile = ({ name = '', mobile = '' } = {}) => {
                const candidates = [
                    ...(viewedUser ? [viewedUser] : []),
                    ...(currentUserData ? [currentUserData] : []),
                    ...allUsersCache
                ];
                const normalizedName = name.toLowerCase();
                return candidates.find(u =>
                    (mobile && u.mobile === mobile) ||
                    (normalizedName && (u.name || '').toLowerCase() === normalizedName)
                );
            };

            const isRecharge = item.type === 'mobile_recharge';
            const isCredit = item.type !== 'debit' && item.type !== 'withdrawal' && !isRecharge && item.amount > 0;
            const dateStr = formatDate(item.timestamp);
            const displayAmount = isRecharge ? (item.chargeAmount || item.amount || 0) : Math.abs(item.amount);
            const amountStr = formatCurrency(displayAmount);

            // Format amount in words
            const amountInWords = numberToWords(displayAmount) + " Only";

            const senderName = item.senderName || (isCredit ? (item.isAdminTransaction ? 'Reviews World' : 'User') : viewedUser.name);
            const recipientName = item.recipientName || (isCredit ? viewedUser.name : 'User');
            const senderMobile = item.senderMobile || '';
            const recipientMobile = item.recipientMobile || '';
            const senderProfile = findUserProfile({ name: senderName, mobile: senderMobile });
            const recipientProfile = findUserProfile({ name: recipientName, mobile: recipientMobile });
            const senderIsPro = !!item.senderIsProProfile || !!senderProfile?.isProProfile;
            const recipientIsPro = !!item.recipientIsProProfile || !!recipientProfile?.isProProfile;
            let remarks = item.comment || (item.isAdminTransaction ? 'Payment By reviews World' : 'Money Transfer');
            const rawStatus = item.status || 'completed';
            const isWithdrawal = item.type === 'withdrawal';
            const isGiftCard = item.type === 'gift_card';
            const isRejected = rawStatus === 'rejected' || rawStatus === 'failed';
            const isPending = rawStatus === 'pending';
            const normalizedDetailType = normalizeTransactionType(item);
            if (normalizedDetailType === 'credit' && /admin\s+debit/i.test(remarks)) {
                remarks = 'Admin Balance Credit';
            }
            const isAdminCredit = (item.isAdminTransaction && isCredit) || normalizedDetailType === 'credit' && (isReviewsWorldName(remarks) || isReviewsWorldName(senderName));
            const isAdminDebit = item.isAdminTransaction && !isCredit && normalizedDetailType === 'debit';
            const giftCodeFromComment = (remarks.match(/redeemed code\s+([A-Z0-9-]+)/i) || [])[1] || '';
            const txnDisplayId = isGiftCard ? (item.giftCode || giftCodeFromComment || item.transactionId) : (item.adminTransactionId || item.transactionId);
            const methodId = item.methodId || (item.upiId ? 'upi' : item.accountNumber ? 'bank' : remarks.toLowerCase().includes('amazon') ? 'amazon_gift' : remarks.toLowerCase().includes('flipkart') ? 'flipkart_gift' : remarks.toLowerCase().includes('play') ? 'play_store' : remarks.toLowerCase().includes('paypal') ? 'paypal' : '');
            const methodName = getWithdrawalDisplayMethodName({ ...item, methodId });
            const methodDetail = getWithdrawalDetailText({ ...item, methodId });
            const detailBalanceAfter = getExplicitBalanceAfter(item) ?? item.balanceAfter;

            let statusTitle = isCredit ? 'Money Received' : 'Money Sent';
            let statusLabel = isCredit ? 'Money Received' : 'Money Sent';
            let statusPillClass = isCredit
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30';
            let statusIconClass = isCredit ? 'text-green-500' : 'text-blue-500';
            let fromParty = { label: 'From', name: isCredit ? senderName : viewedUser.name, detail: isCredit ? senderMobile : (viewedUser.mobile || ''), appLogo: isCredit ? senderIsPro : !!viewedUser?.isProProfile };
            let toParty = { label: 'To', name: isCredit ? recipientName : recipientName, detail: isCredit ? 'RW Wallet Balance' : recipientMobile, appLogo: isCredit ? recipientIsPro : recipientIsPro };
            let modeLabel = item.type === 'wallet_transfer' || item.type === 'debit' ? 'Wallet Transfer' : isAdminCredit ? 'Wallet Credit' : 'Wallet Transaction';
            let extraDetail = '';

            if (isAdminCredit) {
                fromParty = { label: 'From', name: 'REVIEWS WORLD', detail: 'Admin Wallet', appLogo: true };
                toParty = { label: 'To', name: recipientName || viewedUser.name || 'User', detail: 'RW Wallet Balance', appLogo: recipientIsPro || !!viewedUser?.isProProfile };
                modeLabel = 'Admin Credit';
            }

            if (isAdminDebit) {
                statusTitle = 'Money Debited';
                statusLabel = 'Admin Debit';
                fromParty = { label: 'From', name: viewedUser.name || senderName || 'User', detail: viewedUser.mobile || senderMobile || '', appLogo: !!viewedUser?.isProProfile || senderIsPro };
                toParty = { label: 'To', name: 'REVIEWS WORLD', detail: 'Admin Wallet', appLogo: true };
                modeLabel = 'Admin Debit';
            }

            if (isGiftCard) {
                statusTitle = 'Money Received';
                statusLabel = 'Money Received';
                fromParty = { label: 'From', name: 'REVIEWS WORLD', detail: 'Gift Card', appLogo: true };
                toParty = { label: 'To', name: recipientName || viewedUser.name || 'User', detail: 'RW Wallet Balance', appLogo: recipientIsPro || !!viewedUser?.isProProfile };
                modeLabel = 'Gift Card';
            }

            if (isWithdrawal) {
                statusTitle = isRejected ? 'Withdrawal Failed' : isPending ? 'Withdrawal Pending' : 'Money Withdrawn';
                statusLabel = isRejected ? 'Failed' : isPending ? 'Pending' : 'Withdrawal Completed';
                statusPillClass = isRejected
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30'
                    : isPending
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-100 dark:border-yellow-900/30'
                        : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30';
                statusIconClass = isRejected ? 'text-red-500' : isPending ? 'text-yellow-500' : 'text-green-500';
                fromParty = { label: 'From', name: 'Digital Wallet', detail: 'RW Wallet Balance', appLogo: true };
                toParty = { label: 'To', name: methodName, detail: methodDetail, appLogo: false, logoUrl: getWithdrawMethodLogo(methodId) };
                modeLabel = methodName;
                extraDetail = isRejected && item.rejectionReason ? `
                    <div class="bg-red-50 dark:bg-red-900/20 px-3 py-2">
                        <p class="text-[10px] font-semibold uppercase text-red-500 dark:text-red-400">Failed Reason</p>
                        <p class="text-xs text-red-700 dark:text-red-300 mt-0.5">${item.rejectionReason}</p>
                    </div>` : '';
            }
            if (isRecharge) {
                statusTitle = isRejected ? 'Recharge Failed' : isPending ? 'Recharge Pending' : 'Mobile Recharge Done';
                statusLabel = isRejected ? 'Failed' : isPending ? 'Pending' : 'Recharge Completed';
                statusPillClass = isRejected
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30'
                    : isPending
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-100 dark:border-yellow-900/30'
                        : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30';
                statusIconClass = isRejected ? 'text-red-500' : isPending ? 'text-yellow-500' : 'text-green-500';
                fromParty = { label: 'From', name: 'Digital Wallet', detail: 'RW Wallet Balance', appLogo: true };
                toParty = { label: 'Recharge For', name: item.mobileNumber || 'Mobile Number', detail: `${item.operator || ''} ${item.state ? `| ${item.state}` : ''}`.trim(), appLogo: false };
                modeLabel = 'Mobile Recharge';
                extraDetail = `
                    <div class="bg-sky-50 dark:bg-sky-900/20 px-3 py-2">
                        <p class="text-[10px] font-semibold uppercase text-sky-600 dark:text-sky-300">Plan Details</p>
                        <p class="text-xs text-sky-800 dark:text-sky-200 mt-0.5">${item.planDetails || 'N/A'}</p>
                    </div>
                    <div class="bg-green-50 dark:bg-green-900/20 px-3 py-2">
                        <p class="text-[10px] font-semibold uppercase text-green-600 dark:text-green-300">Discount</p>
                        <p class="text-xs text-green-800 dark:text-green-200 mt-0.5">Recharge ${formatCurrency(item.amount || 0)} - 1% discount ${formatCurrency(item.discount || 0)} = wallet deduction ${formatCurrency(item.chargeAmount || item.amount || 0)}</p>
                    </div>
                    ${isRejected && item.rejectionReason ? `
                        <div class="bg-red-50 dark:bg-red-900/20 px-3 py-2">
                            <p class="text-[10px] font-semibold uppercase text-red-500 dark:text-red-400">Failed Reason</p>
                            <p class="text-xs text-red-700 dark:text-red-300 mt-0.5">${item.rejectionReason}</p>
                        </div>` : ''}`;
            }
            const dateVerb = isRecharge ? (isRejected ? 'Failed' : isPending ? 'Requested' : 'Recharged') : isWithdrawal ? (isRejected ? 'Failed' : isPending ? 'Requested' : 'Withdrawn') : (isCredit ? 'Received' : 'Paid');

            const content = `
                <div class="bg-gray-50 dark:bg-gray-900 min-h-screen pb-6 overflow-x-hidden">
                    <div class="bg-white dark:bg-gray-800 px-4 py-3 flex items-center border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
                        <button onclick="window.closeModal()" class="p-2 -ml-2 mr-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        </button>
                        <h2 class="text-lg font-semibold">${statusTitle}</h2>
                    </div>

                    <div class="p-3 max-w-md mx-auto">
                        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4 ring-1 ring-gray-50 dark:ring-gray-700/40">
                            <!-- Amount Section -->
                            <div class="space-y-0.5">
                                <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">Amount</p>
                                <div class="flex items-center gap-2">
                                    <span class="text-2xl font-bold">${amountStr}</span>
                                    <svg class="w-5 h-5 ${statusIconClass} fill-current" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                    </svg>
                                </div>
                                <p class="text-[10px] text-gray-400 dark:text-gray-500 italic">${amountInWords}</p>
                            </div>

                            <!-- Remarks Section -->
                            <div class="flex items-start gap-2">
                                <div class="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-2xl flex items-center gap-2 max-w-full border border-gray-200 dark:border-gray-600">
                                    <span class="text-xs font-medium truncate">${remarks}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                </div>
                            </div>

                            <div class="flex items-center gap-2">
                                <div class="flex items-center gap-1.5 ${statusPillClass} px-3 py-1 rounded-full text-xs font-medium border">
                                    <span class="text-sm">💵</span>
                                    <span>${statusLabel}</span>
                                </div>
                            </div>

                            <hr class="border-gray-200 dark:border-gray-700">

                            <!-- Transfer Flow -->
                            <div class="rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                                <!-- Recipient/Sender -->
                                <div class="flex justify-between items-center gap-3 p-3 bg-gray-50/40 dark:bg-gray-900/20">
                                    <div class="space-y-0.5 min-w-0">
                                        <p class="text-xs text-gray-500 dark:text-gray-400">${fromParty.label}</p>
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <span class="text-base font-bold truncate">${fromParty.name}</span>
                                            ${isVerifiedTransactionParty(fromParty) ? verifiedBadge : ''}
                                        </div>
                                        ${fromParty.detail ? `<p class="text-xs text-gray-400 font-mono truncate">${fromParty.detail}</p>` : ''}
                                    </div>
                                    ${renderTransactionAvatar(fromParty.name, fromParty.appLogo, fromParty.logoUrl)}
                                </div>

                                <!-- My Account -->
                                <div class="flex justify-between items-center gap-3 p-3">
                                    <div class="space-y-0.5 min-w-0">
                                        <p class="text-xs text-gray-500 dark:text-gray-400">${toParty.label}</p>
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <span class="text-base font-bold truncate">${toParty.name}</span>
                                            ${isVerifiedTransactionParty(toParty) ? verifiedBadge : ''}
                                        </div>
                                        ${toParty.detail ? `<p class="text-xs text-gray-400 font-mono truncate">${toParty.detail}</p>` : ''}
                                    </div>
                                    ${renderTransactionAvatar(toParty.name, toParty.appLogo, toParty.logoUrl)}
                                </div>
                            </div>

                            <div class="rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden text-xs">
                                <div class="flex justify-between gap-3 px-3 py-2">
                                    <span class="text-gray-500 dark:text-gray-400">Mode</span>
                                    <span class="font-semibold text-right">${modeLabel}</span>
                                </div>
                                <div class="flex justify-between gap-3 px-3 py-2">
                                    <span class="text-gray-500 dark:text-gray-400">Status</span>
                                    <span class="font-semibold text-right">${statusLabel}</span>
                                </div>
                                ${Number.isFinite(Number(detailBalanceAfter)) ? `
                                    <div class="flex justify-between gap-3 px-3 py-2">
                                        <span class="text-gray-500 dark:text-gray-400">Remaining Balance</span>
                                        <span class="font-semibold text-right">${formatCurrency(detailBalanceAfter)}</span>
                                    </div>
                                ` : ''}
                                ${item.adminTransactionId ? `
                                    <div class="flex justify-between gap-3 px-3 py-2">
                                        <span class="text-gray-500 dark:text-gray-400">Processed By</span>
                                        <span class="font-semibold text-right inline-flex items-center justify-end gap-1.5">REVIEWS WORLD ${verifiedBadge}</span>
                                    </div>
                                ` : ''}
                                ${extraDetail}
                            </div>

                            <div class="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <p class="text-[10px] text-gray-400 dark:text-gray-500">${dateVerb} on ${dateStr}</p>
                                ${txnDisplayId ? `
                                    <div class="flex items-center gap-2 min-w-0">
                                        <p class="text-[10px] text-gray-400 dark:text-gray-500 truncate">Txn ID: ${txnDisplayId}</p>
                                        <button data-action="copy-text" data-text="${txnDisplayId}" class="text-blue-500 text-[10px] font-bold hover:underline shrink-0">Copy</button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- RW Wallet Watermark Footer -->
                        <div class="mt-3 mb-3 flex flex-col items-center justify-center space-y-1.5 opacity-35 select-none">
                             <div class="flex items-center gap-2 grayscale">
                                <img src="https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg" class="w-6 h-6 rounded-full" alt="RW">
                                <span class="text-[10px] font-black tracking-widest uppercase">RW WALLET SECURE</span>
                             </div>
                             <div class="flex items-center gap-4 grayscale opacity-70">
                                <span class="text-[8px] font-bold">REVIEWS WORLD</span>
                                <span class="text-[8px]">|</span>
                                <span class="text-[8px] font-bold">VERIFIED PAYMENT</span>
                             </div>
                        </div>
                    </div>
                </div>`;

            // Render as a full-screen overlay instead of a standard modal.
            const overlay = document.createElement('div');
            overlay.id = 'transaction-overlay';
            overlay.className = 'fixed inset-0 z-[100] bg-gray-50 dark:bg-gray-900';
            overlay.innerHTML = content;
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';

            // Override window.closeModal for this overlay
            const originalCloseModal = window.closeModal;
            window.closeModal = () => {
                overlay.remove();
                document.body.style.overflow = '';
                window.closeModal = originalCloseModal;
            };
        };

        // Utility: Number to Words
        const numberToWords = (num) => {
            const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
            const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

            if ((num = num.toString()).length > 9) return 'Amount too large';
            const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!n) return '';
            let str = '';
            str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
            str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
            str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
            str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
            str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Rupees ' : '';
            return str.trim();
        };

        const switchTab = (tabId) => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.setAttribute('aria-selected', btn.dataset.tab === tabId));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            const panel = document.getElementById(tabId);
            if (panel) panel.classList.remove('hidden');
            if (tabId === 'user-panel') updateDollarBalanceDisplay(currentUserData?.balance || 0);
        };

        // --- MASTER EVENT LISTENER (for data-action buttons) ---
        document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const { action, id, userid, requestid, upi, username, text, flagged, pro, taskid, adid, index } = target.dataset;
            e.stopPropagation();

            switch (action) {
                case 'copy-text':
                    handleCopyText(text, target);
                    break;

                case 'flag-user':
                    handleFlagUser(userid, flagged === 'true');
                    break;

                case 'delete-gift-code':
                    handleDeleteGiftCode(id);
                    break;

                case 'process-investment-interest':
                    processPartnerInterest(target.dataset.investmentid)
                        .then(() => showNotification('Partner interest processed.'))
                        .then(() => refreshAdminDashboardCaches())
                        .then(renderAdminInvestmentsPage)
                        .catch(e => showNotification(`Error: ${e.message}`, true));
                    break;

                case 'view-admin-investment-user':
                    showAdminInvestmentUserDetailsPage(userid);
                    break;

                case 'download-admin-investment-invoice': {
                    const inv = allInvestmentsCache.find(i => i.id === target.dataset.investmentid);
                    if (inv) downloadInvestmentInvoice(inv);
                    break;
                }

                case 'download-investment-invoice': {
                    const inv = allInvestmentsCache.find(i => i.id === target.dataset.investmentid);
                    if (inv) downloadInvestmentInvoice(inv);
                    break;
                }

                case 'admin-loan-auto-debit':
                    processDueLoanRepayment(target.dataset.loanid)
                        .then(() => showNotification('Loan amount auto debited.'))
                        .then(() => refreshAdminDashboardCaches())
                        .then(renderAdminLoanPage)
                        .catch(e => showNotification(`Error: ${e.message}`, true));
                    break;

                case 'user-view-loan-detail':
                    showUserLoanDetailModal(target.dataset.loanid).catch(error => {
                        console.error('Loan details open failed:', error);
                        showNotification('Loan details could not open. Please try again.', true);
                    });
                    break;

                case 'view-admin-loan-user':
                    showAdminLoanUserDetailsPage(userid);
                    break;

                case 'admin-view-loan-detail':
                    showAdminLoanDetailModal(target.dataset.loanid);
                    break;

                case 'admin-add-loan-limit':
                    showAdminAddLoanLimitModal(userid);
                    break;

                case 'preview-loan-doc':
                    showLoanDocumentPreviewModal(requestid, target.dataset.doctype);
                    break;

                case 'mark-as-paid':
                    handleRequestAction(userid, requestid, 'completed');
                    break;

                case 'reject-request':
                    handleRequestAction(userid, requestid, 'rejected');
                    break;

                case 'complete-recharge':
                    handleRechargeAction(userid, requestid, 'completed');
                    break;

                case 'reject-recharge':
                    handleRechargeAction(userid, requestid, 'rejected');
                    break;

                case 'approve-loan-request':
                    showApproveLoanRequestModal(userid, requestid);
                    break;

                case 'reject-loan-request':
                    showRejectLoanRequestConfirmModal(userid, requestid);
                    break;

                case 'give-loan-chance':
                    showGiveLoanChanceConfirmModal(userid, requestid);
                    break;

                case 'copy-upi':
                    handleCopyUpi(upi, target);
                    break;

                case 'edit-user-balance':
                    showEditUserBalanceModal(userid);
                    break;

                case 'view-user-dashboard':
                    showAdminUserDashboardPage(userid);
                    break;

                case 'toggle-pro-user':
                    handleToggleProUser(userid, pro === 'true');
                    break;

                case 'delete-user':
                    handleDeleteUser(userid, username);
                    break;

                case 'approve-signup-user':
                    handleSignupApprovalAction(userid, 'approve');
                    break;

                case 'cancel-signup-user':
                    handleSignupApprovalAction(userid, 'cancel');
                    break;

                case 'edit-admin-task':
                    editAdminTask(taskid);
                    break;

                case 'toggle-admin-task-status':
                    handleToggleAdminTaskStatus(taskid);
                    break;

                case 'delete-admin-task':
                    handleDeleteAdminTask(taskid);
                    break;

                case 'task-coming-soon':
                    showNotification('Coming soon.');
                    break;

                case 'open-task-ads-page':
                    showTaskFeatureComingSoonPage('ads');
                    break;

                case 'open-task-bonus-page':
                    showTaskFeatureComingSoonPage('bonus');
                    break;

                case 'edit-admin-ad':
                    editAdminAd(adid);
                    break;

                case 'delete-admin-ad':
                    handleDeleteAdminAd(adid);
                    break;

                case 'home-ad-dot':
                    homeAdsActiveIndex = Number(index || 0);
                    renderHomeAdsCarousel();
                    break;

                case 'open-user-task': {
                    showUserTaskDetailsPage(taskid);
                    break;
                }
            }
        });

        document.body.addEventListener('click', (e) => {
            if (!e.target.closest('#loan-btn')) return;
            e.preventDefault();
            openLoanQuickAction();
        });

        document.body.addEventListener('change', (e) => {
            const target = e.target.closest('[data-action="set-gift-card-type"]');
            if (!target) return;
            const { userid, requestid } = target.dataset;
            handleSetWithdrawalGiftCardType(userid, requestid, target.value);
        });

        // --- STATIC EVENT LISTENERS ---

        document.getElementById('auth-form').addEventListener('submit', handleAuth);
        document.getElementById('auth-toggle').addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode(); });
        document.getElementById('password-toggle').addEventListener('click', () => {
            const passInput = document.getElementById('password');
            const isOpen = passInput.type === 'password';
            passInput.type = isOpen ? 'text' : 'password';
            document.getElementById('eye-open').classList.toggle('hidden', isOpen);
            document.getElementById('eye-closed').classList.toggle('hidden', !isOpen);
        });

        document.getElementById('tabs-container').addEventListener('click', (e) => {
            if (e.target.matches('.tab-button')) {
                const tabId = e.target.dataset.tab;
                currentMainSection = tabId === 'admin-panel' ? 'admin' : 'home';
                switchTab(tabId);
                setBottomNavActive(tabId === 'admin-panel' ? 'bottom-admin-btn' : 'bottom-home-btn');
            }
        });
        document.getElementById('bottom-home-btn').addEventListener('click', () => {
            showHomeMainPage();
        });
        document.getElementById('bottom-admin-btn').addEventListener('click', showAdminMainPage);
        document.getElementById('bottom-task-btn').addEventListener('click', showUserTaskPage);
        document.getElementById('bottom-help-btn').addEventListener('click', showHelpSupportPage);
        document.getElementById('bottom-settings-btn').addEventListener('click', showSettingsPage);
        document.getElementById('notification-header-btn').addEventListener('click', showNotificationsPage);

        document.getElementById('manage-admin-wallet-btn').addEventListener('click', showManageAdminWalletModal);
        document.getElementById('admin-manage-tasks-btn')?.addEventListener('click', showAdminTaskPage);
        document.getElementById('admin-manage-tasks-secondary-btn')?.addEventListener('click', showAdminTaskPage);

        const openAdminQuickAction = (handler) => {
            currentMainSection = 'admin';
            setBottomNavActive('bottom-admin-btn');
            handler();
        };

        const openUserQuickAction = (handler) => {
            currentMainSection = 'home';
            setBottomNavActive('bottom-home-btn');
            try {
                const result = handler();
                if (result?.catch) {
                    result.catch(error => {
                        console.error('User quick action failed:', error);
                        showNotification('This page could not open. Please try again.', true);
                    });
                }
                return result;
            } catch (error) {
                console.error('User quick action failed:', error);
                showNotification('This page could not open. Please try again.', true);
                return null;
            }
        };

        document.getElementById('wallet-history-action-btn')?.addEventListener('click', () => openUserQuickAction(showAllTransactionsPage));

        let loanPageOpening = false;
        const openLoanQuickAction = () => {
            if (loanPageOpening) return;
            loanPageOpening = true;
            Promise.resolve(openUserQuickAction(showLoanPage)).finally(() => {
                setTimeout(() => {
                    loanPageOpening = false;
                }, 250);
            });
        };

        document.getElementById('analytics-total-users-card').addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('all')));
        document.getElementById('analytics-new-members-card').addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('new')));
        document.getElementById('analytics-pending-withdrawals-card').addEventListener('click', () => openAdminQuickAction(showAdminWithdrawalsPage));
        document.getElementById('analytics-minus-balance-card').addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('minus_balance')));
        document.getElementById('analytics-total-funds-card').addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('all')));
        document.getElementById('analytics-gift-cards-card').addEventListener('click', () => openAdminQuickAction(showAdminGiftCodesPage));

        // Admin panel quick action buttons
        document.getElementById('admin-withdrawals-btn').addEventListener('click', () => openAdminQuickAction(showAdminWithdrawalsPage));
        document.getElementById('admin-users-btn').addEventListener('click', () => openAdminQuickAction(showAdminUsersPage));
        document.getElementById('admin-signup-approvals-btn').addEventListener('click', () => openAdminQuickAction(showAdminSignupApprovalsPage));
        document.getElementById('admin-gift-codes-btn').addEventListener('click', () => openAdminQuickAction(showAdminGiftCodesPage));
        document.getElementById('admin-withdrawal-history-btn').addEventListener('click', () => openAdminQuickAction(showWithdrawalHistoryPage));
        document.getElementById('admin-withdraw-settings-btn').addEventListener('click', () => openAdminQuickAction(showAdminWithdrawSettingsModal));
        document.getElementById('admin-maintenance-btn')?.addEventListener('click', () => openAdminQuickAction(showMaintenanceSettingsPage));
        document.getElementById('admin-whats-new-btn')?.addEventListener('click', () => openAdminQuickAction(showWhatsNewSettingsPage));
        document.getElementById('admin-recharge-requests-btn').addEventListener('click', () => openAdminQuickAction(showAdminRechargeRequestsPage));
        document.getElementById('admin-loans-btn').addEventListener('click', () => openAdminQuickAction(showAdminLoanPage));
        document.getElementById('admin-investments-btn').addEventListener('click', () => openAdminQuickAction(showAdminInvestmentsPage));
        document.getElementById('admin-chats-btn').addEventListener('click', () => openAdminQuickAction(showAdminChatsPage));
        document.getElementById('admin-tasks-btn').addEventListener('click', showAdminTaskPage);
        document.getElementById('admin-ads-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminAdsPage));

        // Withdraw Fund Button - Now opens full page
        document.getElementById('withdraw-fund-btn').addEventListener('click', () => openUserQuickAction(showWithdrawPage));

        // Gift Card Button
        document.getElementById('redeem-gift-card-btn').addEventListener('click', () => {
            renderModal('Redeem Gift Card',
                `<input type="text" id="gift-code-input" placeholder="Enter your code" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="modal-submit-btn" class="px-4 py-2 text-sm bg-green-500 text-white rounded-lg">Redeem</button>`);
            document.getElementById('modal-submit-btn').onclick = handleRedeem;
        });

        // Pay to Wallet Button - Now opens full page
        document.getElementById('pay-to-wallet-btn').addEventListener('click', () => openUserQuickAction(showPayToWalletPage));
        document.getElementById('mobile-recharge-btn').addEventListener('click', () => openUserQuickAction(showMobileRechargePage));
        document.getElementById('loan-btn').addEventListener('click', openLoanQuickAction);
        document.getElementById('partner-btn').addEventListener('click', () => openUserQuickAction(showPartnerPage));

        // Preload logo images to prevent loading flicker
        const preloadLogoImages = () => {
            const logoUrls = [
                'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg',
                'https://cdn-icons-png.flaticon.com/512/1827/1827370.png',
                CHATBOT_ICON_URL
            ];

            logoUrls.forEach((logoUrl) => {
                const img = new Image();
                img.decoding = 'async';
                img.loading = 'eager';
                img.fetchPriority = 'high';
                img.src = logoUrl;
                img.onload = function () {
                    document.querySelectorAll(`img[src="${logoUrl}"]`).forEach(logo => {
                        logo.classList.add('loaded');
                        logo.style.opacity = '1';
                    });
                };
            });
        };

        // Initialize the app when DOM is loaded
        document.addEventListener('DOMContentLoaded', function () {
            console.log('DOM loaded, initializing app...');

            // Preload logo images
            preloadLogoImages();
            // Check if user was previously logged in
            const savedUser = localStorage.getItem('lastLoggedInUser');
            if (savedUser) {
                console.log('Found saved user, waiting for Firebase auth...');
                // Firebase will handle auto-login via onAuthStateChanged
            }
        });

        // Current version of the file the user is holding
        const CURRENT_VERSION_CODE = 2;

        const checkForUpdates = async () => {
            // 1. Create a document in Firestore at 'settings/app_config' 
            // with a field named 'latest_version_code'
            const configDoc = await getDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'));

            if (configDoc.exists()) {
                const latestVersion = configDoc.data().latest_version_code;
                const downloadUrl = configDoc.data().update_url;

                // 2. Compare versions
                if (latestVersion > CURRENT_VERSION_CODE) {
                    renderModal('Update Available',
                        `<p class="text-sm">A new version of the app is available. Please download it to continue using all features.</p>`,
                        `<a href="${downloadUrl}" class="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Download Update</a>`,
                        'max-w-sm', true
                    );
                }
            }
        };
        // ========== NEW FEATURES ONLY - ADD THIS AT THE END ==========

        // --- APP VERSION ---
        const APP_VERSION = "2.0";

        // --- GLOBAL VARIABLES ---
        let pendingRequests = new Set();
        let minWithdrawalAmount = 50;
        let minWithdrawalUpi = 50;
        let minWithdrawalBank = 1000;
        let minWithdrawalRedeem = 100;
        let maxWithdrawalPerDay = 5000;
        let maxPendingWithdrawalsPerUser = 1;
        let withdrawalSettingsLoadedAt = 0;
        let withdrawalSettingsLoadPromise = null;

        const setNumberSetting = (value, fallback) => {
            const numberValue = Number(value);
            return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
        };

        const applyWithdrawalConfig = (config = {}) => {
            minWithdrawalUpi = setNumberSetting(config.min_withdrawal_upi, minWithdrawalUpi);
            minWithdrawalBank = setNumberSetting(config.min_withdrawal_bank, minWithdrawalBank);
            minWithdrawalRedeem = setNumberSetting(config.min_withdrawal_redeem, minWithdrawalRedeem);
            maxWithdrawalPerDay = setNumberSetting(config.max_withdrawal_per_day, maxWithdrawalPerDay);
            maxPendingWithdrawalsPerUser = Math.max(1, setNumberSetting(config.max_pending_withdrawals, maxPendingWithdrawalsPerUser));
            minWithdrawalAmount = setNumberSetting(
                config.min_withdrawal_amount,
                Math.min(minWithdrawalUpi, minWithdrawalBank, minWithdrawalRedeem)
            );
            updateMinWithdrawalInfo();
            const amountInput = document.getElementById('withdraw-amount-input');
            if (amountInput && activeWithdrawMethod) {
                const minForMethod = getMinWithdrawalForMethod(activeWithdrawMethod);
                amountInput.min = String(minForMethod);
                const helper = amountInput.parentElement?.querySelector('p');
                if (helper) helper.textContent = `Minimum withdrawal: ₹${minForMethod}`;
            }
        };

        const applyAppConfig = (config = {}) => {
            appConfigCache = rememberAppConfig({ ...(appConfigCache || {}), ...(config || {}) });
            applyWithdrawalConfig(appConfigCache);
            applyMaintenanceMode();
            showWhatsNewPopupIfNeeded();
        };

        const loadWithdrawalSettingsOnce = async (force = false) => {
            const now = Date.now();
            if (!force && withdrawalSettingsLoadedAt && now - withdrawalSettingsLoadedAt < 30000) return;
            if (withdrawalSettingsLoadPromise && !force) return withdrawalSettingsLoadPromise;

            withdrawalSettingsLoadPromise = getDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'))
                .then(snapshot => {
                    if (snapshot.exists()) applyAppConfig(snapshot.data());
                    withdrawalSettingsLoadedAt = Date.now();
                })
                .catch(error => {
                    console.error('Withdrawal settings load failed:', error);
                })
                .finally(() => {
                    withdrawalSettingsLoadPromise = null;
                });

            return withdrawalSettingsLoadPromise;
        };

        const getMinWithdrawalForMethod = (method) => {
            if (method === 'upi') return minWithdrawalUpi;
            if (method === 'bank') return minWithdrawalBank;
            return minWithdrawalRedeem;
        };

        // --- DUPLICATE PAYMENT PREVENTION ---
        const preventDuplicateRequest = (requestType, timeout = 3000) => {
            const requestId = `${requestType}-${currentUser?.uid}-${Date.now()}`;

            if (pendingRequests.has(requestType)) {
                showNotification('Please wait, processing previous request...', true);
                return false;
            }

            pendingRequests.add(requestType);
            setTimeout(() => pendingRequests.delete(requestType), timeout);
            return true;
        };

        // --- MIN WITHDRAWAL AMOUNT UPDATE ---
        const updateMinWithdrawalInfo = () => {
            const infoElement = document.getElementById('min-withdrawal-info');
            if (infoElement) {
                infoElement.textContent = `Min. withdrawal: ₹${minWithdrawalAmount}`;
            }
        };

        // Add min withdrawal info to user panel HTML (if not already there)
        // In your user-panel section, add this line:
        // <p class="text-xs text-gray-500 dark:text-gray-400 mt-1" id="min-withdrawal-info">Min. withdrawal: ₹50</p>

        // --- FORGOT PASSWORD FUNCTIONALITY ---
        const showForgotPasswordModal = () => {
            document.getElementById('forgot-password-modal').classList.remove('hidden');
            setTimeout(() => {
                const modal = document.getElementById('forgot-password-modal').querySelector('.animate-modal-in');
                if (modal) {
                    modal.style.opacity = '1';
                    modal.style.scale = '1';
                }
            }, 10);
        };

        window.closeForgotPasswordModal = () => {
            document.getElementById('forgot-password-modal').classList.add('hidden');
            document.getElementById('reset-email-input').value = '';
            document.getElementById('reset-error').textContent = '';
        };

        const handleForgotPassword = async () => {
            const email = document.getElementById('reset-email-input').value.trim();
            const errorElement = document.getElementById('reset-error');

            if (!email) {
                errorElement.textContent = 'Please enter your email address';
                return;
            }

            try {
                await sendPasswordResetEmail(auth, email);
                showNotification('Password reset link has been sent to your email. Please check your inbox and spam folder.');
                window.closeForgotPasswordModal();
            } catch (error) {
                errorElement.textContent = error.message;
            }
        };

        // --- PASSWORD RESET PAGE ACTIONS ---
        document.addEventListener('click', (e) => {
            if (e.target.closest('#forgot-password-link')) {
                e.preventDefault();
                showForgotPasswordModal();
            }

            if (e.target.closest('#send-reset-btn')) {
                e.preventDefault();
                handleForgotPassword();
            }
        });

        // --- UPDATE EXISTING FUNCTIONS ---

        // 1. Update handleWithdrawRequest to prevent duplicates
        const originalHandleWithdrawRequest = handleWithdrawRequest;
        handleWithdrawRequest = async function (amount, method, methodName) {
            // Prevent duplicate request
            if (!preventDuplicateRequest('withdrawal')) {
                return;
            }

            try {
                await loadWithdrawalSettingsOnce();
                // Check minimum withdrawal
                const minForMethod = getMinWithdrawalForMethod(method);
                if (amount < minForMethod) {
                    showNotification(`Minimum withdrawal for ${methodName} is ₹${minForMethod}`, true);
                    return;
                }

                // Call original function
                await originalHandleWithdrawRequest.call(this, amount, method, methodName);
            } finally {
                pendingRequests.delete('withdrawal');
            }
        };

        // --- CHECK APP VERSION (OPTIONAL) ---
        const checkAppVersion = async () => {
            try {
                const versionDoc = await getDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'));
                if (versionDoc.exists()) {
                    const config = versionDoc.data();

                    applyAppConfig(config);
                    withdrawalSettingsLoadedAt = Date.now();

                    // Check for updates (optional)
                    if (config.latest_version && config.latest_version !== APP_VERSION) {
                        console.log(`Update available: ${config.latest_version}`);
                    }
                }
            } catch (error) {
                console.log("Version check error:", error);
            }
        };

        const startWithdrawalSettingsListener = () => {
            onSnapshot(doc(db, `artifacts/${appId}/settings`, 'app_config'), (snapshot) => {
                if (!snapshot.exists()) return;
                applyAppConfig(snapshot.data());
                withdrawalSettingsLoadedAt = Date.now();
            }, (error) => console.error('Withdrawal settings listener failed:', error));
        };

        // Check version on load
        checkAppVersion();
        startWithdrawalSettingsListener();
    
