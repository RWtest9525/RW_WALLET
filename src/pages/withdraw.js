// File: src/pages/withdraw.js

const loadUserPendingWithdrawalsMerged = async (userId) => {
            if (!userId) return [];
            const [cloudRequests, firebaseRequests] = await Promise.all([
                loadCloudFundRequests({ status: 'pending', type: 'withdrawal', userId, limit: 200, timeoutMs: 2500 }).catch(error => {
                    console.warn('User cloud pending withdrawals skipped:', error);
                    return [];
                }),
                loadFirebasePendingFundRequests(userId).catch(error => {
                    console.warn('User Firebase pending withdrawals skipped:', error);
                    return [];
                })
            ]);
            return mergeFundRequestsById(cloudRequests, firebaseRequests)
                .filter(req => (req.type || 'withdrawal') === 'withdrawal' && (req.status || 'pending') === 'pending');
        };

const checkPendingWithdrawal = async (userId) => {
            try {
                const pendingQuery = query(
                    collection(db, `artifacts/${appId}/public/data/fund_requests`),
                    where("userId", "==", userId),
                    where("status", "==", "pending")
                );
                const snapshot = await getDocs(pendingQuery);
                return !snapshot.empty;
            } catch (e) {
                console.error("Error checking pending withdrawal:", e);
                return false;
            }
        };

const isWithdrawMethodDetailsComplete = (method) => {
            const details = getProfilePaymentDetails(method);
            if (method === 'upi') return !!String(details.upiId || '').trim();
            if (method === 'bank') {
                return ['accountNumber', 'ifsc', 'bankName', 'accountName'].every(key => !!String(details[key] || '').trim());
            }
            if (['play_store', 'amazon_gift', 'flipkart_gift', 'paypal'].includes(method)) {
                return !!String(details.email || '').trim();
            }
            return false;
        };

const showWithdrawDetailsMissingModal = (method, methodName) => {
            renderModal('Update Withdraw Method',
                `<div class="space-y-3">
                    <div class="rounded-2xl border border-yellow-100 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                        <p class="text-sm font-bold text-yellow-800 dark:text-yellow-100">${escapeHtml(methodName)} details are missing.</p>
                        <p class="text-sm text-yellow-700 dark:text-yellow-200 mt-1">Please update your withdraw method first, then request withdrawal.</p>
                    </div>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="set-withdraw-method-now-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Set Now</button>`,
                'max-w-sm');
            document.getElementById('set-withdraw-method-now-btn').onclick = () => {
                window.closeModal();
                showProfilePage(method);
            };
        };

const getWithdrawalTransactions = () => unifiedHistoryCache.filter(item => {
            if (item.status && item.status !== 'completed') return false;
            return normalizeTransactionType(item) === 'withdrawal';
        });

const showWithdrawalInvoicesPage = () => {
            const groups = getInvoiceGroups();
            const content = `
                ${getPageHeader('Invoice')}
                <div class="max-w-lg mx-auto space-y-4">
                    <div class="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-800 p-5 text-white shadow-xl">
                        <p class="text-xs font-bold uppercase text-white/60">Withdrawal Statements</p>
                        <h3 class="mt-1 text-2xl font-bold">Monthly Invoice</h3>
                        <p class="mt-2 text-sm text-white/70">Open a month to see full withdrawal details and download PDF.</p>
                    </div>
                    ${groups.length === 0 ? '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No withdrawal invoices available yet.</p>' : groups.map(group => `
                        <button data-invoice-key="${group.key}" class="invoice-month-card group w-full overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 text-left shadow-md hover:shadow-xl transition">
                            <div class="flex items-center gap-4 p-4">
                                <div class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800">
                                    <span class="text-xs font-bold text-blue-500">${shortMonthNames[group.month]}</span>
                                    <span class="text-lg font-black text-blue-900 dark:text-blue-100">${String(group.year).slice(-2)}</span>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <h3 class="text-base font-bold text-gray-900 dark:text-white">${shortMonthNames[group.month]} - ${group.year}</h3>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">${group.items.length} withdrawal${group.items.length === 1 ? '' : 's'} generated</p>
                                    <p class="mt-1 text-sm font-bold text-red-600 dark:text-red-300">${formatCurrency(group.total)}</p>
                                </div>
                                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition group-hover:translate-x-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                                </div>
                            </div>
                        </button>`).join('')}
                </div>
                ${getPageFooter()}`;
            showPage(content, { onBack: showSettingsPage });
            document.querySelectorAll('.invoice-month-card').forEach(card => {
                card.onclick = () => showWithdrawalInvoiceDetails(card.dataset.invoiceKey);
            });
        };

const showWithdrawalInvoiceDetails = (invoiceKey) => {
            const group = getInvoiceGroups().find(item => item.key === invoiceKey);
            if (!group) return showNotification('Invoice not found.', true);
            const first = group.items[0] || {};
            const content = `
                ${getPageHeader(`${shortMonthNames[group.month]} - ${group.year}`)}
                <div class="max-w-4xl mx-auto space-y-4">
                    <div class="overflow-hidden rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-slate-200 dark:border-slate-700">
                        <div class="bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-800 p-5 text-white">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <p class="text-xs font-bold uppercase text-white/60">Withdrawal Invoice</p>
                                <h3 class="text-xl font-bold mt-1">${shortMonthNames[group.month]} - ${group.year}</h3>
                                <p class="text-sm text-white/70 mt-1">${escapeHtml(currentUserData?.name || 'User')} - ${escapeHtml(currentUserData?.email || currentUser?.email || '')}</p>
                            </div>
                            <button id="download-withdrawal-invoice-btn" class="px-4 py-2 rounded-xl bg-white text-slate-950 text-sm font-bold shadow-sm">Download PDF</button>
                        </div>
                        <div class="mt-4 grid grid-cols-2 gap-3">
                            <div class="rounded-2xl bg-white/10 border border-white/15 p-3">
                                <p class="text-xs text-white/60">Total Withdrawal</p>
                                <p class="font-bold text-lg">${formatCurrency(group.total)}</p>
                            </div>
                            <div class="rounded-2xl bg-white/10 border border-white/15 p-3">
                                <p class="text-xs text-white/60">Primary Mode</p>
                                <p class="font-bold text-lg">${escapeHtml(first.method || first.paymentMethod || 'Multiple')}</p>
                            </div>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full min-w-[760px] text-left text-sm">
                            <thead class="bg-slate-50 dark:bg-gray-900/70 text-xs uppercase text-slate-500 dark:text-slate-400">
                                <tr>
                                    <th class="px-4 py-3 font-bold">Amount</th>
                                    <th class="px-4 py-3 font-bold">Requested</th>
                                    <th class="px-4 py-3 font-bold">Processed</th>
                                    <th class="px-4 py-3 font-bold">Mode</th>
                                    <th class="px-4 py-3 font-bold">Details</th>
                                    <th class="px-4 py-3 font-bold">Txn ID</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                                ${group.items.map(item => `
                                    <tr class="bg-white dark:bg-gray-800 hover:bg-blue-50/60 dark:hover:bg-blue-900/10 transition">
                                        <td class="px-4 py-4 font-black text-red-600 dark:text-red-300">${formatCurrencyAbs(item.amount || 0)}</td>
                                        <td class="px-4 py-4 text-slate-600 dark:text-slate-300">${formatDateDDMMYY(item.timestamp || item.requestedAt)}</td>
                                        <td class="px-4 py-4 text-slate-600 dark:text-slate-300">${formatDateDDMMYY(item.processedAt || item.timestamp)}</td>
                                        <td class="px-4 py-4"><span class="rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 px-3 py-1 text-xs font-bold">${escapeHtml(getWithdrawalDisplayMethodName(item, 'N/A'))}</span></td>
                                        <td class="px-4 py-4 text-slate-600 dark:text-slate-300 max-w-[220px] break-words">${escapeHtml(getWithdrawalDetailText(item))}</td>
                                        <td class="px-4 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">${escapeHtml(item.adminTransactionId || item.transactionId || 'N/A')}</td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-gray-900/60 p-4">
                        <div class="rounded-2xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-700 p-3">
                            <p class="text-xs text-slate-500">Transactions</p>
                            <p class="font-bold">${group.items.length}</p>
                        </div>
                        <div class="rounded-2xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-700 p-3">
                            <p class="text-xs text-slate-500">Total</p>
                            <p class="font-bold">${formatCurrency(group.total)}</p>
                        </div>
                        <div class="rounded-2xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-700 p-3">
                            <p class="text-xs text-slate-500">Status</p>
                            <p class="font-bold text-emerald-600 dark:text-emerald-300">Completed</p>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { onBack: showWithdrawalInvoicesPage });
            document.getElementById('download-withdrawal-invoice-btn').onclick = () => downloadWithdrawalInvoicePdf(group);
        };

