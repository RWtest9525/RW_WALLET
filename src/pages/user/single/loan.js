// File: src/pages/loan.js

const getLoanReservedAmount = (user = currentUserData || {}) => {
            if (Number(user.activeLoanVersion || 0) < LOAN_APPLICATION_VERSION) return 0;
            const reserveStartValue = user.loanReserveStartsAt || user.activeLoanDueDate || user.loanDueDate;
            const reserveStartsAt = reserveStartValue?.toDate ? reserveStartValue.toDate() : reserveStartValue ? new Date(reserveStartValue) : null;
            const repaymentBasis = String(user.activeLoanRepaymentBasis || user.loanRepaymentBasis || '').toLowerCase();
            if (reserveStartsAt && reserveStartsAt > new Date()) return 0;
            if (!reserveStartsAt && repaymentBasis.includes('withdrawal')) return 0;
            const explicit = Number(user.loanLockedAmount ?? user.loan_locked_amount ?? 0);
            const rawReserve = Number.isFinite(explicit) && explicit > 0 ? explicit : 0;
            return Math.max(0, Math.min(Number(user.balance || 0), rawReserve));
        };

const getLoanLimitAmount = (user = currentUserData || {}) => {
            user = user || {};
            return Math.max(0, Number(user.maxLoanAmount || user.loanMaxAmount || user.creditLimit || user.loanCreditLimit || 0));
        };

const hasLoanDocumentFile = (documentInfo = null) => {
            if (!documentInfo) return false;
            if (typeof documentInfo === 'string') return !!documentInfo.trim();
            return !!(documentInfo.url || documentInfo.downloadURL || documentInfo.path || documentInfo.storage || documentInfo.name);
        };

const hasSubmittedLoanDocuments = (request = {}) => {
            request = request || {};
            if (request.loanDocumentsSubmitted === true || request.loanDocumentsVerified === true || request.loanDocumentsApproved === true) return true;
            const aadhaarDocument = request.documents?.aadhaar || request.aadhaarDocument || request.aadhaarDoc || request.aadhaarFile;
            const selfieDocument = request.documents?.selfie || request.selfieDocument || request.selfiePhoto || request.selfieFile;
            return hasLoanDocumentFile(aadhaarDocument) && hasLoanDocumentFile(selfieDocument);
        };

const hasSubmittedLoanDetails = (request = {}) => {
            request = request || {};
            const hasPersonalDetails = !!(
                request.personalDetails ||
                request.fatherName ||
                request.aadhaar ||
                request.aadhaarNumber
            );
            return hasPersonalDetails && hasSubmittedLoanDocuments(request);
        };

const isModernLoanRequest = (request = {}) => {
            request = request || {};
            const version = Number(request.requestVersion || request.loanApplicationVersion || request.latestLoanRequestVersion || 0);
            if (version >= LOAN_APPLICATION_VERSION) return hasSubmittedLoanDetails(request);
            const status = String(request.status || request.loanRequestStatus || '').trim().toLowerCase();
            return ['pending', 'approved', 'rejected', 'cancelled', 'canceled', 'failed', 'denied'].includes(status) && hasSubmittedLoanDetails(request);
        };

const isApprovedModernLoanRequest = (request = {}) => isModernLoanRequest(request) && String(request.status || request.loanRequestStatus || '').trim().toLowerCase() === 'approved';

const hasModernLoanApproval = (user = currentUserData || {}) => {
            user = user || {};
            return getLoanLimitAmount(user) > 0 || user.loanDocumentsVerified === true || user.loanDocumentsApproved === true || user.loanRequestStatus === 'approved';
        };

const hasDocumentedModernLoanApproval = (user = currentUserData || {}, requests = []) =>
            hasModernLoanApproval(user) || (requests && requests.some(isApprovedModernLoanRequest));

const isModernLoanRecord = (loan = {}) => {
            loan = loan || {};
            return Number(loan.loanApplicationVersion || loan.loanRequestVersion || loan.requestVersion || loan.latestLoanRequestVersion || 0) >= LOAN_APPLICATION_VERSION;
        };

const isActiveLoanRecord = (loan = {}) => {
            loan = loan || {};
            return String(loan.status || '').toLowerCase() === 'active';
        };

const getLoanPrincipal = (loan = {}) => {
            loan = loan || {};
            return Number(loan.amount || loan.principal || 0);
        };

const getUserLoanRecords = (userId, loans = allLoansCache) => loans
            .filter(loan => loan && loan.userId === userId && isModernLoanRecord(loan))
            .sort((a, b) => timestampToMillis(b.createdAt || b.paidAt) - timestampToMillis(a.createdAt || a.paidAt));

const getLatestModernLoanRequest = (userId, requests = allLoanRequestsCache) => requests
            .filter(request => request && request.userId === userId && isModernLoanRequest(request))
            .sort((a, b) => timestampToMillis(b.requestedAt || b.processedAt) - timestampToMillis(a.requestedAt || a.processedAt))[0] || null;

const getLoanRequestRecordId = (request = {}) => String(request.requestId || request.id || '').trim();

const getRawLoanRequestStatus = (request = {}) => String(request.status || request.loanRequestStatus || '').trim().toLowerCase();

const getLoanRequestRecordTime = (request = {}) => Math.max(
            timestampToMillis(request.reopenedAt || request.reopened_at),
            timestampToMillis(request.processedAt || request.processed_at),
            timestampToMillis(request.requestedAt || request.requested_at || request.createdAt || request.timestamp)
        );

const preferLoanRequestRecord = (current, next) => {
            if (!current) return next;
            const currentStatus = getRawLoanRequestStatus(current);
            const nextStatus = getRawLoanRequestStatus(next);
            const currentFinal = currentStatus && currentStatus !== 'pending';
            const nextFinal = nextStatus && nextStatus !== 'pending';
            if (nextFinal && !currentFinal) return next;
            if (currentFinal && !nextFinal) return current;
            return getLoanRequestRecordTime(next) >= getLoanRequestRecordTime(current) ? next : current;
        };

const mergeLoanRequestRecords = (...sources) => {
            const merged = new Map();
            sources.flat().filter(Boolean).forEach((request) => {
                const id = getLoanRequestRecordId(request);
                if (!id) return;
                merged.set(id, preferLoanRequestRecord(merged.get(id), request));
            });
            return Array.from(merged.values()).sort((a, b) => getLoanRequestRecordTime(b) - getLoanRequestRecordTime(a));
        };

const getLoanApplicantKey = (request = {}) => String(
            request.userId ||
            request.uid ||
            request.userEmail ||
            request.email ||
            request.mobile ||
            request.aadhaar ||
            request.id ||
            ''
        ).trim().toLowerCase();

const getLatestLoanRequestsByApplicant = (requests = [], users = []) => {
            const latestByApplicant = new Map();
            [...requests]
                .filter(isModernLoanRequest)
                .sort((a, b) => getLoanRequestRecordTime(b) - getLoanRequestRecordTime(a))
                .forEach((request) => {
                    const key = getLoanApplicantKey(request);
                    if (!key || latestByApplicant.has(key)) return;
                    
                    const user = users.find(u => (u.id || u.uid) === request.userId);
                    const userLoanStatus = user ? String(user.loanRequestStatus || '').trim().toLowerCase() : '';
                    const finalizedStatuses = ['approved', 'rejected', 'cancelled', 'canceled', 'failed', 'denied'];
                    
                    if (user && (getLoanLimitAmount(user) > 0 || finalizedStatuses.includes(userLoanStatus)) && getLoanRequestStatus(request) === 'pending') {
                        const targetStatus = finalizedStatuses.includes(userLoanStatus) ? userLoanStatus : 'approved';
                        request = { ...request, status: targetStatus };
                    }
                    
                    latestByApplicant.set(key, request);
                });
            return Array.from(latestByApplicant.values());
        };

const serializeCloudLoanRequest = (request = {}) => {
            const requestedAt = timestampToMillis(request.requestedAt || request.timestamp || request.createdAt) || Date.now();
            const processedAt = request.processedAt ? timestampToMillis(request.processedAt) : null;
            const requestId = String(request.requestId || request.id || `loan-${request.userId || currentUser?.uid || 'user'}-${requestedAt}`);
            return {
                requestId,
                userId: request.userId || currentUser?.uid || '',
                status: request.status || request.loanRequestStatus || 'pending',
                requestedAt,
                processedAt,
                details: {
                    ...stripUndefinedFields({ ...request, id: requestId, requestId, requestedAt, processedAt })
                }
            };
        };

const normalizeCloudLoanRequest = (request = {}) => {
            const details = request.details && typeof request.details === 'object' ? request.details : {};
            return {
                ...details,
                ...request,
                id: request.request_id || request.requestId || request.id || details.id || details.requestId,
                requestId: request.request_id || request.requestId || request.id || details.id || details.requestId,
                userId: request.user_id || request.userId || details.userId,
                requestedAt: Number(request.requested_at || request.requestedAt || details.requestedAt || Date.now()),
                processedAt: request.processed_at || request.processedAt || details.processedAt || null,
                status: request.status || details.status || 'pending'
            };
        };

const upsertCloudLoanRequest = async (request) => {
            try {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/loan-requests`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(serializeCloudLoanRequest(request))
                }, 6000);
                return true;
            } catch (error) {
                console.warn('Cloudflare loan request save failed:', error);
                reportSyncFailure('loan_request', 'new', 'firebase', 'd1', error?.message);
                return false;
            }
        };

const importCloudLoanRequests = async (requests = []) => {
            if (!requests.length || currentUser?.uid !== ADMIN_UID) return;
            try {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/loan-requests/import`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ requests: requests.map(serializeCloudLoanRequest) })
                }, 8000);
            } catch (error) {
                console.warn('Cloudflare loan request import failed:', error);
                reportSyncFailure('loan_import', 'batch', 'firebase', 'd1', error?.message);
            }
        };

const loadCloudLoanRequests = async ({ status = 'all', userId = '', limit = 500, timeoutMs = 8000 } = {}) => {
            const token = await getBackendAuthToken();
            const params = new URLSearchParams({ status, limit: String(limit) });
            if (userId) params.set('userId', userId);
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/loan-requests?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            }, timeoutMs);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Cloudflare loan request load failed');
            return (data.requests || []).map(normalizeCloudLoanRequest);
        };

