// Entry Point: src/main.js
// Imports all modular components and pages in sequence

import './core/globals.js';
import './utils/ui-utils.js';
import './utils/ocrService.js';
import './pages/auth.js';
import './pages/user/dashboard.js';
import './pages/user/user-tasks.js';
import './pages/user/recharge.js';
import './pages/user/withdraw.js';
import './pages/user/loan.js';
import './pages/user/partner.js';
import './pages/user/support.js';
import './pages/user/giftcard.js';
import './pages/user/notifications.js';
import './pages/user/profile.js';
import './pages/subadmin/subadmin-dashboard.js';
import './pages/subadmin/subadmin-tasks.js';
import './pages/subadmin/subadmin-submissions.js';
import './pages/subadmin/subadmin-users.js';
import './pages/subadmin/subadmin-recharges.js';
import './pages/subadmin/subadmin-withdrawals.js';
import './pages/subadmin/subadmin-chats.js';
import './pages/subadmin/subadmin-lists.js';
import './pages/subadmin/subadmin-notifications.js';
import './pages/subadmin/subadmin-manage-settings.js';
import './pages/owner/owner-manage-admins.js';
import './pages/owner/owner-settlements.js';
import './pages/owner/owner-audit.js';
import './core/firebase.js';

// Setup Event listeners and routing at DOM load
applyTheme(initialTheme);

// Instant Asset Preloader for Referral and Profile Banners (Anti-Flicker Dual-Cache Ready)
(() => {
    const criticalImages = [
        '/assets/images/logo_192.png',
        '/assets/images/logo_512.png',
        '/assets/images/profile_card_bg.png',
        '/assets/images/referral_banner.webp',
        '/assets/images/referral_howitworks_cards.webp',
        '/assets/images/referral_banner.png',
        '/assets/images/referral_howitworks_cards.png',
        '/assets/images/notification_bell.png',
        '/assets/images/whats_new_megaphone.png',
        '/assets/images/withdraw_confirm_bg.png',
        '/assets/images/withdraw_upi.png',
        '/assets/images/withdraw_bank.png',
        '/assets/images/withdraw_crypto.png',
        '/assets/images/withdraw_amazon.png',
        '/assets/images/withdraw_playstore.png',
        '/assets/images/withdraw_flipkart.png',
        '/assets/images/withdraw_paypal.png'
    ];
    const MARKER_LS = 'rw_critical_images_loaded_v1';
    const MARKER_SS = 'rw_critical_images_loaded_ss_v1';
    try {
        const alreadyReady = localStorage.getItem(MARKER_LS) === '1' || sessionStorage.getItem(MARKER_SS) === '1';
        criticalImages.forEach(src => {
            const img = new Image();
            img.decoding = 'sync';
            img.fetchPriority = 'high';
            img.onload = img.onerror = () => {
                try {
                    localStorage.setItem(MARKER_LS, '1');
                    sessionStorage.setItem(MARKER_SS, '1');
                } catch (_) {}
            };
            img.src = src;
        });
        if (alreadyReady) {
            try {
                localStorage.setItem(MARKER_LS, '1');
                sessionStorage.setItem(MARKER_SS, '1');
            } catch (_) {}
        }
    } catch (_) {}
})();

const syncBottomNavFromCache = () => {
    try {
        const cachedRole = (localStorage.getItem('user_role') || '').toLowerCase();
        const isAdminUser = cachedRole === 'admin' || cachedRole === 'subadmin' || cachedRole === 'owner' || (window.checkIsUserAdmin ? window.checkIsUserAdmin() : false);
        const adminBtn = document.getElementById('bottom-admin-btn');
        const helpBtn = document.getElementById('bottom-help-btn');
        if (isAdminUser) {
            if (adminBtn) { adminBtn.hidden = false; adminBtn.classList.remove('hidden'); }
            if (helpBtn) { helpBtn.hidden = true; helpBtn.classList.add('hidden'); }
        } else {
            if (adminBtn) { adminBtn.hidden = true; adminBtn.classList.add('hidden'); }
            if (helpBtn) { helpBtn.hidden = false; helpBtn.classList.remove('hidden'); }
        }
    } catch (e) {}
};
syncBottomNavFromCache();

