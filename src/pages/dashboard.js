// File: src/pages/dashboard.js

const getHistoryCacheKey = (userId) => `rw_wallet_history_cache_${userId}`;

const getHistoryDataCacheKey = (userId) => `rw_wallet_history_data_cache_${userId}`;

const normalizeHistoryItemForCache = (item = {}) => {
            const cached = { ...item };
            ['timestamp', 'requestedAt', 'processedAt'].forEach(field => {
                if (cached[field]) cached[field] = timestampToMillis(cached[field]);
            });
            return cached;
        };

const reviveHistoryItemFromCache = (item = {}) => {
            const revived = { ...item };
            ['timestamp', 'requestedAt', 'processedAt'].forEach(field => {
                if (revived[field]) revived[field] = reviveCachedTimestamp(revived[field]);
            });
            return revived;
        };

const readHistoryItemsFromCache = (userId) => {
            const cached = readJsonCache(getHistoryDataCacheKey(userId));
            return Array.isArray(cached) ? cached.map(reviveHistoryItemFromCache) : [];
        };

const writeHistoryItemsToCache = (userId, items) => {
            if (!userId || !Array.isArray(items)) return;
            writeJsonCache(getHistoryDataCacheKey(userId), items.map(normalizeHistoryItemForCache));
        };

const normalizeTransactionType = (item = {}) => {
            const rawType = String(item.type || '').toLowerCase().replace(/\s+/g, '_');
            const comment = String(item.comment || item.remarks || '').toLowerCase();
            if (rawType.includes('withdraw') || comment.includes('withdraw')) return 'withdrawal';
            if (rawType.includes('recharge') || comment.includes('recharge')) return 'mobile_recharge';
            if (rawType.includes('gift')) return 'gift_card';
            if (rawType.includes('wallet_transfer') || rawType === 'transfer') return 'wallet_transfer';
            if (rawType === 'credit' || rawType.includes('credit') || rawType.includes('received') || rawType.includes('deposit') || rawType.includes('add_fund')) return 'credit';
            if (rawType === 'debit' || rawType.includes('debit') || rawType.includes('deduct') || rawType.includes('cut')) return 'debit';
            if (rawType.includes('sent') || comment.includes('money sent')) return 'debit';
            if (comment.includes('admin credit')) return 'credit';
            if (comment.includes('admin debit') || comment.includes('balance cut') || comment.includes('deduct')) return 'debit';
            if (Number(item.amount || 0) > 0) return 'credit';
            if (Number(item.amount || 0) < 0) return 'debit';
            return rawType || 'transaction';
        };

const normalizeTransactionForHistory = (item = {}, index = 0) => {
            const timestamp = timestampToMillis(item.timestamp || item.requestedAt || item.createdAt || item.processedAt || item.date) || Date.now();
            const type = normalizeTransactionType(item);
            const amount = Number(item.amount || item.chargeAmount || 0);
            const transactionId = String(item.transaction_id || item.transactionId || item.adminTransactionId || item.id || `TX-${timestamp}-${index}`);
            return {
                ...item,
                id: item.id || transactionId,
                userId: item.user_id || item.userId || currentUser?.uid || '',
                transactionId,
                type,
                timestamp,
                amount,
                status: item.status || 'completed',
                comment: item.comment || item.remarks || item.description || (type === 'credit' ? 'Money Received' : type === 'withdrawal' ? 'Withdrawal' : 'Wallet Transaction')
            };
        };

const getTransactionBalanceEffect = (item = {}) => {
            const type = normalizeTransactionType(item);
            const amount = Number(item.chargeAmount || item.amount || 0);
            const status = String(item.status || '').toLowerCase();
            if (!Number.isFinite(amount) || amount === 0) return 0;
            if (status === 'rejected' || status === 'failed') {
                if (type === 'withdrawal' || type === 'mobile_recharge') return amount;
                return 0;
            }
            if (type === 'credit' || type === 'wallet_transfer' || type === 'add_fund' || type === 'gift_card') return amount;
            if (type === 'debit' || type === 'withdrawal' || type === 'mobile_recharge') return -amount;
            return amount > 0 ? amount : 0;
        };

const annotateTransactionsWithRemainingBalance = (items = [], currentBalance = 0) => {
            let runningBalance = Number(currentBalance || 0);
            return items.map(item => {
                const explicitBalanceAfter = getExplicitBalanceAfter(item);
                const balanceAfter = explicitBalanceAfter !== null ? explicitBalanceAfter : runningBalance;
                const effect = getTransactionBalanceEffect(item);
                runningBalance = Number((balanceAfter - effect).toFixed(2));
                return {
                    ...item,
                    balanceAfter,
                    balanceBefore: item.balanceBefore ?? item.balance_before ?? Number((balanceAfter - effect).toFixed(2))
                };
            });
        };

const normalizeCloudTransaction = (item = {}) => normalizeTransactionForHistory(item);

const getTransactionKey = (item = {}, index = 0) => {
            const timestamp = timestampToMillis(item.timestamp || item.requestedAt || item.createdAt || item.processedAt) || Date.now();
            const existingKey = String(item.key || '');
            if (existingKey.startsWith('req-')) return existingKey;
            const requestId = item.requestId || item.request_id;
            const type = normalizeTransactionType(item);
            if (requestId && (type === 'withdrawal' || type === 'mobile_recharge')) return `req-${requestId}`;
            return String(item.transactionId || item.adminTransactionId || item.requestId || item.id || existingKey || `${item.type || 'tx'}-${timestamp}-${item.amount || 0}-${index}`);
        };

const mergeTransactionsByKey = (...groups) => {
            const merged = new Map();
            const statusRank = (item = {}) => ['completed', 'rejected', 'failed'].includes(String(item.status || '').toLowerCase()) ? 2 : 1;
            const getOriginalRequestTime = (...items) => {
                const times = items
                    .flat()
                    .map(item => timestampToMillis(item?.requestedAt || item?.requested_at || item?.createdAt || item?.timestamp))
                    .filter(time => Number.isFinite(time) && time > 0);
                return times.length ? Math.min(...times) : null;
            };
            groups.flat().forEach((item, index) => {
                if (!item) return;
                const normalized = normalizeTransactionForHistory(item, index);
                const key = getTransactionKey(normalized, index);
                const existing = merged.get(key) || {};
                let next = statusRank(normalized) >= statusRank(existing)
                    ? { ...existing, ...normalized, key }
                    : { ...normalized, ...existing, key };
                const type = normalizeTransactionType(next);
                if ((next.requestId || next.request_id) && (type === 'withdrawal' || type === 'mobile_recharge')) {
                    const requestedAt = getOriginalRequestTime(existing, normalized, item);
                    if (requestedAt) {
                        next = {
                            ...next,
                            requestedAt,
                            timestamp: requestedAt
                        };
                    }
                }
                merged.set(key, next);
            });
            return Array.from(merged.values())
                .sort((a, b) => timestampToMillis(b.timestamp || b.requestedAt) - timestampToMillis(a.timestamp || a.requestedAt));
        };

const normalizePendingRequestForHistory = (request = {}) => {
            const requestType = request.type || 'withdrawal';
            const timestamp = request.requestedAt || request.requested_at || request.timestamp || request.createdAt || Date.now();
            const requestId = request.id || request.requestId || request.request_id || `${requestType}-${timestampToMillis(timestamp)}-${request.amount || 0}`;
            return {
                ...request,
                id: requestId,
                requestId,
                key: `req-${requestId}`,
                type: requestType,
                comment: requestType === 'mobile_recharge' ? 'Mobile Recharge Request' : 'Withdrawal Request',
                timestamp,
                status: request.status || 'pending'
            };
        };

const loadFirebaseTransactions = async (userId, maxItems = FIRESTORE_TRANSACTION_READ_LIMIT) => {
            if (!userId) return [];
            const readLimit = Math.max(1, Math.min(Number(maxItems) || FIRESTORE_TRANSACTION_READ_LIMIT, FIRESTORE_TRANSACTION_READ_LIMIT));
            const canonicalQuery = query(
                collection(db, `artifacts/${appId}/public/data/users/${userId}/transactions`),
                orderBy('timestamp', 'desc'),
                firestoreLimit(readLimit)
            );
            const snapshot = await getDocs(canonicalQuery);
            return snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                sourcePath: docSnap.ref.path,
                ...docSnap.data()
            }));
        };

const serializeCloudTransaction = (item = {}, userId = currentUser?.uid) => {
            const timestamp = timestampToMillis(item.timestamp || item.requestedAt || item.createdAt || item.processedAt) || Date.now();
            const transactionId = String(item.transactionId || item.adminTransactionId || item.requestId || item.id || `${item.type || 'tx'}-${timestamp}`);
            return {
                userId,
                transactionId,
                type: item.type || 'transaction',
                amount: Number(item.amount || 0),
                status: item.status || 'completed',
                timestamp,
                details: normalizeHistoryItemForCache({ ...item, transactionId, timestamp })
            };
        };

const fetchCloudTransactionHistory = async (userId, limit = 100) => {
            const token = await getBackendAuthToken();
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/transactions/${encodeURIComponent(userId)}?limit=${limit}`, {
                headers: { Authorization: `Bearer ${token}` }
            }, 7000);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Cloudflare history load failed');
            return (data.history || []).map(normalizeCloudTransaction);
        };

const importFirestoreTransactionsToCloud = async (userId, items) => {
            if (!items.length) return;
            try {
                const token = await getBackendAuthToken();
                for (let index = 0; index < items.length; index += 500) {
                    const chunk = items.slice(index, index + 500);
                    await fetch(`${BACKEND_BASE_URL}/api/transactions/import`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userId,
                            transactions: chunk.map(item => serializeCloudTransaction(item, userId))
                        })
                    });
                }
            } catch (error) {
                console.warn('Cloudflare history import failed:', error);
                reportSyncFailure('transaction_import', userId, 'firebase', 'd1', error?.message);
            }
        };

const recordCloudTransaction = async (userId, item) => {
            try {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/transactions`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(serializeCloudTransaction(item, userId))
                }, 5000);
            } catch (error) {
                console.warn('Cloudflare transaction save failed:', error);
                reportSyncFailure('transaction', item?.transactionId || 'unknown', 'firebase', 'd1', error?.message);
            }
        };

const getSafeTransactionDocId = (id = '') => String(id || generateTransactionId()).replace(/[\/\\#?[\]]/g, '-').slice(0, 120);

const recordUserFirestoreTransaction = async (userId, item = {}) => {
            const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
            const transactionId = item.transactionId || generateTransactionId();
            const txRef = doc(collection(userRef, 'transactions'), getSafeTransactionDocId(transactionId));
            await setDoc(txRef, {
                ...item,
                transactionId,
                timestamp: item.timestamp || serverTimestamp()
            }, { merge: true });
            return { ...item, transactionId };
        };

const syncRecentTransactionsToCloud = async (userId = currentUser?.uid) => {
            if (!userId) return;
            try {
                const items = await loadFirebaseTransactions(userId, FIRESTORE_TRANSACTION_READ_LIMIT);
                await importFirestoreTransactionsToCloud(userId, items);
                const mergedUserHistory = mergeTransactionsByKey(readHistoryItemsFromCache(userId), items);
                writeHistoryItemsToCache(userId, mergedUserHistory);
                if (currentUser?.uid === userId) {
                    unifiedHistoryCache = mergeTransactionsByKey(unifiedHistoryCache, mergedUserHistory);
                }
            } catch (error) {
                console.warn('Firebase transaction cache sync failed:', error);
            }
        };

const prefetchTransactionHistory = (userId = currentUser?.uid, { force = false } = {}) => {
            if (!userId) return Promise.resolve([]);
            if (!force && transactionHistoryPrefetch.userId === userId && transactionHistoryPrefetch.promise) {
                return transactionHistoryPrefetch.promise;
            }
            if (!force && transactionHistoryPrefetch.userId === userId && transactionHistoryPrefetch.loadedAt && Date.now() - transactionHistoryPrefetch.loadedAt < 60000) {
                return Promise.resolve(unifiedHistoryCache);
            }
            const cached = readHistoryItemsFromCache(userId);
            if (cached.length) {
                unifiedHistoryCache = mergeTransactionsByKey(unifiedHistoryCache, cached);
            }
            transactionHistoryPrefetch.userId = userId;
            transactionHistoryPrefetch.promise = (async () => {
                const [firebaseTransactions, cloudTransactions, pendingWithdrawals] = await Promise.all([
                    loadFirebaseTransactions(userId, FIRESTORE_TRANSACTION_READ_LIMIT).catch(error => {
                        console.warn('Firebase transaction prefetch skipped:', error);
                        return [];
                    }),
                    fetchCloudTransactionHistory(userId, FIRESTORE_TRANSACTION_READ_LIMIT).catch(error => {
                        console.warn('Cloud transaction prefetch skipped:', error);
                        return [];
                    }),
                    loadUserPendingWithdrawalsMerged(userId).catch(error => {
                        console.warn('Pending withdrawal prefetch skipped:', error);
                        return [];
                    })
                ]);
                const activeHistoryCache = currentUser?.uid === userId ? unifiedHistoryCache : readHistoryItemsFromCache(userId);
                const cachedPending = (activeHistoryCache || []).filter(item => String(item.status || '').toLowerCase() === 'pending');
                const pendingHistoryItems = pendingWithdrawals.map(normalizePendingRequestForHistory);
                const mergedUserHistory = mergeTransactionsByKey(firebaseTransactions, cloudTransactions, cachedPending, pendingHistoryItems);
                writeHistoryItemsToCache(userId, mergedUserHistory);
                if (currentUser?.uid === userId) {
                    unifiedHistoryCache = mergedUserHistory;
                }
                transactionHistoryPrefetch.loadedAt = Date.now();
                return mergedUserHistory;
            })().finally(() => {
                transactionHistoryPrefetch.promise = null;
            });
            return transactionHistoryPrefetch.promise;
        };

const addInstantTransactionToHistory = (userId, item = {}) => {
            if (!userId || !item) return null;
            const normalized = normalizeTransactionForHistory({
                ...item,
                timestamp: item.timestamp || Date.now()
            });
            const mergedUserHistory = mergeTransactionsByKey([normalized], readHistoryItemsFromCache(userId), currentUser?.uid === userId ? unifiedHistoryCache : []);
            writeHistoryItemsToCache(userId, mergedUserHistory);
            if (currentUser?.uid === userId) {
                unifiedHistoryCache = mergedUserHistory;
            }
            transactionHistoryPrefetch = { userId, promise: null, loadedAt: 0 };
            if (document.getElementById('transactions-list')) {
                document.getElementById('transactions-list').innerHTML = unifiedHistoryCache.slice(0, 5).map(tx => renderTransactionItem(tx)).join('');
                try {
                    localStorage.setItem(getHistoryCacheKey(userId), document.getElementById('transactions-list').innerHTML);
                } catch (error) {
                    console.warn('Instant history html cache skipped:', error);
                }
            }
            if (document.getElementById('all-transactions-list')) {
                const activeFilter = document.querySelector('#filter-bar .active-filter')?.dataset.filter || 'all';
                renderFilteredTransactions(activeFilter, { reset: false });
            }
            return unifiedHistoryCache.find(tx => tx.transactionId === normalized.transactionId) || normalized;
        };

const generateTransactionId = () => {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 8);
            return `TXN${timestamp}${random}`.toUpperCase();
        };

const renderTransactionItem = (item, isFullPage = false) => {
            const hasDetailKey = !!item.key;
            const clickableClass = hasDetailKey ? 'tx-item-clickable cursor-pointer' : '';
            const dataKey = hasDetailKey ? `data-key="${item.key}"` : '';

            if (item.type === 'mobile_recharge') {
                const isPending = item.status === 'pending';
                const isRejected = item.status === 'rejected';
                const statusText = isPending ? 'Pending' : isRejected ? 'Rejected' : 'Completed';
                const statusColor = isPending ? 'text-yellow-600' : isRejected ? 'text-red-500' : 'text-green-500';
                const bgColor = isPending ? 'bg-sky-50 dark:bg-sky-900/20' : isRejected ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/50';
                const chargeAmount = item.chargeAmount || item.amount || 0;

                return `
                    <div class="flex justify-between items-center p-3 ${bgColor} rounded-lg text-sm ${clickableClass}" ${dataKey}>
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold">Mobile Recharge</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${item.mobileNumber || ''} ${item.operator ? `| ${item.operator}` : ''}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp || item.requestedAt)}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-red-500">-${formatCurrencyAbs(chargeAmount)}</p>
                            <p class="text-xs font-semibold ${statusColor}">${statusText}</p>
                        </div>
                    </div>`;
            }

            if (item.status === 'pending') {
                return `
                    <div class="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm ${clickableClass}" ${dataKey}>
                        <div class="flex-1">
                            <p class="font-semibold capitalize">Withdrawal Request</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${formatDate(item.timestamp)}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-yellow-600">${formatCurrencyAbs(item.amount)}</p>
                            <p class="text-xs font-semibold text-yellow-600">Pending</p>
                        </div>
                    </div>`;
            }

            // Handle withdrawal status
            if (item.type === 'withdrawal') {
                let statusText = 'Completed';
                let statusColor = 'text-red-500';
                let bgColor = 'bg-red-50 dark:bg-red-900/20';
                let txnIdBadge = '';

                if (item.adminTransactionId) {
                    txnIdBadge = `<span class="txn-id-badge text-xs ml-2">${item.adminTransactionId}</span>`;
                }

                if (item.status === 'rejected') {
                    statusText = 'Rejected';
                    statusColor = 'text-red-500';
                    bgColor = 'bg-red-50 dark:bg-red-900/20';
                }

                return `
                    <div class="flex justify-between items-center p-3 ${bgColor} rounded-lg text-sm ${clickableClass}" ${dataKey}>
                        <div class="flex-1">
                            <p class="font-semibold">Withdrawal ${txnIdBadge}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp)}</p>
                            ${item.rejectionReason ? `<p class="text-xs text-red-400 mt-1">Reason: ${escapeHtml(item.rejectionReason)}</p>` : ''}
                        </div>
                        <div class="text-right">
                            <p class="font-bold ${statusColor}">-${formatCurrencyAbs(item.amount)}</p>
                            <p class="text-xs font-semibold ${statusColor}">${statusText}</p>
                        </div>
                    </div>`;
            }

            // Handle wallet transfers (Pay to Wallet) - Show clear From/To information
            if (item.type === 'wallet_transfer') {
                const isCredit = item.amount > 0;
                const sign = isCredit ? '+' : '-';
                const colorClass = isCredit ? 'text-green-500' : 'text-red-500';
                const actionText = isCredit ? 'From: ' : 'To: ';
                const userName = isCredit ? (item.senderName || 'User') : (item.recipientName || 'User');

                return `
                    <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm ${clickableClass}" ${dataKey}>
                        <div class="flex-1">
                            <p class="font-semibold">${actionText}${escapeHtml(userName)}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp)}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Wallet Transfer</p>
                        </div>
                        <p class="font-bold ${colorClass}">
                            ${sign}${formatCurrency(Math.abs(item.amount))}
                        </p>
                    </div>`;
            }

            // Handle debit transactions (when user sends money) - Show To information
            if (item.type === 'debit' && item.recipientName) {
                return `
                    <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm ${clickableClass}" ${dataKey}>
                        <div class="flex-1">
                            <p class="font-semibold">To: ${escapeHtml(item.recipientName || 'User')}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp)}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Money Sent</p>
                        </div>
                        <p class="font-bold text-red-500">
                            -${formatCurrencyAbs(item.amount)}
                        </p>
                    </div>`;
            }

            // Handle other transaction types
            const normalizedType = normalizeTransactionType(item);
            const isCredit = ['credit', 'gift_card'].includes(normalizedType) || (Number(item.amount || 0) > 0 && !['debit', 'withdrawal', 'mobile_recharge'].includes(normalizedType));
            const sign = isCredit ? '+' : '-';
            const colorClass = isCredit ? 'text-green-500' : 'text-red-500';

            // Check if this is a debit (wallet send) and use recipientName if available
            let displayText = (item.comment || item.type || 'Wallet Transaction').replace(/_/g, ' ');
            if (item.type === 'debit' && item.recipientName) {
                displayText = item.recipientName;
            }

            return `
                <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm ${clickableClass}" ${dataKey}>
                    <div class="flex-1">
                        <p class="font-semibold capitalize">${escapeHtml(displayText)}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp)}</p>
                    </div>
                    <p class="font-bold ${colorClass}">
                        ${sign}${formatCurrencyAbs(item.amount)}
                    </p>
                </div>`;
        };

const setBottomNavActive = (activeId) => {
            document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.id === activeId);
            });
        };

const showPage = (content, options = {}) => {
            if (adminMaintenanceInterval) {
                clearInterval(adminMaintenanceInterval);
                adminMaintenanceInterval = null;
            }
            lastManualPageOpenAt = Date.now();
            document.getElementById('dashboard-content').classList.add('hidden');
            const pageContainer = document.getElementById('page-container');
            const returnSection = options.returnTo || currentMainSection;
            pageContainer.innerHTML = content;
            pageContainer.classList.remove('hidden');
            pageContainer.style.paddingBottom = options.fullHeight ? '0' : (options.keepBottomNav ? '6.5rem' : '1.5rem');
            pageContainer.style.overflowY = options.fullHeight ? 'hidden' : 'auto';
            pageContainer.style.scrollPaddingBottom = '7rem';
            setMainChrome(!!options.keepBottomNav);
            document.getElementById('app-footer')?.classList.add('app-footer-hidden');
            const backButton = pageContainer.querySelector('.page-back-btn');
            if (backButton) {
                backButton.onclick = options.onBack || (() => {
                    if (returnSection === 'settings') {
                        showSettingsPage();
                    } else if (returnSection === 'transactions') {
                        showAllTransactionsPage();
                    } else if (returnSection === 'help') {
                        showHelpSupportPage();
                    } else if (returnSection === 'admin') {
                        showAdminMainPage();
                    } else {
                        hidePage();
                    }
                });
            }
        };

const hidePage = () => {
            if (adminMaintenanceInterval) {
                clearInterval(adminMaintenanceInterval);
                adminMaintenanceInterval = null;
            }
            if (activeChatUnsubscribe) {
                activeChatUnsubscribe();
                activeChatUnsubscribe = null;
            }
            document.getElementById('dashboard-content').classList.remove('hidden');
            document.getElementById('page-container').classList.add('hidden');
            document.getElementById('page-container').innerHTML = '';
            document.getElementById('page-container').style.overflowY = 'auto';
            document.getElementById('page-container').style.scrollPaddingBottom = '';
            updateDollarBalanceDisplay(currentUserData?.balance || 0);
            setMainChrome(true);
            document.getElementById('app-footer')?.classList.add('app-footer-hidden');
            const selectedTab = document.querySelector('.tab-button[aria-selected="true"]');
            if (selectedTab) {
                switchTab(selectedTab.dataset.tab);
                setBottomNavActive(selectedTab.dataset.tab === 'admin-panel' ? 'bottom-admin-btn' : 'bottom-home-btn');
            } else {
                const fallbackTab = currentUser.uid === ADMIN_UID && currentMainSection === 'admin'
                    ? 'admin-panel'
                    : 'user-panel';
                switchTab(fallbackTab);
                setBottomNavActive(fallbackTab === 'admin-panel' ? 'bottom-admin-btn' : 'bottom-home-btn');
            }
        };

