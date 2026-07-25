// File: src/pages/admin/admin-audit.js

const getAdminFilteredFundRequests = () => {
            if (!Array.isArray(allFundRequestsCache)) return [];
            const isOwner = checkIsOwner(currentUser, currentUserData);
            const subAdminUid = currentUser?.uid || (typeof getCurrentUserId === 'function' ? getCurrentUserId() : '');
            return allFundRequestsCache.filter(r => {
                const u = allUsersCache.find(user => (user.id || user.uid) === r.userId);
                if (isOwner) {
                    return !u || !u.parentAdmin || u.parentAdmin === ADMIN_UID || u.parent_admin === ADMIN_UID;
                } else {
                    const parent = r.parentAdmin || r.parent_admin || (u ? (u.parentAdmin || u.parent_admin) : '');
                    return String(parent) === String(subAdminUid);
                }
            });
        };

const updateAdminPendingRequestSummary = () => {
            const filteredRequests = getAdminFilteredFundRequests();
            const totalPendingAmount = filteredRequests.reduce((total, req) => total + (req.amount || 0), 0);
            const pendingElement = document.getElementById('admin-pending-withdrawals');
            if (pendingElement) {
                pendingElement.innerHTML = `${filteredRequests.length}<br><span class="text-sm font-normal">${formatCurrency(totalPendingAmount)}</span>`;
            }
            const analyticsPendingElement = document.getElementById('analytics-pending-reqs');
            if (analyticsPendingElement) {
                analyticsPendingElement.textContent = filteredRequests.length;
            }
            ['admin-withdrawal-request-badge'].forEach((id) => {
                const badge = document.getElementById(id);
                if (!badge) return;
                badge.textContent = filteredRequests.length > 99 ? '99+' : String(filteredRequests.length || '');
                badge.classList.toggle('hidden', filteredRequests.length <= 0);
            });
            const analyticsPendingAmountElement = document.getElementById('analytics-pending-amount');
            if (analyticsPendingAmountElement) {
                analyticsPendingAmountElement.textContent = formatCurrency(totalPendingAmount);
            }
            rememberAdminDashboardMetrics({
                pendingWithdrawals: filteredRequests.length,
                pendingWithdrawalAmount: formatCurrency(totalPendingAmount)
            });
        };

const getProfilePaymentSummaryText = (method, data = currentUserData || {}) => {
            const details = getProfilePaymentDetails(method, data);
            if (method === 'upi') return details.upiId || data.upiId || '';
            if (method === 'bank') {
                return [
                    details.accountNumber || data.accountNumber,
                    details.ifsc || data.ifsc,
                    details.bankName || data.bankName,
                    details.accountName || data.accountName
                ].filter(Boolean).join(' | ');
            }
            if (['play_store', 'amazon_gift', 'flipkart_gift', 'paypal'].includes(method)) {
                return details.email || data.paymentEmail || '';
            }
            if (typeof data.paymentDetails === 'string') return data.paymentDetails;
            if (data.paymentDetails && typeof data.paymentDetails === 'object') {
                const detailLabels = {
                    upiId: 'UPI',
                    accountNumber: 'A/C',
                    ifsc: 'IFSC',
                    bankName: 'Bank',
                    accountName: 'Name',
                    email: 'Email'
                };
                return Object.entries(data.paymentDetails)
                    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
                    .map(([key, value]) => `${detailLabels[key] || toTitleText(key)}: ${value}`)
                    .join(' | ');
            }
            return [
                data.upiId && `UPI: ${data.upiId}`,
                data.accountNumber && `A/C: ${data.accountNumber}`,
                data.ifsc && `IFSC: ${data.ifsc}`,
                data.bankName && `Bank: ${data.bankName}`,
                data.accountName && `Name: ${data.accountName}`,
                data.paymentEmail && `Email: ${data.paymentEmail}`
            ].filter(Boolean).join(' | ');
        };

