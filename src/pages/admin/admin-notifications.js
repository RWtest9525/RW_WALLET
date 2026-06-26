// File: src/pages/admin/admin-notifications.js

const fetchAdminNotifications = async () => {
            const token = await getBackendAuthToken();
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/notifications?limit=100`, {
                headers: { Authorization: `Bearer ${token}` }
            }, 6000);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Admin notifications load failed');
            adminNotificationsCache = (data.notifications || []).map(normalizeNotification);
            renderAdminNotificationsList();
        };

const renderAdminNotificationSelectedUsers = () => {
            const list = document.getElementById('admin-notification-selected-users');
            if (!list) return;
            list.innerHTML = adminNotificationSelectedUsers.length
                ? adminNotificationSelectedUsers.map(user => `
                    <span class="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-200">
                        ${escapeHtml(user.name || user.email || user.mobile || 'User')}
                        <button data-remove-notification-user="${escapeHtml(user.id || user.uid || '')}" class="text-blue-400 hover:text-red-500" type="button">&times;</button>
                    </span>`).join('')
                : '<span class="text-xs text-gray-400 dark:text-gray-500">No selected users yet.</span>';
            list.querySelectorAll('[data-remove-notification-user]').forEach(button => {
                button.onclick = () => {
                    adminNotificationSelectedUsers = adminNotificationSelectedUsers.filter(user => String(user.id || user.uid || '') !== button.dataset.removeNotificationUser);
                    renderAdminNotificationSelectedUsers();
                    renderAdminNotificationSearchResults();
                    updateAdminNotificationTargetPreview();
                };
            });
        };

const renderAdminNotificationSearchResults = () => {
            const list = document.getElementById('admin-notification-search-results');
            if (!list) return;
            const matches = getNotificationSearchMatches();
            const search = (document.getElementById('admin-notification-user-search')?.value || '').trim();
            if (!search) {
                list.innerHTML = '';
                return;
            }
            if (search.length < 2) {
                list.innerHTML = '<p class="rounded-xl bg-gray-50 dark:bg-gray-700/60 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">Type at least 2 letters or digits.</p>';
                return;
            }
            list.innerHTML = matches.length
                ? matches.map(user => `
                    <button data-add-notification-user="${escapeHtml(user.id || user.uid || '')}" type="button" class="w-full rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                        <p class="font-bold text-sm text-gray-900 dark:text-white">${escapeHtml(user.name || 'User')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(user.mobile || user.phoneNumber || user.email || user.id || '')}</p>
                    </button>`).join('')
                : '<p class="rounded-xl bg-gray-50 dark:bg-gray-700/60 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No matching user found.</p>';
            list.querySelectorAll('[data-add-notification-user]').forEach(button => {
                button.onclick = () => {
                    const user = allUsersCache.find(item => String(item.id || item.uid || '') === button.dataset.addNotificationUser);
                    if (!user) return;
                    adminNotificationSelectedUsers = [...adminNotificationSelectedUsers, user];
                    const input = document.getElementById('admin-notification-user-search');
                    if (input) input.value = '';
                    renderAdminNotificationSelectedUsers();
                    renderAdminNotificationSearchResults();
                    updateAdminNotificationTargetPreview();
                };
            });
        };

const renderAdminNotificationsList = () => {
            const list = document.getElementById('admin-notifications-list');
            if (!list) return;
            list.innerHTML = adminNotificationsCache.length
                ? adminNotificationsCache.map(item => `
                    <article class="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <h3 class="font-black text-gray-900 dark:text-white truncate">${escapeHtml(item.title || 'REVIEWS WORLD')}</h3>
                                <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">${formatDateDDMMYY(item.createdAt)} · Deletes ${formatDateDDMMYY(item.expiresAt)}</p>
                                <p class="mt-3 text-sm leading-6 text-gray-700 dark:text-gray-200 whitespace-pre-line break-words">${escapeHtml(item.message)}</p>
                            </div>
                            <button data-delete-notification="${item.id}" class="shrink-0 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-black text-red-600 dark:text-red-300">Delete</button>
                        </div>
                        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
                            <button data-notification-recipients="${item.id}" data-recipient-filter="all" class="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3 hover:ring-2 hover:ring-blue-300 transition"><p class="text-[10px] font-black uppercase text-blue-600 dark:text-blue-300">Delivered</p><p class="text-lg font-black">${item.deliveredCount}</p></button>
                            <button data-notification-recipients="${item.id}" data-recipient-filter="read" class="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 hover:ring-2 hover:ring-emerald-300 transition"><p class="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-300">Read</p><p class="text-lg font-black">${item.readCount}</p></button>
                            <button data-notification-recipients="${item.id}" data-recipient-filter="unread" class="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 hover:ring-2 hover:ring-red-300 transition"><p class="text-[10px] font-black uppercase text-red-600 dark:text-red-300">Unread</p><p class="text-lg font-black">${item.unreadCount}</p></button>
                        </div>
                    </article>`).join('')
                : '<div class="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400 shadow-sm">No notifications sent yet.</div>';
            list.querySelectorAll('[data-notification-recipients]').forEach(button => {
                button.onclick = () => showNotificationRecipientsModal(button.dataset.notificationRecipients, button.dataset.recipientFilter || 'all');
            });
            list.querySelectorAll('[data-delete-notification]').forEach(button => {
                button.onclick = () => deleteAdminNotification(button.dataset.deleteNotification);
            });
        };

const updateAdminNotificationTargetPreview = async () => {
            const mode = document.getElementById('admin-notification-target')?.value || 'all_new_version';
            const searchWrap = document.getElementById('admin-notification-user-wrap');
            const preview = document.getElementById('admin-notification-target-preview');
            if (searchWrap) searchWrap.classList.toggle('hidden', mode !== 'single');
            if (!preview) return;
            if (mode === 'all_new_version') {
                const recipients = await getNotificationRecipients();
                preview.textContent = `Will deliver to ${recipients.length} new version members.`;
            } else {
                preview.textContent = adminNotificationSelectedUsers.length
                    ? `Will deliver to ${adminNotificationSelectedUsers.length} selected user${adminNotificationSelectedUsers.length > 1 ? 's' : ''}.`
                    : 'Search and select one or more users.';
            }
        };

const sendAdminNotification = async () => {
            const title = (document.getElementById('admin-notification-title')?.value || '').trim() || 'REVIEWS WORLD';
            const message = (document.getElementById('admin-notification-message')?.value || '').trim();
            const mode = document.getElementById('admin-notification-target')?.value || 'all_new_version';
            if (!message) return showNotification('Please write notification message.', true);
            await ensureAdminChatUsersLoaded();
            const recipients = mode === 'all_new_version'
                ? (await getNotificationRecipients()).map(user => user.id)
                : adminNotificationSelectedUsers.map(user => user.id || user.uid).filter(Boolean);
            if (!recipients.length) return showNotification('No matching receiver found.', true);

            const button = document.getElementById('admin-send-notification-btn');
            if (button) {
                button.disabled = true;
                button.textContent = 'Sending...';
            }
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/notifications`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ title, message, audience: mode, recipients })
                }, 10000);
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) throw new Error(data.error || 'Send failed');
                document.getElementById('admin-notification-message').value = '';
                adminNotificationSelectedUsers = [];
                renderAdminNotificationSelectedUsers();
                renderAdminNotificationSearchResults();
                showNotification(`Notification sent to ${recipients.length} member${recipients.length > 1 ? 's' : ''}.`);
                await fetchAdminNotifications();
                updateAdminNotificationTargetPreview();
            } catch (error) {
                console.error('Notification send failed:', error);
                showNotification('Could not send notification.', true);
            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = 'Send Notification';
                }
            }
        };