const openSlideMenu = () => {
            const menu = document.getElementById('slide-menu');
            const isAdmin = currentUser && currentUser.uid === ADMIN_UID;

            let adminItems = '';
            if (isAdmin) {
                adminItems = `
                    <hr class="border-gray-200 dark:border-gray-700 my-2">
                    <p class="text-xs font-semibold text-gray-400 uppercase px-4 pt-2">Admin</p>
                    <button id="slide-menu-admin-withdrawals" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>
                        Pending Requests
                    </button>
                    <button id="slide-menu-admin-users" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        User Management
                    </button>
                    <button id="slide-menu-admin-gift-codes" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
                        Gift Codes
                    </button>
                    <button id="slide-menu-admin-withdrawal-history" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        Withdrawal History
                    </button>
                    `;
            }

            menu.innerHTML = `
                <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 class="text-lg font-semibold">Menu</h3>
                    <button id="slide-menu-close-btn" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="p-2 space-y-1">
                    <button id="slide-menu-profile-btn" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        My Profile
                    </button>
                    <button id="slide-menu-settings-btn" class="flex items-center w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Settings
                    </button>
                    
                    ${adminItems}

                    <hr class="border-gray-200 dark:border-gray-700 my-2">
                    
                    <button id="slide-menu-logout-btn" class="flex items-center w-full text-left p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-3"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        Logout
                    </button>
                </div>
            `;

            document.getElementById('menu-overlay').classList.remove('hidden');
            menu.classList.remove('translate-x-full');

            // Add listeners
            document.getElementById('slide-menu-close-btn').onclick = closeSlideMenu;
            document.getElementById('slide-menu-profile-btn').onclick = () => { showProfilePage(); closeSlideMenu(); };
            document.getElementById('slide-menu-settings-btn').onclick = () => { showSettingsPage(); closeSlideMenu(); };
            if (isAdmin) {
                document.getElementById('slide-menu-admin-withdrawals').onclick = () => { showAdminWithdrawalsPage(); closeSlideMenu(); };
                document.getElementById('slide-menu-admin-users').onclick = () => { showAdminUsersPage(); closeSlideMenu(); };
                document.getElementById('slide-menu-admin-gift-codes').onclick = () => { showAdminGiftCodesPage(); closeSlideMenu(); };
                document.getElementById('slide-menu-admin-withdrawal-history').onclick = () => { showWithdrawalHistoryPage(); closeSlideMenu(); };
            }
            document.getElementById('slide-menu-logout-btn').onclick = () => {
                signOut(auth);
            };
        };

const closeSlideMenu = () => {
            document.getElementById('slide-menu').classList.add('translate-x-full');
            document.getElementById('menu-overlay').classList.add('hidden');
        };

const showBlockedAccountPage = (data = currentUserData || {}) => {
            const details = getBanDetails(data);
            hideLoading();
            setMainChrome(false);
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('main-content')?.classList.remove('hidden');
            document.getElementById('dashboard-content')?.classList.add('hidden');
            document.getElementById('menu-overlay')?.classList.add('hidden');
            document.getElementById('slide-menu')?.classList.add('translate-x-full');
            const pageContainer = document.getElementById('page-container');
            pageContainer.innerHTML = `
                <div class="min-h-[100dvh] flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
                    <div class="w-full max-w-md rounded-3xl bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900/50 shadow-xl overflow-hidden">
                        <div class="bg-gradient-to-br from-red-600 to-rose-700 p-6 text-white">
                            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path>
                                </svg>
                            </div>
                            <h2 class="text-center text-2xl font-black">Account Blocked</h2>
                            <p class="mt-2 text-center text-sm text-white/80">Your wallet access is currently limited by admin.</p>
                        </div>
                        <div class="space-y-4 p-5">
                            <div class="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4">
                                <p class="text-xs font-black uppercase text-red-500 dark:text-red-300">Reason</p>
                                <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(details.reason)}</p>
                            </div>
                            <div class="rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 p-4">
                                <p class="text-xs font-black uppercase text-gray-400">Ban Time</p>
                                <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(details.time)}</p>
                            </div>
                            <button id="blocked-contact-admin-btn" class="w-full rounded-2xl bg-blue-600 px-4 py-3 font-black text-white shadow-sm hover:bg-blue-700 transition">Contact Admin</button>
                        </div>
                    </div>
                </div>`;
            pageContainer.classList.remove('hidden');
            pageContainer.style.paddingBottom = '0';
            pageContainer.style.overflowY = 'hidden';
            document.getElementById('blocked-contact-admin-btn').onclick = () => {
                openSupportChatPage(currentUser.uid, 'user', {
                    initialMessage: `My account is blocked. Reason: ${details.reason}. Ban time: ${details.time}. Please help.`,
                    returnToBlocked: true,
                    blockedData: data
                });
            };
            if (currentUser?.uid) {
                preloadSupportChatForUser(currentUser.uid).catch(error => console.warn('Blocked support chat preload skipped:', error));
            }
        };

const showVerificationPendingPage = (data = currentUserData || {}) => {
            const details = getApprovalDetails(data);
            hideLoading();
            setMainChrome(false);
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('main-content')?.classList.remove('hidden');
            document.getElementById('dashboard-content')?.classList.add('hidden');
            document.getElementById('menu-overlay')?.classList.add('hidden');
            document.getElementById('slide-menu')?.classList.add('translate-x-full');
            const pageContainer = document.getElementById('page-container');
            pageContainer.innerHTML = `
                <div id="verification-pending-container" class="min-h-[100dvh] flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
                    <div class="w-full max-w-md rounded-3xl bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900/50 shadow-xl overflow-hidden">
                        <div class="bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white">
                            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 12l2 2 4-4"></path><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
                                </svg>
                            </div>
                            <h2 class="text-center text-2xl font-black">${escapeHtml(details.title)}</h2>
                            <p class="mt-2 text-center text-sm text-white/85">Admin review is required before wallet access.</p>
                        </div>
                        <div class="space-y-4 p-5">
                            <div class="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-4">
                                <p class="text-xs font-black uppercase text-amber-600 dark:text-amber-200">Status</p>
                                <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(details.message)}</p>
                            </div>
                            <div class="rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 p-4">
                                <p class="text-xs font-black uppercase text-gray-400">Account</p>
                                <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">${escapeHtml(data.name || data.email || 'New user')}</p>
                                ${details.requestedAt ? `<p class="mt-1 text-xs text-gray-500 dark:text-gray-300">Sent: ${new Date(details.requestedAt).toLocaleString('en-IN')}</p>` : ''}
                            </div>
                        </div>
                    </div>
                </div>`;
            pageContainer.classList.remove('hidden');
            pageContainer.style.paddingBottom = '0';
            pageContainer.style.overflowY = 'hidden';
        };

const getPageHeader = (title, options = {}) => `
            <header class="flex items-center mb-6 p-4 bg-white dark:bg-gray-800 shadow-md page-header-fixed">
                ${options.showBack === false ? '' : `
                    <button class="page-back-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                    </button>
                `}
                <h2 class="text-xl font-bold">${title}</h2>
            </header>
            <div class="p-4 pt-0">`;
const getPageFooter = () => `</div>`;

const showUserTaskHistoryPage = () => {
            if (!ensureUserSessionReady()) return;
            
            // Store current active tab on window so it persists across renders
            if (typeof window.userTaskHistoryActiveTab === 'undefined') {
                window.userTaskHistoryActiveTab = 'all';
            }

            const isBulker = isBulkTaskUser();
            const title = isBulker ? 'Task History (Bulker)' : 'Task History';

            const content = `
                <header class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-750 page-header-fixed">
                    <div class="flex items-center gap-3">
                        <button class="page-back-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-1 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                        </button>
                        <h2 class="text-lg font-black text-gray-900 dark:text-white">${title}</h2>
                    </div>
                    <div class="flex items-center gap-2">
                        ${!isBulker ? `
                        <select id="user-task-history-filter" class="rounded-xl bg-gray-50 dark:bg-gray-750 px-2.5 py-1.5 text-xs font-bold border border-gray-150 dark:border-gray-700 outline-none focus:ring-2 focus:ring-purple-500 shadow-sm cursor-pointer">
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="paid">Paid</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        ` : ''}
                    </div>
                </header>
                
                <div class="max-w-xl mx-auto space-y-4 pb-24 px-4 pt-4 text-left">
                    <!-- Category Tabs -->
                    <div class="flex items-center bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
                        ${['all', 'play_store', 'others'].map(tab => {
                            const isActive = window.userTaskHistoryActiveTab === tab;
                            const label = tab === 'all' ? 'All' : tab === 'play_store' ? 'Play Store' : 'Others';
                            return `
                                <button type="button" data-action="select-history-tab" data-tab="${tab}" class="flex-1 text-center py-2 text-xs font-black rounded-lg transition-all ${isActive ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}" style="outline: none;">
                                    ${label}
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <!-- List Container -->
                    <div id="user-task-history-list" class="space-y-3.5">
                        <div class="py-8 text-center text-sm text-gray-400">Loading history...</div>
                    </div>
                </div>
                ${getPageFooter()}`;

            showPage(content, { returnTo: 'settings', keepBottomNav: false });
            
            // Bind Tab Click Handlers
            const pageEl = document.getElementById('page-container');
            if (pageEl) {
                pageEl.querySelectorAll('[data-action="select-history-tab"]').forEach(btn => {
                    btn.onclick = (e) => {
                        window.userTaskHistoryActiveTab = e.currentTarget.dataset.tab;
                        // Re-open page to apply visual tab styles
                        showUserTaskHistoryPage();
                    };
                });
            }

            if (userTaskHistoryCache && userTaskHistoryCache.length > 0) {
                renderUserTaskHistory();
            }
            loadUserTaskHistory();

            const statusFilter = document.getElementById('user-task-history-filter');
            if (statusFilter) {
                statusFilter.onchange = renderUserTaskHistory;
            }
        };

const loadUserTaskHistory = async () => {
            if (userTaskHistoryLoading) return;
            userTaskHistoryLoading = true;
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/task-submissions`, {
                    headers: { Authorization: `Bearer ${token}` }
                }, 10000);
                const data = await response.json().catch(() => ({}));
                if (data.ok && Array.isArray(data.submissions)) {
                    userTaskHistoryCache = data.submissions;
                } else {
                    userTaskHistoryCache = [];
                }
            } catch (err) {
                console.error('Failed to load user task history:', err);
                userTaskHistoryCache = [];
            }
            userTaskHistoryLoading = false;
            renderUserTaskHistory();
        };