const showAdminAuditPage = async () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            currentMainSection = 'admin';
            const content = `
                ${getPageHeader('Sync Audit')}
                <div class="max-w-5xl mx-auto space-y-4 pb-24">
                    <section class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-950 via-emerald-900 to-cyan-700 p-5 text-white shadow-xl">
                        <div class="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/15"></div>
                        <div class="relative">
                            <p class="text-xs font-black uppercase tracking-wide text-white/65">Admin</p>
                            <h2 class="mt-1 text-xl font-black">Cloudflare / Firebase Sync Audit</h2>
                            <p class="mt-1 text-sm text-white/75">Monitor data consistency between D1 and Firestore.</p>
                            <div class="mt-3 grid grid-cols-3 gap-2">
                                <div class="rounded-xl bg-white/15 px-3 py-2 text-center"><p class="text-[9px] font-bold uppercase text-white/60">Failed</p><p id="audit-failed-count" class="text-lg font-black text-red-300">-</p></div>
                                <div class="rounded-xl bg-white/15 px-3 py-2 text-center"><p class="text-[9px] font-bold uppercase text-white/60">Pending</p><p id="audit-pending-count" class="text-lg font-black text-yellow-300">-</p></div>
                                <div class="rounded-xl bg-white/15 px-3 py-2 text-center"><p class="text-[9px] font-bold uppercase text-white/60">Resolved</p><p id="audit-resolved-count" class="text-lg font-black text-green-300">-</p></div>
                            </div>
                        </div>
                    </section>
                    <section class="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                        <h3 class="text-sm font-black mb-3">D1 Database Counts</h3>
                        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2" id="audit-d1-counts">
                            <div class="rounded-xl bg-gray-50 dark:bg-gray-900 p-3 text-center"><p class="text-[9px] font-bold uppercase text-gray-400">Users</p><p id="audit-d1-users" class="text-lg font-black">-</p></div>
                            <div class="rounded-xl bg-gray-50 dark:bg-gray-900 p-3 text-center"><p class="text-[9px] font-bold uppercase text-gray-400">Transactions</p><p id="audit-d1-txns" class="text-lg font-black">-</p></div>
                            <div class="rounded-xl bg-gray-50 dark:bg-gray-900 p-3 text-center"><p class="text-[9px] font-bold uppercase text-gray-400">Fund Requests</p><p id="audit-d1-funds" class="text-lg font-black">-</p></div>
                            <div class="rounded-xl bg-gray-50 dark:bg-gray-900 p-3 text-center"><p class="text-[9px] font-bold uppercase text-gray-400">Submissions</p><p id="audit-d1-subs" class="text-lg font-black">-</p></div>
                            <div class="rounded-xl bg-gray-50 dark:bg-gray-900 p-3 text-center"><p class="text-[9px] font-bold uppercase text-gray-400">Active Locks</p><p id="audit-d1-locks" class="text-lg font-black">-</p></div>
                        </div>
                    </section>
                    <section class="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-3">
                        <div class="flex items-center justify-between gap-3">
                            <h3 class="text-sm font-black">Failed Sync Logs</h3>
                            <div class="flex gap-2">
                                <select id="audit-type-filter" class="rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-semibold">
                                    <option value="">All Types</option>
                                    <option value="transaction">Transaction</option>
                                    <option value="fund_request">Fund Request</option>
                                    <option value="task_submission">Task Submission</option>
                                    <option value="task_payout">Task Payout</option>
                                    <option value="user">User</option>
                                </select>
                                <button id="audit-refresh-btn" class="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 transition">Refresh</button>
                            </div>
                        </div>
                        <div id="audit-logs-list" class="space-y-2">
                            <div class="py-6 text-center text-sm text-gray-400">Loading audit data...</div>
                        </div>
                    </section>
                    <section class="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                        <div class="flex items-center justify-between gap-3">
                            <h3 class="text-sm font-black">Auto Payout</h3>
                            <button id="audit-run-payout-btn" class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition">Run Auto-Payout Now</button>
                        </div>
                        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Auto-payout runs daily at 8 PM IST for approved submissions past their delay period. Click above to trigger manually.</p>
                        <div id="audit-payout-pending" class="mt-3"></div>
                    </section>
                </div>`;
            showPage(content, { returnTo: 'admin', keepBottomNav: false });
            setBottomNavActive('bottom-admin-btn');
            loadAuditData();
            document.getElementById('audit-refresh-btn')?.addEventListener('click', loadAuditData);
            document.getElementById('audit-type-filter')?.addEventListener('change', loadAuditFailedLogs);
            document.getElementById('audit-run-payout-btn')?.addEventListener('click', async () => {
                try {
                    const token = await getBackendAuthToken();
                    const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/auto-payout/run`, {
                        method: 'POST', headers: { Authorization: `Bearer ${token}` }
                    }, 15000);
                    const data = await resp.json().catch(() => ({}));
                    showNotification(data.ok ? `Auto-payout processed: ${data.paidCount || 0} payments.` : 'Auto-payout failed.');
                    loadAuditData();
                } catch (err) {
                    showNotification('Auto-payout failed.', true);
                }
            });
        };

const loadAuditData = async () => {
            try {
                const token = await getBackendAuthToken();
                const [summaryResp, pendingResp] = await Promise.all([
                    fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/audit/summary`, { headers: { Authorization: `Bearer ${token}` } }, 10000),
                    fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/auto-payout/pending`, { headers: { Authorization: `Bearer ${token}` } }, 10000)
                ]);
                const summaryData = await summaryResp.json().catch(() => ({}));
                const pendingData = await pendingResp.json().catch(() => ({}));

                if (summaryData.ok) {
                    const failedEl = document.getElementById('audit-failed-count');
                    const pendingEl = document.getElementById('audit-pending-count');
                    const resolvedEl = document.getElementById('audit-resolved-count');
                    if (failedEl) failedEl.textContent = summaryData.sync?.totalFailed || 0;
                    if (pendingEl) pendingEl.textContent = summaryData.sync?.totalPending || 0;
                    if (resolvedEl) resolvedEl.textContent = summaryData.sync?.totalResolved || 0;
                    const counts = summaryData.d1Counts || {};
                    const usersEl = document.getElementById('audit-d1-users');
                    const txnsEl = document.getElementById('audit-d1-txns');
                    const fundsEl = document.getElementById('audit-d1-funds');
                    const subsEl = document.getElementById('audit-d1-subs');
                    const locksEl = document.getElementById('audit-d1-locks');
                    if (usersEl) usersEl.textContent = counts.users || 0;
                    if (txnsEl) txnsEl.textContent = counts.transactions || 0;
                    if (fundsEl) fundsEl.textContent = counts.fundRequests || 0;
                    if (subsEl) subsEl.textContent = counts.taskSubmissions || 0;
                    if (locksEl) locksEl.textContent = counts.activeReservations || 0;
                }

                if (pendingData.ok && Array.isArray(pendingData.pending)) {
                    const payoutEl = document.getElementById('audit-payout-pending');
                    if (payoutEl) {
                        if (pendingData.pending.length) {
                            payoutEl.innerHTML = `<p class="text-xs font-bold text-amber-600 mb-2">${pendingData.pending.length} pending payouts:</p>
                                <div class="space-y-1">${pendingData.pending.slice(0, 10).map(p => {
                                    const dueAt = p.payout_due_at || 0;
                                    const remaining = Math.max(0, dueAt - Date.now());
                                    const days = Math.ceil(remaining / 86400000);
                                    return `<div class="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2 text-xs">
                                        <span class="font-bold">${escapeHtml(p.user_name || p.user_email || 'User')} · ₹${p.reward || 0}</span>
                                        <span class="font-bold ${days <= 0 ? 'text-green-600' : 'text-gray-400'}">${days <= 0 ? 'Ready to pay' : `${days}d remaining`}</span>
                                    </div>`;
                                }).join('')}</div>`;
                        } else {
                            payoutEl.innerHTML = '<p class="text-xs text-gray-400">No pending payouts.</p>';
                        }
                    }
                }
            } catch (err) {
                console.error('Audit data load failed:', err);
                showNotification('Could not load audit data.', true);
            }
            loadAuditFailedLogs();
        };

const loadAuditFailedLogs = async () => {
            const logsEl = document.getElementById('audit-logs-list');
            if (!logsEl) return;
            try {
                const token = await getBackendAuthToken();
                const entityType = document.getElementById('audit-type-filter')?.value || '';
                const params = new URLSearchParams({ status: 'failed', limit: '100' });
                if (entityType) params.set('entityType', entityType);
                const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/audit/failed-syncs?${params.toString()}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }, 10000);
                const data = await resp.json().catch(() => ({}));
                if (!data.ok || !Array.isArray(data.logs) || !data.logs.length) {
                    logsEl.innerHTML = '<p class="rounded-2xl border border-dashed border-gray-200 py-6 text-center text-sm font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">No failed sync logs found. System is healthy! 🟢</p>';
                    return;
                }
                logsEl.innerHTML = data.logs.map(log => {
                    const timeStr = log.created_at ? new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unknown';
                    return `<div class="flex items-center gap-3 rounded-xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-4 py-3">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <span class="rounded-md bg-red-200 dark:bg-red-900/40 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-700 dark:text-red-300">${escapeHtml(log.entity_type)}</span>
                                <span class="text-[10px] text-gray-400">${escapeHtml(log.entity_id?.slice(0, 20) || '')}</span>
                            </div>
                            <p class="mt-1 text-xs text-red-600 dark:text-red-400 truncate">${escapeHtml(log.error_message || 'Unknown error')}</p>
                            <p class="text-[10px] text-gray-400">${log.source} → ${log.target} · ${timeStr}</p>
                        </div>
                        <button data-action="resolve-audit" data-logid="${log.id}" class="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-teal-700 transition">Resolve</button>
                    </div>`;
                }).join('');

                logsEl.querySelectorAll('[data-action="resolve-audit"]').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const logId = e.currentTarget.dataset.logid;
                        if (!logId) return;
                        try {
                            const token = await getBackendAuthToken();
                            await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/audit/resolve/${encodeURIComponent(logId)}`, {
                                method: 'POST', headers: { Authorization: `Bearer ${token}` }
                            }, 5000);
                            showNotification('Log resolved.');
                            loadAuditFailedLogs();
                        } catch (err) {
                            showNotification('Resolve failed.', true);
                        }
                    });
                });
            } catch (err) {
                logsEl.innerHTML = '<p class="py-6 text-center text-sm text-red-400">Failed to load sync logs.</p>';
            }
        };

