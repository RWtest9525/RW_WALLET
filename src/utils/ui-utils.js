// File: src/utils/ui-utils.js

const showLoading = () => {
            document.getElementById('loading-overlay').classList.remove('hidden');
        };

const hideLoading = () => {
            document.getElementById('loading-overlay').classList.add('hidden');
        };

const friendlyErrorMessage = (fallback = 'Something went wrong. Please try again.') => fallback;

const showFriendlyError = (fallback = 'Something went wrong. Please try again.') => {
            showNotification(friendlyErrorMessage(fallback), true);
        };

const loadAndCropAvatars = () => {
            const img = new Image();
            img.src = '/avatars_sheet.png';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 180;
                    canvas.height = 180;
                    
                    const coords = [
                        { sx: 0.0, sy: 275.3, size: 250.0 },
                        { sx: 251.0, sy: 275.3, size: 250.0 },
                        { sx: 502.0, sy: 275.3, size: 250.0 },
                        { sx: 752.0, sy: 275.3, size: 250.0 },
                        { sx: 1003.0, sy: 275.9, size: 250.0 },
                        { sx: 0.0, sy: 681.5, size: 250.0 },
                        { sx: 251.0, sy: 681.9, size: 250.0 },
                        { sx: 502.0, sy: 682.4, size: 250.0 },
                        { sx: 752.0, sy: 682.9, size: 250.0 },
                        { sx: 1003.0, sy: 684.3, size: 250.0 }
                    ];

                    const cropped = [];
                    for (const coord of coords) {
                        ctx.clearRect(0, 0, 180, 180);
                        ctx.drawImage(img, coord.sx, coord.sy, coord.size, coord.size, 0, 0, 180, 180);
                        cropped.push(canvas.toDataURL('image/jpeg', 0.85));
                    }
                    if (cropped.length === 10) {
                        PREMIUM_AVATARS = cropped;
                        console.log('Successfully cropped and loaded 10 avatars.');
                        if (currentUserData) {
                            const currentUrl = getProfileAvatarUrl(currentUserData);
                            const settingsPreview = document.getElementById('settings-avatar-preview');
                            if (settingsPreview) settingsPreview.src = currentUrl;
                            const profilePreview = document.getElementById('profile-avatar-preview');
                            if (profilePreview) profilePreview.src = currentUrl;
                        }
                    }
                } catch (e) {
                    console.error('Error cropping avatars:', e);
                }
            };
            img.onerror = () => {
                console.warn('Avatars sheet load failed, using fallbacks.');
            };
        };

const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

const numericAmount = (amount) => Number(amount || 0);

const absoluteAmount = (amount) => Math.abs(numericAmount(amount));

const formatCurrencyAbs = (amount) => formatCurrency(absoluteAmount(amount));

const getUserAvailableBalance = (user = {}) => {
            const candidates = [user.balance, user.walletBalance, user.wallet_balance, user.availableBalance, user.available_balance];
            for (const value of candidates) {
                const amount = Number(value);
                if (Number.isFinite(amount)) return amount;
            }
            return 0;
        };

const getSpendableWalletBalance = (user = currentUserData || {}) =>
            Math.max(0, Number(user.balance || 0) - getLoanReservedAmount(user));

const getInsufficientWalletMessage = (user = currentUserData || {}) => {
            const reservedAmount = getLoanReservedAmount(user);
            if (reservedAmount > 0) {
                return `Insufficient available balance. ${formatCurrency(reservedAmount)} is reserved for loan repayment.`;
            }
            return 'Insufficient wallet balance.';
        };

const withTimeout = (promise, timeoutMs, message) => {
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
            });
            return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
        };

const formatCompactBalance = (amount) => {
            const value = Number(amount || 0);
            if (Math.abs(value) < 10000) return formatCurrency(value);
            const compact = new Intl.NumberFormat('en-IN', {
                maximumFractionDigits: value % 1000 === 0 ? 0 : 1
            }).format(value / 1000);
            return `₹${compact}k`;
        };

const formatUsd = (amount) => `$${Number(amount || 0).toFixed(2)}`;

const escapeHtml = (value = '') => String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

const stripUndefinedFields = (value) => {
            if (Array.isArray(value)) return value.map(stripUndefinedFields);
            if (!value || typeof value !== 'object' || value.constructor !== Object) return value;
            return Object.entries(value).reduce((clean, [key, item]) => {
                if (item === undefined) return clean;
                clean[key] = stripUndefinedFields(item);
                return clean;
            }, {});
        };

const getUserCacheKey = (userId) => `rw_wallet_user_cache_${userId}`;

const readJsonCache = (key) => {
            try {
                return JSON.parse(localStorage.getItem(key) || 'null');
            } catch (e) {
                console.warn('Cache read failed:', e);
                return null;
            }
        };

const writeJsonCache = (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.warn('Cache write failed:', e);
            }
        };

const timestampToMillis = (timestamp) => {
            if (!timestamp) return 0;
            if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
            if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
            if (typeof timestamp === 'number') return timestamp;
            if (typeof timestamp === 'object' && Number.isFinite(Number(timestamp.seconds))) {
                return (Number(timestamp.seconds) * 1000) + Math.floor(Number(timestamp.nanoseconds || 0) / 1000000);
            }
            const parsed = new Date(timestamp).getTime();
            return Number.isNaN(parsed) ? 0 : parsed;
        };

const normalizeAppConfigForCache = (config = {}) => {
            const normalized = { ...(config || {}) };
            const maintenanceEndMillis = timestampToMillis(
                normalized.maintenanceEndsAt || normalized.maintenance_ends_at || normalized.maintenanceEndAt || normalized.maintenanceEndsAtMillis || 0
            );
            const whatsNewUpdatedMillis = timestampToMillis(
                normalized.whatsNewUpdatedAt || normalized.whats_new_updated_at || normalized.whatsNewUpdatedAtMillis || 0
            );
            if (maintenanceEndMillis) normalized.maintenanceEndsAtMillis = maintenanceEndMillis;
            if (whatsNewUpdatedMillis) normalized.whatsNewUpdatedAtMillis = whatsNewUpdatedMillis;
            normalized.cachedAt = Date.now();
            return normalized;
        };

const rememberAppConfig = (config = {}) => {
            const normalized = normalizeAppConfigForCache(config);
            writeJsonCache(APP_CONFIG_CACHE_KEY, normalized);
            return normalized;
        };

const applyCachedAppConfigForStartup = () => {
            const cached = readJsonCache(APP_CONFIG_CACHE_KEY);
            if (!cached || typeof cached !== 'object') return false;
            appConfigCache = { ...(appConfigCache || {}), ...cached };
            return true;
        };

const loadAppConfigForStartup = async () => {
            applyCachedAppConfigForStartup();
            try {
                const snapshot = await getDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'));
                if (snapshot.exists()) {
                    appConfigCache = rememberAppConfig(snapshot.data());
                }
            } catch (error) {
                console.warn('Initial app config load skipped:', error);
            }
            return appConfigCache;
        };

const reviveCachedTimestamp = (value) => {
            const millis = timestampToMillis(value);
            if (!millis) return null;
            return {
                toMillis: () => millis,
                toDate: () => new Date(millis)
            };
        };

const getExplicitBalanceAfter = (item = {}) => {
            const raw = item.balanceAfter ?? item.remainingBalance ?? item.remainingFund ?? item.walletBalanceAfter ?? item.balance_after;
            const value = Number(raw);
            return Number.isFinite(value) ? value : null;
        };

const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
                return await fetch(url, { ...options, signal: controller.signal });
            } finally {
                clearTimeout(timeoutId);
            }
        };

const isExpectedBackgroundAbort = (error) => {
            const message = String(error?.message || error || '');
            return error?.name === 'AbortError' || /aborted|signal is aborted/i.test(message);
        };

const logBackgroundSkip = (label, error) => {
            if (isExpectedBackgroundAbort(error)) {
                console.debug(`${label}: timed out`);
                return;
            }
            console.warn(`${label}:`, error);
        };

const reportSyncFailure = (entityType, entityId, source, target, errorMessage) => {
            getBackendAuthToken().then(token => {
                fetch(`${BACKEND_BASE_URL}/api/admin/audit/log-sync-failure`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ entityType, entityId, source, target, errorMessage: String(errorMessage || '').slice(0, 500) })
                }).catch(() => {});
            }).catch(() => {});
        };

const recordCloudTransfer = async (senderItem, recipientItem, recipientUserId) => {
            try {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/transactions/transfer`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sender: serializeCloudTransaction(senderItem, currentUser.uid),
                        recipient: serializeCloudTransaction(recipientItem, recipientUserId)
                    })
                }, 5000);
            } catch (error) {
                console.warn('Cloudflare transfer save failed:', error);
                reportSyncFailure('transfer', 'transfer', 'firebase', 'd1', error?.message);
            }
        };

const serializeCloudFundRequest = (request = {}) => {
            const requestedAt = timestampToMillis(request.requestedAt || request.timestamp || request.createdAt) || Date.now();
            const processedAt = request.processedAt ? timestampToMillis(request.processedAt) : null;
            const requestId = String(request.requestId || request.id || `${request.type || 'request'}-${requestedAt}`);
            return {
                requestId,
                userId: request.userId || currentUser?.uid || '',
                type: request.type || 'withdrawal',
                amount: Number(request.amount || 0),
                status: request.status || 'pending',
                requestedAt,
                processedAt,
                details: {
                    ...normalizeHistoryItemForCache({ ...request, id: requestId, requestedAt, processedAt }),
                    id: requestId
                }
            };
        };

const normalizeCloudFundRequest = (request = {}) => {
            const details = request.details && typeof request.details === 'object' ? request.details : {};
            const merged = { ...details, ...request };
            return {
                ...merged,
                id: request.request_id || request.requestId || request.id || details.id || details.requestId,
                userId: request.user_id || request.userId || details.userId,
                requestedAt: Number(request.requested_at || request.requestedAt || details.requestedAt || Date.now()),
                processedAt: request.processed_at || request.processedAt || details.processedAt || null,
                amount: Number(request.amount || details.amount || 0),
                status: request.status || details.status || 'pending',
                type: request.type || details.type || 'withdrawal',
                method: getWithdrawalDisplayMethodName({ ...details, ...request }, 'N/A'),
                methodId: details.methodId || request.methodId || details.paymentMethod || request.paymentMethod || '',
                userName: details.userName || request.userName || request.user_name || 'No Name',
                userEmail: details.userEmail || request.userEmail || request.user_email || '',
                userMobile: details.userMobile || request.userMobile || request.user_mobile || ''
            };
        };

const upsertCloudFundRequest = async (request) => {
            try {
                const token = await getBackendAuthToken();
                await fetch(`${BACKEND_BASE_URL}/api/fund-requests`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(serializeCloudFundRequest(request))
                });
            } catch (error) {
                console.warn('Cloudflare fund request save failed:', error);
                reportSyncFailure('fund_request', 'new', 'firebase', 'd1', error?.message);
            }
        };

const importCloudFundRequests = async (requests) => {
            if (!requests.length || currentUser?.uid !== ADMIN_UID) return;
            try {
                const token = await getBackendAuthToken();
                await fetch(`${BACKEND_BASE_URL}/api/fund-requests/import`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ requests: requests.map(serializeCloudFundRequest) })
                });
            } catch (error) {
                console.warn('Cloudflare fund request import failed:', error);
                reportSyncFailure('fund_request_import', 'batch', 'firebase', 'd1', error?.message);
            }
        };

const loadCloudFundRequests = async ({ status = 'pending', type = '', userId = '', limit = 300, timeoutMs = 8000 } = {}) => {
            const token = await getBackendAuthToken();
            const params = new URLSearchParams({ status, limit: String(limit) });
            if (type) params.set('type', type);
            if (userId) params.set('userId', userId);
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/fund-requests?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            }, timeoutMs);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Cloudflare fund request load failed');
            return (data.requests || []).map(normalizeCloudFundRequest);
        };

const updateCloudFundRequestStatus = async (requestId, status, details = {}) => {
            try {
                const token = await getBackendAuthToken();
                await fetch(`${BACKEND_BASE_URL}/api/fund-requests/${encodeURIComponent(requestId)}`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status, details })
                });
            } catch (error) {
                console.warn('Cloudflare fund request update failed:', error);
                reportSyncFailure('fund_request', requestId || 'unknown', 'firebase', 'd1', error?.message);
            }
        };

const loadFirebasePendingFundRequests = async (userId = '') => {
            const conditions = [where("status", "==", "pending")];
            if (userId) conditions.push(where("userId", "==", userId));
            const pendingQuery = query(collection(db, `artifacts/${appId}/public/data/fund_requests`), ...conditions);
            const snap = await getDocs(pendingQuery);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        };

const getFundRequestPrimaryId = (request = {}) =>
            String(request.requestId || request.request_id || request.id || request.firestoreId || '').trim();

const getFundRequestSignature = (request = {}, bucketMs = 10 * 60 * 1000) => {
            const timestamp = timestampToMillis(request.requestedAt || request.requested_at || request.timestamp || request.createdAt);
            const timeBucket = timestamp ? Math.floor(timestamp / bucketMs) : 'no-time';
            const userId = String(request.userId || request.uid || request.user_id || '').trim();
            const type = String(request.type || 'withdrawal').trim();
            const amount = Number(request.amount || 0).toFixed(2);
            const method = String(request.method || request.methodId || request.paymentMethod || request.payment_method || '').toLowerCase().trim();
            const detail = String(getWithdrawalDetailText(request) || '').toLowerCase().replace(/\s+/g, '').trim();
            return `${userId}|${type}|${amount}|${method}|${detail}|${timeBucket}`;
        };

const getFundRequestLooseSignature = (request = {}) => {
            const userId = String(request.userId || request.uid || request.user_id || '').trim();
            const type = String(request.type || 'withdrawal').trim();
            const amount = Number(request.amount || 0).toFixed(2);
            const method = String(request.method || request.methodId || request.paymentMethod || request.payment_method || '').toLowerCase().trim();
            const detail = String(getWithdrawalDetailText(request) || '').toLowerCase().replace(/\s+/g, '').trim();
            return `${userId}|${type}|${amount}|${method}|${detail}`;
        };

const markFundRequestLocallyProcessed = (request = {}) => {
            const ids = [
                request.id,
                request.requestId,
                request.request_id,
                request.firestoreId,
                request.cloudId
            ].filter(Boolean).map(value => String(value).trim());
            ids.forEach(id => locallyProcessedFundRequestIds.add(id));
            locallyProcessedFundRequestSignatures.add(getFundRequestSignature(request));
            locallyProcessedFundRequestSignatures.add(getFundRequestLooseSignature(request));
        };

const isFundRequestLocallyProcessed = (request = {}) => {
            const ids = [
                request.id,
                request.requestId,
                request.request_id,
                request.firestoreId,
                request.cloudId
            ].filter(Boolean).map(value => String(value).trim());
            if (ids.some(id => locallyProcessedFundRequestIds.has(id))) return true;
            return locallyProcessedFundRequestSignatures.has(getFundRequestSignature(request)) ||
                locallyProcessedFundRequestSignatures.has(getFundRequestLooseSignature(request));
        };

const isFinalFundStatus = (status = '') => ['completed', 'rejected', 'cancelled', 'failed'].includes(String(status || '').toLowerCase());

const mergeFundRequestsById = (...groups) => {
            const merged = new Map();
            const signatureToKey = new Map();
            const looseSignatureToKey = new Map();
            groups.flat().forEach((request) => {
                if (!request || isFundRequestLocallyProcessed(request)) return;
                const id = getFundRequestPrimaryId(request);
                const signature = getFundRequestSignature(request);
                const looseSignature = getFundRequestLooseSignature(request);
                const existingKey = signatureToKey.get(signature) || looseSignatureToKey.get(looseSignature);
                const key = existingKey || id || signature;
                if (!key) return;
                signatureToKey.set(signature, key);
                looseSignatureToKey.set(looseSignature, key);
                const current = merged.get(key) || {};
                const currentStatus = current.status || 'pending';
                const nextStatus = request.status || 'pending';
                const finalWins = isFinalFundStatus(currentStatus) && !isFinalFundStatus(nextStatus);
                merged.set(key, finalWins ? current : { ...current, ...request, id: id || current.id || key });
            });
            return Array.from(merged.values())
                .filter(req => (req.status || 'pending') === 'pending' && !isFundRequestLocallyProcessed(req))
                .sort((a, b) => timestampToMillis(b.requestedAt || b.requested_at) - timestampToMillis(a.requestedAt || a.requested_at));
        };

const sanitizeUserForCache = (data = {}, uid = '') => ({
            uid,
            email: data.email || '',
            name: data.name || '',
            mobile: data.mobile || '',
            balance: data.balance || 0,
            paymentMethod: data.paymentMethod || '',
            paymentDetails: data.paymentDetails || {},
            whatsappNumber: data.whatsappNumber || data.mobile || '',
            websiteLinks: Array.isArray(data.websiteLinks) ? data.websiteLinks.slice(0, 3) : [],
            isProProfile: !!data.isProProfile,
            isFlagged: !!data.isFlagged,
            isDisabled: !!data.isDisabled,
            banReason: data.banReason || '',
            banExpiry: timestampToMillis(data.banExpiry) || null,
            approvalStatus: data.approvalStatus || '',
            signupApprovalStatus: data.signupApprovalStatus || '',
            accountStatus: data.accountStatus || '',
            isApproved: data.isApproved === true,
            approvalRejectionReason: data.approvalRejectionReason || '',
            signupRequestedAt: timestampToMillis(data.signupRequestedAt) || null,
            loanEligible: !!data.loanEligible,
            maxLoanAmount: data.maxLoanAmount || data.loanMaxAmount || 0,
            loanMaxAmount: data.loanMaxAmount || data.maxLoanAmount || 0,
            activeLoanId: data.activeLoanId || '',
            activeLoanRepayable: data.activeLoanRepayable || 0,
            loanLockedAmount: data.loanLockedAmount || 0,
            dueLoanBlocked: !!data.dueLoanBlocked,
            dueLoanReason: data.dueLoanReason || ''
        });

const hydrateUserFromCache = (userId) => {
            const isImpersonating = !!localStorage.getItem('impersonated_sub_admin_uid');
            const effectiveUid = isImpersonating ? localStorage.getItem('impersonated_sub_admin_uid') : userId;
            const cached = readJsonCache(getUserCacheKey(effectiveUid));
            if (!cached) return false;
            if (!isImpersonating && (cached.isFlagged || cached.isDisabled || isUserApprovalPending(cached) || isUserApprovalRejected(cached))) {
                return false;
            }

            currentUserData = cached;
            document.getElementById('user-balance').textContent = formatCompactBalance(cached.balance || 0);
            updateDollarBalanceDisplay(cached.balance || 0);
            if (effectiveUid === ADMIN_UID || isImpersonating) {
                document.getElementById('admin-wallet-balance').textContent = formatCompactBalance(cached.balance || 0);
            }
            return true;
        };

const loadSocketIoClient = (timeoutMs = 2500) => {
            if (typeof window.io === 'function') return Promise.resolve(window.io);
            if (supportSocketClientLoadPromise) return supportSocketClientLoadPromise;

            supportSocketClientLoadPromise = new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-rw-socket-io-client="true"]');
                const script = existing || document.createElement('script');
                let done = false;
                const finish = (callback, value) => {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    script.onload = null;
                    script.onerror = null;
                    callback(value);
                };
                const timer = setTimeout(() => {
                    if (!existing) script.remove();
                    finish(reject, new Error('Support chat realtime client timed out.'));
                }, timeoutMs);

                script.onload = () => {
                    if (typeof window.io === 'function') {
                        finish(resolve, window.io);
                    } else {
                        finish(reject, new Error('Support chat realtime client is not available.'));
                    }
                };
                script.onerror = () => {
                    if (!existing) script.remove();
                    finish(reject, new Error('Support chat realtime client failed to load.'));
                };

                if (!existing) {
                    script.src = `${BACKEND_BASE_URL}/socket.io/socket.io.js`;
                    script.async = true;
                    script.defer = true;
                    script.dataset.rwSocketIoClient = 'true';
                    document.head.appendChild(script);
                }
            }).catch(error => {
                supportSocketClientLoadPromise = null;
                throw error;
            });

            return supportSocketClientLoadPromise;
        };

const updateDollarBalanceDisplay = async (balance) => {
            const usdEl = document.getElementById('user-balance-usd');
            if (!usdEl) return;
            usdEl.textContent = '$--';

            try {
                const rate = await fetchUsdInrRate();
                usdEl.textContent = formatUsd((balance || 0) / rate);
            } catch (e) {
                console.error('USD balance update failed:', e);
                usdEl.textContent = '$--';
            }
        };

const fetchUsdInrRate = async () => {
            const today = new Date().toISOString().slice(0, 10);
            if (usdInrRateCache && usdInrRateDate === today) return usdInrRateCache;
            if (usdRateFetchPromise) return usdRateFetchPromise;

            usdRateFetchPromise = fetch('https://open.er-api.com/v6/latest/USD')
                .then(res => {
                    if (!res.ok) throw new Error(`Rate API error ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    const rate = data?.rates?.INR;
                    if (!rate) throw new Error('INR rate missing');
                    usdInrRateCache = rate;
                    usdInrRateDate = today;
                    return rate;
                })
                .finally(() => {
                    usdRateFetchPromise = null;
                });

            return usdRateFetchPromise;
        };

