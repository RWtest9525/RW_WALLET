// File: src/pages/admin/admin-settlements.js

const showAdminSettlementPage = async () => {
    if (!currentUser) return;
    const isOwner = checkIsOwner(currentUser, currentUserData);

    let content = '';
    if (isOwner) {
        content = await getOwnerSettlementHtml();
    } else {
        content = await getSubAdminSettlementHtml();
    }

    showPage(content, { returnTo: 'admin', keepBottomNav: false });
    setBottomNavActive('bottom-admin-btn');

    if (isOwner) {
        setupOwnerSettlementListeners();
    } else {
        setupSubAdminSettlementListeners();
    }
};

// --- Sub-Admin View Implementation ---

const getSubAdminSettlementHtml = async () => {
    const subAdminId = currentUser.uid;
    const subAdminDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/users`, subAdminId));
    const subAdminData = subAdminDoc.exists() ? subAdminDoc.data() : {};
    
    const upiId = subAdminData.upiId || '';
    const totalWithdrawApproved = Number(subAdminData.totalWithdrawApproved || 0);
    const totalOwnerTaskAmount = Number(subAdminData.totalOwnerTaskAmount || 0);
    const settlementPaid = Number(subAdminData.settlementPaid || 0);
    const pendingSettlement = Math.max(0, totalWithdrawApproved - settlementPaid);

    // Fetch recent requests
    const q = query(
        collection(db, `artifacts/${appId}/public/data/settlement_requests`),
        where("subAdminId", "==", subAdminId),
        orderBy("requestedAt", "desc")
    );
    let requestsHtml = '<div class="text-center py-4 text-gray-500 font-semibold text-sm">No settlement requests found.</div>';
    let hasPendingRequest = false;

    try {
        const snap = await getDocs(q);
        if (!snap.empty) {
            requestsHtml = snap.docs.map(d => {
                const r = d.data();
                if (r.status === 'pending') hasPendingRequest = true;
                const reqDate = r.requestedAt ? new Date(timestampToMillis(r.requestedAt)).toLocaleString('en-IN') : 'N/A';
                const payDate = r.processedAt ? new Date(timestampToMillis(r.processedAt)).toLocaleString('en-IN') : 'N/A';
                const statusClass = r.status === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30';
                return `
                <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-black text-gray-900 dark:text-white">${formatCurrency(r.amount)}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${statusClass}">${r.status}</span>
                        </div>
                        <p class="text-xs text-gray-400 font-semibold">UPI: ${escapeHtml(r.upiId)}</p>
                        <p class="text-[10px] text-gray-400">Req: ${escapeHtml(reqDate)}</p>
                        ${r.processedAt ? `<p class="text-[10px] text-emerald-500 font-bold">Paid: ${escapeHtml(payDate)}</p>` : ''}
                    </div>
                    ${r.txnId ? `
                    <div class="text-left sm:text-right shrink-0">
                        <span class="text-[10px] font-black uppercase text-gray-400 block">Transaction ID</span>
                        <span class="text-xs font-bold text-gray-600 dark:text-gray-300 select-all">${escapeHtml(r.txnId)}</span>
                    </div>
                    ` : ''}
                </div>`;
            }).join('');
        }
    } catch (e) {
        console.warn("Could not load settlement requests:", e);
    }

    const upiWarning = !upiId ? `
    <div class="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 p-3 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
        <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        UPI ID is missing. Please save your UPI ID below to request settlements.
    </div>` : '';

    return `
    ${getPageHeader('Settlement Portal')}
    <div class="max-w-4xl mx-auto space-y-6 pb-24 px-4">
        ${upiWarning}

        <!-- Status Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <p class="text-xs font-bold text-gray-400 uppercase">Owner Tasks Earned</p>
                <p class="text-2xl font-black text-gray-900 dark:text-white mt-1">${formatCurrency(totalOwnerTaskAmount)}</p>
                <p class="text-[9px] text-gray-400 mt-1 font-semibold">Rupees generated by users</p>
            </div>
            <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <p class="text-xs font-bold text-gray-400 uppercase">Total User Payouts</p>
                <p class="text-2xl font-black text-gray-900 dark:text-white mt-1">${formatCurrency(totalWithdrawApproved)}</p>
                <p class="text-[9px] text-gray-400 mt-1 font-semibold">Total withdrawals approved</p>
            </div>
            <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <p class="text-xs font-bold text-gray-400 uppercase">Settled by Owner</p>
                <p class="text-2xl font-black text-gray-900 dark:text-white mt-1">${formatCurrency(settlementPaid)}</p>
                <p class="text-[9px] text-gray-400 mt-1 font-semibold">Total reimbursed to you</p>
            </div>
            <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/10 dark:to-orange-950/10">
                <p class="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Unsettled Balance</p>
                <p class="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">${formatCurrency(pendingSettlement)}</p>
                <p class="text-[9px] text-amber-500 mt-1 font-semibold">Due from main owner</p>
            </div>
        </div>

        <!-- Action / Settings Form -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                <h3 class="text-base font-extrabold text-gray-900 dark:text-white">Settlement Settings</h3>
                <div>
                    <label class="text-[10px] font-black uppercase text-gray-400">My UPI ID for Payments</label>
                    <div class="mt-1 flex gap-2">
                        <input id="subadmin-upi-input" type="text" placeholder="example@ybl" value="${escapeHtml(upiId)}" class="flex-grow px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-150 dark:border-gray-600 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
                        <button id="subadmin-save-upi-btn" class="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-sm hover:scale-105 active:scale-95 transition">Save</button>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                <div>
                    <h3 class="text-base font-extrabold text-gray-900 dark:text-white">Request Settlement</h3>
                    <p class="text-xs text-gray-400 font-semibold mt-1">Request the owner to pay the unsettled balance to your saved UPI ID.</p>
                </div>
                <div class="mt-4">
                    <button id="subadmin-request-settle-btn" 
                        ${!upiId || pendingSettlement <= 0 || hasPendingRequest ? 'disabled' : ''}
                        class="w-full px-5 py-3 rounded-xl bg-amber-600 text-white font-black text-sm hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        ${hasPendingRequest ? 'Request Already Pending' : pendingSettlement <= 0 ? 'No Unsettled Balance' : `Request ${formatCurrency(pendingSettlement)}`}
                    </button>
                </div>
            </div>
        </div>

        <!-- Recent Requests -->
        <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <h3 class="text-base font-extrabold text-gray-900 dark:text-white">Recent Requests</h3>
            <div class="space-y-3" id="subadmin-requests-list">
                ${requestsHtml}
            </div>
        </div>
    </div>
    ${getPageFooter()}`;
};

const setupSubAdminSettlementListeners = () => {
    document.getElementById('subadmin-save-upi-btn')?.addEventListener('click', async () => {
        const upi = document.getElementById('subadmin-upi-input')?.value.trim() || '';
        if (!upi) return showNotification('Please enter a valid UPI ID.', true);
        try {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid), {
                upiId: upi
            });
            showNotification('UPI ID saved successfully.');
            showAdminSettlementPage();
        } catch (e) {
            console.error("Save UPI failed:", e);
            showNotification('Could not save UPI ID.', true);
        }
    });

    document.getElementById('subadmin-request-settle-btn')?.addEventListener('click', async () => {
        const subAdminId = currentUser.uid;
        try {
            const subAdminDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/users`, subAdminId));
            const subAdminData = subAdminDoc.exists() ? subAdminDoc.data() : {};
            const upiId = subAdminData.upiId || '';
            const totalWithdrawApproved = Number(subAdminData.totalWithdrawApproved || 0);
            const settlementPaid = Number(subAdminData.settlementPaid || 0);
            const pendingSettlement = Math.max(0, totalWithdrawApproved - settlementPaid);

            if (!upiId) return showNotification('Please configure your UPI ID first.', true);
            if (pendingSettlement <= 0) return showNotification('No unsettled balance available.', true);

            renderModal('Request Settlement',
                `<div class="space-y-3">
                    <p class="text-sm text-gray-600 dark:text-gray-300">Request <strong>${formatCurrency(pendingSettlement)}</strong> to UPI ID <strong>${escapeHtml(upiId)}</strong>?</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-settlement-request-btn" class="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg">Confirm Request</button>`
            );

            document.getElementById('confirm-settlement-request-btn').onclick = async () => {
                try {
                    const reqRef = doc(collection(db, `artifacts/${appId}/public/data/settlement_requests`));
                    await setDoc(reqRef, {
                        id: reqRef.id,
                        subAdminId,
                        subAdminName: currentUserData?.name || 'Sub-Admin',
                        subAdminEmail: currentUserData?.email || '',
                        upiId,
                        amount: pendingSettlement,
                        status: 'pending',
                        requestedAt: serverTimestamp(),
                        processedAt: null,
                        txnId: ''
                    });
                    showNotification('Settlement requested successfully.');
                    window.closeModal();
                    showAdminSettlementPage();
                } catch (e) {
                    console.error("Create settlement request failed:", e);
                    showNotification('Could not request settlement.', true);
                    window.closeModal();
                }
            };
        } catch (e) {
            console.error("Request settlement check failed:", e);
        }
    });
};


