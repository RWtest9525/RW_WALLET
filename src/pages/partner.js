// File: src/pages/partner.js

const fetchUserInvestmentsFromBackend = async (userId = currentUser?.uid) => {
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/partner-investments/user/${encodeURIComponent(userId)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }, 10000);
                if (!response.ok) throw new Error('Failed to load user investments');
                const data = await response.json();
                if (!data.ok) throw new Error(data.message || 'Failed to load user investments');
                return data.investments;
            } catch (err) {
                console.warn('Backend user investments fetch failed:', err);
                return [];
            }
        };

const getPartnerInvestmentHeader = () => `
            <header class="flex items-center justify-between gap-3 mb-6 p-4 bg-white dark:bg-gray-800 shadow-md page-header-fixed">
                <div class="flex items-center min-w-0">
                    <button class="page-back-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-2 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                    </button>
                    <h2 class="text-xl font-bold truncate">Partner Investment</h2>
                </div>
                <div class="shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-3 py-2 text-right">
                    <p class="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-300">Wallet Balance</p>
                    <p class="text-sm font-bold text-gray-900 dark:text-white">${formatCurrency(currentUserData?.balance || 0)}</p>
                </div>
            </header>
            <div class="p-4 pt-0">`;

const attachInvestmentInvoiceButtons = (investments = []) => {
            document.querySelectorAll('[data-action="download-investment-invoice"]').forEach(btn => {
                btn.onclick = () => {
                    const inv = investments.find(i => i.id === btn.dataset.investmentid);
                    if (inv) downloadInvestmentInvoice(inv);
                };
            });
        };

const renderPartnerTrackList = (investments = []) => {
            const list = document.getElementById('partner-track-list');
            if (!list) return;
            list.innerHTML = investments.length ? investments.map(inv => renderUserInvestmentCard(inv)).join('') : `
                <div class="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-800 p-5 text-center bg-emerald-50/60 dark:bg-emerald-900/10">
                    <p class="font-semibold">No investment yet</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Start with wallet funds and track monthly returns here.</p>
                </div>`;
            attachInvestmentInvoiceButtons(investments);
        };

const showPartnerPage = () => {
            if (!currentUser || !currentUserData) return showNotification('User data not loaded. Please wait.', true);

            const investments = allInvestmentsCache
                .filter(inv => inv.userId === currentUser.uid)
                .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));

            const activeCards = investments.length ? investments.map(inv => renderUserInvestmentCard(inv)).join('') : `
                <div class="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-800 p-5 text-center bg-emerald-50/60 dark:bg-emerald-900/10">
                    <p class="font-semibold">No investment yet</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Start with wallet funds and track monthly returns here.</p>
                </div>`;

            showPage(`
                ${getPageHeader('Become Partner')}
                <div class="max-w-md mx-auto space-y-5">
                    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-700 to-slate-900 text-white p-6 shadow-xl">
                        <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full border border-white/20"></div>
                        <div class="relative flex items-center gap-4">
                            <div class="w-16 h-16 rounded-2xl bg-white/90 p-3 shadow-lg">
                                <img src="${PARTNER_ICON_URL}" alt="Become Partner" class="w-full h-full object-contain">
                            </div>
                            <div>
                                <p class="text-xs uppercase tracking-wide text-white/70">RW Partner Plan</p>
                                <h3 class="text-2xl font-bold">Invest wallet funds</h3>
                                <p class="text-sm text-white/75 mt-1">Earn 1% monthly interest after every 30 days.</p>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button id="new-investment-btn" class="rounded-2xl bg-emerald-600 text-white py-3 font-semibold shadow-sm">Create Investment</button>
                        <button id="track-investment-btn" class="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-3 font-semibold">Track Investment</button>
                    </div>
                    <div id="partner-track-list" class="space-y-3">${activeCards}</div>
                </div>
                ${getPageFooter()}`);

            document.getElementById('new-investment-btn').onclick = showCreatePartnerInvestmentPage;
            document.getElementById('track-investment-btn').onclick = () => document.getElementById('partner-track-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            attachInvestmentInvoiceButtons(investments);

            processDuePartnerInvestmentsForUser(currentUser.uid)
                .catch(error => console.warn('Partner due processing skipped:', error))
                .finally(() => fetchUserInvestmentsFromBackend(currentUser.uid)
                    .then((investments) => {
                        allInvestmentsCache = allInvestmentsCache.filter(inv => inv.userId !== currentUser.uid).concat(investments);
                        const freshInvestments = investments
                            .map(inv => {
                                return {
                                    ...inv,
                                    startDate: inv.startDate?.seconds ? new Date(inv.startDate.seconds * 1000) : inv.startDate,
                                    endDate: inv.endDate?.seconds ? new Date(inv.endDate.seconds * 1000) : inv.endDate,
                                    nextPayoutAt: inv.nextPayoutAt?.seconds ? new Date(inv.nextPayoutAt.seconds * 1000) : inv.nextPayoutAt,
                                    createdAt: inv.createdAt?.seconds ? new Date(inv.createdAt.seconds * 1000) : inv.createdAt
                                };
                            })
                            .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
                        renderPartnerTrackList(freshInvestments);
                    })
                    .catch(error => console.warn('Partner investment background refresh skipped:', error)));
        };