const formatDate = (timestamp) => {
            if (!timestamp) return 'N/A';
            const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const date = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
            const time = d.toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            return `${date} ${time}`;
        };

const formatDateDDMMYY = (timestamp) => {
            if (!timestamp) return 'N/A';
            const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yy = String(d.getFullYear()).slice(-2);
            const time = d.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            return `${dd}/${mm}/${yy} ${time}`;
        };

const getTimeFromTimestamp = (timestamp) => {
            if (!timestamp) return 'N/A';
            const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return d.toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        };

const normalizePhoneDigits = (value = '') => String(value || '').replace(/\D/g, '').slice(-10);

const getUserMobileValue = (user = {}) =>
            user.mobile || user.phoneNumber || user.phone || user.userMobile || user.contactNumber || '';

const findExistingUserByMobile = async (mobile, excludeUid = '') => {
            const digits = normalizePhoneDigits(mobile);
            if (!/^\d{10}$/.test(digits)) return null;
            const localMatch = allUsersCache.find(user =>
                (user.id || user.uid) !== excludeUid && normalizePhoneDigits(getUserMobileValue(user)) === digits
            );
            if (localMatch) return localMatch;
            const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
            const directQueries = [
                query(usersRef, where('mobile', '==', digits)),
                query(usersRef, where('phoneNumber', '==', digits))
            ];
            for (const mobileQuery of directQueries) {
                const snap = await getDocs(mobileQuery);
                const match = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .find(user => (user.id || user.uid) !== excludeUid);
                if (match) return match;
            }
            const allSnap = await getDocs(usersRef);
            return allSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .find(user => (user.id || user.uid) !== excludeUid && normalizePhoneDigits(getUserMobileValue(user)) === digits) || null;
        };

const userMatchesSearch = (user = {}, searchTerm = '') => {
            const rawSearch = String(searchTerm || '').trim().toLowerCase();
            if (!rawSearch) return true;
            const digitSearch = normalizePhoneDigits(rawSearch);
            const userDigits = normalizePhoneDigits(getUserMobileValue(user));
            return [
                user.email,
                user.name,
                user.fullName,
                user.displayName,
                user.mobile,
                user.phoneNumber,
                user.phone,
                user.userMobile,
                user.contactNumber,
                user.id,
                user.uid
            ].some(value => String(value || '').toLowerCase().includes(rawSearch))
                || (!!digitSearch && userDigits.includes(digitSearch));
        };

const maskMobile = (mobile) => {
            if (!mobile || mobile.length < 10) return '******';
            const digits = normalizePhoneDigits(mobile);
            if (digits.length < 10) return '******';
            return digits.substring(0, 3) + '****' + digits.substring(7);
        };

const maskUpi = (upiId) => {
            if (!upiId) return '******';
            const atIndex = upiId.indexOf('@');
            if (atIndex <= 2) return '****' + upiId.substring(atIndex);
            return upiId.substring(0, 2) + '****' + upiId.substring(atIndex);
        };

const playSuccessSound = () => {};

const playErrorSound = () => {};

const getCachedSessionUserId = () => localStorage.getItem('lastLoggedInUser') || '';

const ensureUserSessionReady = () => {
            if (currentUser) return true;
            if (hasCachedLoginSession()) {
                showNotification('App is opening. Please wait a moment.', true, false);
                return false;
            }
            showNotification('Please login first.', true);
            return false;
        };

const renderModal = (title, content, actions, size = 'max-w-md', colorfulBorder = false) => {
            const borderClass = colorfulBorder ? 'colorful-border' : '';
            document.getElementById('modal-container').innerHTML = `
                <div id="app-modal" class="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div class="fixed inset-0 modal-backdrop" onclick="window.closeModal()"></div>
                    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl z-[90] w-full ${size} max-h-[88dvh] overflow-hidden border border-gray-100 dark:border-gray-700 p-0 transform transition-all scale-95 opacity-0 animate-modal-in ${borderClass}">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold px-6 pt-6">${title}</h3>
                            <button onclick="window.closeModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl px-6 pt-6">&times;</button>
                        </div>
                        <div class="px-6 ${actions ? 'max-h-[62dvh]' : 'max-h-[70dvh] pb-6'} overflow-y-auto">${content}</div>
                        ${actions ? `<div class="mt-6 flex justify-end space-x-3 border-t border-gray-100 dark:border-gray-700 px-6 py-4 bg-white dark:bg-gray-800">${actions}</div>` : ''}
                    </div>
                </div>
                <style> 
                    @keyframes animate-modal-in { to { scale: 1; opacity: 1; } } 
                    .animate-modal-in { animation: animate-modal-in 0.2s ease-out forwards; } 
                </style>`;
            setTimeout(keepFocusedInputVisible, 80);
        };

window.closeModal = () => {
            document.getElementById('modal-container').innerHTML = '';
        };

const setMainChrome = (show) => {
            document.getElementById('bottom-nav')?.classList.toggle('hidden', !show);
        };

const isKeyboardLiftTarget = (element) =>
            element?.matches?.('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea, select')
            && !element.closest?.('#support-chat-shell, #revy-chat-shell');

const keepFocusedInputVisible = () => {
            const target = isKeyboardLiftTarget(activeKeyboardInput) ? activeKeyboardInput : null;
            if (!target) return;
            const keyboardHeight = window.visualViewport
                ? Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop)
                : 0;
            const pageContainer = document.getElementById('page-container');
            if (pageContainer && !pageContainer.classList.contains('hidden')) {
                pageContainer.style.scrollPaddingBottom = keyboardHeight > 40 ? `${keyboardHeight + 96}px` : '7rem';
            }
            const modalScroller = target.closest('#app-modal [class*="overflow-y-auto"]');
            if (modalScroller) {
                modalScroller.style.scrollPaddingBottom = keyboardHeight > 40 ? `${keyboardHeight + 80}px` : '5rem';
            }
            setTimeout(() => {
                target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
            }, 80);
        };

const installGlobalKeyboardLift = () => {
            document.addEventListener('focusin', (event) => {
                if (!isKeyboardLiftTarget(event.target)) return;
                activeKeyboardInput = event.target;
                keepFocusedInputVisible();
                setTimeout(keepFocusedInputVisible, 250);
            });
            document.addEventListener('input', (event) => {
                if (event.target === activeKeyboardInput) keepFocusedInputVisible();
            });
            document.addEventListener('focusout', (event) => {
                if (event.target !== activeKeyboardInput) return;
                setTimeout(() => {
                    if (document.activeElement === activeKeyboardInput) return;
                    activeKeyboardInput = null;
                    const pageContainer = document.getElementById('page-container');
                    if (pageContainer) pageContainer.style.scrollPaddingBottom = '';
                    document.querySelectorAll('#app-modal [class*="overflow-y-auto"]').forEach(el => {
                        el.style.scrollPaddingBottom = '';
                    });
                }, 180);
            });
            window.visualViewport?.addEventListener('resize', keepFocusedInputVisible);
            window.visualViewport?.addEventListener('scroll', keepFocusedInputVisible);
        };

const getBanExpiryDate = (banExpiry) => {
            if (!banExpiry) return null;
            if (banExpiry.toDate) return banExpiry.toDate();
            const date = new Date(banExpiry);
            return Number.isNaN(date.getTime()) ? null : date;
        };

const getBanMessage = (data = {}) => {
            const reason = data.banReason || 'No reason specified.';
            const expiry = getBanExpiryDate(data.banExpiry);
            let message = `Your account has been suspended.\nReason: ${reason}`;
            message += expiry ? `\nSuspension ends on: ${expiry.toLocaleString('en-IN')}` : '\nThis is a permanent suspension.';
            return message;
        };

const getBanDetails = (data = {}) => {
            const expiry = getBanExpiryDate(data.banExpiry);
            return {
                reason: data.banReason || 'No reason specified.',
                time: expiry ? expiry.toLocaleString('en-IN') : 'Permanent suspension'
            };
        };

const isUserApprovalPending = (data = {}) =>
            data.approvalStatus === 'pending' || data.signupApprovalStatus === 'pending' || data.accountStatus === 'pending_approval';

const isUserApprovalRejected = (data = {}) =>
            data.approvalStatus === 'rejected' || data.signupApprovalStatus === 'rejected' || data.accountStatus === 'rejected';

const getApprovalHoldMessage = (data = {}) => {
            if (isUserApprovalRejected(data)) {
                return data.approvalRejectionReason || 'Your account creation request was cancelled by admin.';
            }
            return 'Your account creation is pending. Please wait, admin will approve it soon.';
        };

const getApprovalDetails = (data = {}) => ({
            title: isUserApprovalRejected(data) ? 'Verification Cancelled' : 'Verification Pending',
            message: isUserApprovalRejected(data)
                ? (data.approvalRejectionReason || 'Your account verification request was cancelled by admin.')
                : 'Your account has been sent to admin and it will be verified soon. After approval, your wallet will open automatically.',
            requestedAt: timestampToMillis(data.signupRequestedAt || data.createdAt)
        });

const showApprovedDashboardAfterHold = (isAdmin = false) => {
            const dashboard = document.getElementById('dashboard-content');
            const pageContainer = document.getElementById('page-container');
            if (!dashboard?.classList.contains('hidden') || !document.getElementById('verification-pending-container')) return;
            applyAdminBottomChrome(isAdmin);
            currentMainSection = 'home';
            switchTab('user-panel');
            setBottomNavActive('bottom-home-btn');
            setMainChrome(true);
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('main-content')?.classList.remove('hidden');
            dashboard.classList.remove('hidden');
            pageContainer.classList.add('hidden');
            pageContainer.innerHTML = '';
            pageContainer.style.overflowY = 'auto';
            document.getElementById('app-footer')?.classList.add('app-footer-hidden');
        };

const enforceCurrentUserApproval = async (userId, userRef, data = {}) => {
            if (userId === ADMIN_UID) return false;
            if (!isUserApprovalPending(data) && !isUserApprovalRejected(data)) return false;
            currentUserData = { ...(currentUserData || {}), ...data, uid: userId, id: userId };
            localStorage.setItem('lastLoggedInUser', userId);
            writeJsonCache(getUserCacheKey(userId), sanitizeUserForCache(currentUserData, userId));
            showVerificationPendingPage(currentUserData);
            return true;
        };

const enforceCurrentUserBan = async (userId, userRef, data = {}) => {
            if (userId === ADMIN_UID || !data.isFlagged) return false;
            const expiry = getBanExpiryDate(data.banExpiry);
            if (expiry && new Date() >= expiry) {
                await updateDoc(userRef, {
                    isFlagged: false,
                    isDisabled: false,
                    banReason: deleteField(),
                    banExpiry: deleteField(),
                    disabledAt: deleteField(),
                    disabledBy: deleteField()
                });
                return false;
            }
            currentUserData = { ...(currentUserData || {}), ...data, uid: userId, id: userId };
            localStorage.setItem('lastLoggedInUser', userId);
            writeJsonCache(getUserCacheKey(userId), sanitizeUserForCache(currentUserData, userId));
            showBlockedAccountPage(currentUserData);
            return true;
        };

const getUserWebSeenMillis = (user = {}) => timestampToMillis(user.webAppLastSeenAt || user.web_app_last_seen_at || user.lastWebAppSeenAt || user.last_web_app_seen_at);

const isUserOnUpdatedWebApp = (user = {}) => {
            if (user.webAppUpdatedOn === WEB_APP_UPDATE_DATE || user.web_app_updated_on === WEB_APP_UPDATE_DATE) return true;
            const build = user.webAppBuild || user.web_app_build || user.lastWebAppBuild || '';
            return !!build || !!getUserWebSeenMillis(user);
        };

const markUpdatedWebAppSeen = async (userId, userRef, data = {}) => {
            if (!userId || userId === ADMIN_UID) return;
            if (isUserOnUpdatedWebApp(data)) return;
            const cacheKey = `rw_web_updated_${userId}_${WEB_APP_UPDATE_DATE}`;
            if (localStorage.getItem(cacheKey)) return;
            localStorage.setItem(cacheKey, '1');
            await updateDoc(userRef, {
                webAppBuild: WEB_APP_BUILD,
                webAppUpdatedOn: WEB_APP_UPDATE_DATE,
                webAppLastSeenAt: serverTimestamp(),
                webAppLastSeenUserAgent: navigator.userAgent.slice(0, 180)
            });
        };