const createWithdrawalInvoicePdf = (group) => {
            const commands = [];
            const text = (value, x, y, size = 10, font = 'F1', color = '0 0 0') => {
                commands.push('BT', `/${font} ${size} Tf`, `${color} rg`, `${x} ${y} Td`, `(${escapePdfText(value)}) Tj`, 'ET');
            };
            const fillRect = (x, y, w, h, color) => commands.push('q', `${color} rg`, `${x} ${y} ${w} ${h} re f`, 'Q');
            const strokeRect = (x, y, w, h, color = '0.85 0.88 0.92') => commands.push('q', `${color} RG`, `${x} ${y} ${w} ${h} re S`, 'Q');
            const line = (x1, y1, x2, y2, color = '0.85 0.88 0.92') => commands.push('q', `${color} RG`, `${x1} ${y1} m ${x2} ${y2} l S`, 'Q');

            fillRect(0, 0, 595, 842, '0.96 0.98 1');
            fillRect(36, 690, 523, 110, '0.02 0.08 0.18');
            fillRect(36, 690, 523, 18, '0.02 0.45 0.36');
            text('REVIEWS WORLD', 58, 758, 22, 'F2', '1 1 1');
            text('WITHDRAWAL INVOICE', 58, 734, 14, 'F2', '0.75 0.9 1');
            text(`Generated: ${new Date().toLocaleString('en-IN')}`, 58, 712, 9, 'F1', '0.8 0.86 0.94');
            text(`Invoice Month: ${shortMonthNames[group.month]} - ${group.year}`, 382, 758, 11, 'F2', '1 1 1');
            text(`Status: COMPLETED`, 382, 738, 9, 'F2', '0.55 0.95 0.78');

            fillRect(36, 620, 250, 50, '1 1 1');
            strokeRect(36, 620, 250, 50);
            text('Billed To', 52, 650, 9, 'F2', '0.25 0.35 0.5');
            text(truncatePdfText(currentUserData?.name || 'User', 34), 52, 635, 12, 'F2', '0.05 0.1 0.18');
            text(truncatePdfText(currentUserData?.email || currentUser?.email || 'N/A', 38), 52, 622, 8, 'F1', '0.35 0.42 0.52');

            fillRect(310, 620, 249, 50, '1 1 1');
            strokeRect(310, 620, 249, 50);
            text('Total Withdrawal', 326, 650, 9, 'F2', '0.25 0.35 0.5');
            text(formatPdfCurrency(group.total), 326, 631, 18, 'F2', '0.78 0.12 0.12');
            text(`${group.items.length} transaction${group.items.length === 1 ? '' : 's'}`, 470, 631, 9, 'F1', '0.35 0.42 0.52');

            fillRect(36, 560, 523, 34, '0.9 0.95 1');
            strokeRect(36, 560, 523, 34, '0.72 0.8 0.9');
            text('Amount', 50, 573, 9, 'F2', '0.1 0.18 0.3');
            text('Requested', 125, 573, 9, 'F2', '0.1 0.18 0.3');
            text('Processed', 225, 573, 9, 'F2', '0.1 0.18 0.3');
            text('Mode', 325, 573, 9, 'F2', '0.1 0.18 0.3');
            text('Details', 395, 573, 9, 'F2', '0.1 0.18 0.3');
            text('Txn ID', 505, 573, 9, 'F2', '0.1 0.18 0.3');

            let y = 532;
            group.items.slice(0, 12).forEach((item, index) => {
                fillRect(36, y - 9, 523, 30, index % 2 === 0 ? '1 1 1' : '0.98 0.99 1');
                line(36, y - 10, 559, y - 10);
                text(formatPdfCurrency(item.amount || 0), 50, y, 8, 'F2', '0.78 0.12 0.12');
                text(truncatePdfText(formatDateDDMMYY(item.timestamp || item.requestedAt), 16), 125, y, 8, 'F1', '0.18 0.24 0.33');
                text(truncatePdfText(formatDateDDMMYY(item.processedAt || item.timestamp), 16), 225, y, 8, 'F1', '0.18 0.24 0.33');
                text(truncatePdfText(getWithdrawalDisplayMethodName(item, 'N/A'), 10), 325, y, 8, 'F2', '0.05 0.35 0.75');
                text(truncatePdfText(getWithdrawalDetailText(item), 18), 395, y, 8, 'F1', '0.18 0.24 0.33');
                text(truncatePdfText(item.adminTransactionId || item.transactionId || 'N/A', 10), 505, y, 8, 'F1', '0.18 0.24 0.33');
                y -= 30;
            });
            if (group.items.length > 12) {
                text(`+ ${group.items.length - 12} more transactions in this month`, 50, y - 4, 9, 'F2', '0.78 0.12 0.12');
            }

            fillRect(36, 62, 523, 42, '0.02 0.08 0.18');
            text('This invoice is generated by Reviews World for completed withdrawal records.', 54, 84, 9, 'F1', '0.8 0.86 0.94');
            text('REVIEWS WORLD | Digital Wallet', 54, 70, 9, 'F2', '1 1 1');

            const objects = [];
            const addObject = (body) => {
                objects.push(body);
                return objects.length;
            };
            addObject('<< /Type /Catalog /Pages 2 0 R >>');
            addObject('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
            addObject('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>');
            addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
            addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
            const content = commands.join('\n');
            addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
            let pdf = '%PDF-1.4\n';
            const offsets = [0];
            objects.forEach((obj, index) => {
                offsets.push(pdf.length);
                pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
            });
            const xref = pdf.length;
            pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
            offsets.slice(1).forEach(offset => {
                pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
            });
            pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
            return new Blob([pdf], { type: 'application/pdf' });
        };

const downloadWithdrawalInvoicePdf = (group) => {
            const blob = createWithdrawalInvoicePdf(group);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `RW-WITHDRAWAL-${shortMonthNames[group.month]}-${group.year}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        };

const getPendingWithdrawalForBot = async () => {
            if (!currentUser) return null;
            try {
                const pending = await loadUserPendingWithdrawalsMerged(currentUser.uid);
                return pending[0] || null;
            } catch (error) {
                console.error('Bot pending withdrawal check failed:', error);
                return null;
            }
        };

const notifyWithdrawalStatus = ({ userId, status, amount, txnId, requestId, rejectionReason = '', processedAt = Date.now() }) => {
            if (status === 'completed') return;
            const title = 'Withdrawal Rejected';
            const message = [
                `Your withdrawal of ${formatCurrency(amount)} was rejected.`,
                `Reason: ${rejectionReason || 'Not specified'}`,
                `Request ID: ${requestId || 'N/A'}`,
                `Updated on: ${formatDateDDMMYY(processedAt)}`
            ].join('\n');
            sendSystemNotificationToUser({ userId, title, message });
        };

const getWithdrawMethodLogo = (methodId) => WITHDRAW_METHOD_LOGOS[methodId] || '';

const renderWithdrawMethodLogo = (methodId, altText, extraClass = '') => {
            const logo = getWithdrawMethodLogo(methodId);
            return logo ? `<img src="${logo}" class="w-full h-full object-contain ${extraClass}" alt="${altText}" loading="eager" fetchpriority="high" decoding="async">` : '';
        };

const getWithdrawalMethodName = (methodId, fallback = '') => {
            const names = {
                upi: 'UPI',
                bank: 'Bank Account',
                play_store: 'Google Play Gift Card',
                amazon_gift: 'Amazon Gift Card',
                flipkart_gift: 'Flipkart Gift Card',
                paypal: 'PayPal',
                crypto: 'Crypto'
            };
            return names[methodId] || fallback || 'Withdrawal Method';
        };

const normalizeWithdrawalMethodId = (item = {}) => {
            const candidates = [
                item.giftCardType,
                item.gift_card_type,
                item.giftCardName,
                item.gift_card_name,
                item.methodId,
                item.paymentMethod,
                item.withdrawMethod,
                item.withdraw_method,
                item.method,
                item.paymentDetails,
                item.comment
            ].map(value => String(value || '').toLowerCase().trim().replace(/[\s-]+/g, '_'));
            for (const raw of candidates) {
                if (!raw || raw === 'gift_card' || raw === 'gift') continue;
                if (raw.includes('upi')) return 'upi';
                if (raw.includes('bank') || raw.includes('account')) return 'bank';
                if (raw.includes('play') || raw.includes('google')) return 'play_store';
                if (raw.includes('amazon')) return 'amazon_gift';
                if (raw.includes('flipkart')) return 'flipkart_gift';
                if (raw.includes('paypal')) return 'paypal';
            }
            if (item.upiId) return 'upi';
            if (item.accountNumber || item.ifsc) return 'bank';
            if (item.email || item.paymentEmail) return 'paypal';
            return candidates.find(Boolean) || '';
        };

const getWithdrawalDisplayMethodName = (item = {}, fallback = 'N/A') => {
            const methodId = normalizeWithdrawalMethodId(item);
            const knownMethodIds = ['upi', 'bank', 'play_store', 'amazon_gift', 'flipkart_gift', 'paypal', 'crypto'];
            const specificName = knownMethodIds.includes(methodId) ? getWithdrawalMethodName(methodId, '') : '';
            const rawName = String(item.method || item.paymentMethod || fallback || '').trim();
            if (specificName && !['gift card', 'gift_card', 'withdrawal method'].includes(rawName.toLowerCase())) {
                return specificName;
            }
            if (!specificName && ['gift card', 'gift_card'].includes(rawName.toLowerCase())) {
                return 'Gift Card - type not saved';
            }
            return specificName || rawName || fallback;
        };

const getWithdrawalDetailText = (item = {}) => {
            const methodId = normalizeWithdrawalMethodId(item);
            const details = item.paymentDetails && typeof item.paymentDetails === 'object' ? item.paymentDetails : {};
            const detailText = typeof item.paymentDetails === 'string' ? item.paymentDetails : '';
            if (methodId === 'upi') return item.upiId || item.paymentDetails || 'N/A';
            if (methodId === 'bank') {
                return [
                    (item.accountNumber || details.accountNumber) ? `A/C: ${item.accountNumber || details.accountNumber}` : '',
                    (item.ifsc || details.ifsc) ? `IFSC: ${item.ifsc || details.ifsc}` : '',
                    item.bankName || details.bankName || '',
                    (item.accountName || details.accountName) ? `Name: ${item.accountName || details.accountName}` : ''
                ].filter(Boolean).join(' | ') || detailText || 'N/A';
            }
            if (['play_store', 'amazon_gift', 'flipkart_gift', 'paypal'].includes(methodId)) {
                return item.email || item.paymentEmail || details.email || detailText || 'N/A';
            }
            return detailText || item.upiId || item.accountNumber || item.email || item.paymentEmail || 'N/A';
        };

const getWithdrawalSnapshot = (data = {}) => ({
            method: getWithdrawalDisplayMethodName(data, getWithdrawalMethodName(data.methodId)),
            methodId: data.methodId || data.paymentMethod || '',
            upiId: data.upiId || '',
            accountNumber: data.accountNumber || '',
            ifsc: data.ifsc || '',
            bankName: data.bankName || '',
            accountName: data.accountName || '',
            email: data.email || '',
            paymentDetails: data.paymentDetails || ''
        });

const showWithdrawPage = () => {
            if (!currentUserData) return showNotification('User data not loaded. Please wait.', true);
            loadWithdrawalSettingsOnce().catch(error => console.warn('Withdrawal settings background load skipped:', error));

            if (currentUserData.isFlagged) {
                return showNotification('Your account is flagged. Please contact support.', true);
            }

            if (!currentUserData.paymentMethod) {
                showNotification('Please set your payment method in your profile.', true);
                showProfilePage();
                return;
            }

            const content = `
                ${getPageHeader('Withdraw Funds')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-6">
                    <div class="text-center">
                        <h3 class="text-lg font-semibold">Choose Withdrawal Method</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Select how you want to receive your funds</p>
                    </div>
                    
                    <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-400 transition-all duration-200" data-method="upi">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('upi', 'UPI')}
                            </div>
                        </div>

                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-green-400 transition-all duration-200" data-method="bank">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('bank', 'Bank')}
                            </div>
                        </div>

                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-purple-400 transition-all duration-200" data-method="play_store">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('play_store', 'Play Store')}
                            </div>
                        </div>

                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-orange-400 transition-all duration-200" data-method="amazon_gift">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('amazon_gift', 'Amazon')}
                            </div>
                        </div>

                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-400 transition-all duration-200" data-method="flipkart_gift">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('flipkart_gift', 'Flipkart')}
                            </div>
                        </div>

                        <div class="payment-option border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-pointer hover:shadow-md hover:border-blue-500 transition-all duration-200" data-method="paypal">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('paypal', 'PayPal')}
                            </div>
                        </div>

                        <div class="payment-option coming-soon border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-center cursor-not-allowed opacity-70" data-method="crypto">
                            <div class="w-12 h-12 flex items-center justify-center">
                                ${renderWithdrawMethodLogo('crypto', 'Crypto')}
                            </div>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content);

            document.querySelectorAll('.payment-option:not(.coming-soon)').forEach(option => {
                option.addEventListener('click', function () {
                    document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
                    this.classList.add('selected');
                    const method = this.dataset.method;
                    showWithdrawAmountPage(method);
                });
            });

            loadUserPendingWithdrawalsMerged(currentUser.uid)
                .then((pendingWithdrawals) => {
                    const pendingWithdrawalCount = pendingWithdrawals.length;
                    if (pendingWithdrawalCount >= maxPendingWithdrawalsPerUser && document.getElementById('page-container')?.textContent.includes('Choose Withdrawal Method')) {
                        showNotification(`You already have ${pendingWithdrawalCount} pending withdrawal request(s).`, true);
                        hidePage();
                    }
                })
                .catch(error => console.warn('Pending withdrawal background check skipped:', error));
        };