const renderUserInvestmentCard = (inv) => {
            const start = toDate(inv.startDate) || toDate(inv.createdAt) || new Date();
            const end = toDate(inv.endDate);
            const next = toDate(inv.nextPayoutAt);
            const paidInterest = inv.paidInterest || 0;
            const totalInterest = inv.totalInterest || 0;
            const progress = totalInterest > 0 ? Math.min(100, Math.round((paidInterest / totalInterest) * 100)) : 0;
            return `
                <div class="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                    <div class="flex justify-between gap-3">
                        <div>
                            <p class="text-xs uppercase text-gray-500">Investment</p>
                            <p class="text-xl font-bold">${formatCurrency(inv.amount || 0)}</p>
                            <p class="text-xs text-gray-500 mt-1">${start.toLocaleDateString('en-IN')} - ${end ? end.toLocaleDateString('en-IN') : 'N/A'}</p>
                        </div>
                        <span class="h-fit rounded-full px-3 py-1 text-xs font-bold ${inv.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-emerald-100 text-emerald-700'}">${inv.status || 'active'}</span>
                    </div>
                    <div class="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div class="h-full bg-emerald-500" style="width:${progress}%"></div>
                    </div>
                    <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div class="rounded-xl bg-gray-50 dark:bg-gray-700 p-2"><span class="text-gray-500">Interest got</span><p class="font-bold">${formatCurrency(paidInterest)}</p></div>
                        <div class="rounded-xl bg-gray-50 dark:bg-gray-700 p-2"><span class="text-gray-500">Next interest</span><p class="font-bold">${next && inv.status === 'active' ? next.toLocaleDateString('en-IN') : 'Done'}</p></div>
                    </div>
                    <button data-action="download-investment-invoice" data-investmentid="${inv.id}" class="mt-3 w-full rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-2 text-sm font-semibold">Download PDF Invoice</button>
                </div>`;
        };

const showCreatePartnerInvestmentPage = () => {
            showPage(`
                ${getPartnerInvestmentHeader()}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md space-y-5">
                    <div class="text-center">
                        <div class="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 p-3">
                            <img src="${PARTNER_ICON_URL}" alt="Partner" class="w-full h-full object-contain">
                        </div>
                        <h3 class="text-xl font-bold mt-3">Create Investment</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">1% monthly interest, processed every 30 days.</p>
                    </div>
                    <div class="space-y-3">
                        <input type="number" id="partner-amount-input" min="${PARTNER_MIN_INVESTMENT}" placeholder="Minimum investment ${formatCurrency(PARTNER_MIN_INVESTMENT)}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <input type="number" id="partner-months-input" min="1" max="60" placeholder="Type no. of months e.g. 1, 2, 3" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    </div>
                    <div id="partner-investment-summary" class="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-3"></div>
                    <label class="flex gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm">
                        <input type="checkbox" id="partner-terms-checkbox" class="mt-1">
                        <span>I am confirming that I do this after reading all documents and accept the <button id="partner-terms-link" type="button" class="text-emerald-600 font-semibold underline">terms and conditions</button>.</span>
                    </label>
                    <button id="confirm-partner-investment-btn" class="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 transition">Invest Now</button>
                </div>
                ${getPageFooter()}`);

            updatePartnerInvestmentSummary();
            document.getElementById('partner-amount-input').addEventListener('input', updatePartnerInvestmentSummary);
            document.getElementById('partner-months-input').addEventListener('input', updatePartnerInvestmentSummary);
            document.getElementById('partner-terms-link').onclick = showPartnerTermsModal;
            document.getElementById('confirm-partner-investment-btn').onclick = handleCreatePartnerInvestment;
        };