const initializeUserListeners = (userId) => {
            console.log(`Initializing user listeners for ${userId}`);

            const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
            unsubscribers.push(onSnapshot(userDocRef, async (doc) => {
                if (doc.exists()) {
                    console.log("User data snapshot received");
                    const data = doc.data();
                    currentUserData = { id: userId, uid: userId, ...data };
                    applyMaintenanceMode();
                    showWhatsNewPopupIfNeeded();
                    const isBanned = await enforceCurrentUserBan(userId, userDocRef, data).catch(e => {
                        console.error('Ban enforcement failed:', e);
                        return false;
                    });
                    if (isBanned) return;
                    const approvalBlocked = await enforceCurrentUserApproval(userId, userDocRef, data).catch(e => {
                        console.error('Approval enforcement failed:', e);
                        return false;
                    });
                    if (approvalBlocked) return;
                    const pageContainer = document.getElementById('page-container');
                    const pageIsOpen = !!(
                        pageContainer &&
                        !pageContainer.classList.contains('hidden') &&
                        pageContainer.innerHTML.trim()
                    );
                    const pageOpenedRecently = Date.now() - lastManualPageOpenAt < 15000;
                    if ((!pageIsOpen || document.getElementById('verification-pending-container')) && !pageOpenedRecently) {
                        showApprovedDashboardAfterHold(userId === ADMIN_UID);
                    }
                    if (!data.isFlagged && data.isDisabled && !data.dueLoanBlocked) {
                        updateDoc(userDocRef, {
                            isDisabled: false,
                            disabledAt: deleteField(),
                            disabledBy: deleteField()
                        }).catch(e => console.warn('Stale disabled flag cleanup skipped:', e));
                    }
                    markUpdatedWebAppSeen(userId, userDocRef, data).catch(e => console.warn('Web app usage marker skipped:', e));
                    document.getElementById('user-balance').textContent = formatCompactBalance(data.balance);
                    updateDollarBalanceDisplay(data.balance);
                    currentUserData = { id: userId, uid: userId, ...data };
                    writeJsonCache(getUserCacheKey(userId), sanitizeUserForCache(data, userId));
                    getBackendAuthToken().catch(e => logBackgroundSkip('Backend session warmup skipped', e));
                    preloadSupportChatForUser(userId).catch(e => logBackgroundSkip('Support chat preload skipped', e));
                    preloadNotificationsForUser(userId).catch(e => logBackgroundSkip('Notification preload skipped', e));
                    preloadUserTaskParticipation(userId).catch(e => logBackgroundSkip('Task participation preload skipped', e));
                    if (userId !== ADMIN_UID && userTaskHistoryCache.length === 0 && !userTaskHistoryLoading) {
                        loadUserTaskHistory().catch(e => console.error("Prefetch user task history failed:", e));
                    }
                    if (!pushNotificationsInitialized) {
                        pushNotificationsInitialized = true;
                        initializePushNotifications(userId).catch(e => console.warn('FCM Warmup failed:', e));
                    }
                    const now = Date.now();
                    if (now - lastAutoProcessCheckAt > 60000) {
                        lastAutoProcessCheckAt = now;
                        processDuePartnerInvestmentsForUser(userId).catch(e => console.error('Auto partner interest check failed:', e));
                        processDueLoansForUser(userId).catch(e => console.error('Auto loan debit check failed:', e));
                    }
                    if (userId === ADMIN_UID) {
                        document.getElementById('admin-wallet-balance').textContent = formatCompactBalance(data.balance);
                    }
                } else {
                    console.warn(`User document not found for ${userId} (snapshot listener)`);
                }
            }, (error) => console.error("Error listening to user doc:", error)));

            let transactions = [];
            let pendingRequests = [];
            const renderUnifiedHistory = (limit) => {
                let combined = [
                    ...mergeTransactionsByKey(transactions),
                    ...pendingRequests.map(normalizePendingRequestForHistory)
                ];
                combined.sort((a, b) => timestampToMillis(b.timestamp) - timestampToMillis(a.timestamp));
                unifiedHistoryCache = combined;
                writeHistoryItemsToCache(userId, combined);

                const listElement = document.getElementById('transactions-list');
                if (document.getElementById('all-transactions-list')) {
                    const activeFilter = document.querySelector('#filter-bar .active-filter')?.dataset.filter || 'all';
                    renderFilteredTransactions(activeFilter, { reset: false });
                }
                const limitedList = limit ? combined.slice(0, limit) : combined;
                if (!listElement) return;

                listElement.innerHTML = limitedList.length === 0
                    ? `<p class="text-gray-500 dark:text-gray-400">No transactions yet.</p>`
                    : limitedList.map(item => renderTransactionItem(item)).join('');
                if (limit) {
                    try {
                        localStorage.setItem(getHistoryCacheKey(userId), listElement.innerHTML);
                    } catch (e) {
                        console.warn('History cache write failed:', e);
                    }
                }
            };

            const cachedHistoryHtml = localStorage.getItem(getHistoryCacheKey(userId));
            if (cachedHistoryHtml && document.getElementById('transactions-list')) {
                document.getElementById('transactions-list').innerHTML = cachedHistoryHtml;
            }
            const cachedHistoryItems = readHistoryItemsFromCache(userId);
            if (cachedHistoryItems.length) {
                unifiedHistoryCache = cachedHistoryItems;
                transactions = cachedHistoryItems.filter(item => !String(item.key || '').startsWith('req-') && item.status !== 'pending');
                pendingRequests = cachedHistoryItems.filter(item => String(item.key || '').startsWith('req-') || item.status === 'pending');
                renderUnifiedHistory(5);
            }
            prefetchTransactionHistory(userId).catch(error => console.warn('Transaction history background prefetch skipped:', error));

            const userTransactionsQuery = query(
                collection(db, `artifacts/${appId}/public/data/users/${userId}/transactions`),
                orderBy('timestamp', 'desc'),
                firestoreLimit(200)
            );
            unsubscribers.push(onSnapshot(userTransactionsQuery, (snapshot) => {
                transactions = mergeTransactionsByKey(transactions, snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                renderUnifiedHistory(5);
            }, (error) => console.warn('Realtime transaction listener skipped:', error)));

            Promise.all([
                loadFirebaseTransactions(userId, FIRESTORE_TRANSACTION_READ_LIMIT).catch(error => {
                    console.warn('Firebase transaction history preload skipped:', error);
                    return [];
                }),
                fetchCloudTransactionHistory(userId, FIRESTORE_TRANSACTION_READ_LIMIT).catch(error => {
                    console.warn('Cloud transaction history preload skipped:', error);
                    return [];
                })
            ])
                .then(([firebaseTransactions, cloudTransactions]) => {
                    transactions = mergeTransactionsByKey(cachedHistoryItems.filter(item => !String(item.key || '').startsWith('req-')), firebaseTransactions, cloudTransactions);
                    renderUnifiedHistory(5);
                })
                .catch((error) => {
                    console.error("Firebase transaction history load failed:", error);
                    if (cachedHistoryItems.length) {
                        renderUnifiedHistory(5);
                        return;
                    }
                    console.warn('Using realtime/cache after transaction preload failure.');
                });

            loadCloudFundRequests({ status: 'pending', userId })
                .then(async (requests) => {
                    if (!requests.length) {
                        const firebasePending = await loadFirebasePendingFundRequests(userId);
                        if (firebasePending.length) {
                            pendingRequests = firebasePending;
                            firebasePending.forEach(request => upsertCloudFundRequest(request));
                        } else {
                            pendingRequests = requests;
                        }
                    } else {
                        pendingRequests = requests;
                    }
                    renderUnifiedHistory(5);
                })
                .catch((error) => {
                    console.error("Cloud pending fund request load failed:", error);
                    if (cachedHistoryItems.length) {
                        renderUnifiedHistory(5);
                        return;
                    }
                    loadFirebasePendingFundRequests(userId)
                        .then((requests) => {
                            pendingRequests = requests;
                            renderUnifiedHistory(5);
                        })
                        .catch((firebaseError) => console.error("Error loading pending fund requests:", firebaseError));
                });
        };

const applyAdsSnapshot = (docs = []) => {
            allAdsCache = docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
            renderHomeAdsCarousel();
            if (document.getElementById('admin-ads-list')) {
                renderAdminAdsList();
            }
        };

const getYoutubeEmbedUrl = (url = '') => {
            const value = String(url || '').trim();
            const match = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
            return match ? `https://www.youtube.com/embed/${match[1]}?mute=1&playsinline=1&rel=0` : '';
        };

const getAdType = (ad = {}) => {
            if ((ad.type || '').toLowerCase() === 'youtube') return 'youtube';
            return getYoutubeEmbedUrl(ad.mediaUrl || ad.link || ad.url) ? 'youtube' : 'image';
        };

const getAdMediaUrl = (ad = {}) => ad.mediaUrl || ad.link || ad.url || '';

const renderHomeAdsCarousel = () => {
            const carousel = document.getElementById('home-ads-carousel');
            const dots = document.getElementById('home-ads-dots');
            if (!carousel || !dots) return;
            const activeAds = allAdsCache.filter(ad => (ad.status || 'active') === 'active');
            const ads = activeAds.length ? activeAds : [{
                title: 'REVIEWS WORLD',
                subtitle: 'Latest offers and work updates will appear here.',
                mediaUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
                type: 'image',
                status: 'active'
            }];
            homeAdsActiveIndex = Math.min(homeAdsActiveIndex, ads.length - 1);
            const render = () => {
                const ad = ads[homeAdsActiveIndex] || ads[0];
                const mediaUrl = getAdMediaUrl(ad);
                const youtubeUrl = getYoutubeEmbedUrl(mediaUrl);
                const isYoutube = getAdType(ad) === 'youtube' && youtubeUrl;
                carousel.innerHTML = `
                    <div class="relative mx-auto aspect-[16/7] w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-white dark:border-gray-800 bg-gray-950 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                        ${isYoutube ? `
                            <iframe src="${youtubeUrl}" title="${escapeHtml(ad.title || 'Advertisement')}" class="absolute inset-0 h-full w-full" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>
                        ` : `
                            <img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(ad.title || 'Advertisement')}" class="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" onerror="this.src='https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80'">
                        `}
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-4 text-white">
                            <p class="text-[10px] font-black uppercase tracking-wide text-white/70">Sponsored</p>
                            <h3 class="mt-1 line-clamp-1 text-base font-black">${escapeHtml(ad.title || 'Advertisement')}</h3>
                            ${ad.subtitle ? `<p class="mt-0.5 line-clamp-1 text-xs font-semibold text-white/80">${escapeHtml(ad.subtitle)}</p>` : ''}
                        </div>
                    </div>`;
                dots.innerHTML = ads.map((_, index) => `
                    <button data-action="home-ad-dot" data-index="${index}" class="h-2 rounded-full transition-all ${index === homeAdsActiveIndex ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300 dark:bg-gray-600'}" aria-label="Ad ${index + 1}"></button>
                `).join('');
            };
            render();
            if (homeAdsAutoTimer) clearInterval(homeAdsAutoTimer);
            homeAdsAutoTimer = ads.length > 1 ? setInterval(() => {
                homeAdsActiveIndex = (homeAdsActiveIndex + 1) % ads.length;
                renderHomeAdsCarousel();
            }, 2000) : null;
        };

const renderHomeTaskCategories = () => {
            const container = document.getElementById('home-task-category-list');
            if (!container) return;
            const hideNewTasksForDailyLimit = !isBulkTaskUser() && userTaskTodaySubmissionIds.size >= NORMAL_USER_DAILY_TASK_LIMIT;
            const isBulker = isBulkTaskUser();
            const activeTasks = allTasksCache
                .filter(task => getAdminTaskEffectiveStatus(task) === 'active')
                .filter(task => {
                    // Show task if user hasn't submitted it yet
                    if (!userTaskSubmissionIds.has(task.id)) return true;
                    // If they have submitted it: for bulkers, keep visible if submitted today (until 12 AM)
                    const subtype = task.subtype || task.taskSubtype || '';
                    if (subtype === 'read_news') return false;
                    if (isBulker) {
                        return userTaskTodaySubmissionIds.has(task.id);
                    }
                    return false;
                })
                .filter(() => !hideNewTasksForDailyLimit)
                .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
            if (!activeTasks.length) {
                container.innerHTML = `<p class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-6 text-center text-sm font-bold text-gray-500 dark:text-gray-400">${hideNewTasksForDailyLimit ? 'Daily task limit completed. Please continue tomorrow.' : 'No live missions right now.'}</p>`;
                return;
            }
            const categories = ['All', ...Array.from(new Set(activeTasks.map(task => task.category || 'Other'))).slice(0, 8)];
            container.innerHTML = `
                <div class="mb-3 flex items-center justify-between gap-3 px-1">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-300">Task Categories</p>
                        <h3 class="text-lg font-black text-slate-950 dark:text-white">Live Missions</h3>
                    </div>
                    <span class="text-[11px] font-bold text-gray-400">${activeTasks.length} available</span>
                </div>
                <label class="mb-3 flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 shadow-sm">
                    <svg class="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"></path></svg>
                    <input id="user-task-search" type="search" placeholder="Search app tasks..." class="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-500">
                </label>
                <div id="user-task-category-chips" class="mb-3 flex gap-2 overflow-x-auto pb-1">
                    ${categories.map((category, index) => `
                        <button type="button" data-task-category="${escapeHtml(category)}" class="user-task-category-chip shrink-0 rounded-full px-3 py-2 text-xs font-black ${index === 0 ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'bg-white text-slate-600 border border-gray-200 dark:bg-gray-800 dark:text-slate-200 dark:border-gray-700'}">${escapeHtml(category)}</button>
                    `).join('')}
                </div>
                <div id="user-task-results" class="space-y-3"></div>`;

            let selectedCategory = 'All';
            const renderList = () => {
                const term = (document.getElementById('user-task-search')?.value || '').trim().toLowerCase();
                const filtered = activeTasks.filter(task => {
                    const matchesCategory = selectedCategory === 'All' || String(task.category || 'Other') === selectedCategory;
                    const matchesSearch = !term || [task.title, task.category, task.instructions, task.appName].some(value => String(value || '').toLowerCase().includes(term));
                    return matchesCategory && matchesSearch;
                });
                const results = document.getElementById('user-task-results');
                if (!results) return;
                results.innerHTML = filtered.length ? filtered.map(task => {
                    const image = task.imageUrl || task.logoUrl || task.iconUrl || 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png';
                    return `
                        <button data-action="open-user-task" data-taskid="${task.id}" class="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-left shadow-sm transition hover:border-slate-400 dark:hover:border-slate-500">
                            <div class="flex items-center gap-3">
                                <span class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                                    <img src="${escapeHtml(image)}" alt="${escapeHtml(task.title || 'Task')}" class="h-full w-full object-cover" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3176/3176366.png'">
                                </span>
                                <span class="min-w-0 flex-1">
                                    <span class="block truncate text-sm font-black text-slate-950 dark:text-white">${escapeHtml(task.title || 'Task')}</span>
                                    <span class="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-200">Instant</span>
                                </span>
                                <span class="text-right">
                                    <span class="block text-[8px] font-black uppercase text-slate-400">Reward</span>
                                    <span class="block text-lg font-black text-slate-950 dark:text-white">${formatCurrency(task.rate || task.reward || 0).replace('.00', '')}</span>
                                </span>
                            </div>
                        </button>`;
                }).join('') : '<p class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-5 text-center text-sm font-bold text-gray-500">No matching mission found.</p>';
            };
            renderList();
            document.getElementById('user-task-search')?.addEventListener('input', renderList);
            document.querySelectorAll('.user-task-category-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    selectedCategory = chip.dataset.taskCategory || 'All';
                    document.querySelectorAll('.user-task-category-chip').forEach(btn => {
                        const isActive = btn.dataset.taskCategory === selectedCategory;
                        btn.className = `user-task-category-chip shrink-0 rounded-full px-3 py-2 text-xs font-black ${isActive ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'bg-white text-slate-600 border border-gray-200 dark:bg-gray-800 dark:text-slate-200 dark:border-gray-700'}`;
                    });
                    renderList();
                });
            });
        };

const initializePublicHomeRealtime = () => {
            if (publicHomeRealtimeStarted) return;
            publicHomeRealtimeStarted = true;
            Promise.allSettled([
                getDocs(query(collection(db, `artifacts/${appId}/public/data/ads`), orderBy("createdAt", "desc"), firestoreLimit(30))),
                getDocs(query(collection(db, `artifacts/${appId}/public/data/tasks`), orderBy("createdAt", "desc"), firestoreLimit(50)))
            ]).then(([adsResult, tasksResult]) => {
                if (adsResult.status === 'fulfilled') applyAdsSnapshot(adsResult.value.docs);
                if (tasksResult.status === 'fulfilled') applyAdminTasksSnapshot(tasksResult.value.docs);
            }).catch(error => console.warn('Public home data load skipped:', error));
        };

const toTitleText = (value = '') => String(value)
            .replace(/[_-]+/g, ' ')
            .trim()
            .replace(/\b\w/g, char => char.toUpperCase());

const renderWebsiteLinkInputs = (links = []) => {
            const cleanLinks = Array.isArray(links) ? links.slice(0, 3) : [];
            const visibleCount = Math.max(1, cleanLinks.length);
            const inputs = Array.from({ length: visibleCount }, (_, i) => `
                <div class="flex items-center gap-2">
                    <input type="url" value="${escapeHtml(cleanLinks[i] || '')}" placeholder="https://example.com" class="profile-website-input w-full px-4 py-3 bg-white dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    ${i > 0 ? '<button type="button" class="remove-website-link-btn h-10 w-10 shrink-0 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-200 font-bold">-</button>' : ''}
                </div>
            `).join('');
            const addButton = visibleCount < 3
                ? '<button type="button" id="add-website-link-btn" class="w-full rounded-xl border border-dashed border-blue-300 dark:border-blue-700 py-2 text-sm font-bold text-blue-700 dark:text-blue-200">+ Add website link</button>'
                : '';
            return `${inputs}${addButton}`;
        };

const bindWebsiteLinkControls = () => {
            const container = document.getElementById('website-links-container');
            if (!container) return;
            const readLinks = () => Array.from(container.querySelectorAll('.profile-website-input'))
                .map(input => input.value.trim())
                .filter((value, index) => value || index === 0)
                .slice(0, 3);
            const rerender = (links) => {
                container.innerHTML = renderWebsiteLinkInputs(links);
                bindWebsiteLinkControls();
            };
            document.getElementById('add-website-link-btn')?.addEventListener('click', () => {
                const links = readLinks();
                if (links.length < 3) links.push('');
                rerender(links);
            });
            container.querySelectorAll('.remove-website-link-btn').forEach((btn, index) => {
                btn.addEventListener('click', () => {
                    const links = readLinks();
                    links.splice(index + 1, 1);
                    rerender(links);
                });
            });
        };

const renderPaymentDetailsForm = (method, currentDetails) => {
            switch (method) {
                case 'upi':
                    return `
                        <div class="space-y-1">
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">UPI ID</label>
                            <input type="text" id="payment-upi-id" value="${escapeHtml(currentDetails.upiId || '')}" placeholder="e.g. yourname@bank" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>`;
                case 'bank':
                    return `
                        <div class="space-y-3">
                            <div class="space-y-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Bank Account Number</label>
                                <input type="text" id="payment-bank-account" value="${escapeHtml(currentDetails.accountNumber || '')}" placeholder="Enter bank account number" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div class="space-y-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">IFSC Code</label>
                                <input type="text" id="payment-ifsc" value="${escapeHtml(currentDetails.ifsc || '')}" placeholder="Enter IFSC code" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div class="space-y-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Bank Name</label>
                                <input type="text" id="payment-bank-name" value="${escapeHtml(currentDetails.bankName || '')}" placeholder="Enter bank name" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div class="space-y-1">
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Account Holder Name</label>
                                <input type="text" id="payment-account-name" value="${escapeHtml(currentDetails.accountName || '')}" placeholder="Enter account holder name" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>`;
                case 'play_store':
                case 'amazon_gift':
                case 'flipkart_gift':
                case 'paypal':
                    return `
                        <div class="space-y-1">
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Email Address</label>
                            <input type="email" id="payment-email" value="${escapeHtml(currentDetails.email || '')}" placeholder="Enter your email" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>`;
                case 'crypto':
                    return `<div class="text-center py-4 text-gray-500 dark:text-gray-400">Crypto Currency withdrawal is coming soon.</div>`;
                default:
                    return '';
            }
        };

const getReferralRewardAmount = () => {
            const amount = Number(
                appConfigCache.referralRewardAmount ??
                appConfigCache.referral_reward_amount ??
                appConfigCache.referralPrice ??
                appConfigCache.referPrice ??
                5
            );
            return Number.isFinite(amount) && amount >= 0 ? amount : 5;
        };

const renderSettingAction = (id, label, iconUrl, tone = 'gray') => `
            <button id="${id}" class="flex items-center w-full gap-3 p-4 bg-${tone}-50 dark:bg-${tone}-900/20 hover:bg-${tone}-100 dark:hover:bg-${tone}-900/30 border border-${tone}-100 dark:border-${tone}-800 rounded-xl transition text-left">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-gray-800 shadow-sm">
                    <img src="${iconUrl}" alt="${label}" class="h-7 w-7 object-contain" loading="eager" fetchpriority="high" decoding="async">
                </span>
                <span class="font-semibold text-gray-900 dark:text-white">${label}</span>
            </button>`;

