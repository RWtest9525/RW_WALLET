const saveDeviceTokenToDb = async (token) => {
    if (!token) return;
    const cleanToken = String(token).trim();
    if (!cleanToken) return;
    try {
        const uid = (currentUser && (currentUser.uid || currentUser.id)) || (currentUserData && (currentUserData.uid || currentUserData.id)) || localStorage.getItem('lastLoggedInUser');
        if (!uid) return;
        const docRef = doc(db, `artifacts/${appId}/public/data/users`, uid);
        await updateDoc(docRef, {
            fcmToken: cleanToken,
            fcm_token: cleanToken,
            registrationId: cleanToken,
            registration_id: cleanToken,
            deviceToken: cleanToken,
            fcmTokenUpdatedAt: serverTimestamp()
        }).catch(() => {});
        console.log('[notifications.js] ✅ Fresh Device token saved to Firestore:', cleanToken.slice(0, 15) + '...');
    } catch (e) {
        console.warn('[notifications.js] saveDeviceTokenToDb error:', e);
    }
};
window.saveDeviceTokenToDb = saveDeviceTokenToDb;

const initializePushNotifications = async (userId) => {
            if (!userId) return;

            // ---- CapacitorJS Native Push Notifications (Android APK) ----
            if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
                try {
                    const PushNotifications = window.Capacitor.Plugins?.PushNotifications || window.Capacitor?.Plugins?.PushNotificationsPlugin;
                    if (PushNotifications) {
                        try { await PushNotifications.removeAllListeners().catch(() => {}); } catch (_) {}

                        // CRITICAL: Attach listeners BEFORE calling .register()
                        PushNotifications.addListener('registration', async (token) => {
                            console.log('[Capacitor] ✅ Native Android FCM Token received:', token?.value);
                            if (token && token.value) {
                                await saveDeviceTokenToDb(token.value);
                            }
                        });

                        PushNotifications.addListener('registrationError', (err) => {
                            console.error('[Capacitor] ❌ Native push registration error:', err);
                        });

                        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                            const data = notification.notification?.data || {};
                            const roomId = data.roomId || data.room_id || '';
                            if (roomId && typeof window.openSupportChatRoom === 'function') {
                                window.openSupportChatRoom(roomId);
                            }
                        });

                        let perm = await PushNotifications.checkPermissions();
                        if (perm.receive !== 'granted') {
                            perm = await PushNotifications.requestPermissions();
                        }
                        if (perm.receive === 'granted') {
                            await PushNotifications.register();
                        }
                    }
                } catch (capErr) {
                    console.warn('[Capacitor] Native push initialization warning:', capErr);
                }
            }

            const fsUpdates = {};
            let hasFsUpdates = false;

            // ---- Android APK (WebView) integration: fetch registrationId + (optional) OneSignal playerId from JSInterface ----
            if (window.JSInterface) {
                try {
                    if (typeof window.JSInterface.getRegistrationId === 'function') {
                        const token = window.JSInterface.getRegistrationId();
                        if (token) {
                            try { await saveDeviceTokenToDb(token); } catch (_) {}
                        }
                    }
                    if (typeof window.JSInterface.getOneSignalPlayerId === 'function') {
                        const jsPid = window.JSInterface.getOneSignalPlayerId();
                        if (jsPid && typeof jsPid === 'string' && jsPid.trim()) {
                            const clean = jsPid.trim();
                            fsUpdates.onesignalPlayerId = clean;
                            fsUpdates.onesignal_player_id = clean;
                            hasFsUpdates = true;
                        }
                    }
                } catch (e) { /* Android interface errors are non-fatal */ }
            }

            // ---- OneSignal Link User + Player/Subscription ID save ----
            // Uses the safe helpers installed in index.html (window.OneSignalDeferred)
            // so this works even if the SDK is still loading.
            let currentPlayerId = '';

            try {
                window.__rwOneSignalLogin && window.__rwOneSignalLogin(String(userId).trim());

                if (window.OneSignalDeferred) {
                    window.OneSignalDeferred.push(function afterOneSignalInit(OneSignal) {
                        try {
                            // Resolve subscription/player ID and save to Firestore
                            (async function resolveAndSaveSubId() {
                                try {
                                    let subId = '';
                                    try {
                                        if (OneSignal && OneSignal.User && OneSignal.User.PushSubscription && OneSignal.User.PushSubscription.id) {
                                            subId = String(OneSignal.User.PushSubscription.id || '').trim();
                                        } else if (typeof OneSignal.getUserId === 'function') {
                                            subId = String(await OneSignal.getUserId() || '').trim();
                                        } else if (typeof OneSignal.getPlayerId === 'function') {
                                            subId = String(await OneSignal.getPlayerId() || '').trim();
                                        }
                                    } catch (_) { subId = ''; }

                                    if (subId) {
                                        try {
                                            const docRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                                            await updateDoc(docRef, {
                                                onesignalPlayerId: subId,
                                                onesignal_player_id: subId,
                                                subscriptionId: subId,
                                                onesignalSubUpdatedAt: serverTimestamp()
                                            }).catch(() => {});
                                            console.log('[notifications.js] ✅ Resolved OneSignal subscriptionId=', subId.slice(0, 12) + '... and saved to Firestore');
                                        } catch (_) {}
                                    }
                                } catch (e) {
                                    console.warn('[notifications.js] resolve subscription ID failed:', e);
                                }
                            })();

                            // Listen for subscription changes (e.g. permission granted after first load)
                            try {
                                if (OneSignal && OneSignal.User && OneSignal.User.PushSubscription && typeof OneSignal.User.PushSubscription.addEventListener === 'function') {
                                    OneSignal.User.PushSubscription.addEventListener('change', async (evt) => {
                                        try {
                                            const newId = String(evt?.current?.id || '').trim();
                                            if (!newId) return;
                                            const docRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                                            await updateDoc(docRef, {
                                                onesignalPlayerId: newId,
                                                onesignal_player_id: newId,
                                                subscriptionId: newId,
                                                onesignalSubUpdatedAt: serverTimestamp()
                                            }).catch(() => {});
                                            console.log('[notifications.js] ✅ OneSignal subscription changed, saved ID=', newId.slice(0, 12) + '...');
                                        } catch (_) {}
                                    });
                                }
                            } catch (e) {
                                console.warn('[notifications.js] addEventListener for subscription change failed:', e);
                            }
                        } catch (e) {
                            console.warn('[notifications.js] OneSignal deferred callback failed:', e);
                        }
                    });
                }
            } catch (err) {
                console.warn('[OneSignal] deferred push setup failed (non-fatal):', err);
            }

            if (currentPlayerId) {
                fsUpdates.onesignalPlayerId = currentPlayerId;
                fsUpdates.onesignal_player_id = currentPlayerId;
                fsUpdates.onesignalSubUpdatedAt = serverTimestamp();
                hasFsUpdates = true;
            }

            // ---- FCM token flow (web browser & mobile push via Firebase Messaging) ----
            if ('Notification' in window) {
                try {
                    if ('serviceWorker' in navigator) {
                        await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(e => console.warn('ServiceWorker registration skipped:', e));
                    }
                    let permission = Notification.permission;
                    if (permission === 'default') {
                        permission = await Notification.requestPermission();
                    }
                    if (permission === 'granted' && messaging) {
                        const tokenOptions = {};
                        if (FCM_VAPID_KEY) tokenOptions.vapidKey = FCM_VAPID_KEY;
                        const fcmToken = await getToken(messaging, tokenOptions);
                        if (fcmToken) {
                            fsUpdates.fcmToken = fcmToken;
                            fsUpdates.fcm_token = fcmToken;
                            fsUpdates.registrationId = fcmToken;
                            fsUpdates.registration_id = fcmToken;
                            fsUpdates.deviceToken = fcmToken;
                            fsUpdates.fcmTokenUpdatedAt = serverTimestamp();
                            hasFsUpdates = true;
                            await saveDeviceTokenToDb(fcmToken).catch(() => {});
                        }
                    }
                } catch (error) {
                    console.warn('An error occurred while retrieving FCM token:', error);
                }
            }

            // ---- Write ALL identifiers (OneSignal playerId, FCM, etc.) atomically in a SINGLE Firestore update ----
            if (hasFsUpdates) {
                try {
                    const docRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                    await updateDoc(docRef, fsUpdates);
                } catch (err) {
                    console.warn('Failed to update user notification identifiers in DB:', err);
                }
            }

            // ---- FCM Foreground message listener (runs once) ----
            if (messaging) {
                try {
                    onMessage(messaging, (payload) => {
                        if (payload && payload.notification) {
                            showNotification(`${payload.notification.title || ''}${payload.notification.title && payload.notification.body ? ': ' : ''}${payload.notification.body || ''}`);
                        }
                    });
                } catch (e) {
                    console.warn('Error setting up onMessage listener:', e);
                }
            }

            // ---- Service Worker Message Listener (Direct Chat Room Open on Notification Click) ----
            if ('serviceWorker' in navigator) {
                try {
                    navigator.serviceWorker.addEventListener('message', (event) => {
                        if (event.data && event.data.type === 'OPEN_CHAT_ROOM') {
                            const targetRoomId = event.data.roomId;
                            if (targetRoomId && typeof window.openSupportChatRoom === 'function') {
                                window.openSupportChatRoom(targetRoomId);
                            }
                        }
                    });
                } catch (e) {}
            }
        };