const renderUserTaskHistory = () => {
            const listEl = document.getElementById('user-task-history-list');
            if (!listEl) return;

            const categoryTab = window.userTaskHistoryActiveTab || 'all';
            const statusFilter = document.getElementById('user-task-history-filter')?.value || 'all';
            const isBulker = isBulkTaskUser();

            let subs = [...userTaskHistoryCache];

            // Filter by category
            if (categoryTab !== 'all') {
                subs = subs.filter(s => {
                    const isReview = !!(s.assigned_comment && String(s.assigned_comment).trim().length > 0);
                    return categoryTab === 'play_store' ? isReview : !isReview;
                });
            }

            // Filter by status (only for Single Users)
            if (!isBulker && statusFilter !== 'all') {
                if (statusFilter === 'paid') {
                    subs = subs.filter(s => s.payout_status === 'paid');
                } else if (statusFilter === 'approved') {
                    subs = subs.filter(s => s.manual_status === 'approved' && s.payout_status !== 'paid');
                } else {
                    subs = subs.filter(s => s.manual_status === statusFilter);
                }
            }

            if (subs.length === 0) {
                listEl.innerHTML = `<div class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 py-12 text-center text-sm font-semibold text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 shadow-sm">No submissions found.</div>`;
                return;
            }

            if (isBulker) {
                // Group submissions by task_id
                const taskGroups = {};
                subs.forEach(s => {
                    const tId = s.task_id || s.taskId;
                    if (!tId) return;
                    if (!taskGroups[tId]) {
                        taskGroups[tId] = {
                            taskId: tId,
                            taskName: s.app_name || s.taskTitle || 'Task',
                            logoUrl: s.app_logo_url || 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png',
                            taskLink: s.task_link || '',
                            reward: s.reward || 0,
                            submissions: [],
                            lastUpdated: s.submitted_at || 0
                        };
                    }
                    taskGroups[tId].submissions.push(s);
                    if (s.submitted_at > taskGroups[tId].lastUpdated) {
                        taskGroups[tId].lastUpdated = s.submitted_at;
                    }
                });

                const groupsArray = Object.values(taskGroups);
                if (groupsArray.length === 0) {
                    listEl.innerHTML = `<div class="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 py-12 text-center text-sm font-semibold text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 shadow-sm">No submissions found.</div>`;
                    return;
                }

                listEl.innerHTML = groupsArray.map(g => {
                    const submittedCount = g.submissions.length;
                    const approvedCount = g.submissions.filter(s => s.manual_status === 'approved').length;
                    const pendingCount = g.submissions.filter(s => s.manual_status === 'pending').length;
                    const rejectedCount = g.submissions.filter(s => s.manual_status === 'rejected').length;
                    
                    const completionPercent = submittedCount > 0 ? Math.round((approvedCount / submittedCount) * 100) : 0;
                    const updatedDate = g.lastUpdated ? new Date(g.lastUpdated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unknown';

                    return `
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-150 dark:border-gray-700 hover:border-purple-500 hover:shadow-md cursor-pointer transition select-none text-left space-y-3 shadow-sm" onclick="window.showBulkerTaskOverview('${g.taskId}')">
                        <div class="flex items-center gap-3">
                            <img src="${escapeHtml(g.logoUrl)}" class="h-11 w-11 rounded-xl object-cover border border-gray-100 dark:border-gray-700 shrink-0" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3176/3176366.png';">
                            <div class="min-w-0 flex-1">
                                <h4 class="text-sm font-extrabold text-gray-900 dark:text-white truncate">${escapeHtml(g.taskName)}</h4>
                                <p class="text-[10px] text-gray-400 font-bold mt-0.5 uppercase tracking-wide">Play Store Review • ₹${g.reward}</p>
                            </div>
                            <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
                        </div>
                        
                        <div class="grid grid-cols-4 gap-1 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-xl text-center text-[11px] font-bold">
                            <div>
                                <span class="block text-gray-500 dark:text-gray-400">${submittedCount}</span>
                                <span class="text-[8px] font-black text-gray-400 uppercase">Submitted</span>
                            </div>
                            <div>
                                <span class="block text-emerald-600 dark:text-emerald-400">${approvedCount}</span>
                                <span class="text-[8px] font-black text-emerald-500/70 uppercase">Approved</span>
                            </div>
                            <div>
                                <span class="block text-amber-500 dark:text-amber-400">${pendingCount}</span>
                                <span class="text-[8px] font-black text-amber-500/70 uppercase">Pending</span>
                            </div>
                            <div>
                                <span class="block text-rose-600 dark:text-rose-400">${rejectedCount}</span>
                                <span class="text-[8px] font-black text-rose-500/70 uppercase">Rejected</span>
                            </div>
                        </div>

                        <div class="space-y-1">
                            <div class="flex items-center justify-between text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">
                                <span>Completion Rate</span>
                                <span>${completionPercent}% Completed</span>
                            </div>
                            <div class="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                <div class="bg-purple-600 h-full rounded-full" style="width: ${completionPercent}%"></div>
                            </div>
                        </div>
                        
                        <p class="text-[9px] text-gray-400 dark:text-gray-500 font-semibold mt-1">Last Updated: ${updatedDate}</p>
                    </div>`;
                }).join('');

            } else {
                // Render Single User flow cards
                listEl.innerHTML = subs.map(s => {
                    const isReview = !!(s.assigned_comment && String(s.assigned_comment).trim().length > 0);
                    
                    const statusColor = s.manual_status === 'approved' ? 'green' : s.manual_status === 'rejected' ? 'red' : 'yellow';
                    const statusText = s.manual_status === 'approved' 
                        ? (s.payout_status === 'paid' ? 'Paid' : 'Approved') 
                        : (s.manual_status === 'rejected' ? 'Rejected' : 'Pending');
                    
                    const badgeIcon = s.manual_status === 'approved' 
                        ? `<svg class="h-3 w-3 inline text-emerald-600 dark:text-emerald-400 mr-1" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>`
                        : s.manual_status === 'rejected'
                            ? `<svg class="h-3 w-3 inline text-rose-600 dark:text-rose-455 mr-1" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>`
                            : `<svg class="h-3 w-3 inline text-amber-500 mr-1 animate-spin" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>`;

                    const timeStr = s.submitted_at 
                        ? new Date(s.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                        : 'Unknown';

                    const appLogo = s.app_logo_url || 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png';

                    const typeTag = isReview 
                        ? '<span class="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">Play Store Review</span>'
                        : '<span class="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">Screenshot Task</span>';

                    const payoutBadge = s.payout_status === 'paid' 
                        ? '<span class="rounded-full bg-cyan-100 dark:bg-cyan-900/30 px-2 py-0.5 text-[9px] font-black text-cyan-700 dark:text-cyan-300 ml-1.5 uppercase">PAID</span>' 
                        : '';

                    const subBadgeText = s.manual_status === 'pending' ? '7 Days Left' : s.manual_status === 'approved' ? 'Instant' : 'Completed';
                    const subBadge = `<span class="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[9px] font-bold text-gray-500 dark:text-gray-400">${subBadgeText}</span>`;

                    return `
                    <div class="flex items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-150 dark:border-gray-700 hover:border-purple-500 hover:shadow-md cursor-pointer transition select-none text-left shadow-sm" onclick="window.showUserTaskHistoryDetail('${s.id}')">
                        <img src="${escapeHtml(appLogo)}" class="h-11 w-11 rounded-xl object-cover border border-gray-100 dark:border-gray-700 shrink-0" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3176/3176366.png';">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between">
                                ${typeTag}
                            </div>
                            <h4 class="text-sm font-extrabold text-gray-900 dark:text-white truncate mt-0.5">${escapeHtml(s.app_name || 'Task Submission')}</h4>
                            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span class="flex items-center rounded-full bg-${statusColor}-100 dark:bg-${statusColor}-900/30 px-2 py-0.5 text-[9px] font-black text-${statusColor}-700 dark:text-${statusColor}-300 uppercase">
                                    ${badgeIcon}
                                    ${statusText}
                                </span>
                                ${payoutBadge}
                                ${subBadge}
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <p class="text-sm font-black text-purple-600 dark:text-purple-400">₹${s.reward}</p>
                            <p class="text-[9px] text-gray-455 dark:text-gray-500 font-bold mt-1">${timeStr}</p>
                        </div>
                    </div>`;
                }).join('');
            }
        };

window.showUserTaskHistoryDetail = (submissionId) => {
            const isBulker = isBulkTaskUser();
            if (isBulker) {
                window.showBulkerSubmissionDetail(submissionId);
                return;
            }

            const idx = userTaskHistoryCache.findIndex(x => x.id === submissionId);
            if (idx === -1) return;
            const s = userTaskHistoryCache[idx];

            const statusColor = s.manual_status === 'approved' ? 'green' : s.manual_status === 'rejected' ? 'red' : 'yellow';
            const statusText = s.manual_status === 'approved' 
                ? (s.payout_status === 'paid' ? 'Paid' : 'Approved') 
                : (s.manual_status === 'rejected' ? 'Rejected' : 'Pending');

            const timeStr = s.submitted_at 
                ? new Date(s.submitted_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                : 'Unknown';

            let details = {};
            try { details = s.details_json ? JSON.parse(s.details_json) : {}; } catch {}
            const gmailName = s.ocr_extracted_name || '';
            const appLogo = s.app_logo_url || 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png';

            const isReviewTask = !!(s.assigned_comment && String(s.assigned_comment).trim().length > 0);

            // Timeline setup
            let step2Text = 'Task is being verified by admin';
            let step2CircleClass = 'bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950 animate-pulse';
            let step2Icon = `<svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 8v4l3 3"></path></svg>`;

            if (s.manual_status === 'approved') {
                step2Text = 'Task verified successfully';
                step2CircleClass = 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950';
                step2Icon = `<svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;
            } else if (s.manual_status === 'rejected') {
                step2Text = isReviewTask && (s.scraper_status === 'not_live' || s.ocr_status === 'completed')
                    ? 'Your review is not live, so it is rejected'
                    : 'Your task is rejected';
                step2CircleClass = 'bg-rose-500 ring-4 ring-rose-100 dark:ring-rose-950';
                step2Icon = `<svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>`;
            }

            let step3Text = 'Amount initiation pending';
            let step3CircleClass = 'bg-gray-200 dark:bg-gray-700 ring-4 ring-gray-100 dark:ring-gray-900';
            let step3Icon = `<svg class="h-3 w-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle></svg>`;

            if (s.manual_status === 'approved') {
                if (s.payout_status === 'paid') {
                    step3Text = `Amount ₹${s.reward} credited to wallet`;
                    step3CircleClass = 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950';
                    step3Icon = `<svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;
                } else {
                    step3Text = 'Amount initiated for credit';
                    step3CircleClass = 'bg-purple-600 ring-4 ring-purple-100 dark:ring-purple-950 animate-pulse';
                    step3Icon = `<svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 8v4l3 3"></path></svg>`;
                }
            } else if (s.manual_status === 'rejected') {
                step3Text = 'Credit cancelled due to rejection';
                step3CircleClass = 'bg-gray-400 dark:bg-gray-600 ring-4 ring-gray-300 dark:ring-gray-850';
                step3Icon = `<svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>`;
            }

            const detailContent = `
                <header class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-750 page-header-fixed">
                    <div class="flex items-center gap-3">
                        <button class="page-back-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-1 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                        </button>
                        <h2 class="text-lg font-black text-gray-900 dark:text-white">Task Details</h2>
                    </div>
                    <button class="p-2 rounded-full hover:bg-gray-250 dark:hover:bg-gray-700 shrink-0 text-gray-500" onclick="showHelpSupportPage()">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                </header>

                <div class="max-w-xl mx-auto space-y-4 pb-24 px-4 pt-4 text-left">
                    <!-- App Card -->
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-150 dark:border-gray-700 space-y-4">
                        <div class="flex items-center gap-4">
                            <img src="${escapeHtml(appLogo)}" class="h-14 w-14 rounded-2xl object-cover border border-gray-100 dark:border-gray-700 shadow-sm shrink-0" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3176/3176366.png';">
                            <div class="min-w-0 flex-1">
                                <span class="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 rounded-full border border-purple-100/50 dark:border-purple-900/30">
                                    ${isReviewTask ? 'Play Store Review' : 'Screenshot Task'}
                                </span>
                                <h3 class="text-base font-extrabold text-gray-900 dark:text-white truncate mt-1">${escapeHtml(s.app_name || 'Task Submission')}</h3>
                                <p class="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                    <svg class="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"></path></svg>
                                    <span>Google Play Store</span>
                                </p>
                            </div>
                            <div class="text-right shrink-0">
                                <span class="text-xl font-black text-purple-600 dark:text-purple-400">₹${s.reward}</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-3 gap-2 text-center border-t border-gray-100 dark:border-gray-750 pt-4">
                            <div class="bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                <p class="text-xs font-black text-gray-850 dark:text-gray-200">₹${s.reward}</p>
                                <p class="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Payout</p>
                            </div>
                            <div class="bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                <p class="text-xs font-black text-gray-850 dark:text-gray-200">${s.manual_status === 'approved' ? 'Instant' : '7 Days'}</p>
                                <p class="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Approval Time</p>
                            </div>
                            <div class="bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                                <p class="text-xs font-black text-gray-850 dark:text-gray-200 truncate">${isReviewTask ? 'Play Store' : 'Screenshot'}</p>
                                <p class="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Task Type</p>
                            </div>
                        </div>
                    </div>

                    <!-- Stepper Timeline -->
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-150 dark:border-gray-700 space-y-4">
                        <p class="text-[10px] font-black uppercase text-gray-400 tracking-wider">Submission Timeline</p>
                        <div class="relative pl-7 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-150 dark:before:bg-gray-700">
                            <!-- Step 1: Submission -->
                            <div class="relative flex gap-3.5 items-start">
                                <span class="absolute -left-[27px] flex h-[24px] w-[24px] items-center justify-center rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-955">
                                    <svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                                </span>
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-bold text-gray-800 dark:text-gray-200">Screenshot Sent to Admin</p>
                                    <p class="text-[9px] text-gray-400 font-semibold mt-0.5">${timeStr}</p>
                                </div>
                            </div>

                            <!-- Step 2: Verification -->
                            <div class="relative flex gap-3.5 items-start">
                                <span class="absolute -left-[27px] flex h-[24px] w-[24px] items-center justify-center rounded-full ${step2CircleClass}">
                                    ${step2Icon}
                                </span>
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-bold text-gray-800 dark:text-gray-200">${step2Text}</p>
                                    <p class="text-[9px] text-gray-400 font-semibold mt-0.5">Status: <span class="uppercase font-black text-purple-600 dark:text-purple-400">${s.manual_status || 'PENDING'}</span></p>
                                </div>
                            </div>

                            <!-- Step 3: Payout -->
                            <div class="relative flex gap-3.5 items-start">
                                <span class="absolute -left-[27px] flex h-[24px] w-[24px] items-center justify-center rounded-full ${step3CircleClass}">
                                    ${step3Icon}
                                </span>
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-bold text-gray-800 dark:text-gray-200">${step3Text}</p>
                                    <p class="text-[9px] text-gray-400 font-semibold mt-0.5">Payment: <span class="uppercase font-black text-purple-600 dark:text-purple-400">${s.payout_status || 'PENDING'}</span></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Your Submission Section -->
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-150 dark:border-gray-700 space-y-4">
                        <p class="text-[10px] font-black uppercase text-gray-400 tracking-wider">Your Submission Proof</p>
                        
                        ${s.screenshot_url ? `
                        <div class="relative overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-950 flex items-center justify-center py-4 border border-gray-100 dark:border-gray-800">
                            <img id="user-detail-screenshot-img" src="${escapeHtml(s.screenshot_url)}" alt="Screenshot Proof" class="h-44 w-28 rounded-xl border border-gray-200 dark:border-gray-750 object-cover cursor-zoom-in hover:scale-102 transition shadow-md">
                        </div>
                        <div class="flex justify-between items-center text-[10px] text-gray-400">
                            <span>Click image to zoom</span>
                            <div class="flex gap-2">
                                ${s.task_link ? `<a href="${escapeHtml(s.task_link)}" target="_blank" class="text-purple-600 dark:text-purple-400 font-bold hover:underline">Play Store ↗</a>` : ''}
                                ${s.screenshot_view_url ? `<a href="${escapeHtml(s.screenshot_view_url)}" target="_blank" class="hover:underline">Drive 📁</a>` : ''}
                            </div>
                        </div>
                        ` : ''}

                        ${isReviewTask ? `
                        <div class="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-750">
                            <div class="flex items-center justify-between">
                                <p class="text-[10px] font-black uppercase text-gray-400 tracking-wider">Review Used</p>
                                <button class="text-xs text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1 select-none" onclick="copyToClipboard('${escapeHtml(s.assigned_comment || '')}')">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                                    <span>Copy</span>
                                </button>
                            </div>
                            <p class="mt-1.5 text-xs font-bold text-gray-850 dark:text-gray-250 italic bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-150 dark:border-gray-755 leading-relaxed font-mono">
                                "${escapeHtml(s.assigned_comment)}"
                            </p>
                        </div>

                        ${gmailName ? `
                        <div class="pt-3 border-t border-gray-100 dark:border-gray-750 space-y-1.5">
                            <p class="text-[10px] font-black uppercase text-gray-400 tracking-wider">Reviewer Gmail / Name</p>
                            <p class="text-xs font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                                ${details.gmailLogoUrl ? `<img src="${escapeHtml(details.gmailLogoUrl)}" class="h-5 w-5 rounded-full object-cover border" loading="lazy">` : `<span class="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-[9px] font-bold text-gray-400 dark:text-gray-300 shrink-0">G</span>`}
                                <span>${escapeHtml(gmailName)}</span>
                            </p>
                        </div>
                        ` : ''}
                        ` : ''}
                    </div>

                    ${isReviewTask ? `
                    <!-- Info Notice Card -->
                    <div class="bg-purple-50/50 dark:bg-purple-950/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/35 text-left flex gap-3 shadow-sm">
                        <span class="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </span>
                        <p class="text-xs font-bold text-purple-700 dark:text-purple-300 leading-relaxed">
                            We will check your review on Play Store. If found, it will be approved and added to your wallet.
                        </p>
                    </div>
                    
                    <button class="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 font-black text-sm text-white transition-all shadow-md active:scale-[0.98] border border-purple-500/20" onclick="window.showSubmissionStatusPage('${s.id}')">
                        View Submission Status
                    </button>
                    ` : ''}
                </div>
                ${getPageFooter()}
            `;

            showPage(detailContent, { returnTo: 'task-history', keepBottomNav: false, onBack: showUserTaskHistoryPage });

            const userScreenshotImg = document.getElementById('user-detail-screenshot-img');
            if (userScreenshotImg) {
                userScreenshotImg.onclick = () => {
                    window.showScreenshotLightbox(s.screenshot_url, s.screenshot_view_url || '');
                };
            }
        };

window.showSubmissionStatusPage = (submissionId) => {
            const idx = userTaskHistoryCache.findIndex(x => x.id === submissionId);
            if (idx === -1) return;
            const s = userTaskHistoryCache[idx];

            const appLogo = s.app_logo_url || 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png';
            const submittedTimeStr = s.submitted_at 
                ? new Date(s.submitted_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                : 'Unknown';

            // Calculate total counts for review tasks
            const reviewSubs = userTaskHistoryCache.filter(x => x.assigned_comment && String(x.assigned_comment).trim().length > 0);
            const uploadedCount = reviewSubs.length;
            const underReviewCount = reviewSubs.filter(x => x.manual_status === 'pending').length;
            const approvedCount = reviewSubs.filter(x => x.manual_status === 'approved').length;
            const rejectedCount = reviewSubs.filter(x => x.manual_status === 'rejected').length;

            const content = `
                <header class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-750 page-header-fixed">
                    <div class="flex items-center gap-3">
                        <button class="page-back-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-1 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                        </button>
                        <h2 class="text-lg font-black text-gray-900 dark:text-white">Submission Status</h2>
                    </div>
                </header>

                <div class="max-w-xl mx-auto space-y-4 pb-24 px-4 pt-4 text-left">
                    <!-- Summary Counts Rows -->
                    <div class="grid grid-cols-4 gap-2 text-center text-xs">
                        <div class="bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                            <span class="block text-lg font-black text-emerald-600 dark:text-emerald-400">${uploadedCount}</span>
                            <span class="text-[9px] font-black text-emerald-500/80 uppercase tracking-wide">Uploaded</span>
                        </div>
                        <div class="bg-purple-50/50 dark:bg-purple-950/20 p-2.5 rounded-2xl border border-purple-100 dark:border-purple-900/30 shadow-sm">
                            <span class="block text-lg font-black text-purple-600 dark:text-purple-400">${underReviewCount}</span>
                            <span class="text-[9px] font-black text-purple-500/80 uppercase tracking-wide">Under Review</span>
                        </div>
                        <div class="bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
                            <span class="block text-lg font-black text-blue-600 dark:text-blue-400">${approvedCount}</span>
                            <span class="text-[9px] font-black text-blue-500/80 uppercase tracking-wide">Approved</span>
                        </div>
                        <div class="bg-rose-50/50 dark:bg-rose-955/20 p-2.5 rounded-2xl border border-rose-100 dark:border-rose-900/30 shadow-sm">
                            <span class="block text-lg font-black text-rose-600 dark:text-rose-455">${rejectedCount}</span>
                            <span class="text-[9px] font-black text-rose-500/80 uppercase tracking-wide">Rejected</span>
                        </div>
                    </div>

                    <!-- Submission Details Card -->
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-150 dark:border-gray-700 space-y-3.5">
                        <h4 class="text-sm font-extrabold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-750 pb-2">Submission Details</h4>
                        
                        <div class="space-y-3 text-xs font-semibold text-gray-650 dark:text-gray-300">
                            <div class="flex justify-between">
                                <span class="text-gray-400">Task Name</span>
                                <span class="font-extrabold text-gray-800 dark:text-white text-right max-w-[200px] truncate">${escapeHtml(s.app_name || 'Task Submission')}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Task Type</span>
                                <span class="font-extrabold text-gray-800 dark:text-white">Play Store Review</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Payout</span>
                                <span class="font-extrabold text-purple-600 dark:text-purple-400">₹${s.reward}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Approval Time</span>
                                <span class="font-extrabold text-gray-850 dark:text-gray-200">7 Days</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Submitted On</span>
                                <span class="font-extrabold text-gray-850 dark:text-gray-200">${submittedTimeStr}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Info Notice Card -->
                    <div class="bg-purple-50/50 dark:bg-purple-950/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/35 text-left flex gap-3 shadow-sm">
                        <span class="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </span>
                        <p class="text-xs font-bold text-purple-700 dark:text-purple-300 leading-relaxed">
                            We will check your review on Play Store. If found, it will be approved and added to your wallet.
                        </p>
                    </div>
                </div>
                ${getPageFooter()}
            `;

            showPage(content, { returnTo: 'task-details', keepBottomNav: false, onBack: () => window.showUserTaskHistoryDetail(submissionId) });
        };

window.showBulkerTaskOverview = (taskId) => {
            const taskSubs = userTaskHistoryCache.filter(x => (x.task_id === taskId || x.taskId === taskId));
            if (taskSubs.length === 0) {
                showUserTaskHistoryPage();
                return;
            }
            const sample = taskSubs[0];
            const taskName = sample.app_name || sample.taskTitle || 'Task';
            const logoUrl = sample.app_logo_url || 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png';
            const reward = sample.reward || 0;

            const submittedCount = taskSubs.length;
            const approvedCount = taskSubs.filter(s => s.manual_status === 'approved').length;
            const pendingCount = taskSubs.filter(s => s.manual_status === 'pending').length;
            const rejectedCount = taskSubs.filter(s => s.manual_status === 'rejected').length;

            const completionPercent = submittedCount > 0 ? Math.round((approvedCount / submittedCount) * 100) : 0;
            const strokeDashoffset = 251.2 - (251.2 * completionPercent) / 100;

            const content = `
                <header class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-755 page-header-fixed">
                    <div class="flex items-center gap-3">
                        <button class="page-back-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-1 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                        </button>
                        <h2 class="text-lg font-black text-gray-900 dark:text-white">Task Overview</h2>
                    </div>
                </header>

                <div class="max-w-xl mx-auto space-y-4 pb-24 px-4 pt-4 text-left">
                    <!-- App Card -->
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-150 dark:border-gray-700 flex items-center gap-3.5">
                        <img src="${escapeHtml(logoUrl)}" class="h-11 w-11 rounded-xl object-cover border border-gray-100 dark:border-gray-700 shrink-0" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3176/3176366.png';">
                        <div class="min-w-0 flex-1">
                            <h4 class="text-sm font-extrabold text-gray-900 dark:text-white truncate">${escapeHtml(taskName)}</h4>
                            <p class="text-[10px] text-gray-400 font-bold mt-0.5 uppercase tracking-wide">Play Store Review • ₹${reward}</p>
                        </div>
                    </div>

                    <!-- Donut Chart & Breakdown -->
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-150 dark:border-gray-700 space-y-4 shadow-sm">
                        <h4 class="text-[10px] font-black uppercase text-gray-400 tracking-wider">Status Breakdown</h4>
                        <div class="flex flex-col sm:flex-row items-center justify-around gap-6">
                            <!-- SVG Donut Chart -->
                            <div class="relative h-28 w-28 shrink-0 flex items-center justify-center">
                                <svg class="h-full w-full -rotate-90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="40" stroke="rgba(243, 244, 246, 1)" stroke-width="8" fill="transparent" class="dark:stroke-gray-700" />
                                    <circle cx="50" cy="50" r="40" stroke="rgba(147, 51, 234, 1)" stroke-width="8" fill="transparent" stroke-dasharray="251.2" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" />
                                </svg>
                                <div class="absolute inset-0 flex flex-col items-center justify-center">
                                    <span class="text-base font-black text-gray-850 dark:text-white">${completionPercent}%</span>
                                    <span class="text-[8px] font-black text-gray-400 uppercase tracking-wide">Completed</span>
                                </div>
                            </div>

                            <!-- Counts -->
                            <div class="w-full space-y-2.5 font-bold text-xs">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                        <span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                                        <span>Approved</span>
                                    </div>
                                    <span class="text-gray-850 dark:text-white">${approvedCount} <span class="text-gray-450 text-[10px]">(${submittedCount > 0 ? Math.round(approvedCount / submittedCount * 100) : 0}%)</span></span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2 text-amber-500">
                                        <span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                                        <span>Pending / Under Review</span>
                                    </div>
                                    <span class="text-gray-850 dark:text-white">${pendingCount} <span class="text-gray-455 text-[10px]">(${submittedCount > 0 ? Math.round(pendingCount / submittedCount * 100) : 0}%)</span></span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                        <span class="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                                        <span>Rejected</span>
                                    </div>
                                    <span class="text-gray-850 dark:text-white">${rejectedCount} <span class="text-gray-450 text-[10px]">(${submittedCount > 0 ? Math.round(rejectedCount / submittedCount * 100) : 0}%)</span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Quick Actions -->
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-150 dark:border-gray-700 space-y-3.5 shadow-sm">
                        <h4 class="text-[10px] font-black uppercase text-gray-400 tracking-wider">Quick Actions</h4>
                        
                        <div class="space-y-2 text-xs">
                            <button class="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/10 border border-gray-100 dark:border-gray-800 transition active:scale-[0.99] font-extrabold text-gray-800 dark:text-white" onclick="window.showBulkerAllSubmissions('${taskId}', 'all')">
                                <span class="flex items-center gap-2">
                                    <span class="text-purple-600">📁</span>
                                    <span>View All Submissions</span>
                                </span>
                                <svg class="h-3.5 w-3.5 text-gray-450" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                            <button class="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/10 border border-gray-100 dark:border-gray-800 transition active:scale-[0.99] font-extrabold text-gray-800 dark:text-white" onclick="window.showBulkerAllSubmissions('${taskId}', 'pending')">
                                <span class="flex items-center gap-2">
                                    <span class="text-amber-500">⏳</span>
                                    <span>View Pending (${pendingCount})</span>
                                </span>
                                <svg class="h-3.5 w-3.5 text-gray-455" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                            <button class="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/10 border border-gray-100 dark:border-gray-800 transition active:scale-[0.99] font-extrabold text-gray-800 dark:text-white" onclick="window.showBulkerAllSubmissions('${taskId}', 'rejected')">
                                <span class="flex items-center gap-2">
                                    <span class="text-rose-500">❌</span>
                                    <span>View Rejected (${rejectedCount})</span>
                                </span>
                                <svg class="h-3.5 w-3.5 text-gray-450" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                            <button class="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-955 border border-gray-100 dark:border-gray-800 transition active:scale-[0.99] font-extrabold text-gray-850 dark:text-white" onclick="window.exportBulkerReport('${taskId}')">
                                <span class="flex items-center gap-2">
                                    <span class="text-blue-500">📥</span>
                                    <span>Export Report (CSV)</span>
                                </span>
                                <svg class="h-3.5 w-3.5 text-gray-455" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}
            `;

            showPage(content, { returnTo: 'task-history', keepBottomNav: false, onBack: showUserTaskHistoryPage });
        };

window.exportBulkerReport = (taskId) => {
            const taskSubs = userTaskHistoryCache.filter(x => (x.task_id === taskId || x.taskId === taskId));
            if (taskSubs.length === 0) return;
            
            const headers = ["Submission ID", "App Name", "Status", "Payout Status", "Reward", "Submitted At"];
            const rows = taskSubs.map(s => {
                const dateStr = s.submitted_at ? new Date(s.submitted_at).toLocaleString('en-IN') : 'Unknown';
                return [
                    s.id,
                    s.app_name || 'Task',
                    s.manual_status || 'pending',
                    s.payout_status || 'pending',
                    s.reward || 0,
                    dateStr
                ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
            });

            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `submissions_report_${taskId}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showNotification('Report CSV downloaded successfully.');
        };

window.showBulkerAllSubmissions = (taskId, filter = 'all') => {
            const taskSubs = userTaskHistoryCache.filter(x => (x.task_id === taskId || x.taskId === taskId));
            if (taskSubs.length === 0) {
                showUserTaskHistoryPage();
                return;
            }

            const totalCount = taskSubs.length;
            const approvedCount = taskSubs.filter(s => s.manual_status === 'approved').length;
            const pendingCount = taskSubs.filter(s => s.manual_status === 'pending').length;
            const rejectedCount = taskSubs.filter(s => s.manual_status === 'rejected').length;

            let filtered = [...taskSubs];
            if (filter === 'approved') {
                filtered = filtered.filter(s => s.manual_status === 'approved');
            } else if (filter === 'pending') {
                filtered = filtered.filter(s => s.manual_status === 'pending');
            } else if (filter === 'rejected') {
                filtered = filtered.filter(s => s.manual_status === 'rejected');
            }

            const content = `
                <header class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-755 page-header-fixed">
                    <div class="flex items-center gap-3">
                        <button class="page-back-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-1 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                        </button>
                        <h2 class="text-lg font-black text-gray-900 dark:text-white">All Submissions</h2>
                    </div>
                </header>

                <div class="max-w-xl mx-auto space-y-4 pb-24 px-4 pt-4">
                    <!-- Filter Chips -->
                    <div class="flex flex-wrap items-center gap-2">
                        ${[
                            { val: 'all', label: `All (${totalCount})` },
                            { val: 'approved', label: `Approved (${approvedCount})` },
                            { val: 'pending', label: `Pending (${pendingCount})` },
                            { val: 'rejected', label: `Rejected (${rejectedCount})` }
                        ].map(chip => {
                            const isActive = filter === chip.val;
                            return `
                                <button type="button" class="rounded-xl px-3.5 py-2 text-[10px] font-black uppercase tracking-wider transition-all border ${isActive ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 border-gray-150 dark:border-gray-700 text-gray-550 dark:text-gray-400 hover:bg-gray-50'}" onclick="window.showBulkerAllSubmissions('${taskId}', '${chip.val}')" style="outline: none;">
                                    ${chip.label}
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <!-- Submissions Grid -->
                    <div class="grid grid-cols-2 gap-3.5">
                        ${filtered.length === 0 ? `
                            <div class="col-span-2 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 py-12 text-center text-sm font-semibold text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 shadow-sm">
                                No submissions matching filter.
                            </div>
                        ` : filtered.map((s, index) => {
                            const statusColor = s.manual_status === 'approved' ? 'green' : s.manual_status === 'rejected' ? 'red' : 'yellow';
                            const statusText = s.manual_status === 'approved' ? 'Approved' : s.manual_status === 'rejected' ? 'Rejected' : 'Pending';
                            const indexNum = filtered.length - index;
                            const dateStr = s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unknown';

                            return `
                            <div class="bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-150 dark:border-gray-700 space-y-2 hover:border-purple-500 transition cursor-pointer flex flex-col text-left shadow-sm" onclick="window.showBulkerSubmissionDetail('${s.id}')">
                                <div class="flex items-center justify-between text-[11px] font-bold border-b border-gray-100 dark:border-gray-750 pb-1.5">
                                    <span class="text-gray-405">#${indexNum}</span>
                                    <span class="text-purple-600 dark:text-purple-400">⋮</span>
                                </div>
                                
                                <div class="relative aspect-[9/12] rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center">
                                    <img src="${escapeHtml(s.screenshot_url)}" class="h-full w-full object-cover" loading="lazy">
                                    <span class="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[8px] font-black uppercase text-${statusColor}-700 bg-${statusColor}-100/90 dark:text-${statusColor}-300 dark:bg-${statusColor}-900/80 backdrop-blur-sm shadow-sm">
                                        ${statusText}
                                    </span>
                                </div>
                                
                                <div class="text-[9px] text-gray-400 font-semibold space-y-0.5">
                                    <p class="truncate font-black text-gray-800 dark:text-gray-200 text-xs">${escapeHtml(s.app_name || 'Submission')}</p>
                                    <p>${dateStr}</p>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
                ${getPageFooter()}
            `;

            showPage(content, { returnTo: 'task-overview', keepBottomNav: false, onBack: () => window.showBulkerTaskOverview(taskId) });
        };

window.showBulkerSubmissionDetail = (submissionId) => {
            const idx = userTaskHistoryCache.findIndex(x => x.id === submissionId);
            if (idx === -1) return;
            const s = userTaskHistoryCache[idx];

            const isReviewTask = !!(s.assigned_comment && String(s.assigned_comment).trim().length > 0);
            const appLogo = s.app_logo_url || 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png';
            const statusColor = s.manual_status === 'approved' ? 'green' : s.manual_status === 'rejected' ? 'red' : 'yellow';
            const statusText = s.manual_status === 'approved' ? 'Approved' : s.manual_status === 'rejected' ? 'Rejected' : 'Pending';

            const submittedTimeStr = s.submitted_at 
                ? new Date(s.submitted_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                : 'Unknown';

            let details = {};
            try { details = s.details_json ? JSON.parse(s.details_json) : {}; } catch {}
            const gmailName = s.ocr_extracted_name || '';

            const content = `
                <header class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-755 page-header-fixed">
                    <div class="flex items-center gap-3">
                        <button class="page-back-btn p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-1 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                        </button>
                        <h2 class="text-lg font-black text-gray-900 dark:text-white">Submission Detail</h2>
                    </div>
                </header>

                <div class="max-w-xl mx-auto space-y-4 pb-24 px-4 pt-4 text-left">
                    <!-- App Card / Screenshot Details -->
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-150 dark:border-gray-700 space-y-4">
                        <div class="flex items-center gap-4">
                            <img src="${escapeHtml(appLogo)}" class="h-11 w-11 rounded-xl object-cover border border-gray-100 dark:border-gray-700 shrink-0" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3176/3176366.png';">
                            <div class="min-w-0 flex-1">
                                <h4 class="text-sm font-extrabold text-gray-900 dark:text-white truncate">${escapeHtml(s.app_name || 'Submission')}</h4>
                                <p class="text-[10px] text-gray-400 font-bold mt-0.5 uppercase tracking-wide">Play Store Review • ₹${s.reward}</p>
                            </div>
                        </div>

                        ${s.screenshot_url ? `
                        <div class="relative overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-950 flex items-center justify-center py-4 border border-gray-100 dark:border-gray-800">
                            <img id="bulker-detail-screenshot-img" src="${escapeHtml(s.screenshot_url)}" alt="Screenshot Proof" class="h-44 w-28 rounded-xl border border-gray-200 dark:border-gray-750 object-cover cursor-zoom-in hover:scale-102 transition shadow-md">
                        </div>
                        ` : ''}

                        <div class="space-y-3.5 text-xs font-semibold text-gray-655 dark:text-gray-300">
                            <div class="flex justify-between">
                                <span class="text-gray-400">Submission ID</span>
                                <span class="font-extrabold text-gray-850 dark:text-white font-mono select-all">#${s.id}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Status</span>
                                <span class="rounded-full bg-${statusColor}-100 dark:bg-${statusColor}-900/30 px-2.5 py-0.5 text-[10px] font-black text-${statusColor}-700 dark:text-${statusColor}-300 uppercase">${statusText}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Submitted On</span>
                                <span class="font-extrabold text-gray-850 dark:text-white">${submittedTimeStr}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Task Name</span>
                                <span class="font-extrabold text-gray-850 dark:text-white text-right max-w-[200px] truncate">${escapeHtml(s.app_name || 'Task')}</span>
                            </div>
                            
                            ${isReviewTask ? `
                            <div class="flex justify-between border-t border-gray-100 dark:border-gray-755 pt-3">
                                <span class="text-gray-400 shrink-0">Review Used</span>
                                <span class="font-extrabold text-gray-800 dark:text-gray-250 italic text-right max-w-[200px] break-words font-mono">${escapeHtml(s.assigned_comment)}</span>
                            </div>
                            ${gmailName ? `
                            <div class="flex justify-between">
                                <span class="text-gray-400">Gmail Reviewer</span>
                                <span class="font-extrabold text-gray-850 dark:text-white flex items-center gap-1.5">
                                    ${details.gmailLogoUrl ? `<img src="${escapeHtml(details.gmailLogoUrl)}" class="h-4.5 w-4.5 rounded-full object-cover border" loading="lazy">` : ''}
                                    <span>${escapeHtml(gmailName)}</span>
                                </span>
                            </div>
                            ` : ''}
                            ` : ''}
                        </div>

                        <div class="grid grid-cols-2 gap-2.5 pt-2">
                            ${isReviewTask ? `
                            <button class="py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 font-extrabold text-xs transition-all active:scale-[0.98] border border-purple-100/50 dark:border-purple-900/30 flex items-center justify-center gap-1" onclick="copyToClipboard('${escapeHtml(s.assigned_comment || '')}')">
                                <span>View Review Used</span>
                            </button>
                            ` : ''}
                            <button class="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition-all active:scale-[0.98] ${!isReviewTask ? 'col-span-2' : ''}" id="bulker-screenshot-zoom-btn">
                                View Full Screenshot
                            </button>
                        </div>
                    </div>

                    <!-- Rejection reasons (Example) -->
                    ${s.manual_status === 'rejected' ? `
                    <div class="bg-rose-50/50 dark:bg-rose-955/10 p-5 rounded-2xl border border-rose-100 dark:border-rose-900/35 space-y-3.5 shadow-sm text-left">
                        <span class="rounded-xl bg-red-500 text-white font-extrabold px-2.5 py-1 text-[9px] tracking-wider uppercase shadow-sm">Rejected</span>
                        <div class="space-y-3 text-xs">
                            <div class="flex justify-between border-b border-rose-100/30 pb-2">
                                <span class="text-rose-600/70 dark:text-rose-400/70 font-semibold">Submission ID</span>
                                <span class="font-extrabold text-rose-700 dark:text-rose-350 font-mono">#${s.id}</span>
                            </div>
                            <div class="flex justify-between border-b border-rose-100/30 pb-2">
                                <span class="text-rose-600/70 dark:text-rose-400/70 font-semibold">Submitted On</span>
                                <span class="font-extrabold text-rose-700 dark:text-rose-350">${submittedTimeStr}</span>
                            </div>
                            <div class="flex justify-between border-b border-rose-100/30 pb-2">
                                <span class="text-rose-600/70 dark:text-rose-400/70 font-semibold">Reason</span>
                                <span class="font-black text-rose-700 dark:text-rose-350">${isReviewTask ? 'Review not found on Play Store' : 'Screenshot Verification Failed'}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-rose-600/70 dark:text-rose-400/70 font-semibold">Details</span>
                                <span class="font-bold text-rose-700 dark:text-rose-350 text-right max-w-[200px]">
                                    ${isReviewTask 
                                        ? "We couldn't find your review on Play Store. Please check if your review is live on Google Play Store." 
                                        : "The uploaded screenshot was not verified by admin."}
                                </span>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- STATUS MEANING -->
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-150 dark:border-gray-700 space-y-4 shadow-sm">
                        <p class="text-[10px] font-black uppercase text-gray-400 tracking-wider">STATUS MEANING</p>
                        <div class="space-y-3 text-xs font-semibold">
                            <div class="flex items-start gap-2.5">
                                <span class="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                                <div class="min-w-0">
                                    <p class="font-extrabold text-emerald-600">Approved</p>
                                    <p class="text-[10px] text-gray-450 dark:text-gray-400 mt-0.5">Review found on Play Store. Payout will be added.</p>
                                </div>
                            </div>
                            <div class="flex items-start gap-2.5">
                                <span class="h-2 w-2 rounded-full bg-orange-400 mt-1.5 shrink-0"></span>
                                <div class="min-w-0">
                                    <p class="font-extrabold text-orange-500">Pending / Under Review</p>
                                    <p class="text-[10px] text-gray-455 dark:text-gray-400 mt-0.5">We are checking your review on Play Store.</p>
                                </div>
                            </div>
                            <div class="flex items-start gap-2.5">
                                <span class="h-2 w-2 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
                                <div class="min-w-0">
                                    <p class="font-extrabold text-indigo-500">Under Review</p>
                                    <p class="text-[10px] text-gray-450 dark:text-gray-400 mt-0.5">Screenshot received, verification in progress.</p>
                                </div>
                            </div>
                            <div class="flex items-start gap-2.5">
                                <span class="h-2 w-2 rounded-full bg-red-500 mt-1.5 shrink-0"></span>
                                <div class="min-w-0">
                                    <p class="font-extrabold text-red-600">Rejected</p>
                                    <p class="text-[10px] text-gray-450 dark:text-gray-400 mt-0.5">Review not found / Policy mismatch / Other issue.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}
            `;

            showPage(content, { returnTo: 'all-submissions', keepBottomNav: false, onBack: () => window.showBulkerAllSubmissions(s.task_id || s.taskId, 'all') });

            const userScreenshotImg = document.getElementById('bulker-detail-screenshot-img');
            const zoomBtn = document.getElementById('bulker-screenshot-zoom-btn');
            const zoomAction = () => {
                window.showScreenshotLightbox(s.screenshot_url, s.screenshot_view_url || '');
            };
            if (userScreenshotImg) userScreenshotImg.onclick = zoomAction;
            if (zoomBtn) zoomBtn.onclick = zoomAction;
        };

const showUserLiveListsPage = () => {
            if (!ensureUserSessionReady()) return;
            const content = `
                ${getPageHeader('Live Lists Verification')}
                <div class="max-w-xl mx-auto space-y-4 pb-24 px-4">
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
                        <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            Here you can verify if your reviewer name is listed in the live lists uploaded by the admin for different apps.
                        </p>
                        <input type="text" id="user-live-lists-search" placeholder="🔍 Search app name or reviewer name..." class="mt-3 w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm border border-gray-100 dark:border-gray-700">
                    </div>
                    <div id="user-live-lists-container" class="space-y-4">
                        <div class="py-8 text-center text-sm text-gray-400">Loading lists...</div>
                    </div>
                </div>
                ${getPageFooter()}`;

            showPage(content, { returnTo: 'settings', keepBottomNav: false });
            
            loadUserLiveLists();

            document.getElementById('user-live-lists-search').addEventListener('input', renderUserLiveLists);
        };

const openFullscreenScreenshotHistory = (url) => {
            const overlay = document.createElement('div');
            overlay.id = 'fullscreen-ss-overlay';
            overlay.className = 'fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/95 p-4 cursor-zoom-out';
            
            // Prevent background page from scrolling
            document.body.style.overflow = 'hidden';

            const removeOverlay = () => {
                overlay.remove();
                document.body.style.overflow = '';
            };

            overlay.onclick = removeOverlay;
            overlay.innerHTML = `
                <div class="relative max-w-3xl max-h-[85vh] flex items-center justify-center">
                    <img src="${url}" class="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain border border-gray-800">
                </div>
                <div class="mt-4 flex gap-2 shrink-0" onclick="event.stopPropagation()">
                    <button id="fullscreen-close-btn" class="rounded-xl bg-gray-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-650 transition">✕ Close</button>
                </div>`;
            document.body.appendChild(overlay);
            
            const closeBtn = document.getElementById('fullscreen-close-btn');
            if (closeBtn) {
                closeBtn.onclick = removeOverlay;
            }
        };

const showHomeMainPage = () => {
            if (activeChatUnsubscribe) {
                activeChatUnsubscribe();
                activeChatUnsubscribe = null;
            }
            document.getElementById('dashboard-content').classList.remove('hidden');
            document.getElementById('page-container').classList.add('hidden');
            document.getElementById('page-container').innerHTML = '';
            setMainChrome(true);
            document.getElementById('app-footer')?.classList.add('app-footer-hidden');
            currentMainSection = 'home';
            switchTab('user-panel');
            setBottomNavActive('bottom-home-btn');
        };

const showReferEarnPage = () => {
            if (!ensureUserSessionReady()) return;
            if (activeChatUnsubscribe) {
                activeChatUnsubscribe();
                activeChatUnsubscribe = null;
            }
            const reward = getReferralRewardAmount();
            const rewardText = formatCurrency(reward).replace('.00', '');
            const rawReferralSeed = String(
                currentUserData?.referralCode ||
                currentUserData?.referCode ||
                currentUserData?.inviteCode ||
                currentUserData?.mobile ||
                currentUser?.uid ||
                'RWUSER'
            ).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const referralCode = rawReferralSeed.startsWith('RW')
                ? rawReferralSeed.slice(0, 12)
                : `RW${rawReferralSeed.slice(-6) || 'USER'}`;
            const content = `
                <header class="refer-page-header flex items-center mb-3 px-4 py-3 bg-white dark:bg-gray-800 shadow-md page-header-fixed">
                    <h2 class="text-xl font-bold">Refer & Earn</h2>
                </header>
                <div class="refer-page-body px-3 pb-0">
                <div class="refer-page-shell refer-one-screen mx-auto max-w-md px-0">
                    <section class="refer-poster-card refer-one-card">
                        <div class="refer-text-head refer-compact-head">
                            <span>Refer & Earn</span>
                            <h3>Invite friends. Earn together.</h3>
                            <p>You and your friend both get rewards after the first withdrawal.</p>
                        </div>
                        <div class="refer-offer-strip refer-compact-offers">
                            <div>
                                <span>You get</span>
                                <strong>${rewardText}</strong>
                            </div>
                            <div>
                                <span>Friend gets</span>
                                <strong>${rewardText}</strong>
                            </div>
                            <div>
                                <span>Lifetime</span>
                                <strong>1%</strong>
                            </div>
                        </div>
                        <div class="refer-steps-compact">
                            <article class="refer-mini-step">
                                <span class="refer-step-node">
                                    <img src="${REFER_ICON_URL}" alt="Invite" loading="lazy" decoding="async">
                                </span>
                                <div>
                                    <p>Step 1</p>
                                    <h4>Share code</h4>
                                    <span>Send it to a friend.</span>
                                </div>
                            </article>
                            <article class="refer-mini-step">
                                <span class="refer-step-node">
                                    <img src="https://cdn-icons-png.flaticon.com/512/681/681494.png" alt="Friend joins" loading="lazy" decoding="async">
                                </span>
                                <div>
                                    <p>Step 2</p>
                                    <h4>Friend joins</h4>
                                    <span>They create account.</span>
                                </div>
                            </article>
                            <article class="refer-mini-step">
                                <span class="refer-step-node">
                                    <img src="https://cdn-icons-png.flaticon.com/512/7939/7939990.png" alt="First withdrawal" loading="lazy" decoding="async">
                                </span>
                                <div>
                                    <p>Step 3</p>
                                    <h4>First withdrawal</h4>
                                    <span>Both get ${rewardText}.</span>
                                </div>
                            </article>
                            <article class="refer-mini-step">
                                <span class="refer-step-node">
                                    <img src="${PARTNER_ICON_URL}" alt="Lifetime income" loading="lazy" decoding="async">
                                </span>
                                <div>
                                    <p>Lifetime</p>
                                    <h4>Earn 1% income</h4>
                                    <span>On friend withdrawals.</span>
                                </div>
                            </article>
                        </div>
                        <div class="refer-share-card refer-compact-share">
                            <div>
                                <p>Referral code</p>
                                <h4>${escapeHtml(referralCode)}</h4>
                            </div>
                            <button type="button" disabled>
                                <span>Coming Soon</span>
                            </button>
                        </div>
                    </section>
                </div>
                </div>`;
            showPage(content, { keepBottomNav: true, returnTo: currentUser?.uid === ADMIN_UID ? 'admin' : 'home' });
            currentMainSection = 'refer';
            setBottomNavActive('bottom-refer-btn');
        };

const showUserTaskPageLegacy = () => {
            if (!ensureUserSessionReady()) return;
            currentMainSection = 'task';
            const content = `
                <header class="mb-4 flex items-center justify-between bg-white dark:bg-gray-800 px-4 py-3 shadow-sm page-header-fixed">
                    <h2 class="text-base font-extrabold uppercase text-slate-950 dark:text-white">Task Mission</h2>
                    <span class="h-9 w-9 overflow-hidden rounded-full bg-slate-100 p-1 dark:bg-slate-700">
                        <img src="${RW_LOGO_URL}" alt="REVIEWS WORLD" class="h-full w-full rounded-full object-cover">
                    </span>
                </header>
                <div class="px-4 pt-1 pb-28">
                    <div class="mx-auto max-w-xl space-y-4">
                        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-gray-800">
                            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 p-3 shadow-lg">
                                <img src="https://cdn-icons-png.flaticon.com/512/3176/3176366.png" alt="Tasks" class="h-full w-full object-contain">
                            </div>
                            <p class="mt-5 text-xs font-extrabold uppercase text-blue-600">Coming Soon</p>
                            <h3 class="mt-2 text-2xl font-extrabold text-slate-950 dark:text-white">Live missions are being prepared</h3>
                            <p class="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">Task work will open here after admin makes it live.</p>
                        </section>

                        <section class="space-y-3 opacity-60">
                            <div class="flex items-center justify-between px-1">
                                <p class="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-300">Live Missions</p>
                                <span class="text-[11px] font-bold text-gray-400">0 available</span>
                            </div>
                            <label class="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <svg class="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"></path></svg>
                                <input type="search" disabled placeholder="Search app tasks..." class="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-500">
                            </label>
                            <div class="pointer-events-none rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-gray-900">
                                <div class="flex items-center gap-3">
                                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-400 dark:border-slate-700 dark:bg-gray-800">APP</span>
                                    <span class="min-w-0 flex-1">
                                        <span class="block text-sm font-extrabold text-slate-700 dark:text-slate-200">Sample Task</span>
                                        <span class="mt-1 inline-flex rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-300">Instant</span>
                                    </span>
                                    <span class="text-right">
                                        <span class="block text-[8px] font-extrabold uppercase text-slate-400">Reward</span>
                                        <span class="block text-lg font-extrabold text-slate-400">₹--</span>
                                    </span>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: currentUser?.uid === ADMIN_UID ? 'admin' : 'home', keepBottomNav: true });
            setBottomNavActive('bottom-task-btn');
        };

const getPayoutDelayText = (t) => {
    const days = t.paymentDelayDays ?? t.paymentDays ?? t.payoutDelayDays ?? 7;
    const numDays = Number(days);
    if (isNaN(numDays) || numDays <= 0) return 'Instant Payout';
    if (numDays === 1) return '1 Day Payout';
    return `${numDays} Days Payout`;
};

const getPayoutCleanVal = (t) => {
    const days = t.paymentDelayDays ?? t.paymentDays ?? t.payoutDelayDays ?? 7;
    const numDays = Number(days);
    if (isNaN(numDays) || numDays <= 0) return 'Instant';
    if (numDays === 1) return '1 Day';
    return `${numDays} Days`;
};

const getTaskAccent = (subtype) => {
    if (subtype === 'app_review' || subtype === 'app_download_task') {
        return {
            color: 'indigo',
            bgPill: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/40',
            bgBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/10 hover:shadow-indigo-600/20',
            textClass: 'text-indigo-600 dark:text-indigo-400 font-extrabold',
            iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
            bannerGradient: 'from-indigo-600 to-violet-600'
        };
    } else if (subtype === 'map_review') {
        return {
            color: 'emerald',
            bgPill: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/40',
            bgBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/10 hover:shadow-emerald-600/20',
            textClass: 'text-emerald-600 dark:text-emerald-400 font-extrabold',
            iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            bannerGradient: 'from-emerald-600 to-teal-600'
        };
    } else {
        return {
            color: 'orange',
            bgPill: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200/40',
            bgBtn: 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-600/10 hover:shadow-orange-600/20',
            textClass: 'text-orange-600 dark:text-orange-400 font-extrabold',
            iconBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
            bannerGradient: 'from-orange-500 to-amber-500'
        };
    }
};

const showUserTaskPage = () => {
            if (!ensureUserSessionReady()) return;
            currentMainSection = 'task';
            const isTaskPageEnabled = !!appConfigCache?.task_page_enabled;
            let taskCategories = [];

            if (isTaskPageEnabled) {
                const appReviewItems = [];
                const mapReviewItems = [];
                const socialTaskItems = [];

                const isTaskVisibleToUser = (task) => {
                    const parentAdminId = currentUserData?.parentAdmin || currentUserData?.parent_admin || ADMIN_UID;
                    const isOwnerTask = !task.createdBy || task.createdBy === ADMIN_UID || task.createdBy === 'owner';
                    if (parentAdminId === ADMIN_UID) {
                        return isOwnerTask;
                    }
                    if (task.createdBy === parentAdminId) return true;
                    if (isOwnerTask && (task.assignedToSubAdmins?.includes(parentAdminId) || task.assignedToSubAdmins?.includes('all'))) return true;
                    return false;
                };

                const isBulker = isBulkTaskUser();
                const hideNewTasksForDailyLimit = !isBulker && userTaskTodaySubmissionIds.size >= NORMAL_USER_DAILY_TASK_LIMIT;

                allTasksCache
                    .filter(isTaskVisibleToUser)
                    .filter(task => getAdminTaskEffectiveStatus(task) === 'active')
                    .filter(task => {
                        // Show task if user hasn't submitted it today
                        if (!userTaskTodaySubmissionIds.has(task.id)) return true;
                        // If they have submitted it today: for bulkers, keep visible (to track upload status/queue)
                        const subtype = task.subtype || task.taskSubtype || '';
                        if (subtype === 'read_news') return false;
                        if (isBulker) {
                            return true;
                        }
                        return false;
                    })
                    .filter(() => !hideNewTasksForDailyLimit)
                    .forEach(task => {
                        const subtype = task.subtype || task.taskSubtype || '';
                        if (subtype === 'app_review' || subtype === 'app_download_task') {
                            appReviewItems.push(task);
                        } else if (subtype === 'map_review' || subtype === 'trustpilot_review' || subtype === 'website_review') {
                            mapReviewItems.push(task);
                        } else {
                            socialTaskItems.push(task);
                        }
                    });

                taskCategories = [
                    {
                        label: 'App Review',
                        accent: 'task-accent-blue',
                        logo: PLAY_STORE_LOGO_URL,
                        items: appReviewItems
                    },
                    {
                        label: 'Map Review',
                        accent: 'task-accent-emerald',
                        logo: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
                        items: mapReviewItems
                    },
                    {
                        label: 'Social Media Task',
                        accent: 'task-accent-rose',
                        logo: 'https://cdn-icons-png.flaticon.com/512/4187/4187336.png',
                        items: socialTaskItems
                    }
                ].filter(cat => cat.items.length > 0);
            }
            const renderTaskCard = (category, task, index) => {
                const isReal = isTaskPageEnabled;
                const status = isReal ? getAdminTaskEffectiveStatus(task) : 'draft';
                const isLive = isReal && status === 'active';
                const reward = isReal ? `₹${task.rate || task.reward || 0}` : task.reward;
                const imageUrl = isReal ? (task.imageUrl || category.logo) : category.logo;
                const taskTitle = isReal ? (task.title || 'Task Mission') : task.title;

                const subtype = task.subtype || task.taskSubtype || '';
                const acc = getTaskAccent(subtype);

                const taskTypeLabel = (subtype === 'app_review' || subtype === 'app_download_task') ? 'Play Store Review' : (subtype === 'map_review' ? 'Map Review' : 'Screenshot Task');
                const platformLabel = (subtype === 'app_review' || subtype === 'app_download_task') ? 'Play Store App Review' : (subtype === 'map_review' ? 'Google Maps Place Review' : 'Screenshot + Review');
                const platformLogo = (subtype === 'app_review' || subtype === 'app_download_task') ? PLAY_STORE_LOGO_URL : (subtype === 'map_review' ? 'https://cdn-icons-png.flaticon.com/512/854/854878.png' : 'https://cdn-icons-png.flaticon.com/512/4187/4187336.png');

                const payoutVal = getPayoutCleanVal(task);
                const approvalVal = payoutVal === 'Instant' ? 'Instant' : `${payoutVal} Later`;
                const limitVal = task.limit || 300;
                const submissionsCount = task.timesUsed ?? task.submissionsCount ?? 0;
                const availableComments = Math.max(0, limitVal - submissionsCount);

                if (isLive) {
                    return `
                        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[1.75rem] p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex flex-col gap-4 cursor-pointer" data-action="open-user-task" data-taskid="${task.id}">
                            <!-- Top Row: Icon, Title & Reward -->
                            <div class="flex items-start justify-between gap-3 text-left">
                                <div class="flex items-center gap-3.5 min-w-0">
                                    <!-- Icon -->
                                    <div class="h-14 w-14 overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 shadow-inner">
                                        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(taskTitle)}" class="h-full w-full object-cover">
                                    </div>
                                    <!-- Title & Platform info -->
                                    <div class="min-w-0 flex flex-col">
                                        <span class="inline-flex rounded-lg px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider w-fit border ${acc.bgPill}">
                                            ${escapeHtml(taskTypeLabel)}
                                        </span>
                                        <h4 class="text-sm md:text-base font-black text-slate-950 dark:text-white mt-1.5 truncate pr-1 leading-tight">${escapeHtml(taskTitle)}</h4>
                                        <div class="flex items-center gap-1.5 mt-1 text-[10px] text-gray-500">
                                            <img src="${platformLogo}" alt="platform" class="h-3.5 w-3.5 object-contain shrink-0">
                                            <span>${escapeHtml(platformLabel)}</span>
                                        </div>
                                    </div>
                                </div>
                                <!-- Reward Right-Aligned -->
                                <div class="flex flex-col items-end shrink-0">
                                    <span class="text-lg md:text-xl font-black text-${acc.color}-600 dark:text-${acc.color}-400">${escapeHtml(reward)}</span>
                                    <span class="text-[8px] font-black text-gray-400 uppercase tracking-wider mt-0.5">Per Submit</span>
                                </div>
                            </div>

                            <!-- Divider Line -->
                            <div class="border-t border-slate-100 dark:border-slate-800/80"></div>

                            <!-- Middle Row: Metrics Grid -->
                            <div class="grid grid-cols-3 gap-2 py-1 text-left">
                                <!-- Payout Column -->
                                <div class="flex items-center gap-2">
                                    <span class="p-1.5 rounded-lg bg-${acc.color}-500/10 ${acc.textClass} shrink-0">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"></path></svg>
                                    </span>
                                    <div class="min-w-0">
                                        <p class="text-[8px] font-black text-gray-400 uppercase tracking-wider leading-none">Payout</p>
                                        <p class="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">${escapeHtml(payoutVal)}</p>
                                    </div>
                                </div>

                                <!-- Approval Column -->
                                <div class="flex items-center gap-2 border-l border-slate-100 dark:border-slate-800/80 pl-2">
                                    <span class="p-1.5 rounded-lg bg-${acc.color}-500/10 ${acc.textClass} shrink-0">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </span>
                                    <div class="min-w-0">
                                        <p class="text-[8px] font-black text-gray-400 uppercase tracking-wider leading-none">Approval</p>
                                        <p class="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">${escapeHtml(approvalVal)}</p>
                                    </div>
                                </div>

                                <!-- Used Comments Column -->
                                <div class="flex items-center gap-2 border-l border-slate-100 dark:border-slate-800/80 pl-2">
                                    <span class="p-1.5 rounded-lg bg-${acc.color}-500/10 ${acc.textClass} shrink-0">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                    </span>
                                    <div class="min-w-0">
                                        <p class="text-[8px] font-black text-gray-400 uppercase tracking-wider leading-none">Used</p>
                                        <p class="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">${submissionsCount}/${limitVal}</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Start Task Button -->
                            <button class="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-200 active:scale-[0.99] shadow-sm ${acc.bgBtn}" data-action="open-user-task" data-taskid="${task.id}">
                                <span>Start Task</span>
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        </div>`;
                } else {
                    return `
                        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[1.75rem] p-5 shadow-sm opacity-70 flex flex-col gap-4">
                            <!-- Top Row: Icon, Title & Coming Soon -->
                            <div class="flex items-start justify-between gap-3 text-left">
                                <div class="flex items-center gap-3.5 min-w-0">
                                    <div class="h-14 w-14 overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 shadow-inner">
                                        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(taskTitle)}" class="h-full w-full object-cover">
                                    </div>
                                    <div class="min-w-0 flex flex-col">
                                        <span class="inline-flex rounded-lg px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider w-fit border ${acc.bgPill}">
                                            ${escapeHtml(taskTypeLabel)}
                                        </span>
                                        <h4 class="text-sm md:text-base font-black text-slate-950 dark:text-white mt-1.5 truncate pr-1 leading-tight">${escapeHtml(taskTitle)}</h4>
                                    </div>
                                </div>
                                <span class="rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 px-3 py-1.5 text-xs font-black uppercase tracking-wider">Draft</span>
                            </div>
                        </div>`;
                }
            };

            const renderCategory = (category) => `
                <section class="task-category-block ${category.accent} mb-6">
                    <div class="task-category-title flex items-center gap-2 mb-3">
                        <span class="task-category-mark h-4 w-1 bg-indigo-600 dark:bg-indigo-400 rounded-full"></span>
                        <h3 class="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">${escapeHtml(category.label)}</h3>
                    </div>
                    <div class="flex flex-col gap-4">
                        ${category.items.map((task, index) => renderTaskCard(category, task, index)).join('')}
                    </div>
                </section>`;

            let bodyContent = '';
            if (!isTaskPageEnabled) {
                bodyContent = `
                    <div class="rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center bg-white dark:bg-gray-800 shadow-sm">
                        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 mb-4">
                            <img src="https://cdn-icons-png.flaticon.com/512/3176/3176366.png" alt="Coming soon" class="h-8 w-8 object-contain">
                        </div>
                        <h3 class="text-lg font-black text-gray-900 dark:text-white">Missions Coming Soon</h3>
                        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">New activities and updates are coming soon. Keep the app updated for future releases.</p>
                    </div>`;
            } else if (taskCategories.length === 0) {
                bodyContent = `
                    <div class="rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center bg-white dark:bg-gray-800 shadow-sm">
                        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-900/20 mb-4">
                            <img src="https://cdn-icons-png.flaticon.com/512/3176/3176366.png" alt="No tasks" class="h-8 w-8 object-contain">
                        </div>
                        <h3 class="text-lg font-black text-gray-900 dark:text-white">No Live Missions</h3>
                        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Real tasks are currently not available. Please check back later.</p>
                    </div>`;
            } else {
                bodyContent = taskCategories.map(renderCategory).join('');
            }

            const content = `
                <header class="mb-4 bg-white/95 px-4 py-3 shadow-sm backdrop-blur page-header-fixed dark:bg-gray-900/95">
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-lg font-black uppercase text-slate-950 dark:text-white">RW TASK</p>
                        </div>
                        <div class="task-header-actions">
                            <button type="button" data-action="open-task-ads-page" class="task-mini-action">
                                <img src="https://cdn-icons-png.flaticon.com/512/2659/2659360.png" alt="Ads" loading="eager" decoding="async">
                                <span>Ads</span>
                            </button>
                            <button type="button" data-action="open-task-bonus-page" class="task-mini-action">
                                <img src="https://cdn-icons-png.flaticon.com/512/2611/2611152.png" alt="Bonus" loading="eager" decoding="async">
                                <span>Bonus</span>
                            </button>
                        </div>
                    </div>
                </header>
                <div class="task-page-shell px-4 pt-1 pb-28">
                    <div class="mx-auto max-w-xl space-y-4">
                        ${bodyContent}
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: currentUser?.uid === ADMIN_UID ? 'admin' : 'home', keepBottomNav: true });
            setBottomNavActive('bottom-task-btn');
        };

const showTaskFeatureComingSoonPage = (feature = 'ads') => {
            const isAds = feature === 'ads';
            const title = isAds ? 'Watch Ads & Earn' : 'Daily Bonus';
            const icon = isAds
                ? 'https://cdn-icons-png.flaticon.com/512/2659/2659360.png'
                : 'https://cdn-icons-png.flaticon.com/512/2611/2611152.png';
            const headline = isAds
                ? 'Earn from watching banner Ads, videos ads.'
                : 'Claim daily bonus, spin wheel and earn money upto 5 rupees.';
            const content = `
                ${getPageHeader(title)}
                <div class="mx-auto max-w-md pb-24">
                    <section class="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 text-center shadow-xl dark:border-slate-700 dark:bg-gray-800">
                        <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 shadow-inner dark:bg-gray-900">
                            <img src="${icon}" alt="${title}" class="h-12 w-12 object-contain" loading="eager" decoding="async">
                        </div>
                        <p class="mt-5 text-[10px] font-black uppercase text-blue-600 dark:text-blue-300">Coming Soon</p>
                        <h3 class="mt-2 text-2xl font-black leading-tight text-slate-950 dark:text-white">${headline}</h3>
                        <div class="mt-5 rounded-2xl bg-blue-50 px-4 py-4 text-sm font-bold leading-6 text-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
                            This feature is not available yet. It will be announced soon...
                        </div>
                    </section>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: 'task', keepBottomNav: false, onBack: showUserTaskPage });
            setBottomNavActive('bottom-task-btn');
        };

const showUserReadNewsTaskPage = (task) => {
            const reward = task.rate || task.reward || 0;
            const appName = task.appName || task.title || 'Read News';
            const newsLinks = Array.isArray(task.newsLinks) ? task.newsLinks : [];
            
            // Track read status for links
            const readStatus = new Array(newsLinks.length).fill(false);
            
            const content = `
                <header class="mb-4 flex items-center justify-between bg-white dark:bg-gray-800 px-4 py-3 shadow-sm page-header-fixed">
                    <div class="flex items-center gap-3">
                        <button class="page-back-btn rounded-full p-2 text-slate-900 dark:text-white">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5m7 7-7-7 7-7"></path></svg>
                        </button>
                        <h2 class="text-base font-black uppercase text-slate-955 dark:text-white">News Mission</h2>
                    </div>
                    <span class="h-9 w-9 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center p-1.5 border border-gray-200">
                        <img src="https://cdn-icons-png.flaticon.com/512/2540/2540832.png" alt="News" class="h-full w-full object-contain">
                    </span>
                </header>
                <div class="px-4 pb-24 h-[calc(100vh-80px)] flex flex-col justify-between">
                    <div class="mx-auto max-w-xl w-full flex-1 flex flex-col justify-between space-y-4">
                        <section class="overflow-hidden rounded-[1.75rem] border-t-4 border-slate-950 bg-white shadow-xl dark:border-white dark:bg-gray-800 flex-1 flex flex-col justify-between">
                            <div class="flex items-start justify-between bg-slate-50 p-4 dark:bg-slate-900 shrink-0">
                                <div>
                                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-950 dark:text-white">Earn From Read News</p>
                                    <h3 class="mt-1 text-base font-black text-slate-950 dark:text-white">${escapeHtml(appName)}</h3>
                                    <span class="mt-0.5 inline-flex rounded bg-white px-2 py-0.5 text-[9px] font-black uppercase text-slate-600 shadow-sm dark:bg-slate-700 dark:text-white">Instant Credit</span>
                                </div>
                                <div class="rounded-xl bg-slate-950 px-4 py-2 text-center text-white shadow-md">
                                    <p class="text-[8px] font-black uppercase text-white/60">Reward</p>
                                    <p class="text-lg font-black">${formatCurrency(reward).replace('.00', '')}</p>
                                </div>
                            </div>
                            
                            <!-- News Links Boxes Grid (Fixed in single screen) -->
                            <div class="p-4 flex-grow flex flex-col justify-center space-y-2">
                                <p class="text-center text-xs font-bold text-gray-500 dark:text-gray-400">Click and read all ${newsLinks.length} news for 10 seconds each:</p>
                                <div class="grid grid-cols-1 gap-2 flex-grow justify-center content-center max-h-[50vh] overflow-y-auto">
                                    ${newsLinks.map((newsUrl, idx) => {
                                        return `
                                            <button type="button" data-news-idx="${idx}" data-news-url="${escapeHtml(newsUrl)}" class="news-box-btn flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-slate-50 dark:bg-slate-900 transition text-left hover:bg-slate-100 dark:hover:bg-slate-800">
                                                <div class="flex items-center gap-3">
                                                    <span class="news-num-badge flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-black text-sm">${idx + 1}</span>
                                                    <div>
                                                        <span class="block text-xs font-black text-slate-955 dark:text-white">News Article ${idx + 1}</span>
                                                        <span class="block text-[9px] text-gray-400">Read & wait 10s</span>
                                                    </div>
                                                </div>
                                                <span class="news-status-pill text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Pending</span>
                                            </button>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                            
                            <div class="p-4 bg-slate-50 dark:bg-slate-900 shrink-0">
                                <button id="news-task-submit-btn" class="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black uppercase tracking-wide text-white disabled:bg-slate-400" disabled>Complete Task</button>
                            </div>
                        </section>
                    </div>
                </div>
                
                <!-- Mini Web Opener Overlay -->
                <div id="mini-web-opener-overlay" class="fixed inset-0 z-[10000] hidden bg-slate-950 flex flex-col">
                    <div class="flex items-center justify-between bg-white dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
                        <div class="flex items-center gap-2">
                            <span class="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping"></span>
                            <span id="web-opener-title" class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Reading News Article...</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span id="web-opener-timer" class="text-sm font-black text-blue-600 dark:text-blue-400">10s remaining</span>
                            <button id="web-opener-close-btn" class="hidden rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-200 px-3 py-1.5 text-xs font-black">Close</button>
                        </div>
                    </div>
                    <div class="flex-grow bg-white dark:bg-gray-900 relative">
                        <iframe id="web-opener-iframe" class="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>
                        <div id="web-opener-loading" class="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-955 z-10">
                            <div class="flex flex-col items-center gap-2">
                                <svg class="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p class="text-xs font-bold text-gray-500">Loading Article...</p>
                                <p class="text-[10px] text-gray-400 mt-1">If loading is blocked, timer will still complete.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            showPage(content, { returnTo: 'task', keepBottomNav: false, onBack: showUserTaskPage });
            setBottomNavActive('bottom-task-btn');
            
            // Bind back button
            const backBtn = document.querySelector('.page-back-btn');
            if (backBtn) {
                backBtn.onclick = () => showUserTaskPage();
            }
            
            // Bind iframe load event
            const iframe = document.getElementById('web-opener-iframe');
            const openerLoading = document.getElementById('web-opener-loading');
            if (iframe && openerLoading) {
                iframe.onload = () => {
                    openerLoading.classList.add('hidden');
                };
            }
            
            // Opener Close Action
            let activeIdx = -1;
            const closeBtn = document.getElementById('web-opener-close-btn');
            const overlay = document.getElementById('mini-web-opener-overlay');
            
            const handleCloseOpener = () => {
                if (activeIdx !== -1) {
                    readStatus[activeIdx] = true;
                    // Update main box UI
                    const box = document.querySelector(`[data-news-idx="${activeIdx}"]`);
                    if (box) {
                        const statusPill = box.querySelector('.news-status-pill');
                        if (statusPill) {
                            statusPill.textContent = 'Completed ✅';
                            statusPill.className = 'news-status-pill text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300';
                        }
                        box.classList.add('border-green-200', 'bg-green-50/20', 'dark:border-green-900/30');
                        box.disabled = true;
                    }
                }
                
                // Hide overlay
                if (overlay) overlay.classList.add('hidden');
                if (iframe) iframe.src = 'about:blank';
                activeIdx = -1;
                
                // Check if all complete
                const allDone = readStatus.every(status => status === true);
                const submitBtn = document.getElementById('news-task-submit-btn');
                if (submitBtn) {
                    submitBtn.disabled = !allDone;
                }
            };
            
            if (closeBtn) {
                closeBtn.onclick = handleCloseOpener;
            }
            
            // Box clicks
            document.querySelectorAll('.news-box-btn').forEach(btn => {
                btn.onclick = () => {
                    const idx = Number(btn.dataset.newsIdx);
                    const url = btn.dataset.newsUrl;
                    if (!url) return showNotification('News url is missing.', true);
                    
                    activeIdx = idx;
                    
                    // Show overlay
                    if (overlay) overlay.classList.remove('hidden');
                    if (openerLoading) openerLoading.classList.remove('hidden');
                    if (closeBtn) closeBtn.classList.add('hidden');
                    
                    const timerText = document.getElementById('web-opener-timer');
                    if (timerText) timerText.textContent = '10s remaining';
                    
                    if (iframe) iframe.src = url;
                    
                    // Start timer
                    let seconds = 10;
                    const interval = setInterval(() => {
                        seconds--;
                        if (seconds > 0) {
                            if (timerText) timerText.textContent = `${seconds}s remaining`;
                        } else {
                            clearInterval(interval);
                            if (timerText) timerText.textContent = 'Completed ✅';
                            if (closeBtn) closeBtn.classList.remove('hidden');
                            if (openerLoading) openerLoading.classList.add('hidden');
                            showNotification(`News Article ${idx + 1} read completed!`);
                        }
                    }, 1000);
                };
            });
            
            // Submit Task
            const submitBtn = document.getElementById('news-task-submit-btn');
            if (submitBtn) {
                submitBtn.onclick = async () => {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Crediting reward...';
                    
                    try {
                        const token = await getBackendAuthToken();
                        const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/task-submissions`, {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ taskId: task.id })
                        }, 15000);
                        
                        const resData = await resp.json().catch(() => ({}));
                        if (!resp.ok || !resData.ok) {
                            throw new Error(resData.detail || resData.error || 'Submission failed');
                        }
                        
                        // Success! Update local cache and UI
                        currentUserData.balance = (currentUserData.balance || 0) + reward;
                        userTaskSubmissionIds.add(task.id);
                        userTaskTodaySubmissionIds.add(task.id);
                        
                        showNotification(`Congratulations! ₹${reward} credited to your wallet.`);
                        showUserTaskPage();
                    } catch (err) {
                        console.error('Submit news task failed:', err);
                        showNotification(err.message || 'Verification failed. Please try again.', true);
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Complete Task';
                    }
                };
            }
        };

// Image compression helper
const compressImage = async (file) => {
    return new Promise((resolve) => {
        if (!file || !file.type.startsWith('image/')) {
            resolve(file);
            return;
        }
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
                if (!blob) {
                    resolve(file);
                    return;
                }
                const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
                resolve(compressedFile.size < file.size ? compressedFile : file);
            }, 'image/jpeg', 0.85);
        };
        img.onerror = () => resolve(file);
    });
};