const getBotTransactionSummary = (item = {}) => {
            const type = normalizeTransactionType(item);
            const amountValue = Number(item.chargeAmount ?? item.amount ?? 0);
            const amountText = formatCurrencyAbs(amountValue);
            const status = String(item.status || 'completed').toLowerCase();
            const statusText = status.charAt(0).toUpperCase() + status.slice(1);
            const senderName = item.senderName || item.fromName || item.payerName || item.senderMobile || '';
            const recipientName = item.recipientName || item.toName || item.payeeName || item.recipientMobile || '';
            const methodName = getWithdrawalDisplayMethodName(item, '');
            const adminName = 'REVIEWS WORLD';
            const dateText = formatDateDDMMYY(item.timestamp || item.requestedAt || item.processedAt);

            let title = 'Wallet transaction';
            let sign = amountValue < 0 ? '-' : '+';

            if (type === 'wallet_transfer') {
                const isOutgoing = amountValue < 0 || item.direction === 'sent' || item.isSender;
                sign = isOutgoing ? '-' : '+';
                title = isOutgoing
                    ? `Payment to ${recipientName || 'user'}`
                    : `Received from ${senderName || 'user'}`;
            } else if (type === 'debit') {
                sign = '-';
                title = recipientName
                    ? `Debit to ${recipientName}`
                    : (item.comment || item.remarks || 'Admin debit');
            } else if (type === 'withdrawal') {
                sign = '-';
                title = methodName ? `Withdrawal (${methodName})` : 'Withdrawal request';
            } else if (type === 'mobile_recharge') {
                sign = '-';
                title = `Mobile recharge${item.mobileNumber ? ` for ${item.mobileNumber}` : ''}`;
            } else if (type === 'gift_card') {
                sign = '+';
                title = `Gift code redeemed${item.giftCode ? ` (${item.giftCode})` : ''}`;
            } else if (type === 'credit') {
                sign = '+';
                title = senderName && senderName !== adminName
                    ? `Received from ${senderName}`
                    : (item.comment || item.remarks || `Received from ${adminName}`);
            } else if (amountValue < 0) {
                sign = '-';
                title = item.comment || item.remarks || String(item.type || 'Debit').replace(/_/g, ' ');
            } else if (item.type) {
                title = item.comment || item.remarks || String(item.type).replace(/_/g, ' ');
            }

            const balanceAfter = getExplicitBalanceAfter(item);
            const balanceText = balanceAfter !== null ? `, balance ${formatCurrency(balanceAfter)}` : '';
            const reasonText = item.rejectionReason ? `, reason: ${item.rejectionReason}` : '';
            return `${title} - ${sign}${amountText} - ${statusText} - ${dateText}${balanceText}${reasonText}`;
        };

