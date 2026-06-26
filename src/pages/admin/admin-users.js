// File: src/pages/admin/admin-users.js

const isAdminUserRecord = (user = {}) => {
            const email = String(user.email || '').trim().toLowerCase();
            return user.id === ADMIN_UID || user.uid === ADMIN_UID || email === 'reviewsworld01@gmail.com';
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
            rememberAdminDashboardMetrics({
                totalUsers: otherUsers.length,
                totalFunds: formatCompactBalance(totalFunds),
                newMembers: newMembersCount,
                minusBalanceUsers: minusBalanceCount,
                minusBalanceTotal: `Total minus: ${formatCurrency(minusBalanceTotal)}`
            });
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
                            ${getTaskTier(u) === 'super_bulker' ? '<span class="px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded-full uppercase font-bold">Super Bulker</span>' : getTaskTier(u) === 'bulker' ? '<span class="px-1.5 py-0.5 text-[10px] bg-purple-600 text-white rounded-full uppercase font-bold">Bulker</span>' : '<span class="px-1.5 py-0.5 text-[10px] bg-gray-500 text-white rounded-full uppercase font-bold">Single User</span>'}
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
                            <button data-action="promote-user-tier" data-userid="${u.id}" data-tier="${getTaskTier(u)}" class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-purple-700 dark:text-purple-300">Set Tier</button>
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
                    loadFirebaseTransactions(userId, FIRESTORE_TRANSACTION_READ_LIMIT).catch(error => {
                        console.warn('Admin user Firebase transactions skipped:', error);
                        return [];
                    }),
                    fetchCloudTransactionHistory(userId, FIRESTORE_TRANSACTION_READ_LIMIT).catch(error => {
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

// Expose functions to window for global access
window.isAdminUserRecord = isAdminUserRecord;
window.applyAdminUsersCache = applyAdminUsersCache;
window.hydrateAdminUsersFromCache = hydrateAdminUsersFromCache;
window.initializeAdminUsersRealtime = initializeAdminUsersRealtime;
window.showAdminUsersPageWithFilter = showAdminUsersPageWithFilter;
window.showAdminUsersPage = showAdminUsersPage;
window.renderAdminUsersList = renderAdminUsersList;
window.updateAdminUserListView = updateAdminUserListView;
window.showAdminUserDashboardPage = showAdminUserDashboardPage;
window.loadAdminUserPendingWithdrawals = loadAdminUserPendingWithdrawals;
window.renderAdminUserTransactions = renderAdminUserTransactions;
