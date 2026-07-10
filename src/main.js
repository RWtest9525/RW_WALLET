// Entry Point: src/main.js
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
import './pages/admin/admin-manage-admins.js';
import './pages/admin/admin-manage-settings.js';
import './core/firebase.js';

// Setup Event listeners and routing at DOM load
applyTheme(initialTheme);

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
            const shouldPreserveOpenPage = !!(
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
            allTasksCache = [];
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
                currentUser = user;
                localStorage.setItem('lastLoggedInUser', user.uid);
                if (user.uid !== ADMIN_UID && localSignupApprovalInProgress) return;

                const isAdmin = user.uid === ADMIN_UID;
                await loadAppConfigForStartup();
                const maintenanceActiveForUser = !isAdmin && isMaintenanceConfigActive(appConfigCache);

                // Hide loading overlay only after maintenance status is known.
                hideLoading();
                window.__appLoaded = true;

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
                preloadNotificationsForUser(user.uid).catch(e => logBackgroundSkip('Initial notification preload skipped', e));
                startNotificationAutoRefresh(user.uid);
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

                // Initialize user listeners (non-blocking)
                setTimeout(() => {
                    try {
                        initializeUserListeners(user.uid);
                        startWithdrawalSettingsListener();
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
                window.__appLoaded = true;
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

document.body.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const { action, id, userid, requestid, upi, username, text, flagged, pro, bulk, taskid, adid, index } = target.dataset;
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
            showHomeMainPage();
        });

document.getElementById('bottom-refer-btn').addEventListener('click', showReferEarnPage);

document.getElementById('bottom-admin-btn').addEventListener('click', showAdminMainPage);

document.getElementById('bottom-task-btn').addEventListener('click', showUserTaskPage);

document.getElementById('bottom-help-btn').addEventListener('click', showHelpSupportPage);

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

