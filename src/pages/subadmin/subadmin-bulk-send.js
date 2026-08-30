// File: src/pages/subadmin/subadmin-bulk-send.js

let bulkSendQueue = [];
let bulkSendLookupTimer = null;

const showAdminBulkSendPage = () => {
    if (!currentUser) return showNotification('Please login first.', true);

    const isAdmin = currentUser.uid === ADMIN_UID ||
        currentUser.email === 'reviewsworld51@gmail.com' ||
        currentUser.email === 'reviewsworld01@gmail.com' ||
        currentUserData?.role === 'owner' ||
        currentUserData?.role === 'admin' ||
        currentUserData?.role === 'subadmin' ||
        (typeof checkIsUserAdmin === 'function' && checkIsUserAdmin(currentUser, currentUserData));

    if (!isAdmin) {
        return showNotification('Unauthorized! Admin access required.', true);
    }

    currentMainSection = 'admin';

    const content = `
        ${getPageHeader('Bulk Send Money')}
        <div class="max-w-4xl mx-auto space-y-5 pb-24 px-3 sm:px-4">
            <!-- Header Balance & Info Card -->
            <div class="relative overflow-hidden bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 rounded-2xl p-5 text-white shadow-lg">
                <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-black uppercase tracking-wider">Multi-User Transfer</span>
                            <span class="text-xs opacity-75">Admin Payout Engine</span>
                        </div>
                        <h2 class="text-xl sm:text-2xl font-black mt-1">Send Money to Multiple Users</h2>
                        <p class="text-xs text-white/80 mt-1 max-w-lg leading-relaxed">
                            Type mobile number on the left, amount on the right, and click <strong>+</strong>. Add a remark for all recipients and transfer instantly in one click!
                        </p>
                    </div>
                    <div class="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-3.5 sm:min-w-44 text-right">
                        <span class="text-[11px] font-bold text-white/75 block">Your Wallet Balance</span>
                        <span class="text-xl sm:text-2xl font-black text-white" id="bulk-admin-wallet-bal">${formatCurrency(currentUserData?.balance || 0)}</span>
                    </div>
                </div>
                <div class="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/5 border border-white/10"></div>
            </div>

            <!-- Quick Add Recipient Form Card -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-150 dark:border-gray-700 space-y-3">
                <div class="flex items-center justify-between">
                    <label class="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Add Recipient to Queue</label>
                    <button type="button" id="bulk-paste-open-btn" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                        Bulk Paste / Multi-Line Import
                    </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                    <!-- Left Side: Mobile Number -->
                    <div class="sm:col-span-6 space-y-1">
                        <div class="relative flex items-center">
                            <span class="absolute left-3 text-gray-400 text-xs font-bold">+91</span>
                            <input id="bulk-mobile-input" type="tel" maxlength="10" placeholder="Recipient 10-digit mobile" class="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white" />
                        </div>
                        <div id="bulk-user-preview" class="text-[11px] text-gray-400 pl-1 min-h-[16px]">Type 10 digits to verify user</div>
                    </div>

                    <!-- Right Side: Amount -->
                    <div class="sm:col-span-4 space-y-1">
                        <div class="relative flex items-center">
                            <span class="absolute left-3 text-gray-400 text-sm font-bold">₹</span>
                            <input id="bulk-amount-input" type="number" min="1" step="any" placeholder="Amount" class="w-full pl-7 pr-3 py-2.5 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white" />
                        </div>
                        <div class="text-[10px] text-gray-400 pl-1">Min ₹1 per transfer</div>
                    </div>

                    <!-- Plus Button -->
                    <div class="sm:col-span-2">
                        <button type="button" id="bulk-add-btn" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-black rounded-xl text-sm shadow-md transition flex items-center justify-center gap-1">
                            <span class="text-base leading-none font-bold">+</span>
                            <span>Add</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Recipient Queue List Card -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-150 dark:border-gray-700 space-y-4">
                <div class="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <div class="flex items-center gap-2">
                        <h3 class="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-wider">Transfer Queue</h3>
                        <span id="bulk-queue-badge" class="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold">0 Users</span>
                    </div>
                    <button type="button" id="bulk-clear-all-btn" class="text-xs font-bold text-red-500 hover:text-red-700 hover:underline transition hidden">Clear All</button>
                </div>

                <!-- Queue Container -->
                <div id="bulk-queue-list" class="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    <div class="text-center py-10 text-gray-400 text-xs italic">
                        No recipients added yet. Enter a mobile number and amount above, or click "Bulk Paste" to load multiple users.
                    </div>
                </div>

                <!-- Common Remarks Box -->
                <div class="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
                    <label class="block text-xs font-bold text-gray-600 dark:text-gray-400">Common Remarks / Note (Applied to all recipients)</label>
                    <input id="bulk-remarks-input" type="text" placeholder="e.g. Review Task Reward, Referral Bonus, Event Prize..." value="Wallet Payout from Admin" class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white" />
                </div>
            </div>

            <!-- Summary & Send Action Card -->
            <div class="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-4 sm:p-5 text-white shadow-md space-y-4">
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                    <div class="bg-white/10 rounded-xl p-3 border border-white/10">
                        <span class="text-[11px] text-white/70 block">Total Recipients</span>
                        <span id="bulk-summary-count" class="text-lg sm:text-xl font-black text-white">0 Users</span>
                    </div>
                    <div class="bg-white/10 rounded-xl p-3 border border-white/10">
                        <span class="text-[11px] text-white/70 block">Total Transfer Amount</span>
                        <span id="bulk-summary-total" class="text-lg sm:text-xl font-black text-emerald-400">₹0.00</span>
                    </div>
                    <div class="bg-white/10 rounded-xl p-3 border border-white/10 col-span-2 sm:col-span-1">
                        <span class="text-[11px] text-white/70 block">Balance After Payout</span>
                        <span id="bulk-summary-remaining" class="text-lg sm:text-xl font-black text-amber-300">${formatCurrency(currentUserData?.balance || 0)}</span>
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row gap-2 pt-1">
                    <button type="button" onclick="window.showAdminMainPage()" class="py-3 px-5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition text-center">
                        Cancel
                    </button>
                    <button type="button" id="bulk-execute-btn" disabled class="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm shadow-lg transition active:scale-98 flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        <span id="bulk-execute-label">Send Money to All (0 Users)</span>
                    </button>
                </div>
            </div>
        </div>
        ${getPageFooter()}
    `;

    showPage(content, {
        returnTo: 'admin',
        onBack: () => {
            if (typeof showAdminMainPage === 'function') showAdminMainPage();
            else if (typeof hidePage === 'function') hidePage();
        }
    });

    setBottomNavActive('bottom-admin-btn');
    attachBulkSendListeners();
    renderBulkSendQueue();
};