const getRechargeSummary = () => {
            const amount = parseFloat(document.getElementById('recharge-amount-input')?.value || '0') || 0;
            const discount = Number((amount * RECHARGE_DISCOUNT_RATE).toFixed(2));
            const chargeAmount = Number((amount - discount).toFixed(2));
            return { amount, discount, chargeAmount };
        };

const updateRechargeSummary = () => {
            const summaryEl = document.getElementById('recharge-summary');
            if (!summaryEl) return;
            const { amount, discount, chargeAmount } = getRechargeSummary();
            summaryEl.innerHTML = `
                <div class="flex justify-between text-sm">
                    <span class="text-gray-500 dark:text-gray-400">Recharge Amount</span>
                    <span class="font-semibold">${formatCurrency(amount)}</span>
                </div>
                <div class="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>1% Discount</span>
                    <span>-${formatCurrency(discount)}</span>
                </div>
                <div class="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span class="font-semibold">Wallet Deduction</span>
                    <span class="font-bold text-sky-600 dark:text-sky-300">${formatCurrency(chargeAmount)}</span>
                </div>`;
        };

const getPartnerInvestmentSummary = () => {
            const amount = parseFloat(document.getElementById('partner-amount-input')?.value || '0') || 0;
            const months = parseInt(document.getElementById('partner-months-input')?.value || '0') || 0;
            const startDate = new Date();
            const endDate = months > 0 ? addMonthsClamped(startDate, months) : null;
            const monthlyInterest = Number((amount * PARTNER_INTEREST_RATE).toFixed(2));
            const totalInterest = Number((monthlyInterest * months).toFixed(2));
            return { amount, months, startDate, endDate, monthlyInterest, totalInterest };
        };