const showWithdrawAmountPage = (method) => {
            loadWithdrawalSettingsOnce().then(() => applyWithdrawalConfig({})).catch(error => console.warn('Withdrawal settings background load skipped:', error));
            activeWithdrawMethod = method;
            let methodName = '';
            let methodDetails = '';
            const minForMethod = getMinWithdrawalForMethod(method);
            const methodIconMap = {
                upi: renderWithdrawMethodLogo('upi', 'UPI'),
                bank: renderWithdrawMethodLogo('bank', 'Bank'),
                play_store: renderWithdrawMethodLogo('play_store', 'Play Store'),
                amazon_gift: renderWithdrawMethodLogo('amazon_gift', 'Amazon'),
                flipkart_gift: renderWithdrawMethodLogo('flipkart_gift', 'Flipkart'),
                paypal: renderWithdrawMethodLogo('paypal', 'PayPal'),
                crypto: renderWithdrawMethodLogo('crypto', 'Crypto'),
            };

            switch (method) {
                case 'upi':
                    methodName = 'UPI';
                    methodDetails = getProfilePaymentDetails(method).upiId || 'Not set';
                    break;
                case 'bank':
                    methodName = 'Bank Account';
                    const bankDetails = getProfilePaymentDetails(method);
                    methodDetails = `${bankDetails.accountNumber || 'Not set'} - ${bankDetails.bankName || 'Not set'}`;
                    break;
                case 'play_store':
                    methodName = 'Google Play Gift Card';
                    methodDetails = getProfilePaymentDetails(method).email || 'Not set';
                    break;
                case 'amazon_gift':
                    methodName = 'Amazon Gift Card';
                    methodDetails = getProfilePaymentDetails(method).email || 'Not set';
                    break;
                case 'flipkart_gift':
                    methodName = 'Flipkart Gift Card';
                    methodDetails = getProfilePaymentDetails(method).email || 'Not set';
                    break;
                case 'paypal':
                    methodName = 'PayPal';
                    methodDetails = getProfilePaymentDetails(method).email || 'Not set';
                    break;
            }

            if (!isWithdrawMethodDetailsComplete(method)) {
                showWithdrawDetailsMissingModal(method, methodName || getWithdrawalMethodName(method));
                return;
            }

            const content = `
                ${getPageHeader(`Withdraw to ${methodName}`)}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-6">
                    
                    <div class="flex flex-col items-center text-center space-y-4">
                        
                        <div class="p-3 bg-white dark:bg-gray-700 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                            <div class="w-14 h-14 rounded-lg flex items-center justify-center ${method === 'upi' ? 'bg-purple-100' : method === 'bank' ? 'bg-green-100' : 'bg-blue-100'}">
                                ${methodIconMap[method] || `<span class="text-2xl font-bold ${method === 'upi' ? 'text-purple-600' : method === 'bank' ? 'text-green-600' : 'text-blue-600'}">${methodName.charAt(0)}</span>`}
                            </div>
                        </div>
                        
                        <div class="w-full">
                            <h3 class="text-lg font-semibold">Withdraw to ${methodName}</h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">${methodDetails}</p>
                        </div>
                    </div>
                    
                    <hr class="border-gray-200 dark:border-gray-700">
                    
                    <div class="space-y-4">
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Amount to Withdraw</label>
                            <input type="number" id="withdraw-amount-input" placeholder="Enter amount (₹)" min="${minForMethod}" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum withdrawal: ₹${minForMethod}</p>
                        </div>
                    </div>
                    
                    <button id="confirm-withdraw-btn" class="w-full bg-yellow-500 text-white font-semibold py-3 rounded-lg hover:bg-yellow-600 transition">Proceed to Withdraw</button>
                </div>
                ${getPageFooter()}`;

            showPage(content);
            document.getElementById('confirm-withdraw-btn').onclick = () => {
                const amount = parseFloat(document.getElementById('withdraw-amount-input').value);
                handleWithdrawConfirmation(amount, method, methodName);
            };
        };