// Mini thumbnail helper
const generateMiniThumbnail = (file) => {
    return new Promise((resolve) => {
        if (!file || !file.type.startsWith('image/')) {
            resolve(null);
            return;
        }
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            const canvas = document.createElement('canvas');
            const size = 60;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            const scale = Math.max(size / img.width, size / img.height);
            const x = (size - img.width * scale) / 2;
            const y = (size - img.height * scale) / 2;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve(null);
    });
};

// Queue Manager Class
class TaskUploadQueueManager {
    constructor() {
        this.queues = {}; // taskId -> array of items
        this.callbacks = {}; // taskId -> function to update UI
        this.inFlightComments = {}; // taskId -> Set of comments currently matching
        this.isProcessing = {}; // taskId -> boolean
        
        // Listen to network status
        window.addEventListener('online', () => this.resumeAll());
        window.addEventListener('offline', () => this.pauseAll());
    }

    getQueue(taskId) {
        return this.queues[taskId] || [];
    }

    registerCallback(taskId, callback) {
        this.callbacks[taskId] = callback;
    }

    unregisterCallback(taskId) {
        delete this.callbacks[taskId];
    }

    notify(taskId) {
        if (this.callbacks[taskId]) {
            this.callbacks[taskId](this.getQueue(taskId));
        }
    }