// Always default to Task page on initial boot/refresh
try {
    localStorage.removeItem('last_active_task_id');
    localStorage.removeItem('last_active_task_data');
    localStorage.setItem('last_active_section', 'task');
} catch (e) {
    console.warn('Boot check failed:', e);
}

setPersistence(auth, browserLocalPersistence).catch(error => {
            console.warn('Could not enable local auth persistence:', error);
        });

try {
            messaging = getMessaging(app);
        } catch (e) {
            console.warn("Firebase Messaging not initialized on client:", e);
        }

try {
            setLogLevel('error');
        } catch (e) {
            console.warn("Could not set Firebase log level:", e);
        }

loadAndCropAvatars();

window.getProfileAvatarUrl = getProfileAvatarUrl;

window.closeNotification = closeNotification;

installGlobalKeyboardLift();

window.closeSlideMenu = closeSlideMenu;

onAuthStateChanged(auth, async (user) => {
            console.log("Auth state changed, user:", user ? user.uid : 'null');

            // ================================================================
            // OneSignal login/logout sync — executes IMMEDIATELY on auth change
            // Uses the safe window.__rwOneSignalLogin / __rwOneSignalLogout
            // helpers that queue calls via window.OneSignalDeferred even if
            // the OneSignal SDK hasn't finished loading yet.
            // ================================================================
            try {
                if (user && user.uid) {
                    const uid = String(user.uid).trim();
                    if (uid) {
                        console.log('[main.js] Fire auth → OneSignal login queued:', uid.slice(0, 8) + '...');
                        window.__rwOneSignalLogin && window.__rwOneSignalLogin(uid);
                    }
                } else {
                    console.log('[main.js] No user → OneSignal logout queued');
                    window.__rwOneSignalLogout && window.__rwOneSignalLogout();
                }
            } catch (osErr) {
                console.warn('[main.js] OneSignal login/logout sync error (non-fatal):', osErr);
            }

            localStorage.setItem('last_active_section', 'task');
            const pageContainerAtAuth = document.getElementById('page-container');
            const mainContentAtAuth = document.getElementById('main-content');
            const dashboardAtAuth = document.getElementById('dashboard-content');
            const lastActiveTaskId = localStorage.getItem('last_active_task_id');
            const lastActiveTaskData = localStorage.getItem('last_active_task_data');
            const forceRecoverTask = !!(user && lastActiveTaskId && lastActiveTaskData);

            const shouldPreserveOpenPage = forceRecoverTask || !!(
                user &&
                pageContainerAtAuth &&
                !pageContainerAtAuth.classList.contains('hidden') &&
                pageContainerAtAuth.innerHTML.trim()
            );
            const lastActiveSection = localStorage.getItem('last_active_section') || 'task';
            const shouldPreserveHydratedDashboard = lastActiveSection === 'home' && !!(
                user &&
                !shouldPreserveOpenPage &&
                mainContentAtAuth &&
                dashboardAtAuth &&
                !mainContentAtAuth.classList.contains('hidden') &&
                !dashboardAtAuth.classList.contains('hidden')
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
            adminLoanRequestsLoaded = false;
            allLoansCache = [];
            allInvestmentsCache = [];
            try {
                const cached = localStorage.getItem('all_tasks_cache');
                allTasksCache = cached ? JSON.parse(cached) : [];
            } catch (e) {
                allTasksCache = [];
            }
            if (forceRecoverTask) {
                try {
                    const restoredTask = JSON.parse(lastActiveTaskData);
                    if (restoredTask && restoredTask.id === lastActiveTaskId) {
                        if (!allTasksCache.find(t => t.id === restoredTask.id)) {
                            allTasksCache.push(restoredTask);
                        }
                    }
                } catch (e) {
                    console.warn('Restoring task cache failed:', e);
                }
            }
            userTaskSubmissionIds = new Set();
            userTaskTodaySubmissionIds = new Set();
            userTaskParticipationLoadedFor = '';
            userTaskHistoryCache = [];
            userTaskHistoryLoading = false;
            activeTaskReservation = null;
            if (activeTaskReservationTimer) {
                clearInterval(activeTaskReservationTimer);
                activeTaskReservationTimer = null;
            }
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
            pushNotificationsInitialized = false;
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
                // Impersonation support for Owner
                const isImpersonating = !!localStorage.getItem('impersonated_sub_admin_uid');
                if (isImpersonating) {
                    const impUid = localStorage.getItem('impersonated_sub_admin_uid');
                    const impEmail = localStorage.getItem('impersonated_sub_admin_email');
                    const impToken = localStorage.getItem('impersonated_sub_admin_token');
                    const impUserData = JSON.parse(localStorage.getItem('impersonated_sub_admin_data') || '{}');

                    currentUser = {
                        uid: impUid,
                        email: impEmail,
                        getIdToken: async () => impToken,
                        getIdTokenResult: async () => ({ claims: { role: 'admin' } })
                    };
                    currentUserData = { ...impUserData, ...currentUserData };
                    backendAuthToken = impToken;
                    window.currentUser = currentUser;
                    window.currentUserData = currentUserData;

                    const switchBtn = document.getElementById('impersonation-switch-btn');
                    if (switchBtn) {
                        switchBtn.classList.remove('hidden');
                    }
                    // Shrink header title to fit on one line with switch-back button
                    const headerTitle = document.getElementById('header-title');
                    if (headerTitle) {
                        headerTitle.classList.remove('text-xl');
                        headerTitle.classList.add('text-base');
                    }
                    document.getElementById('impersonation-banner')?.remove();
                } else {
                    currentUser = user;
                    window.currentUser = currentUser;
                    window.currentUserData = currentUserData;
                    const switchBtn = document.getElementById('impersonation-switch-btn');
                    if (switchBtn) {
                        switchBtn.classList.add('hidden');
                    }
                    // Restore header title to normal size
                    const headerTitle = document.getElementById('header-title');
                    if (headerTitle) {
                        headerTitle.classList.remove('text-base');
                        headerTitle.classList.add('text-xl');
                    }
                    document.getElementById('impersonation-banner')?.remove();
                }

                // Define switch back handler globally
                window.handleSwitchBackToOwner = () => {
                    localStorage.removeItem('impersonated_sub_admin_uid');
                    localStorage.removeItem('impersonated_sub_admin_email');
                    localStorage.removeItem('impersonated_sub_admin_token');
                    localStorage.removeItem('impersonated_sub_admin_data');

                    const ownerUid = localStorage.getItem('original_owner_uid') || user.uid;
                    if (ownerUid) {
                        localStorage.removeItem('original_owner_uid');
                        localStorage.removeItem('original_owner_email');
                        localStorage.removeItem('original_owner_token');
                        localStorage.removeItem('original_owner_data');
                    }
                    showNotification('Switched back to Owner successfully!');
                    window.location.reload();
                };

                localStorage.setItem('lastLoggedInUser', isImpersonating ? localStorage.getItem('impersonated_sub_admin_uid') : user.uid);
                try {
                    sessionStorage.setItem('lastLoggedInUser', isImpersonating ? localStorage.getItem('impersonated_sub_admin_uid') : user.uid);
                } catch (_) {}

                if (currentUser.uid !== ADMIN_UID && localSignupApprovalInProgress) return;

                const cachedRole = (localStorage.getItem('user_role') || sessionStorage.getItem('user_role_ss') || '').toLowerCase();
                const isCachedAdminRole = cachedRole === 'admin' || cachedRole === 'subadmin' || cachedRole === 'owner';
                const isOwner = checkIsOwner(currentUser, currentUserData);
                const isAdmin = isCachedAdminRole || checkIsUserAdmin(currentUser, currentUserData);
                const role = isOwner ? 'owner' : (currentUserData?.role || (isAdmin ? (currentUserData?.role || 'subadmin') : 'user'));
                localStorage.setItem('user_role', role);
                try {
                    sessionStorage.setItem('user_role_ss', role);
                } catch (_) {}

                // INSTANT UNBLOCK: Show app UI immediately so user sees 0ms latency without any white screen delay
                hideLoading();
                window.__appLoaded = true;
                applyAdminBottomChrome(isAdmin);
                document.getElementById('auth-screen')?.classList.add('hidden');

                if (!shouldPreserveOpenPage && !shouldPreserveHydratedDashboard) {
                    if (isAdmin) {
                        currentMainSection = 'admin';
                        switchTab('admin-panel');
                        document.getElementById('dashboard-content')?.classList.remove('hidden');
                        document.getElementById('page-container')?.classList.add('hidden');
                        setBottomNavActive('bottom-admin-btn');
                        setMainChrome(true);
                        if (typeof window.showAdminMainPage === 'function') {
                            window.showAdminMainPage();
                        }
                        document.getElementById('main-content')?.classList.remove('hidden');
                    } else {
                        document.getElementById('dashboard-content')?.classList.add('hidden');
                        currentMainSection = 'task';
                        switchTab('user-panel');
                        setBottomNavActive('bottom-task-btn');
                        setMainChrome(true);
                        if (typeof window.showUserTaskPage === 'function') {
                            window.showUserTaskPage();
                        }
                        document.getElementById('main-content')?.classList.remove('hidden');
                    }
                } else {
                    document.getElementById('main-content')?.classList.remove('hidden');
                }

                // Background config & approval checks
                await loadAppConfigForStartup().catch(e => console.warn('App config startup skipped:', e));
                const maintenanceActiveForUser = !isAdmin && isMaintenanceConfigActive(appConfigCache);

                applyMaintenanceMode();
                showWhatsNewPopupIfNeeded();
                hydrateUserFromCache(currentUser.uid);

                const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                const userDocSnap = await getDoc(userDocRef).catch(error => {
                    console.warn('Initial user approval check skipped:', error);
                    return null;
                });

                if (userDocSnap?.exists()) {
                    const userData = userDocSnap.data();

                    // Update global state and cache
                    currentUserData = { uid: currentUser.uid, id: currentUser.uid, email: currentUser.email, ...userData };
                    window.currentUserData = currentUserData;
                    writeJsonCache(getUserCacheKey(currentUser.uid), sanitizeUserForCache(currentUserData, currentUser.uid));
                    try {
                        sessionStorage.setItem(`rw_wallet_user_cache_ss_${currentUser.uid}`, JSON.stringify(sanitizeUserForCache(currentUserData, currentUser.uid)));
                        sessionStorage.setItem('user_role_ss', String(currentUserData?.role || (checkIsUserAdmin(currentUser, currentUserData) ? 'admin' : 'user')));
                    } catch (_) {}

                    // Re-evaluate admin status and update layout/navigation
                    const updatedIsAdmin = checkIsUserAdmin(currentUser, currentUserData);
                    applyAdminBottomChrome(updatedIsAdmin);

                    if (updatedIsAdmin) {
                        if (typeof window.initializeAdminListeners === 'function' && !window.adminUsersRealtimeStarted) {
                            try {
                                window.initializeAdminListeners();
                            } catch (err) {
                                console.error("Error initializing admin listeners:", err);
                            }
                        }
                    }

                    if (updatedIsAdmin && !shouldPreserveOpenPage && !shouldPreserveHydratedDashboard) {
                        if (currentMainSection !== 'admin') {
                            setBottomNavActive('bottom-admin-btn');
                            if (typeof window.showAdminMainPage === 'function') {
                                window.showAdminMainPage();
                            }
                        }
                    }

                    if (!userData.referralCode && !userData.referral_code) {
                        const generatedCode = `RW${currentUser.uid.slice(0, 6).toUpperCase()}`;
                        updateDoc(userDocRef, { referralCode: generatedCode }).catch(e => console.warn("Failed to auto-repair referralCode in Firestore:", e));
                        userData.referralCode = generatedCode;
                        if (currentUserData) currentUserData.referralCode = generatedCode;
                    }
                    
                    const approvalBlocked = await enforceCurrentUserApproval(currentUser.uid, userDocRef, userData).catch(error => {
                        console.error('Approval enforcement failed:', error);
                        return false;
                    });
                    if (approvalBlocked) {
                        setTimeout(() => {
                            try {
                                initializeUserListeners(currentUser.uid);
                            } catch (err) {
                                console.error("Error initializing approval listener:", err);
                            }
                        }, 100);
                        return;
                    }
                }
                notificationsCache = readNotificationsCache(currentUser.uid);
                refreshNotificationUnreadCount(notificationsCache);
                preloadNotificationsForUser(currentUser.uid).catch(e => logBackgroundSkip('Initial notification preload skipped', e));
                startNotificationAutoRefresh(currentUser.uid);

                if (maintenanceActiveForUser) {
                    maintenanceGateActive = true;
                    currentMainSection = 'home';
                    setMainChrome(false);
                    document.getElementById('dashboard-content')?.classList.add('hidden');
                    const pageContainer = document.getElementById('page-container');
                    if (pageContainer) {
                        pageContainer.classList.add('hidden');
                        pageContainer.innerHTML = '';
                        pageContainer.style.overflowY = 'auto';
                    }
                    applyMaintenanceMode();
                }

                document.getElementById('app-footer')?.classList.add('app-footer-hidden');

                if (forceRecoverTask) {
                    currentMainSection = 'task';
                    setBottomNavActive('bottom-task-btn');
                    setMainChrome(true);
                    if (typeof window.showUserTaskDetailsPage === 'function') {
                        window.showUserTaskDetailsPage(lastActiveTaskId).catch(e => console.warn('Instant task restore failed:', e));
                    }
                } else if (window.pendingTabRedirect) {
                    const target = window.pendingTabRedirect;
                    window.pendingTabRedirect = null;
                    if (target === 'task' && typeof window.showUserTaskPage === 'function') {
                        window.showUserTaskPage();
                    } else if (target === 'refer' && typeof window.showReferEarnPage === 'function') {
                        window.showReferEarnPage();
                    } else if (target === 'admin' && typeof window.showAdminMainPage === 'function') {
                        window.showAdminMainPage();
                    } else if (target === 'help' && typeof window.showHelpSupportPage === 'function') {
                        window.showHelpSupportPage();
                    }
                }

                // Initialize user listeners (non-blocking)
                setTimeout(() => {
                    try {
                        initializeUserListeners(currentUser.uid);
                        startWithdrawalSettingsListener();
                        initializePublicHomeRealtime();

                        // Silent prefetch of user task history for instant loading
                        if (typeof window.loadUserTaskHistory === 'function') {
                            window.loadUserTaskHistory().catch(e => console.warn('Silent prefetch of task history skipped:', e));
                        }

                        // Preload Socket.io client script and connect in background for instant chat
                        if (typeof window.loadSocketIoClient === 'function') {
                            window.loadSocketIoClient()
                                .then(() => {
                                    if (typeof window.getSupportSocket === 'function') {
                                        window.getSupportSocket({ timeoutMs: 4000 }).catch(e => console.warn('Silent socket warmup connection failed:', e));
                                    }
                                })
                                .catch(e => console.warn('Silent Socket.io script load failed:', e));
                        }
                    } catch (err) {
                        console.error("Error initializing user listeners:", err);
                    }
                }, 200);

                if (isAdmin) {
                    console.log("User is Admin, initializing admin listeners...");
                    // Initialize admin listeners immediately
                    try {
                        initializeAdminListeners();
                    } catch (err) {
                        console.error("Error initializing admin listeners:", err);
                    }
                }

                // Check for pending chat notifications clicked during cold-start/launch
                if (window.pendingChatNotification) {
                    const data = window.pendingChatNotification;
                    window.pendingChatNotification = null;
                    const checkAndOpen = () => {
                        if (typeof window.openSupportChatPage === 'function') {
                            if (isAdmin) {
                                window.openSupportChatPage(data.userId, 'admin', {
                                    roomId: data.roomId,
                                    userName: data.userName || 'User'
                                });
                            } else {
                                window.openSupportChatPage(currentUser.uid, 'user', {
                                    adminId: data.adminId || ADMIN_UID
                                });
                            }
                        } else {
                            setTimeout(checkAndOpen, 100);
                        }
                    };
                    checkAndOpen();
                }

                // Check for pending transaction notifications clicked during cold-start/launch
                if (window.pendingTransactionNotification) {
                    window.pendingTransactionNotification = false;
                    const checkAndOpenTxn = () => {
                        if (typeof window.showAllTransactionsPage === 'function') {
                            window.showAllTransactionsPage();
                        } else {
                            setTimeout(checkAndOpenTxn, 100);
                        }
                    };
                    checkAndOpenTxn();
                }

                // Check for pending admin withdrawal notifications clicked during cold-start/launch
                if (window.pendingAdminWithdrawalNotification) {
                    window.pendingAdminWithdrawalNotification = false;
                    const checkAndOpenAdminWithdrawal = () => {
                        if (typeof window.showAdminWithdrawalsPage === 'function') {
                            window.showAdminWithdrawalsPage();
                        } else {
                            setTimeout(checkAndOpenAdminWithdrawal, 100);
                        }
                    };
                    checkAndOpenAdminWithdrawal();
                }

                // Check for pending task notifications clicked during cold-start/launch
                if (window.pendingTaskNotification) {
                    const data = window.pendingTaskNotification;
                    window.pendingTaskNotification = null;
                    const checkAndOpenTask = () => {
                        if (data.taskId && typeof window.showUserTaskDetailsPage === 'function') {
                            window.showUserTaskDetailsPage(data.taskId);
                        } else if (typeof window.showUserTaskPage === 'function') {
                            window.showUserTaskPage();
                        } else {
                            setTimeout(checkAndOpenTask, 100);
                        }
                    };
                    checkAndOpenTask();
                }

                // Check for pending user approval notifications clicked during cold-start/launch
                if (window.pendingUserApprovalNotification) {
                    window.pendingUserApprovalNotification = false;
                    const checkAndOpenUserApproval = () => {
                        if (typeof window.showAdminUsersPage === 'function') {
                            window.showAdminUsersPage();
                            if (typeof window.switchUsersTab === 'function') {
                                window.switchUsersTab('approvals');
                            }
                        } else {
                            setTimeout(checkAndOpenUserApproval, 100);
                        }
                    };
                    checkAndOpenUserApproval();
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
                window.__appLoaded = true;
                const hadCachedUser = !!localStorage.getItem('lastLoggedInUser');
                if (hadCachedUser) {
                    console.warn('Saved login was found but Firebase session is not active. Showing login again.');
                }
                localStorage.removeItem('lastLoggedInUser');

                // Reset login button state so it never gets stuck in loading/spinning mode on logout
                const authBtn = document.getElementById('auth-button');
                if (authBtn) {
                    authBtn.disabled = false;
                    const btnText = authBtn.querySelector('.button-text');
                    const loader = authBtn.querySelector('.loader');
                    if (btnText) btnText.classList.remove('hidden');
                    if (loader) loader.classList.add('hidden');
                }

                // Show auth screen immediately
                document.getElementById('auth-screen').classList.remove('hidden');
                document.getElementById('main-content').classList.add('hidden');
                const pageContainer = document.getElementById('page-container');
                if (pageContainer) {
                    pageContainer.innerHTML = '';
                    pageContainer.classList.add('hidden');
                }
                document.getElementById('dashboard-content')?.classList.remove('hidden');
                currentMainSection = 'home';
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

document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const { action, id, userid, requestid, upi, username, text, flagged, pro, bulk, taskid, adid, index } = target.dataset;
            e.stopPropagation();

            switch (action) {
                case 'show-user-actions-menu':
                    if (window.showUserActionsModal) {
                        window.showUserActionsModal(userid);
                    }
                    break;

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

                case 'transfer-user':
                    if (window.showTransferUserModal) {
                        window.showTransferUserModal(userid);
                    }
                    break;

                case 'view-user-dashboard':
                    showAdminUserDashboardPage(userid);
                    break;

                case 'toggle-pro-user':
                    handleToggleProUser(userid, pro === 'true');
                    break;

                case 'promote-user-tier':
                    const uObj = allUsersCache.find(item => item.id === userid);
                    const currentTier = uObj ? getTaskTier(uObj) : 'single';
                    handlePromoteUserTaskTier(userid, currentTier);
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

                case 'edit-admin-task-comment':
                    handleEditAdminTaskComment(taskid);
                    break;

                case 'manage-task-comments':
                    showAdminTaskCommentsPage(taskid);
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
                    if (typeof showTaskFeatureComingSoonPage === 'function') {
                        showTaskFeatureComingSoonPage('bonus');
                    }
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
                    const resolvedTaskId = taskid || target.dataset.taskid || target.dataset.taskId || target.dataset.id || target.closest('[data-taskid]')?.dataset?.taskid || target.closest('[data-id]')?.dataset?.id;
                    console.log('[TaskClick] Opening user task with ID:', resolvedTaskId);
                    if (!resolvedTaskId) {
                        console.warn('[TaskClick] Could not resolve taskId from clicked target:', target);
                        if (typeof showNotification === 'function') showNotification('Could not identify task. Please try again.', true);
                        break;
                    }
                    if (typeof window.showUserTaskDetailsPage === 'function') {
                        try {
                            window.showUserTaskDetailsPage(resolvedTaskId).catch(err => {
                                console.error('[TaskClick] Failed to open task details page:', err);
                                if (typeof hideLoading === 'function') hideLoading();
                                if (typeof showNotification === 'function') showNotification(err.message || 'Could not open task. Please try again.', true);
                            });
                        } catch (err) {
                            console.error('[TaskClick] Exception in showUserTaskDetailsPage call:', err);
                            if (typeof hideLoading === 'function') hideLoading();
                            if (typeof showNotification === 'function') showNotification(err.message || 'Could not open task. Please try again.', true);
                        }
                    } else {
                        console.error('[TaskClick] window.showUserTaskDetailsPage is not defined!');
                        if (typeof showNotification === 'function') showNotification('Task handler not ready. Please refresh.', true);
                    }
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

document.getElementById('auth-form')?.addEventListener('submit', handleAuth);

document.getElementById('auth-toggle')?.addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode(); });

document.getElementById('password-toggle')?.addEventListener('click', () => {
            const passInput = document.getElementById('password');
            if (passInput) {
                const isOpen = passInput.type === 'password';
                passInput.type = isOpen ? 'text' : 'password';
                document.getElementById('eye-open')?.classList.toggle('hidden', isOpen);
                document.getElementById('eye-closed')?.classList.toggle('hidden', !isOpen);
            }
        });

document.getElementById('tabs-container')?.addEventListener('click', (e) => {
            if (e.target.matches('.tab-button')) {
                const tabId = e.target.dataset.tab;
                if (tabId === 'admin-panel' && !hasAdminSessionReadyOrCached()) {
                    showNotification(currentUser ? 'Admin access only.' : 'App is opening. Please wait a moment.', true, false);
                    return;
                }
                currentMainSection = tabId === 'admin-panel' ? 'admin' : 'home';
                switchTab(tabId);
                setBottomNavActive(tabId === 'admin-panel' ? 'bottom-admin-btn' : 'bottom-home-btn');
            }
        });

document.getElementById('bottom-home-btn')?.addEventListener('click', () => {
            window.pendingTabRedirect = null;
            showHomeMainPage();
        });

document.getElementById('bottom-refer-btn')?.addEventListener('click', () => {
            if (!currentUser && hasCachedLoginSession()) {
                window.pendingTabRedirect = 'refer';
                showNotification('App is opening. Please wait a moment.', true, false);
                return;
            }
            showReferEarnPage();
        });

document.getElementById('bottom-admin-btn')?.addEventListener('click', () => {
            if (!currentUser && hasCachedLoginSession()) {
                window.pendingTabRedirect = 'admin';
                showNotification('App is opening. Please wait a moment.', true, false);
                return;
            }
            showAdminMainPage();
        });

document.getElementById('bottom-task-btn')?.addEventListener('click', () => {
            if (!currentUser && hasCachedLoginSession()) {
                window.pendingTabRedirect = 'task';
                showNotification('App is opening. Please wait a moment.', true, false);
                return;
            }
            showUserTaskPage();
        });

document.getElementById('bottom-help-btn')?.addEventListener('click', () => {
            if (!currentUser && hasCachedLoginSession()) {
                window.pendingTabRedirect = 'help';
                showNotification('App is opening. Please wait a moment.', true, false);
                return;
            }
            showHelpSupportPage();
        });

document.getElementById('bottom-settings-btn')?.addEventListener('click', showSettingsPage);

document.getElementById('notification-header-btn')?.addEventListener('click', showNotificationsPage);

document.getElementById('manage-admin-wallet-btn')?.addEventListener('click', () => openAdminQuickAction(showManageAdminWalletModal));

document.getElementById('admin-manage-tasks-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminTaskPage));

document.getElementById('admin-manage-tasks-secondary-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminTaskPage));

document.getElementById('wallet-history-action-btn')?.addEventListener('click', () => openUserQuickAction(showAllTransactionsPage));

document.getElementById('analytics-total-users-card')?.addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('all')));

document.getElementById('analytics-new-members-card')?.addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('new')));

document.getElementById('analytics-pending-withdrawals-card')?.addEventListener('click', () => openAdminQuickAction(showAdminWithdrawalsPage));

document.getElementById('analytics-minus-balance-card')?.addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('minus_balance')));