const loadUserLiveLists = async () => {
            try {
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/lists`, {}, 10000);
                const data = await response.json().catch(() => ({}));
                if (data.ok && Array.isArray(data.lists)) {
                    userLiveListsCache = data.lists;
                } else {
                    userLiveListsCache = [];
                }
            } catch (err) {
                console.error('Failed to load live lists:', err);
                userLiveListsCache = [];
            }
            renderUserLiveLists();
        };

const renderUserLiveLists = () => {
            const container = document.getElementById('user-live-lists-container');
            if (!container) return;

            const searchQuery = String(document.getElementById('user-live-lists-search')?.value || '').trim().toLowerCase();
            let filtered = [...userLiveListsCache];

            if (searchQuery) {
                filtered = filtered.filter(item => {
                    const matchApp = String(item.appName || '').toLowerCase().includes(searchQuery);
                    const matchNames = String(item.content || '').toLowerCase().includes(searchQuery);
                    return matchApp || matchNames;
                });
            }

            if (filtered.length === 0) {
                container.innerHTML = `<div class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 py-10 text-center text-sm font-semibold text-gray-450 dark:text-gray-500">No matching live lists found.</div>`;
                return;
            }

            container.innerHTML = filtered.map((item, idx) => {
                const formattedDate = item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown';
                const lines = item.content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                
                let highlightedCount = 0;
                let displayLines = lines;
                if (searchQuery) {
                    displayLines = lines.filter(l => l.toLowerCase().includes(searchQuery));
                    highlightedCount = displayLines.length;
                }

                return `
                <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-3">
                    <div class="flex items-center justify-between gap-2">
                        <div class="min-w-0">
                            <h4 class="text-sm font-extrabold text-gray-900 dark:text-white truncate">${escapeHtml(item.appName || 'App Review List')}</h4>
                            <p class="text-[10px] text-gray-400 dark:text-gray-500 font-semibold mt-0.5">Target Date: ${escapeHtml(formattedDate)}</p>
                        </div>
                        <span class="rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 text-[10px] font-black text-indigo-600 dark:text-indigo-300 shrink-0">
                            👥 ${lines.length} Reviewers
                        </span>
                    </div>

                    <details class="group rounded-xl border border-gray-100 dark:border-gray-750 bg-gray-50/50 dark:bg-gray-900/10 overflow-hidden" ${searchQuery ? 'open' : ''}>
                        <summary class="flex items-center justify-between p-3 cursor-pointer text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 select-none">
                            <span>${searchQuery ? `Search Results (${highlightedCount} found)` : 'Show Reviewer Names'}</span>
                            <svg class="h-3 w-3 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
                        </summary>
                        <div class="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-750 max-h-48 overflow-y-auto space-y-1 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                            ${displayLines.map(line => {
                                const highlighted = searchQuery && line.toLowerCase().includes(searchQuery)
                                    ? `<mark class="bg-yellow-100 dark:bg-yellow-950/50 dark:text-yellow-200 font-bold px-0.5">${escapeHtml(line)}</mark>`
                                    : escapeHtml(line);
                                return `<p class="py-0.5 border-b border-gray-100/50 dark:border-gray-800/50 last:border-0">${highlighted}</p>`;
                            }).join('') || '<p class="text-gray-400 py-1 italic">No matching names.</p>'}
                        </div>
                    </details>
                </div>`;
            }).join('');
        };

const handleSaveLiveList = async () => {
            const appName = document.getElementById('admin-list-app-name').value.trim();
            const date = document.getElementById('admin-list-date').value;
            const content = document.getElementById('admin-list-content').value.trim();

            if (!appName || !date || !content) {
                return showNotification('Please fill in all fields.', true);
            }

            try {
                showLoading();
                const token = await getBackendAuthToken();
                const response = await fetch(`${BACKEND_BASE_URL}/api/lists`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ appName, date, content })
                });
                hideLoading();
                const resData = await response.json().catch(() => ({}));
                if (response.ok && resData.ok) {
                    showNotification('Reviewer list saved successfully!');
                    document.getElementById('admin-list-app-name').value = '';
                    document.getElementById('admin-list-content').value = '';
                    loadAdminLiveLists();
                } else {
                    showNotification(resData.error || 'Failed to save list.', true);
                }
            } catch (err) {
                hideLoading();
                console.error('Save list error:', err);
                showNotification('Failed to save list.', true);
            }
        };

const getMaintenanceEndMillis = (config = appConfigCache) =>
            timestampToMillis(config.maintenanceEndsAtMillis || config.maintenance_ends_at_millis || config.maintenanceEndsAt || config.maintenance_ends_at || config.maintenanceEndAt || 0);

const isMaintenanceConfigActive = (config = appConfigCache) => {
            const enabled = !!(config.maintenanceEnabled || config.maintenance_enabled);
            if (!enabled) return false;
            const endMillis = getMaintenanceEndMillis(config);
            return !endMillis || endMillis > Date.now();
        };

const getMaintenanceCountdownParts = (millis) => {
            const totalSeconds = Math.max(0, Math.floor(Number(millis || 0) / 1000));
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return { hours, minutes, seconds, totalSeconds };
        };

const formatMaintenanceCountdown = (millis) => {
            const { hours, minutes, seconds } = getMaintenanceCountdownParts(millis);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };

const formatMaintenanceDurationInput = (totalSeconds = 1800) => {
            const safeSeconds = Math.min(4320 * 60, Math.max(60, Math.floor(Number(totalSeconds) || 1800)));
            return formatMaintenanceCountdown(safeSeconds * 1000);
        };

const parseMaintenanceDurationInput = (value) => {
            const match = String(value || '').trim().match(/^(\d{1,2}):([0-5]?\d):([0-5]?\d)$/);
            if (!match) return null;
            const hours = Number(match[1]);
            const minutes = Number(match[2]);
            const seconds = Number(match[3]);
            const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
            if (!Number.isFinite(totalSeconds) || totalSeconds < 60 || totalSeconds > 4320 * 60) return null;
            return totalSeconds;
        };

const updateMaintenanceCountdownUi = (endMillis) => {
            const countdown = endMillis ? formatMaintenanceCountdown(endMillis - Date.now()) : 'Updating now';
            const countdownEl = document.getElementById('maintenance-countdown-text');
            if (countdownEl) countdownEl.textContent = countdown;

            const progressEl = document.getElementById('maintenance-progress-fill');
            if (progressEl) {
                const configuredSeconds = Number(appConfigCache.maintenanceDurationSeconds || appConfigCache.maintenance_duration_seconds || 0);
                const remainingSeconds = endMillis ? Math.max(0, Math.ceil((endMillis - Date.now()) / 1000)) : 0;
                const progress = configuredSeconds > 0
                    ? Math.min(100, Math.max(6, ((configuredSeconds - remainingSeconds) / configuredSeconds) * 100))
                    : 35;
                progressEl.style.width = `${progress}%`;
            }
        };

const removeMaintenanceOverlay = () => {
            if (maintenanceCountdownTimer) {
                clearInterval(maintenanceCountdownTimer);
                maintenanceCountdownTimer = null;
            }
            document.getElementById('app-maintenance-overlay')?.remove();
            document.body.classList.remove('overflow-hidden');
        };

const renderMaintenanceOverlay = () => {
            if (!currentUser || currentUser.uid === ADMIN_UID || !isMaintenanceConfigActive(appConfigCache)) {
                removeMaintenanceOverlay();
                return;
            }
            const endMillis = getMaintenanceEndMillis(appConfigCache);
            if (endMillis && endMillis <= Date.now()) {
                removeMaintenanceOverlay();
                return;
            }

            let overlay = document.getElementById('app-maintenance-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'app-maintenance-overlay';
                overlay.className = 'fixed inset-0 z-[9999] overflow-y-auto bg-slate-950 text-white';
                document.body.appendChild(overlay);
            }
            document.body.classList.add('overflow-hidden');

            const message = appConfigCache.maintenanceMessage || 'We are improving your wallet experience. Please wait until the maintenance window is complete.';
            const countdown = endMillis ? formatMaintenanceCountdown(endMillis - Date.now()) : 'Updating now';
            const signature = `${message}|${endMillis || 0}`;
            if (overlay.dataset.maintenanceSignature === signature) {
                updateMaintenanceCountdownUi(endMillis);
                if (!maintenanceCountdownTimer) {
                    maintenanceCountdownTimer = setInterval(renderMaintenanceOverlay, 1000);
                }
                return;
            }
            overlay.dataset.maintenanceSignature = signature;
            const endText = endMillis
                ? new Date(endMillis).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s(am|pm)$/i, value => value.toUpperCase())
                : 'In progress';
            overlay.innerHTML = `
                <div class="maintenance-premium-bg min-h-[100dvh] px-4 py-6 text-white">
                    <div class="relative z-10 mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-xl items-center justify-center">
                        <section class="w-full overflow-hidden rounded-[2rem] border border-white/20 bg-white/95 p-6 text-center text-slate-950 shadow-2xl sm:p-8">
                            <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-950 p-2 shadow-xl">
                                <img src="${RW_LOGO_URL}" alt="REVIEWS WORLD" class="h-full w-full rounded-2xl object-cover">
                            </div>
                            <p class="mt-6 text-xs font-extrabold uppercase text-blue-600">App Under Maintenance</p>
                            <h1 class="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">We will be back soon</h1>
                            <p class="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-slate-600">${escapeHtml(message)}</p>

                            <div class="mt-7 rounded-[1.5rem] bg-slate-950 px-5 py-6 text-white shadow-xl">
                                <p id="maintenance-countdown-text" class="text-5xl font-extrabold leading-none tabular-nums sm:text-6xl">${escapeHtml(countdown)}</p>
                                <p class="mt-3 text-xs font-extrabold uppercase text-cyan-100/80">Remaining Time</p>
                                <div class="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
                                    <div id="maintenance-progress-fill" class="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-emerald-300 transition-[width] duration-500" style="width: 6%"></div>
                                </div>
                            </div>

                            <p class="mt-5 flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 px-3 py-3 text-[12px] font-semibold text-slate-600 sm:text-sm">
                                <span class="shrink-0">Expected opening:</span>
                                <span class="whitespace-nowrap font-extrabold text-slate-950">${escapeHtml(endText)}</span>
                            </p>
                        </section>
                    </div>
                </div>`;
            updateMaintenanceCountdownUi(endMillis);

            if (!maintenanceCountdownTimer) {
                maintenanceCountdownTimer = setInterval(renderMaintenanceOverlay, 1000);
            }
        };

const restoreDashboardAfterMaintenanceIfNeeded = () => {
            if (!maintenanceGateActive || !currentUser || currentUser.uid === ADMIN_UID || isMaintenanceConfigActive(appConfigCache)) return;
            maintenanceGateActive = false;
            if (currentUserData && (currentUserData.isFlagged || isUserApprovalPending(currentUserData) || isUserApprovalRejected(currentUserData))) return;
            const dashboard = document.getElementById('dashboard-content');
            const pageContainer = document.getElementById('page-container');
            currentMainSection = 'home';
            switchTab('user-panel');
            setBottomNavActive('bottom-home-btn');
            setMainChrome(true);
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('main-content')?.classList.remove('hidden');
            dashboard?.classList.remove('hidden');
            if (pageContainer) {
                pageContainer.classList.add('hidden');
                pageContainer.innerHTML = '';
                pageContainer.style.overflowY = 'auto';
            }
            document.getElementById('app-footer')?.classList.add('app-footer-hidden');
        };

const applyMaintenanceMode = () => {
            renderMaintenanceOverlay();
            restoreDashboardAfterMaintenanceIfNeeded();
        };

const getWhatsNewId = (config = appConfigCache) => {
            const explicit = String(config.whatsNewId || config.whats_new_id || '').trim();
            if (explicit) return explicit;
            const updatedMillis = timestampToMillis(config.whatsNewUpdatedAtMillis || config.whats_new_updated_at_millis || config.whatsNewUpdatedAt || config.whats_new_updated_at || 0);
            if (updatedMillis) return String(updatedMillis);
            const message = String(config.whatsNewMessage || config.whats_new_message || '').trim();
            return message ? `msg-${message.length}-${message.slice(0, 32)}` : '';
        };

const getWhatsNewSeenKey = (userId = currentUser?.uid || '') => `rw_wallet_whats_new_seen_${userId}`;

const closeWhatsNewPopup = (markSeen = true) => {
            const id = getWhatsNewId(appConfigCache);
            if (markSeen && currentUser?.uid && id) {
                localStorage.setItem(getWhatsNewSeenKey(currentUser.uid), id);
            }
            whatsNewPopupVisible = false;
            document.getElementById('whats-new-overlay')?.remove();
        };

window.closeWhatsNewPopup = () => closeWhatsNewPopup(true);

const showWhatsNewPopupIfNeeded = () => {
            const enabled = appConfigCache.whatsNewEnabled !== false && appConfigCache.whats_new_enabled !== false;
            const message = String(appConfigCache.whatsNewMessage || appConfigCache.whats_new_message || '').trim();
            const id = getWhatsNewId(appConfigCache);
            if (!currentUser || currentUser.uid === ADMIN_UID) {
                closeWhatsNewPopup(false);
                return;
            }
            if (!enabled || !message || !id) {
                closeWhatsNewPopup(false);
                return;
            }
            if (isMaintenanceConfigActive(appConfigCache)) {
                closeWhatsNewPopup(false);
                return;
            }
            if (whatsNewPopupVisible) return;
            if (localStorage.getItem(getWhatsNewSeenKey(currentUser.uid)) === id) return;

            const title = String(appConfigCache.whatsNewTitle || appConfigCache.whats_new_title || "What's New").trim() || "What's New";
            const overlay = document.createElement('div');
            overlay.id = 'whats-new-overlay';
            overlay.className = 'fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm';
            overlay.innerHTML = `
                <div class="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900 dark:text-white">
                    <div class="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-emerald-500 px-6 py-6 text-white">
                        <button type="button" onclick="window.closeWhatsNewPopup()" class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-2xl font-light text-white hover:bg-white/30" aria-label="Close">&times;</button>
                        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg">
                            <img src="${RW_LOGO_URL}" alt="REVIEWS WORLD" class="h-11 w-11 rounded-xl object-cover">
                        </div>
                        <p class="mt-5 text-xs font-black uppercase tracking-[0.25em] text-white/70">REVIEWS WORLD</p>
                        <h2 class="mt-2 pr-10 text-2xl font-black leading-tight">${escapeHtml(title)}</h2>
                    </div>
                    <div class="space-y-4 px-6 py-5">
                        <p class="whitespace-pre-line text-sm font-medium leading-6 text-gray-600 dark:text-gray-300">${escapeHtml(message)}</p>
                        <button type="button" onclick="window.closeWhatsNewPopup()" class="w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white shadow-lg dark:bg-white dark:text-slate-950">Got it</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            // Record view in Firestore so admin can track it
            try {
                const seenDocRef = doc(db, `artifacts/${appId}/public/data/whats_new_seen/${id}/users`, currentUser.uid);
                setDoc(seenDocRef, {
                    userId: currentUser.uid,
                    name: currentUserData?.name || currentUser.displayName || 'Unknown User',
                    mobile: currentUserData?.mobile || 'No mobile',
                    seenAt: serverTimestamp()
                }, { merge: true }).catch(err => console.warn('whats_new_seen setDoc error:', err));
            } catch (e) {
                console.warn("Failed to record What's New view in Firestore:", e);
            }

            whatsNewPopupVisible = true;
        };

const handleTurnOffMaintenance = async () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const offBtn = document.getElementById('maintenance-off-btn');
            try {
                if (offBtn) {
                    offBtn.disabled = true;
                    offBtn.textContent = 'Turning Off...';
                }
                const writePromise = setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
                    maintenanceEnabled: false,
                    maintenanceEndsAt: null,
                    maintenanceUpdatedAt: serverTimestamp(),
                    maintenanceUpdatedBy: currentUser.uid
                }, { merge: true });

                await Promise.race([
                    writePromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
                ]);

                appConfigCache = { ...appConfigCache, maintenanceEnabled: false, maintenanceEndsAt: null, maintenanceEndsAtMillis: 0 };
                rememberAppConfig(appConfigCache);
                applyMaintenanceMode();
                showNotification('Maintenance mode turned off.');
                showMaintenanceSettingsPage();
            } catch (error) {
                console.error('Maintenance off failed:', error);
                const message = String(error?.message || '');
                if (message === 'timeout') {
                    showNotification('Database write timed out. Daily quota may be exceeded.', true);
                } else if (/resource-exhausted|quota exceeded/i.test(message)) {
                    showNotification('Database daily quota exceeded. Please try again later.', true);
                } else {
                    showNotification('Could not turn off maintenance mode. Please try again.', true);
                }
            } finally {
                if (offBtn) {
                    offBtn.disabled = false;
                    offBtn.textContent = 'Turn Off';
                }
            }
        };

const handleDisableWhatsNew = async () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const offBtn = document.getElementById('whats-new-disable-btn');
            try {
                if (offBtn) {
                    offBtn.disabled = true;
                    offBtn.textContent = 'Turning Off...';
                }
                await setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
                    whatsNewEnabled: false,
                    whatsNewUpdatedAt: serverTimestamp(),
                    whatsNewUpdatedBy: currentUser.uid
                }, { merge: true });
                appConfigCache = { ...appConfigCache, whatsNewEnabled: false };
                closeWhatsNewPopup(false);
                showNotification("What's New popup turned off.");
                showWhatsNewSettingsPage();
            } catch (error) {
                console.error("What's New off failed:", error);
                showNotification("Could not turn off What's New popup. Please try again.", true);
            } finally {
                if (offBtn) {
                    offBtn.disabled = false;
                    offBtn.textContent = 'Turn Off';
                }
            }
        };

const getNextTaskMidnightMillis = () => {
            const next = new Date();
            next.setHours(24, 0, 0, 0);
            return next.getTime();
        };

const getTaskCommentPool = (task = {}) => {
            const source = Array.isArray(task.reviewComments) && task.reviewComments.length
                ? task.reviewComments
                : String(task.reviewComment || task.commentToCopy || task.reviewText || task.copyText || 'good app').split(/\r?\n/);
            const unique = [];
            source.map(value => String(value || '').trim()).filter(Boolean).forEach(comment => {
                if (!unique.includes(comment)) unique.push(comment);
            });
            return unique.length ? unique : ['good app'];
        };

const getTaskTier = (u) => {
            if (!u) return 'single';
            if (u.taskTier) return u.taskTier;
            if (u.bulkTaskMode || u.isBulkTaskUser) return 'bulker';
            return 'single';
        };

const isBulkTaskUser = () => {
            const tier = getTaskTier(currentUserData);
            return tier === 'bulker' || tier === 'super_bulker';
        };

const getTaskReservationDocId = (taskId, userId) => getSafeTransactionDocId(`task-reservation-${taskId}-${userId}`);

const getStartOfTodayMillis = () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today.getTime();
        };

const preloadUserTaskParticipation = async (userId = currentUser?.uid, { force = false } = {}) => {
            if (!userId) return;
            if (!force && userTaskParticipationLoadedFor === userId) return;
            try {
                const snap = await getDocs(query(
                    collection(db, `artifacts/${appId}/public/data/task_submissions`),
                    where('userId', '==', userId)
                ));
                const allIds = new Set();
                const todayIds = new Set();
                const todayStart = getStartOfTodayMillis();
                snap.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    const taskId = data.taskId || data.task_id;
                    if (!taskId) return;
                    allIds.add(taskId);
                    const submittedAt = timestampToMillis(data.submittedAt || data.createdAt || data.timestamp);
                    if (submittedAt >= todayStart) todayIds.add(taskId);
                });
                userTaskSubmissionIds = allIds;
                userTaskTodaySubmissionIds = todayIds;
                userTaskParticipationLoadedFor = userId;
                renderHomeTaskCategories();
            } catch (error) {
                console.warn('Task participation preload skipped:', error);
            }
        };

const findReusableTaskReservation = async (taskId, userId) => {
            const reservationRef = doc(db, `artifacts/${appId}/public/data/task_comment_reservations`, getTaskReservationDocId(taskId, userId));
            const snap = await getDoc(reservationRef);
            if (!snap.exists()) return null;
            const data = { id: snap.id, ...snap.data() };
            const expiresAt = timestampToMillis(data.expiresAt);
            if (data.status === 'reserved' && expiresAt > Date.now()) return data;
            return null;
        };

const reserveTaskReviewComment = async (task = {}) => {
            if (!currentUser?.uid) throw new Error('Please login again.');
            await preloadUserTaskParticipation(currentUser.uid);
            if (userTaskTodaySubmissionIds.has(task.id)) {
                throw new Error('You have already submitted this task today.');
            }
            if (!isBulkTaskUser() && userTaskTodaySubmissionIds.size >= NORMAL_USER_DAILY_TASK_LIMIT) {
                throw new Error('Daily task limit reached. Please continue tomorrow.');
            }

            // Try backend-first atomic reservation
            try {
                const token = await getBackendAuthToken();
                const comments = getTaskCommentPool(task);
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/task-reservations`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        taskId: task.id,
                        userName: currentUserData?.name || currentUser.email || 'User',
                        comments,
                        reservationMs: TASK_COMMENT_RESERVATION_MS
                    })
                }, 8000);
                const data = await response.json().catch(() => ({}));
                if (response.ok && data.ok && data.reservation) {
                    const res = data.reservation;
                    const reservation = {
                        id: res.id,
                        taskId: task.id,
                        taskTitle: task.title || 'Task Mission',
                        taskCode: task.taskCode || task.id,
                        taskFamily: getAdminTaskFamily(task),
                        taskSubtype: getAdminTaskSubtype(task),
                        taskSubtypeLabel: task.taskSubtypeLabel || getAdminTaskSubtypeMeta(getAdminTaskFamily(task), getAdminTaskSubtype(task)).label,
                        appName: task.appName || task.title || 'Task Mission',
                        appLogoUrl: task.imageUrl || task.logoUrl || task.iconUrl || getTaskLogoFromLink(getAdminTaskFamily(task), getAdminTaskSubtype(task), task.taskLink),
                        taskLink: task.taskLink || task.link || task.url || '',
                        reward: Number(task.rate || task.reward || 0),
                        userId: currentUser.uid,
                        userName: currentUserData?.name || currentUser.email || 'User',
                        userEmail: currentUser.email || currentUserData?.email || '',
                        userMobile: currentUserData?.mobile || '',
                        comment: res.comment,
                        commentIndex: res.comment_index ?? 0,
                        status: 'reserved',
                        isBulkMode: isBulkTaskUser(),
                        reservedAt: res.reserved_at || Date.now(),
                        expiresAt: res.expires_at || (Date.now() + TASK_COMMENT_RESERVATION_MS)
                    };
                    // Sync to Firebase for backwards compatibility
                    const reservationRef = doc(db, `artifacts/${appId}/public/data/task_comment_reservations`, getTaskReservationDocId(task.id, currentUser.uid));
                    setDoc(reservationRef, {
                        ...reservation,
                        reservedAt: Timestamp.fromMillis(reservation.reservedAt),
                        expiresAt: Timestamp.fromMillis(reservation.expiresAt),
                        updatedAt: serverTimestamp()
                    }, { merge: true }).catch(e => console.warn('Firebase reservation sync skipped:', e));
                    return reservation;
                }
                if (data.error === 'TASK_ALREADY_SUBMITTED') throw new Error('You have already submitted this task.');
            } catch (backendError) {
                if (backendError.message === 'You have already submitted this task.') throw backendError;
                console.warn('Backend reservation failed, falling back to Firebase:', backendError);
            }

            // Fallback to Firebase-only reservation (original logic)
            const existing = await findReusableTaskReservation(task.id, currentUser.uid);
            if (existing) return existing;

            const comments = getTaskCommentPool(task);
            const reservationsSnap = await getDocs(query(
                collection(db, `artifacts/${appId}/public/data/task_comment_reservations`),
                where('taskId', '==', task.id),
                where('status', '==', 'reserved')
            ));
            const usedByOthers = new Set();
            reservationsSnap.docs.forEach(docSnap => {
                const data = docSnap.data();
                const expiresAt = timestampToMillis(data.expiresAt);
                if (data.userId !== currentUser.uid && expiresAt > Date.now()) {
                    usedByOthers.add(String(data.comment || '').trim());
                }
            });
            const comment = comments.find(item => !usedByOthers.has(item)) || comments[0];
            const commentIndex = Math.max(0, comments.indexOf(comment));
            const now = Date.now();
            const expiresAt = now + TASK_COMMENT_RESERVATION_MS;
            const reservation = {
                taskId: task.id,
                taskTitle: task.title || 'Task Mission',
                taskCode: task.taskCode || task.id,
                taskFamily: getAdminTaskFamily(task),
                taskSubtype: getAdminTaskSubtype(task),
                taskSubtypeLabel: task.taskSubtypeLabel || getAdminTaskSubtypeMeta(getAdminTaskFamily(task), getAdminTaskSubtype(task)).label,
                appName: task.appName || task.title || 'Task Mission',
                appLogoUrl: task.imageUrl || task.logoUrl || task.iconUrl || getTaskLogoFromLink(getAdminTaskFamily(task), getAdminTaskSubtype(task), task.taskLink),
                taskLink: task.taskLink || task.link || task.url || '',
                reward: Number(task.rate || task.reward || 0),
                userId: currentUser.uid,
                userName: currentUserData?.name || currentUser.email || 'User',
                userEmail: currentUser.email || currentUserData?.email || '',
                userMobile: currentUserData?.mobile || '',
                comment,
                commentIndex,
                status: 'reserved',
                isBulkMode: isBulkTaskUser(),
                reservedAt: Timestamp.fromMillis(now),
                expiresAt: Timestamp.fromMillis(expiresAt),
                updatedAt: serverTimestamp()
            };
            const reservationRef = doc(db, `artifacts/${appId}/public/data/task_comment_reservations`, getTaskReservationDocId(task.id, currentUser.uid));
            await setDoc(reservationRef, reservation, { merge: true });
            return { id: reservationRef.id, ...reservation, reservedAt: now, expiresAt };
        };