    async addFiles(taskId, files, isBulk, task, reward, appName, taskLink, image, taskTitle, commentPool, submittedComments) {
        if (!this.queues[taskId]) {
            this.queues[taskId] = [];
            this.inFlightComments[taskId] = new Set();
        }

        const startIndex = this.queues[taskId].length;
        
        // Add placeholders with Waiting status
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const itemIndex = startIndex + i;
            const queueItem = {
                index: itemIndex,
                fileName: file.name,
                fileSize: file.size,
                status: 'Waiting', // 'Waiting', 'Uploading', 'OCR Processing', 'Uploaded', 'Failed'
                progress: 0,
                error: '',
                thumbnailUrl: '',
                rawFile: file,
                compressedFile: null,
                isBulk,
                task,
                reward,
                appName,
                taskLink,
                image,
                taskTitle,
                commentPool,
                submittedComments
            };
            this.queues[taskId].push(queueItem);
        }

        this.notify(taskId);

        // Lazily generate thumbnails and compress images asynchronously
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const itemIndex = startIndex + i;
            const item = this.queues[taskId][itemIndex];
            
            // Generate thumbnail
            generateMiniThumbnail(file).then(thumb => {
                item.thumbnailUrl = thumb;
                this.notify(taskId);
            });

            // Compress image
            compressImage(file).then(compressed => {
                item.compressedFile = compressed;
                item.fileSize = compressed.size;
                if (item.status === 'Waiting') {
                    this.processQueue(taskId);
                }
            });
        }

        this.processQueue(taskId);
    }

    pauseAll() {
        showNotification('Internet disconnected. Upload queue paused.', true);
        Object.keys(this.queues).forEach(taskId => {
            this.isProcessing[taskId] = false;
            this.notify(taskId);
        });
    }

    resumeAll() {
        showNotification('Internet connection returned. Resuming uploads...');
        Object.keys(this.queues).forEach(taskId => {
            this.processQueue(taskId);
        });
    }

    retryFailed(taskId) {
        const queue = this.getQueue(taskId);
        queue.forEach(item => {
            if (item.status === 'Failed') {
                item.status = 'Waiting';
                item.error = '';
                item.progress = 0;
            }
        });
        this.notify(taskId);
        this.processQueue(taskId);
    }

    clearQueue(taskId) {
        this.queues[taskId] = [];
        this.inFlightComments[taskId] = new Set();
        this.isProcessing[taskId] = false;
        this.notify(taskId);
    }

    async processQueue(taskId) {
        if (!navigator.onLine) return;
        if (this.isProcessing[taskId]) return;
        this.isProcessing[taskId] = true;

        const queue = this.getQueue(taskId);
        
        while (navigator.onLine) {
            // Count currently active uploads
            const activeCount = queue.filter(item => item.status === 'Uploading' || item.status === 'OCR Processing').length;
            if (activeCount >= 5) {
                break;
            }

            // Find next waiting item
            const nextItem = queue.find(item => item.status === 'Waiting');
            if (!nextItem) {
                break;
            }

            // Process item asynchronously to maintain concurrency
            this.uploadItem(taskId, nextItem);
        }

        this.isProcessing[taskId] = false;
    }

    async uploadItem(taskId, item) {
        const fileToUpload = item.compressedFile || item.rawFile;
        item.status = 'OCR Processing';
        item.progress = 10;
        this.notify(taskId);

        let activeReservation = null;

        try {
            if (!navigator.onLine) throw new Error('Offline');

            // 1. Run Client-side OCR Space
            let ocrText = '';
            let clientOcrSuccess = false;
            try {
                const formData = new FormData();
                formData.append('file', fileToUpload);
                formData.append('language', 'eng');
                formData.append('OCREngine', '2');
                formData.append('apikey', 'helloworld');

                const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
                    method: 'POST',
                    body: formData
                });
                if (ocrResponse.ok) {
                    const ocrData = await ocrResponse.json();
                    if (ocrData.OCRExitCode === 1 && ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
                        ocrText = ocrData.ParsedResults[0].ParsedText || '';
                        clientOcrSuccess = true;
                    }
                }
            } catch (ocrErr) {
                console.error('Client OCR call failed:', ocrErr);
            }

            if (!navigator.onLine) throw new Error('Offline');

            let gmailName = 'Unknown User';
            let skipOcr = 'false';
            let matchedComment = '';

            if (item.isBulk) {
                // BULK MODE: Match comment from remaining pool (excluding submitted and in-flight comments)
                const cleanStr = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const ocrTextLower = ocrText.toLowerCase().replace(/[^a-z0-9\s]/g, '');
                
                const remainingComments = item.commentPool.filter(c => {
                    const cleanC = String(c).trim();
                    return !item.submittedComments.includes(cleanC) && !this.inFlightComments[taskId].has(cleanC);
                });

                if (clientOcrSuccess) {
                    for (const comment of remainingComments) {
                        const expectedCommentWords = String(comment || '').trim().split(/\s+/).filter(Boolean);
                        let matchFound = false;

                        if (expectedCommentWords.length >= 2) {
                            const word1 = cleanStr(expectedCommentWords[0]);
                            const word2 = cleanStr(expectedCommentWords[1]);
                            const combined = word1 + word2;
                            const normalizedFullText = ocrTextLower.replace(/\s+/g, '');
                            if (normalizedFullText.includes(combined) || (ocrTextLower.includes(word1) && ocrTextLower.includes(word2))) {
                                matchFound = true;
                            }
                        } else if (expectedCommentWords.length === 1) {
                            const word1 = cleanStr(expectedCommentWords[0]);
                            if (ocrTextLower.includes(word1)) {
                                matchFound = true;
                            }
                        }

                        if (matchFound) {
                            matchedComment = comment;
                            break;
                        }
                    }

                    if (!matchedComment) {
                        throw new Error('Comment mismatch. Ensure screenshot displays the matched review.');
                    }

                    const cleanMatched = String(matchedComment).trim();
                    this.inFlightComments[taskId].add(cleanMatched);
                    
                    try {
                        gmailName = await window.extractReviewerName(ocrText, matchedComment);
                    } catch (chatErr) {
                        console.warn('Failed to extract name:', chatErr);
                    }
                    skipOcr = 'true';
                } else {
                    skipOcr = 'false';
                }
            } else {
                // SINGLE MODE: Use reserved comment
                activeReservation = window.activeTaskReservation;
                const expiresAt = timestampToMillis(activeReservation?.expiresAt);
                if (!activeReservation?.comment || !expiresAt || expiresAt <= Date.now()) {
                    throw new Error('Assigned comment reservation has expired. Please copy again.');
                }
                matchedComment = activeReservation.comment;

                if (clientOcrSuccess) {
                    const cleanStr = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const ocrTextLower = ocrText.toLowerCase().replace(/[^a-z0-9\s]/g, '');
                    const expectedCommentWords = String(matchedComment || '').trim().split(/\s+/).filter(Boolean);

                    let matchFound = false;
                    if (expectedCommentWords.length >= 2) {
                        const word1 = cleanStr(expectedCommentWords[0]);
                        const word2 = cleanStr(expectedCommentWords[1]);
                        const combined = word1 + word2;
                        const normalizedFullText = ocrTextLower.replace(/\s+/g, '');
                        if (normalizedFullText.includes(combined) || (ocrTextLower.includes(word1) && ocrTextLower.includes(word2))) {
                            matchFound = true;
                        }
                    } else if (expectedCommentWords.length === 1) {
                        const word1 = cleanStr(expectedCommentWords[0]);
                        if (ocrTextLower.includes(word1)) {
                            matchFound = true;
                        }
                    }

                    if (!matchFound) {
                        throw new Error('Comment mismatch. Ensure screenshot displays the correct assigned review.');
                    }

                    try {
                        gmailName = await window.extractReviewerName(ocrText, matchedComment);
                    } catch (chatErr) {
                        console.warn('Failed to extract name:', chatErr);
                    }
                    skipOcr = 'true';
                } else {
                    skipOcr = 'false';
                }
            }

            if (!navigator.onLine) throw new Error('Offline');

            item.status = 'Uploading';
            item.progress = 40;
            this.notify(taskId);

            const gmailLogoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(gmailName)}&background=random`;
            const token = await getBackendAuthToken();
            const params = new URLSearchParams({
                taskId: item.task.id,
                fileName: fileToUpload.name,
                appName: item.appName || 'Unknown App',
                isBulk: item.isBulk ? 'true' : 'false',
                skipOcr,
                ocrText: ocrText.slice(0, 1000),
                gmailName,
                gmailLogoUrl,
                matchedComment: matchedComment || '',
                assignedComment: matchedComment || ''
            });

            const uploadResponse = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/uploads/task-screenshot?${params.toString()}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': fileToUpload.type || 'image/jpeg',
                    'Content-Length': String(fileToUpload.size)
                },
                body: fileToUpload
            }, 35000);

            const uploadData = await uploadResponse.json().catch(() => ({}));
            if (!uploadResponse.ok || !uploadData.ok) {
                throw new Error(uploadData.detail || uploadData.error || 'Upload failed');
            }

            const verification = uploadData.verification;
            if (!verification) {
                throw new Error('Verification data missing from upload response');
            }

            const finalComment = verification.matchedComment || matchedComment;
            if (item.isBulk && !matchedComment && finalComment) {
                matchedComment = finalComment;
                this.inFlightComments[taskId].add(String(finalComment).trim());
            }

            const screenshotUrl = uploadData.screenshot.url || '';
            const screenshotKey = uploadData.screenshot.key || '';
            const screenshotViewUrl = uploadData.screenshot.viewUrl || '';
            const screenshotDrivePath = uploadData.screenshot.drivePath || '';

            if (!navigator.onLine) throw new Error('Offline');

            item.progress = 70;
            this.notify(taskId);

            const reservationId = item.isBulk
                ? `res_bulk_${item.task.id.slice(0, 12)}_${currentUser.uid.slice(0, 12)}_${Date.now()}`
                : (activeReservation?.id || getTaskReservationDocId(item.task.id, currentUser.uid));
            
            const submissionId = `sub_${item.task.id.slice(0, 12)}_${currentUser.uid.slice(0, 12)}_${Date.now()}_${item.index}`;

            const submitResponse = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/task-submissions`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: submissionId,
                    taskId: item.task.id,
                    reservationId,
                    assignedComment: finalComment,
                    screenshotUrl,
                    screenshotKey,
                    screenshotViewUrl,
                    screenshotDrivePath,
                    reward: Number(item.reward || 0),
                    taskLink: item.taskLink,
                    appName: item.appName,
                    userName: currentUserData?.name || currentUser.email || 'User',
                    userEmail: currentUser.email || currentUserData?.email || '',
                    payoutDelayDays: Number(item.task.paymentDelayDays || item.task.paymentDays || 7),
                    ocrStatus: 'completed',
                    ocrExtractedName: verification.gmailName,
                    ocrExtractedText: verification.ocrText || ocrText,
                    ocrConfidence: verification.ocrConfidence || 1.0,
                    details: { gmailLogoUrl: verification.gmailLogoUrl, avatarHash: verification.avatarHash || '', avatarCrop: verification.avatarCrop || null }
                })
            }, 15000);

            const resData = await submitResponse.json().catch(() => ({}));
            if (!submitResponse.ok || !resData.ok) {
                throw new Error(resData.detail || resData.error || 'Submission failed');
            }

            if (!navigator.onLine) throw new Error('Offline');

            item.progress = 90;
            this.notify(taskId);

            await setDoc(doc(db, `artifacts/${appId}/public/data/task_submissions`, submissionId), {
                id: submissionId,
                taskId: item.task.id,
                taskCode: item.task.taskCode || item.task.id,
                taskTitle: item.taskTitle,
                taskFamily: getAdminTaskFamily(item.task),
                taskSubtype: getAdminTaskSubtype(item.task),
                taskSubtypeLabel: item.task.taskSubtypeLabel || getAdminTaskSubtypeMeta(getAdminTaskFamily(item.task), getAdminTaskSubtype(item.task)).label,
                appName: item.appName,
                appLogoUrl: item.image,
                taskLink: item.taskLink,
                userId: currentUser.uid,
                userName: currentUserData?.name || currentUser.email || 'User',
                userEmail: currentUser.email || currentUserData?.email || '',
                userMobile: currentUserData?.mobile || '',
                reward: Number(item.reward || 0),
                assignedComment: finalComment,
                assignedCommentIndex: activeReservation?.commentIndex ?? 0,
                reservationId,
                reservationExpiresAt: activeReservation?.expiresAt || (Date.now() + 24 * 60 * 60 * 1000),
                screenshotUrl,
                screenshotKey,
                proofFileName: fileToUpload.name,
                proofFileSize: fileToUpload.size,
                proofMimeType: fileToUpload.type || 'image/*',
                status: 'pending_manual_verification',
                manualStatus: 'pending',
                autoStatus: 'waiting_scraper',
                verificationMode: 'manual_and_auto_ready',
                ocrStatus: 'completed',
                ocrExtractedName: verification.gmailName,
                ocrExtractedComment: finalComment,
                ocrExtractedLogoUrl: verification.gmailLogoUrl,
                scraperStatus: 'not_configured',
                payoutStatus: 'pending',
                submittedAt: serverTimestamp()
            });

            if (!item.isBulk) {
                await setDoc(doc(db, `artifacts/${appId}/public/data/task_comment_reservations`, reservationId), {
                    status: 'submitted',
                    submittedAt: serverTimestamp()
                }, { merge: true });

                fetchWithTimeout(`${BACKEND_BASE_URL}/api/task-reservations/${encodeURIComponent(reservationId)}/submit`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                }, 5000).catch(() => {});
            }

            item.status = 'Uploaded';
            item.progress = 100;
            if (item.isBulk && finalComment) {
                const cleanC = String(finalComment).trim();
                item.submittedComments.push(cleanC);
                this.inFlightComments[taskId].delete(cleanC);
            }
            this.notify(taskId);

            userTaskSubmissionIds.add(item.task.id);
            userTaskTodaySubmissionIds.add(item.task.id);

        } catch (err) {
            console.error(`Upload failed for ${item.fileName}:`, err);
            
            if (item.isBulk && matchedComment) {
                this.inFlightComments[taskId].delete(String(matchedComment).trim());
            }

            if (err.message === 'Offline' || !navigator.onLine) {
                item.status = 'Waiting';
                item.error = 'Network disconnected. Waiting for connection...';
                item.progress = 0;
            } else {
                item.status = 'Failed';
                item.error = err.message || 'Verification or upload failed.';
                item.progress = 0;
            }
            this.notify(taskId);
        }

        this.isProcessing[taskId] = false;
        this.processQueue(taskId);
    }
}

