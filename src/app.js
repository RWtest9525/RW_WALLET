document.addEventListener('DOMContentLoaded', () => {
            const ADMIN_UID = 'mOs5Fmp4RoRzeBDH4pZLMOpQx7Q2';
            const lastUser = localStorage.getItem('lastLoggedInUser');
            const escapeHtml = (value = '') => String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            const isPendingApproval = (user = {}) =>
                user.approvalStatus === 'pending' || user.signupApprovalStatus === 'pending' || user.accountStatus === 'pending_approval';
            const isRejectedApproval = (user = {}) =>
                user.approvalStatus === 'rejected' || user.signupApprovalStatus === 'rejected' || user.accountStatus === 'rejected';
            if (lastUser) {
                document.getElementById('main-content').classList.remove('hidden');
                document.getElementById('auth-screen').classList.add('hidden');
                if (lastUser === ADMIN_UID) {
                    document.getElementById('admin-tab-button')?.classList.remove('hidden');
                    document.getElementById('bottom-admin-btn')?.classList.remove('hidden');
                    document.getElementById('bottom-task-btn')?.classList.remove('hidden');
                    const bottomHomeLabel = document.getElementById('bottom-home-label');
                    if (bottomHomeLabel) bottomHomeLabel.textContent = 'Wallet';
                    const bottomGrid = document.getElementById('bottom-nav-grid');
                    if (bottomGrid) {
                        bottomGrid.className = 'mx-auto grid max-w-xl grid-cols-6 items-center px-2 pt-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400';
                    }
                }
                try {
                    const cachedUser = JSON.parse(localStorage.getItem(`rw_wallet_user_cache_${lastUser}`) || 'null');
                    if (cachedUser) {
                        if (cachedUser.isFlagged || cachedUser.isDisabled) {
                            document.getElementById('dashboard-content')?.classList.add('hidden');
                            document.getElementById('bottom-nav')?.classList.add('hidden');
                            const pageContainer = document.getElementById('page-container');
                            const reason = escapeHtml(cachedUser.banReason || 'No reason specified.');
                            const time = cachedUser.banExpiry ? new Date(cachedUser.banExpiry).toLocaleString('en-IN') : 'Permanent suspension';
                            if (pageContainer) {
                                pageContainer.innerHTML = `
                                    <div class="min-h-[100dvh] flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
                                        <div class="w-full max-w-md rounded-3xl bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900/50 shadow-xl overflow-hidden">
                                            <div class="bg-gradient-to-br from-red-600 to-rose-700 p-6 text-white">
                                                <h2 class="text-center text-2xl font-black">Account Blocked</h2>
                                                <p class="mt-2 text-center text-sm text-white/80">Your wallet access is currently limited by admin.</p>
                                            </div>
                                            <div class="space-y-4 p-5">
                                                <div class="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4">
                                                    <p class="text-xs font-black uppercase text-red-500 dark:text-red-300">Reason</p>
                                                    <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${reason}</p>
                                                </div>
                                                <div class="rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 p-4">
                                                    <p class="text-xs font-black uppercase text-gray-400">Ban Time</p>
                                                    <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${time}</p>
                                                </div>
                                                <button class="w-full rounded-2xl bg-blue-600 px-4 py-3 font-black text-white shadow-sm opacity-80">Contact Admin</button>
                                            </div>
                                        </div>
                                    </div>`;
                                pageContainer.classList.remove('hidden');
                            }
                            return;
                        }
                        if (isPendingApproval(cachedUser) || isRejectedApproval(cachedUser)) {
                            document.getElementById('dashboard-content')?.classList.add('hidden');
                            document.getElementById('bottom-nav')?.classList.add('hidden');
                            const pageContainer = document.getElementById('page-container');
                            const isRejected = isRejectedApproval(cachedUser);
                            const title = isRejected ? 'Verification Cancelled' : 'Verification Pending';
                            const message = isRejected
                                ? (cachedUser.approvalRejectionReason || 'Your account verification request was cancelled by admin.')
                                : 'Your account has been sent to admin and it will be verified soon. After approval, your wallet will open automatically.';
                            const requested = cachedUser.signupRequestedAt ? new Date(cachedUser.signupRequestedAt).toLocaleString('en-IN') : '';
                            if (pageContainer) {
                                pageContainer.innerHTML = `
                                    <div class="min-h-[100dvh] flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
                                        <div class="w-full max-w-md rounded-3xl bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900/50 shadow-xl overflow-hidden">
                                            <div class="bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white">
                                                <h2 class="text-center text-2xl font-black">${title}</h2>
                                                <p class="mt-2 text-center text-sm text-white/85">Admin review is required before wallet access.</p>
                                            </div>
                                            <div class="space-y-4 p-5">
                                                <div class="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4">
                                                    <p class="text-xs font-black uppercase text-amber-600 dark:text-amber-200">Status</p>
                                                    <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(message)}</p>
                                                </div>
                                                <div class="rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 p-4">
                                                    <p class="text-xs font-black uppercase text-gray-400">Account</p>
                                                    <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(cachedUser.name || cachedUser.email || 'New user')}</p>
                                                    ${requested ? `<p class="mt-1 text-xs text-gray-500 dark:text-gray-300">Sent: ${escapeHtml(requested)}</p>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>`;
                                pageContainer.classList.remove('hidden');
                            }
                            return;
                        }
                        const formatInr = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
                        const formatCompactInr = (amount) => {
                            const value = Number(amount || 0);
                            if (Math.abs(value) < 10000) return formatInr(value);
                            const compact = new Intl.NumberFormat('en-IN', {
                                maximumFractionDigits: value % 1000 === 0 ? 0 : 1
                            }).format(value / 1000);
                            return `₹${compact}k`;
                        };
                        const balanceEl = document.getElementById('user-balance');
                        const adminBalanceEl = document.getElementById('admin-wallet-balance');
                        if (balanceEl) balanceEl.textContent = formatCompactInr(cachedUser.balance || 0);
                        if (adminBalanceEl) adminBalanceEl.textContent = formatCompactInr(cachedUser.balance || 0);
                    }
                    const cachedHistory = localStorage.getItem(`rw_wallet_history_cache_${lastUser}`);
                    if (cachedHistory && document.getElementById('transactions-list')) {
                        document.getElementById('transactions-list').innerHTML = cachedHistory;
                    }
                } catch (e) {
                    console.warn('Instant cache hydrate failed:', e);
                }
            } else {
                document.getElementById('auth-screen').classList.remove('hidden');
                document.getElementById('main-content').classList.add('hidden');
            }
        });