const getTaskLogoFromLink = (family = 'review', subtype = 'app_review', taskLink = '') => {
            const meta = getAdminTaskSubtypeMeta(family, subtype);
            const link = String(taskLink || '').trim();
            if (subtype === 'app_review' && link) {
                return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(link)}&sz=128`;
            }
            return meta.logo;
        };

const getTaskPaymentLabel = (task = {}) => {
            const mode = task.paymentMode || (Number(task.paymentDelayDays || 0) > 0 ? 'days' : 'instant');
            const days = Number(task.paymentDelayDays || task.paymentDays || 0);
            if (mode === 'days' && days > 0) return `${days}${days === 1 ? 'st' : days === 2 ? 'nd' : days === 3 ? 'rd' : 'th'} day payment`;
            return 'Instant payment';
        };

window.showScreenshotLightbox = function(url, driveUrl) {
            const existing = document.getElementById('screenshot-lightbox-overlay');
            if (existing) {
                existing.remove();
                document.body.style.overflow = '';
            }

            const overlay = document.createElement('div');
            overlay.id = 'screenshot-lightbox-overlay';
            // Enable scrolling on overlay container to make it fully responsive for small screen heights
            overlay.className = 'fixed inset-0 z-[9999] flex flex-col items-center justify-start md:justify-center bg-black/95 p-4 overflow-y-auto transition-all duration-300';
            
            // Prevent background page from scrolling
            document.body.style.overflow = 'hidden';

            const removeLightbox = () => {
                overlay.remove();
                document.body.style.overflow = '';
            };

            overlay.innerHTML = `
                <div class="w-full max-w-2xl flex flex-col items-center justify-center py-6 min-h-full" onclick="event.stopPropagation()">
                    <div class="relative max-w-full flex items-center justify-center">
                        <img src="${url}" alt="Screenshot Zoom" class="max-w-full max-h-[70vh] md:max-h-[80vh] object-contain rounded-xl border border-gray-800 shadow-2xl transition-transform duration-300 hover:scale-[1.01]">
                    </div>
                    <div class="mt-4 flex items-center gap-3 bg-gray-900/85 px-4 py-2.5 rounded-2xl border border-gray-800 backdrop-blur-md shrink-0">
                        ${driveUrl ? `<a href="${driveUrl}" target="_blank" class="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700 transition">📁 Open in Drive</a>` : ''}
                        <button id="lightbox-close-btn" class="rounded-xl bg-white text-gray-900 px-4 py-2 text-xs font-black hover:bg-gray-100 transition shadow-md">✕ Close</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            overlay.onclick = removeLightbox;
            const closeBtn = document.getElementById('lightbox-close-btn');
            if (closeBtn) {
                closeBtn.onclick = removeLightbox;
            }
        };

const loadJsPDF = () => {
            return new Promise((resolve) => {
                if (window.jspdf) {
                    resolve(window.jspdf);
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                script.onload = () => resolve(window.jspdf);
                script.onerror = () => resolve(null);
                document.head.appendChild(script);
            });
        };

const loadImage = (url) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => {
                    const img2 = new Image();
                    img2.onload = () => resolve(img2);
                    img2.onerror = () => resolve(null);
                    img2.src = url;
                };
                img.src = url;
            });
        };

window.downloadScreenshotAsJpg = async function(url, filename) {
            try {
                const res = await fetch(url);
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename || 'screenshot.jpg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            } catch (err) {
                // CORS fallback: open in tab
                window.open(url, '_blank');
            }
        };

window.downloadSubmissionsAsPdf = async function(submissions, appName, dateStr) {
            if (!submissions || submissions.length === 0) {
                showNotification("No screenshots to save.", true);
                return;
            }
            showLoading();
            try {
                const jspdfModule = await loadJsPDF();
                if (!jspdfModule) {
                    showNotification("Could not load PDF library. Please check your internet connection.", true);
                    hideLoading();
                    return;
                }
                const { jsPDF } = jspdfModule;
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt' });
                let pagesAdded = 0;

                for (let i = 0; i < submissions.length; i++) {
                    const s = submissions[i];
                    if (!s.screenshot_url) continue;
                    const img = await loadImage(s.screenshot_url);
                    if (!img) continue;

                    const w = img.naturalWidth || 600;
                    const h = img.naturalHeight || 800;
                    const targetWidth = 595.28; // Standard A4 width in pt
                    const targetHeight = targetWidth * (h / w);

                    if (pagesAdded > 0) {
                        pdf.addPage([targetWidth, targetHeight]);
                    } else {
                        pdf.deletePage(1);
                        pdf.addPage([targetWidth, targetHeight]);
                    }
                    
                    pdf.addImage(img, 'JPEG', 0, 0, targetWidth, targetHeight);
                    pagesAdded++;
                }

                if (pagesAdded === 0) {
                    showNotification("Could not load any screenshot images.", true);
                    hideLoading();
                    return;
                }

                const firstWord = appName.split(' ')[0] || 'App';
                const cleanFirstWord = firstWord.replace(/[^a-zA-Z0-9]/g, '');
                const cleanDate = dateStr.replace(/[^0-9\-]/g, '');
                const filename = `${cleanFirstWord}_${cleanDate}.pdf`;

                pdf.save(filename);
                showNotification(`PDF saved successfully as ${filename}`);
            } catch (err) {
                console.error("PDF generation failed:", err);
                showNotification("Could not generate PDF. Please try again.", true);
            } finally {
                hideLoading();
            }
        };

window.extractActualReviewText = function(ocrText, reviewerName) {
            if (!ocrText) return '';
            const cleanResult = (txt) => {
                return String(txt || '').trim().replace(/^[:\s\-–—"']+/g, '').trim();
            };
            try {
                const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
                
                // If reviewer name is known, look for it
                if (reviewerName && reviewerName !== 'Unknown User') {
                    const cleanName = reviewerName.toLowerCase().replace(/[^a-z0-9]/g, '');
                    let nameIdx = -1;
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanName)) {
                            nameIdx = i;
                            break;
                        }
                    }
                    
                    if (nameIdx !== -1) {
                        let reviewLines = [];
                        let foundStarsOrDate = false;
                        for (let j = nameIdx + 1; j < lines.length; j++) {
                            const line = lines[j];
                            const lineLower = line.toLowerCase();
                            
                            // Stop if we hit typical Play Store review metadata footer or next reviews
                            if (
                                lineLower.includes('edit your review') ||
                                lineLower.includes('was this review helpful') ||
                                lineLower.includes('developer response') ||
                                lineLower.includes('app support') ||
                                lineLower.includes('developer contact') ||
                                lineLower.includes('personal into') ||
                                lineLower.includes('personal info') ||
                                lineLower.includes('about this app') ||
                                lineLower.includes('rate this app') ||
                                lineLower.startsWith('personal') ||
                                lineLower.includes('helpfulness') ||
                                /^\d{1,2}:\d{2}/.test(line) ||
                                /^\d{1,3}%$/.test(line)
                            ) {
                                break;
                            }
                            
                            const isStarsOrDate = 
                                line.includes('★') || 
                                line.includes('☆') || 
                                lineLower.includes('stars') || 
                                /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line) ||
                                /^\d+\s+(day|week|month|year)s?\s+ago/i.test(line);
                                
                            if (isStarsOrDate && !foundStarsOrDate) {
                                foundStarsOrDate = true;
                                continue;
                            }
                            
                            reviewLines.push(line);
                        }
                        if (reviewLines.length > 0) {
                            return cleanResult(reviewLines.join('\n'));
                        }
                    }
                }
                
                // Fallback: Search for "Your review"
                let yourReviewIdx = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (/Your review/i.test(lines[i])) {
                        yourReviewIdx = i;
                        break;
                    }
                }
                
                if (yourReviewIdx !== -1) {
                    let reviewLines = [];
                    // Typically Your review -> Name -> Stars -> Text, so scan after index + 2
                    let foundStars = false;
                    for (let j = yourReviewIdx + 2; j < lines.length; j++) {
                        const line = lines[j];
                        const lineLower = line.toLowerCase();
                        if (
                            lineLower.includes('edit your review') ||
                            lineLower.includes('was this review helpful') ||
                            lineLower.includes('developer response') ||
                            lineLower.includes('app support')
                        ) {
                            break;
                        }
                        
                        const isStarsOrDate = 
                            line.includes('★') || 
                            line.includes('☆') || 
                            lineLower.includes('stars') || 
                            /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line);
                            
                        if (isStarsOrDate && !foundStars) {
                            foundStars = true;
                            continue;
                        }
                        
                        reviewLines.push(line);
                    }
                    if (reviewLines.length > 0) {
                        return cleanResult(reviewLines.join('\n'));
                    }
                }
                
                // Secondary Fallback: take the largest block of text that is not system text
                const skipPatterns = [
                    /^\d{1,2}:\d{2}/,
                    /^\d{1,3}%$/,
                    /LTE|WIFI|4G|5G|VoLTE|KB\/S/i,
                    /Google Play/i,
                    /^Search/i, /^Apps/i, /^Games/i, /^Offers/i,
                    /^Movies/i, /^Books/i,
                    /^Ratings and reviews/i,
                    /^See all reviews/i,
                    /^Post/i, /^Cancel/i,
                    /^Edit your review/i,
                    /^Edit/i,
                    /^Episode/i,
                    /^[★☆* ]+\d{1,2}/,
                    /^[0-9.]+ stars/,
                    /^[0-9.,]+ reviews/,
                    /^[0-9.]+ [KMG]B/,
                    /No reviews/i,
                    /Personal into/i,
                    /No data collected/i,
                    /Developer contact/i,
                    /About this app/i,
                    /Rate this app/i,
                    /Tell us what you think/i,
                    /Write a review/i,
                    /Safety/i, /Data privacy/i, /Security/i, /Verified/i,
                ];
                
                let bestLine = '';
                for (const line of lines) {
                    const isSystemLine = skipPatterns.some(p => p.test(line));
                    if (!isSystemLine && line.length > bestLine.length && line.length > 20) {
                        bestLine = line;
                    }
                }
                return cleanResult(bestLine);
            } catch (err) {
                console.warn('extractActualReviewText error:', err);
                return '';
            }
        };

const getSafeDate = (value) => value?.toDate ? value.toDate() : value ? new Date(value) : null;

const getUserCreatedYear = () => {
            const created = getSafeDate(currentUserData?.createdAt);
            return created ? created.getFullYear() : new Date().getFullYear();
        };

const getInvoiceGroups = () => {
            const groups = {};
            getWithdrawalTransactions().forEach(item => {
                const date = getSafeDate(item.timestamp || item.requestedAt || item.processedAt);
                if (!date) return;
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (!groups[key]) groups[key] = { year: date.getFullYear(), month: date.getMonth(), items: [], total: 0 };
                groups[key].items.push(item);
                groups[key].total += absoluteAmount(item.amount || 0);
            });
            return Object.entries(groups).map(([key, value]) => ({ key, ...value })).sort((a, b) => b.key.localeCompare(a.key));
        };

const truncatePdfText = (text = '', max = 26) => {
            const value = String(text || 'N/A');
            return value.length > max ? `${value.slice(0, max - 3)}...` : value;
        };

const getVerifiedBadge = (extraClass = '') => `
            <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center align-middle ${extraClass}" title="Verified">
                <svg class="h-full w-full block" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#1683ff" d="M12 1.35 14.05 3.55l2.95-.72.88 2.9 2.89.88-.72 2.95L22.65 12l-2.6 2.44.72 2.95-2.89.88-.88 2.9-2.95-.72L12 22.65l-2.05-2.2-2.95.72-.88-2.9-2.89-.88.72-2.95L1.35 12l2.6-2.44-.72-2.95 2.89-.88.88-2.9 2.95.72L12 1.35Z"/>
                    <path fill="none" stroke="#fff" stroke-width="2.55" stroke-linecap="round" stroke-linejoin="round" d="m7.25 12.15 3.05 3.05 6.55-6.65"/>
                </svg>
            </span>`;