const updateCloudLoanRequestStatus = async (requestId, status, details = {}) => {
            if (!requestId) return false;
            try {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/loan-requests/${encodeURIComponent(requestId)}`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status, details: stripUndefinedFields(details) })
                }, 6000);
                return true;
            } catch (error) {
                console.warn('Cloudflare loan request update failed:', error);
                reportSyncFailure('loan_request', requestId || 'unknown', 'firebase', 'd1', error?.message);
                return false;
            }
        };

const getLoanDueDateText = (loan = {}) => {
            const dueDate = toDate(loan.dueDate || loan.activeLoanDueDate || loan.loanDueDate);
            if (dueDate) return dueDate.toLocaleDateString('en-IN');
            const basis = String(loan.repaymentBasis || loan.activeLoanRepaymentBasis || loan.repaymentStatus || '').toLowerCase();
            if (basis.includes('withdrawal') || basis.includes('waiting')) return 'After withdrawal approval';
            return 'N/A';
        };

const getLoanRequestStatus = (request = {}) => {
            request = request || {};
            return String(request.status || request.loanRequestStatus || '').trim().toLowerCase();
        };

const isPendingModernLoanRequest = (request = {}) => isModernLoanRequest(request) && getLoanRequestStatus(request) === 'pending';

const isRejectedModernLoanRequest = (request = {}) =>
            isModernLoanRequest(request) && ['rejected', 'cancelled', 'canceled', 'failed', 'denied'].includes(getLoanRequestStatus(request));

const getLoanRequestReapplyDate = (request = {}) => {
            request = request || {};
            const explicitMillis = timestampToMillis(request.reapplyAfter || request.loanReapplyAfter || request.reapplyAt || request.cooldownUntil);
            const explicitDate = getValidDateFromMillis(explicitMillis);
            if (explicitDate && !Number.isNaN(explicitDate.getTime())) return explicitDate;
            const baseMillis = timestampToMillis(
                request.processedAt || request.rejectedAt || request.cancelledAt || request.canceledAt ||
                request.requestedAt || request.timestamp || request.createdAt
            );
            const baseDate = getValidDateFromMillis(baseMillis) || new Date();
            return addMonthsClamped(baseDate, LOAN_REAPPLY_WAIT_MONTHS);
        };

const getLoanReapplyBlock = (request = {}) => {
            request = request || {};
            if (!isRejectedModernLoanRequest(request)) return null;
            const reapplyAt = getLoanRequestReapplyDate(request);
            if (!reapplyAt || Number.isNaN(reapplyAt.getTime()) || reapplyAt <= new Date()) return null;
            return {
                reapplyAt,
                reason: request.rejectionReason || request.reason || request.adminReason || 'Admin cancelled or rejected your loan request.'
            };
        };

const getUserLoanRequestMarker = (user = currentUserData || {}) => {
            user = user || {};
            return {
                userId: user.id || user.uid || currentUser?.uid || '',
                status: user.loanRequestStatus || '',
                latestLoanRequestVersion: user.latestLoanRequestVersion || user.loanRequestVersion || user.loanApplicationVersion || 0,
                reapplyAfter: user.loanReapplyAfter || user.reapplyAfter || null,
                processedAt: user.loanProcessedAt || user.processedAt || null,
                rejectionReason: user.loanRejectionReason || user.loanRequestRejectionReason || user.rejectionReason || '',
                loanDocumentsSubmitted: user.loanDocumentsSubmitted === true,
                loanDocumentsVerified: user.loanDocumentsVerified === true,
                loanDocumentsApproved: user.loanDocumentsApproved === true,
                personalDetails: (user.loanDocumentsSubmitted === true || user.loanDocumentsVerified === true || user.loanDocumentsApproved === true) ? {
                    name: user.name || '',
                    mobile: getUserMobileValue(user) || ''
                } : null
            };
        };

const getActiveLoanFromUserMarker = (user = currentUserData || {}) => {
            user = user || {};
            if (Number(user.activeLoanVersion || 0) < LOAN_APPLICATION_VERSION) return null;
            const activeLoanId = String(user.activeLoanId || '').trim();
            const totalRepayable = Number(user.activeLoanRepayable ?? user.loanLockedAmount ?? 0);
            if (!activeLoanId && totalRepayable <= 0) return null;
            const amount = Number(user.activeLoanAmount ?? user.activeLoanPrincipal ?? user.loanPrincipal ?? 0);
            return {
                id: activeLoanId || `active-${user.id || user.uid || currentUser?.uid || 'loan'}`,
                userId: user.id || user.uid || currentUser?.uid || '',
                userName: user.name || 'User',
                userMobile: user.mobile || '',
                amount,
                principal: amount,
                interest: Number(user.activeLoanInterest ?? Math.max(0, totalRepayable - amount)),
                totalRepayable,
                lockedAmount: totalRepayable,
                dueDate: user.activeLoanDueDate || user.loanDueDate || null,
                repaymentStartedAt: user.activeLoanRepaymentStartedAt || user.loanRepaymentStartedAt || null,
                repaymentBasis: user.activeLoanRepaymentBasis || user.loanRepaymentBasis || '',
                status: 'active',
                loanApplicationVersion: LOAN_APPLICATION_VERSION,
                loanRequestVersion: LOAN_APPLICATION_VERSION,
                createdAt: user.activeLoanCreatedAt || Date.now()
            };
        };

const normalizeLoanDob = (dob = '') => {
            const value = String(dob || '').trim();
            const match = /^(\d{1,2})[\/_-](\d{1,2})[\/_-](\d{4})$/.exec(value);
            if (!match) return value;
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            return `${day}/${month}/${year}`;
        };

const getLoanRequestPersonal = () => ({
            name: document.getElementById('loan-name-input')?.value.trim() || '',
            fatherName: document.getElementById('loan-father-input')?.value.trim() || '',
            mobile: document.getElementById('loan-mobile-input')?.value.trim() || '',
            alternateMobile: document.getElementById('loan-alt-mobile-input')?.value.trim() || '',
            dob: normalizeLoanDob(document.getElementById('loan-dob-input')?.value || ''),
            aadhaar: document.getElementById('loan-aadhaar-input')?.value.trim() || ''
        });

const saveLoanApplicationDraftFromDom = (step = loanApplicationDraft.step || 1) => {
            if (step === 1) {
                loanApplicationDraft.personal = getLoanRequestPersonal();
            }
            if (step === 3) {
                loanApplicationDraft.acceptedTerms = !!document.getElementById('loan-final-terms-checkbox')?.checked;
            }
        };

const validateLoanApplicationStep = (step) => {
            if (step === 1) {
                const { name, fatherName, mobile, alternateMobile, dob, aadhaar } = loanApplicationDraft.personal || {};
                if (!name || !fatherName || !/^\d{10}$/.test(mobile) || !/^\d{10}$/.test(alternateMobile) || !isValidLoanDob(dob) || !/^\d{12}$/.test(aadhaar)) {
                    showNotification('Please fill all personal details correctly.', true);
                    return false;
                }
            }
            if (step === 2) {
                const docs = loanApplicationDraft.documents || {};
                const documentError = validateLoanDocumentSelection(docs.aadhaarFile, 'aadhaar') || validateLoanDocumentSelection(docs.selfieFile, 'selfie');
                if (documentError) {
                    showNotification(documentError, true);
                    return false;
                }
            }
            if (step === 3 && !loanApplicationDraft.acceptedTerms) {
                showNotification('Please accept loan terms before applying.', true);
                return false;
            }
            return true;
        };

const renderLoanStepCircles = (step) => {
            const steps = [
                { id: 1, title: 'Personal Details' },
                { id: 2, title: 'Documents' },
                { id: 3, title: 'Done' }
            ];
            const progressWidth = step <= 1 ? '0%' : step === 2 ? '50%' : '100%';
            return `
                <div class="relative px-3 pb-1 pt-2">
                    <div class="absolute left-[18%] right-[18%] top-7 h-1 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                    <div class="absolute left-[18%] top-7 h-1 rounded-full bg-gradient-to-r from-indigo-600 via-blue-500 to-emerald-500 transition-all duration-300" style="width:${progressWidth}; max-width:64%;"></div>
                    <div class="relative grid grid-cols-3 gap-2">
                    ${steps.map(item => {
                        const active = item.id === step;
                        const complete = item.id < step;
                        return `
                            <div class="flex flex-col items-center text-center">
                                <div class="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-black shadow-sm transition-all duration-300 ${complete ? 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-200 dark:shadow-none' : active ? 'border-indigo-600 bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none scale-105' : 'border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900'}">${complete ? '&#10003;' : item.id}</div>
                                <p class="mt-3 text-[10px] font-black uppercase leading-tight ${active ? 'text-indigo-700 dark:text-indigo-300' : complete ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400'}">${item.title}</p>
                            </div>`;
                    }).join('')}
                    </div>
                </div>`;
        };

const showLoanPendingPage = () => {
            showPage(`
                ${getPageHeader('Take Loan')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md text-center space-y-3">
                    <div class="w-14 h-14 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 mx-auto flex items-center justify-center">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"></path></svg>
                    </div>
                    <h3 class="text-lg font-semibold">Loan Request Pending</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Your updated details and documents have been sent to admin. After approval, your credit limit will appear here.</p>
                </div>
                ${getPageFooter()}`);
        };

const showLoanRejectedCooldownPage = (request = {}) => {
            const block = getLoanReapplyBlock(request);
            const reapplyText = block?.reapplyAt
                ? block.reapplyAt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : 'after 3 months';
            showPage(`
                ${getPageHeader('Take Loan')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md text-center space-y-4">
                    <div class="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 mx-auto flex items-center justify-center">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path></svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold">You are currently not eligible.</h3>
                        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Your loan request was cancelled or rejected by admin.</p>
                    </div>
                    <div class="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 text-left text-sm">
                        <p class="text-xs font-black uppercase text-red-500">Reason</p>
                        <p class="mt-1 text-gray-700 dark:text-gray-200">${escapeHtml(block?.reason || 'Admin cancelled or rejected your loan request.')}</p>
                    </div>
                    <div class="rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4">
                        <p class="text-xs font-black uppercase text-indigo-600 dark:text-indigo-300">Apply Again</p>
                        <p class="mt-1 font-black text-gray-900 dark:text-white">${escapeHtml(reapplyText)}</p>
                        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">After 3 months you can submit a fresh loan form.</p>
                    </div>
                </div>
                ${getPageFooter()}`);
        };

const showLoanCreditDashboardPage = (loans = []) => {
            const summary = buildLoanSummary(currentUserData, loans);
            const activeLoan = summary.activeLoans[0] || null;
            const canTakeLoan = hasModernLoanApproval(currentUserData) && summary.activeLoans.length === 0 && summary.availableAmount > 0;
            const historyCards = summary.loans.length ? summary.loans.map(loan => {
                const createdAt = toDate(loan.createdAt);
                const isActive = isActiveLoanRecord(loan);
                return `
                    <button data-action="user-view-loan-detail" data-loanid="${loan.id}" class="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-left shadow-sm">
                        <div class="flex justify-between gap-3">
                            <div>
                                <p class="text-sm font-black text-gray-900 dark:text-white">${formatCurrency(loan.amount || 0)}</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400">${createdAt ? createdAt.toLocaleDateString('en-IN') : 'Loan date N/A'} | Due ${getLoanDueDateText(loan)}</p>
                            </div>
                            <span class="h-fit rounded-full px-3 py-1 text-[10px] font-black uppercase ${isActive ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'}">${escapeHtml(loan.status || 'active')}</span>
                        </div>
                        <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div class="rounded-xl bg-gray-50 dark:bg-gray-700 p-2"><span class="text-gray-500">Interest</span><p class="font-bold">${formatCurrency(loan.interest || 0)}</p></div>
                            <div class="rounded-xl bg-gray-50 dark:bg-gray-700 p-2"><span class="text-gray-500">Repay</span><p class="font-bold">${formatCurrency(loan.totalRepayable || 0)}</p></div>
                        </div>
                    </button>`;
            }).join('') : '<p class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-5 text-center text-sm font-bold text-gray-500">No loan history yet.</p>';

            showPage(`
                ${getPageHeader('Take Loan')}
                <div class="max-w-md mx-auto space-y-5">
                    <div class="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-900 to-blue-700 p-5 text-white shadow-xl">
                        <p class="text-xs font-black uppercase tracking-widest text-white/60">RW Pay Later</p>
                        <div class="mt-4 grid grid-cols-2 gap-3">
                            <div>
                                <p class="text-xs text-white/60">Max Limit</p>
                                <p class="text-2xl font-black">${formatCurrency(summary.maxLimit)}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-xs text-white/60">Available</p>
                                <p class="text-2xl font-black">${formatCurrency(summary.availableAmount)}</p>
                            </div>
                        </div>
                        <div class="mt-4 rounded-2xl bg-white/10 p-3 text-sm">
                            <div class="flex justify-between"><span>Used Amount</span><span class="font-black">${formatCurrency(summary.usedAmount)}</span></div>
                            <div class="mt-1 flex justify-between"><span>Total Repayable</span><span class="font-black">${formatCurrency(summary.repayableAmount)}</span></div>
                        </div>
                    </div>
                    <button id="loan-dashboard-action-btn" ${canTakeLoan || activeLoan ? '' : 'disabled'} class="w-full rounded-2xl ${canTakeLoan ? 'bg-indigo-600 hover:bg-indigo-700' : activeLoan ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 cursor-not-allowed'} py-3 font-black text-white transition">
                        ${canTakeLoan ? 'Take Loan' : activeLoan ? 'Repay Active Loan' : 'No Available Limit'}
                    </button>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between px-1">
                            <h3 class="text-sm font-black text-gray-900 dark:text-white">Loan History</h3>
                            <span class="text-xs font-bold text-gray-400">${summary.loans.length} record(s)</span>
                        </div>
                        ${historyCards}
                    </div>
                </div>
                ${getPageFooter()}`);

            document.getElementById('loan-dashboard-action-btn')?.addEventListener('click', () => {
                if (canTakeLoan) return showTakeLoanPage();
                if (activeLoan) return showActiveLoanPage(activeLoan);
            });
        };

const showLoanPage = () => {
            if (!currentUser || !currentUserData) return showNotification('User data not loaded. Please wait.', true);

            const showLoanApplicationStart = () => {
                loanApplicationDraft = {
                    step: 1,
                    personal: {
                        name: currentUserData.name || '',
                        mobile: currentUserData.mobile || '',
                        fatherName: '',
                        alternateMobile: '',
                        dob: '',
                        aadhaar: ''
                    },
                    documents: {},
                    acceptedTerms: false
                };
                showLoanApplicationPage(1);
            };

            const markerLoan = getActiveLoanFromUserMarker(currentUserData);
            const markerRequest = getUserLoanRequestMarker(currentUserData);
            const markerRequests = isModernLoanRequest(markerRequest) ? [markerRequest] : [];
            const markerLoans = markerLoan ? [markerLoan] : [];

            const renderLoanState = (loans = markerLoans, requests = markerRequests) => {
                const pendingModernRequest = requests.find(isPendingModernLoanRequest) || null;
                const latestModernRequest = getLatestModernLoanRequest(currentUser.uid, requests);
                const userLoanMarker = getUserLoanRequestMarker(currentUserData);
                const activeLoans = loans.filter(isActiveLoanRecord);
                if (activeLoans.length || hasDocumentedModernLoanApproval(currentUserData, requests)) {
                    showLoanCreditDashboardPage(loans);
                    return;
                }
                if (pendingModernRequest || isPendingModernLoanRequest(userLoanMarker)) {
                    showLoanPendingPage();
                    return;
                }
                const reapplyBlock = getLoanReapplyBlock(latestModernRequest) || getLoanReapplyBlock(userLoanMarker);
                if (reapplyBlock) {
                    showLoanRejectedCooldownPage(latestModernRequest || userLoanMarker);
                    return;
                }
                showLoanApplicationStart();
            };

            renderLoanState(markerLoans, markerRequests);

            runAfterFirstPaint(async () => {
                let userLoans = getUserLoanRecords(currentUser.uid);
                if (markerLoan && !userLoans.some(loan => loan.id === markerLoan.id)) {
                    userLoans = [markerLoan, ...userLoans];
                }
                let userLoanRequests = allLoanRequestsCache
                    .filter(request => request && request.userId === currentUser.uid && isModernLoanRequest(request))
                    .sort((a, b) => timestampToMillis(b.requestedAt || b.processedAt) - timestampToMillis(a.requestedAt || a.processedAt));
                if (markerRequests.length && !userLoanRequests.some(request => request.id && request.id === markerRequests[0].id)) {
                    userLoanRequests = [...markerRequests, ...userLoanRequests];
                }
                renderLoanState(userLoans, userLoanRequests);

                try {
                    const [freshUserSnap, loanSnap, loanReqSnap, cloudLoanReqResult] = await Promise.allSettled([
                        getDoc(doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid)),
                        getDocs(query(collection(db, `artifacts/${appId}/public/data/loans`), where("userId", "==", currentUser.uid))),
                        getDocs(query(collection(db, `artifacts/${appId}/public/data/loan_requests`), where("userId", "==", currentUser.uid))),
                        loadCloudLoanRequests({ status: 'all', userId: currentUser.uid, limit: 50, timeoutMs: 7000 })
                    ]);
                    if (freshUserSnap.status === 'fulfilled' && freshUserSnap.value.exists()) {
                        currentUserData = { ...currentUserData, ...freshUserSnap.value.data(), id: currentUser.uid, uid: currentUser.uid };
                        writeCache(getUserCacheKey(currentUser.uid), currentUserData);
                    }
                    userLoans = loanSnap.status === 'fulfilled' ? loanSnap.value.docs.map(d => ({ id: d.id, ...d.data() }))
                        .filter(isModernLoanRecord)
                        .sort((a, b) => timestampToMillis(b.createdAt || b.paidAt) - timestampToMillis(a.createdAt || a.paidAt)) : [];
                    const freshMarkerLoan = getActiveLoanFromUserMarker(currentUserData);
                    if (freshMarkerLoan && !userLoans.some(loan => loan.id === freshMarkerLoan.id)) {
                        userLoans = [freshMarkerLoan, ...userLoans];
                    }
                    allLoansCache = [
                        ...allLoansCache.filter(loan => loan && loan.userId !== currentUser.uid),
                        ...userLoans
                    ];
                    const firebaseLoanRequests = loanReqSnap.status === 'fulfilled'
                        ? loanReqSnap.value.docs.map(d => ({ id: d.id, requestId: d.id, ...d.data() }))
                        : [];
                    const cloudLoanRequests = cloudLoanReqResult.status === 'fulfilled' ? cloudLoanReqResult.value : [];
                    userLoanRequests = mergeLoanRequestRecords(firebaseLoanRequests, cloudLoanRequests)
                        .filter(isModernLoanRequest)
                        .sort((a, b) => getLoanRequestRecordTime(b) - getLoanRequestRecordTime(a));
                    const freshMarkerRequest = getUserLoanRequestMarker(currentUserData);
                    if (isModernLoanRequest(freshMarkerRequest) && !userLoanRequests.some(request => request.id && request.id === freshMarkerRequest.id)) {
                        userLoanRequests = [freshMarkerRequest, ...userLoanRequests];
                    }
                    allLoanRequestsCache = [
                        ...allLoanRequestsCache.filter(request => request && request.userId !== currentUser.uid),
                        ...userLoanRequests
                    ].sort((a, b) => timestampToMillis(b.requestedAt || b.processedAt) - timestampToMillis(a.requestedAt || a.processedAt));
                    renderLoanState(userLoans, userLoanRequests);
                } catch (error) {
                    console.warn('Fresh loan state check skipped:', error);
                }
            });
        };

const showLoanApplicationPage = (step = 1) => {
            loanApplicationDraft.step = step;
            const personal = {
                name: currentUserData?.name || '',
                mobile: currentUserData?.mobile || '',
                fatherName: '',
                alternateMobile: '',
                dob: '',
                aadhaar: '',
                ...(loanApplicationDraft.personal || {})
            };
            personal.dob = normalizeLoanDob(personal.dob);
            const docs = loanApplicationDraft.documents || {};
            const inputClass = 'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-base font-semibold text-slate-950 shadow-inner outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40';
            const stepContent = step === 1 ? `
                <div class="space-y-3">
                    <input id="loan-name-input" value="${escapeHtml(personal.name)}" placeholder="Your name" class="${inputClass}">
                    <input id="loan-father-input" value="${escapeHtml(personal.fatherName)}" placeholder="Father's name" class="${inputClass}">
                    <input id="loan-mobile-input" value="${escapeHtml(personal.mobile)}" maxlength="10" inputmode="numeric" placeholder="Mobile no." class="${inputClass}">
                    <input id="loan-alt-mobile-input" value="${escapeHtml(personal.alternateMobile)}" maxlength="10" inputmode="numeric" placeholder="Alternate no." class="${inputClass}">
                    <input id="loan-dob-input" value="${escapeHtml(personal.dob)}" maxlength="10" autocomplete="bday" placeholder="Date of birth (DD/MM/YYYY)" class="${inputClass}">
                    <input id="loan-aadhaar-input" value="${escapeHtml(personal.aadhaar)}" maxlength="12" inputmode="numeric" placeholder="Aadhaar number" class="${inputClass}">
                </div>` : step === 2 ? `
                <div class="space-y-3">
                    <label class="group block rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/70 p-5 text-center shadow-inner transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/10">
                        <input id="loan-aadhaar-file-input" type="file" accept="image/*,.pdf" class="hidden">
                        <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-gray-900">
                            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01.88-7.9A5 5 0 1117 11h1a3 3 0 010 6h-4m-4-4l2-2m0 0l2 2m-2-2v8"></path></svg>
                        </span>
                        <span class="mt-3 block text-sm font-black text-gray-900 dark:text-white">Upload Aadhaar Card</span>
                        <span id="loan-aadhaar-file-label" class="mt-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">${escapeHtml(docs.aadhaarName || 'Tap to select Aadhaar image/PDF')}</span>
                    </label>
                    <label class="group block rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/70 p-5 text-center shadow-inner transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10">
                        <input id="loan-selfie-file-input" type="file" accept="image/*" capture="user" class="hidden">
                        <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm dark:bg-gray-900">
                            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 1116.5 0"></path></svg>
                        </span>
                        <span class="mt-3 block text-sm font-black text-gray-900 dark:text-white">Upload Selfie</span>
                        <span id="loan-selfie-file-label" class="mt-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">${escapeHtml(docs.selfieName || 'Tap to select live selfie')}</span>
                    </label>
                    <p class="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">Admin will verify Aadhaar and selfie match before approving loan limit.</p>
                </div>` : `
                <div class="space-y-4">
                    <div class="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 text-sm shadow-inner dark:border-indigo-900/40 dark:from-indigo-900/20 dark:to-blue-900/10">
                        <div class="flex justify-between gap-3"><span>Name</span><span class="font-bold text-right">${escapeHtml(personal.name || 'N/A')}</span></div>
                        <div class="mt-2 flex justify-between gap-3"><span>Mobile</span><span class="font-bold text-right">${escapeHtml(personal.mobile || 'N/A')}</span></div>
                        <div class="mt-2 flex justify-between gap-3"><span>Documents</span><span class="font-bold text-right">${docs.aadhaarFile && docs.selfieFile ? 'Aadhaar + Selfie ready' : 'Missing'}</span></div>
                    </div>
                    <label class="flex items-center gap-3 rounded-3xl border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900">
                        <input type="checkbox" id="loan-final-terms-checkbox" class="h-5 w-5" ${loanApplicationDraft.acceptedTerms ? 'checked' : ''}>
                        <span>I agree to the <button id="loan-final-agreement-link" type="button" class="text-indigo-600 dark:text-indigo-300 font-black underline">loan agreement and security terms</button>.</span>
                    </label>
                </div>`;

            const content = `
                ${getPageHeader('Take Loan')}
                <div class="max-w-md mx-auto overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-[0_22px_55px_rgba(15,23,42,0.12)] dark:border-gray-700 dark:bg-gray-800">
                    <div class="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-blue-700 to-emerald-600 px-5 pb-7 pt-6 text-white">
                        <div class="absolute -right-8 -top-10 h-28 w-28 rounded-full border border-white/20"></div>
                        <div class="absolute right-8 bottom-3 h-12 w-12 rounded-2xl bg-white/10"></div>
                        <p class="relative text-[10px] font-black uppercase tracking-[0.22em] text-white/65">Loan Request</p>
                        <h3 class="relative mt-1 text-2xl font-black">Verify & Apply</h3>
                        <p class="relative mt-1 text-xs font-semibold text-white/75">Complete all 3 steps for admin approval.</p>
                    </div>
                    <div class="-mt-4 space-y-5 rounded-t-[1.75rem] bg-white p-5 dark:bg-gray-800">
                    ${renderLoanStepCircles(step)}
                    <div class="overflow-hidden">
                        <div class="transition-transform duration-200 ease-out">${stepContent}</div>
                    </div>
                    <div class="flex gap-2">
                        ${step > 1 ? '<button id="loan-back-step-btn" class="flex-1 rounded-2xl bg-gray-100 py-3.5 text-sm font-black text-gray-700 shadow-sm transition hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">Back</button>' : ''}
                        ${step < 3 ? '<button id="loan-next-step-btn" class="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-700 hover:to-blue-700 dark:shadow-none">Next</button>' : '<button id="submit-loan-request-btn" class="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-700 hover:to-emerald-700 dark:shadow-none">Apply Now</button>'}
                    </div>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content);

            document.getElementById('loan-back-step-btn')?.addEventListener('click', () => {
                saveLoanApplicationDraftFromDom(step);
                showLoanApplicationPage(step - 1);
            });
            document.getElementById('loan-next-step-btn')?.addEventListener('click', () => {
                saveLoanApplicationDraftFromDom(step);
                if (validateLoanApplicationStep(step)) showLoanApplicationPage(step + 1);
            });
            document.getElementById('submit-loan-request-btn')?.addEventListener('click', () => {
                saveLoanApplicationDraftFromDom(step);
                if (validateLoanApplicationStep(step)) handleSubmitLoanRequest();
            });
            document.getElementById('loan-final-agreement-link')?.addEventListener('click', showLoanAgreementModal);
            document.getElementById('loan-dob-input')?.addEventListener('blur', (event) => {
                event.target.value = normalizeLoanDob(event.target.value);
            });
            document.getElementById('loan-aadhaar-file-input')?.addEventListener('change', (event) => {
                const file = event.target.files?.[0] || null;
                if (!file) return;
                const error = validateLoanDocumentSelection(file, 'aadhaar');
                if (error) {
                    event.target.value = '';
                    showNotification(error, true);
                    return;
                }
                loanApplicationDraft.documents = { ...(loanApplicationDraft.documents || {}), aadhaarFile: file, aadhaarName: file?.name || '' };
                const label = document.getElementById('loan-aadhaar-file-label');
                if (label) label.textContent = file?.name || 'Tap to select Aadhaar image/PDF';
            });
            document.getElementById('loan-selfie-file-input')?.addEventListener('change', (event) => {
                const file = event.target.files?.[0] || null;
                if (!file) return;
                const error = validateLoanDocumentSelection(file, 'selfie');
                if (error) {
                    event.target.value = '';
                    showNotification(error, true);
                    return;
                }
                loanApplicationDraft.documents = { ...(loanApplicationDraft.documents || {}), selfieFile: file, selfieName: file?.name || '' };
                const label = document.getElementById('loan-selfie-file-label');
                if (label) label.textContent = file?.name || 'Tap to select live selfie';
            });
        };

const showTakeLoanPage = () => {
            if (!hasModernLoanApproval(currentUserData)) {
                loanApplicationDraft = {
                    step: 1,
                    personal: {
                        name: currentUserData?.name || '',
                        mobile: currentUserData?.mobile || '',
                        fatherName: '',
                        alternateMobile: '',
                        dob: '',
                        aadhaar: ''
                    },
                    documents: {},
                    acceptedTerms: false
                };
                showLoanApplicationPage(1);
                return;
            }
            const userLoans = allLoansCache.filter(l => l.userId === currentUser.uid);
            const summary = buildLoanSummary(currentUserData, userLoans);
            if (summary.availableAmount <= 0) {
                showNotification('Your loan limit is exhausted. Please repay your active loan to free up limit.', true);
                showLoanPage();
                return;
            }
            const maxLoanAmount = Math.max(0, summary.availableAmount);
            const content = `
                ${getPageHeader('Take Loan')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-5">
                    <div class="text-center">
                        <h3 class="text-lg font-semibold">Choose Loan Amount</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Amount between 1 and your approved limit. Repayment starts after withdrawal approval.</p>
                    </div>
                    <div class="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500 dark:text-gray-400">Approved Limit</span>
                            <span class="font-black text-indigo-700 dark:text-indigo-200">${formatCurrency(maxLoanAmount)}</span>
                        </div>
                        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">If admin increases this limit later, you can use the higher limit without applying again.</p>
                    </div>
                    <input type="number" id="loan-amount-input" min="1" max="${maxLoanAmount}" placeholder="Enter amount up to ${formatCurrency(maxLoanAmount)}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <div id="loan-summary" class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 space-y-2 text-sm"></div>
                    <label class="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-sm">
                        <input type="checkbox" id="loan-agreement-checkbox" class="h-5 w-5">
                        <span>I agree to the <button id="loan-agreement-link" type="button" class="text-indigo-600 dark:text-indigo-300 font-black underline">loan agreement</button>.</span>
                    </label>
                    <button id="confirm-take-loan-btn" class="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition">Take Loan</button>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            const amountInput = document.getElementById('loan-amount-input');
            if (amountInput) {
                amountInput.max = String(maxLoanAmount);
                amountInput.placeholder = `Enter amount up to ${formatCurrency(maxLoanAmount)}`;
            }
            const loanHelpText = amountInput?.closest('.space-y-5')?.querySelector('.text-center p');
            if (loanHelpText) loanHelpText.textContent = `Amount between 1 and ${formatCurrency(maxLoanAmount)}. Repayment starts after withdrawal approval.`;
            const updateSummary = () => {
                const amount = parseFloat(document.getElementById('loan-amount-input').value) || 0;
                const interest = Number((amount * 0.02).toFixed(2));
                document.getElementById('loan-summary').innerHTML = `
                    <div class="flex justify-between"><span>Loan Amount</span><span>${formatCurrency(amount)}</span></div>
                    <div class="flex justify-between"><span>2% Interest</span><span>${formatCurrency(interest)}</span></div>
                    <div class="flex justify-between font-bold pt-2 border-t border-indigo-200 dark:border-indigo-800"><span>Total Repay</span><span>${formatCurrency(amount + interest)}</span></div>
                    <div class="flex justify-between"><span>Due Date</span><span>After withdrawal approval</span></div>`;
            };
            updateSummary();
            document.getElementById('loan-amount-input').addEventListener('input', updateSummary);
            document.getElementById('loan-agreement-link').onclick = showLoanAgreementModal;
            document.getElementById('confirm-take-loan-btn').onclick = handleTakeLoan;
        };

const showLoanAgreementModal = () => {
            renderModal('Loan Agreement',
                `<div class="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <p><strong>Credit limit:</strong> Admin approves your maximum loan limit. You may choose any amount within that limit when no active loan is open.</p>
                    <p><strong>Repayment:</strong> Loan repayment starts when admin approves/processes your withdrawal payout. The due date will be the same date next month; if that date does not exist, the nearest last date is used.</p>
                    <p><strong>Security reserve:</strong> Loan money credited to your wallet remains usable. After the repayment due date, available wallet funds may be reserved or auto-debited for the active loan repayment.</p>
                    <p><strong>Missed due date:</strong> If repayment is due and wallet balance is insufficient, the account can be blocked until admin reviews and unlocks it.</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg">I Understand</button>`,
                'max-w-md');
        };

const showActiveLoanPage = (loan) => {
            const dueDate = toDate(loan.dueDate);
            const dueDateText = dueDate ? dueDate.toLocaleDateString('en-IN') : 'After withdrawal approval';
            showPage(`
                ${getPageHeader('Loan Repayment')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
                    <h3 class="text-lg font-semibold">Active Loan</h3>
                    <div class="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 space-y-2 text-sm">
                        <div class="flex justify-between"><span>Loan Amount</span><span>${formatCurrency(loan.amount)}</span></div>
                        <div class="flex justify-between"><span>Interest</span><span>${formatCurrency(loan.interest)}</span></div>
                        <div class="flex justify-between font-bold"><span>Total Payable</span><span>${formatCurrency(loan.totalRepayable)}</span></div>
                        <div class="flex justify-between"><span>Reserved Wallet Fund</span><span>${formatCurrency(getLoanReservedAmount(currentUserData))}</span></div>
                        <div class="flex justify-between"><span>Available Balance</span><span>${formatCurrency(getSpendableWalletBalance(currentUserData))}</span></div>
                        <div class="flex justify-between gap-3"><span>Due Date</span><span class="text-right">${escapeHtml(dueDateText)}</span></div>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${dueDate ? 'Repayment option: pay all amount on the due date.' : 'Your repayment date will start after admin processes your withdrawal payout.'}</p>
                    <button id="repay-loan-btn" class="w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 transition">Repay Full Loan</button>
                </div>
                ${getPageFooter()}`);
            document.getElementById('repay-loan-btn').onclick = () => handleRepayLoan(loan);
        };

const showUserLoanDetailModal = async (loanId) => {
            let loan = allLoansCache.find(item => item.id === loanId) || getUserLoanRecords(currentUser?.uid || '').find(item => item.id === loanId);
            if (!loan && loanId) {
                try {
                    const loanSnap = await getDoc(doc(db, `artifacts/${appId}/public/data/loans`, loanId));
                    if (loanSnap.exists()) {
                        loan = { id: loanSnap.id, ...loanSnap.data() };
                        if (loan.userId === currentUser?.uid && isModernLoanRecord(loan)) {
                            allLoansCache = [
                                ...allLoansCache.filter(item => item.id !== loan.id),
                                loan
                            ].sort((a, b) => timestampToMillis(b.createdAt || b.paidAt) - timestampToMillis(a.createdAt || a.paidAt));
                        }
                    }
                } catch (error) {
                    console.error('Loan detail lookup failed:', error);
                }
            }
            if (!loan || loan.userId !== currentUser?.uid) return showNotification('Loan details not found. Please refresh.', true);
            const dueDate = toDate(loan.dueDate);
            const createdAt = toDate(loan.createdAt);
            const paidAt = toDate(loan.paidAt);
            renderModal('Loan Details',
                `<div class="space-y-3 text-sm">
                    <div class="rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-4">
                        <div class="flex justify-between"><span>Loan Amount</span><span class="font-black">${formatCurrency(loan.amount || 0)}</span></div>
                        <div class="mt-2 flex justify-between"><span>Interest</span><span class="font-black">${formatCurrency(loan.interest || 0)}</span></div>
                        <div class="mt-2 flex justify-between text-base"><span>Total Repay</span><span class="font-black">${formatCurrency(loan.totalRepayable || 0)}</span></div>
                    </div>
                    <div class="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                        <div class="flex justify-between gap-3"><span>Status</span><span class="font-bold text-right">${escapeHtml(loan.status || 'active')}</span></div>
                        <div class="flex justify-between gap-3"><span>Credit Limit</span><span class="font-bold text-right">${formatCurrency(loan.creditLimitAtBorrow || getLoanLimitAmount(currentUserData))}</span></div>
                        <div class="flex justify-between gap-3"><span>Created</span><span class="font-bold text-right">${createdAt ? createdAt.toLocaleDateString('en-IN') : 'N/A'}</span></div>
                        <div class="flex justify-between gap-3"><span>Due Date</span><span class="font-bold text-right">${escapeHtml(getLoanDueDateText(loan))}</span></div>
                        ${paidAt ? `<div class="flex justify-between gap-3"><span>Paid At</span><span class="font-bold text-right">${paidAt.toLocaleDateString('en-IN')}</span></div>` : ''}
                    </div>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg">Close</button>`,
                'max-w-md');
        };

const showLoanDocumentPreviewModal = (requestId, docType) => {
            const request = allLoanRequestsCache.find(item => item.id === requestId);
            const documentInfo = request?.documents?.[docType];
            const url = String(documentInfo?.url || '').trim();
            if (!url) return showNotification('Document not found.', true);

            const label = docType === 'selfie' ? 'Selfie' : 'Aadhaar';
            const source = escapeHtml(url);
            const filename = String(documentInfo?.name || url || '').toLowerCase();
            const fileType = String(documentInfo?.type || documentInfo?.contentType || '').toLowerCase();
            const isPdf = fileType.includes('pdf') || /\.pdf(?:[?#].*)?$/i.test(filename);
            const isImage = fileType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|heif)(?:[?#].*)?$/i.test(filename) || !isPdf;
            const preview = isPdf
                ? `<iframe src="${source}" title="${label} document" class="h-[70vh] w-full rounded-2xl border border-gray-200 bg-white dark:border-gray-700"></iframe>`
                : `<div class="max-h-[72vh] overflow-auto rounded-2xl bg-gray-100 dark:bg-gray-900 p-2">
                        <img src="${source}" alt="${label} document" class="mx-auto max-h-[68vh] w-auto max-w-full rounded-xl object-contain">
                   </div>`;

            renderModal(`${label} Document`,
                `<div class="space-y-3">
                    <div class="rounded-2xl bg-indigo-50 px-4 py-3 text-sm dark:bg-indigo-900/20">
                        <p class="font-black text-gray-900 dark:text-white">${escapeHtml(request?.name || 'Loan Applicant')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(request?.mobile || request?.userEmail || '')}</p>
                    </div>
                    ${preview}
                </div>`,
                `<a href="${source}" target="_blank" rel="noopener" class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-black text-gray-700 dark:bg-gray-700 dark:text-gray-100">Open Link</a>
                 <button onclick="window.closeModal()" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black text-white">Close</button>`,
                'max-w-4xl');
        };

const isValidLoanDob = (dob) => {
            const normalizedDob = normalizeLoanDob(dob);
            const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalizedDob);
            if (!match) return false;

            const day = Number(match[1]);
            const month = Number(match[2]);
            const year = Number(match[3]);
            const date = new Date(year, month - 1, day);

            return year >= 1900 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
        };

const getLoanDocumentFileKind = (file) => {
            const type = String(file?.type || '').toLowerCase();
            const name = String(file?.name || '').toLowerCase();
            const isImage = type.startsWith('image/') || /\.(png|jpe?g|webp|heic|heif)$/i.test(name);
            const isPdf = type === 'application/pdf' || /\.pdf$/i.test(name);
            return { isImage, isPdf };
        };

const validateLoanDocumentSelection = (file, documentType) => {
            const label = documentType === 'selfie' ? 'Selfie photo' : 'Aadhaar document';
            if (!file) return `${label} is required.`;
            const { isImage, isPdf } = getLoanDocumentFileKind(file);
            if (Number(file.size || 0) > LOAN_DOCUMENT_MAX_SIZE_BYTES && !isImage) {
                return `${label} is too large. Please upload a file under 8 MB.`;
            }
            if (documentType === 'selfie' && !isImage) {
                return 'Selfie photo must be an image file.';
            }
            if (documentType === 'aadhaar' && !isImage && !isPdf) {
                return 'Aadhaar document must be an image or PDF file.';
            }
            return '';
        };

const compressLoanImageFile = async (file, documentType) => {
            const { isImage } = getLoanDocumentFileKind(file);
            const type = String(file?.type || '').toLowerCase();
            const name = String(file?.name || '').toLowerCase();
            const canDrawImage = /image\/(jpeg|jpg|png|webp)/i.test(type) || /\.(png|jpe?g|webp)$/i.test(name);
            if (!isImage || !canDrawImage || Number(file.size || 0) <= 700 * 1024) {
                return file;
            }
            return new Promise((resolve) => {
                const image = new Image();
                const objectUrl = URL.createObjectURL(file);
                image.onload = () => {
                    try {
                        const maxSide = documentType === 'selfie' ? 1080 : 1400;
                        const ratio = Math.min(1, maxSide / Math.max(image.width || maxSide, image.height || maxSide));
                        const width = Math.max(1, Math.round((image.width || maxSide) * ratio));
                        const height = Math.max(1, Math.round((image.height || maxSide) * ratio));
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(image, 0, 0, width, height);
                        canvas.toBlob((blob) => {
                            URL.revokeObjectURL(objectUrl);
                            if (!blob || blob.size >= file.size) return resolve(file);
                            const baseName = String(file.name || `${documentType}.jpg`).replace(/\.[^.]+$/, '');
                            resolve(new File([blob], `${baseName}-compressed.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
                        }, 'image/jpeg', 0.76);
                    } catch (error) {
                        URL.revokeObjectURL(objectUrl);
                        console.warn('Loan image compression skipped:', error);
                        resolve(file);
                    }
                };
                image.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(file);
                };
                image.src = objectUrl;
            });
        };

const getLoanUploadErrorMessage = (error, label) => {
            const code = String(error?.code || '');
            if (code.includes('unauthorized')) return `${label} upload is blocked by storage permission. Please contact admin.`;
            if (code.includes('quota-exceeded')) return `${label} upload failed because storage quota is full. Please contact admin.`;
            if (code.includes('retry-limit-exceeded')) return `${label} upload failed because network is unstable. Please try again.`;
            if (code.includes('canceled')) return `${label} upload was cancelled. Please try again.`;
            return String(error?.message || `${label} upload failed. Please try again.`);
        };

const uploadLoanDocumentToCloudflare = (file, originalFile, documentType, label, onProgress = () => {}) => new Promise(async (resolve, reject) => {
            try {
                const token = await getBackendAuthToken();
                const params = new URLSearchParams({
                    documentType,
                    fileName: file.name || originalFile?.name || `${documentType}.jpg`,
                    contentType: file.type || originalFile?.type || 'application/octet-stream',
                    size: String(file.size || originalFile?.size || 0)
                });
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${BACKEND_BASE_URL}/api/uploads/loan-document?${params.toString()}`, true);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.setRequestHeader('Content-Type', file.type || originalFile?.type || 'application/octet-stream');
                xhr.timeout = LOAN_DOCUMENT_UPLOAD_TIMEOUT_MS;
                xhr.upload.onprogress = (event) => {
                    if (!event.lengthComputable) return;
                    onProgress(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))));
                };
                xhr.onload = () => {
                    const payload = (() => {
                        try {
                            return JSON.parse(xhr.responseText || '{}');
                        } catch {
                            return {};
                        }
                    })();
                    if (xhr.status >= 200 && xhr.status < 300 && payload?.ok && payload?.document?.url) {
                        onProgress(100);
                        resolve({
                            name: originalFile?.name || payload.document.name || file.name || `${documentType}.jpg`,
                            size: payload.document.size || file.size || originalFile?.size || 0,
                            type: payload.document.type || file.type || originalFile?.type || '',
                            path: payload.document.path || payload.document.key || '',
                            key: payload.document.key || payload.document.path || '',
                            url: payload.document.url,
                            storage: payload.document.storage || 'cloudflare-r2',
                            uploadedAt: payload.document.uploadedAt || Date.now()
                        });
                        return;
                    }
                    const errorCode = payload?.error || xhr.statusText || 'CLOUDFLARE_UPLOAD_FAILED';
                    const error = new Error(`${label} Cloudflare upload failed: ${errorCode}`);
                    error.code = errorCode;
                    error.canUseFirebaseFallback = xhr.status >= 500 || xhr.status === 401 || xhr.status === 403 || [
                        'R2_NOT_CONFIGURED',
                        'R2_PUBLIC_URL_NOT_CONFIGURED',
                        'LOAN_DOCUMENT_UPLOAD_FAILED',
                        'BACKEND_TEMPORARILY_UNAVAILABLE'
                    ].includes(errorCode);
                    reject(error);
                };
                xhr.onerror = () => {
                    const error = new Error(`${label} Cloudflare upload failed because backend was unreachable.`);
                    error.canUseFirebaseFallback = true;
                    reject(error);
                };
                xhr.ontimeout = () => {
                    const error = new Error(`${label} Cloudflare upload is taking too long.`);
                    error.canUseFirebaseFallback = true;
                    reject(error);
                };
                onProgress(1);
                xhr.send(file);
            } catch (error) {
                const uploadError = error instanceof Error ? error : new Error(String(error || `${label} Cloudflare upload failed.`));
                uploadError.canUseFirebaseFallback = true;
                reject(uploadError);
            }
        });

const uploadLoanDocumentToFirebase = async (file, originalFile, documentType, label, onProgress = () => {}) => {
            const safeName = String(file.name || `${documentType}.jpg`).replace(/[^\w.-]+/g, '_').slice(-80);
            const path = `artifacts/${appId}/loan_documents/${currentUser.uid}/${Date.now()}-${documentType}-${safeName}`;
            const ref = storageRef(storage, path);
            onProgress(1);
            await withTimeout(
                uploadFileWithProgress(ref, file, {
                    contentType: file.type || 'application/octet-stream',
                    customMetadata: {
                        userId: currentUser.uid,
                        documentType
                    }
                }, label, onProgress),
                LOAN_DOCUMENT_UPLOAD_TIMEOUT_MS,
                `${label} upload is taking too long. Please check internet or use a smaller file.`
            );
            const url = await withTimeout(
                getDownloadURL(ref),
                10000,
                `${label} uploaded but link was not ready. Please try again.`
            );
            return {
                name: originalFile?.name || safeName,
                size: file.size || originalFile?.size || 0,
                type: file.type || originalFile?.type || '',
                path,
                url,
                storage: 'firebase-storage',
                uploadedAt: Date.now()
            };
        };

const uploadLoanDocumentFile = async (file, documentType, onProgress = () => {}) => {
            if (!file) return null;
            const validationError = validateLoanDocumentSelection(file, documentType);
            if (validationError) throw new Error(validationError);
            const label = documentType === 'selfie' ? 'Selfie photo' : 'Aadhaar document';
            const preparedFile = await withTimeout(
                compressLoanImageFile(file, documentType),
                10000,
                `${label} could not be prepared. Please try a smaller file.`
            );
            if (Number(preparedFile.size || 0) > LOAN_DOCUMENT_MAX_SIZE_BYTES) {
                throw new Error(`${label} is too large. Please upload a file under 8 MB.`);
            }
            try {
                return await uploadLoanDocumentToCloudflare(preparedFile, file, documentType, label, onProgress);
            } catch (cloudflareError) {
                console.warn('Cloudflare loan document upload failed, using Firebase Storage fallback:', cloudflareError);
                if (cloudflareError?.canUseFirebaseFallback === false) {
                    throw new Error(getLoanUploadErrorMessage(cloudflareError, label));
                }
                return uploadLoanDocumentToFirebase(preparedFile, file, documentType, label, onProgress);
            }
        };

const handleSubmitLoanRequest = async () => {
            const btn = document.getElementById('submit-loan-request-btn');
            const { name, fatherName, mobile, alternateMobile, dob, aadhaar } = loanApplicationDraft.personal || {};
            const documents = loanApplicationDraft.documents || {};

            if (!name || !fatherName || !/^\d{10}$/.test(mobile) || !/^\d{10}$/.test(alternateMobile) || !isValidLoanDob(dob) || !/^\d{12}$/.test(aadhaar)) {
                return showNotification('Please fill all loan details correctly.', true);
            }
            const documentError = validateLoanDocumentSelection(documents.aadhaarFile, 'aadhaar') || validateLoanDocumentSelection(documents.selfieFile, 'selfie');
            if (documentError) {
                return showNotification(documentError, true);
            }

            try {
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Checking...';
                }
                const [existingRequestResult, existingCloudResult] = await Promise.allSettled([
                    withTimeout(
                        getDocs(query(
                            collection(db, `artifacts/${appId}/public/data/loan_requests`),
                            where("userId", "==", currentUser.uid)
                        )),
                        15000,
                        'Could not check your loan request status. Please try again.'
                    ),
                    loadCloudLoanRequests({ status: 'all', userId: currentUser.uid, limit: 50, timeoutMs: 7000 })
                ]);
                if (existingRequestResult.status === 'rejected' && existingCloudResult.status === 'rejected') {
                    throw existingRequestResult.reason || existingCloudResult.reason;
                }
                const firebaseExistingRequests = existingRequestResult.status === 'fulfilled'
                    ? existingRequestResult.value.docs.map(d => ({ id: d.id, requestId: d.id, ...d.data() }))
                    : [];
                const cloudExistingRequests = existingCloudResult.status === 'fulfilled' ? existingCloudResult.value : [];
                const existingModernRequests = mergeLoanRequestRecords(firebaseExistingRequests, cloudExistingRequests)
                    .filter(isModernLoanRequest)
                    .sort((a, b) => getLoanRequestRecordTime(b) - getLoanRequestRecordTime(a));
                const pendingModernRequest = existingModernRequests.find(isPendingModernLoanRequest);
                const userLoanMarker = getUserLoanRequestMarker(currentUserData);
                if (pendingModernRequest || isPendingModernLoanRequest(userLoanMarker)) {
                    showLoanPendingPage();
                    return;
                }
                const latestModernRequest = getLatestModernLoanRequest(currentUser.uid, existingModernRequests);
                const reapplyBlock = getLoanReapplyBlock(latestModernRequest) || getLoanReapplyBlock(userLoanMarker);
                if (reapplyBlock) {
                    showLoanRejectedCooldownPage(latestModernRequest || userLoanMarker);
                    return;
                }
                if (btn) btn.textContent = 'Preparing...';
                const aadhaarDocument = await uploadLoanDocumentFile(documents.aadhaarFile, 'aadhaar', (percent) => {
                    if (btn) btn.textContent = `Aadhaar ${percent}%`;
                });
                const selfieDocument = await uploadLoanDocumentFile(documents.selfieFile, 'selfie', (percent) => {
                    if (btn) btn.textContent = `Selfie ${percent}%`;
                });
                if (btn) btn.textContent = 'Submitting...';
                const loanRequestRef = doc(collection(db, `artifacts/${appId}/public/data/loan_requests`));
                const requestedAt = Date.now();
                const loanRequestPayload = {
                    id: loanRequestRef.id,
                    requestId: loanRequestRef.id,
                    requestVersion: LOAN_APPLICATION_VERSION,
                    loanApplicationVersion: LOAN_APPLICATION_VERSION,
                    userId: currentUser.uid,
                    userEmail: currentUserData.email || currentUser.email || '',
                    name,
                    fatherName,
                    mobile,
                    alternateMobile,
                    dob,
                    aadhaar,
                    personalDetails: { name, fatherName, mobile, alternateMobile, dob, aadhaar },
                    documents: {
                        aadhaar: aadhaarDocument,
                        selfie: selfieDocument,
                        aadhaarSelfieMatchStatus: 'pending_admin_review'
                    },
                    loanDocumentsSubmitted: true,
                    status: 'pending',
                    requestedAt
                };
                await withTimeout(setDoc(loanRequestRef, {
                    ...loanRequestPayload,
                    requestedAt: serverTimestamp()
                }), 15000, 'Could not save loan request. Please try again.');
                upsertCloudLoanRequest(loanRequestPayload).catch(error => console.warn('Cloud loan request background save skipped:', error));
                await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid), {
                    latestLoanRequestVersion: LOAN_APPLICATION_VERSION,
                    loanRequestStatus: 'pending',
                    loanRequestedAt: serverTimestamp(),
                    loanDocumentsSubmitted: true
                }).catch(error => console.warn('Loan request user marker skipped:', error));
                allLoanRequestsCache = mergeLoanRequestRecords(allLoanRequestsCache, [loanRequestPayload]);

                if (typeof sendNotification === 'function') {
                    const targetAdmin = currentUserData?.parentAdmin || currentUserData?.parent_admin || ADMIN_UID;
                    sendNotification(
                        targetAdmin,
                        'New Loan Request',
                        `User ${name || 'User'} (${mobile || ''}) submitted a loan request for review.`
                    ).catch(e => console.warn('Loan push notification error:', e));
                }

                renderModal('Loan Request Submitted',
                    `<div class="text-center space-y-3">
                        <div class="w-14 h-14 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 mx-auto flex items-center justify-center">
                            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"></path></svg>
                        </div>
                        <h3 class="font-semibold">Loan Request Pending</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Your account details and documents have been sent to admin. You will continue after approval.</p>
                    </div>`,
                    `<button onclick="window.closeModal(); hidePage();" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg">OK</button>`,
                    'max-w-sm', true
                );
            } catch (e) {
                console.error('Loan request failed:', e);
                const message = String(e?.message || '').trim();
                showNotification(message || 'Could not submit loan request. Please try again.', true);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Apply Now';
                }
            }
        };

const handleTakeLoan = async () => {
            if (!currentUser || !currentUserData) return showNotification('User data not loaded. Please wait and try again.', true);
            const takeLoanBtn = document.getElementById('confirm-take-loan-btn');
            if (takeLoanBtn?.disabled) return;
            const amount = parseFloat(document.getElementById('loan-amount-input').value);
            const userLoans = allLoansCache.filter(l => l.userId === currentUser.uid);
            const summary = buildLoanSummary(currentUserData, userLoans);
            const maxLoanAmount = Math.max(0, summary.availableAmount);
            if (isNaN(amount) || amount < 1 || amount > maxLoanAmount) {
                return showNotification(`Loan amount must be between ₹1 and ${formatCurrency(maxLoanAmount)}.`, true);
            }
            if (!document.getElementById('loan-agreement-checkbox')?.checked) {
                return showNotification('Please accept the loan agreement and security terms.', true);
            }
            const interest = Number((amount * 0.02).toFixed(2));
            const totalRepayable = Number((amount + interest).toFixed(2));

            try {
                if (takeLoanBtn) {
                    takeLoanBtn.disabled = true;
                    takeLoanBtn.textContent = 'Processing...';
                }
                const hasDocumentedApprovalFlag = getLoanLimitAmount(currentUserData) > 0 || currentUserData.loanDocumentsVerified === true || currentUserData.loanDocumentsApproved === true;
                const documentedApprovalSnap = hasDocumentedApprovalFlag ? null : await withTimeout(
                    getDocs(query(
                        collection(db, `artifacts/${appId}/public/data/loan_requests`),
                        where("userId", "==", currentUser.uid)
                    )),
                    12000,
                    'Could not verify your updated loan documents. Please try again.'
                );
                const hasDocumentedApprovalRequest = documentedApprovalSnap
                    ? documentedApprovalSnap.docs.map(docItem => ({ id: docItem.id, ...docItem.data() })).some(isApprovedModernLoanRequest)
                    : true;
                if (!hasDocumentedApprovalRequest) {
                    throw new Error('Please submit Aadhaar and selfie details again, then wait for admin approval.');
                }
                const activeLoanSnap = await getDocs(query(
                    collection(db, `artifacts/${appId}/public/data/loans`),
                    where("userId", "==", currentUser.uid),
                    where("status", "==", "active")
                ));
                const activeLoans = activeLoanSnap.docs.map(docItem => ({ id: docItem.id, ...docItem.data() }));
                const activeModernLoan = activeLoans.find(isModernLoanRecord);
                if (activeModernLoan) {
                    const activeLoan = activeModernLoan;
                    showActiveLoanPage(activeLoan);
                    throw new Error('You already have an active loan. Repay it before taking another loan.');
                }
                const usedAmount = activeLoans.filter(isModernLoanRecord).reduce((sum, loan) => sum + getLoanPrincipal(loan), 0);
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                await runTransaction(db, async (tx) => {
                    const userDoc = await tx.get(userRef);
                    if (!userDoc.exists()) throw new Error('User not found.');
                    const userData = userDoc.data();
                    const existingActiveLoanId = String(userData.activeLoanId || '').trim();
                    const existingRepayable = Number(userData.activeLoanRepayable || userData.loanLockedAmount || 0);
                    const hasModernActiveLoanMarker = Number(userData.activeLoanVersion || 0) >= LOAN_APPLICATION_VERSION;
                    if ((existingActiveLoanId || existingRepayable > 0) && hasModernActiveLoanMarker) {
                        throw new Error('You already have an active loan. Repay it before taking another loan.');
                    }
                    if (!hasModernLoanApproval(userData)) throw new Error('Please submit updated loan details and wait for admin approval.');
                    if (!userData.loanEligible && getLoanLimitAmount(userData) <= 0) throw new Error('Loan is not approved for your account.');
                    const approvedMaxLoan = Math.max(0, getLoanLimitAmount(userData));
                    const availableLimit = Math.max(0, approvedMaxLoan - usedAmount);
                    if (availableLimit < 1) throw new Error('Your available loan limit is exhausted.');
                    if (amount > availableLimit) throw new Error(`Loan amount cannot exceed your available limit of ${formatCurrency(availableLimit)}.`);

                    const loanRef = doc(collection(db, `artifacts/${appId}/public/data/loans`));
                    tx.update(userRef, {
                        balance: (userData.balance || 0) + amount,
                        loanEligible: true,
                        activeLoanId: loanRef.id,
                        activeLoanVersion: LOAN_APPLICATION_VERSION,
                        activeLoanAmount: amount,
                        activeLoanInterest: interest,
                        activeLoanRepayable: totalRepayable,
                        activeLoanDueDate: null,
                        activeLoanCreatedAt: serverTimestamp(),
                        activeLoanRepaymentStartedAt: null,
                        activeLoanRepaymentBasis: 'withdrawal_processed_pending',
                        loanLockedAmount: 0,
                        loanReserveStartsAt: null
                    });
                    tx.set(loanRef, {
                        loanApplicationVersion: LOAN_APPLICATION_VERSION,
                        loanRequestVersion: LOAN_APPLICATION_VERSION,
                        userId: currentUser.uid,
                        userName: currentUserData.name || 'User',
                        userMobile: currentUserData.mobile || '',
                        amount,
                        interest,
                        totalRepayable,
                        lockedAmount: 0,
                        reserveStartsAt: null,
                        creditLimitAtBorrow: approvedMaxLoan,
                        dueDate: null,
                        repaymentStartedAt: null,
                        repaymentBasis: 'withdrawal_processed_pending',
                        repaymentStatus: 'waiting_withdrawal_processing',
                        status: 'active',
                        createdAt: serverTimestamp()
                    });
                    tx.set(doc(collection(userRef, 'transactions')), {
                        type: 'credit',
                        amount,
                        comment: 'Loan Amount Credited',
                        timestamp: serverTimestamp(),
                        transactionId: loanRef.id,
                        status: 'completed',
                        isAdminTransaction: true,
                        senderName: 'Reviews World',
                        recipientName: currentUserData.name || 'User',
                        recipientMobile: currentUserData.mobile || ''
                    });
                });
                syncRecentTransactionsToCloud(currentUser.uid).catch(error => console.warn('Take loan background transaction sync failed:', error));
                showNotification('Loan amount added to wallet.');
                if (typeof window.notifyWalletBalanceChange === 'function') {
                    window.notifyWalletBalanceChange(currentUser.uid, 'credit', amount, 'Loan Disbursed');
                }
                hidePage();
            } catch (e) {
                console.error('Take loan failed:', e);
                const message = /permission|insufficient/i.test(e.message || '')
                    ? 'Loan credit could not be completed for this account. Please contact admin to refresh your loan approval.'
                    : (e.message || 'Could not take loan. Please try again.');
                showNotification(message, true);
                if (takeLoanBtn) {
                    takeLoanBtn.disabled = false;
                    takeLoanBtn.textContent = 'Take Loan';
                }
            }
        };

const handleRepayLoan = async (loan) => {
            if ((currentUserData.balance || 0) < (loan.totalRepayable || 0)) {
                return showNotification('Insufficient balance to repay full loan.', true);
            }
            try {
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                const loanRef = doc(db, `artifacts/${appId}/public/data/loans`, loan.id);
                await runTransaction(db, async (tx) => {
                    const userDoc = await tx.get(userRef);
                    const loanDoc = await tx.get(loanRef);
                    if (!loanDoc.exists() || loanDoc.data().status !== 'active') throw new Error('Loan is already closed.');
                    tx.update(userRef, {
                        balance: (userDoc.data().balance || 0) - loan.totalRepayable,
                        activeLoanId: deleteField(),
                        activeLoanVersion: deleteField(),
                        activeLoanAmount: deleteField(),
                        activeLoanInterest: deleteField(),
                        activeLoanRepayable: deleteField(),
                        activeLoanDueDate: deleteField(),
                        activeLoanCreatedAt: deleteField(),
                        activeLoanRepaymentStartedAt: deleteField(),
                        activeLoanRepaymentBasis: deleteField(),
                        loanLockedAmount: deleteField(),
                        loanReserveStartsAt: deleteField()
                    });
                    tx.update(loanRef, {
                        status: 'paid',
                        paidAt: serverTimestamp()
                    });
                    tx.set(doc(collection(userRef, 'transactions')), {
                        type: 'debit',
                        amount: loan.totalRepayable,
                        comment: 'Loan Repayment',
                        timestamp: serverTimestamp(),
                        transactionId: `REPAY-${loan.id}`,
                        status: 'completed',
                        recipientName: 'Reviews World',
                        recipientMobile: ''
                    });
                });
                syncRecentTransactionsToCloud(currentUser.uid).catch(error => console.warn('Repay loan background transaction sync failed:', error));
                showNotification('Loan repaid successfully.');
                if (typeof window.notifyWalletBalanceChange === 'function') {
                    window.notifyWalletBalanceChange(currentUser.uid, 'debit', loan.totalRepayable, 'Loan Repayment');
                }
                hidePage();
            } catch (e) {
                console.error('Repay loan failed:', e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

const processDueLoansForUser = async (userId) => {
            const snap = await getDocs(query(
                collection(db, `artifacts/${appId}/public/data/loans`),
                where("userId", "==", userId),
                where("status", "==", "active")
            ));
            for (const d of snap.docs) {
                const loan = { id: d.id, ...d.data() };
                if (!isModernLoanRecord(loan)) continue;
                if (toDate(loan.dueDate) && toDate(loan.dueDate) <= new Date()) {
                    try {
                        await processDueLoanRepayment(loan.id);
                    } catch (e) {
                        console.error('Due loan auto debit skipped:', e);
                    }
                }
            }
        };

const processDueLoanRepayment = async (loanId) => {
            const loanRef = doc(db, `artifacts/${appId}/public/data/loans`, loanId);
            let accountLockedForInsufficientBalance = false;
            await runTransaction(db, async (tx) => {
                const loanDoc = await tx.get(loanRef);
                if (!loanDoc.exists()) throw new Error('Loan not found.');
                const loan = loanDoc.data();
                if (!isModernLoanRecord(loan)) throw new Error('Legacy loan record is not processed by the new loan system.');
                if (loan.status !== 'active') throw new Error('Loan is already closed.');
                const dueDate = toDate(loan.dueDate);
                if (!dueDate || dueDate > new Date()) throw new Error('Loan due date is not completed yet.');

                const userRef = doc(db, `artifacts/${appId}/public/data/users`, loan.userId);
                const userDoc = await tx.get(userRef);
                if (!userDoc.exists()) throw new Error('User not found.');
                const balance = userDoc.data().balance || 0;
                if (balance < (loan.totalRepayable || 0)) {
                    accountLockedForInsufficientBalance = true;
                    const reason = `You have not paid due loan amount of ${formatCurrency(loan.totalRepayable || 0)}. Please contact admin to unlock your account.`;
                    tx.update(userRef, {
                        isFlagged: true,
                        isDisabled: true,
                        dueLoanBlocked: true,
                        dueLoanId: loanId,
                        dueLoanReason: reason,
                        banReason: reason,
                        banExpiry: null,
                        disabledAt: serverTimestamp(),
                        disabledBy: 'loan-auto-debit'
                    });
                    tx.update(loanRef, {
                        overdueAt: serverTimestamp(),
                        overdueReason: 'Insufficient wallet balance for automatic loan debit.'
                    });
                    return;
                }

                tx.update(userRef, {
                    balance: balance - (loan.totalRepayable || 0),
                    activeLoanId: deleteField(),
                    activeLoanVersion: deleteField(),
                    activeLoanAmount: deleteField(),
                    activeLoanInterest: deleteField(),
                    activeLoanRepayable: deleteField(),
                    activeLoanDueDate: deleteField(),
                    activeLoanCreatedAt: deleteField(),
                    activeLoanRepaymentStartedAt: deleteField(),
                    activeLoanRepaymentBasis: deleteField(),
                    loanLockedAmount: deleteField(),
                    loanReserveStartsAt: deleteField()
                });
                tx.update(loanRef, {
                    status: 'paid',
                    paidAt: serverTimestamp(),
                    autoDebited: true
                });
                tx.set(doc(collection(userRef, 'transactions')), {
                    type: 'debit',
                    amount: loan.totalRepayable || 0,
                    comment: 'Loan Auto Debit',
                    timestamp: serverTimestamp(),
                    transactionId: `AUTO-REPAY-${loanId}`,
                    status: 'completed',
                    recipientName: 'Reviews World',
                    recipientMobile: ''
                });
            });
            if (accountLockedForInsufficientBalance) {
                throw new Error('User has insufficient balance for automatic loan debit. Account locked.');
            }
            if (typeof window.notifyWalletBalanceChange === 'function') {
                window.notifyWalletBalanceChange(loan.userId, 'debit', loan.totalRepayable || 0, 'Loan Auto Debit');
            }
        };

const showLoanActionConfirmModal = ({ title, message, confirmLabel = 'OK', confirmClass = 'bg-indigo-600', onConfirm }) => {
            renderModal(title,
                `<div class="space-y-3 text-sm">
                    <div class="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200">
                        <p class="font-black">Please confirm before continuing.</p>
                        <p class="mt-1">${message}</p>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Click OK only if this action is correct.</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-loan-action-btn" class="px-4 py-2 text-sm ${confirmClass} text-white rounded-lg">${confirmLabel}</button>`,
                'max-w-md');
            document.getElementById('confirm-loan-action-btn').onclick = async () => {
                const btn = document.getElementById('confirm-loan-action-btn');
                btn.disabled = true;
                btn.textContent = 'Working...';
                window.closeModal();
                await onConfirm?.();
            };
        };

const showApproveLoanRequestModal = (userId, requestId) => {
            const request = allLoanRequestsCache.find(item => item.id === requestId) || {};
            const requestStatus = getLoanRequestStatus(request);
            renderModal('Approve Loan Request',
                `<div class="space-y-4">
                    <div class="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-3 text-sm">
                        <p class="font-bold text-gray-900 dark:text-white">${escapeHtml(request.name || 'User')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(request.mobile || request.userEmail || '')}</p>
                        ${requestStatus === 'rejected' ? '<p class="mt-2 inline-flex rounded-full bg-red-100 px-2 py-1 text-[10px] font-black uppercase text-red-600">Rejected request</p>' : ''}
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Maximum loan amount for this user</label>
                        <input type="number" id="approve-loan-max-input" min="1" step="1" placeholder="Enter maximum amount" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">User can take loan only up to this approved amount.</p>
                    </div>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-approve-loan-btn" class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg">Approve</button>`,
                'max-w-md');
            document.getElementById('confirm-approve-loan-btn').onclick = () => {
                const maxLoanAmount = parseFloat(document.getElementById('approve-loan-max-input')?.value || '0');
                if (!Number.isFinite(maxLoanAmount) || maxLoanAmount < 1) {
                    return showNotification('Please enter a valid maximum loan amount.', true);
                }
                window.closeModal();
                showLoanActionConfirmModal({
                    title: 'Confirm Loan Approval',
                    message: `Approve ${escapeHtml(request.name || 'this user')} and set loan limit to ${formatCurrency(maxLoanAmount)}?`,
                    confirmLabel: 'OK, Approve',
                    confirmClass: 'bg-green-600',
                    onConfirm: () => handleLoanRequestAction(userId, requestId, 'approved', maxLoanAmount)
                });
            };
        };

const showRejectLoanRequestConfirmModal = (userId, requestId) => {
            const request = allLoanRequestsCache.find(item => item.id === requestId) || {};
            renderModal('Reject Loan Request',
                `<div class="space-y-4 text-sm">
                    <div class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-3">
                        <p class="font-black text-gray-900 dark:text-white">${escapeHtml(request.name || 'User')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(request.mobile || request.userEmail || '')}</p>
                        <p class="mt-2 font-semibold text-red-600 dark:text-red-300">Are you sure you want to reject this loan request?</p>
                    </div>
                    <textarea id="loan-rejection-reason-input" placeholder="Reason shown to user (optional)" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" rows="3"></textarea>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-reject-loan-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">OK, Reject</button>`,
                'max-w-md');
            document.getElementById('confirm-reject-loan-btn').onclick = () => {
                const reason = document.getElementById('loan-rejection-reason-input')?.value.trim() || 'Loan request cancelled by admin.';
                window.closeModal();
                handleLoanRequestAction(userId, requestId, 'rejected', 0, reason);
            };
        };

const showGiveLoanChanceConfirmModal = (userId, requestId) => {
            const request = allLoanRequestsCache.find(item => item.id === requestId) || {};
            showLoanActionConfirmModal({
                title: 'Give Loan Chance',
                message: `Move ${escapeHtml(request.name || 'this user')} rejected loan request back to pending so it can be checked again?`,
                confirmLabel: 'OK, Give Chance',
                confirmClass: 'bg-indigo-600',
                onConfirm: () => handleLoanGiveChanceAction(userId, requestId)
            });
        };

const handleLoanRequestAction = async (userId, requestId, newStatus, maxLoanAmount = 0, rejectionReason = 'Loan request cancelled by admin.') => {
            try {
                if (newStatus === 'approved' && (!Number.isFinite(Number(maxLoanAmount)) || Number(maxLoanAmount) < 1)) {
                    return showApproveLoanRequestModal(userId, requestId);
                }
                const rejectedAt = newStatus === 'approved' ? null : new Date();
                const reapplyAfter = rejectedAt ? addMonthsClamped(rejectedAt, LOAN_REAPPLY_WAIT_MONTHS) : null;
                const cleanRejectionReason = String(rejectionReason || 'Loan request cancelled by admin.').trim();
                const requestRef = doc(db, `artifacts/${appId}/public/data/loan_requests`, requestId);
                let resolvedUserId = String(userId || '').trim();
                const isValidResolvedUserId = (value) => value && !['undefined', 'null', 'false'].includes(String(value).toLowerCase());
                const adminActorId = currentUser?.uid || ADMIN_UID;
                let requestSnapshotForCloud = {};
                await runTransaction(db, async (tx) => {
                    const requestDoc = await tx.get(requestRef);
                    if (!requestDoc.exists()) throw new Error('Loan request not found.');
                    const requestData = requestDoc.data();
                    requestSnapshotForCloud = { id: requestDoc.id, requestId: requestDoc.id, ...requestData };
                    resolvedUserId = isValidResolvedUserId(resolvedUserId) ? resolvedUserId : String(requestData.userId || requestData.uid || '').trim();
                    const canUpdateUser = isValidResolvedUserId(resolvedUserId);
                    if (newStatus === 'approved' && !canUpdateUser) {
                        throw new Error('Loan request user account is missing. Reject it or ask user to apply again.');
                    }
                    const userRef = canUpdateUser ? doc(db, `artifacts/${appId}/public/data/users`, resolvedUserId) : null;
                    const userDoc = userRef ? await tx.get(userRef) : null;
                    if (newStatus === 'approved' && (!userDoc || !userDoc.exists())) {
                        throw new Error('User account not found for this loan request.');
                    }
                    const currentStatus = getLoanRequestStatus(requestData);
                    const rejectedStatuses = ['rejected', 'cancelled', 'canceled', 'failed', 'denied'];
                    if (newStatus === 'approved' && !['pending', ...rejectedStatuses].includes(currentStatus)) {
                        throw new Error('Loan request is already processed.');
                    }
                    if (newStatus !== 'approved' && currentStatus !== 'pending') {
                        throw new Error('Only pending loan requests can be rejected.');
                    }
                    tx.update(requestRef, {
                        status: newStatus,
                        processedAt: serverTimestamp(),
                        processedBy: adminActorId,
                        ...(newStatus === 'approved' ? {
                            reapplyAfter: deleteField(),
                            rejectionReason: deleteField()
                        } : {
                            reapplyAfter: Timestamp.fromDate(reapplyAfter),
                            rejectionReason: cleanRejectionReason
                        })
                    });
                    if (newStatus === 'approved') {
                        tx.update(userRef, {
                            loanEligible: true,
                            maxLoanAmount: Number(maxLoanAmount),
                            loanMaxAmount: Number(maxLoanAmount),
                            loanApplicationVersion: LOAN_APPLICATION_VERSION,
                            loanRequestStatus: 'approved',
                            loanApprovedAt: serverTimestamp(),
                            loanApprovedBy: adminActorId,
                            loanDocumentsSubmitted: true,
                            loanDocumentsVerified: true,
                            loanDocumentsApprovedAt: serverTimestamp(),
                            loanReapplyAfter: deleteField(),
                            loanRejectionReason: deleteField(),
                            loanProcessedAt: deleteField(),
                            loanProcessedBy: deleteField()
                        });
                        tx.update(requestRef, {
                            maxLoanAmount: Number(maxLoanAmount),
                            loanApplicationVersion: LOAN_APPLICATION_VERSION,
                            loanDocumentsSubmitted: true,
                            loanDocumentsVerified: true,
                            loanDocumentsApproved: true
                        });
                    } else if (userRef && userDoc?.exists()) {
                        tx.update(userRef, {
                            loanEligible: false,
                            maxLoanAmount: 0,
                            loanMaxAmount: 0,
                            loanRequestStatus: newStatus,
                            latestLoanRequestVersion: LOAN_APPLICATION_VERSION,
                            loanApplicationVersion: LOAN_APPLICATION_VERSION,
                            loanProcessedAt: serverTimestamp(),
                            loanProcessedBy: adminActorId,
                            loanReapplyAfter: Timestamp.fromDate(reapplyAfter),
                            loanRejectionReason: cleanRejectionReason,
                            loanDocumentsVerified: false
                        });
                    }
                });
                const processedAt = Date.now();
                const localRequestUpdate = newStatus === 'approved'
                    ? {
                        status: 'approved',
                        processedAt,
                        processedBy: currentUser?.uid || ADMIN_UID,
                        maxLoanAmount: Number(maxLoanAmount),
                        loanApplicationVersion: LOAN_APPLICATION_VERSION,
                        loanDocumentsSubmitted: true,
                        loanDocumentsVerified: true,
                        loanDocumentsApproved: true,
                        reapplyAfter: null,
                        rejectionReason: ''
                    }
                    : {
                        status: newStatus,
                        processedAt,
                        processedBy: currentUser?.uid || ADMIN_UID,
                        reapplyAfter: reapplyAfter?.getTime?.() || null,
                        rejectionReason: cleanRejectionReason
                    };
                allLoanRequestsCache = allLoanRequestsCache.map(request => request.id === requestId ? { ...request, ...localRequestUpdate } : request);
                if (isValidResolvedUserId(resolvedUserId)) {
                    allUsersCache = allUsersCache.map(user => {
                        const cacheUserId = user.id || user.uid;
                        if (cacheUserId !== resolvedUserId) return user;
                        return newStatus === 'approved'
                            ? {
                                ...user,
                                loanEligible: true,
                                maxLoanAmount: Number(maxLoanAmount),
                                loanMaxAmount: Number(maxLoanAmount),
                                loanApplicationVersion: LOAN_APPLICATION_VERSION,
                                loanRequestStatus: 'approved',
                                loanDocumentsSubmitted: true,
                                loanDocumentsVerified: true,
                                loanReapplyAfter: null,
                                loanRejectionReason: ''
                            }
                            : {
                                ...user,
                                loanEligible: false,
                                maxLoanAmount: 0,
                                loanMaxAmount: 0,
                                loanRequestStatus: newStatus,
                                latestLoanRequestVersion: LOAN_APPLICATION_VERSION,
                                loanApplicationVersion: LOAN_APPLICATION_VERSION,
                                loanReapplyAfter: reapplyAfter?.getTime?.() || null,
                                loanRejectionReason: cleanRejectionReason,
                                loanDocumentsVerified: false
                            };
                    });
                }
                upsertCloudLoanRequest({
                    ...requestSnapshotForCloud,
                    ...localRequestUpdate,
                    id: requestId,
                    requestId,
                    userId: resolvedUserId || requestSnapshotForCloud.userId || userId,
                    status: newStatus,
                    processedAt
                }).catch(error => console.warn('Cloud loan request status sync skipped:', error));
                renderAdminLoanPage();
                updateAdminLoanRequestBadge();
                showNotification(`Loan request ${newStatus}.`);
                refreshAdminDashboardCaches().catch(error => console.error('Admin cache refresh failed:', error));
            } catch (e) {
                console.error('Loan action failed:', e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

const handleLoanGiveChanceAction = async (userId, requestId) => {
            try {
                const requestRef = doc(db, `artifacts/${appId}/public/data/loan_requests`, requestId);
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                let requestSnapshotForCloud = {};
                await runTransaction(db, async (tx) => {
                    const requestDoc = await tx.get(requestRef);
                    if (!requestDoc.exists()) throw new Error('Loan request not found.');
                    requestSnapshotForCloud = { id: requestDoc.id, requestId: requestDoc.id, ...requestDoc.data() };
                    const currentStatus = getLoanRequestStatus(requestDoc.data());
                    if (!['rejected', 'cancelled', 'canceled', 'failed', 'denied'].includes(currentStatus)) {
                        throw new Error('Only rejected loan requests can be given another chance.');
                    }
                    tx.update(requestRef, {
                        status: 'pending',
                        reopenedAt: serverTimestamp(),
                        reopenedBy: currentUser.uid,
                        processedAt: deleteField(),
                        processedBy: deleteField(),
                        reapplyAfter: deleteField(),
                        rejectionReason: deleteField()
                    });
                    tx.update(userRef, {
                        loanEligible: false,
                        maxLoanAmount: 0,
                        loanMaxAmount: 0,
                        loanRequestStatus: 'pending',
                        latestLoanRequestVersion: LOAN_APPLICATION_VERSION,
                        loanApplicationVersion: LOAN_APPLICATION_VERSION,
                        loanDocumentsSubmitted: true,
                        loanDocumentsVerified: false,
                        loanProcessedAt: deleteField(),
                        loanProcessedBy: deleteField(),
                        loanReapplyAfter: deleteField(),
                        loanRejectionReason: deleteField()
                    });
                });
                showNotification('Loan request moved back to pending.');
                window.currentLoanFilter = 'pending';
                const reopenedAt = Date.now();
                allLoanRequestsCache = allLoanRequestsCache.map(request => request.id === requestId ? {
                    ...request,
                    status: 'pending',
                    reopenedAt,
                    reopenedBy: currentUser?.uid || ADMIN_UID,
                    processedAt: null,
                    processedBy: '',
                    reapplyAfter: null,
                    rejectionReason: ''
                } : request);
                upsertCloudLoanRequest({
                    ...requestSnapshotForCloud,
                    id: requestId,
                    requestId,
                    userId,
                    status: 'pending',
                    reopenedAt,
                    processedAt: null,
                    reapplyAfter: null,
                    rejectionReason: ''
                }).catch(error => console.warn('Cloud loan chance sync skipped:', error));
                refreshAdminDashboardCaches().catch(error => console.error('Admin cache refresh failed:', error));
                renderAdminLoanPage();
            } catch (e) {
                console.error('Give loan chance failed:', e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

const openLoanQuickAction = () => {
            if (loanPageOpening) return;
            loanPageOpening = true;
            Promise.resolve(openUserQuickAction(showLoanPage)).finally(() => {
                setTimeout(() => {
                    loanPageOpening = false;
                }, 250);
            });
        };

// Expose functions to window for global access
window.getLoanReservedAmount = getLoanReservedAmount;
window.getLoanLimitAmount = getLoanLimitAmount;
window.hasLoanDocumentFile = hasLoanDocumentFile;
window.hasSubmittedLoanDocuments = hasSubmittedLoanDocuments;
window.hasSubmittedLoanDetails = hasSubmittedLoanDetails;
window.isModernLoanRequest = isModernLoanRequest;
window.isApprovedModernLoanRequest = isApprovedModernLoanRequest;
window.hasModernLoanApproval = hasModernLoanApproval;
window.hasDocumentedModernLoanApproval = hasDocumentedModernLoanApproval;
window.isModernLoanRecord = isModernLoanRecord;
window.isActiveLoanRecord = isActiveLoanRecord;
window.getLoanPrincipal = getLoanPrincipal;
window.getUserLoanRecords = getUserLoanRecords;
window.getLatestModernLoanRequest = getLatestModernLoanRequest;
window.getLoanRequestRecordId = getLoanRequestRecordId;
window.getRawLoanRequestStatus = getRawLoanRequestStatus;
window.getLoanRequestRecordTime = getLoanRequestRecordTime;
window.preferLoanRequestRecord = preferLoanRequestRecord;
window.mergeLoanRequestRecords = mergeLoanRequestRecords;
window.getLoanApplicantKey = getLoanApplicantKey;
window.getLatestLoanRequestsByApplicant = getLatestLoanRequestsByApplicant;
window.serializeCloudLoanRequest = serializeCloudLoanRequest;
window.normalizeCloudLoanRequest = normalizeCloudLoanRequest;
window.upsertCloudLoanRequest = upsertCloudLoanRequest;
window.importCloudLoanRequests = importCloudLoanRequests;
window.loadCloudLoanRequests = loadCloudLoanRequests;
window.updateCloudLoanRequestStatus = updateCloudLoanRequestStatus;
window.getLoanDueDateText = getLoanDueDateText;
window.getLoanRequestStatus = getLoanRequestStatus;
window.isPendingModernLoanRequest = isPendingModernLoanRequest;
window.isRejectedModernLoanRequest = isRejectedModernLoanRequest;
window.getLoanRequestReapplyDate = getLoanRequestReapplyDate;
window.getLoanReapplyBlock = getLoanReapplyBlock;
window.getUserLoanRequestMarker = getUserLoanRequestMarker;
window.getActiveLoanFromUserMarker = getActiveLoanFromUserMarker;
window.normalizeLoanDob = normalizeLoanDob;
window.getLoanRequestPersonal = getLoanRequestPersonal;
window.saveLoanApplicationDraftFromDom = saveLoanApplicationDraftFromDom;
window.validateLoanApplicationStep = validateLoanApplicationStep;
window.renderLoanStepCircles = renderLoanStepCircles;
window.showLoanPendingPage = showLoanPendingPage;
window.showLoanRejectedCooldownPage = showLoanRejectedCooldownPage;
window.showLoanCreditDashboardPage = showLoanCreditDashboardPage;
window.showLoanPage = showLoanPage;
window.showLoanApplicationPage = showLoanApplicationPage;
window.showTakeLoanPage = showTakeLoanPage;
window.showLoanAgreementModal = showLoanAgreementModal;
window.showActiveLoanPage = showActiveLoanPage;
window.showUserLoanDetailModal = showUserLoanDetailModal;
window.showLoanDocumentPreviewModal = showLoanDocumentPreviewModal;
window.isValidLoanDob = isValidLoanDob;
window.getLoanDocumentFileKind = getLoanDocumentFileKind;
window.validateLoanDocumentSelection = validateLoanDocumentSelection;
window.compressLoanImageFile = compressLoanImageFile;
window.getLoanUploadErrorMessage = getLoanUploadErrorMessage;
window.uploadLoanDocumentToCloudflare = uploadLoanDocumentToCloudflare;
window.uploadLoanDocumentToFirebase = uploadLoanDocumentToFirebase;
window.uploadLoanDocumentFile = uploadLoanDocumentFile;
window.handleSubmitLoanRequest = handleSubmitLoanRequest;
window.handleTakeLoan = handleTakeLoan;
window.handleRepayLoan = handleRepayLoan;
window.processDueLoansForUser = processDueLoansForUser;
window.processDueLoanRepayment = processDueLoanRepayment;
window.showLoanActionConfirmModal = showLoanActionConfirmModal;
window.showApproveLoanRequestModal = showApproveLoanRequestModal;
window.showRejectLoanRequestConfirmModal = showRejectLoanRequestConfirmModal;
window.showGiveLoanChanceConfirmModal = showGiveLoanChanceConfirmModal;
window.handleLoanRequestAction = handleLoanRequestAction;
window.handleLoanGiveChanceAction = handleLoanGiveChanceAction;
window.openLoanQuickAction = openLoanQuickAction;