const showPartnerTermsModal = () => {
            renderModal('Partner Terms & Conditions',
                `<div class="space-y-3 text-sm">
                    <p class="font-semibold">Please read before investing wallet funds.</p>
                    <ul class="list-disc pl-5 space-y-2 text-gray-600 dark:text-gray-300">
                        <li>Interest rate is 1% per month on invested wallet amount.</li>
                        <li>Interest is processed after each completed 30 day cycle.</li>
                        <li>If you withdraw before the selected end date, no pending interest is paid.</li>
                        <li>Early withdrawal has a 2% charge deducted from principal.</li>
                        <li>Principal remains locked until maturity unless admin closes early under these conditions.</li>
                        <li>You confirm that you invested after reading all documents and conditions.</li>
                    </ul>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg">I Understand</button>`,
                'max-w-md'
            );
        };

const handleCreatePartnerInvestment = async () => {
            const { amount, months, startDate, endDate, monthlyInterest, totalInterest } = getPartnerInvestmentSummary();
            if (amount <= 0 || months <= 0 || months > 60 || !endDate) {
                return showNotification('Enter valid amount and months.', true);
            }
            if (amount < PARTNER_MIN_INVESTMENT) {
                return showNotification(`Minimum partner investment is ${formatCurrency(PARTNER_MIN_INVESTMENT)}.`, true);
            }
            if (!document.getElementById('partner-terms-checkbox').checked) {
                return showNotification('Please accept partner terms and conditions.', true);
            }
            if (getSpendableWalletBalance(currentUserData) < amount) {
                return showNotification(getInsufficientWalletMessage(currentUserData), true);
            }

            const btn = document.getElementById('confirm-partner-investment-btn');
            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Investing...';
            }

            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/partner-investments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        amount,
                        months,
                        monthlyInterest,
                        totalInterest,
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString()
                    })
                }, 20000);

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.message || 'Server error during investment');
                }

                const resData = await response.json();
                if (!resData.ok) {
                    throw new Error(resData.message || 'Investment failed');
                }

                const invoiceData = {
                    id: resData.investmentId,
                    invoiceId: resData.invoiceId,
                    userName: currentUserData.name || 'User',
                    userEmail: currentUserData.email || currentUser.email || '',
                    userMobile: currentUserData.mobile || '',
                    amount,
                    months,
                    interestRate: PARTNER_INTEREST_RATE,
                    monthlyInterest,
                    totalInterest,
                    paidInterest: 0,
                    startDate,
                    endDate,
                    status: 'active',
                    createdAt: new Date()
                };

                syncRecentTransactionsToCloud(currentUser.uid).catch(error => console.warn('Partner background transaction sync failed:', error));

                renderModal('Investment Created',
                    `<div class="text-center space-y-3">
                        <div class="w-16 h-16 rounded-full bg-emerald-100 mx-auto p-3"><img src="${PARTNER_ICON_URL}" class="w-full h-full object-contain" alt="Partner"></div>
                        <h3 class="font-bold text-lg">Investment successful</h3>
                        <p class="text-sm text-gray-500">Your invoice is ready. Interest starts after 30 days.</p>
                    </div>`,
                    `<button onclick="window.closeModal(); showPartnerPage();" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Close</button>
                     <button id="download-new-investment-invoice-btn" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg">Download PDF Invoice</button>`,
                    'max-w-sm'
                );
                document.getElementById('download-new-investment-invoice-btn').onclick = () => downloadInvestmentInvoice(invoiceData);
            } catch (e) {
                console.error('Partner investment failed:', e);
                showNotification(`Error: ${e.message}`, true);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = 'Invest Now';
                }
            }
        };

const processDuePartnerInvestmentsForUser = async (userId) => {
            try {
                const investments = await fetchUserInvestmentsFromBackend(userId);
                allInvestmentsCache = allInvestmentsCache.filter(inv => inv.userId !== userId).concat(investments);
                const activeInvestments = investments.filter(inv => inv.status === 'active');
                for (const inv of activeInvestments) {
                    if (toDate(inv.nextPayoutAt) && toDate(inv.nextPayoutAt) <= new Date()) {
                        await processPartnerInterest(inv.id);
                    }
                }
            } catch (err) {
                console.warn('Process due partner investments failed:', err);
            }
        };