const getPremiumLogoFrame = (innerHtml, sizeClass = 'h-14 w-14', extraClass = '') => `
            <div class="${sizeClass} ${extraClass} rounded-full bg-gradient-to-br from-indigo-600 via-blue-600 to-emerald-500 p-[2px] shadow-sm">
                <div class="h-full w-full rounded-full bg-white dark:bg-gray-900 p-[5px] flex items-center justify-center overflow-hidden">
                    ${innerHtml}
                </div>
            </div>`;

const renderMessageTicks = (message, isMine, viewerRole) => {
            if (!isMine) return '';
            const isReadByOppositeSide = !!message.readAt;
            const tickClass = isReadByOppositeSide ? 'text-blue-500' : 'text-gray-400';
            return `<span class="${tickClass} font-bold tracking-[-3px] ml-1">✓✓</span>`;
        };

const normalizeBackendMessage = (message) => ({
            id: message.id || `${message.roomId || message.room_id || activeSupportRoomId}-${message.timestamp || message.createdAt || Date.now()}-${message.senderId || message.sender_id || ''}`,
            roomId: message.roomId || message.room_id || activeSupportRoomId,
            text: message.message || message.text || '',
            senderId: message.senderId || message.sender_id || '',
            senderRole: (message.senderId || message.sender_id) === ADMIN_UID ? 'admin' : 'user',
            createdAt: message.timestamp || message.createdAt || Date.now(),
            readAt: message.readAt
                || ((message.senderId || message.sender_id) === ADMIN_UID
                    ? (message.readByUserAt || message.read_by_user_at)
                    : (message.readByAdminAt || message.read_by_admin_at))
                || null,
            clientMessageId: message.clientMessageId || message.client_message_id || null
        });

const getNextMonthRepaymentDate = (fromDate = new Date()) => {
            const year = fromDate.getFullYear();
            const month = fromDate.getMonth();
            const day = fromDate.getDate();
            const daysInNextMonth = new Date(year, month + 2, 0).getDate();
            return new Date(year, month + 1, Math.min(day, daysInNextMonth), 23, 59, 59);
        };

const addMonthsClamped = (date, months) => {
            const start = new Date(date);
            const day = start.getDate();
            const target = new Date(start.getFullYear(), start.getMonth() + months + 1, 0);
            return new Date(start.getFullYear(), start.getMonth() + months, Math.min(day, target.getDate()), 23, 59, 59);
        };

const addDays = (date, days) => {
            const next = new Date(date);
            next.setDate(next.getDate() + days);
            return next;
        };

const toDate = (value) => value?.toDate ? value.toDate() : value ? new Date(value) : null;

const getValidDateFromMillis = (millis) => millis ? new Date(millis) : null;

const runAfterFirstPaint = (callback) => {
            const run = () => setTimeout(callback, 0);
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(run);
            } else {
                run();
            }
        };

const getPendingSignupUsers = () => {
    let list = allUsersCache.filter(u => !isAdminUserRecord(u) && isUserApprovalPending(u));
    if (currentUserData?.role === 'admin') {
        list = list.filter(u => u.parentAdmin === currentUser.uid || u.parent_admin === currentUser.uid);
    }
    return list;
};

const isNewSignupUser = (user = {}) =>
            user.signupSource === 'web' ||
            user.signup_source === 'web' ||
            user.webAppUpdatedOn === WEB_APP_UPDATE_DATE ||
            user.web_app_updated_on === WEB_APP_UPDATE_DATE ||
            !!(user.webAppBuild || user.web_app_build || user.webAppLastSeenAt || user.web_app_last_seen_at);

const getSignupUserCategory = (user = {}) => isNewSignupUser(user) ? 'New Web User' : 'Old User';

const handleSignupApprovalAction = async (userId, action) => {
            if (currentUser?.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
            try {
                // Optimistically update the cache and re-render the list immediately
                allUsersCache = allUsersCache.map(user => {
                    if ((user.id || user.uid) !== userId) return user;
                    return {
                        ...user,
                        approvalStatus: action === 'approve' ? 'approved' : 'rejected',
                        accountStatus: action === 'approve' ? 'active' : 'rejected',
                        signupApprovalStatus: action === 'approve' ? 'approved' : 'rejected',
                        isApproved: action === 'approve',
                        ...(action === 'cancel' ? { isFlagged: true, isDisabled: true } : {})
                    };
                });
                showAdminSignupApprovalsPage();

                if (action === 'approve') {
                    await updateDoc(userRef, {
                        approvalStatus: 'approved',
                        accountStatus: 'active',
                        signupApprovalStatus: 'approved',
                        isApproved: true,
                        approvedAt: serverTimestamp(),
                        approvedBy: currentUser.uid
                    });
                    showNotification('User signup approved.');
                } else {
                    await updateDoc(userRef, {
                        approvalStatus: 'rejected',
                        accountStatus: 'rejected',
                        signupApprovalStatus: 'rejected',
                        isApproved: false,
                        isFlagged: true,
                        isDisabled: true,
                        approvalRejectionReason: 'Account creation cancelled by admin.',
                        rejectedAt: serverTimestamp(),
                        rejectedBy: currentUser.uid
                    });
                    showNotification('User signup cancelled.');
                }
                refreshAdminDashboardCaches().catch(error => console.warn('Admin cache refresh skipped:', error));
            } catch (error) {
                console.error('Signup approval action failed:', error);
                showNotification(`Could not update signup: ${error.message}`, true);
                // Trigger a full refresh from Firestore on error to reset the optimistic state
                refreshAdminDashboardCaches().catch(error => console.warn('Revert cache refresh failed:', error));
            }
        };

const uploadFileWithProgress = (ref, file, metadata, label, onProgress = () => {}) => new Promise((resolve, reject) => {
            const uploadTask = uploadBytesResumable(ref, file, metadata);
            uploadTask.on('state_changed', (snapshot) => {
                const total = Number(snapshot.totalBytes || 0);
                const transferred = Number(snapshot.bytesTransferred || 0);
                if (total > 0) {
                    onProgress(Math.max(1, Math.min(99, Math.round((transferred / total) * 100))));
                }
            }, (error) => {
                reject(new Error(getLoanUploadErrorMessage(error, label)));
            }, () => {
                onProgress(100);
                resolve(uploadTask.snapshot);
            });
        });

const escapePdfText = (text = '') => String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const formatPdfCurrency = (amount = 0) => `Rs. ${Number(amount || 0).toFixed(2)}`;

const createSimplePdf = (lines) => {
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

            const content = [
                'BT',
                '/F2 20 Tf',
                '50 790 Td',
                `(${escapePdfText(lines.title)}) Tj`,
                '/F1 10 Tf',
                '0 -24 Td',
                ...lines.body.map(line => `(${escapePdfText(line)}) Tj 0 -18 Td`),
                'ET'
            ].join('\n');
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

const handleFindRecipient = async () => {
            if (currentUserData.isFlagged) {
                return showNotification('Your account is flagged. Please contact support.', true);
            }
            const findBtn = document.getElementById('find-recipient-btn');
            const recipientMobile = document.getElementById('recipient-mobile-input').value.trim().replace(/\D/g, '');
            const amount = parseFloat(document.getElementById('pay-amount-input').value);
            const comment = document.getElementById('pay-comment-input').value.trim();

            if (!recipientMobile) {
                return showNotification('Please enter recipient mobile number.', true);
            }

            if (isNaN(amount) || amount < 1) {
                return showNotification('Minimum amount to send is ₹1.', true);
            }

            // Check if user has sufficient balance
            if (!currentUserData || getSpendableWalletBalance(currentUserData) < amount) {
                return showNotification(getInsufficientWalletMessage(currentUserData), true);
            }

            try {
                if (findBtn) {
                    findBtn.disabled = true;
                    findBtn.textContent = 'Finding...';
                }

                let recipientData = recipientLookupCache.get(recipientMobile);
                if (!recipientData) {
                    const recipientQuery = query(
                        collection(db, `artifacts/${appId}/public/data/users`),
                        where("mobile", "==", recipientMobile)
                    );
                    const recipientSnap = await getDocs(recipientQuery);

                    if (recipientSnap.empty) {
                        return showNotification('Recipient mobile number not found in our system.', true);
                    }

                    recipientData = { uid: recipientSnap.docs[0].id, ...recipientSnap.docs[0].data() };
                    recipientLookupCache.set(recipientMobile, recipientData);
                }

                // Don't allow sending to yourself
                if (recipientData.uid === currentUser.uid) {
                    return showNotification('You cannot send money to yourself.', true);
                }

                // Show confirmation modal
                renderModal('Confirm Payment details',
                    `<div class="space-y-4">
                       
                        <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600 dark:text-gray-300">User:</span>
                               <span class="font-semibold flex items-center">
    ${recipientData.name || 'N/A'}
    ${recipientData.name && recipientData.name.toLowerCase().includes('reviews world') ? `
        <svg class="w-4 h-4 inline-block text-blue-500 fill-current ml-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.7 4.8l-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6z"/>
        </svg>
    ` : ''}
</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600 dark:text-gray-300">Mobile:</span>
                                <span class="font-semibold">${recipientData.mobile || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600 dark:text-gray-300">Email:</span>
                                <span class="font-semibold">${(recipientData.email || 'N/A').split('@')[0]}</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600 dark:text-gray-300">Amount:</span>
                                <span class="font-semibold">${formatCurrency(amount)}</span>
                            </div>
                            ${comment ? `
                            <div class="flex justify-between">
                                <span class="text-gray-600 dark:text-gray-300">Remarks:</span>
                                <span class="font-semibold">${comment}</span>
                            </div>` : ''}
                            <div class="flex justify-between mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                                <span class="text-gray-600 dark:text-gray-300">Your Balance After:</span>
                                <span class="font-semibold">${formatCurrency(getSpendableWalletBalance(currentUserData) - amount)}</span>
                            </div>
                        </div>
                        <p class="text-sm text-gray-500 dark:text-gray-400 text-center">This transaction cannot be undone.</p>
                    </div>`,
                    `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                     <button id="final-pay-btn" class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg">Confirm & Send</button>`,
                    'max-w-md', true
                );

                document.getElementById('final-pay-btn').onclick = () => {
                    handlePayToWallet(recipientData, amount, comment);
                };

            } catch (e) {
                console.error("Find recipient failed:", e);
                showNotification(`Error: ${e.message}`, true);
            } finally {
                if (findBtn) {
                    findBtn.disabled = false;
                    findBtn.textContent = 'Find Recipient';
                }
            }
        };

const handlePayToWallet = async (recipientData, amount, comment) => {
            if (!preventDuplicateRequest('pay-to-wallet')) return;

            const btn = document.getElementById('final-pay-btn');
            const coolDownKey = `${recipientData.uid}-${amount}`;
            window.lastTransferTimeMap = window.lastTransferTimeMap || new Map();
            const lastTransfer = window.lastTransferTimeMap.get(coolDownKey) || 0;
            if (Date.now() - lastTransfer < 60000) {
                showNotification("Duplicate transfer detected. Please wait 60 seconds before sending the same amount to the same user again.", true);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Confirm & Send';
                }
                pendingRequests.delete('pay-to-wallet');
                return;
            }

            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="flex items-center justify-center"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...</span>';
            }

            try {
                const senderTxnId = generateTransactionId();
                const recipientTxnId = generateTransactionId();
                let senderCloudTxn = null;
                let recipientCloudTxn = null;
                await runTransaction(db, async (tx) => {
                    // Get sender and recipient documents
                    const senderRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                    const recipientRef = doc(db, `artifacts/${appId}/public/data/users`, recipientData.uid);

                    const senderDoc = await tx.get(senderRef);
                    const recipientDoc = await tx.get(recipientRef);

                    if (!senderDoc.exists() || !recipientDoc.exists()) {
                        throw new Error("User accounts not found!");
                    }

                    const senderBalance = senderDoc.data().balance || 0;
                    const recipientBalance = recipientDoc.data().balance || 0;

                    // Check if sender has sufficient balance
                    if (getSpendableWalletBalance(senderDoc.data()) < amount) {
                        throw new Error(getInsufficientWalletMessage(senderDoc.data()));
                    }

                    // Update balances
                    tx.update(senderRef, { balance: senderBalance - amount });
                    tx.update(recipientRef, { balance: recipientBalance + amount });

                    // Add transaction records for both users with proper details
                    const senderComment = comment || `Sent to ${recipientData.name || recipientData.mobile}`;
                    const recipientComment = comment || `Received from ${currentUserData.name || currentUser.email}`;

                    // Generate transaction IDs
                    senderCloudTxn = {
                        type: 'debit',
                        amount,
                        comment: senderComment,
                        timestamp: Date.now(),
                        recipientName: recipientData.name,
                        recipientMobile: recipientData.mobile,
                        recipientIsProProfile: !!recipientData.isProProfile,
                        senderName: currentUserData.name,
                        senderMobile: currentUserData.mobile,
                        senderIsProProfile: !!currentUserData.isProProfile,
                        transactionId: senderTxnId,
                        balanceBefore: senderBalance,
                        balanceAfter: senderBalance - amount,
                        status: 'completed'
                    };
                    recipientCloudTxn = {
                        type: 'wallet_transfer',
                        amount,
                        comment: recipientComment,
                        timestamp: Date.now(),
                        senderName: currentUserData.name,
                        senderMobile: currentUserData.mobile,
                        senderIsProProfile: !!currentUserData.isProProfile,
                        recipientName: recipientData.name,
                        recipientMobile: recipientData.mobile,
                        recipientIsProProfile: !!recipientData.isProProfile,
                        transactionId: recipientTxnId,
                        balanceBefore: recipientBalance,
                        balanceAfter: recipientBalance + amount,
                        status: 'completed'
                    };

                    // For sender - debit transaction with recipient details
                    tx.set(doc(collection(senderRef, 'transactions')), {
                        type: 'debit',
                        amount,
                        comment: senderComment,
                        timestamp: serverTimestamp(),
                        recipientName: recipientData.name,
                        recipientMobile: recipientData.mobile,
                        recipientIsProProfile: !!recipientData.isProProfile,
                        senderName: currentUserData.name,
                        senderMobile: currentUserData.mobile,
                        senderIsProProfile: !!currentUserData.isProProfile,
                        transactionId: senderTxnId,
                        balanceBefore: senderBalance,
                        balanceAfter: senderBalance - amount,
                        status: 'completed'
                    });

                    // For recipient - wallet transfer (credit) with sender details
                    tx.set(doc(collection(recipientRef, 'transactions')), {
                        type: 'wallet_transfer',
                        amount,
                        comment: recipientComment,
                        timestamp: serverTimestamp(),
                        senderName: currentUserData.name,
                        senderMobile: currentUserData.mobile,
                        senderIsProProfile: !!currentUserData.isProProfile,
                        recipientName: recipientData.name,
                        recipientMobile: recipientData.mobile,
                        recipientIsProProfile: !!recipientData.isProProfile,
                        transactionId: recipientTxnId,
                        balanceBefore: recipientBalance,
                        balanceAfter: recipientBalance + amount,
                        status: 'completed'
                    });
                });

                currentUserData = {
                    ...(currentUserData || {}),
                    balance: Math.max(0, Number(currentUserData?.balance || 0) - amount)
                };
                document.getElementById('user-balance').textContent = formatCompactBalance(currentUserData.balance);
                updateDollarBalanceDisplay(currentUserData.balance);
                writeJsonCache(getUserCacheKey(currentUser.uid), sanitizeUserForCache(currentUserData, currentUser.uid));
                const instantTransaction = addInstantTransactionToHistory(currentUser.uid, senderCloudTxn);
                Promise.allSettled([
                    recordCloudTransfer(senderCloudTxn, recipientCloudTxn, recipientData.uid),
                    syncRecentTransactionsToCloud(currentUser.uid)
                ]).catch(error => console.warn('Pay to wallet background sync failed:', error));
                window.lastTransferTimeMap = window.lastTransferTimeMap || new Map();
                window.lastTransferTimeMap.set(`${recipientData.uid}-${amount}`, Date.now());
                showNotification(`Success! Sent ${formatCurrency(amount)} to ${recipientData.name || recipientData.mobile}`, false, true);
                window.closeModal();
                showTransactionDetails(instantTransaction?.key || senderTxnId);
            } catch (e) {
                console.error("Pay to wallet failed:", e);
                showNotification(`Transaction failed: ${e.message}`, true);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Confirm & Send';
                }
            } finally {
                pendingRequests.delete('pay-to-wallet');
            }
        };

const handleCopyText = async (text, button) => {
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
                const originalContent = button.innerHTML;
                button.innerHTML = '<span class="text-[10px] text-green-500 font-bold">Copied!</span>';
                setTimeout(() => { button.innerHTML = originalContent; }, 2000);
            } catch (err) {
                console.error('Failed to copy!', err);
                showNotification('Failed to copy text.', true);
            }
        };

const handleCopyUpi = async (upiId, button) => {
            const ta = document.createElement('textarea');
            ta.value = upiId;
            ta.style.position = 'absolute';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                button.textContent = 'Copied!';
                setTimeout(() => { button.textContent = 'Copy'; }, 2000);
            } catch (err) {
                console.error('Failed to copy!', err);
                showNotification('Failed to copy UPI ID.', true);
            }
            document.body.removeChild(ta);
        };

const handleRequestAction = (userId, requestId, newStatus) => {
            if (newStatus === 'completed') {
                const reqData = allFundRequestsCache.find(r => r.id === requestId);
                if (!reqData) return showNotification('Error: Request not found.', true);

                renderModal('Confirm Payment',
                    `<div class="space-y-4">
                        <p class="mb-2">Enter the Transaction ID after sending ${formatCurrency(reqData.amount)} to ${reqData.userName}.</p>
                        <div class="space-y-2">
                            <input type="text" id="admin-tx-id-input" placeholder="Enter Transaction ID" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <p class="text-xs text-gray-500 dark:text-gray-400">This transaction ID will be shown to the user as proof of payment.</p>
                        </div>
                    </div>`,
                    `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                     <button id="modal-confirm-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Confirm & Approve</button>`,
                    'max-w-md'
                );
                document.getElementById('modal-confirm-btn').onclick = () => {
                    const txnId = document.getElementById('admin-tx-id-input').value.trim();
                    if (!txnId) return showNotification('Transaction ID is required.', true);
                    const btn = document.getElementById('modal-confirm-btn');
                    if (btn) {
                        btn.disabled = true;
                        btn.textContent = 'Approving...';
                    }
                    window.closeModal();
                    proceedWithRequestAction(userId, requestId, newStatus, txnId, reqData);
                };
            } else if (newStatus === 'rejected') {
                renderModal('Reject Withdrawal Request',
                    `<div class="space-y-4">
                        <p class="font-semibold text-red-500">Are you sure you want to reject this request?</p>
                        <div class="space-y-2">
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Rejection Reason</label>
                            <textarea id="rejection-reason-input" placeholder="Enter reason for rejection (this will be shown to the user)" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" rows="3"></textarea>
                            <p class="text-xs text-gray-500 dark:text-gray-400">This reason will be visible to the user in their transaction history.</p>
                        </div>
                    </div>`,
                    `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                     <button id="confirm-action-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Reject Request</button>`,
                    'max-w-md'
                );
                document.getElementById('confirm-action-btn').onclick = () => {
                    const rejectionReason = document.getElementById('rejection-reason-input').value.trim();
                    if (!rejectionReason) {
                        return showNotification('Please provide a rejection reason.', true);
                    }
                    const btn = document.getElementById('confirm-action-btn');
                    if (btn) {
                        btn.disabled = true;
                        btn.textContent = 'Rejecting...';
                    }
                    window.closeModal();
                    proceedWithRequestAction(userId, requestId, newStatus, null, null, rejectionReason);
                };
            }
        };