const updatePartnerInvestmentSummary = () => {
            const summaryEl = document.getElementById('partner-investment-summary');
            if (!summaryEl) return;
            const { amount, months, startDate, endDate, monthlyInterest, totalInterest } = getPartnerInvestmentSummary();
            summaryEl.innerHTML = `
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div class="rounded-xl bg-white/80 dark:bg-gray-800 p-3 border border-emerald-100 dark:border-emerald-800">
                        <p class="text-xs text-gray-500">Start Month</p>
                        <p class="font-bold">${startDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div class="rounded-xl bg-white/80 dark:bg-gray-800 p-3 border border-emerald-100 dark:border-emerald-800">
                        <p class="text-xs text-gray-500">Ending Month</p>
                        <p class="font-bold">${endDate ? endDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Select months'}</p>
                    </div>
                    <div class="rounded-xl bg-white/80 dark:bg-gray-800 p-3 border border-emerald-100 dark:border-emerald-800">
                        <p class="text-xs text-gray-500">Monthly Interest</p>
                        <p class="font-bold">${formatCurrency(monthlyInterest)}</p>
                    </div>
                    <div class="rounded-xl bg-white/80 dark:bg-gray-800 p-3 border border-emerald-100 dark:border-emerald-800">
                        <p class="text-xs text-gray-500">Total Interest</p>
                        <p class="font-bold text-emerald-600">${formatCurrency(totalInterest)}</p>
                    </div>
                </div>
                <div class="mt-3 flex justify-between rounded-xl bg-emerald-600 text-white p-3">
                    <span>Total Maturity Value</span>
                    <span class="font-bold">${formatCurrency(amount + totalInterest)}</span>
                </div>`;
        };