const handleWithdrawConfirmation = (amount, method, methodName) => {
            const minForMethod = getMinWithdrawalForMethod(method);
            if (isNaN(amount) || amount < minForMethod) {
                return showNotification(`Minimum withdrawal for ${methodName} is ₹${minForMethod}.`, true);
            }

            if (!currentUserData || getSpendableWalletBalance(currentUserData) < amount) {
                return showNotification(getInsufficientWalletMessage(currentUserData), true);
            }

            let methodDetails = '';
            const missingDetailText = 'Update payout details';
            switch (method) {
                case 'upi':
                    methodDetails = getProfilePaymentDetails(method).upiId || missingDetailText;
                    break;
                case 'bank':
                    const bankDetails = getProfilePaymentDetails(method);
                    methodDetails = bankDetails.accountNumber || bankDetails.bankName
                        ? `A/C: ${bankDetails.accountNumber || missingDetailText}, ${bankDetails.bankName || missingDetailText}`
                        : missingDetailText;
                    break;
                default:
                    methodDetails = getProfilePaymentDetails(method).email || missingDetailText;
            }
            const walletBalance = Number(currentUserData?.balance || 0);
            const spendableBalance = getSpendableWalletBalance(currentUserData);
            const balanceAfter = spendableBalance - amount;

            renderModal('Withdrawal Request',
                `<div class="withdraw-confirm-shell">
                    <div class="withdraw-confirm-hero">
                        <span class="withdraw-confirm-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 3v12"></path>
                                <path d="m7 10 5 5 5-5"></path>
                                <path d="M5 21h14"></path>
                            </svg>
                        </span>
                        <p class="withdraw-confirm-kicker">Admin approval required</p>
                        <h4>Confirm withdrawal</h4>
                        <span>Txn ID after approval.</span>
                    </div>
                    <div class="withdraw-confirm-amount">
                        <span>Amount</span>
                        <strong>${formatCurrency(amount)}</strong>
                    </div>
                    <div class="withdraw-confirm-details">
                        <div>
                            <span>Method</span>
                            <strong>${escapeHtml(methodName)}</strong>
                        </div>
                        <div>
                            <span>Payout details</span>
                            <strong class="break-words text-right">${escapeHtml(methodDetails)}</strong>
                        </div>
                        <div>
                            <span>Wallet balance</span>
                            <strong>${formatCurrency(walletBalance)}</strong>
                        </div>
                        <div>
                            <span>Available balance</span>
                            <strong>${formatCurrency(spendableBalance)}</strong>
                        </div>
                        <div class="withdraw-confirm-balance-after">
                            <span>Balance after</span>
                            <strong>${formatCurrency(balanceAfter)}</strong>
                        </div>
                    </div>
                </div>`,
                `<button onclick="window.closeModal()" class="withdraw-cancel-btn">Cancel</button>
                 <button id="final-withdraw-btn" class="withdraw-submit-btn">Confirm</button>`,
                'max-w-md', true
            );
            document.getElementById('final-withdraw-btn').onclick = async () => {
                const btn = document.getElementById('final-withdraw-btn');
                if (!btn || btn.disabled) return;
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Processing...';
                try {
                    await handleWithdrawRequest(amount, method, methodName);
                } finally {
                    const liveBtn = document.getElementById('final-withdraw-btn');
                    if (liveBtn) {
                        liveBtn.disabled = false;
                        liveBtn.textContent = originalText;
                    }
                }
            };
        };

const startLoanRepaymentAfterWithdrawalApproval = async (userId, processedAtValue = Date.now()) => {
            if (!userId) return;
            const processedAtMillis = timestampToMillis(processedAtValue) || Date.now();
            const repaymentStartDate = new Date(processedAtMillis);
            const dueDate = getNextMonthRepaymentDate(repaymentStartDate);
            const loansSnap = await getDocs(query(
                collection(db, `artifacts/${appId}/public/data/loans`),
                where("userId", "==", userId),
                where("status", "==", "active")
            ));
            const activeLoans = loansSnap.docs
                .map(docItem => ({ id: docItem.id, ...docItem.data() }))
                .filter(loan => isModernLoanRecord(loan) && isActiveLoanRecord(loan))
                .filter(loan => {
                    const basis = String(loan.repaymentBasis || loan.repaymentStatus || '').toLowerCase();
                    return !timestampToMillis(loan.repaymentStartedAt) || !basis.includes('withdrawal');
                });
            if (!activeLoans.length) return;

            await Promise.all(activeLoans.map(loan => updateDoc(doc(db, `artifacts/${appId}/public/data/loans`, loan.id), {
                repaymentStartedAt: Timestamp.fromDate(repaymentStartDate),
                repaymentBasis: 'withdrawal_processed',
                repaymentStatus: 'running',
                dueDate: Timestamp.fromDate(dueDate),
                lockedAmount: Number(loan.totalRepayable || 0),
                reserveStartsAt: Timestamp.fromDate(dueDate),
                updatedAt: serverTimestamp()
            })));

            const firstLoan = activeLoans[0];
            const totalFutureReserve = Number(activeLoans.reduce((sum, loan) => sum + Number(loan.totalRepayable || 0), 0).toFixed(2));
            const userMarkerUpdate = {
                activeLoanDueDate: Timestamp.fromDate(dueDate),
                activeLoanRepaymentStartedAt: Timestamp.fromDate(repaymentStartDate),
                activeLoanRepaymentBasis: 'withdrawal_processed',
                loanLockedAmount: totalFutureReserve,
                loanReserveStartsAt: Timestamp.fromDate(dueDate)
            };
            await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, userId), userMarkerUpdate);

            allLoansCache = allLoansCache.map(loan => activeLoans.some(activeLoan => activeLoan.id === loan.id)
                ? {
                    ...loan,
                    repaymentStartedAt: repaymentStartDate.getTime(),
                    repaymentBasis: 'withdrawal_processed',
                    repaymentStatus: 'running',
                    dueDate: dueDate.getTime(),
                    lockedAmount: Number(loan.totalRepayable || 0),
                    reserveStartsAt: dueDate.getTime()
                }
                : loan);
            if (currentUser?.uid === userId && currentUserData) {
                currentUserData = {
                    ...currentUserData,
                    ...userMarkerUpdate,
                    activeLoanId: currentUserData.activeLoanId || firstLoan.id
                };
            }
        };