const proceedWithRequestAction = async (userId, requestId, newStatus, txnId, reqData, rejectionReason = '') => {
            let processedAmount = reqData?.amount || 0;
            try {
                const reqRef = doc(db, `artifacts/${appId}/public/data/fund_requests`, requestId);
                let requestData = reqData || allFundRequestsCache.find(r => r.id === requestId) || {};
                const amount = Number(requestData.amount || 0);
                processedAmount = amount;
                if (newStatus === 'completed' && shouldDeductLegacyWithdrawal(requestData)) {
                    requestData = await applyLegacyWithdrawalDeduction(userId, requestId, requestData);
                }
                const withdrawalSnapshot = getWithdrawalSnapshot(requestData);
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                const requestBalanceBefore = Number(requestData.balanceBefore ?? requestData.balance_before);
                const requestBalanceAfter = Number(requestData.balanceAfter ?? requestData.balance_after);
                const balanceWasDeducted = isWithdrawalBalanceDeducted(requestData);
                const transactionBalanceBefore = Number.isFinite(requestBalanceBefore) ? requestBalanceBefore : null;
                const transactionBalanceAfter = newStatus === 'rejected'
                    ? (balanceWasDeducted && Number.isFinite(requestBalanceBefore) ? requestBalanceBefore : null)
                    : (Number.isFinite(requestBalanceAfter) ? requestBalanceAfter : null);
                const requestedAt = requestData.requestedAt || requestData.requested_at || requestData.timestamp || requestData.createdAt || Date.now();
                const processedAt = Date.now();
                const transactionPayload = {
                    type: 'withdrawal',
                    amount,
                    timestamp: requestedAt,
                    requestedAt,
                    status: newStatus === 'completed' ? 'completed' : 'rejected',
                    requestId,
                    transactionId: txnId || generateTransactionId(),
                    adminTransactionId: txnId || '',
                    rejectionReason: rejectionReason || '',
                    comment: newStatus === 'completed' ? 'Payment by Reviews World' : `Withdrawal Rejected: ${rejectionReason}`,
                    processedAt,
                    ...withdrawalSnapshot,
                    ...(transactionBalanceBefore !== null ? { balanceBefore: transactionBalanceBefore } : {}),
                    ...(transactionBalanceAfter !== null ? { balanceAfter: transactionBalanceAfter } : {})
                };

                if (newStatus === 'completed') {
                    await updateDoc(reqRef, {
                        status: newStatus,
                        processedAt: serverTimestamp(),
                        requestedAt,
                        adminTransactionId: txnId,
                        ...(transactionBalanceBefore !== null ? { balanceBefore: transactionBalanceBefore } : {}),
                        ...(transactionBalanceAfter !== null ? { balanceAfter: transactionBalanceAfter } : {}),
                        balanceDeducted: balanceWasDeducted
                    });
                } else {
                    await updateDoc(reqRef, {
                        status: newStatus,
                        processedAt: serverTimestamp(),
                        requestedAt,
                        rejectionReason: rejectionReason,
                        ...(transactionBalanceBefore !== null ? { balanceBefore: transactionBalanceBefore } : {}),
                        ...(transactionBalanceAfter !== null ? { balanceAfter: transactionBalanceAfter } : {}),
                        balanceDeducted: balanceWasDeducted
                    });
                    if (balanceWasDeducted) {
                        await updateDoc(userRef, { balance: increment(amount) });
                    }
                }
                await setDoc(doc(collection(userRef, 'transactions'), getSafeTransactionDocId(`withdrawal-${requestId}`)), transactionPayload, { merge: true });
                if (newStatus === 'completed') {
                    startLoanRepaymentAfterWithdrawalApproval(userId, processedAt)
                        .catch(error => console.warn('Loan repayment start update skipped:', error));
                }

                if (currentUser?.uid && currentUser.uid !== ADMIN_UID) {
                    if (newStatus === 'completed') {
                        if (typeof trackSubAdminActivity === 'function') {
                            trackSubAdminActivity('withdraw_approved', amount, currentUser.uid);
                        }
                    } else if (newStatus === 'rejected') {
                        if (typeof trackSubAdminActivity === 'function') {
                            trackSubAdminActivity('withdraw_rejected', amount, currentUser.uid);
                        }
                    }
                }

                const processedRequest = {
                    ...(requestData || {}),
                    id: requestId,
                    requestId,
                    request_id: requestData?.request_id || requestId,
                    status: newStatus,
                    requestedAt,
                    processedAt,
                    amount: processedAmount
                };
                markFundRequestLocallyProcessed(processedRequest);
                allFundRequestsCache = allFundRequestsCache.filter(req => !isFundRequestLocallyProcessed(req));
                renderAdminFundRequests(allFundRequestsCache);
                updateAdminPendingRequestSummary();
                showNotification(`Success! Request has been ${newStatus}.`);

                const cloudSyncPromise = updateCloudFundRequestStatus(requestId, newStatus, {
                    ...(requestData || {}),
                    status: newStatus,
                    adminTransactionId: txnId || '',
                    rejectionReason,
                    requestedAt,
                    processedAt,
                    amount: processedAmount,
                    ...(transactionBalanceBefore !== null ? { balanceBefore: transactionBalanceBefore } : {}),
                    ...(transactionBalanceAfter !== null ? { balanceAfter: transactionBalanceAfter } : {}),
                    balanceDeducted: balanceWasDeducted
                }).catch(error => {
                    console.warn('Withdrawal cloud status background sync skipped:', error);
                });
                syncRecentTransactionsToCloud(userId).catch(error => console.warn('Withdraw transaction background sync skipped:', error));
                if (currentUser?.uid && currentUser.uid !== userId) {
                    unifiedHistoryCache = readHistoryItemsFromCache(currentUser.uid);
                }
                notifyWithdrawalStatus({
                    userId,
                    status: newStatus,
                    amount: processedAmount,
                    txnId: transactionPayload.transactionId,
                    requestId,
                    rejectionReason,
                    processedAt
                });
                cloudSyncPromise
                    .then(() => refreshAdminFundRequestsFromCloud())
                    .catch(error => console.warn('Pending withdrawal refresh skipped:', error));
                window.closeModal();
            } catch (e) {
                console.error("Request action failed:", e);
                showFriendlyError('Could not update withdrawal request. Please try again.');
                window.closeModal();
            }
        };

const handleDeleteUser = (userId, userName) => {
            renderModal('Disable User',
                `<div class="space-y-4">
                    <p class="text-red-600 font-semibold">This will block the user from using the wallet.</p>
                    <p>Are you sure you want to disable <strong>${escapeHtml(userName)}</strong>?</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Financial records, transaction history, invoices, and wallet audit data will be preserved.</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-action-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Disable User</button>`,
                'max-w-md'
            );
            document.getElementById('confirm-action-btn').onclick = async () => {
                try {
                    const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                    await updateDoc(userRef, {
                        isFlagged: true,
                        isDisabled: true,
                        disabledAt: serverTimestamp(),
                        disabledBy: currentUser.uid,
                        banReason: 'Account disabled by admin. Financial records retained for audit.'
                    });
                    showNotification('User disabled. Transaction history was preserved.');
                    refreshAdminDashboardCaches().catch(error => console.error('Admin cache refresh failed:', error));
                    window.closeModal();
                } catch (e) {
                    console.error("Disable user failed:", e);
                    showNotification(`Error disabling user: ${e.message}`, true);
                }
            };
        };

const showEditUserBalanceModal = (userId) => {
            const user = allUsersCache.find(u => u.id === userId);
            if (!user) return showNotification('Error: User not found.', true);
            const currentBalance = Number.isFinite(Number(user.balance)) ? Number(user.balance) : getUserAvailableBalance(user);

            const content = `
                <div class="space-y-4">
                    <p class="text-sm">Editing balance for:</p>
                    <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                        <p class="font-semibold">${user.name || 'No Name'}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${user.email}</p>
                    </div>
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Current Balance:</label>
                        <input type="text" value="${formatCurrency(currentBalance)}" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-not-allowed" readonly>
                    </div>
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">New Balance:</label>
                        <input type="number" id="edit-balance-input" step="0.01" placeholder="Enter new total balance (e.g., -50.00)" class="w-full px-4 py-2 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value="${currentBalance}">
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">This will SET the user's total wallet balance. Negative balance is allowed and future credits will recover it automatically.</p>
                </div>`;
            const actions = `
                <button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                <button id="modal-submit-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Set New Balance</button>`;

            renderModal('Edit User Balance', content, actions, 'max-w-md');

            document.getElementById('modal-submit-btn').onclick = () => {
                handleEditUserBalance(userId);
            };
        };

const handleEditUserBalance = async (userId) => {
            const newBalanceInput = document.getElementById('edit-balance-input').value;

            if (newBalanceInput === '' || isNaN(parseFloat(newBalanceInput))) {
                return showNotification('Please enter a valid number for the new balance.', true);
            }

            const newBalance = parseFloat(newBalanceInput);

            const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);

            try {
                let transactionPayload = null;
                await runTransaction(db, async (tx) => {
                    const freshUserDoc = await tx.get(userRef);
                    if (!freshUserDoc.exists()) throw new Error('User not found!');
                    const userData = freshUserDoc.data();
                    const oldBalance = Number.isFinite(Number(userData.balance)) ? Number(userData.balance) : getUserAvailableBalance(userData);
                    const changeAmount = Number((newBalance - oldBalance).toFixed(2));
                    if (changeAmount === 0) throw new Error('NO_BALANCE_CHANGE');
                    transactionPayload = {
                        type: changeAmount > 0 ? 'credit' : 'debit',
                        amount: Math.abs(changeAmount),
                        comment: changeAmount > 0 ? 'Admin Balance Credit' : 'Admin Balance Debit',
                        timestamp: serverTimestamp(),
                        adminComment: "Manual balance adjustment",
                        transactionId: generateTransactionId(),
                        balanceBefore: oldBalance,
                        balanceAfter: newBalance,
                        status: 'completed',
                        senderName: changeAmount > 0 ? 'REVIEWS WORLD' : (userData.name || 'User'),
                        senderMobile: changeAmount > 0 ? 'Admin Wallet' : (userData.mobile || ''),
                        recipientName: changeAmount > 0 ? (userData.name || 'User') : 'REVIEWS WORLD',
                        recipientMobile: changeAmount > 0 ? (userData.mobile || '') : 'Admin Wallet',
                        recipientIsProProfile: changeAmount > 0 ? !!userData.isProProfile : true,
                        mode: changeAmount > 0 ? 'Admin Credit' : 'Admin Debit',
                        isAdminTransaction: true
                    };
                    tx.update(userRef, { balance: newBalance });
                    tx.set(doc(collection(userRef, 'transactions'), getSafeTransactionDocId(transactionPayload.transactionId)), transactionPayload, { merge: true });
                });
                recordCloudTransaction(userId, { ...transactionPayload, timestamp: Date.now() }).catch(error => {
                    console.warn('Admin balance adjustment cloud history skipped:', error);
                });

                allUsersCache = allUsersCache.map(u => u.id === userId ? { ...u, balance: newBalance } : u);
                if (currentUserData?.uid === userId) {
                    currentUserData.balance = newBalance;
                    document.getElementById('user-balance').textContent = formatCompactBalance(newBalance);
                    updateDollarBalanceDisplay(newBalance);
                    writeUserCache(userId, currentUserData);
                }

                showNotification('User balance updated successfully!', false, true);
                window.closeModal();
                if (document.getElementById('admin-users-list-page')) updateAdminUserListView();
            } catch (e) {
                if (e.message === 'NO_BALANCE_CHANGE') {
                    return showNotification("New balance is the same as the old balance.", true);
                }
                console.error("Edit balance failed:", e);
                showFriendlyError('Could not update balance. Please try again.');
            }
        };

const handleToggleProUser = (userId, currentlyPro) => {
            const user = allUsersCache.find(u => u.id === userId);
            if (!user) return showNotification('Error: User not found.', true);

            const action = currentlyPro ? 'Remove Pro Verification' : 'Make Pro Verified';
            const content = `
                <div class="space-y-4">
                    <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                        <p class="font-semibold">${user.name || 'No Name'}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${user.email || ''}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${user.mobile || ''}</p>
                    </div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        ${currentlyPro
                    ? 'This user will go back to normal initials in transaction details.'
                    : 'This user will show the Reviews World logo and verified badge in transaction details.'}
                    </p>
                </div>`;

            renderModal(action, content,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-pro-btn" class="px-4 py-2 text-sm ${currentlyPro ? 'bg-gray-700' : 'bg-blue-600'} text-white rounded-lg">${currentlyPro ? 'Remove Pro' : 'Make Pro'}</button>`,
                'max-w-md'
            );

            document.getElementById('confirm-pro-btn').onclick = async () => {
                try {
                    const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                    await updateDoc(userRef, {
                        isProProfile: !currentlyPro,
                        proProfileUpdatedAt: serverTimestamp()
                    });
                    showNotification(currentlyPro ? 'Pro verification removed.' : 'User promoted to pro verified.');
                    window.closeModal();
                } catch (e) {
                    console.error('Toggle pro user failed:', e);
                    showNotification(`Error: ${e.message}`, true);
                }
            };
        };

const handlePromoteUserTaskTier = (userId, currentTier) => {
            const user = allUsersCache.find(u => u.id === userId);
            if (!user) return showNotification('Error: User not found.', true);
            renderModal('Set User Task Tier',
                `<div class="space-y-4">
                    <div class="rounded-xl bg-gray-100 p-3 dark:bg-gray-700">
                        <p class="font-semibold">${escapeHtml(user.name || 'No Name')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-300">${escapeHtml(user.email || '')}</p>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-300">Select the task submission tier for this user:</p>
                    <div class="space-y-2">
                        <label class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600">
                            <input type="radio" name="promote-tier" value="single" ${currentTier === 'single' ? 'checked' : ''}>
                            <div class="text-left">
                                <p class="text-sm font-bold">Single User (Normal)</p>
                                <p class="text-[10px] text-gray-400">Can submit 1 screenshot. Card disappears immediately.</p>
                            </div>
                        </label>
                        <label class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600">
                            <input type="radio" name="promote-tier" value="bulker" ${currentTier === 'bulker' ? 'checked' : ''}>
                            <div class="text-left">
                                <p class="text-sm font-bold">Bulker</p>
                                <p class="text-[10px] text-gray-400">Can upload multiple screenshots. Card remains until midnight.</p>
                            </div>
                        </label>
                        <label class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-600">
                            <input type="radio" name="promote-tier" value="super_bulker" ${currentTier === 'super_bulker' ? 'checked' : ''}>
                            <div class="text-left">
                                <p class="text-sm font-bold">Super Bulker</p>
                                <p class="text-[10px] text-gray-400">Can upload multiple screenshots. Card remains until midnight.</p>
                            </div>
                        </label>
                    </div>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-set-tier-btn" class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg">Save Tier</button>`,
                'max-w-md'
            );
            document.getElementById('confirm-set-tier-btn').onclick = async () => {
                const selectedTier = document.querySelector('input[name="promote-tier"]:checked')?.value || 'single';
                try {
                    const isBulk = selectedTier === 'bulker' || selectedTier === 'super_bulker';
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, userId), {
                        taskTier: selectedTier,
                        bulkTaskMode: isBulk, // backwards compatibility
                        bulkTaskModeUpdatedAt: serverTimestamp(),
                        bulkTaskModeUpdatedBy: currentUser.uid
                    });
                    allUsersCache = allUsersCache.map(item => item.id === userId ? { ...item, taskTier: selectedTier, bulkTaskMode: isBulk } : item);
                    if (document.getElementById('admin-users-list-page')) updateAdminUserListView();
                    window.closeModal();
                    showNotification(`User promoted to ${selectedTier.toUpperCase()}.`);
                } catch (error) {
                    console.error('Update task tier failed:', error);
                    showNotification(`Error: ${error.message}`, true);
                }
            };
        };