const buildLoanSummary = (user = currentUserData || {}, loans = []) => {
            const modernLoans = loans.filter(isModernLoanRecord);
            const activeLoans = modernLoans.filter(isActiveLoanRecord);
            const maxLimit = getLoanLimitAmount(user);
            const usedAmount = activeLoans.reduce((sum, loan) => sum + getLoanPrincipal(loan), 0);
            const repayableAmount = activeLoans.reduce((sum, loan) => sum + Number(loan.totalRepayable || 0), 0);
            return {
                maxLimit,
                usedAmount,
                repayableAmount,
                availableAmount: Math.max(0, maxLimit - usedAmount),
                activeLoans,
                loans: modernLoans
            };
        };

const updateLegacyWithdrawalFixSummary = () => {
            const summaryEl = document.getElementById('legacy-pending-withdrawal-summary');
            const fixBtn = document.getElementById('fix-legacy-pending-withdrawals-btn');
            if (!summaryEl || !fixBtn) return;
            const targets = getLegacyWithdrawalTargets();
            const total = targets.reduce((sum, req) => sum + Number(req.amount || 0), 0);
            if (!targets.length) {
                summaryEl.textContent = 'No pending withdrawal needs balance cut. All pending requests are already adjusted.';
                fixBtn.textContent = 'Nothing To Fix';
                fixBtn.disabled = true;
                return;
            }
            summaryEl.textContent = `${targets.length} pending withdrawal(s) still need one-time balance cut. Total: ${formatCurrency(total)}.`;
            fixBtn.textContent = `Cut ${targets.length} Uncut Pending`;
            fixBtn.disabled = false;
        };

// Expose functions to window for global access
window.updateAdminPendingRequestSummary = updateAdminPendingRequestSummary;
window.getProfilePaymentSummaryText = getProfilePaymentSummaryText;
window.showAdminAuditPage = showAdminAuditPage;
window.loadAuditData = loadAuditData;
window.loadAuditFailedLogs = loadAuditFailedLogs;
window.getBotTransactionSummary = getBotTransactionSummary;
window.getRechargeSummary = getRechargeSummary;
window.updateRechargeSummary = updateRechargeSummary;
window.getPartnerInvestmentSummary = getPartnerInvestmentSummary;
window.updatePartnerInvestmentSummary = updatePartnerInvestmentSummary;
window.buildLoanSummary = buildLoanSummary;
window.updateLegacyWithdrawalFixSummary = updateLegacyWithdrawalFixSummary;
