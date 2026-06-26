// File: src/pages/admin/admin-withdrawals.js

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

const showAdminWithdrawSettingsModal = async () => {
            await loadWithdrawalSettingsOnce(true);
            const referralReward = getReferralRewardAmount();
            const content = `
                <div class="space-y-4">
                    <p class="text-sm text-gray-500 dark:text-gray-400">Configure withdrawal limits and user reward rates from one place.</p>
                    
                    <div class="space-y-3">
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Referral Reward Amount</label>
                            <input type="number" id="setting-referral-reward" value="${referralReward}" min="0" step="1" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <p class="text-[10px] text-gray-400 mt-1">This amount is shown on the Refer & Earn page.</p>
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
                            <p class="text-[10px] text-gray-400 mt-1">Set to 1 to allow only one pending request at a time.</p>
                        </div>
                    </div>
                </div>`;
            const actions = `
                <button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                <button id="modal-save-settings-btn" class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg">Save Settings</button>`;
            renderModal('Rate Settings', content, actions);
            document.getElementById('modal-save-settings-btn').onclick = handleSaveWithdrawSettings;
        };

// Expose functions to window for global access
window.showAdminWithdrawalsPage = showAdminWithdrawalsPage;
window.showAdminWithdrawSettingsModal = showAdminWithdrawSettingsModal;