window.TaskUploadQueueManager = new TaskUploadQueueManager();

const showUserTaskDetailsPage = async (taskId) => {
            const task = allTasksCache.find(item => item.id === taskId);
            if (!task) return showNotification('Task not found. Please refresh tasks.', true);
            if (getAdminTaskEffectiveStatus(task) !== 'active') return showNotification('This task is closed.', true);
            
            if (task.taskSubtype === 'read_news') {
                showUserReadNewsTaskPage(task);
                return;
            }

            showLoading();
            const isBulk = isBulkTaskUser();
            const reward = task.rate || task.reward || 0;
            const taskTitle = task.title || 'Task Mission';
            const appName = task.appName || taskTitle;
            const commentPool = getTaskCommentPool(task);
            const taskLink = task.taskLink || task.link || task.url || '';
            const image = task.imageUrl || task.logoUrl || task.iconUrl || 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png';
            
            let submittedComments = [];
            if (isBulk) {
                try {
                    const todayStart = getStartOfTodayMillis();
                    const snap = await getDocs(query(
                        collection(db, `artifacts/${appId}/public/data/task_submissions`),
                        where('userId', '==', currentUser.uid),
                        where('taskId', '==', taskId)
                    ));
                    snap.docs.forEach(docSnap => {
                        const data = docSnap.data();
                        const submittedAt = timestampToMillis(data.submittedAt || data.createdAt || data.timestamp);
                        if (submittedAt >= todayStart && data.assignedComment) {
                            submittedComments.push(String(data.assignedComment).trim());
                        }
                    });
                } catch (err) {
                    console.warn('Failed to load submitted comments:', err);
                }
            }
            hideLoading();

            const selectDeterministicComment = (pool, userId, taskId) => {
                let hash = 0;
                const str = userId + taskId;
                for (let i = 0; i < str.length; i++) {
                    hash = str.charCodeAt(i) + ((hash << 5) - hash);
                }
                const index = Math.abs(hash) % pool.length;
                return { comment: pool[index], index };
            };
            const preSelected = selectDeterministicComment(commentPool, currentUser.uid, task.id);
            const initialComment = preSelected.comment;

            const getPayoutDelayText = (t) => {
                const days = t.paymentDelayDays ?? t.paymentDays ?? t.payoutDelayDays ?? 7;
                const numDays = Number(days);
                if (isNaN(numDays) || numDays <= 0) return 'Instant Payout';
                if (numDays === 1) return '1 Day Payout';
                return `${numDays} Days Payout`;
            };
            const payoutDelayText = getPayoutDelayText(task);
            const subtype = task.subtype || task.taskSubtype || '';
            const acc = getTaskAccent(subtype);

            const taskTypeLabel = (subtype === 'app_review' || subtype === 'app_download_task') ? 'Play Store Review' : (subtype === 'map_review' ? 'Map Review' : 'Screenshot Task');
            const platformLabel = (subtype === 'app_review' || subtype === 'app_download_task') ? 'Play Store App Review' : (subtype === 'map_review' ? 'Google Maps Place Review' : 'Screenshot + Review');
            const platformLogo = (subtype === 'app_review' || subtype === 'app_download_task') ? PLAY_STORE_LOGO_URL : (subtype === 'map_review' ? 'https://cdn-icons-png.flaticon.com/512/854/854878.png' : 'https://cdn-icons-png.flaticon.com/512/4187/4187336.png');

            const payoutVal = payoutDelayText.replace(' Payout', '');
            const approvalVal = payoutVal === 'Instant' ? 'Instant' : `${payoutVal} Later`;

            let step2Html = '';
            if (isBulk) {
                step2Html = `
                    <div class="space-y-4 text-left p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <label for="task-bulk-comments-count" class="text-xs font-bold text-gray-700 dark:text-gray-300">How many comments do you want?</label>
                                <p class="text-[10px] text-gray-400">Specify number of comments to copy.</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <input type="number" id="task-bulk-comments-count" min="1" max="100" value="5" class="w-16 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-900">
                                <button type="button" id="task-bulk-generate-btn" class="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-4 py-2 text-xs font-black transition-all active:scale-[0.97] shadow-sm">Copy Comments</button>
                            </div>
                        </div>
                        <div class="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                        <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Comment Pool (Cycle List):</p>
                        <div id="task-bulk-comments-list" class="max-h-48 overflow-y-auto space-y-2 pr-1">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                `;
            } else {
                step2Html = `
                    <div class="space-y-3.5">
                        <div class="relative rounded-2xl bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 p-4 pr-10 text-left mt-3">
                            <p id="task-assigned-review-text" class="text-sm font-semibold text-slate-800 dark:text-slate-200 italic leading-relaxed">"${escapeHtml(initialComment)}"</p>
                            <button type="button" id="task-copy-icon-btn" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-600 dark:text-indigo-400 hover:opacity-85 transition">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                        </div>
                        <button type="button" id="task-copy-review-btn" class="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-indigo-600 dark:border-indigo-400 bg-transparent text-indigo-600 dark:text-indigo-400 font-extrabold tracking-wide px-4 py-3.5 text-xs uppercase hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all active:scale-[0.98]">
                            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            Copy Review
                        </button>
                    </div>
                `;
            }

            const ctaText = (subtype === 'app_review' || subtype === 'app_download_task') ? 'Install App' : 'Open Link';
            const categoryLabel = (subtype === 'app_review' || subtype === 'app_download_task') ? 'Play Store App Review' : (subtype === 'map_review' ? 'Google Maps Place Review' : 'Task Mission');

            const content = `
                <style>
                    @keyframes timerPulse {
                        0%, 100% {
                            border-color: rgba(255, 255, 255, 0.4);
                            box-shadow: 0 0 4px rgba(255, 255, 255, 0.2);
                        }
                        50% {
                            border-color: rgba(255, 255, 255, 1);
                            box-shadow: 0 0 16px rgba(255, 255, 255, 0.6);
                            transform: scale(1.02);
                        }
                    }
                    @keyframes blinkText {
                        0%, 100% { opacity: 0.6; }
                        50% { opacity: 1; }
                    }
                    .timer-pulse-glow {
                        animation: timerPulse 2s infinite ease-in-out;
                        border-width: 1px;
                        border-style: solid;
                        transition: all 0.2s ease;
                    }
                    .blink-indicator {
                        animation: blinkText 1.5s infinite ease-in-out;
                    }
                </style>
                <header class="mb-4 flex items-center justify-between bg-white/80 dark:bg-gray-800/80 backdrop-blur px-4 py-3 shadow-sm page-header-fixed z-50">
                    <div class="flex items-center gap-3">
                        <button class="page-back-btn rounded-full p-2 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-gray-700 transition">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5m7 7-7-7 7-7"></path></svg>
                        </button>
                        <div class="flex flex-col text-left">
                            <h2 class="text-xs font-black uppercase text-slate-950 dark:text-white tracking-wider leading-none">Mission</h2>
                            <span class="text-[9px] font-bold text-gray-400 dark:text-gray-500 mt-1 select-all">ID: ${escapeHtml(taskId)}</span>
                        </div>
                    </div>
                </header>
                <div class="px-4 pb-28">
                    <div class="mx-auto max-w-xl space-y-4">
                        <!-- Premium Redesigned Task Header Card -->
                        <div class="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/85 rounded-[1.75rem] overflow-hidden shadow-md flex flex-col gap-4 pb-4">
                            <!-- Gradient Banner Header -->
                            <div class="bg-gradient-to-r ${acc.bannerGradient} p-5 text-white flex items-center justify-between gap-4">
                                <div class="flex items-center gap-4 min-w-0">
                                    <!-- Logo -->
                                    <div class="h-16 w-16 overflow-hidden rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-sm">
                                        <img src="${escapeHtml(image)}" alt="${escapeHtml(appName)}" class="h-full w-full object-cover" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3176/3176366.png'">
                                    </div>
                                    <!-- Title & Platform info -->
                                    <div class="min-w-0 flex flex-col text-left">
                                        <span class="inline-flex rounded-lg bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider w-fit text-white">
                                            ${escapeHtml(taskTypeLabel)}
                                        </span>
                                        <h3 class="text-base md:text-lg font-black text-white mt-1.5 truncate pr-1 leading-tight">${escapeHtml(appName)}</h3>
                                    </div>
                                </div>
                                <!-- Reward Right-Aligned -->
                                <div class="flex flex-col items-end shrink-0">
                                    <span class="text-xl md:text-2xl font-black">${formatCurrency(reward).replace('.00', '')}</span>
                                    <span class="text-[8px] font-bold text-white/70 uppercase tracking-wider mt-0.5 leading-none">Per Submit</span>
                                </div>
                            </div>

                            <!-- Metrics Grid (3 Columns) -->
                            <div class="grid grid-cols-3 gap-2 px-5 py-2 text-left">
                                <!-- Payout Column -->
                                <div class="flex items-center gap-2">
                                    <span class="p-2 rounded-xl ${acc.iconBg} shrink-0">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 0 0 2 2z"></path></svg>
                                    </span>
                                    <div class="min-w-0">
                                        <p class="text-[8px] font-black text-gray-400 uppercase tracking-wider leading-none">Payout</p>
                                        <p class="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">${escapeHtml(payoutVal)}</p>
                                    </div>
                                </div>

                                <!-- Approval Column -->
                                <div class="flex items-center gap-2 border-l border-slate-100 dark:border-slate-800/80 pl-2">
                                    <span class="p-2 rounded-xl ${acc.iconBg} shrink-0">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </span>
                                    <div class="min-w-0">
                                        <p class="text-[8px] font-black text-gray-400 uppercase tracking-wider leading-none">Approval</p>
                                        <p class="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">${escapeHtml(approvalVal)}</p>
                                    </div>
                                </div>

                                <!-- Remaining Time Column (Timer) -->
                                <div class="flex items-center gap-2 border-l border-slate-100 dark:border-slate-800/80 pl-2">
                                    <!-- Ticking Glowing Timer Badge -->
                                    <div id="task-card-timer-container" class="timer-pulse-glow bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 rounded-xl px-2 py-1 flex items-center gap-1.5 text-[10px] font-black text-amber-600 dark:text-amber-400 shadow-sm shrink-0">
                                        <span class="h-2 w-2 rounded-full bg-amber-500 blink-indicator shrink-0"></span>
                                        <span id="task-card-timer" class="font-mono text-[11px] tracking-wide">--:--</span>
                                    </div>
                                    <div class="min-w-0">
                                        <p class="text-[8px] font-black text-gray-400 uppercase tracking-wider leading-none">Time Left</p>
                                        <p class="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate leading-none">To Complete</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Install App CTA Button inside Card -->
                            <div class="px-5 mt-1">
                                <button id="task-download-btn" class="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-200 active:scale-[0.99] shadow-sm ${acc.bgBtn}">
                                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                    <span>${ctaText}</span>
                                </button>
                            </div>
                        </div>

                        <!-- Main Sections -->
                        <div class="space-y-4">
                            <!-- Step 1: Copy Review -->
                            <div class="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-150 dark:border-gray-700/80 shadow-md">
                                <div class="flex items-center gap-2.5 text-left mb-2">
                                    <span class="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-[11px] font-black shrink-0">1</span>
                                    <p class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Copy Review</p>
                                </div>
                                ${step2Html}
                            </div>

                            <!-- Step 2: Upload Screenshot -->
                            <div class="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-150 dark:border-gray-700/80 shadow-md">
                                <div class="flex items-center gap-2.5 text-left mb-2">
                                    <span class="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-[11px] font-black shrink-0">2</span>
                                    <p class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Upload Screenshot</p>
                                </div>
                                
                                <label class="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 p-5 text-center hover:bg-slate-100/50 dark:hover:bg-slate-900/60 transition mt-3">
                                    <input id="task-proof-input" type="file" accept="image/*" class="hidden" ${isBulk ? 'multiple' : ''}>
                                    <span class="p-3 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-2 shadow-sm border border-indigo-100/50 dark:border-indigo-900/30">
                                        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                    </span>
                                    <span id="task-proof-label" class="text-xs font-black uppercase text-slate-700 dark:text-slate-200">${isBulk ? 'Select Screenshot(s)' : 'Tap to upload screenshot'}</span>
                                    <span class="text-[9px] text-gray-400 mt-1">JPG, PNG • Max 5MB</span>
                                </label>

                                <!-- Trust Badge Icons Grid -->
                                <div class="grid grid-cols-3 gap-2 mt-4 py-3 bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800/80 px-3 text-left">
                                    <!-- Safe & Secure -->
                                    <div class="flex items-center gap-2">
                                        <span class="p-1.5 rounded-full bg-green-500/10 text-green-600 shrink-0">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                                        </span>
                                        <div class="min-w-0">
                                            <p class="text-[8px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide leading-none">Safe & Secure</p>
                                            <p class="text-[8px] font-bold text-gray-400 mt-0.5 truncate leading-none">Your data is protected</p>
                                        </div>
                                    </div>
                                    <!-- Fast Approval -->
                                    <div class="flex items-center gap-2 border-l border-slate-200/60 dark:border-slate-800/80 pl-2">
                                        <span class="p-1.5 rounded-full bg-amber-500/10 text-amber-500 shrink-0">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                        </span>
                                        <div class="min-w-0">
                                            <p class="text-[8px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide leading-none">Fast Approval</p>
                                            <p class="text-[8px] font-bold text-gray-400 mt-0.5 truncate leading-none">Verified automatically</p>
                                        </div>
                                    </div>
                                    <!-- Quick Payout -->
                                    <div class="flex items-center gap-2 border-l border-slate-200/60 dark:border-slate-800/80 pl-2">
                                        <span class="p-1.5 rounded-full bg-emerald-500/10 text-emerald-600 shrink-0">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        </span>
                                        <div class="min-w-0">
                                            <p class="text-[8px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide leading-none">Quick Payout</p>
                                            <p class="text-[8px] font-bold text-gray-400 mt-0.5 truncate leading-none">Get paid on time</p>
                                        </div>
                                    </div>
                                </div>

                                <!-- Submit Button (For Single User flow) -->
                                ${isBulk ? '' : `
                                    <button id="task-submit-mission-btn" class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${acc.bannerGradient} text-white font-extrabold tracking-wider px-4 py-3.5 text-xs uppercase shadow-md transition-all active:scale-[0.99] disabled:opacity-50" disabled>
                                        <svg class="w-4 h-4 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                                        <span>Submit Screenshot</span>
                                    </button>
                                `}

                                <!-- Persistent Queue Progress UI -->
                                <div id="upload-queue-container" class="mt-4 space-y-3 hidden">
                                    <div class="flex items-center justify-between text-xs font-bold text-gray-600 dark:text-gray-400">
                                        <span>Upload Queue</span>
                                        <span id="queue-completion-pct">0%</span>
                                    </div>
                                    <!-- Progress Bar -->
                                    <div class="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                                        <div id="queue-progress-bar" class="h-full bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full transition-all duration-300" style="width: 0%"></div>
                                    </div>

                                    <!-- Live Summary Badges -->
                                    <div class="grid grid-cols-5 gap-1 text-[8px] font-black text-center uppercase tracking-wider text-white">
                                        <div class="bg-slate-600 dark:bg-slate-700 rounded-lg p-1.5 shadow-sm">
                                            <p class="opacity-75">Selected</p>
                                            <p id="stat-selected" class="text-xs font-black mt-0.5">0</p>
                                        </div>
                                        <div class="bg-green-600 dark:bg-green-700 rounded-lg p-1.5 shadow-sm">
                                            <p class="opacity-75">Uploaded</p>
                                            <p id="stat-uploaded" class="text-xs font-black mt-0.5">0</p>
                                        </div>
                                        <div class="bg-blue-600 dark:bg-blue-700 rounded-lg p-1.5 shadow-sm">
                                            <p class="opacity-75">Active</p>
                                            <p id="stat-active" class="text-xs font-black mt-0.5">0</p>
                                        </div>
                                        <div class="bg-amber-600 dark:bg-amber-700 rounded-lg p-1.5 shadow-sm">
                                            <p class="opacity-75">Waiting</p>
                                            <p id="stat-waiting" class="text-xs font-black mt-0.5">0</p>
                                        </div>
                                        <div class="bg-red-600 dark:bg-red-700 rounded-lg p-1.5 shadow-sm">
                                            <p class="opacity-75">Failed</p>
                                            <p id="stat-failed" class="text-xs font-black mt-0.5">0</p>
                                        </div>
                                    </div>

                                    <!-- Retry / Action Buttons -->
                                    <div class="flex items-center justify-end gap-2 my-2">
                                        <button type="button" id="queue-clear-btn" class="rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 px-3 py-1.5 text-[9px] font-black uppercase text-slate-700 dark:text-white transition">Clear Queue</button>
                                        <button type="button" id="queue-retry-btn" class="rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-[9px] font-black uppercase text-white transition hidden">Retry Failed</button>
                                    </div>

                                    <!-- Queue Scroll Area -->
                                    <div id="queue-items-list" class="max-h-64 overflow-y-auto space-y-2 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-2 bg-gray-50/50 dark:bg-gray-900/30">
                                        <!-- File cards rendered here dynamically -->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`;

            showPage(content, { 
                returnTo: 'task', 
                keepBottomNav: false, 
                onBack: () => {
                    window.TaskUploadQueueManager.unregisterCallback(task.id);
                    showUserTaskPage();
                } 
            });
            setBottomNavActive('bottom-task-btn');

            // Active reservation state
            activeTaskReservation = null;
            if (activeTaskReservationTimer) {
                clearInterval(activeTaskReservationTimer);
                activeTaskReservationTimer = null;
            }

            if (!isBulk) {
                activeTaskReservation = {
                    comment: initialComment,
                    expiresAt: Date.now() + 5 * 60 * 1000
                };
            }

            // Ticking Function for Timer Badge
            const timerEl = document.getElementById('task-card-timer');
            const timerContainerEl = document.getElementById('task-card-timer-container');

            const startLocalTimer = () => {
                if (activeTaskReservationTimer) clearInterval(activeTaskReservationTimer);
                
                const tick = () => {
                    if (isBulk) {
                        const midnight = new Date();
                        midnight.setHours(24, 0, 0, 0);
                        const remaining = Math.max(0, midnight.getTime() - Date.now());
                        if (remaining <= 0) {
                            if (timerEl) timerEl.textContent = 'Closed';
                            clearInterval(activeTaskReservationTimer);
                            activeTaskReservationTimer = null;
                            showNotification('This task is closed for today.', true);
                            showUserTaskPage();
                            return;
                        }
                        const hours = Math.floor(remaining / 3600000);
                        const minutes = Math.floor((remaining % 3600000) / 60000);
                        const seconds = Math.floor((remaining % 60000) / 1000);
                        if (timerEl) {
                            timerEl.textContent = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                        }
                    } else {
                        if (!activeTaskReservation) {
                            if (timerEl) timerEl.textContent = '0:00';
                            return;
                        }
                        const expiresAt = timestampToMillis(activeTaskReservation.expiresAt);
                        const remaining = Math.max(0, expiresAt - Date.now());
                        if (remaining <= 0) {
                            if (timerEl) timerEl.textContent = 'Expired';
                            if (timerContainerEl) {
                                timerContainerEl.className = 'bg-red-500/10 dark:bg-red-950/20 border border-red-500/30 rounded-xl px-2 py-1 flex items-center gap-1.5 text-[10px] font-black text-red-600 dark:text-red-400 shadow-sm shrink-0';
                            }
                            clearInterval(activeTaskReservationTimer);
                            activeTaskReservationTimer = null;
                            return;
                        }
                        const minutes = Math.floor(remaining / 60000);
                        const seconds = Math.floor((remaining % 60000) / 1000);
                        if (timerEl) {
                            timerEl.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
                        }
                    }
                };
                tick();
                activeTaskReservationTimer = setInterval(tick, 1000);
            };

            const updateReservationUi = (reservation) => {
                activeTaskReservation = reservation;
                window.activeTaskReservation = reservation;
                const commentEl = document.getElementById('task-assigned-review-text');
                if (commentEl) commentEl.textContent = `"${reservation.comment}"`;
                
                if (timerContainerEl) {
                    timerContainerEl.className = 'timer-pulse-glow bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 rounded-xl px-2 py-1 flex items-center gap-1.5 text-[10px] font-black text-amber-600 dark:text-amber-400 shadow-sm shrink-0';
                }
                startLocalTimer();
            };

            // Setup buttons & actions
            const downloadBtn = document.getElementById('task-download-btn');
            if (downloadBtn) {
                downloadBtn.onclick = () => taskLink ? window.open(taskLink, '_blank', 'noopener') : showNotification('Task link is not added yet.', true);
            }

            // Copy & Review logic
            if (isBulk) {
                const renderBulkCommentsList = () => {
                    const commentsListEl = document.getElementById('task-bulk-comments-list');
                    if (!commentsListEl) return;
                    
                    const countInput = document.getElementById('task-bulk-comments-count');
                    const limit = countInput ? Math.max(1, parseInt(countInput.value) || 1) : 5;
                    
                    const listHtml = [];
                    for (let i = 0; i < limit; i++) {
                        const commentIndex = i % commentPool.length;
                        const comment = commentPool[commentIndex];
                        const isSubmitted = submittedComments.includes(String(comment).trim());
                        
                        listHtml.push(`
                            <div class="flex items-center justify-between gap-3 p-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-150 dark:border-gray-700/80 shadow-sm">
                                <div class="min-w-0 flex-1 flex items-center gap-2">
                                    <span class="text-[9px] font-black text-gray-400 bg-slate-50 dark:bg-slate-900 rounded px-1.5 shadow-sm border border-gray-100 dark:border-gray-800">${i + 1}</span>
                                    <p class="text-xs font-semibold text-gray-900 dark:text-white truncate italic text-left">"${escapeHtml(comment)}"</p>
                                </div>
                                ${isSubmitted 
                                    ? `<span class="text-[10px] font-black text-green-600 shrink-0 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-lg shadow-sm">Done ✅</span>`
                                    : `<button type="button" data-action="copy-comment" data-comment="${escapeHtml(comment)}" class="rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/40 dark:border-indigo-800/30 px-3 py-1.5 text-[9px] font-black tracking-wide uppercase transition shrink-0 shadow-sm">Copy</button>`
                                }
                            </div>
                        `);
                    }
                    commentsListEl.innerHTML = listHtml.join('');
                    
                    commentsListEl.querySelectorAll('[data-action="copy-comment"]').forEach(btn => {
                        btn.onclick = async (e) => {
                            const text = e.currentTarget.dataset.comment;
                            try {
                                await navigator.clipboard.writeText(text);
                                showNotification('Comment copied!');
                            } catch (err) {
                                showNotification('Copy failed. Copy manually.', true);
                            }
                        };
                    });
                };

                const countInput = document.getElementById('task-bulk-comments-count');
                const generateBtn = document.getElementById('task-bulk-generate-btn');

                if (countInput) {
                    countInput.onchange = renderBulkCommentsList;
                    countInput.oninput = renderBulkCommentsList;
                }

                if (generateBtn) {
                    generateBtn.onclick = async () => {
                        const limit = countInput ? Math.max(1, parseInt(countInput.value) || 1) : 5;
                        const commentsToCopy = [];
                        for (let i = 0; i < limit; i++) {
                            commentsToCopy.push(commentPool[i % commentPool.length]);
                        }
                        const text = commentsToCopy.join('\n\n');
                        try {
                            await navigator.clipboard.writeText(text);
                            showNotification(`Copied ${limit} comments to clipboard!`);
                        } catch (err) {
                            showNotification('Failed to copy. Try manual copy.', true);
                        }
                    };
                }

                renderBulkCommentsList();
                startLocalTimer();
            } else {
                startLocalTimer();
                const initBackgroundReservation = async () => {
                    try {
                        const reservation = await reserveTaskReviewComment(task);
                        updateReservationUi(reservation);
                    } catch (error) {
                        console.warn('Background reservation failed:', error);
                        const timerEl = document.getElementById('task-card-timer');
                        if (timerEl) timerEl.textContent = 'Expired';
                    }
                };
                initBackgroundReservation();

                const copyBtn = document.getElementById('task-copy-review-btn');
                const copyIconBtn = document.getElementById('task-copy-icon-btn');
                const triggerCopy = async () => {
                    const targetComment = activeTaskReservation?.comment || initialComment;
                    try {
                        await navigator.clipboard.writeText(targetComment);
                        showNotification('Assigned review comment copied!');
                    } catch (err) {
                        showNotification('Copy failed. Copy manually.', true);
                    }

                    try {
                        const reservation = await reserveTaskReviewComment(task);
                        updateReservationUi(reservation);
                    } catch (error) {
                        console.error('Review reserve failed:', error);
                    }
                };
                if (copyBtn) copyBtn.onclick = triggerCopy;
                if (copyIconBtn) copyIconBtn.onclick = triggerCopy;
            }

            const renderQueueUi = (queue) => {
                const queueContainer = document.getElementById('upload-queue-container');
                const progressPctEl = document.getElementById('queue-completion-pct');
                const progressBar = document.getElementById('queue-progress-bar');
                const itemsListEl = document.getElementById('queue-items-list');

                const statSelected = document.getElementById('stat-selected');
                const statUploaded = document.getElementById('stat-uploaded');
                const statActive = document.getElementById('stat-active');
                const statWaiting = document.getElementById('stat-waiting');
                const statFailed = document.getElementById('stat-failed');

                const retryBtn = document.getElementById('queue-retry-btn');

                if (!queueContainer || queue.length === 0) {
                    if (queueContainer) queueContainer.classList.add('hidden');
                    return;
                }

                queueContainer.classList.remove('hidden');

                const total = queue.length;
                const uploaded = queue.filter(item => item.status === 'Uploaded').length;
                const active = queue.filter(item => item.status === 'Uploading' || item.status === 'OCR Processing').length;
                const waiting = queue.filter(item => item.status === 'Waiting').length;
                const failed = queue.filter(item => item.status === 'Failed').length;

                if (statSelected) statSelected.textContent = total;
                if (statUploaded) statUploaded.textContent = uploaded;
                if (statActive) statActive.textContent = active;
                if (statWaiting) statWaiting.textContent = waiting;
                if (statFailed) statFailed.textContent = failed;

                let overallProgress = 0;
                if (total > 0) {
                    const totalProgress = queue.reduce((sum, item) => sum + (item.progress || 0), 0);
                    overallProgress = Math.floor(totalProgress / total);
                }
                if (progressPctEl) progressPctEl.textContent = `${overallProgress}%`;
                if (progressBar) progressBar.style.width = `${overallProgress}%`;

                if (retryBtn) {
                    if (failed > 0) {
                        retryBtn.classList.remove('hidden');
                    } else {
                        retryBtn.classList.add('hidden');
                    }
                }

                if (itemsListEl) {
                    itemsListEl.innerHTML = queue.map((item, idx) => {
                        const statusColors = {
                            'Waiting': 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30',
                            'Uploading': 'text-blue-500 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30',
                            'OCR Processing': 'text-purple-500 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/30',
                            'Uploaded': 'text-green-600 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30',
                            'Failed': 'text-red-600 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30'
                        };
                        const colorClass = statusColors[item.status] || 'text-gray-500';
                        const thumbSrc = item.thumbnailUrl || 'https://cdn-icons-png.flaticon.com/512/3342/3342137.png';
                        
                        return `
                            <div class="flex flex-col p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-150 dark:border-gray-700/60 shadow-sm gap-2">
                                <div class="flex items-center justify-between gap-3">
                                    <div class="flex items-center gap-2 min-w-0">
                                        <div class="h-9 w-9 overflow-hidden rounded bg-gray-100 dark:bg-gray-900 flex items-center justify-center shrink-0 shadow-inner">
                                            <img src="${thumbSrc}" alt="thumb" class="h-full w-full object-cover">
                                        </div>
                                        <div class="min-w-0">
                                            <p class="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate">${escapeHtml(item.fileName)}</p>
                                            <p class="text-[8px] text-gray-400 mt-0.5">${(item.fileSize / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                    <div class="shrink-0 flex items-center gap-2">
                                        <span class="rounded-lg border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${colorClass}">${item.status}</span>
                                    </div>
                                </div>
                                ${item.status === 'Failed' 
                                    ? `<p class="text-[9px] font-semibold text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/10 p-1.5 rounded-lg border border-red-100 dark:border-red-900/30 cursor-help" title="${escapeHtml(item.error)}">⚠️ ${escapeHtml(item.error)}</p>` 
                                    : ''
                                }
                                ${item.status === 'Uploading' || item.status === 'OCR Processing'
                                    ? `<div class="h-1 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                         <div class="h-full bg-indigo-500 rounded-full transition-all duration-300" style="width: ${item.progress || 0}%"></div>
                                       </div>`
                                    : ''
                                }
                            </div>
                        `;
                    }).join('');
                }
            };

            window.TaskUploadQueueManager.registerCallback(task.id, renderQueueUi);

            const initialQueue = window.TaskUploadQueueManager.getQueue(task.id);
            if (initialQueue.length > 0) {
                renderQueueUi(initialQueue);
            }

            const fileInput = document.getElementById('task-proof-input');
            const submitBtn = document.getElementById('task-submit-mission-btn');
            if (fileInput) {
                fileInput.onchange = (event) => {
                    const files = Array.from(event.target.files || []);
                    if (files.length === 0) {
                        if (submitBtn) submitBtn.disabled = true;
                        return;
                    }
                    
                    if (isBulk) {
                        window.TaskUploadQueueManager.addFiles(
                            task.id,
                            files,
                            isBulk,
                            task,
                            reward,
                            appName,
                            taskLink,
                            image,
                            taskTitle,
                            commentPool,
                            submittedComments
                        );
                        fileInput.value = '';
                    } else {
                        const labelEl = document.getElementById('task-proof-label');
                        if (labelEl) labelEl.textContent = files[0].name;
                        if (submitBtn) submitBtn.disabled = false;
                    }
                };
            }

            if (submitBtn) {
                submitBtn.onclick = () => {
                    const files = Array.from(fileInput.files || []);
                    if (files.length === 0) return;
                    
                    window.TaskUploadQueueManager.addFiles(
                        task.id,
                        files,
                        isBulk,
                        task,
                        reward,
                        appName,
                        taskLink,
                        image,
                        taskTitle,
                        commentPool,
                        submittedComments
                    );
                    
                    const queueContainer = document.getElementById('upload-queue-container');
                    if (queueContainer) queueContainer.classList.remove('hidden');
                    
                    fileInput.value = '';
                    submitBtn.disabled = true;
                };
            }

            const clearBtn = document.getElementById('queue-clear-btn');
            if (clearBtn) {
                clearBtn.onclick = () => {
                    if (confirm('Are you sure you want to clear the upload queue?')) {
                        window.TaskUploadQueueManager.clearQueue(task.id);
                    }
                };
            }

            const retryBtn = document.getElementById('queue-retry-btn');
            if (retryBtn) {
                retryBtn.onclick = () => {
                    window.TaskUploadQueueManager.retryFailed(task.id);
                };
            }
        };