const handleFlagUser = async (userId, currentlyFlagged) => {
            const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
            if (currentlyFlagged) {
                try {
                    await updateDoc(userRef, {
                        isFlagged: false,
                        isDisabled: false,
                        banReason: deleteField(),
                        banExpiry: deleteField(),
                        disabledAt: deleteField(),
                        disabledBy: deleteField()
                    });
                    allUsersCache = allUsersCache.map(u => u.id === userId ? {
                        ...u,
                        isFlagged: false,
                        isDisabled: false,
                        banReason: undefined,
                        banExpiry: undefined,
                        disabledAt: undefined,
                        disabledBy: undefined
                    } : u);
                    applyAdminUsersCache(allUsersCache);
                    updateAdminUserListView();
                    showNotification('User unflagged successfully!');
                } catch (e) {
                    console.error("Unflag user failed:", e);
                    showNotification(`Error: ${e.message}`, true);
                }
                return;
            }

            const action = currentlyFlagged ? 'Unban' : 'Ban/Suspend';
            const content = `
                <div class="space-y-4">
                    <p class="${currentlyFlagged ? 'text-blue-600' : 'text-red-600'} font-semibold">
                        ${currentlyFlagged ? 'Are you sure you want to unban this user?' : 'Are you sure you want to ban this user?'}
                    </p>
                    ${!currentlyFlagged ? `
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Reason for Ban</label>
                            <textarea id="ban-reason-input" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm" placeholder="e.g. Fraudulent activity, Suspicious transfers..."></textarea>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase mb-1">Duration (Days, optional)</label>
                            <input type="number" id="ban-duration-input" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm" placeholder="Leave empty for permanent">
                        </div>
                    ` : ''}
                </div>`;

            renderModal(`${action} User`, content,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-flag-btn" class="px-4 py-2 text-sm ${currentlyFlagged ? 'bg-blue-600' : 'bg-red-600'} text-white rounded-lg">Confirm ${action}</button>`,
                'max-w-md'
            );

            document.getElementById('confirm-flag-btn').onclick = async () => {
                try {
                    let updateData = { isFlagged: !currentlyFlagged };

                    if (!currentlyFlagged) {
                        const reason = document.getElementById('ban-reason-input').value.trim() || 'No reason provided';
                        const duration = parseInt(document.getElementById('ban-duration-input').value);

                        updateData.banReason = reason;
                        updateData.isDisabled = true;
                        updateData.disabledAt = serverTimestamp();
                        updateData.disabledBy = currentUser.uid;
                        if (!isNaN(duration) && duration > 0) {
                            const expiryDate = new Date();
                            expiryDate.setDate(expiryDate.getDate() + duration);
                            updateData.banExpiry = Timestamp.fromDate(expiryDate);
                        } else {
                            updateData.banExpiry = null; // Permanent
                        }

                        // Automatically cancel all pending withdrawals for this user
                        const q = query(
                            collection(db, `artifacts/${appId}/public/data/fund_requests`),
                            where("userId", "==", userId),
                            where("status", "==", "pending")
                        );
                        const snap = await getDocs(q);
                        for (const d of snap.docs) {
                            await proceedWithRequestAction(userId, d.id, 'rejected', null, null, `Account suspended: ${reason}`);
                        }
                    } else {
                        updateData.banReason = deleteField();
                        updateData.banExpiry = deleteField();
                        updateData.isDisabled = false;
                        updateData.disabledAt = deleteField();
                        updateData.disabledBy = deleteField();
                        updateData.dueLoanBlocked = deleteField();
                        updateData.dueLoanReason = deleteField();
                        updateData.dueLoanId = deleteField();
                    }

                    await updateDoc(userRef, updateData);
                    allUsersCache = allUsersCache.map(u => u.id === userId ? {
                        ...u,
                        isFlagged: !currentlyFlagged,
                        isDisabled: !currentlyFlagged ? true : false,
                        banReason: updateData.banReason,
                        banExpiry: updateData.banExpiry || null,
                        disabledAt: !currentlyFlagged ? Date.now() : undefined,
                        disabledBy: !currentlyFlagged ? currentUser.uid : undefined
                    } : u);
                    applyAdminUsersCache(allUsersCache);
                    updateAdminUserListView();
                    showNotification(`User ${currentlyFlagged ? 'unbanned' : 'banned'} successfully!`);
                    window.closeModal();
                } catch (e) {
                    console.error("Ban user failed:", e);
                    showNotification(`Error: ${e.message}`, true);
                }
            };
        };

const numberToWords = (num) => {
            const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
            const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

            if ((num = num.toString()).length > 9) return 'Amount too large';
            const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!n) return '';
            let str = '';
            str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
            str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
            str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
            str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
            str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Rupees ' : '';
            return str.trim();
        };

const switchTab = (tabId) => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.setAttribute('aria-selected', btn.dataset.tab === tabId));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            const panel = document.getElementById(tabId);
            if (panel) panel.classList.remove('hidden');
            if (tabId === 'user-panel') updateDollarBalanceDisplay(currentUserData?.balance || 0);
        };

const openUserQuickAction = (handler) => {
            if (!ensureUserSessionReady()) return null;
            currentMainSection = 'home';
            setBottomNavActive('bottom-home-btn');
            try {
                const result = handler();
                if (result?.catch) {
                    result.catch(error => {
                        console.error('User quick action failed:', error);
                        showNotification('This page could not open. Please try again.', true);
                    });
                }
                return result;
            } catch (error) {
                console.error('User quick action failed:', error);
                showNotification('This page could not open. Please try again.', true);
                return null;
            }
        };

const preloadLogoImages = () => {
            const criticalLogoUrls = [...new Set([
                RW_LOGO_URL,
                CHATBOT_ICON_URL
            ])];
            const idleLogoUrls = [...new Set([
                REFER_ICON_URL,
                WALLET_ICON_URL,
                ADMIN_ICON_URL,
                TASK_ICON_URL,
                CHAT_ICON_URL,
                SETTINGS_ICON_URL,
                NOTIFICATION_ICON_URL,
                PLAY_STORE_LOGO_URL,
                'https://cdn-icons-png.flaticon.com/512/12449/12449036.png',
                'https://cdn-icons-png.flaticon.com/512/3652/3652191.png',
                'https://cdn-icons-png.flaticon.com/512/7939/7939990.png',
                'https://cdn-icons-png.flaticon.com/512/2611/2611152.png',
                'https://cdn-icons-png.flaticon.com/512/33/33308.png',
                'https://cdn-icons-png.flaticon.com/512/4108/4108841.png',
                'https://cdn-icons-png.flaticon.com/512/9197/9197103.png',
                PARTNER_ICON_URL
            ])];

            const preloadImage = (logoUrl, priority = 'low') => {
                const img = new Image();
                img.decoding = 'async';
                img.loading = 'eager';
                img.fetchPriority = priority;
                img.src = logoUrl;
                img.onload = function () {
                    document.querySelectorAll(`img[src="${logoUrl}"]`).forEach(logo => {
                        logo.classList.add('loaded');
                        logo.style.opacity = '1';
                    });
                };
            };

            criticalLogoUrls.forEach((logoUrl) => preloadImage(logoUrl, 'high'));
            const loadIdleImages = () => idleLogoUrls.forEach((logoUrl) => preloadImage(logoUrl, 'low'));
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(loadIdleImages, { timeout: 2500 });
            } else {
                setTimeout(loadIdleImages, 1200);
            }
        };

const checkForUpdates = async () => {
            // 1. Create a document in Firestore at 'settings/app_config' 
            // with a field named 'latest_version_code'
            const configDoc = await getDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'));

            if (configDoc.exists()) {
                const latestVersion = configDoc.data().latest_version_code;
                const downloadUrl = configDoc.data().update_url;

                // 2. Compare versions
                if (latestVersion > CURRENT_VERSION_CODE) {
                    renderModal('Update Available',
                        `<p class="text-sm">A new version of the app is available. Please download it to continue using all features.</p>`,
                        `<a href="${downloadUrl}" class="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Download Update</a>`,
                        'max-w-sm', true
                    );
                }
            }
        };

const setNumberSetting = (value, fallback) => {
            const numberValue = Number(value);
            return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
        };

const applyAppConfig = (config = {}) => {
            appConfigCache = rememberAppConfig({ ...(appConfigCache || {}), ...(config || {}) });
            applyWithdrawalConfig(appConfigCache);
            applyMaintenanceMode();
            showWhatsNewPopupIfNeeded();
            if (document.querySelector('.task-page-shell')) {
                showUserTaskPage();
            }
        };

const preventDuplicateRequest = (requestType, timeout = 3000) => {
            const requestId = `${requestType}-${currentUser?.uid}-${Date.now()}`;

            if (pendingRequests.has(requestType)) {
                showNotification('Please wait, processing previous request...', true);
                return false;
            }

            pendingRequests.add(requestType);
            setTimeout(() => pendingRequests.delete(requestType), timeout);
            return true;
        };

const showForgotPasswordModal = () => {
            document.getElementById('forgot-password-modal').classList.remove('hidden');
            setTimeout(() => {
                const modal = document.getElementById('forgot-password-modal').querySelector('.animate-modal-in');
                if (modal) {
                    modal.style.opacity = '1';
                    modal.style.scale = '1';
                }
            }, 10);
        };

window.closeForgotPasswordModal = () => {
            document.getElementById('forgot-password-modal').classList.add('hidden');
            document.getElementById('reset-email-input').value = '';
            document.getElementById('reset-error').textContent = '';
        };

const handleForgotPassword = async () => {
            const email = document.getElementById('reset-email-input').value.trim();
            const errorElement = document.getElementById('reset-error');

            if (!email) {
                errorElement.textContent = 'Please enter your email address';
                return;
            }

            try {
                await sendPasswordResetEmail(auth, email);
                showNotification('Password reset link has been sent to your email. Please check your inbox and spam folder.');
                window.closeForgotPasswordModal();
            } catch (error) {
                errorElement.textContent = error.message;
            }
        };

const checkAppVersion = async () => {
            try {
                const versionDoc = await getDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'));
                if (versionDoc.exists()) {
                    const config = versionDoc.data();

                    applyAppConfig(config);
                    withdrawalSettingsLoadedAt = Date.now();

                    // Check for updates (optional)
                    if (config.latest_version && config.latest_version !== APP_VERSION) {
                        console.log(`Update available: ${config.latest_version}`);
                    }
                }
            } catch (error) {
                console.log("Version check error:", error);
            }
        };

// Expose functions to window for global access
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.friendlyErrorMessage = friendlyErrorMessage;
window.showFriendlyError = showFriendlyError;
window.loadAndCropAvatars = loadAndCropAvatars;
window.formatCurrency = formatCurrency;
window.numericAmount = numericAmount;
window.absoluteAmount = absoluteAmount;
window.formatCurrencyAbs = formatCurrencyAbs;
window.getUserAvailableBalance = getUserAvailableBalance;
window.getSpendableWalletBalance = getSpendableWalletBalance;
window.getInsufficientWalletMessage = getInsufficientWalletMessage;
window.withTimeout = withTimeout;
window.formatCompactBalance = formatCompactBalance;
window.formatUsd = formatUsd;
window.escapeHtml = escapeHtml;
window.stripUndefinedFields = stripUndefinedFields;
window.getUserCacheKey = getUserCacheKey;
window.readJsonCache = readJsonCache;
window.writeJsonCache = writeJsonCache;
window.timestampToMillis = timestampToMillis;
window.normalizeAppConfigForCache = normalizeAppConfigForCache;
window.rememberAppConfig = rememberAppConfig;
window.applyCachedAppConfigForStartup = applyCachedAppConfigForStartup;
window.loadAppConfigForStartup = loadAppConfigForStartup;
window.reviveCachedTimestamp = reviveCachedTimestamp;
window.getExplicitBalanceAfter = getExplicitBalanceAfter;
window.fetchWithTimeout = fetchWithTimeout;
window.isExpectedBackgroundAbort = isExpectedBackgroundAbort;
window.logBackgroundSkip = logBackgroundSkip;
window.reportSyncFailure = reportSyncFailure;
window.recordCloudTransfer = recordCloudTransfer;
window.serializeCloudFundRequest = serializeCloudFundRequest;
window.normalizeCloudFundRequest = normalizeCloudFundRequest;
window.upsertCloudFundRequest = upsertCloudFundRequest;
window.importCloudFundRequests = importCloudFundRequests;
window.loadCloudFundRequests = loadCloudFundRequests;
window.updateCloudFundRequestStatus = updateCloudFundRequestStatus;
window.loadFirebasePendingFundRequests = loadFirebasePendingFundRequests;
window.getFundRequestPrimaryId = getFundRequestPrimaryId;
window.getFundRequestSignature = getFundRequestSignature;
window.getFundRequestLooseSignature = getFundRequestLooseSignature;
window.markFundRequestLocallyProcessed = markFundRequestLocallyProcessed;
window.isFundRequestLocallyProcessed = isFundRequestLocallyProcessed;
window.isFinalFundStatus = isFinalFundStatus;
window.mergeFundRequestsById = mergeFundRequestsById;
window.sanitizeUserForCache = sanitizeUserForCache;
window.hydrateUserFromCache = hydrateUserFromCache;
window.loadSocketIoClient = loadSocketIoClient;
window.updateDollarBalanceDisplay = updateDollarBalanceDisplay;
window.fetchUsdInrRate = fetchUsdInrRate;
window.formatDate = formatDate;
window.formatDateDDMMYY = formatDateDDMMYY;
window.getTimeFromTimestamp = getTimeFromTimestamp;
window.normalizePhoneDigits = normalizePhoneDigits;
window.getUserMobileValue = getUserMobileValue;
window.findExistingUserByMobile = findExistingUserByMobile;
window.userMatchesSearch = userMatchesSearch;
window.maskMobile = maskMobile;
window.maskUpi = maskUpi;
window.playSuccessSound = playSuccessSound;
window.playErrorSound = playErrorSound;
window.getCachedSessionUserId = getCachedSessionUserId;
window.ensureUserSessionReady = ensureUserSessionReady;
window.renderModal = renderModal;
window.setMainChrome = setMainChrome;
window.isKeyboardLiftTarget = isKeyboardLiftTarget;
window.keepFocusedInputVisible = keepFocusedInputVisible;
window.installGlobalKeyboardLift = installGlobalKeyboardLift;
window.getBanExpiryDate = getBanExpiryDate;
window.getBanMessage = getBanMessage;
window.getBanDetails = getBanDetails;
window.isUserApprovalPending = isUserApprovalPending;
window.isUserApprovalRejected = isUserApprovalRejected;
window.getApprovalHoldMessage = getApprovalHoldMessage;
window.getApprovalDetails = getApprovalDetails;
window.showApprovedDashboardAfterHold = showApprovedDashboardAfterHold;
window.enforceCurrentUserApproval = enforceCurrentUserApproval;
window.enforceCurrentUserBan = enforceCurrentUserBan;
window.getUserWebSeenMillis = getUserWebSeenMillis;
window.isUserOnUpdatedWebApp = isUserOnUpdatedWebApp;
window.markUpdatedWebAppSeen = markUpdatedWebAppSeen;
window.initializeUserListeners = initializeUserListeners;
window.applyAdsSnapshot = applyAdsSnapshot;
window.getYoutubeEmbedUrl = getYoutubeEmbedUrl;
window.getAdType = getAdType;
window.getAdMediaUrl = getAdMediaUrl;
window.renderHomeAdsCarousel = renderHomeAdsCarousel;
window.renderHomeTaskCategories = renderHomeTaskCategories;
window.initializePublicHomeRealtime = initializePublicHomeRealtime;
window.toTitleText = toTitleText;
window.renderWebsiteLinkInputs = renderWebsiteLinkInputs;
window.bindWebsiteLinkControls = bindWebsiteLinkControls;
window.renderPaymentDetailsForm = renderPaymentDetailsForm;
window.getReferralRewardAmount = getReferralRewardAmount;
window.renderSettingAction = renderSettingAction;
window.loadUserLiveLists = loadUserLiveLists;
window.renderUserLiveLists = renderUserLiveLists;
window.handleSaveLiveList = handleSaveLiveList;
window.getMaintenanceEndMillis = getMaintenanceEndMillis;
window.isMaintenanceConfigActive = isMaintenanceConfigActive;
window.getMaintenanceCountdownParts = getMaintenanceCountdownParts;
window.formatMaintenanceCountdown = formatMaintenanceCountdown;
window.formatMaintenanceDurationInput = formatMaintenanceDurationInput;
window.parseMaintenanceDurationInput = parseMaintenanceDurationInput;
window.updateMaintenanceCountdownUi = updateMaintenanceCountdownUi;
window.removeMaintenanceOverlay = removeMaintenanceOverlay;
window.renderMaintenanceOverlay = renderMaintenanceOverlay;
window.restoreDashboardAfterMaintenanceIfNeeded = restoreDashboardAfterMaintenanceIfNeeded;
window.applyMaintenanceMode = applyMaintenanceMode;
window.getWhatsNewId = getWhatsNewId;
window.getWhatsNewSeenKey = getWhatsNewSeenKey;
window.closeWhatsNewPopup = closeWhatsNewPopup;
window.showWhatsNewPopupIfNeeded = showWhatsNewPopupIfNeeded;
window.handleTurnOffMaintenance = handleTurnOffMaintenance;
window.handleDisableWhatsNew = handleDisableWhatsNew;
window.getNextTaskMidnightMillis = getNextTaskMidnightMillis;
window.getTaskCommentPool = getTaskCommentPool;
window.getTaskTier = getTaskTier;
window.isBulkTaskUser = isBulkTaskUser;
window.getTaskReservationDocId = getTaskReservationDocId;
window.getStartOfTodayMillis = getStartOfTodayMillis;
window.preloadUserTaskParticipation = preloadUserTaskParticipation;
window.findReusableTaskReservation = findReusableTaskReservation;
window.reserveTaskReviewComment = reserveTaskReviewComment;
window.getTaskLogoFromLink = getTaskLogoFromLink;
window.getTaskPaymentLabel = getTaskPaymentLabel;
window.loadJsPDF = loadJsPDF;
window.loadImage = loadImage;
window.getSafeDate = getSafeDate;
window.getUserCreatedYear = getUserCreatedYear;
window.getInvoiceGroups = getInvoiceGroups;
window.truncatePdfText = truncatePdfText;
window.getVerifiedBadge = getVerifiedBadge;
window.getPremiumLogoFrame = getPremiumLogoFrame;
window.renderMessageTicks = renderMessageTicks;
window.normalizeBackendMessage = normalizeBackendMessage;
window.getNextMonthRepaymentDate = getNextMonthRepaymentDate;
window.addMonthsClamped = addMonthsClamped;
window.addDays = addDays;
window.toDate = toDate;
window.getValidDateFromMillis = getValidDateFromMillis;
window.runAfterFirstPaint = runAfterFirstPaint;
window.getPendingSignupUsers = getPendingSignupUsers;
window.isNewSignupUser = isNewSignupUser;
window.getSignupUserCategory = getSignupUserCategory;
window.handleSignupApprovalAction = handleSignupApprovalAction;
window.uploadFileWithProgress = uploadFileWithProgress;
window.escapePdfText = escapePdfText;
window.formatPdfCurrency = formatPdfCurrency;
window.createSimplePdf = createSimplePdf;
window.handleFindRecipient = handleFindRecipient;
window.handlePayToWallet = handlePayToWallet;
window.handleCopyText = handleCopyText;
window.handleCopyUpi = handleCopyUpi;
window.handleRequestAction = handleRequestAction;
window.proceedWithRequestAction = proceedWithRequestAction;
window.handleDeleteUser = handleDeleteUser;
window.showEditUserBalanceModal = showEditUserBalanceModal;
window.handleEditUserBalance = handleEditUserBalance;
window.handleToggleProUser = handleToggleProUser;
window.handlePromoteUserTaskTier = handlePromoteUserTaskTier;
window.handleFlagUser = handleFlagUser;
window.numberToWords = numberToWords;
window.switchTab = switchTab;
window.openUserQuickAction = openUserQuickAction;
window.preloadLogoImages = preloadLogoImages;
window.checkForUpdates = checkForUpdates;
window.setNumberSetting = setNumberSetting;
window.applyAppConfig = applyAppConfig;
window.preventDuplicateRequest = preventDuplicateRequest;
window.showForgotPasswordModal = showForgotPasswordModal;
window.handleForgotPassword = handleForgotPassword;
window.checkAppVersion = checkAppVersion;