const openAndroidNotificationSettings = async (packageId = 'com.reviewsworld.app') => {
            if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
                try {
                    const PushNotifications = window.Capacitor.Plugins?.PushNotifications || window.Capacitor?.Plugins?.PushNotificationsPlugin;
                    if (PushNotifications) {
                        const res = await PushNotifications.requestPermissions();
                        if (res.receive === 'granted') {
                            await PushNotifications.register();
                            showNotification('✅ Notifications Enabled Successfully!');
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('[Capacitor] Native permission request failed:', e);
                }
            }
            const targetPackage = packageId || 'com.reviewsworld.app';
            const intentUrl = `intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.android.provider.extra.APP_PACKAGE=${encodeURIComponent(targetPackage)};end`;
            try {
                window.location.href = intentUrl;
            } catch (e) {
                console.warn('Android Intent trigger failed:', e);
            }
        };

const closeNotification = () => {
            if (notificationTimeout) clearTimeout(notificationTimeout);
            document.getElementById('notification-toast').classList.remove('show');
        };

const showNotification = (message, isError = false, playSound = true) => {
            const toast = document.getElementById('notification-toast');
            if (notificationTimeout) clearTimeout(notificationTimeout);
            const rawMessage = String(message || '');
            const displayMessage = isError && /(^Error:|Firebase|permission-denied|network-request-failed|failed:|Transaction failed:|Redeem failed:|undefined|null|already processed)/i.test(rawMessage)
                ? friendlyErrorMessage()
                : rawMessage;
            const safeMessage = escapeHtml(displayMessage);

            const toastClass = isError ? 'toast-error' : 'toast-success';
            const iconPath = isError
                ? 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
                : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';

            toast.innerHTML = `
                <div class="toast-content ${toastClass}">
                    <div class="toast-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}" />
                        </svg>
                    </div>
                    <div class="toast-message">${safeMessage}</div>
                    <button class="toast-close" onclick="closeNotification()">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <div class="toast-progress"></div>
                </div>`;

            toast.classList.add('show');

            // Play sound if requested
            if (playSound) {
                if (isError) {
                    playErrorSound();
                } else {
                    playSuccessSound();
                }
            }

            notificationTimeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        };

const getNotificationCacheKey = (userId) => `rw_notifications_cache_${userId}`;

const normalizeNotification = (notification = {}) => ({
            id: notification.id || '',
            title: notification.title || 'REVIEWS WORLD',
            message: notification.message || '',
            senderId: notification.senderId || notification.sender_id || '',
            audience: notification.audience || '',
            createdAt: timestampToMillis(notification.createdAt || notification.created_at) || Date.now(),
            expiresAt: timestampToMillis(notification.expiresAt || notification.expires_at) || (Date.now() + 7 * 24 * 60 * 60 * 1000),
            deliveredAt: timestampToMillis(notification.deliveredAt || notification.delivered_at) || 0,
            readAt: timestampToMillis(notification.readAt || notification.read_at) || null,
            deliveredCount: Number(notification.deliveredCount || notification.delivered_count || 0),
            readCount: Number(notification.readCount || notification.read_count || 0),
            unreadCount: Number(notification.unreadCount || notification.unread_count || 0)
        });

const readNotificationsCache = (userId = currentUser?.uid) => {
            if (!userId) return [];
            const cached = readJsonCache(getNotificationCacheKey(userId));
            const now = Date.now();
            return Array.isArray(cached)
                ? cached.map(normalizeNotification).filter(item => item.id && item.expiresAt > now)
                : [];
        };

const writeNotificationsCache = (userId = currentUser?.uid, notifications = []) => {
            if (!userId) return;
            const now = Date.now();
            writeJsonCache(getNotificationCacheKey(userId), notifications
                .map(normalizeNotification)
                .filter(item => item.id && item.expiresAt > now)
                .slice(0, 120));
        };

const mergeNotifications = (...groups) => {
            const merged = new Map();
            groups.flat().forEach(item => {
                const normalized = normalizeNotification(item);
                if (!normalized.id) return;
                merged.set(normalized.id, { ...(merged.get(normalized.id) || {}), ...normalized });
            });
            return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
        };

const isChatNotificationItem = (item) => {
            const title = String(item?.title || '').toLowerCase();
            const msg = String(item?.message || '').toLowerCase();
            const audience = String(item?.audience || '').toLowerCase();
            return audience === 'support_chat' ||
                   title.includes('support message') ||
                   title.includes('support team reply') ||
                   title.includes('💬') ||
                   msg.startsWith('admin:') ||
                   msg.startsWith('from ');
        };

const updateNotificationUnreadBadge = () => {
            const badge = document.getElementById('notification-unread-badge');
            if (!badge) return;
            badge.textContent = notificationUnreadCount > 99 ? '99+' : String(notificationUnreadCount || 0);
            badge.classList.toggle('hidden', notificationUnreadCount <= 0);
        };

const isManualAdminNotification = (item = {}) => {
    const title = String(item.title || '').toLowerCase();
    const msg = String(item.message || '').toLowerCase();
    const isAutoSystem = title.includes('withdraw') || title.includes('recharge') || title.includes('fund') || 
                         title.includes('refer') || title.includes('payout') || title.includes('task') || 
                         title.includes('approval') || title.includes('chat') ||
                         msg.includes('withdrawal of') || msg.includes('has been approved') || msg.includes('has been rejected');
    if (isAutoSystem) return false;
    return !!(item.audience === 'all' || item.audience === 'selected' || item.isManualMessage || item.is_manual_message || item.type === 'manual_admin_broadcast' || item.type === 'manual_admin_message');
};

const refreshNotificationUnreadCount = (notifications = notificationsCache) => {
    notificationUnreadCount = notifications.filter(item => !item.readAt && item.expiresAt > Date.now() && !isChatNotificationItem(item) && isManualAdminNotification(item)).length;
    updateNotificationUnreadBadge();
};

const fetchUserNotifications = async () => {
            const token = await getBackendAuthToken();
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/notifications?limit=200`, {
                headers: { Authorization: `Bearer ${token}` }
            }, 6000);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Notification load failed');
            return (data.notifications || []).map(normalizeNotification);
        };

const preloadNotificationsForUser = async (userId = currentUser?.uid) => {
            if (!userId) return;
            const cached = readNotificationsCache(userId);
            if (cached.length) {
                notificationsCache = cached;
                refreshNotificationUnreadCount(cached);
            }
            const fresh = await fetchUserNotifications();
            notificationsCache = mergeNotifications(fresh, cached);
            writeNotificationsCache(userId, notificationsCache);
            refreshNotificationUnreadCount(notificationsCache);
            renderUserNotificationsList();
        };

const startNotificationAutoRefresh = (userId = currentUser?.uid) => {
            if (!userId) return;
            if (notificationRefreshTimer) clearInterval(notificationRefreshTimer);
            notificationRefreshTimer = setInterval(() => {
                if (!currentUser || currentUser.uid !== userId) return;
                preloadNotificationsForUser(userId).catch(error => {
                    if (error && error.name === 'AbortError') return;
                    console.warn('Notification background refresh skipped:', error);
                });
            }, 45000);
        };

const markNotificationRead = async (notificationId) => {
            if (!notificationId) return;
            notificationsCache = notificationsCache.map(item => item.id === notificationId ? { ...item, readAt: item.readAt || Date.now() } : item);
            writeNotificationsCache(currentUser?.uid, notificationsCache);
            refreshNotificationUnreadCount(notificationsCache);
            renderUserNotificationsList();
            try {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/notifications/${encodeURIComponent(notificationId)}/read`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                }, 5000);
            } catch (error) {
                console.warn('Notification read sync failed:', error);
            }
        };