document.getElementById('analytics-total-funds-card')?.addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('all')));

document.getElementById('analytics-gift-cards-card')?.addEventListener('click', () => openAdminQuickAction(showAdminGiftCodesPage));

document.getElementById('admin-withdrawals-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminWithdrawalsPage));

document.getElementById('admin-users-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminUsersPage));

document.getElementById('admin-manage-settings-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminManageSettingsPage));

document.getElementById('admin-manage-admins-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminManageAdminsPage));

document.getElementById('admin-gift-codes-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminGiftCodesPage));

document.getElementById('admin-recharge-requests-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminRechargeRequestsPage));

document.getElementById('admin-loans-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminLoanPage));

document.getElementById('admin-investments-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminInvestmentsPage));

document.getElementById('admin-chats-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminChatsPage));

document.getElementById('admin-tasks-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminTaskPage));
document.getElementById('admin-settlement-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminSettlementPage));
document.getElementById('admin-check-referral-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminReferralLookupPage));
document.getElementById('admin-train-ai-btn')?.addEventListener('click', () => openAdminQuickAction(() => openRevyBotChatPage(true)));

document.getElementById('withdraw-fund-btn')?.addEventListener('click', () => openUserQuickAction(showWithdrawPage));

document.getElementById('redeem-gift-card-btn')?.addEventListener('click', () => {
            renderModal('Redeem Gift Card',
                `<input type="text" id="gift-code-input" placeholder="Enter your code" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="modal-submit-btn" class="px-4 py-2 text-sm bg-green-500 text-white rounded-lg">Redeem</button>`);
            const subBtn = document.getElementById('modal-submit-btn');
            if (subBtn) subBtn.onclick = handleRedeem;
        });

document.getElementById('pay-to-wallet-btn')?.addEventListener('click', () => openUserQuickAction(showPayToWalletPage));

document.getElementById('mobile-recharge-btn')?.addEventListener('click', () => openUserQuickAction(showMobileRechargePage));

const loanBtn = document.getElementById('loan-btn');
if (loanBtn) loanBtn.addEventListener('click', openLoanQuickAction);

document.getElementById('partner-btn')?.addEventListener('click', () => openUserQuickAction(showPartnerPage));

document.addEventListener('DOMContentLoaded', function () {
            console.log('DOM loaded, initializing app...');

            // Preload logo images
            preloadLogoImages();
            // Check if user was previously logged in
            const savedUser = localStorage.getItem('lastLoggedInUser');
            const savedIsAdmin = checkIsUserAdmin(null, readJsonCache(getUserCacheKey(savedUser)));
            applyAdminBottomChrome(savedIsAdmin);
            if (savedIsAdmin) {
                hydrateAdminDashboardMetricsFromCache();
                hydrateAdminUsersFromCache();
            }
            if (savedUser) {
                console.log('Found saved user, waiting for Firebase auth...');
                // Firebase will handle auto-login via onAuthStateChanged
            }

            // Safety startup timeout fallback
            setTimeout(() => {
                if (!window.__appLoaded) {
                    console.warn('Firebase Auth startup timed out after 8 seconds. Resetting loading state.');
                    if (typeof hideLoading === 'function') hideLoading();
                    window.__appLoaded = true;

                    // Hide restoring overlay if visible
                    const pageCont = document.getElementById('page-container');
                    if (pageCont && pageCont.innerHTML.includes('Restoring Mission Details...')) {
                        pageCont.classList.add('hidden');
                        pageCont.innerHTML = '';
                    }

                    // Force show login screen so user is not stuck on a blank/spinner screen
                    const authScr = document.getElementById('auth-screen');
                    const mainCont = document.getElementById('main-content');
                    if (authScr) authScr.classList.remove('hidden');
                    if (mainCont) mainCont.classList.add('hidden');
                }
            }, 8000);
        });

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