const getIncomeTransactions = () => unifiedHistoryCache.filter(item => {
            if (item.status && item.status !== 'completed') return false;
            const type = normalizeTransactionType(item);
            return type === 'credit' || type === 'gift_card' || (type === 'wallet_transfer' && Number(item.amount || 0) > 0);
        });

const showTrackIncomePage = () => {
            const createdYear = getUserCreatedYear();
            const currentYear = new Date().getFullYear();
            const years = [];
            for (let year = createdYear; year <= currentYear; year++) years.push(year);
            const content = `
                ${getPageHeader('Track Income')}
                <div class="max-w-lg mx-auto space-y-4">
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
                        <label class="text-sm font-semibold text-gray-500 dark:text-gray-400">Choose Year</label>
                        <select id="income-year-select" class="mt-2 w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            ${years.map(year => `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`).join('')}
                        </select>
                    </div>
                    <div id="income-month-list" class="space-y-3"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { onBack: showSettingsPage });
            const renderIncomeYear = (year) => {
                const created = getSafeDate(currentUserData?.createdAt);
                const current = new Date();
                const totals = Array(12).fill(0);
                getIncomeTransactions().forEach(item => {
                    const date = getSafeDate(item.timestamp || item.createdAt);
                    if (!date || date.getFullYear() !== Number(year)) return;
                    totals[date.getMonth()] += absoluteAmount(item.amount || item.chargeAmount || 0);
                });
                const rows = totals.map((amount, monthIndex) => {
                    if (created && Number(year) === created.getFullYear() && monthIndex < created.getMonth()) return '';
                    if (Number(year) === current.getFullYear() && monthIndex > current.getMonth()) return '';
                    return `
                        <div class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <span class="font-semibold text-gray-900 dark:text-white">${monthNames[monthIndex]}</span>
                            <span class="font-bold text-emerald-600 dark:text-emerald-300">${formatCurrency(amount)}</span>
                        </div>`;
                }).join('');
                document.getElementById('income-month-list').innerHTML = rows || '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No income records for this year.</p>';
            };
            document.getElementById('income-year-select').onchange = (e) => renderIncomeYear(e.target.value);
            renderIncomeYear(currentYear);
        };

const getLatestTransactionsForBot = async (limit = 5) => {
            if (!currentUser?.uid) return [];
            const cachedHistory = mergeTransactionsByKey(
                unifiedHistoryCache || [],
                readHistoryItemsFromCache(currentUser.uid)
            );

            try {
                const mergedHistory = await prefetchTransactionHistory(currentUser.uid, { force: !cachedHistory.length });
                const pendingCached = cachedHistory.filter(item => String(item.status || '').toLowerCase() === 'pending');
                const combinedHistory = mergeTransactionsByKey(mergedHistory || [], pendingCached);
                return combinedHistory.slice(0, limit);
            } catch (error) {
                console.warn('Bot merged transaction lookup failed:', error);
                return cachedHistory.slice(0, limit);
            }
        };

const getFilteredTransactions = (filter) => {
            if ((!unifiedHistoryCache || unifiedHistoryCache.length === 0) && currentUser?.uid) {
                unifiedHistoryCache = readHistoryItemsFromCache(currentUser.uid);
            }

            if (filter === 'all') {
                return unifiedHistoryCache;
            }

            if (filter === 'withdrawal') {
                return unifiedHistoryCache.filter(item =>
                    normalizeTransactionType(item) === 'withdrawal' ||
                    (item.status === 'pending' && normalizeTransactionType(item) !== 'loan')
                );
            }

            if (filter === 'received') {
                return unifiedHistoryCache.filter(item => {
                    const type = normalizeTransactionType(item);
                    return ['credit', 'gift_card'].includes(type) || (type === 'wallet_transfer' && Number(item.amount || 0) > 0);
                });
            }

            if (filter === 'sent') {
                return unifiedHistoryCache.filter(item => {
                    const type = normalizeTransactionType(item);
                    return type === 'debit' || type === 'mobile_recharge' || type === 'withdrawal' || (type === 'wallet_transfer' && Number(item.amount || 0) < 0);
                });
            }

            if (filter === 'debit') {
                return unifiedHistoryCache.filter(item => normalizeTransactionType(item) === 'debit');
            }

            return unifiedHistoryCache;
        };

const renderFilteredTransactions = (filter, options = {}) => {
            const { reset = true } = options;
            const filteredList = getFilteredTransactions(filter);
            transactionListState.filter = filter;
            transactionListState.items = filteredList;
            if (reset) {
                transactionListState.visibleCount = TRANSACTION_PAGE_SIZE;
            }

            const listElement = document.getElementById('all-transactions-list');
            if (listElement) {
                const visibleItems = filteredList.slice(0, transactionListState.visibleCount);
                const hasMore = transactionListState.visibleCount < filteredList.length;
                listElement.innerHTML = filteredList.length === 0
                    ? '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No transactions found for this filter.</p>'
                    : `${visibleItems.map(item => renderTransactionItem(item, true)).join('')}
                       ${hasMore ? '<p id="transactions-load-hint" class="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-3">Scroll to load more</p>' : ''}`;
            }
        };

const loadMoreTransactionsIfNeeded = () => {
            if (!document.getElementById('all-transactions-list')) return;
            if (transactionListState.visibleCount >= transactionListState.items.length) return;

            transactionListState.visibleCount += TRANSACTION_PAGE_SIZE;
            renderFilteredTransactions(transactionListState.filter, { reset: false });
        };

const refreshTransactionHistoryFromFirebase = async (userId = currentUser?.uid) => {
            if (!userId) return [];
            return prefetchTransactionHistory(userId, { force: true });
        };

const showAllTransactionsPage = () => {
            if ((!unifiedHistoryCache || unifiedHistoryCache.length === 0) && currentUser?.uid) {
                unifiedHistoryCache = readHistoryItemsFromCache(currentUser.uid);
            }

            const content = `
                ${getPageHeader('Transaction History')}
                <div class="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    
                    <div id="filter-bar" class="flex space-x-2 overflow-x-auto pb-2 mb-4">
                        <button data-filter="all" class="filter-btn active-filter">All</button>
                        <button data-filter="withdrawal" class="filter-btn">Withdrawal</button>
                        <button data-filter="debit" class="filter-btn">Debit</button>
                        <button data-filter="received" class="filter-btn">Received</button>
                        <button data-filter="sent" class="filter-btn">Sent</button>
                    </div>
                    
                    <div id="all-transactions-list" class="space-y-3 pr-1">
                        </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { keepBottomNav: true });
            currentMainSection = 'transactions';
            setBottomNavActive('bottom-home-btn');
            const pageContainer = document.getElementById('page-container');

            // Initial render of all transactions
            renderFilteredTransactions('all');
            prefetchTransactionHistory(currentUser?.uid)
                .then(() => {
                    const activeFilter = document.querySelector('#filter-bar .active-filter')?.dataset.filter || 'all';
                    renderFilteredTransactions(activeFilter, { reset: false });
                })
                .catch((error) => {
                    console.error('Background transaction refresh failed:', error);
                });

            // Add click listener for filter buttons
            document.getElementById('filter-bar').addEventListener('click', (e) => {
                if (e.target.matches('.filter-btn')) {
                    // Update active button
                    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active-filter'));
                    e.target.classList.add('active-filter');

                    // Filter the list
                    const filter = e.target.dataset.filter;
                    renderFilteredTransactions(filter);
                    pageContainer.scrollTop = 0;
                }
            });

            pageContainer.onscroll = () => {
                if (currentMainSection !== 'transactions') return;
                const distanceFromBottom = pageContainer.scrollHeight - pageContainer.scrollTop - pageContainer.clientHeight;
                if (distanceFromBottom < 180) {
                    loadMoreTransactionsIfNeeded();
                }
            };

            // Keep the click listener for transaction details
            document.getElementById('all-transactions-list').addEventListener('click', (e) => {
                const itemEl = e.target.closest('.tx-item-clickable');
                if (itemEl) {
                    showTransactionDetails(itemEl.dataset.key);
                }
            });
        };