const showWithdrawalHistoryPage = () => {
            const content = `
                ${getPageHeader('Withdrawal History')}
                <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <!-- Filters -->
                    <div class="mb-6 space-y-4">
                        <div class="flex flex-wrap gap-2">
                            <button data-filter="today" class="filter-btn active-filter">Today</button>
                            <button data-filter="yesterday" class="filter-btn">Yesterday</button>
                            <button data-filter="week" class="filter-btn">This Week</button>
                            <button data-filter="month" class="filter-btn">This Month</button>
                            <button data-filter="all" class="filter-btn">All Time</button>
                        </div>
                        <div class="flex flex-col sm:flex-row gap-3">
                            <div class="flex-[1.5]">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Search User</label>
                                <input type="search" id="withdrawal-history-search" placeholder="Name, mobile, email" class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            </div>
                            <div class="flex-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">From Date</label>
                                <input type="date" id="filter-from-date" class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            </div>
                            <div class="flex-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">To Date</label>
                                <input type="date" id="filter-to-date" class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            </div>
                            <div class="flex items-end">
                                <button id="apply-date-filter" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Apply</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Statistics -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <p class="text-sm text-blue-600 dark:text-blue-400">Total Withdrawals</p>
                            <p id="total-withdrawals-count" class="text-2xl font-bold">0</p>
                        </div>
                        <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                            <p class="text-sm text-green-600 dark:text-green-400">Approved</p>
                            <p id="approved-withdrawals-count" class="text-2xl font-bold">0</p>
                        </div>
                        <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                            <p class="text-sm text-red-600 dark:text-red-400">Rejected</p>
                            <p id="rejected-withdrawals-count" class="text-2xl font-bold">0</p>
                        </div>
                    </div>
                    
                    <!-- Withdrawal History List -->
                    <div id="withdrawal-history-list" class="max-h-[60vh] overflow-y-auto"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content);

            // Set today as default active
            document.querySelector('[data-filter="today"]').classList.add('active-filter');
            if (withdrawalHistoryCache.length) {
                renderWithdrawalHistoryList();
            } else {
                document.getElementById('withdrawal-history-list').innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-8">Loading withdrawal history...</p>';
            }
            loadWithdrawalHistory('today');
            document.getElementById('withdrawal-history-search').addEventListener('input', renderWithdrawalHistoryList);

            // Add event listeners for filters
            document.querySelectorAll('[data-filter]').forEach(btn => {
                btn.addEventListener('click', function () {
                    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active-filter'));
                    this.classList.add('active-filter');
                    const filter = this.dataset.filter;
                    loadWithdrawalHistory(filter);
                });
            });

            document.getElementById('apply-date-filter').addEventListener('click', () => {
                const fromDate = document.getElementById('filter-from-date').value;
                const toDate = document.getElementById('filter-to-date').value;
                if (fromDate && toDate) {
                    loadWithdrawalHistory('custom', fromDate, toDate);
                } else {
                    showNotification('Please select both from and to dates.', true);
                }
            });
        };

const isWithdrawalHistorySourceRecord = (record = {}) => {
            const rawType = String(record.type || record.requestType || record.request_type || '').toLowerCase().replace(/\s+/g, '_');
            const normalizedType = normalizeTransactionType(record);
            const hasRechargeFields = !!(
                record.mobileNumber ||
                record.operator ||
                record.planDetails ||
                record.discountRate ||
                rawType.includes('recharge') ||
                normalizedType === 'mobile_recharge'
            );
            if (hasRechargeFields) return false;
            if (normalizedType === 'withdrawal' || rawType.includes('withdraw')) return true;

            // Compatibility for old withdrawal rows that stored only payout fields.
            return !rawType && !!(
                record.methodId ||
                record.paymentMethod ||
                record.paymentDetails ||
                record.upiId ||
                record.accountNumber ||
                record.ifsc ||
                record.bankName ||
                record.giftCardType
            );
        };

const normalizeWithdrawalHistoryRecord = (record = {}) => {
            const sourceType = normalizeTransactionType(record);
            const requestedAt = record.requestedAt || record.timestamp || record.createdAt || record.processedAt || Date.now();
            const userProfile = allUsersCache.find(u =>
                (record.userId && u.id === record.userId) ||
                (record.userMobile && normalizePhoneDigits(getUserMobileValue(u)) === normalizePhoneDigits(record.userMobile)) ||
                (record.userEmail && u.email === record.userEmail)
            ) || {};
            return {
                ...record,
                id: record.id || record.requestId || record.request_id || record.transactionId || record.transaction_id || `${sourceType}-${timestampToMillis(requestedAt)}-${record.amount || 0}`,
                userId: record.userId || record.user_id || userProfile.id || '',
                userName: record.userName || record.senderName || record.recipientName || userProfile.name || 'N/A',
                userMobile: record.userMobile || record.mobile || getUserMobileValue(userProfile) || '',
                userEmail: record.userEmail || record.emailAddress || userProfile.email || '',
                type: 'withdrawal',
                amount: absoluteAmount(record.amount || 0),
                method: getWithdrawalDisplayMethodName(record, record.paymentMethod || 'N/A'),
                status: record.status || 'completed',
                requestedAt,
                processedAt: ['completed', 'rejected'].includes(record.status) ? (record.processedAt || null) : null
            };
        };

const mergeWithdrawalHistoryRecords = (...groups) => {
            const merged = new Map();
            groups.flat().forEach((record, index) => {
                if (!record) return;
                if (!isWithdrawalHistorySourceRecord(record)) return;
                const normalized = normalizeWithdrawalHistoryRecord(record);
                const key = normalized.requestId || normalized.request_id || normalized.transactionId || normalized.transaction_id || normalized.id || `withdrawal-${timestampToMillis(normalized.requestedAt)}-${normalized.amount}-${index}`;
                const existing = merged.get(String(key)) || {};
                const requestedAtCandidates = [existing.requestedAt, existing.requested_at, existing.timestamp, normalized.requestedAt, normalized.requested_at, normalized.timestamp]
                    .map(timestampToMillis)
                    .filter(time => Number.isFinite(time) && time > 0);
                const requestedAt = requestedAtCandidates.length ? Math.min(...requestedAtCandidates) : normalized.requestedAt;
                merged.set(String(key), {
                    ...existing,
                    ...normalized,
                    requestedAt,
                    timestamp: requestedAt
                });
            });
            return Array.from(merged.values())
                .sort((a, b) => timestampToMillis(b.requestedAt || b.timestamp || b.processedAt) - timestampToMillis(a.requestedAt || a.timestamp || a.processedAt));
        };

const loadWithdrawalHistory = async (filter = 'today', fromDate = null, toDate = null) => {
            activeWithdrawalHistoryFilter = { filter, fromDate, toDate };
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
                    loadCloudFundRequests({ status: 'all', type: 'withdrawal', limit: historyLimit, timeoutMs: needsDeepHistoryScan ? 8000 : 3000 }).catch(error => {
                        console.warn('Cloud withdrawal history load skipped:', error);
                        return [];
                    }),
                    needsDeepHistoryScan
                        ? loadLegacyWithdrawalTransactionsForAdmin()
                        : Promise.resolve([])
                ]);
                const firebaseRequests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                let withdrawals = mergeWithdrawalHistoryRecords(firebaseRequests, cloudRequests, legacyWithdrawals);

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
                    withdrawals = withdrawals.filter(w => {
                        if (!w.requestedAt) return false;
                        const reqDate = getSafeDate(w.requestedAt);
                        return reqDate >= today;
                    });
                } else if (filter === 'yesterday') {
                    withdrawals = withdrawals.filter(w => {
                        if (!w.requestedAt) return false;
                        const reqDate = getSafeDate(w.requestedAt);
                        return reqDate >= yesterday && reqDate < today;
                    });
                } else if (filter === 'week') {
                    withdrawals = withdrawals.filter(w => {
                        if (!w.requestedAt) return false;
                        const reqDate = getSafeDate(w.requestedAt);
                        return reqDate >= weekAgo;
                    });
                } else if (filter === 'month') {
                    withdrawals = withdrawals.filter(w => {
                        if (!w.requestedAt) return false;
                        const reqDate = getSafeDate(w.requestedAt);
                        return reqDate >= monthAgo;
                    });
                } else if (filter === 'custom' && fromDate && toDate) {
                    const from = new Date(fromDate);
                    const to = new Date(toDate);
                    to.setDate(to.getDate() + 1); // Include the entire to date

                    withdrawals = withdrawals.filter(w => {
                        if (!w.requestedAt) return false;
                        const reqDate = getSafeDate(w.requestedAt);
                        return reqDate >= from && reqDate < to;
                    });
                }
                // 'all' filter shows all withdrawals

                withdrawalHistoryCache = withdrawals;
                renderWithdrawalHistoryList();
            } catch (error) {
                console.error("Error loading withdrawal history:", error);
                showNotification('Error loading withdrawal history: ' + error.message, true);

                // Show error in the list
                const listEl = document.getElementById('withdrawal-history-list');
                if (listEl) {
                    listEl.innerHTML = `
                        <div class="text-center py-8">
                            <p class="text-red-500">Error loading withdrawal history</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Please check console for details</p>
                        </div>`;
                }
            }
        };

const renderWithdrawalHistoryList = () => {
            const listEl = document.getElementById('withdrawal-history-list');
            if (!listEl) return;
            const search = (document.getElementById('withdrawal-history-search')?.value || '').trim().toLowerCase();
            const withdrawals = withdrawalHistoryCache.filter(w => !search || [
                w.userName,
                w.userMobile,
                w.userEmail
            ].some(value => String(value || '').toLowerCase().includes(search)));

            const totalWithdrawals = withdrawals.length;
            const approvedWithdrawals = withdrawals.filter(w => w.status === 'completed').length;
            const rejectedWithdrawals = withdrawals.filter(w => w.status === 'rejected').length;

            document.getElementById('total-withdrawals-count').textContent = totalWithdrawals;
            document.getElementById('approved-withdrawals-count').textContent = approvedWithdrawals;
            document.getElementById('rejected-withdrawals-count').textContent = rejectedWithdrawals;

            if (withdrawals.length === 0) {
                listEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No withdrawal history found.</p>';
                return;
            }

            listEl.innerHTML = withdrawals.map(w => {
                    const statusColor = w.status === 'completed' ? 'text-green-500' :
                        w.status === 'rejected' ? 'text-red-500' : 'text-yellow-500';
                    const statusBg = w.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                        w.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30';
                    const statusText = w.status === 'completed' ? 'Approved' :
                        w.status === 'rejected' ? 'Rejected' : 'Pending';
                    const payoutDetails = getWithdrawalDetailText(w);

                    // Format date safely
                    let requestDate = 'N/A';
                    let requestTime = 'N/A';
                    if (w.requestedAt) {
                        requestDate = formatDate(w.requestedAt).split(' ')[0];
                        requestTime = getTimeFromTimestamp(w.requestedAt);
                    }

                    return `
                        <div class="p-4 mb-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <p class="font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(w.userName || 'N/A')}</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Mobile: ${escapeHtml(maskMobile(w.userMobile || ''))}</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">Email: ${escapeHtml((w.userEmail || 'N/A').split('@')[0])}***</p>
                                </div>
                                <span class="px-2 py-1 text-xs ${statusBg} ${statusColor} rounded-full font-semibold">${statusText}</span>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-3 text-sm mb-3">
                                <div class="bg-white dark:bg-gray-800 p-2 rounded">
                                    <p class="text-gray-500 dark:text-gray-400 text-xs">Amount</p>
                                    <p class="font-semibold text-gray-800 dark:text-gray-200">${formatCurrencyAbs(w.amount)}</p>
                                </div>
                                <div class="bg-white dark:bg-gray-800 p-2 rounded">
                                    <p class="text-gray-500 dark:text-gray-400 text-xs">Method</p>
                                    <p class="font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(w.method || 'N/A')}</p>
                                </div>
                                <div class="bg-white dark:bg-gray-800 p-2 rounded">
                                    <p class="text-gray-500 dark:text-gray-400 text-xs">Payout Details</p>
                                    <p class="font-semibold text-gray-800 dark:text-gray-200 text-sm break-words">${escapeHtml(payoutDetails)}</p>
                                </div>
                                <div class="bg-white dark:bg-gray-800 p-2 rounded">
                                    <p class="text-gray-500 dark:text-gray-400 text-xs">Date</p>
                                    <p class="font-semibold text-gray-800 dark:text-gray-200">${requestDate}</p>
                                </div>
                            </div>
                            
                            <div class="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                                <span>Requested: ${requestDate} ${requestTime}</span>
                                ${w.adminTransactionId ?
                            `<span class="txn-id-badge">${w.adminTransactionId}</span>` :
                            ''
                        }
                            </div>
                            
                            ${w.rejectionReason ? `
                                <div class="rejection-badge mt-3">
                                    <p class="font-semibold">Rejection Reason:</p>
                                    <p class="text-sm">${escapeHtml(w.rejectionReason)}</p>
                                </div>
                            ` : ''}
                            
                            ${w.processedAt ? `
                                <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                                    Processed: ${formatDate(w.processedAt)}
                                </div>
                            ` : ''}
                        </div>
                    `;
            }).join('');
        };

const isLegacyWithdrawalRequest = (request = {}) => {
            return (request.type || 'withdrawal') === 'withdrawal';
        };

const isWithdrawalBalanceDeducted = (request = {}) => {
            if (request.balanceDeducted === true || request.balance_deducted === true || request.legacyBalanceAdjusted === true || request.legacy_balance_adjusted === true) return true;
            const balanceAfter = Number(request.balanceAfter ?? request.balance_after);
            if (Number.isFinite(balanceAfter)) return true;
            return !isLegacyWithdrawalRequest(request);
        };

const shouldDeductLegacyWithdrawal = (request = {}) =>
            isLegacyWithdrawalRequest(request) && !isWithdrawalBalanceDeducted(request);

const getLegacyWithdrawalTargets = () =>
            allFundRequestsCache.filter(req => (req.status || 'pending') === 'pending' && shouldDeductLegacyWithdrawal(req));

const handleSetWithdrawalGiftCardType = async (userId, requestId, methodId) => {
            const allowed = ['amazon_gift', 'play_store', 'flipkart_gift'];
            if (!allowed.includes(methodId)) return;
            const giftCardName = getWithdrawalMethodName(methodId, 'Gift Card');
            const updatePayload = {
                methodId,
                paymentMethod: methodId,
                method: giftCardName,
                giftCardType: methodId,
                giftCardName,
                updatedAt: serverTimestamp()
            };
            try {
                const reqRef = doc(db, `artifacts/${appId}/public/data/fund_requests`, requestId);
                await updateDoc(reqRef, updatePayload);
                const existing = allFundRequestsCache.find(req => req.id === requestId) || {};
                const updatedRequest = { ...existing, ...updatePayload, updatedAt: Date.now() };
                allFundRequestsCache = allFundRequestsCache.map(req => req.id === requestId ? updatedRequest : req);
                renderAdminFundRequests(allFundRequestsCache);
                updateCloudFundRequestStatus(requestId, updatedRequest.status || 'pending', updatedRequest)
                    .catch(error => console.warn('Cloud gift card type update skipped:', error));
                if (userId) syncRecentTransactionsToCloud(userId).catch(error => console.warn('Gift card transaction sync skipped:', error));
                showNotification(`${giftCardName} saved for this withdrawal.`);
            } catch (error) {
                console.error('Gift card type update failed:', error);
                showNotification(`Could not save gift card type: ${error.message}`, true);
                renderAdminFundRequests(allFundRequestsCache);
            }
        };

const applyLegacyWithdrawalDeduction = async (userId, requestId, requestData = {}) => {
            if (!shouldDeductLegacyWithdrawal(requestData)) return requestData;
            const amount = Number(requestData.amount || 0);
            if (!amount || amount <= 0) return requestData;

            const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
            const reqRef = doc(db, `artifacts/${appId}/public/data/fund_requests`, requestId);
            const cachedUser = allUsersCache.find(u => u.id === userId || u.uid === userId) || {};
            const currentBalance = Number.isFinite(Number(requestData.balanceBefore ?? requestData.balance_before))
                ? Number(requestData.balanceBefore ?? requestData.balance_before)
                : (Number.isFinite(Number(cachedUser.balance)) ? Number(cachedUser.balance) : null);
            const balanceAfter = currentBalance !== null ? Number((currentBalance - amount).toFixed(2)) : null;
            const cutTransactionId = `ADMIN-CUT-${requestId}`;
            const adjustment = {
                ...(currentBalance !== null ? { balanceBefore: currentBalance } : {}),
                ...(balanceAfter !== null ? { balanceAfter } : {}),
                balanceDeducted: true,
                legacyBalanceAdjusted: true,
                legacyBalanceAdjustedAt: serverTimestamp(),
                legacyBalanceAdjustedBy: currentUser?.uid || ADMIN_UID
            };
            const updatedRequest = { ...requestData, ...adjustment, legacyBalanceAdjustedAt: Date.now() };

            await Promise.all([
                updateDoc(userRef, { balance: increment(-amount) }),
                updateDoc(reqRef, adjustment).catch(error => {
                    console.warn('Legacy withdrawal request marker skipped:', error);
                })
            ]);

            await updateCloudFundRequestStatus(requestId, 'pending', {
                ...updatedRequest,
                balanceBefore: updatedRequest.balanceBefore,
                balanceAfter: updatedRequest.balanceAfter,
                balanceDeducted: true,
                legacyBalanceAdjusted: true,
                legacyBalanceAdjustedAt: Date.now()
            });
            const debitHistory = {
                type: 'debit',
                amount,
                comment: 'Admin Debit - Pending Withdrawal Balance Cut',
                adminComment: 'Balance deducted for pending withdrawal request',
                timestamp: Date.now(),
                transactionId: cutTransactionId,
                requestId,
                method: getWithdrawalDisplayMethodName(requestData, 'Withdrawal'),
                status: 'completed',
                balanceBefore: currentBalance,
                balanceAfter,
                isAdminTransaction: true,
                isWithdrawalBalanceCut: true
            };
            await recordUserFirestoreTransaction(userId, debitHistory);
            recordCloudTransaction(userId, debitHistory).catch(error => {
                console.warn('Legacy withdrawal debit cloud history skipped:', error);
            });
            allFundRequestsCache = allFundRequestsCache.map(req => req.id === requestId ? { ...req, ...updatedRequest } : req);
            allUsersCache = allUsersCache.map(u => (u.id === userId || u.uid === userId) ? { ...u, balance: Number(u.balance || 0) - amount } : u);
            return updatedRequest;
        };

const handleFixLegacyPendingWithdrawals = async () => {
            if (currentUser?.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const targets = getLegacyWithdrawalTargets();
            if (!targets.length) return showNotification('No pending withdrawals need balance correction.');
            const total = targets.reduce((sum, req) => sum + Number(req.amount || 0), 0);
            renderModal('Fix Uncut Pending Withdrawals',
                `<div class="space-y-3 text-sm">
                    <p>This will deduct pending withdrawal amounts that are not already marked as balance cut. Use this for old app withdrawals where balance was not deducted.</p>
                    <div class="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
                        <p class="font-bold">${targets.length} request(s)</p>
                        <p class="text-yellow-700 dark:text-yellow-200">Total to deduct: ${formatCurrency(total)}</p>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">A completed admin debit entry will be added to each user's transaction history with before/after balance.</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-legacy-withdrawal-fix-btn" class="px-4 py-2 text-sm bg-yellow-600 text-white rounded-lg">Deduct Uncut Pending</button>`,
                'max-w-md'
            );
            document.getElementById('confirm-legacy-withdrawal-fix-btn').onclick = async () => {
                const btn = document.getElementById('confirm-legacy-withdrawal-fix-btn');
                btn.disabled = true;
                btn.textContent = 'Fixing...';
                let fixed = 0;
                try {
                    for (const req of targets) {
                        await applyLegacyWithdrawalDeduction(req.userId, req.id, req);
                        fixed++;
                    }
                    renderAdminFundRequests(allFundRequestsCache);
                    updateLegacyWithdrawalFixSummary();
                    refreshAdminDashboardCaches().catch(error => console.warn('Admin cache refresh after legacy fix skipped:', error));
                    showNotification(`Fixed ${fixed} old pending withdrawal(s).`);
                    window.closeModal();
                } catch (error) {
                    console.error('Legacy withdrawal fix failed:', error);
                    showNotification(`Error: ${error.message}`, true);
                    btn.disabled = false;
                    btn.textContent = 'Deduct Old Pending';
                }
            };
        };

let handleWithdrawRequest = async (amount, method, methodName) => {
            if (!currentUser) return showNotification('Error: You are not logged in.', true);
            if (!currentUserData) {
                return showNotification('Your user data is still loading. Please try again.', true);
            }
            if (currentUserData.isDisabled || currentUserData.dueLoanBlocked) {
                return showNotification(currentUserData.dueLoanReason || currentUserData.banReason || 'Your account is blocked. Please contact admin.', true);
            }
            if (currentUserData.isFlagged) {
                return showNotification(currentUserData.banReason || 'Your account is flagged. Please contact admin.', true);
            }
            const resolvedMethodName = methodName || getWithdrawalMethodName(method, 'Withdrawal');

            const pendingWithdrawalCount = (await loadUserPendingWithdrawalsMerged(currentUser.uid)).length;
            if (pendingWithdrawalCount >= maxPendingWithdrawalsPerUser) {
                return showNotification(`You already have ${pendingWithdrawalCount} pending withdrawal request(s). Please wait for them to be processed.`, true);
            }

            let paymentDetails = '';
            let methodSpecificDetails = {};

            switch (method) {
                case 'upi':
                    paymentDetails = getProfilePaymentDetails(method).upiId || 'Not set';
                    methodSpecificDetails = { upiId: paymentDetails };
                    if (amount < minWithdrawalUpi) return showNotification(`Minimum withdrawal for UPI is ₹${minWithdrawalUpi}`, true);
                    break;
                case 'bank':
                    const bankData = getProfilePaymentDetails(method);
                    // If bank details are missing in current profile, try to fetch from user data
                    const accountNumber = bankData.accountNumber || currentUserData.accountNumber || 'N/A';
                    const ifsc = bankData.ifsc || currentUserData.ifsc || 'N/A';
                    const bankName = bankData.bankName || currentUserData.bankName || 'N/A';
                    const accountName = bankData.accountName || currentUserData.accountName || 'N/A';

                    paymentDetails = `A/C: ${accountNumber}, IFSC: ${ifsc}, Name: ${accountName}`;
                    methodSpecificDetails = {
                        accountNumber: accountNumber,
                        ifsc: ifsc,
                        bankName: bankName,
                        accountName: accountName
                    };
                    if (amount < minWithdrawalBank) return showNotification(`Minimum withdrawal for Bank is ₹${minWithdrawalBank}`, true);
                    break;
                default:
                    paymentDetails = getProfilePaymentDetails(method).email || 'Not set';
                    methodSpecificDetails = { email: paymentDetails };
                    if (['play_store', 'amazon_gift', 'flipkart_gift'].includes(method)) {
                        methodSpecificDetails.giftCardType = method;
                        methodSpecificDetails.giftCardName = resolvedMethodName;
                    }
                    if (amount < minWithdrawalRedeem) return showNotification(`Minimum withdrawal for this method is ₹${minWithdrawalRedeem}`, true);
            }

            try {
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                const reqRef = doc(collection(db, `artifacts/${appId}/public/data/fund_requests`));
                const requestedAt = Date.now();
                const requestPayload = stripUndefinedFields({
                    id: reqRef.id,
                    userId: currentUser.uid,
                    userName: currentUserData.name || 'N/A',
                    userMobile: currentUserData.mobile || 'N/A',
                    userEmail: currentUserData.email || 'N/A',
                    type: 'withdrawal',
                    amount,
                    method: resolvedMethodName,
                    methodId: method,
                    upiId: method === 'upi' ? paymentDetails : '',
                    paymentDetails,
                    ...methodSpecificDetails,
                    status: 'pending',
                    requestedAt
                });

                await runTransaction(db, async (tx) => {
                    const userDoc = await tx.get(userRef);
                    if (!userDoc.exists()) throw new Error("User account not found!");

                    const currentBalance = userDoc.data().balance || 0;
                    if (getSpendableWalletBalance(userDoc.data()) < amount) throw new Error(getInsufficientWalletMessage(userDoc.data()));

                    // 1. Deduct balance immediately
                    const balanceAfter = currentBalance - amount;
                    requestPayload.balanceBefore = currentBalance;
                    requestPayload.balanceAfter = balanceAfter;
                    tx.update(userRef, { balance: balanceAfter });

                    // 2. Add fund request (with snapshot of payment details)
                    const { id, ...firebaseRequestPayload } = requestPayload;
                    tx.set(reqRef, stripUndefinedFields({
                        ...firebaseRequestPayload,
                        requestedAt: serverTimestamp()
                    }));

                    // 3. Add a pending transaction record for the user
                    const txRef = doc(collection(userRef, 'transactions'));
                    tx.set(txRef, stripUndefinedFields({
                        type: 'withdrawal',
                        amount: amount,
                        comment: `Withdrawal Request (${resolvedMethodName})`,
                        timestamp: serverTimestamp(),
                        status: 'pending',
                        requestId: reqRef.id,
                        transactionId: generateTransactionId(),
                        method: resolvedMethodName,
                        methodId: method,
                        // Save a snapshot of details here too
                        paymentDetails: paymentDetails,
                        balanceBefore: currentBalance,
                        balanceAfter,
                        ...methodSpecificDetails
                    }));
                });

                upsertCloudFundRequest(requestPayload).catch(error => {
                    console.warn('Withdrawal cloud request background sync skipped:', error);
                });
                syncRecentTransactionsToCloud(currentUser.uid).catch(error => {
                    console.warn('Withdrawal transaction background sync skipped:', error);
                });
                showNotification('Withdrawal request sent to admin.', false, true);
                window.closeModal();
                hidePage();
            } catch (e) {
                console.error("Withdraw request failed: ", e);
                const message = String(e?.message || '');
                const userMessage = /permission-denied|missing or insufficient permissions/i.test(message)
                    ? 'Withdrawal permission is blocked for this account. Please contact admin.'
                    : /resource-exhausted|quota exceeded/i.test(message)
                    ? 'Database daily quota exceeded. Please try again later.'
                    : /insufficient|pending|not found|minimum|flagged|blocked/i.test(message)
                    ? message
                    : 'Could not submit withdrawal request. Please try again.';
                showNotification(userMessage, true);
            }
        };

const handleSaveWithdrawSettings = async () => {
            const referralReward = parseInt(document.getElementById('setting-referral-reward')?.value || '0');
            const minUpi = parseInt(document.getElementById('setting-min-upi').value);
            const minBank = parseInt(document.getElementById('setting-min-bank').value);
            const minRedeem = parseInt(document.getElementById('setting-min-redeem').value);
            const maxDay = parseInt(document.getElementById('setting-max-day').value);
            const maxPending = parseInt(document.getElementById('setting-max-pending').value);

            if (isNaN(referralReward) || referralReward < 0 || isNaN(minUpi) || isNaN(minBank) || isNaN(minRedeem) || isNaN(maxDay) || isNaN(maxPending)) {
                return showNotification('Please enter valid numbers for all settings.', true);
            }

            try {
                const configRef = doc(db, `artifacts/${appId}/settings`, 'app_config');
                const updatedConfig = {
                    referralRewardAmount: referralReward,
                    referralRewardUpdatedAt: serverTimestamp(),
                    referralRewardUpdatedBy: currentUser.uid,
                    min_withdrawal_upi: minUpi,
                    min_withdrawal_bank: minBank,
                    min_withdrawal_redeem: minRedeem,
                    min_withdrawal_amount: Math.min(minUpi, minBank, minRedeem),
                    max_withdrawal_per_day: maxDay,
                    max_pending_withdrawals: maxPending,
                    updatedAt: serverTimestamp()
                };
                await setDoc(configRef, updatedConfig, { merge: true });

                const localConfig = {
                    referralRewardAmount: referralReward,
                    referralRewardUpdatedAt: Date.now(),
                    min_withdrawal_upi: minUpi,
                    min_withdrawal_bank: minBank,
                    min_withdrawal_redeem: minRedeem,
                    min_withdrawal_amount: Math.min(minUpi, minBank, minRedeem),
                    max_withdrawal_per_day: maxDay,
                    max_pending_withdrawals: maxPending
                };
                applyAppConfig(localConfig);
                withdrawalSettingsLoadedAt = Date.now();

                showNotification('Rate settings saved successfully!');
                window.closeModal();
            } catch (e) {
                console.error("Save settings failed:", e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

const applyWithdrawalConfig = (config = {}) => {
            minWithdrawalUpi = setNumberSetting(config.min_withdrawal_upi, minWithdrawalUpi);
            minWithdrawalBank = setNumberSetting(config.min_withdrawal_bank, minWithdrawalBank);
            minWithdrawalRedeem = setNumberSetting(config.min_withdrawal_redeem, minWithdrawalRedeem);
            maxWithdrawalPerDay = setNumberSetting(config.max_withdrawal_per_day, maxWithdrawalPerDay);
            maxPendingWithdrawalsPerUser = Math.max(1, setNumberSetting(config.max_pending_withdrawals, maxPendingWithdrawalsPerUser));
            minWithdrawalAmount = setNumberSetting(
                config.min_withdrawal_amount,
                Math.min(minWithdrawalUpi, minWithdrawalBank, minWithdrawalRedeem)
            );
            updateMinWithdrawalInfo();
            const amountInput = document.getElementById('withdraw-amount-input');
            if (amountInput && activeWithdrawMethod) {
                const minForMethod = getMinWithdrawalForMethod(activeWithdrawMethod);
                amountInput.min = String(minForMethod);
                const helper = amountInput.parentElement?.querySelector('p');
                if (helper) helper.textContent = `Minimum withdrawal: ₹${minForMethod}`;
            }
        };

const loadWithdrawalSettingsOnce = async (force = false) => {
            const now = Date.now();
            if (!force && withdrawalSettingsLoadedAt && now - withdrawalSettingsLoadedAt < 30000) return;
            if (withdrawalSettingsLoadPromise && !force) return withdrawalSettingsLoadPromise;

            withdrawalSettingsLoadPromise = getDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'))
                .then(snapshot => {
                    if (snapshot.exists()) applyAppConfig(snapshot.data());
                    withdrawalSettingsLoadedAt = Date.now();
                })
                .catch(error => {
                    console.error('Withdrawal settings load failed:', error);
                })
                .finally(() => {
                    withdrawalSettingsLoadPromise = null;
                });

            return withdrawalSettingsLoadPromise;
        };

const getMinWithdrawalForMethod = (method) => {
            if (method === 'upi') return minWithdrawalUpi;
            if (method === 'bank') return minWithdrawalBank;
            return minWithdrawalRedeem;
        };

const updateMinWithdrawalInfo = () => {
            const infoElement = document.getElementById('min-withdrawal-info');
            if (infoElement) {
                infoElement.textContent = `Min. withdrawal: ₹${minWithdrawalAmount}`;
            }
        };

const originalHandleWithdrawRequest = handleWithdrawRequest;

handleWithdrawRequest = async function (amount, method, methodName) {
            // Prevent duplicate request
            if (!preventDuplicateRequest('withdrawal', 15000)) {
                return;
            }

            try {
                await loadWithdrawalSettingsOnce();
                // Check minimum withdrawal
                const minForMethod = getMinWithdrawalForMethod(method);
                if (amount < minForMethod) {
                    showNotification(`Minimum withdrawal for ${methodName} is ₹${minForMethod}`, true);
                    return;
                }

                // Call original function
                await originalHandleWithdrawRequest.call(this, amount, method, methodName);
            } finally {
                pendingRequests.delete('withdrawal');
            }
        };

const startWithdrawalSettingsListener = () => {
            if (appConfigListenerActive) return;
            appConfigListenerActive = true;
            const stopListening = onSnapshot(doc(db, `artifacts/${appId}/settings`, 'app_config'), (snapshot) => {
                if (!snapshot.exists()) return;
                applyAppConfig(snapshot.data());
                withdrawalSettingsLoadedAt = Date.now();
            }, (error) => {
                appConfigListenerActive = false;
                console.error('App settings listener failed:', error);
            });
            unsubscribers.push(() => {
                stopListening();
                appConfigListenerActive = false;
            });
        };

// Expose functions to window for global access
window.loadUserPendingWithdrawalsMerged = loadUserPendingWithdrawalsMerged;
window.checkPendingWithdrawal = checkPendingWithdrawal;
window.isWithdrawMethodDetailsComplete = isWithdrawMethodDetailsComplete;
window.showWithdrawDetailsMissingModal = showWithdrawDetailsMissingModal;
window.getWithdrawalTransactions = getWithdrawalTransactions;
window.showWithdrawalInvoicesPage = showWithdrawalInvoicesPage;
window.showWithdrawalInvoiceDetails = showWithdrawalInvoiceDetails;
window.createWithdrawalInvoicePdf = createWithdrawalInvoicePdf;
window.downloadWithdrawalInvoicePdf = downloadWithdrawalInvoicePdf;
window.getPendingWithdrawalForBot = getPendingWithdrawalForBot;
window.notifyWithdrawalStatus = notifyWithdrawalStatus;
window.getWithdrawMethodLogo = getWithdrawMethodLogo;
window.renderWithdrawMethodLogo = renderWithdrawMethodLogo;
window.getWithdrawalMethodName = getWithdrawalMethodName;
window.normalizeWithdrawalMethodId = normalizeWithdrawalMethodId;
window.getWithdrawalDisplayMethodName = getWithdrawalDisplayMethodName;
window.getWithdrawalDetailText = getWithdrawalDetailText;
window.getWithdrawalSnapshot = getWithdrawalSnapshot;
window.showWithdrawPage = showWithdrawPage;
window.showWithdrawAmountPage = showWithdrawAmountPage;
window.handleWithdrawConfirmation = handleWithdrawConfirmation;
window.startLoanRepaymentAfterWithdrawalApproval = startLoanRepaymentAfterWithdrawalApproval;
window.showWithdrawalHistoryPage = showWithdrawalHistoryPage;
window.isWithdrawalHistorySourceRecord = isWithdrawalHistorySourceRecord;
window.normalizeWithdrawalHistoryRecord = normalizeWithdrawalHistoryRecord;
window.mergeWithdrawalHistoryRecords = mergeWithdrawalHistoryRecords;
window.loadWithdrawalHistory = loadWithdrawalHistory;
window.renderWithdrawalHistoryList = renderWithdrawalHistoryList;
window.isLegacyWithdrawalRequest = isLegacyWithdrawalRequest;
window.isWithdrawalBalanceDeducted = isWithdrawalBalanceDeducted;
window.shouldDeductLegacyWithdrawal = shouldDeductLegacyWithdrawal;
window.getLegacyWithdrawalTargets = getLegacyWithdrawalTargets;
window.handleSetWithdrawalGiftCardType = handleSetWithdrawalGiftCardType;
window.applyLegacyWithdrawalDeduction = applyLegacyWithdrawalDeduction;
window.handleFixLegacyPendingWithdrawals = handleFixLegacyPendingWithdrawals;
window.handleWithdrawRequest = handleWithdrawRequest;
window.handleSaveWithdrawSettings = handleSaveWithdrawSettings;
window.applyWithdrawalConfig = applyWithdrawalConfig;
window.loadWithdrawalSettingsOnce = loadWithdrawalSettingsOnce;
window.getMinWithdrawalForMethod = getMinWithdrawalForMethod;
window.updateMinWithdrawalInfo = updateMinWithdrawalInfo;
window.originalHandleWithdrawRequest = originalHandleWithdrawRequest;
window.startWithdrawalSettingsListener = startWithdrawalSettingsListener;
