const showRuntimeRecoveryScreen = (error) => {
    try {
        const root = document.getElementById('rw-wallet-root') || document.body;
        const message = String(error?.message || error || 'App failed to load.');
        root.innerHTML = `
            <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f3f4f6;padding:20px;font-family:Inter,Arial,sans-serif;color:#111827;">
                <div style="width:100%;max-width:420px;background:#fff;border:1px solid #e5e7eb;border-radius:22px;padding:24px;box-shadow:0 20px 45px rgba(15,23,42,.12);text-align:center;">
                    <div style="width:54px;height:54px;border-radius:18px;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:28px;font-weight:900;">!</div>
                    <h1 style="font-size:22px;line-height:1.2;margin:0 0 8px;font-weight:900;">App loading problem</h1>
                    <p style="font-size:14px;line-height:1.5;color:#4b5563;margin:0 0 16px;">Please refresh once. If it repeats, update your browser/app.</p>
                    <p style="font-size:11px;line-height:1.4;color:#9ca3af;word-break:break-word;margin:0 0 16px;">${message.replace(/[<>&"']/g, '')}</p>
                    <button onclick="location.reload()" style="width:100%;border:0;border-radius:14px;background:#2563eb;color:#fff;font-weight:900;padding:13px 16px;">Refresh App</button>
                </div>
            </div>`;
    } catch (_) {
        document.body.innerHTML = '<button onclick="location.reload()">Refresh App</button>';
    }
};

window.addEventListener('error', (event) => {
    if (window.__appLoaded) return;
    if (!document.querySelector('#auth-screen:not(.hidden), #main-content:not(.hidden), #page-container:not(.hidden)')) {
        showRuntimeRecoveryScreen(event.error || event.message);
    }
});
window.addEventListener('unhandledrejection', (event) => {
    if (window.__appLoaded) return;
    if (!document.querySelector('#auth-screen:not(.hidden), #main-content:not(.hidden), #page-container:not(.hidden)')) {
        showRuntimeRecoveryScreen(event.reason);
    }
});

const hydrateInstantShell = () => {
    const ADMIN_UID = 'mOs5Fmp4RoRzeBDH4pZLMOpQx7Q2';
    const lastUser = localStorage.getItem('lastLoggedInUser');
    const isImpersonating = !!localStorage.getItem('impersonated_sub_admin_uid');
    const effectiveUser = isImpersonating ? localStorage.getItem('impersonated_sub_admin_uid') : lastUser;
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

        // Check if the user is an admin/sub-admin/owner based on UID or cached user details
        let isUserAdmin = false;
        try {
            const cachedUser = JSON.parse(localStorage.getItem(`rw_wallet_user_cache_${effectiveUser}`) || 'null');
            const cachedRole = (localStorage.getItem('user_role') || '').toLowerCase();
            const isRoleAdmin = cachedRole === 'admin' || cachedRole === 'subadmin' || cachedRole === 'owner' || (window.checkIsUserAdmin ? window.checkIsUserAdmin(currentUser, currentUserData) : false);
            if (effectiveUser === ADMIN_UID || isImpersonating || isRoleAdmin || (cachedUser && (cachedUser.role === 'admin' || cachedUser.role === 'subadmin' || cachedUser.role === 'owner' || cachedUser.isAdmin))) {
                isUserAdmin = true;
            }
        } catch (e) {
            console.warn('Failed to parse cached user for admin check:', e);
        }

        if (isUserAdmin) {
            document.getElementById('admin-tab-button')?.classList.remove('hidden');
            const bottomAdminButton = document.getElementById('bottom-admin-btn');
            if (bottomAdminButton) {
                bottomAdminButton.hidden = false;
                bottomAdminButton.classList.remove('hidden');
            }
            const bottomHelpButton = document.getElementById('bottom-help-btn');
            if (bottomHelpButton) {
                bottomHelpButton.hidden = true;
                bottomHelpButton.classList.add('hidden');
            }
            document.getElementById('bottom-task-btn')?.classList.remove('hidden');
            const bottomHomeLabel = document.getElementById('bottom-home-label');
            if (bottomHomeLabel) bottomHomeLabel.textContent = 'Wallet';
            const bottomGrid = document.getElementById('bottom-nav-grid');
            if (bottomGrid) {
                bottomGrid.style.setProperty('--bottom-nav-count', '5');
                bottomGrid.className = 'mx-auto grid w-full max-w-xl grid-cols-5 items-center px-2 pt-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400';
            }
            document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.id === 'bottom-admin-btn');
            });
            document.getElementById('user-panel')?.classList.add('hidden');
            document.getElementById('admin-panel')?.classList.remove('hidden');
            document.querySelectorAll('.tab-button').forEach(btn => btn.setAttribute('aria-selected', btn.dataset.tab === 'admin-panel'));
        } else {
            document.getElementById('admin-tab-button')?.classList.add('hidden');
            const bottomAdminButton = document.getElementById('bottom-admin-btn');
            if (bottomAdminButton) {
                bottomAdminButton.hidden = true;
                bottomAdminButton.classList.add('hidden');
            }
            const bottomHelpButton = document.getElementById('bottom-help-btn');
            if (bottomHelpButton) {
                bottomHelpButton.hidden = false;
                bottomHelpButton.classList.remove('hidden');
            }
            document.getElementById('bottom-task-btn')?.classList.remove('hidden');
            const bottomHomeLabel = document.getElementById('bottom-home-label');
            if (bottomHomeLabel) bottomHomeLabel.textContent = 'Wallet';
            const bottomGrid = document.getElementById('bottom-nav-grid');
            if (bottomGrid) {
                bottomGrid.style.setProperty('--bottom-nav-count', '5');
                bottomGrid.className = 'mx-auto grid w-full max-w-xl grid-cols-5 items-center px-2 pt-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400';
            }
            document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.id === 'bottom-home-btn');
            });
            document.getElementById('admin-panel')?.classList.add('hidden');
            document.getElementById('user-panel')?.classList.remove('hidden');
            document.querySelectorAll('.tab-button').forEach(btn => btn.setAttribute('aria-selected', btn.dataset.tab === 'user-panel'));
        }
        try {
            const cachedUser = JSON.parse(localStorage.getItem(`rw_wallet_user_cache_${effectiveUser}`) || 'null');
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
                                    <div id="verification-pending-container" class="min-h-[100dvh] flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
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
    setTimeout(() => {
        if (window.__appLoaded) return;
        const authVisible = !!document.querySelector('#auth-screen:not(.hidden)');
        const mainVisible = !!document.querySelector('#main-content:not(.hidden)');
        const pageVisible = !!document.querySelector('#page-container:not(.hidden)');
        if (!authVisible && !mainVisible && !pageVisible) {
            showRuntimeRecoveryScreen('No visible app screen after startup.');
        }
    }, 20000);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateInstantShell, { once: true });
} else {
    hydrateInstantShell();
}