const attachBulkSendListeners = () => {
    const mobileInput = document.getElementById('bulk-mobile-input');
    const amountInput = document.getElementById('bulk-amount-input');
    const addBtn = document.getElementById('bulk-add-btn');
    const clearBtn = document.getElementById('bulk-clear-all-btn');
    const pasteBtn = document.getElementById('bulk-paste-open-btn');
    const executeBtn = document.getElementById('bulk-execute-btn');

    mobileInput?.addEventListener('input', () => {
        const val = mobileInput.value.replace(/\D/g, '').slice(0, 10);
        mobileInput.value = val;
        handleBulkUserLookup(val);
    });

    amountInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddQueueRow();
        }
    });

    addBtn?.addEventListener('click', handleAddQueueRow);
    clearBtn?.addEventListener('click', handleClearBulkQueue);
    pasteBtn?.addEventListener('click', showBulkPasteImportModal);
    executeBtn?.addEventListener('click', handleConfirmExecuteBulkSend);
};

const handleBulkUserLookup = (mobile) => {
    const preview = document.getElementById('bulk-user-preview');
    if (!preview) return;

    if (bulkSendLookupTimer) clearTimeout(bulkSendLookupTimer);

    if (mobile.length < 10) {
        preview.className = 'text-[11px] text-gray-400 pl-1 min-h-[16px]';
        preview.textContent = 'Type 10 digits to verify user';
        return;
    }

    preview.className = 'text-[11px] text-orange-500 pl-1 min-h-[16px] animate-pulse';
    preview.textContent = 'Searching user in database...';

    bulkSendLookupTimer = setTimeout(async () => {
        try {
            const user = await findUserByMobileFast(mobile);
            if (user) {
                preview.className = 'text-[11px] text-emerald-600 dark:text-emerald-400 font-bold pl-1 min-h-[16px]';
                preview.textContent = `✓ ${user.name || 'User'} (${user.email ? user.email.split('@')[0] : 'No Email'}) • Bal: ${formatCurrency(user.balance || 0)}`;
            } else {
                preview.className = 'text-[11px] text-red-500 font-semibold pl-1 min-h-[16px]';
                preview.textContent = `✗ No registered user found with mobile ${mobile}`;
            }
        } catch (_) {
            preview.className = 'text-[11px] text-gray-400 pl-1 min-h-[16px]';
            preview.textContent = 'User lookup skipped.';
        }
    }, 250);
};

