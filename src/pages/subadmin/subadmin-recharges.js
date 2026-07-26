// File: src/pages/admin/admin-recharges.js

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

const renderAdminRechargeRequests = (requests) => {
    const listEl = document.getElementById('admin-recharge-requests-list-page');
    if (!listEl) return;

    const isOwner = checkIsOwner(currentUser, currentUserData);
    let pendingRequests = [...requests];
    if (!isOwner) {
        pendingRequests = pendingRequests.filter(r => {
            const u = allUsersCache.find(user => (user.id || user.uid) === r.userId);
            return u && (u.parentAdmin === currentUser?.uid || u.parent_admin === currentUser?.uid);
        });
    } else {
        pendingRequests = pendingRequests.filter(r => {
            const u = allUsersCache.find(user => (user.id || user.uid) === r.userId);
            return !u || !u.parentAdmin || u.parentAdmin === ADMIN_UID || u.parent_admin === ADMIN_UID;
        });
    }
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

// Expose functions to window for global access
window.showAdminRechargeRequestsPage = showAdminRechargeRequestsPage;
window.renderAdminRechargeRequests = renderAdminRechargeRequests;
