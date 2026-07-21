// Entry Point: src/main.js
// Imports all modular components and pages in sequence

import './core/globals.js';
import './utils/ui-utils.js';
import './pages/auth.js';
import './pages/user/single/dashboard.js';
import './pages/user/single/recharge.js';
import './pages/user/single/withdraw.js';
import './pages/user/single/loan.js';
import './pages/user/single/partner.js';
import './pages/user/single/support.js';
import './pages/user/single/giftcard.js';
import './pages/user/single/notifications.js';
import './pages/user/single/profile.js';
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
import './pages/admin/admin-manage-admins.js';
import './pages/admin/admin-manage-settings.js';
import './pages/admin/admin-settlements.js';
import './core/firebase.js';

// Setup Event listeners and routing at DOM load
applyTheme(initialTheme);

// Check and apply instant recovery layout before Auth fires to prevent dashboard flickering
try {
    const isRecovering = localStorage.getItem('last_active_task_id');
    if (isRecovering) {
        const dash = document.getElementById('dashboard-content');
        const pageCont = document.getElementById('page-container');
        const mainCont = document.getElementById('main-content');
        const authScr = document.getElementById('auth-screen');
        if (dash) dash.classList.add('hidden');
        if (pageCont) {
            pageCont.classList.remove('hidden');
            pageCont.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[85vh] px-6 text-center bg-slate-50 dark:bg-slate-900">
                    <div class="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p class="text-xs font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase">Restoring Mission Details...</p>
                </div>
            `;
        }
        if (mainCont) mainCont.classList.remove('hidden');
        if (authScr) authScr.classList.add('hidden');
    }
} catch (e) {
    console.warn('Boot restore layout setup failed:', e);
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
            const shouldPreserveHydratedDashboard = !!(
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

                    const ownerUid = localStorage.getItem('original_owner_uid');
                    if (ownerUid) {
                        localStorage.removeItem('original_owner_uid');
                        localStorage.removeItem('original_owner_email');
                        localStorage.removeItem('original_owner_token');
                        localStorage.removeItem('original_owner_data');
                    }
                    showNotification('Switched back to Owner successfully!');
                    window.location.reload();
                };

                localStorage.setItem('lastLoggedInUser', user.uid);

                // OneSignal user identification
                if (window.OneSignalManager) {
                    window.OneSignalManager.login(user.uid);
                    if (user.email) {
                        window.OneSignalManager.setEmail(user.email);
                    }
                }

                if (currentUser.uid !== ADMIN_UID && localSignupApprovalInProgress) return;

                const isAdmin = currentUser.uid === ADMIN_UID || isImpersonating;
                await loadAppConfigForStartup();
                const maintenanceActiveForUser = !isAdmin && isMaintenanceConfigActive(appConfigCache);

                // Hide loading overlay only after maintenance status is known.
                hideLoading();
                window.__appLoaded = true;

                applyAdminBottomChrome(isAdmin);
                applyMaintenanceMode();
                showWhatsNewPopupIfNeeded();
                hydrateUserFromCache(currentUser.uid);
                const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                const userDocSnap = await getDoc(userDocRef).catch(error => {
                    console.warn('Initial user approval check skipped:', error);
                    return null;
                });
                if (userDocSnap?.exists()) {
                    const approvalBlocked = await enforceCurrentUserApproval(currentUser.uid, userDocRef, userDocSnap.data()).catch(error => {
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
                applyAdminBottomChrome(isAdmin);
                if (maintenanceActiveForUser) {
                    maintenanceGateActive = true;
                    currentMainSection = 'home';
                    setMainChrome(false);
                } else if (!shouldPreserveOpenPage) {
                    currentMainSection = 'home';
                    if (!shouldPreserveHydratedDashboard) {
                        switchTab('user-panel');
                    }
                    const selectedTabId = document.querySelector('.tab-button[aria-selected="true"]')?.dataset.tab || 'user-panel';
                    setBottomNavActive(selectedTabId === 'admin-panel' ? 'bottom-admin-btn' : 'bottom-home-btn');
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
                } else if (!shouldPreserveHydratedDashboard) {
                    document.getElementById('dashboard-content').classList.remove('hidden');
                    document.getElementById('page-container').classList.add('hidden');
                    document.getElementById('page-container').innerHTML = '';
                    document.getElementById('page-container').style.overflowY = 'auto';
                } else {
                    document.getElementById('dashboard-content').classList.remove('hidden');
                    document.getElementById('page-container').classList.add('hidden');
                    document.getElementById('page-container').style.overflowY = 'auto';
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

                // OneSignal logout
                if (window.OneSignalManager) {
                    window.OneSignalManager.logout();
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
                if (tabId === 'admin-panel' && !hasAdminSessionReadyOrCached()) {
                    showNotification(currentUser ? 'Admin access only.' : 'App is opening. Please wait a moment.', true, false);
                    return;
                }
                currentMainSection = tabId === 'admin-panel' ? 'admin' : 'home';
                switchTab(tabId);
                setBottomNavActive(tabId === 'admin-panel' ? 'bottom-admin-btn' : 'bottom-home-btn');
            }
        });

document.getElementById('bottom-home-btn').addEventListener('click', () => {
            window.pendingTabRedirect = null;
            showHomeMainPage();
        });

document.getElementById('bottom-refer-btn').addEventListener('click', () => {
            if (!currentUser && hasCachedLoginSession()) {
                window.pendingTabRedirect = 'refer';
                showNotification('App is opening. Please wait a moment.', true, false);
                return;
            }
            showReferEarnPage();
        });

document.getElementById('bottom-admin-btn').addEventListener('click', () => {
            if (!currentUser && hasCachedLoginSession()) {
                window.pendingTabRedirect = 'admin';
                showNotification('App is opening. Please wait a moment.', true, false);
                return;
            }
            showAdminMainPage();
        });

document.getElementById('bottom-task-btn').addEventListener('click', () => {
            if (!currentUser && hasCachedLoginSession()) {
                window.pendingTabRedirect = 'task';
                showNotification('App is opening. Please wait a moment.', true, false);
                return;
            }
            showUserTaskPage();
        });

document.getElementById('bottom-help-btn').addEventListener('click', () => {
            if (!currentUser && hasCachedLoginSession()) {
                window.pendingTabRedirect = 'help';
                showNotification('App is opening. Please wait a moment.', true, false);
                return;
            }
            showHelpSupportPage();
        });

document.getElementById('bottom-settings-btn').addEventListener('click', showSettingsPage);

document.getElementById('notification-header-btn').addEventListener('click', showNotificationsPage);

document.getElementById('manage-admin-wallet-btn').addEventListener('click', () => openAdminQuickAction(showManageAdminWalletModal));

document.getElementById('admin-manage-tasks-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminTaskPage));

document.getElementById('admin-manage-tasks-secondary-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminTaskPage));

document.getElementById('wallet-history-action-btn')?.addEventListener('click', () => openUserQuickAction(showAllTransactionsPage));

document.getElementById('analytics-total-users-card').addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('all')));

document.getElementById('analytics-new-members-card').addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('new')));

document.getElementById('analytics-pending-withdrawals-card').addEventListener('click', () => openAdminQuickAction(showAdminWithdrawalsPage));

document.getElementById('analytics-minus-balance-card').addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('minus_balance')));

document.getElementById('analytics-total-funds-card').addEventListener('click', () => openAdminQuickAction(() => showAdminUsersPageWithFilter('all')));

document.getElementById('analytics-gift-cards-card').addEventListener('click', () => openAdminQuickAction(showAdminGiftCodesPage));

document.getElementById('admin-withdrawals-btn').addEventListener('click', () => openAdminQuickAction(showAdminWithdrawalsPage));

document.getElementById('admin-users-btn').addEventListener('click', () => openAdminQuickAction(showAdminUsersPage));

document.getElementById('admin-manage-settings-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminManageSettingsPage));

document.getElementById('admin-manage-admins-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminManageAdminsPage));

document.getElementById('admin-gift-codes-btn').addEventListener('click', () => openAdminQuickAction(showAdminGiftCodesPage));

document.getElementById('admin-recharge-requests-btn').addEventListener('click', () => openAdminQuickAction(showAdminRechargeRequestsPage));

document.getElementById('admin-loans-btn').addEventListener('click', () => openAdminQuickAction(showAdminLoanPage));

document.getElementById('admin-investments-btn').addEventListener('click', () => openAdminQuickAction(showAdminInvestmentsPage));

document.getElementById('admin-chats-btn').addEventListener('click', () => openAdminQuickAction(showAdminChatsPage));

document.getElementById('admin-tasks-btn').addEventListener('click', () => openAdminQuickAction(showAdminTaskPage));
document.getElementById('admin-settlement-btn')?.addEventListener('click', () => openAdminQuickAction(showAdminSettlementPage));
document.getElementById('admin-train-ai-btn')?.addEventListener('click', () => openAdminQuickAction(() => openRevyBotChatPage(true)));

document.getElementById('withdraw-fund-btn').addEventListener('click', () => openUserQuickAction(showWithdrawPage));

document.getElementById('redeem-gift-card-btn').addEventListener('click', () => {
            renderModal('Redeem Gift Card',
                `<input type="text" id="gift-code-input" placeholder="Enter your code" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="modal-submit-btn" class="px-4 py-2 text-sm bg-green-500 text-white rounded-lg">Redeem</button>`);
            document.getElementById('modal-submit-btn').onclick = handleRedeem;
        });

document.getElementById('pay-to-wallet-btn').addEventListener('click', () => openUserQuickAction(showPayToWalletPage));

document.getElementById('mobile-recharge-btn').addEventListener('click', () => openUserQuickAction(showMobileRechargePage));

const loanBtn = document.getElementById('loan-btn');
if (loanBtn) loanBtn.addEventListener('click', openLoanQuickAction);

document.getElementById('partner-btn').addEventListener('click', () => openUserQuickAction(showPartnerPage));

document.addEventListener('DOMContentLoaded', function () {
            console.log('DOM loaded, initializing app...');

            // Preload logo images
            preloadLogoImages();
            // Check if user was previously logged in
            const savedUser = localStorage.getItem('lastLoggedInUser');
            applyAdminBottomChrome(savedUser === ADMIN_UID);
            if (savedUser === ADMIN_UID) {
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