const renderUserNotificationsList = () => {
            const list = document.getElementById('user-notifications-list');
            if (!list) return;
            const notifications = notificationsCache.filter(item => item.expiresAt > Date.now() && !isChatNotificationItem(item) && isManualAdminNotification(item));
            list.innerHTML = notifications.length
                ? notifications.map(item => `
                    <article class="rounded-2xl border ${item.readAt ? 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800' : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'} p-4 shadow-sm">
                        <div class="flex items-start gap-3">
                            <div class="h-12 w-12 shrink-0 rounded-2xl bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-800 overflow-hidden shadow-sm">
                                <img src="${NOTIFICATION_ICON_URL}" alt="Notification" class="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast] transform-gpu">
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center justify-between gap-2">
                                    <h3 class="font-black text-gray-900 dark:text-white truncate">${escapeHtml(item.title || 'REVIEWS WORLD')}</h3>
                                    ${item.readAt ? '<span class="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300">READ</span>' : '<span class="rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">NEW</span>'}
                                </div>
                                <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">${formatDateDDMMYY(item.createdAt)}</p>
                                <p class="mt-3 whitespace-pre-line break-words text-sm leading-6 text-gray-700 dark:text-gray-200">${escapeHtml(item.message)}</p>
                                <p class="mt-3 text-[10px] font-semibold uppercase text-gray-400 dark:text-gray-500">Auto deletes after 7 days</p>
                            </div>
                        </div>
                    </article>`).join('')
                : '<div class="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400 shadow-sm">No notifications yet.</div>';
        };