const findUserByMobileFast = async (mobile) => {
    const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length < 10) return null;

    // 1. Check local cache
    const cached = (allUsersCache || []).find(u => {
        const uMob = String(u.mobile || u.phoneNumber || '').replace(/\D/g, '').slice(-10);
        return uMob === cleanMobile;
    });
    if (cached) return cached;

    // 2. Query Firestore
    try {
        const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
        const q1 = query(usersRef, where("mobile", "==", cleanMobile));
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
            const d = snap1.docs[0];
            return { uid: d.id, id: d.id, ...d.data() };
        }
    } catch (_) {}

    return null;
};

const handleAddQueueRow = async () => {
    const mobileInput = document.getElementById('bulk-mobile-input');
    const amountInput = document.getElementById('bulk-amount-input');
    if (!mobileInput || !amountInput) return;

    const mobile = mobileInput.value.replace(/\D/g, '').trim();
    const amount = parseFloat(amountInput.value);

    if (!mobile || mobile.length < 10) {
        return showNotification('Please enter a valid 10-digit mobile number.', true);
    }
    if (isNaN(amount) || amount < 1) {
        return showNotification('Please enter a valid amount (Min ₹1).', true);
    }

    // Check duplicate in queue
    const existingIndex = bulkSendQueue.findIndex(r => r.mobile === mobile);
    if (existingIndex >= 0) {
        bulkSendQueue[existingIndex].amount += amount;
        showNotification(`Updated amount for ${mobile} to ${formatCurrency(bulkSendQueue[existingIndex].amount)}`);
        mobileInput.value = '';
        amountInput.value = '';
        renderBulkSendQueue();
        mobileInput.focus();
        return;
    }

    showLoading('Verifying recipient...');
    try {
        const user = await findUserByMobileFast(mobile);
        if (!user) {
            hideLoading();
            return showNotification(`User with mobile ${mobile} not found in database.`, true);
        }

        bulkSendQueue.push({
            id: `row-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            mobile: mobile,
            user: {
                uid: user.uid || user.id,
                name: user.name || 'User',
                email: user.email || '',
                mobile: user.mobile || mobile,
                balance: user.balance || 0,
                isProProfile: !!user.isProProfile
            },
            amount: amount
        });

        mobileInput.value = '';
        amountInput.value = '';
        document.getElementById('bulk-user-preview').textContent = 'Type 10 digits to verify user';
        document.getElementById('bulk-user-preview').className = 'text-[11px] text-gray-400 pl-1 min-h-[16px]';

        renderBulkSendQueue();
        mobileInput.focus();
    } catch (e) {
        console.error('Failed to add queue row:', e);
        showNotification('Error verifying user: ' + e.message, true);
    } finally {
        hideLoading();
    }
};

const handleRemoveQueueRow = (id) => {
    bulkSendQueue = bulkSendQueue.filter(r => r.id !== id);
    renderBulkSendQueue();
};

const handleUpdateQueueAmount = (id, newAmount) => {
    const val = parseFloat(newAmount);
    const row = bulkSendQueue.find(r => r.id === id);
    if (row && !isNaN(val) && val >= 1) {
        row.amount = val;
        updateBulkSendSummary();
    }
};

const handleClearBulkQueue = () => {
    if (!bulkSendQueue.length) return;
    if (!confirm('Are you sure you want to clear the entire recipient queue?')) return;
    bulkSendQueue = [];
    renderBulkSendQueue();
};

const renderBulkSendQueue = () => {
    const list = document.getElementById('bulk-queue-list');
    const badge = document.getElementById('bulk-queue-badge');
    const clearBtn = document.getElementById('bulk-clear-all-btn');
    if (!list) return;

    if (badge) badge.textContent = `${bulkSendQueue.length} ${bulkSendQueue.length === 1 ? 'User' : 'Users'}`;
    if (clearBtn) clearBtn.classList.toggle('hidden', bulkSendQueue.length === 0);

    if (!bulkSendQueue.length) {
        list.innerHTML = `
            <div class="text-center py-10 text-gray-400 text-xs italic">
                No recipients added yet. Enter a mobile number and amount above, or click "Bulk Paste" to load multiple users.
            </div>`;
        updateBulkSendSummary();
        return;
    }

    list.innerHTML = bulkSendQueue.map((row, idx) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-750 hover:bg-indigo-50/50 dark:hover:bg-gray-700 rounded-xl border border-gray-200/70 dark:border-gray-600/70 transition gap-2">
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-black shrink-0">${idx + 1}</span>
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold truncate text-gray-800 dark:text-gray-100 flex items-center gap-1">
                        ${escapeHtml(row.user.name)}
                        ${row.user.isProProfile ? `<span class="text-[9px] bg-amber-100 dark:bg-amber-900/40 text-amber-600 px-1 py-0.2 rounded font-black">PRO</span>` : ''}
                    </p>
                    <p class="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">+91 ${row.mobile}</p>
                </div>
            </div>

            <!-- Amount Input -->
            <div class="flex items-center gap-1.5 shrink-0">
                <div class="relative flex items-center w-24">
                    <span class="absolute left-2 text-gray-400 text-xs font-bold">₹</span>
                    <input type="number" min="1" step="any" value="${row.amount}" onchange="window.handleUpdateQueueAmount('${row.id}', this.value)" class="w-full pl-5 pr-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-black text-right focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white" />
                </div>
                <button type="button" onclick="window.handleRemoveQueueRow('${row.id}')" class="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition" title="Remove recipient">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
            </div>
        </div>
    `).join('');

    updateBulkSendSummary();
};

const updateBulkSendSummary = () => {
    const totalCount = bulkSendQueue.length;
    const totalAmount = bulkSendQueue.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const adminBal = Number(currentUserData?.balance || 0);
    const remainingBal = adminBal - totalAmount;

    const countEl = document.getElementById('bulk-summary-count');
    const totalEl = document.getElementById('bulk-summary-total');
    const remainingEl = document.getElementById('bulk-summary-remaining');
    const executeBtn = document.getElementById('bulk-execute-btn');
    const executeLabel = document.getElementById('bulk-execute-label');

    if (countEl) countEl.textContent = `${totalCount} ${totalCount === 1 ? 'User' : 'Users'}`;
    if (totalEl) totalEl.textContent = formatCurrency(totalAmount);
    if (remainingEl) {
        remainingEl.textContent = formatCurrency(remainingBal);
        remainingEl.className = remainingBal < 0 ? 'text-lg sm:text-xl font-black text-red-400' : 'text-lg sm:text-xl font-black text-amber-300';
    }

    if (executeBtn) {
        executeBtn.disabled = totalCount === 0 || totalAmount <= 0;
    }
    if (executeLabel) {
        executeLabel.textContent = `Send Money to All (${totalCount} Users)`;
    }
};

const showBulkPasteImportModal = () => {
    renderModal('Multi-Line Paste / Import',
        `<div class="space-y-3 text-xs">
            <p class="text-gray-500 dark:text-gray-400">
                Paste multiple rows below with <strong>Mobile Number</strong> and <strong>Amount</strong> separated by space, comma, or colon.
            </p>
            <div class="bg-gray-100 dark:bg-gray-750 p-2.5 rounded-xl font-mono text-[11px] text-gray-600 dark:text-gray-300">
                Example:<br>
                9876543210 500<br>
                9123456789, 250<br>
                9988776655: 1000
            </div>
            <textarea id="bulk-paste-textarea" rows="7" placeholder="Paste rows here..." class="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white"></textarea>
        </div>`,
        `<div class="flex justify-end gap-2">
            <button onclick="window.closeModal()" class="px-4 py-2 text-xs bg-gray-200 dark:bg-gray-700 font-bold rounded-lg">Cancel</button>
            <button id="bulk-paste-submit-btn" class="px-5 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg shadow">Import Recipients</button>
        </div>`,
        'max-w-md');

    document.getElementById('bulk-paste-submit-btn')?.addEventListener('click', async () => {
        const textarea = document.getElementById('bulk-paste-textarea');
        const text = textarea ? textarea.value.trim() : '';
        if (!text) return showNotification('Please paste content first.', true);

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length) return showNotification('No valid lines found.', true);

        window.closeModal();
        showLoading(`Processing ${lines.length} lines...`);

        let addedCount = 0;
        let skippedCount = 0;

        for (const line of lines) {
            const parts = line.split(/[\s,;:\t]+/).filter(Boolean);
            if (parts.length >= 2) {
                const mob = parts[0].replace(/\D/g, '').slice(-10);
                const amt = parseFloat(parts[1]);
                if (mob.length === 10 && !isNaN(amt) && amt >= 1) {
                    try {
                        const user = await findUserByMobileFast(mob);
                        if (user) {
                            const existing = bulkSendQueue.find(r => r.mobile === mob);
                            if (existing) {
                                existing.amount += amt;
                            } else {
                                bulkSendQueue.push({
                                    id: `row-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                                    mobile: mob,
                                    user: {
                                        uid: user.uid || user.id,
                                        name: user.name || 'User',
                                        email: user.email || '',
                                        mobile: user.mobile || mob,
                                        balance: user.balance || 0,
                                        isProProfile: !!user.isProProfile
                                    },
                                    amount: amt
                                });
                            }
                            addedCount++;
                        } else {
                            skippedCount++;
                        }
                    } catch (_) {
                        skippedCount++;
                    }
                } else {
                    skippedCount++;
                }
            } else {
                skippedCount++;
            }
        }

        hideLoading();
        renderBulkSendQueue();
        showNotification(`Imported ${addedCount} recipients. ${skippedCount > 0 ? `(${skippedCount} skipped/not found)` : ''}`);
    });
};

const handleConfirmExecuteBulkSend = () => {
    if (!bulkSendQueue.length) return showNotification('Recipient queue is empty.', true);

    const totalCount = bulkSendQueue.length;
    const totalAmount = bulkSendQueue.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const remarks = document.getElementById('bulk-remarks-input')?.value.trim() || 'Wallet Payout from Admin';
    const adminBal = Number(currentUserData?.balance || 0);

    if (adminBal < totalAmount && currentUser.uid !== ADMIN_UID) {
        return showNotification(`Insufficient admin wallet balance! Needed: ${formatCurrency(totalAmount)}, Current: ${formatCurrency(adminBal)}`, true);
    }

    renderModal('Confirm Bulk Money Transfer',
        `<div class="space-y-4 text-center py-2">
            <div class="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 mx-auto flex items-center justify-center text-2xl shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <div class="space-y-1">
                <h3 class="text-lg font-black text-gray-800 dark:text-gray-100">Send Money to ${totalCount} Users?</h3>
                <p class="text-xs text-gray-500">Total Payout: <strong class="text-emerald-600 text-sm font-black">${formatCurrency(totalAmount)}</strong></p>
                <p class="text-[11px] text-gray-400 font-medium">Remarks: "${escapeHtml(remarks)}"</p>
            </div>
            <div class="bg-gray-50 dark:bg-gray-750 p-3 rounded-xl border border-gray-200 dark:border-gray-600 text-left text-xs space-y-1.5">
                <div class="flex justify-between"><span class="text-gray-500">Recipients:</span><span class="font-bold">${totalCount} users</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Total Amount:</span><span class="font-bold text-emerald-600">${formatCurrency(totalAmount)}</span></div>
                <div class="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-1.5"><span class="text-gray-500">Your Balance After:</span><span class="font-bold">${formatCurrency(adminBal - totalAmount)}</span></div>
            </div>
            <p class="text-[10px] text-red-500 font-semibold">⚠️ All transfers are executed instantly and cannot be reversed.</p>
        </div>`,
        `<div class="flex justify-end gap-2 w-full">
            <button onclick="window.closeModal()" class="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold">Cancel</button>
            <button id="bulk-execute-confirm-btn" class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md">Confirm & Send</button>
        </div>`,
        'max-w-md', true);

    document.getElementById('bulk-execute-confirm-btn')?.addEventListener('click', () => {
        executeBulkSendMoney(remarks);
    });
};

const executeBulkSendMoney = async (remarks) => {
    window.closeModal();

    const queueToProcess = [...bulkSendQueue];
    const totalCount = queueToProcess.length;
    let successCount = 0;
    let failedCount = 0;
    const results = [];

    showLoading(`Processing bulk transfer 1 of ${totalCount}...`);

    for (let i = 0; i < totalCount; i++) {
        const item = queueToProcess[i];
        showLoading(`Processing transfer ${i + 1} of ${totalCount}: ${item.user.name} (+91 ${item.mobile})...`);

        try {
            const senderTxnId = `BULK-SEND-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
            const recipientTxnId = `BULK-RCV-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
            const amount = Number(item.amount);

            let senderCloudTxn = null;
            let recipientCloudTxn = null;

            await runTransaction(db, async (tx) => {
                const adminRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                const recipientRef = doc(db, `artifacts/${appId}/public/data/users`, item.user.uid);

                const adminDoc = await tx.get(adminRef);
                const recipientDoc = await tx.get(recipientRef);

                if (!recipientDoc.exists()) {
                    throw new Error("Recipient account not found");
                }

                const adminBal = adminDoc.exists() ? (adminDoc.data().balance || 0) : 0;
                const recipientBal = recipientDoc.data().balance || 0;

                // Update balances
                tx.update(recipientRef, {
                    balance: recipientBal + amount,
                    lastReceivedAt: serverTimestamp()
                });

                tx.update(adminRef, {
                    balance: adminBal - amount,
                    lastSentAt: serverTimestamp()
                });

                senderCloudTxn = {
                    type: 'debit',
                    amount: amount,
                    comment: remarks ? `${remarks} (Sent to ${item.user.name})` : `Sent to ${item.user.name} (+91 ${item.mobile})`,
                    timestamp: Date.now(),
                    recipientName: item.user.name,
                    recipientMobile: item.mobile,
                    recipientIsProProfile: item.user.isProProfile,
                    senderName: currentUserData?.name || 'Administrator',
                    senderMobile: currentUserData?.mobile || '',
                    transactionId: senderTxnId,
                    balanceBefore: adminBal,
                    balanceAfter: adminBal - amount,
                    status: 'completed'
                };

                recipientCloudTxn = {
                    type: 'wallet_transfer',
                    amount: amount,
                    comment: remarks || `Received from Admin (${currentUserData?.name || 'REVIEWS WORLD'})`,
                    timestamp: Date.now(),
                    senderName: currentUserData?.name || 'Administrator',
                    senderMobile: currentUserData?.mobile || '',
                    recipientName: item.user.name,
                    recipientMobile: item.mobile,
                    recipientIsProProfile: item.user.isProProfile,
                    transactionId: recipientTxnId,
                    balanceBefore: recipientBal,
                    balanceAfter: recipientBal + amount,
                    status: 'completed'
                };

                const senderTxnRef = doc(collection(db, `artifacts/${appId}/public/data/users/${currentUser.uid}/transactions`));
                const recipientTxnRef = doc(collection(db, `artifacts/${appId}/public/data/users/${item.user.uid}/transactions`));

                tx.set(senderTxnRef, {
                    ...senderCloudTxn,
                    createdAt: serverTimestamp()
                });

                tx.set(recipientTxnRef, {
                    ...recipientCloudTxn,
                    createdAt: serverTimestamp()
                });
            });

            // Sync to Cloudflare D1
            if (senderCloudTxn && recipientCloudTxn && typeof syncCloudflareTransfer === 'function') {
                syncCloudflareTransfer(senderCloudTxn, recipientCloudTxn, item.user.uid).catch(() => {});
            }

            // In-app Notification to Recipient
            try {
                const notifRef = collection(db, `artifacts/${appId}/public/data/users/${item.user.uid}/notifications`);
                addDoc(notifRef, {
                    title: 'Money Received in Wallet! 💰',
                    message: `You received ₹${amount.toLocaleString('en-IN')} from Admin. Note: ${remarks || 'Direct Wallet Transfer'}`,
                    type: 'money_received',
                    amount: amount,
                    read: false,
                    createdAt: serverTimestamp()
                }).catch(() => {});
            } catch (_) {}

            successCount++;
            results.push({ item, status: 'success' });
        } catch (err) {
            console.error(`Bulk transfer failed for ${item.mobile}:`, err);
            failedCount++;
            results.push({ item, status: 'failed', error: err.message });
        }
    }

    hideLoading();

    // Remove successful items from queue
    bulkSendQueue = bulkSendQueue.filter(r => results.some(res => res.item.id === r.id && res.status === 'failed'));

    // Refresh current user data & caches
    try {
        const adminSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid));
        if (adminSnap.exists()) {
            currentUserData = { ...currentUserData, ...adminSnap.data() };
            const balEl = document.getElementById('user-balance');
            const adminBalEl = document.getElementById('admin-wallet-balance');
            const bulkBalEl = document.getElementById('bulk-admin-wallet-bal');
            if (balEl) balEl.textContent = formatCurrency(currentUserData.balance || 0);
            if (adminBalEl) adminBalEl.textContent = formatCurrency(currentUserData.balance || 0);
            if (bulkBalEl) bulkBalEl.textContent = formatCurrency(currentUserData.balance || 0);
        }
        if (typeof refreshAdminDashboardCaches === 'function') refreshAdminDashboardCaches();
    } catch (_) {}

    renderBulkSendQueue();

    // Render results summary modal
    renderModal('Bulk Transfer Summary',
        `<div class="space-y-4 py-2">
            <div class="grid grid-cols-2 gap-3 text-center">
                <div class="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <span class="text-xs text-emerald-700 dark:text-emerald-300 font-bold block">Successful</span>
                    <span class="text-2xl font-black text-emerald-600">${successCount}</span>
                </div>
                <div class="bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-800">
                    <span class="text-xs text-red-700 dark:text-red-300 font-bold block">Failed</span>
                    <span class="text-2xl font-black text-red-600">${failedCount}</span>
                </div>
            </div>

            <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                ${results.map((res, i) => `
                    <div class="flex items-center justify-between p-2.5 rounded-xl border text-xs ${res.status === 'success' ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200' : 'bg-red-50/50 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/60 text-red-900 dark:text-red-200'}">
                        <div>
                            <p class="font-bold">${i + 1}. ${escapeHtml(res.item.user.name)} (+91 ${res.item.mobile})</p>
                            ${res.error ? `<p class="text-[10px] text-red-500">${escapeHtml(res.error)}</p>` : ''}
                        </div>
                        <span class="font-black text-sm">${res.status === 'success' ? '✓ ' : '✗ '}${formatCurrency(res.item.amount)}</span>
                    </div>
                `).join('')}
            </div>
        </div>`,
        `<div class="flex justify-end">
            <button onclick="window.closeModal()" class="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow">Done</button>
        </div>`,
        'max-w-md');
};

// Window exports
window.showAdminBulkSendPage = showAdminBulkSendPage;
window.handleUpdateQueueAmount = handleUpdateQueueAmount;
window.handleRemoveQueueRow = handleRemoveQueueRow;
window.handleClearBulkQueue = handleClearBulkQueue;
window.showBulkPasteImportModal = showBulkPasteImportModal;
window.handleConfirmExecuteBulkSend = handleConfirmExecuteBulkSend;
