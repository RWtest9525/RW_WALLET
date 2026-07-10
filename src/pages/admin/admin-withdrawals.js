// File: src/pages/admin/admin-withdrawals.js

const showAdminWithdrawalsPage = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const content = `
        ${getPageHeader('Withdrawals')}
        <div class="max-w-4xl mx-auto space-y-6">
            <!-- Tabs Navigation -->
            <div class="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm">
                <button id="tab-pending-btn" class="flex-1 py-3 text-sm font-bold text-center text-blue-600 border-b-2 border-blue-600 transition" onclick="switchWithdrawalTab('pending')">Pending Requests</button>
                <button id="tab-history-btn" class="flex-1 py-3 text-sm font-bold text-center text-gray-500 hover:text-blue-600 transition" onclick="switchWithdrawalTab('history')">Withdrawal History</button>
            </div>

            <!-- Tab 1: Pending Requests Section -->
            <div id="withdrawal-pending-section" class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-4">
                <div class="relative flex items-center gap-2">
                    <input type="search" id="pending-withdrawal-search" value="${escapeHtml(adminPendingWithdrawalSearch)}" placeholder="Search name, mobile, email, amount, method" class="min-w-0 flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-sm focus:outline-none border border-gray-100 dark:border-gray-600">
                    <button id="pending-withdrawal-actions-btn" class="h-10 w-10 shrink-0 rounded-full bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-xl font-black text-yellow-700 dark:text-yellow-200 shadow-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/40" title="More actions">&#8942;</button>
                    <div id="pending-withdrawal-actions-menu" class="hidden absolute right-0 top-12 z-20 w-64 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-xl">
                        <p id="legacy-pending-withdrawal-summary" class="mb-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-[11px] leading-4 text-yellow-800 dark:text-yellow-100">Checking pending withdrawals without balance cut...</p>
                        <button id="fix-legacy-pending-withdrawals-btn" class="w-full rounded-lg px-3 py-2 text-left text-xs font-black text-yellow-700 dark:text-yellow-200 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 disabled:opacity-50 disabled:cursor-not-allowed">Deduct Uncut Pending</button>
                        <button id="refresh-pending-withdrawals-btn" class="w-full rounded-lg px-3 py-2 text-left text-xs font-black text-blue-700 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/30">Refresh List</button>
                    </div>
                </div>
                <div id="admin-fund-requests-list-page" class="max-h-[75vh] overflow-y-auto"></div>
            </div>

            <!-- Tab 2: History Section -->
            <div id="withdrawal-history-section" class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-4 hidden animate-fade-in">
                <!-- Filters -->
                <div class="space-y-4">
                    <div class="flex flex-wrap gap-2">
                        <button data-filter="today" class="filter-btn active-filter px-4 py-2 text-xs font-bold bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">Today</button>
                        <button data-filter="yesterday" class="filter-btn px-4 py-2 text-xs font-bold bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">Yesterday</button>
                        <button data-filter="week" class="filter-btn px-4 py-2 text-xs font-bold bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">This Week</button>
                        <button data-filter="month" class="filter-btn px-4 py-2 text-xs font-bold bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">This Month</button>
                        <button data-filter="all" class="filter-btn px-4 py-2 text-xs font-bold bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">All Time</button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="text-xs font-bold text-gray-400 uppercase">Search User</label>
                            <input type="search" id="withdrawal-history-search" placeholder="Name, mobile, email" class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-150 dark:border-gray-600 rounded-xl text-sm outline-none">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-gray-400 uppercase">From Date</label>
                            <input type="date" id="filter-from-date" class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-150 dark:border-gray-600 rounded-xl text-sm outline-none">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-gray-400 uppercase">To Date</label>
                            <input type="date" id="filter-to-date" class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-150 dark:border-gray-600 rounded-xl text-sm outline-none">
                        </div>
                    </div>
                    <button id="apply-date-filter" class="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">Apply Date Filter</button>
                </div>
                
                <!-- Statistics -->
                <div class="grid grid-cols-3 gap-3 text-sm font-semibold">
                    <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                        <p class="text-xs text-blue-600 dark:text-blue-400">Total</p>
                        <p id="total-withdrawals-count" class="text-2xl font-black mt-1">0</p>
                    </div>
                    <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl border border-green-100 dark:border-green-800">
                        <p class="text-xs text-green-600 dark:text-green-400">Approved</p>
                        <p id="approved-withdrawals-count" class="text-2xl font-black mt-1">0</p>
                    </div>
                    <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-800">
                        <p class="text-xs text-red-600 dark:text-red-400">Rejected</p>
                        <p id="rejected-withdrawals-count" class="text-2xl font-black mt-1">0</p>
                    </div>
                </div>
                
                <!-- Withdrawal History List -->
                <div id="withdrawal-history-list" class="max-h-[60vh] overflow-y-auto space-y-3"></div>
            </div>
        </div>
        ${getPageFooter()}
    `;

    showPage(content, { returnTo: 'admin' });
    setBottomNavActive('bottom-admin-btn');

    // Pending Requests Tab Logic
    const searchInput = document.getElementById('pending-withdrawal-search');
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

    // History Tab Logic
    document.getElementById('withdrawal-history-search')?.addEventListener('input', renderLocalWithdrawalHistoryList);
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active-filter', 'bg-blue-600', 'text-white'));
            this.classList.add('active-filter', 'bg-blue-600', 'text-white');
            const filter = this.dataset.filter;
            loadLocalWithdrawalHistory(filter);
        });
    });

    document.getElementById('apply-date-filter')?.addEventListener('click', () => {
        const fromDate = document.getElementById('filter-from-date').value;
        const toDate = document.getElementById('filter-to-date').value;
        if (fromDate && toDate) {
            loadLocalWithdrawalHistory('custom', fromDate, toDate);
        } else {
            showNotification('Please select both from and to dates.', true);
        }
    });

    loadLocalWithdrawalHistory('today');
};