const deleteAdminNotification = async (notificationId) => {
            if (!notificationId || !confirm('Delete this notification from every user?')) return;
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/notifications/${encodeURIComponent(notificationId)}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                }, 6000);
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) throw new Error(data.error || 'Delete failed');
                adminNotificationsCache = adminNotificationsCache.filter(item => item.id !== notificationId);
                renderAdminNotificationsList();
                showNotification('Notification deleted.');
            } catch (error) {
                console.error('Notification delete failed:', error);
                showNotification('Could not delete notification.', true);
            }
        };

const showAdminNotificationsPage = async () => {
            if (currentUser?.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const content = `
                ${getPageHeader('Notifications')}
                <div class="max-w-3xl mx-auto space-y-4">
                    <section class="rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="h-14 w-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 p-2">
                                <img src="https://cdn-icons-png.flaticon.com/512/1827/1827370.png" alt="Notification" class="h-full w-full object-contain">
                            </div>
                            <div>
                                <h3 class="text-lg font-black">Send Notification</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Users can only read. Messages auto delete after 7 days.</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 gap-3">
                            <select id="admin-notification-target" class="w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="all_new_version">All new version members</option>
                                <option value="single">Selected users</option>
                            </select>
                            <div id="admin-notification-user-wrap" class="hidden space-y-2">
                                <input id="admin-notification-user-search" type="search" autocomplete="off" placeholder="Search name, mobile, email, then select user" class="w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <div id="admin-notification-search-results" class="grid grid-cols-1 gap-2"></div>
                                <div id="admin-notification-selected-users" class="flex flex-wrap gap-2"></div>
                            </div>
                            <p id="admin-notification-target-preview" class="text-xs font-bold text-blue-600 dark:text-blue-300">Loading members...</p>
                            <input id="admin-notification-title" type="text" maxlength="120" value="REVIEWS WORLD" placeholder="Title" class="w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <textarea id="admin-notification-message" rows="4" placeholder="Write notification message..." class="w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                            <button id="admin-send-notification-btn" class="rounded-xl bg-blue-600 px-4 py-3 font-black text-white shadow-sm hover:bg-blue-700 transition">Send Notification</button>
                        </div>
                    </section>
                    <section>
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="font-black text-gray-900 dark:text-white">Sent Notifications</h3>
                            <button id="admin-refresh-notifications-btn" class="rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-black">Refresh</button>
                        </div>
                        <div id="admin-notifications-list" class="space-y-3"></div>
                    </section>
                </div>
                ${getPageFooter()}`;
            showPage(content, { keepBottomNav: true, returnTo: 'admin' });
            setBottomNavActive('bottom-admin-btn');
            document.getElementById('admin-notification-target').addEventListener('change', updateAdminNotificationTargetPreview);
            document.getElementById('admin-notification-user-search').addEventListener('input', () => {
                renderAdminNotificationSearchResults();
                updateAdminNotificationTargetPreview();
            });
            document.getElementById('admin-send-notification-btn').onclick = sendAdminNotification;
            document.getElementById('admin-refresh-notifications-btn').onclick = fetchAdminNotifications;
            ensureAdminChatUsersLoaded().then(() => {
                renderAdminNotificationSelectedUsers();
                renderAdminNotificationSearchResults();
                updateAdminNotificationTargetPreview();
            });
            renderAdminNotificationsList();
            fetchAdminNotifications().catch(error => {
                console.error('Admin notifications load failed:', error);
                showNotification('Could not load sent notifications.', true);
            });
        };

// Expose functions to window for global access
window.fetchAdminNotifications = fetchAdminNotifications;
window.renderAdminNotificationSelectedUsers = renderAdminNotificationSelectedUsers;
window.renderAdminNotificationSearchResults = renderAdminNotificationSearchResults;
window.renderAdminNotificationsList = renderAdminNotificationsList;
window.updateAdminNotificationTargetPreview = updateAdminNotificationTargetPreview;
window.sendAdminNotification = sendAdminNotification;
window.deleteAdminNotification = deleteAdminNotification;
window.showAdminNotificationsPage = showAdminNotificationsPage;