const processPartnerInterest = async (investmentId) => {
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/partner-investments/${encodeURIComponent(investmentId)}/interest`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }, 15000);
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.message || 'Failed to process interest');
                }
                const data = await response.json();
                if (!data.ok) throw new Error(data.message || 'Failed to process interest');
            } catch (err) {
                console.error('Process partner interest failed:', err);
                throw err;
            }
        };

const createPartnerInvestmentInvoicePdf = (investment) => {
            const start = toDate(investment.startDate) || toDate(investment.createdAt) || new Date();
            const end = toDate(investment.endDate) || addMonthsClamped(start, investment.months || 1);
            const invoiceId = investment.invoiceId || `INV-${(investment.id || generateTransactionId()).slice(0, 8).toUpperCase()}`;
            const amount = Number(investment.amount || 0);
            const monthlyInterest = Number(investment.monthlyInterest || (amount * (investment.interestRate || PARTNER_INTEREST_RATE)) || 0);
            const totalInterest = Number(investment.totalInterest || (monthlyInterest * (investment.months || 0)) || 0);
            const paidInterest = Number(investment.paidInterest || 0);
            const maturityValue = amount + totalInterest;
            const status = String(investment.status || 'active').toUpperCase();
            const statusColor = status === 'COMPLETED' ? '0.05 0.55 0.32' : status === 'CANCELLED' ? '0.78 0.12 0.12' : '0.03 0.35 0.85';
            const userName = investment.userName || currentUserData?.name || 'User';
            const userMobile = investment.userMobile || currentUserData?.mobile || 'N/A';
            const userEmail = investment.userEmail || currentUserData?.email || currentUser?.email || 'N/A';

            const commands = [];
            const text = (value, x, y, size = 10, font = 'F1', color = '0 0 0') => {
                commands.push('BT', `/${font} ${size} Tf`, `${color} rg`, `${x} ${y} Td`, `(${escapePdfText(value)}) Tj`, 'ET');
            };
            const fillRect = (x, y, w, h, color) => commands.push('q', `${color} rg`, `${x} ${y} ${w} ${h} re f`, 'Q');
            const strokeRect = (x, y, w, h, color = '0.84 0.88 0.94') => commands.push('q', `${color} RG`, `${x} ${y} ${w} ${h} re S`, 'Q');
            const line = (x1, y1, x2, y2, color = '0.84 0.88 0.94') => commands.push('q', `${color} RG`, `${x1} ${y1} m ${x2} ${y2} l S`, 'Q');
            const labelValue = (label, value, x, y, w, accent = '0.02 0.45 0.36') => {
                fillRect(x, y, w, 58, '1 1 1');
                fillRect(x, y, 5, 58, accent);
                strokeRect(x, y, w, 58, '0.88 0.91 0.96');
                text(label, x + 16, y + 36, 8, 'F2', '0.42 0.49 0.6');
                text(truncatePdfText(value, 28), x + 16, y + 17, 14, 'F2', '0.06 0.1 0.18');
            };

            fillRect(0, 0, 595, 842, '0.95 0.98 1');
            fillRect(34, 708, 527, 96, '0.02 0.08 0.18');
            fillRect(34, 708, 527, 14, '0.02 0.62 0.45');
            fillRect(402, 742, 128, 28, '0.07 0.18 0.35');
            fillRect(46, 654, 503, 34, '0.9 0.98 0.95');
            text('REVIEWS WORLD', 54, 766, 22, 'F2', '1 1 1');
            text('PARTNER INVESTMENT INVOICE', 54, 741, 13, 'F2', '0.74 0.92 1');
            text(`Invoice ID: ${invoiceId}`, 410, 753, 9, 'F2', '1 1 1');
            text(`Generated: ${new Date().toLocaleString('en-IN')}`, 54, 720, 8, 'F1', '0.78 0.84 0.93');
            text(`Status: ${status}`, 410, 720, 9, 'F2', '0.55 0.95 0.78');
            text('Partner investment receipt for RW Wallet records', 62, 668, 10, 'F2', '0.02 0.45 0.36');

            labelValue('Billed To', truncatePdfText(userName, 34), 46, 574, 244, '0.02 0.45 0.36');
            text(truncatePdfText(userEmail, 40), 62, 582, 8, 'F1', '0.35 0.42 0.52');
            labelValue('Mobile Number', userMobile, 305, 574, 244, '0.03 0.35 0.85');
            text(`Duration: ${investment.months || 0} month(s)`, 321, 582, 8, 'F1', '0.35 0.42 0.52');

            labelValue('Investment Amount', formatPdfCurrency(amount), 46, 496, 156, '0.02 0.62 0.45');
            labelValue('Monthly Interest', formatPdfCurrency(monthlyInterest), 220, 496, 156, '0.03 0.35 0.85');
            labelValue('Maturity Value', formatPdfCurrency(maturityValue), 393, 496, 156, '0.92 0.5 0.08');

            fillRect(46, 416, 503, 38, '0.02 0.08 0.18');
            text('Field', 62, 431, 9, 'F2', '1 1 1');
            text('Details', 216, 431, 9, 'F2', '1 1 1');
            text('Amount / Value', 410, 431, 9, 'F2', '1 1 1');
            const rows = [
                ['Start Date', start.toLocaleDateString('en-IN'), '-'],
                ['End Date', end.toLocaleDateString('en-IN'), '-'],
                ['Interest Rate', `${((investment.interestRate || PARTNER_INTEREST_RATE) * 100).toFixed(1)}% per month`, '-'],
                ['Total Expected Interest', `${investment.months || 0} month period`, formatPdfCurrency(totalInterest)],
                ['Interest Got', 'Already processed', formatPdfCurrency(paidInterest)],
                ['Current Status', status, formatPdfCurrency(maturityValue)]
            ];
            let y = 382;
            rows.forEach((row, index) => {
                fillRect(46, y - 10, 503, 34, index % 2 === 0 ? '1 1 1' : '0.98 0.99 1');
                line(46, y - 11, 549, y - 11);
                text(row[0], 62, y + 2, 8, 'F2', '0.12 0.18 0.3');
                text(truncatePdfText(row[1], 32), 216, y + 2, 8, 'F1', row[0] === 'Current Status' ? statusColor : '0.22 0.28 0.38');
                text(truncatePdfText(row[2], 20), 410, y + 2, 8, 'F2', row[0] === 'Current Status' ? statusColor : '0.02 0.45 0.36');
                y -= 34;
            });

            fillRect(46, 126, 503, 88, '1 1 1');
            strokeRect(46, 126, 503, 88);
            fillRect(46, 196, 503, 18, '0.9 0.95 1');
            text('Important Terms', 62, 201, 9, 'F2', '0.08 0.18 0.32');
            text('1. Interest is processed after every completed 30 days.', 62, 176, 8, 'F1', '0.25 0.32 0.42');
            text('2. Early withdrawal before end date gives no pending interest and 2% charge is deducted.', 62, 158, 8, 'F1', '0.25 0.32 0.42');
            text('3. User confirmed this investment after reading all documents and terms.', 62, 140, 8, 'F1', '0.25 0.32 0.42');

            fillRect(34, 54, 527, 44, '0.02 0.08 0.18');
            text('This invoice is computer generated by RW Wallet.', 54, 80, 8, 'F1', '0.78 0.84 0.93');
            text('REVIEWS WORLD | Partner Investment Records', 54, 65, 9, 'F2', '1 1 1');
            text(`Invoice: ${invoiceId}`, 410, 65, 8, 'F1', '0.78 0.84 0.93');

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
            return { blob: new Blob([pdf], { type: 'application/pdf' }), invoiceId };
        };

const downloadInvestmentInvoice = (investment) => {
            const { blob, invoiceId } = createPartnerInvestmentInvoicePdf(investment);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${invoiceId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        };

// Expose functions to window for global access
window.fetchUserInvestmentsFromBackend = fetchUserInvestmentsFromBackend;
window.getPartnerInvestmentHeader = getPartnerInvestmentHeader;
window.attachInvestmentInvoiceButtons = attachInvestmentInvoiceButtons;
window.renderPartnerTrackList = renderPartnerTrackList;
window.showPartnerPage = showPartnerPage;
window.renderUserInvestmentCard = renderUserInvestmentCard;
window.showCreatePartnerInvestmentPage = showCreatePartnerInvestmentPage;
window.showPartnerTermsModal = showPartnerTermsModal;
window.handleCreatePartnerInvestment = handleCreatePartnerInvestment;
window.processDuePartnerInvestmentsForUser = processDuePartnerInvestmentsForUser;
window.processPartnerInterest = processPartnerInterest;
window.createPartnerInvestmentInvoicePdf = createPartnerInvestmentInvoicePdf;
window.downloadInvestmentInvoice = downloadInvestmentInvoice;