const showNotificationsPage = async () => {
            if (!currentUser) return;
            if (currentUser.uid === ADMIN_UID) return showAdminNotificationsPage();
            notificationsCache = readNotificationsCache(currentUser.uid);
            refreshNotificationUnreadCount(notificationsCache);
            const content = `
                ${getPageHeader('Notifications')}
                <div class="max-w-2xl mx-auto space-y-3">
                    <div class="relative rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 p-4 text-white shadow-lg overflow-hidden">
                        <button id="notification-help-btn" class="absolute top-4 right-4 h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center font-bold text-white transition-colors" title="How to enable notifications?">
                            ?
                        </button>
                        <div class="flex items-center gap-3">
                            <div class="h-14 w-14 rounded-2xl bg-white/95 overflow-hidden shadow-sm">
                                <img src="${NOTIFICATION_ICON_URL}" alt="Notifications" class="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast] transform-gpu">
                            </div>
                            <div>
                                <h3 class="text-lg font-black">REVIEWS WORLD Updates</h3>
                                <p class="text-sm text-white/80">Read-only messages from admin</p>
                            </div>
                        </div>
                    </div>
                    <div id="user-notifications-list" class="space-y-3"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { keepBottomNav: false, returnTo: currentMainSection });
            
            document.getElementById('notification-help-btn').onclick = () => {
                renderModal('How to Enable Notifications',
                    `<div class="space-y-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-left">
                        <p class="font-bold text-gray-800 dark:text-white">If you are not receiving push notifications, please follow these steps to enable them manually:</p>
                        <ol class="list-decimal list-inside space-y-2.5 pl-1">
                            <li>Go to your phone's home screen.</li>
                            <li><strong>Long-press (hold)</strong> the <strong>Reviews World</strong> app icon.</li>
                            <li>Tap <strong>App Info</strong> (or the <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 font-bold text-xs text-gray-800 dark:text-gray-200">i</span> icon).</li>
                            <li>Go to the <strong>Notifications</strong> settings.</li>
                            <li>Turn ON the switch to <strong>"Allow Notifications"</strong>.</li>
                        </ol>
                        <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl flex items-start gap-2.5">
                            <span class="text-blue-600 dark:text-blue-400 font-bold text-base">💡</span>
                            <p class="text-xs text-blue-700 dark:text-blue-300">Also ensure that background data usage is allowed and battery saver is not restricting the app for instant notifications.</p>
                        </div>
                    </div>`,
                    `<button onclick="window.closeModal()" class="w-full py-2.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl uppercase tracking-wider shadow-sm" style="outline: none;">Got it</button>`
                );
            };

            renderUserNotificationsList();
            preloadNotificationsForUser(currentUser.uid)
                .then(() => {
                    const unread = notificationsCache.filter(item => !item.readAt && !isChatNotificationItem(item)).map(item => item.id);
                    unread.forEach(id => markNotificationRead(id));
                })
                .catch(error => {
                    console.warn('Notification page refresh failed:', error);
                    showNotification('Could not refresh notifications right now.', true);
                });
        };

const sendSystemNotificationToUser = async ({ userId, title = 'REVIEWS WORLD', message = '' } = {}) => {
            if (!userId || !message || currentUser?.uid !== ADMIN_UID) return;
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/notifications`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        title,
                        message,
                        audience: 'system_withdrawal_status',
                        recipients: [userId]
                    })
                }, 7000);
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) throw new Error(data.error || 'Notification send failed');
            } catch (error) {
                console.warn('System notification skipped:', error);
            }
        };