const switchWithdrawalTab = (tab) => {
    const tabs = ['pending', 'history'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}-btn`);
        const sec = document.getElementById(`withdrawal-${t}-section`);
        if (t === tab) {
            btn?.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            btn?.classList.remove('text-gray-500');
            sec?.classList.remove('hidden');
        } else {
            btn?.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            btn?.classList.add('text-gray-500');
            sec?.classList.add('hidden');
        }
    });
};

const loadLocalWithdrawalHistory = async (filter = 'today', fromDate = null, toDate = null) => {
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
            loadCloudFundRequests({ status: 'all', type: 'withdrawal', limit: historyLimit, timeoutMs: needsDeepHistoryScan ? 8000 : 3000 }).catch(() => []),
            needsDeepHistoryScan ? loadLegacyWithdrawalTransactionsForAdmin() : Promise.resolve([])
        ]);

        const firebaseRequests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let withdrawals = mergeWithdrawalHistoryRecords(firebaseRequests, cloudRequests, legacyWithdrawals);

        // Sub-admin Referred Users Filtering
        if (currentUserData?.role === 'admin') {
            withdrawals = withdrawals.filter(w => {
                const u = allUsersCache.find(user => (user.id || user.uid) === w.userId);
                return u && (u.parentAdmin === currentUser.uid || u.parent_admin === currentUser.uid);
            });
        }

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
            withdrawals = withdrawals.filter(w => w.requestedAt && getSafeDate(w.requestedAt) >= today);
        } else if (filter === 'yesterday') {
            withdrawals = withdrawals.filter(w => w.requestedAt && getSafeDate(w.requestedAt) >= yesterday && getSafeDate(w.requestedAt) < today);
        } else if (filter === 'week') {
            withdrawals = withdrawals.filter(w => w.requestedAt && getSafeDate(w.requestedAt) >= weekAgo);
        } else if (filter === 'month') {
            withdrawals = withdrawals.filter(w => w.requestedAt && getSafeDate(w.requestedAt) >= monthAgo);
        } else if (filter === 'custom' && fromDate && toDate) {
            const from = new Date(fromDate);
            const to = new Date(toDate);
            to.setDate(to.getDate() + 1);
            withdrawals = withdrawals.filter(w => w.requestedAt && getSafeDate(w.requestedAt) >= from && getSafeDate(w.requestedAt) < to);
        }

        withdrawalHistoryCache = withdrawals;
        renderLocalWithdrawalHistoryList();
    } catch (error) {
        console.error("Error loading withdrawal history:", error);
    }
};

const renderLocalWithdrawalHistoryList = () => {
    const listEl = document.getElementById('withdrawal-history-list');
    if (!listEl) return;
    const search = (document.getElementById('withdrawal-history-search')?.value || '').trim().toLowerCase();
    const withdrawals = withdrawalHistoryCache.filter(w => !search || [
        w.userName,
        w.userMobile,
        w.userEmail
    ].some(value => String(value || '').toLowerCase().includes(search)));

    document.getElementById('total-withdrawals-count').textContent = withdrawals.length;
    document.getElementById('approved-withdrawals-count').textContent = withdrawals.filter(w => w.status === 'completed').length;
    document.getElementById('rejected-withdrawals-count').textContent = withdrawals.filter(w => w.status === 'rejected').length;

    if (withdrawals.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No withdrawal history found.</p>';
        return;
    }

    listEl.innerHTML = withdrawals.map(w => {
        const statusColor = w.status === 'completed' ? 'text-green-500' : w.status === 'rejected' ? 'text-red-500' : 'text-yellow-500';
        const statusBg = w.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' : w.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30';
        const statusText = w.status === 'completed' ? 'Approved' : w.status === 'rejected' ? 'Rejected' : 'Pending';
        const payoutDetails = getWithdrawalDetailText(w);

        let requestDate = 'N/A';
        let requestTime = 'N/A';
        if (w.requestedAt) {
            requestDate = formatDate(w.requestedAt).split(' ')[0];
            requestTime = getTimeFromTimestamp(w.requestedAt);
        }

        return `
            <div class="p-4 mb-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 text-sm animate-fade-in">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <p class="font-bold text-gray-900 dark:text-white">${escapeHtml(w.userName || 'N/A')}</p>
                        <p class="text-xs text-gray-500 mt-1">Mobile: ${escapeHtml(maskMobile(w.userMobile || ''))}</p>
                        <p class="text-xs text-gray-500">Email: ${escapeHtml((w.userEmail || 'N/A').split('@')[0])}***</p>
                    </div>
                    <span class="px-2.5 py-1 text-xs ${statusBg} ${statusColor} rounded-full font-bold">${statusText}</span>
                </div>
                <div class="grid grid-cols-2 gap-3 text-xs mb-3">
                    <div class="bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700"><span class="text-gray-500">Amount</span><p class="font-bold">${formatCurrencyAbs(w.amount)}</p></div>
                    <div class="bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700"><span class="text-gray-500">Method</span><p class="font-bold">${escapeHtml(w.method || 'N/A')}</p></div>
                    <div class="bg-white dark:bg-gray-800 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 col-span-2"><span class="text-gray-500">Payout Details</span><p class="font-bold break-words">${escapeHtml(payoutDetails)}</p></div>
                </div>
                <div class="flex justify-between items-center text-xs text-gray-500 mt-2">
                    <span>Requested: ${requestDate} ${requestTime}</span>
                    ${w.adminTransactionId ? `<span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-[10px]">${w.adminTransactionId}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
};

const showAdminWithdrawSettingsModal = async () => {
    await loadWithdrawalSettingsOnce(true);
    const referralReward = getReferralRewardAmount ? getReferralRewardAmount() : (appConfigCache.referralRewardAmount || 0);
    const content = `
        <div class="space-y-4">
            <p class="text-sm text-gray-500 dark:text-gray-400">Configure withdrawal limits and user reward rates from one place.</p>
            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Referral Reward Amount</label>
                    <input type="number" id="setting-referral-reward" value="${referralReward}" min="0" step="1" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                </div>
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
                </div>
            </div>
        </div>`;
    const actions = `
        <button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
        <button id="modal-save-settings-btn" class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg">Save Settings</button>`;
    renderModal('Rate Settings', content, actions);
    document.getElementById('modal-save-settings-btn').onclick = handleSaveWithdrawSettings;
};

// Expose functions to window
window.showAdminWithdrawalsPage = showAdminWithdrawalsPage;
window.switchWithdrawalTab = switchWithdrawalTab;
window.loadLocalWithdrawalHistory = loadLocalWithdrawalHistory;
window.renderLocalWithdrawalHistoryList = renderLocalWithdrawalHistoryList;
window.showAdminWithdrawSettingsModal = showAdminWithdrawSettingsModal;