// --- Owner View Implementation ---

const getOwnerSettlementHtml = async () => {
    // Load pending requests
    const pendingQuery = query(
        collection(db, `artifacts/${appId}/public/data/settlement_requests`),
        where("status", "==", "pending"),
        orderBy("requestedAt", "desc")
    );
    let pendingRequestsHtml = '<p class="text-sm font-semibold text-gray-400 py-4 text-center">No pending settlement requests.</p>';
    try {
        const snap = await getDocs(pendingQuery);
        if (!snap.empty) {
            pendingRequestsHtml = snap.docs.map(d => {
                const r = d.data();
                const reqDate = r.requestedAt ? new Date(timestampToMillis(r.requestedAt)).toLocaleString('en-IN') : 'N/A';
                return `
                <div class="p-4 bg-amber-50/50 dark:bg-amber-950/10 rounded-2xl border border-amber-100 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="space-y-0.5">
                        <p class="text-sm font-black text-gray-900 dark:text-white">${escapeHtml(r.subAdminName)} (${escapeHtml(r.subAdminEmail)})</p>
                        <p class="text-xs text-gray-500 font-bold">UPI ID: <span class="text-blue-600 dark:text-blue-400 select-all font-black">${escapeHtml(r.upiId)}</span></p>
                        <p class="text-[10px] text-gray-400">Requested: ${escapeHtml(reqDate)}</p>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        <span class="text-lg font-black text-gray-900 dark:text-white">${formatCurrency(r.amount)}</span>
                        <button data-action="pay-subadmin" data-reqid="${r.id}" data-subadminid="${r.subAdminId}" data-amount="${r.amount}" data-upi="${escapeHtml(r.upiId)}" data-name="${escapeHtml(r.subAdminName)}" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition">Pay & Approve</button>
                    </div>
                </div>`;
            }).join('');
        }
    } catch (e) {
        console.warn("Could not load owner pending requests:", e);
    }

    return `
    ${getPageHeader('Admin Settlements')}
    <div class="max-w-5xl mx-auto space-y-6 pb-24 px-4">
        
        <!-- Pending Requests Section -->
        <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <h3 class="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <span class="h-2 w-2 rounded-full bg-amber-500"></span>
                Pending Settlements from Sub-Admins
            </h3>
            <div class="space-y-3" id="owner-pending-settlements">
                ${pendingRequestsHtml}
            </div>
        </div>

        <!-- Month-Wise Sub-Admins Monitoring -->
        <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 class="text-base font-extrabold text-gray-900 dark:text-white">Sub-Admins Performance & Stats</h3>
                <div class="flex items-center gap-2">
                    <label class="text-xs font-black text-gray-400 uppercase">Select Month</label>
                    <select id="settlement-month-select" class="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none">
                        ${getMonthlyStatsOptions()}
                    </select>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs font-semibold">
                    <thead>
                        <tr class="border-b border-gray-100 dark:border-gray-700 text-gray-400 uppercase tracking-wider text-[10px]">
                            <th class="py-3 px-4 font-black">Sub-Admin</th>
                            <th class="py-3 px-4 font-black text-center">Owner Tasks (Month)</th>
                            <th class="py-3 px-4 font-black text-center">Paid to Users (Month)</th>
                            <th class="py-3 px-4 font-black text-center">Rejected Users (Month)</th>
                            <th class="py-3 px-4 font-black text-center">Total Settled (Overall)</th>
                            <th class="py-3 px-4 font-black text-center">Net Due (Overall)</th>
                        </tr>
                    </thead>
                    <tbody id="settlement-stats-table-body" class="divide-y divide-gray-50 dark:divide-gray-700/50">
                        <tr>
                            <td colspan="6" class="text-center py-8 text-gray-400">Loading statistics...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    ${getPageFooter()}`;
};

const getMonthlyStatsOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = d.toISOString().slice(0, 7); // "YYYY-MM"
        const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        options.push(`<option value="${val}" ${i === 0 ? 'selected' : ''}>${label}</option>`);
    }
    return options.join('');
};

const setupOwnerSettlementListeners = () => {
    const bindPaymentButtons = () => {
        document.querySelectorAll('button[data-action="pay-subadmin"]').forEach(btn => {
            btn.onclick = (e) => {
                const { reqid, subadminid, amount, upi, name } = e.currentTarget.dataset;
                renderModal('Approve & Pay Sub-Admin',
                    `<div class="space-y-4">
                        <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-1">
                            <p class="text-xs text-gray-400">Paying To</p>
                            <p class="text-sm font-black text-gray-900 dark:text-white">${escapeHtml(name)}</p>
                            <p class="text-xs text-gray-500 font-bold">UPI ID: <span class="text-blue-600 dark:text-blue-400 select-all font-black">${escapeHtml(upi)}</span></p>
                        </div>
                        <div class="p-3 bg-amber-50/50 dark:bg-amber-950/10 rounded-xl flex items-center justify-between">
                            <span class="text-xs font-bold text-amber-700 dark:text-amber-300">Amount Due</span>
                            <span class="text-lg font-black text-amber-800 dark:text-amber-200">${formatCurrency(amount)}</span>
                        </div>
                        <div>
                            <label class="text-[10px] font-black uppercase text-gray-400 block mb-1">Transaction Ref No. / ID</label>
                            <input id="owner-txn-ref-input" type="text" placeholder="Enter UPI Ref No. or Transaction ID" class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-150 dark:border-gray-600 text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500">
                        </div>
                    </div>`,
                    `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                     <button id="owner-confirm-payment-btn" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg">Mark Paid & Approve</button>`
                );

                document.getElementById('owner-confirm-payment-btn').onclick = async () => {
                    const txnId = document.getElementById('owner-txn-ref-input')?.value.trim() || '';
                    if (!txnId) return showNotification('Please enter a transaction reference number.', true);
                    
                    try {
                        // 1. Update Settlement request document
                        await updateDoc(doc(db, `artifacts/${appId}/public/data/settlement_requests`, reqid), {
                            status: 'completed',
                            processedAt: serverTimestamp(),
                            txnId: txnId
                        });

                        // 2. Increment sub-admin's settlementPaid total
                        const subAdminRef = doc(db, `artifacts/${appId}/public/data/users`, subadminid);
                        await updateDoc(subAdminRef, {
                            settlementPaid: increment(Number(amount))
                        });

                        showNotification('Settlement payment approved and logged.');
                        window.closeModal();
                        showAdminSettlementPage();
                    } catch (err) {
                        console.error("Approve settlement failed:", err);
                        showNotification('Failed to approve settlement.', true);
                        window.closeModal();
                    }
                };
            };
        });
    };

    const loadStatsTable = async () => {
        const selectedMonth = document.getElementById('settlement-month-select')?.value || new Date().toISOString().slice(0, 7);
        const tbody = document.getElementById('settlement-stats-table-body');
        if (!tbody) return;

        try {
            // Load sub-admins
            const adminsQuery = query(collection(db, `artifacts/${appId}/public/data/users`), where("role", "==", "admin"));
            const adminsSnap = await getDocs(adminsQuery);
            const subAdmins = adminsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.id !== ADMIN_UID);

            // Load monthly stats for selectedMonth
            const statsQuery = query(collection(db, `artifacts/${appId}/public/data/subadmin_monthly_stats`), where("yearMonth", "==", selectedMonth));
            const statsSnap = await getDocs(statsQuery);
            const statsMap = new Map();
            statsSnap.docs.forEach(d => {
                statsMap.set(d.data().subAdminId, d.data());
            });

            if (subAdmins.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-400">No sub-admins configured.</td></tr>`;
                return;
            }

            tbody.innerHTML = subAdmins.map(admin => {
                const stats = statsMap.get(admin.id) || {};
                const taskAmount = Number(stats.taskAmount || 0);
                const withdrawApproved = Number(stats.withdrawApproved || 0);
                const withdrawRejected = Number(stats.withdrawRejected || 0);
                const totalSettled = Number(admin.settlementPaid || 0);
                const totalWithdrawApproved = Number(admin.totalWithdrawApproved || 0);
                const netDue = Math.max(0, totalWithdrawApproved - totalSettled);

                return `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td class="py-3.5 px-4 font-black text-gray-900 dark:text-white">
                        ${escapeHtml(admin.name || 'Sub-Admin')}
                        <span class="block text-[10px] font-semibold text-gray-400">${escapeHtml(admin.email)}</span>
                    </td>
                    <td class="py-3.5 px-4 text-center font-bold text-gray-700 dark:text-gray-300">${formatCurrency(taskAmount)}</td>
                    <td class="py-3.5 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">${formatCurrency(withdrawApproved)}</td>
                    <td class="py-3.5 px-4 text-center font-bold text-rose-600 dark:text-rose-450">${formatCurrency(withdrawRejected)}</td>
                    <td class="py-3.5 px-4 text-center font-bold text-slate-500">${formatCurrency(totalSettled)}</td>
                    <td class="py-3.5 px-4 text-center font-black text-amber-700 dark:text-amber-300 bg-amber-50/20 dark:bg-amber-950/5">${formatCurrency(netDue)}</td>
                </tr>`;
            }).join('');
        } catch (e) {
            console.error("Load settlement stats table failed:", e);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500">Failed to load statistics.</td></tr>`;
        }
    };

    bindPaymentButtons();
    loadStatsTable();

    document.getElementById('settlement-month-select')?.addEventListener('change', loadStatsTable);
};

window.showAdminSettlementPage = showAdminSettlementPage;