const showPayToWalletPage = () => {
            const content = `
                ${getPageHeader('Pay to Wallet')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-6">
                    <div class="text-center">
                        <h3 class="text-lg font-semibold">Send Money to Another User</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Enter the recipient's mobile number to send money</p>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Recipient Mobile Number</label>
                            <input type="tel" id="recipient-mobile-input" placeholder="Enter mobile number" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Amount</label>
                            <input type="number" id="pay-amount-input" placeholder="Enter amount (₹)" min="1" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum amount: ₹1</p>
                        </div>
                        
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Remarks (Optional)</label>
                            <input type="text" id="pay-comment-input" placeholder="Add a note" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <button id="find-recipient-btn" class="w-full bg-purple-500 text-white font-semibold py-3 rounded-lg hover:bg-purple-600 transition">Find Recipient</button>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            document.getElementById('find-recipient-btn').onclick = handleFindRecipient;
        };

const showTransactionDetails = (key, source = 'user') => {
            const item = source === 'admin-user'
                ? (adminViewedUserTransactions.find(i => i.key === key) || unifiedHistoryCache.find(i => i.key === key))
                : (unifiedHistoryCache.find(i => i.key === key) || adminViewedUserTransactions.find(i => i.key === key));
            if (!item) {
                console.error("Could not find transaction with key:", key);
                return;
            }
            const viewedUser = source === 'admin-user' ? (adminViewedUserProfile || {}) : (currentUserData || {});

            const rwLogoUrl = 'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg';
            const isReviewsWorldName = (name = '') => name.toLowerCase().includes('reviews world');
            const getInitials = (name = 'User') => {
                const parts = name.trim().split(/\s+/).filter(Boolean);
                if (!parts.length) return 'US';
                if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
                return (parts[0][0] + parts[1][0]).toUpperCase();
            };
            const verifiedBadge = getVerifiedBadge();
            const isVerifiedTransactionParty = (party = {}) =>
                !!party.appLogo ||
                isReviewsWorldName(party.name || '') ||
                /admin wallet|rw wallet|digital wallet/i.test(`${party.detail || ''} ${party.name || ''}`);
            const renderTransactionAvatar = (name, forceAppLogo = false, logoUrl = '', userProfile = null) => logoUrl ? `
                <div class="w-10 h-10 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center shadow-inner shrink-0 border border-gray-100 dark:border-gray-600 p-1.5">
                    <img src="${logoUrl}" class="w-full h-full object-contain rounded-full" alt="${name}" loading="eager">
                </div>` : (forceAppLogo || isReviewsWorldName(name)) ? `
                <div class="shrink-0">
                    <img src="${rwLogoUrl}" class="w-10 h-10 rounded-full border-2 border-gray-100 dark:border-gray-700 shadow-sm object-cover" alt="Reviews World Logo" loading="eager" fetchpriority="high" decoding="sync">
                </div>` : `
                <div class="shrink-0">
                    <img src="${getProfileAvatarUrl(userProfile || findUserProfile({ name }))}" class="w-10 h-10 rounded-full border border-gray-250 dark:border-gray-700 shadow-sm object-cover bg-white dark:bg-gray-800" alt="${name}" loading="eager">
                </div>`;
            const findUserProfile = ({ name = '', mobile = '' } = {}) => {
                const candidates = [
                    ...(viewedUser ? [viewedUser] : []),
                    ...(currentUserData ? [currentUserData] : []),
                    ...allUsersCache
                ];
                const normalizedName = name.toLowerCase();
                return candidates.find(u =>
                    (mobile && u.mobile === mobile) ||
                    (normalizedName && (u.name || '').toLowerCase() === normalizedName)
                );
            };

            const isRecharge = item.type === 'mobile_recharge';
            const isCredit = item.type !== 'debit' && item.type !== 'withdrawal' && !isRecharge && item.amount > 0;
            const dateStr = formatDate(item.timestamp);
            const displayAmount = isRecharge ? (item.chargeAmount || item.amount || 0) : Math.abs(item.amount);
            const amountStr = formatCurrency(displayAmount);

            // Format amount in words
            const amountInWords = numberToWords(displayAmount) + " Only";

            const senderName = item.senderName || (isCredit ? (item.isAdminTransaction ? 'Reviews World' : 'User') : viewedUser.name);
            const recipientName = item.recipientName || (isCredit ? viewedUser.name : 'User');
            const senderMobile = item.senderMobile || '';
            const recipientMobile = item.recipientMobile || '';
            const senderProfile = findUserProfile({ name: senderName, mobile: senderMobile });
            const recipientProfile = findUserProfile({ name: recipientName, mobile: recipientMobile });
            const senderIsPro = !!item.senderIsProProfile || !!senderProfile?.isProProfile;
            const recipientIsPro = !!item.recipientIsProProfile || !!recipientProfile?.isProProfile;
            let remarks = item.comment || (item.isAdminTransaction ? 'Payment By reviews World' : 'Money Transfer');
            const rawStatus = item.status || 'completed';
            const isWithdrawal = item.type === 'withdrawal';
            const isGiftCard = item.type === 'gift_card';
            const isRejected = rawStatus === 'rejected' || rawStatus === 'failed';
            const isPending = rawStatus === 'pending';
            const normalizedDetailType = normalizeTransactionType(item);
            if (normalizedDetailType === 'credit' && /admin\s+debit/i.test(remarks)) {
                remarks = 'Admin Balance Credit';
            }
            const isAdminCredit = (item.isAdminTransaction && isCredit) || normalizedDetailType === 'credit' && (isReviewsWorldName(remarks) || isReviewsWorldName(senderName));
            const isAdminDebit = item.isAdminTransaction && !isCredit && normalizedDetailType === 'debit';
            const giftCodeFromComment = (remarks.match(/redeemed code\s+([A-Z0-9-]+)/i) || [])[1] || '';
            const txnDisplayId = isGiftCard ? (item.giftCode || giftCodeFromComment || item.transactionId) : (item.adminTransactionId || item.transactionId);
            const methodId = item.methodId || (item.upiId ? 'upi' : item.accountNumber ? 'bank' : remarks.toLowerCase().includes('amazon') ? 'amazon_gift' : remarks.toLowerCase().includes('flipkart') ? 'flipkart_gift' : remarks.toLowerCase().includes('play') ? 'play_store' : remarks.toLowerCase().includes('paypal') ? 'paypal' : '');
            const methodName = getWithdrawalDisplayMethodName({ ...item, methodId });
            const methodDetail = getWithdrawalDetailText({ ...item, methodId });
            const detailBalanceAfter = getExplicitBalanceAfter(item) ?? item.balanceAfter;

            let statusTitle = isCredit ? 'Money Received' : 'Money Sent';
            let statusLabel = isCredit ? 'Money Received' : 'Money Sent';
            let statusPillClass = isCredit
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30';
            let statusIconClass = isCredit ? 'text-green-500' : 'text-blue-500';
            let fromParty = { label: 'From', name: isCredit ? senderName : viewedUser.name, detail: isCredit ? senderMobile : (viewedUser.mobile || ''), appLogo: isCredit ? senderIsPro : !!viewedUser?.isProProfile };
            let toParty = { label: 'To', name: isCredit ? recipientName : recipientName, detail: isCredit ? 'RW Wallet Balance' : recipientMobile, appLogo: isCredit ? recipientIsPro : recipientIsPro };
            let modeLabel = item.type === 'wallet_transfer' || item.type === 'debit' ? 'Wallet Transfer' : isAdminCredit ? 'Wallet Credit' : 'Wallet Transaction';
            let extraDetail = '';

            if (isAdminCredit) {
                fromParty = { label: 'From', name: 'REVIEWS WORLD', detail: 'Admin Wallet', appLogo: true };
                toParty = { label: 'To', name: recipientName || viewedUser.name || 'User', detail: 'RW Wallet Balance', appLogo: recipientIsPro || !!viewedUser?.isProProfile };
                modeLabel = 'Admin Credit';
            }

            if (isAdminDebit) {
                statusTitle = 'Money Debited';
                statusLabel = 'Admin Debit';
                fromParty = { label: 'From', name: viewedUser.name || senderName || 'User', detail: viewedUser.mobile || senderMobile || '', appLogo: !!viewedUser?.isProProfile || senderIsPro };
                toParty = { label: 'To', name: 'REVIEWS WORLD', detail: 'Admin Wallet', appLogo: true };
                modeLabel = 'Admin Debit';
            }

            if (isGiftCard) {
                statusTitle = 'Money Received';
                statusLabel = 'Money Received';
                fromParty = { label: 'From', name: 'REVIEWS WORLD', detail: 'Gift Card', appLogo: true };
                toParty = { label: 'To', name: recipientName || viewedUser.name || 'User', detail: 'RW Wallet Balance', appLogo: recipientIsPro || !!viewedUser?.isProProfile };
                modeLabel = 'Gift Card';
            }

            if (isWithdrawal) {
                statusTitle = isRejected ? 'Withdrawal Failed' : isPending ? 'Withdrawal Pending' : 'Money Withdrawn';
                statusLabel = isRejected ? 'Failed' : isPending ? 'Pending' : 'Withdrawal Completed';
                statusPillClass = isRejected
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30'
                    : isPending
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-100 dark:border-yellow-900/30'
                        : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30';
                statusIconClass = isRejected ? 'text-red-500' : isPending ? 'text-yellow-500' : 'text-green-500';
                fromParty = { label: 'From', name: 'Digital Wallet', detail: 'RW Wallet Balance', appLogo: true };
                toParty = { label: 'To', name: methodName, detail: methodDetail, appLogo: false, logoUrl: getWithdrawMethodLogo(methodId) };
                modeLabel = methodName;
                extraDetail = isRejected && item.rejectionReason ? `
                    <div class="bg-red-50 dark:bg-red-900/20 px-3 py-2">
                        <p class="text-[10px] font-semibold uppercase text-red-500 dark:text-red-400">Failed Reason</p>
                        <p class="text-xs text-red-700 dark:text-red-300 mt-0.5">${item.rejectionReason}</p>
                    </div>` : '';
            }
            if (isRecharge) {
                statusTitle = isRejected ? 'Recharge Failed' : isPending ? 'Recharge Pending' : 'Mobile Recharge Done';
                statusLabel = isRejected ? 'Failed' : isPending ? 'Pending' : 'Recharge Completed';
                statusPillClass = isRejected
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30'
                    : isPending
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-100 dark:border-yellow-900/30'
                        : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30';
                statusIconClass = isRejected ? 'text-red-500' : isPending ? 'text-yellow-500' : 'text-green-500';
                fromParty = { label: 'From', name: 'Digital Wallet', detail: 'RW Wallet Balance', appLogo: true };
                toParty = { label: 'Recharge For', name: item.mobileNumber || 'Mobile Number', detail: `${item.operator || ''} ${item.state ? `| ${item.state}` : ''}`.trim(), appLogo: false };
                modeLabel = 'Mobile Recharge';
                extraDetail = `
                    <div class="bg-sky-50 dark:bg-sky-900/20 px-3 py-2">
                        <p class="text-[10px] font-semibold uppercase text-sky-600 dark:text-sky-300">Plan Details</p>
                        <p class="text-xs text-sky-800 dark:text-sky-200 mt-0.5">${item.planDetails || 'N/A'}</p>
                    </div>
                    <div class="bg-green-50 dark:bg-green-900/20 px-3 py-2">
                        <p class="text-[10px] font-semibold uppercase text-green-600 dark:text-green-300">Discount</p>
                        <p class="text-xs text-green-800 dark:text-green-200 mt-0.5">Recharge ${formatCurrency(item.amount || 0)} - 1% discount ${formatCurrency(item.discount || 0)} = wallet deduction ${formatCurrency(item.chargeAmount || item.amount || 0)}</p>
                    </div>
                    ${isRejected && item.rejectionReason ? `
                        <div class="bg-red-50 dark:bg-red-900/20 px-3 py-2">
                            <p class="text-[10px] font-semibold uppercase text-red-500 dark:text-red-400">Failed Reason</p>
                            <p class="text-xs text-red-700 dark:text-red-300 mt-0.5">${item.rejectionReason}</p>
                        </div>` : ''}`;
            }
            const dateVerb = isRecharge ? (isRejected ? 'Failed' : isPending ? 'Requested' : 'Recharged') : isWithdrawal ? (isRejected ? 'Failed' : isPending ? 'Requested' : 'Withdrawn') : (isCredit ? 'Received' : 'Paid');

            const content = `
                <div class="bg-gray-50 dark:bg-gray-900 min-h-screen pb-6 overflow-x-hidden">
                    <div class="bg-white dark:bg-gray-800 px-4 py-3 flex items-center border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
                        <button onclick="window.closeModal()" class="p-2 -ml-2 mr-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        </button>
                        <h2 class="text-lg font-semibold">${statusTitle}</h2>
                    </div>

                    <div class="p-3 max-w-md mx-auto">
                        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4 ring-1 ring-gray-50 dark:ring-gray-700/40">
                            <!-- Amount Section -->
                            <div class="space-y-0.5">
                                <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">Amount</p>
                                <div class="flex items-center gap-2">
                                    <span class="text-2xl font-bold">${amountStr}</span>
                                    <svg class="w-5 h-5 ${statusIconClass} fill-current" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                    </svg>
                                </div>
                                <p class="text-[10px] text-gray-400 dark:text-gray-500 italic">${amountInWords}</p>
                            </div>

                            <!-- Remarks Section -->
                            <div class="flex items-start gap-2">
                                <div class="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-2xl flex items-center gap-2 max-w-full border border-gray-200 dark:border-gray-600">
                                    <span class="text-xs font-medium truncate">${remarks}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                </div>
                            </div>

                            <div class="flex items-center gap-2">
                                <div class="flex items-center gap-1.5 ${statusPillClass} px-3 py-1 rounded-full text-xs font-medium border">
                                    <span class="text-sm">💵</span>
                                    <span>${statusLabel}</span>
                                </div>
                            </div>

                            <hr class="border-gray-200 dark:border-gray-700">

                            <!-- Transfer Flow -->
                            <div class="rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                                <!-- Recipient/Sender -->
                                <div class="flex justify-between items-center gap-3 p-3 bg-gray-50/40 dark:bg-gray-900/20">
                                    <div class="space-y-0.5 min-w-0">
                                        <p class="text-xs text-gray-500 dark:text-gray-400">${fromParty.label}</p>
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <span class="text-base font-bold truncate">${fromParty.name}</span>
                                            ${isVerifiedTransactionParty(fromParty) ? verifiedBadge : ''}
                                        </div>
                                        ${fromParty.detail ? `<p class="text-xs text-gray-400 font-mono truncate">${fromParty.detail}</p>` : ''}
                                    </div>
                                    ${renderTransactionAvatar(fromParty.name, fromParty.appLogo, fromParty.logoUrl, isCredit ? senderProfile : viewedUser)}
                                </div>

                                <!-- My Account -->
                                <div class="flex justify-between items-center gap-3 p-3">
                                    <div class="space-y-0.5 min-w-0">
                                        <p class="text-xs text-gray-500 dark:text-gray-400">${toParty.label}</p>
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <span class="text-base font-bold truncate">${toParty.name}</span>
                                            ${isVerifiedTransactionParty(toParty) ? verifiedBadge : ''}
                                        </div>
                                        ${toParty.detail ? `<p class="text-xs text-gray-400 font-mono truncate">${toParty.detail}</p>` : ''}
                                    </div>
                                    ${renderTransactionAvatar(toParty.name, toParty.appLogo, toParty.logoUrl, isCredit ? viewedUser : recipientProfile)}
                                </div>
                            </div>

                            <div class="rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden text-xs">
                                <div class="flex justify-between gap-3 px-3 py-2">
                                    <span class="text-gray-500 dark:text-gray-400">Mode</span>
                                    <span class="font-semibold text-right">${modeLabel}</span>
                                </div>
                                <div class="flex justify-between gap-3 px-3 py-2">
                                    <span class="text-gray-500 dark:text-gray-400">Status</span>
                                    <span class="font-semibold text-right">${statusLabel}</span>
                                </div>
                                ${Number.isFinite(Number(detailBalanceAfter)) ? `
                                    <div class="flex justify-between gap-3 px-3 py-2">
                                        <span class="text-gray-500 dark:text-gray-400">Remaining Balance</span>
                                        <span class="font-semibold text-right">${formatCurrency(detailBalanceAfter)}</span>
                                    </div>
                                ` : ''}
                                ${item.adminTransactionId ? `
                                    <div class="flex justify-between gap-3 px-3 py-2">
                                        <span class="text-gray-500 dark:text-gray-400">Processed By</span>
                                        <span class="font-semibold text-right inline-flex items-center justify-end gap-1.5">REVIEWS WORLD ${verifiedBadge}</span>
                                    </div>
                                ` : ''}
                                ${extraDetail}
                            </div>

                            <div class="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <p class="text-[10px] text-gray-400 dark:text-gray-500">${dateVerb} on ${dateStr}</p>
                                ${txnDisplayId ? `
                                    <div class="flex items-center gap-2 min-w-0">
                                        <p class="text-[10px] text-gray-400 dark:text-gray-500 truncate">Txn ID: ${txnDisplayId}</p>
                                        <button data-action="copy-text" data-text="${txnDisplayId}" class="text-blue-500 text-[10px] font-bold hover:underline shrink-0">Copy</button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- RW Wallet Watermark Footer -->
                        <div class="mt-3 mb-3 flex flex-col items-center justify-center space-y-1.5 opacity-35 select-none">
                             <div class="flex items-center gap-2 grayscale">
                                <img src="https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg" class="w-6 h-6 rounded-full" alt="RW">
                                <span class="text-[10px] font-black tracking-widest uppercase">RW WALLET SECURE</span>
                             </div>
                             <div class="flex items-center gap-4 grayscale opacity-70">
                                <span class="text-[8px] font-bold">REVIEWS WORLD</span>
                                <span class="text-[8px]">|</span>
                                <span class="text-[8px] font-bold">VERIFIED PAYMENT</span>
                             </div>
                        </div>
                    </div>
                </div>`;

            // Render as a full-screen overlay instead of a standard modal.
            const overlay = document.createElement('div');
            overlay.id = 'transaction-overlay';
            overlay.className = 'fixed inset-0 z-[100] bg-gray-50 dark:bg-gray-900';
            overlay.innerHTML = content;
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';

            // Override window.closeModal for this overlay
            const originalCloseModal = window.closeModal;
            window.closeModal = () => {
                overlay.remove();
                document.body.style.overflow = '';
                window.closeModal = originalCloseModal;
            };
        };

// Expose functions to window for global access
window.getHistoryCacheKey = getHistoryCacheKey;
window.getHistoryDataCacheKey = getHistoryDataCacheKey;
window.normalizeHistoryItemForCache = normalizeHistoryItemForCache;
window.reviveHistoryItemFromCache = reviveHistoryItemFromCache;
window.readHistoryItemsFromCache = readHistoryItemsFromCache;
window.writeHistoryItemsToCache = writeHistoryItemsToCache;
window.normalizeTransactionType = normalizeTransactionType;
window.normalizeTransactionForHistory = normalizeTransactionForHistory;
window.getTransactionBalanceEffect = getTransactionBalanceEffect;
window.annotateTransactionsWithRemainingBalance = annotateTransactionsWithRemainingBalance;
window.normalizeCloudTransaction = normalizeCloudTransaction;
window.getTransactionKey = getTransactionKey;
window.mergeTransactionsByKey = mergeTransactionsByKey;
window.normalizePendingRequestForHistory = normalizePendingRequestForHistory;
window.loadFirebaseTransactions = loadFirebaseTransactions;
window.serializeCloudTransaction = serializeCloudTransaction;
window.fetchCloudTransactionHistory = fetchCloudTransactionHistory;
window.importFirestoreTransactionsToCloud = importFirestoreTransactionsToCloud;
window.recordCloudTransaction = recordCloudTransaction;
window.getSafeTransactionDocId = getSafeTransactionDocId;
window.recordUserFirestoreTransaction = recordUserFirestoreTransaction;
window.syncRecentTransactionsToCloud = syncRecentTransactionsToCloud;
window.prefetchTransactionHistory = prefetchTransactionHistory;
window.addInstantTransactionToHistory = addInstantTransactionToHistory;
window.generateTransactionId = generateTransactionId;
window.renderTransactionItem = renderTransactionItem;
window.setBottomNavActive = setBottomNavActive;
window.showPage = showPage;
window.hidePage = hidePage;
window.openSlideMenu = openSlideMenu;
window.closeSlideMenu = closeSlideMenu;
window.showBlockedAccountPage = showBlockedAccountPage;
window.showVerificationPendingPage = showVerificationPendingPage;
window.getPageHeader = getPageHeader;
window.getPageFooter = getPageFooter;
window.showUserTaskHistoryPage = showUserTaskHistoryPage;
window.loadUserTaskHistory = loadUserTaskHistory;
window.renderUserTaskHistory = renderUserTaskHistory;
window.showUserLiveListsPage = showUserLiveListsPage;
window.openFullscreenScreenshotHistory = openFullscreenScreenshotHistory;
window.showHomeMainPage = showHomeMainPage;
window.showReferEarnPage = showReferEarnPage;
window.showUserTaskPageLegacy = showUserTaskPageLegacy;
window.showUserTaskPage = showUserTaskPage;
window.showTaskFeatureComingSoonPage = showTaskFeatureComingSoonPage;
window.showUserReadNewsTaskPage = showUserReadNewsTaskPage;
window.showUserTaskDetailsPage = showUserTaskDetailsPage;
window.getIncomeTransactions = getIncomeTransactions;
window.showTrackIncomePage = showTrackIncomePage;
window.getLatestTransactionsForBot = getLatestTransactionsForBot;
window.getFilteredTransactions = getFilteredTransactions;
window.renderFilteredTransactions = renderFilteredTransactions;
window.loadMoreTransactionsIfNeeded = loadMoreTransactionsIfNeeded;
window.refreshTransactionHistoryFromFirebase = refreshTransactionHistoryFromFirebase;
window.showAllTransactionsPage = showAllTransactionsPage;
window.showPayToWalletPage = showPayToWalletPage;
window.showTransactionDetails = showTransactionDetails;