const getNotificationRecipients = async () => {
            await ensureAdminChatUsersLoaded();
            return allUsersCache.filter(user => !isAdminUserRecord(user) && isUserOnUpdatedWebApp(user));
        };

const getNotificationSearchMatches = () => {
            const search = (document.getElementById('admin-notification-user-search')?.value || '').trim().toLowerCase();
            if (search.length < 2) return [];
            const selectedIds = new Set(adminNotificationSelectedUsers.map(user => String(user.id || user.uid || '')));
            return allUsersCache
                .filter(user => !isAdminUserRecord(user) && !selectedIds.has(String(user.id || user.uid || '')))
                .filter(user => userMatchesSearch(user, search))
                .slice(0, 10);
        };

const fetchNotificationRecipients = async (notificationId) => {
            const token = await getBackendAuthToken();
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/notifications/${encodeURIComponent(notificationId)}/recipients?limit=3000`, {
                headers: { Authorization: `Bearer ${token}` }
            }, 8000);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Recipient list load failed');
            return data.recipients || [];
        };

const showNotificationRecipientsModal = async (notificationId, filter = 'all') => {
            const notification = adminNotificationsCache.find(item => item.id === notificationId);
            renderModal('Notification Readers',
                `<div class="space-y-3">
                    <div class="rounded-xl bg-gray-50 dark:bg-gray-700/60 p-3">
                        <p class="text-xs font-black uppercase text-gray-400">Message</p>
                        <p class="mt-1 text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(notification?.title || 'REVIEWS WORLD')}</p>
                    </div>
                    <div id="notification-reader-list" class="space-y-2">
                        <p class="text-center text-sm text-gray-500 dark:text-gray-400 py-6">Loading readers...</p>
                    </div>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Close</button>`,
                'max-w-lg'
            );
            try {
                await ensureAdminChatUsersLoaded();
                const recipients = await fetchNotificationRecipients(notificationId);
                const filtered = recipients.filter(row => {
                    if (filter === 'read') return !!row.readAt;
                    if (filter === 'unread') return !row.readAt;
                    return true;
                });
                const userMap = new Map(allUsersCache.map(user => [String(user.id || user.uid || ''), user]));
                const list = document.getElementById('notification-reader-list');
                if (!list) return;
                list.innerHTML = filtered.length
                    ? filtered.map(row => {
                        const user = userMap.get(String(row.userId)) || {};
                        return `
                            <div class="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                                <div class="h-10 w-10 shrink-0 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-xs font-black text-blue-700 dark:text-blue-200">${escapeHtml((user.name || user.email || 'U').slice(0, 2).toUpperCase())}</div>
                                <div class="min-w-0 flex-1">
                                    <p class="font-bold text-sm text-gray-900 dark:text-white truncate">${escapeHtml(user.name || 'User')}</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(user.mobile || user.phoneNumber || user.email || row.userId)}</p>
                                    <p class="text-[10px] text-gray-400 dark:text-gray-500">${row.readAt ? `Read: ${formatDateDDMMYY(row.readAt)}` : `Delivered: ${formatDateDDMMYY(row.deliveredAt)}`}</p>
                                </div>
                                <span class="rounded-full px-2 py-1 text-[10px] font-black ${row.readAt ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}">${row.readAt ? 'READ' : 'UNREAD'}</span>
                            </div>`;
                    }).join('')
                    : `<p class="text-center text-sm text-gray-500 dark:text-gray-400 py-6">No ${filter === 'all' ? 'delivered users' : filter + ' users'} found.</p>`;
            } catch (error) {
                console.error('Notification readers load failed:', error);
                const list = document.getElementById('notification-reader-list');
                if (list) list.innerHTML = '<p class="text-center text-sm text-red-500 py-6">Could not load reader list.</p>';
            }
        };

// Expose functions to window for global access
window.initializePushNotifications = initializePushNotifications;
window.openAndroidNotificationSettings = openAndroidNotificationSettings;
window.closeNotification = closeNotification;
window.showNotification = showNotification;
window.getNotificationCacheKey = getNotificationCacheKey;
window.normalizeNotification = normalizeNotification;
window.readNotificationsCache = readNotificationsCache;
window.writeNotificationsCache = writeNotificationsCache;
window.mergeNotifications = mergeNotifications;
window.updateNotificationUnreadBadge = updateNotificationUnreadBadge;
window.refreshNotificationUnreadCount = refreshNotificationUnreadCount;
window.fetchUserNotifications = fetchUserNotifications;
window.preloadNotificationsForUser = preloadNotificationsForUser;
window.startNotificationAutoRefresh = startNotificationAutoRefresh;
window.markNotificationRead = markNotificationRead;
window.renderUserNotificationsList = renderUserNotificationsList;
window.showNotificationsPage = showNotificationsPage;
window.sendSystemNotificationToUser = sendSystemNotificationToUser;
window.getNotificationRecipients = getNotificationRecipients;
window.getNotificationSearchMatches = getNotificationSearchMatches;
window.fetchNotificationRecipients = fetchNotificationRecipients;
window.showNotificationRecipientsModal = showNotificationRecipientsModal;
