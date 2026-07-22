// File: src/pages/admin/admin-chats.js

const updateAdminChatUnreadBadges = () => {
            const badge = document.getElementById('admin-chat-unread-badge');
            if (!badge) return;
            badge.textContent = adminChatUnreadCount > 99 ? '99+' : String(adminChatUnreadCount || '');
            badge.classList.toggle('hidden', adminChatUnreadCount <= 0);
        };

const calculateAdminChatUnreadCount = (chats = allSupportChatsCache) => chats.filter(chat => {
            const roomId = chat.roomId || chat.room_id || getSupportRoomId(chat.userId || chat.id);
            const lastSenderId = chat.lastSenderId || chat.last_sender_id || '';
            const updatedAt = timestampToMillis(chat.updatedAt || chat.updated_at);
            const seenAt = Number(localStorage.getItem(getAdminSupportChatSeenKey(roomId)) || 0);
            return lastSenderId && lastSenderId !== currentUser?.uid && updatedAt > seenAt;
        }).length;

const refreshAdminChatUnreadCount = () => {
            adminChatUnreadCount = calculateAdminChatUnreadCount();
            updateAdminChatUnreadBadges();
        };

const preloadAdminChatRooms = (chats = allSupportChatsCache) => {
            if (!hasAdminSessionReadyOrCached()) return;
            chats.slice(0, 25).forEach(chat => {
                const roomId = chat.roomId || getSupportRoomId(chat.userId || chat.id);
                if (!roomId) return;
                const cached = readSupportChatCache(roomId);
                fetchSupportChatHistory(roomId, 120)
                    .then(history => {
                        const merged = mergeSupportMessages(cached, history);
                        writeSupportChatCache(roomId, merged);
                        refreshAdminChatUnreadCount();
                    })
                    .catch(error => console.warn('Admin chat room preload skipped:', error));
            });
        };

const subscribeAdminChatRooms = async (chats = allSupportChatsCache) => {
            if (!hasAdminSessionReadyOrCached()) return;
            const socket = await getSupportSocket();
            if (adminChatBackgroundHandlers) {
                socket.off('new_message', adminChatBackgroundHandlers.message);
                socket.off('chat_read', adminChatBackgroundHandlers.read);
            }

            const updateRoomFromMessage = (message) => {
                const normalized = normalizeBackendMessage(message);
                if (!normalized.roomId) return;
                const userId = normalized.roomId.replace(/^support_/, '');
                const isActiveRoomOpen = activeSupportRoomId === normalized.roomId && document.getElementById('support-chat-messages');
                const cachedMessages = mergeSupportMessages(readSupportChatCache(normalized.roomId), [normalized]);
                writeSupportChatCache(normalized.roomId, cachedMessages);

                const existingIndex = allSupportChatsCache.findIndex(chat => (chat.roomId || getSupportRoomId(chat.userId || chat.id)) === normalized.roomId);
                const existing = existingIndex >= 0 ? allSupportChatsCache[existingIndex] : {};
                const userProfile = allUsersCache.find(user => (user.id || user.uid) === userId) || {};
                const updatedChat = {
                    ...existing,
                    id: existing.id || userId,
                    userId: existing.userId || userId,
                    roomId: normalized.roomId,
                    userName: existing.userName || userProfile.name || 'User',
                    userEmail: existing.userEmail || userProfile.email || '',
                    userMobile: existing.userMobile || getUserMobileValue(userProfile) || '',
                    lastMessage: normalized.text,
                    lastSenderId: normalized.senderId,
                    updatedAt: timestampToMillis(normalized.createdAt) || Date.now()
                };

                if (existingIndex >= 0) {
                    allSupportChatsCache[existingIndex] = updatedChat;
                } else {
                    allSupportChatsCache.unshift(updatedChat);
                }
                allSupportChatsCache.sort((a, b) => timestampToMillis(b.updatedAt || b.updated_at) - timestampToMillis(a.updatedAt || a.updated_at));
                if (!isActiveRoomOpen) refreshAdminChatUnreadCount();
                renderAdminChatsList();
            };

            const handleAdminBackgroundRead = ({ roomId, readerRole, readAt }) => {
                applySupportReadReceipt(roomId, readerRole, readAt);
                renderAdminChatsList();
            };

            adminChatBackgroundHandlers = {
                message: updateRoomFromMessage,
                read: handleAdminBackgroundRead
            };
            socket.on('new_message', updateRoomFromMessage);
            socket.on('chat_read', handleAdminBackgroundRead);

            chats.slice(0, 200).forEach(chat => {
                const roomId = chat.roomId || getSupportRoomId(chat.userId || chat.id);
                if (!roomId || adminChatSubscribedRooms.has(roomId)) return;
                adminChatSubscribedRooms.add(roomId);
                socket.emit('join_room', { roomId, limit: 1, markRead: false });
            });
        };

const loadAdminChatsFromBackend = async ({ silent = false, retry = true, subscribeRealtime = false } = {}) => {
            if (!hasAdminSessionReadyOrCached()) return;
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/chats?limit=200`, {
                    headers: { Authorization: `Bearer ${token}` }
                }, 8000);
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.ok) {
                    throw new Error(data.error || 'Admin chat load failed');
                }
                let chatList = (data.chats || []).map(chat => ({
                    id: chat.user_id || chat.room_id?.replace(/^support_/, ''),
                    userId: chat.user_id || chat.room_id?.replace(/^support_/, ''),
                    roomId: chat.room_id || getSupportRoomId(chat.user_id || ''),
                    userName: chat.user_name || 'User',
                    userEmail: chat.user_email || '',
                    userMobile: chat.user_mobile || '',
                    lastMessage: chat.last_message || '',
                    lastSenderId: chat.last_sender_id || '',
                    updatedAt: chat.updated_at || Date.now()
                }));
                if (!checkIsOwner(currentUser, currentUserData)) {
                    chatList = chatList.filter(chat => {
                        if (!chat.roomId) return true;
                        return chat.roomId.endsWith(`_${currentUser?.uid}`) || chat.roomId.includes(ADMIN_UID) || (chat.userId === ADMIN_UID);
                    });
                }
                allSupportChatsCache = chatList;
                refreshAdminChatUnreadCount();
                renderAdminChatsList();
                preloadAdminChatRooms(allSupportChatsCache);
                if (subscribeRealtime) {
                    subscribeAdminChatRooms(allSupportChatsCache).catch(error => console.warn('Admin chat socket subscribe skipped:', error));
                }
            } catch (error) {
                const log = silent ? console.warn : console.error;
                log('Cloudflare admin chat list failed:', error);
                if (retry) {
                    setTimeout(() => loadAdminChatsFromBackend({ silent, retry: false, subscribeRealtime }).catch(() => {}), 2500);
                }
                if (!silent && document.getElementById('admin-chats-list')) {
                    showNotification('Could not load chat list from backend. Retrying once...', true);
                }
            }
        };

const getAdminChatUserMeta = (user = {}) => {
            const isMainOwner = user.id === ADMIN_UID || user.uid === ADMIN_UID || user.email === 'reviewsworld51@gmail.com' || user.email === 'reviewsworld01@gmail.com' || user.role === 'owner';
            return {
                id: user.id || user.uid || '',
                userId: user.id || user.uid || '',
                userName: isMainOwner ? (user.name || 'Main Owner (Admin)') : (user.name || user.fullName || user.displayName || user.email || 'User'),
                userEmail: user.email || '',
                userMobile: user.mobile || user.phoneNumber || user.phone || '',
                userAvatar: user.profilePhoto || user.profile_photo || user.avatarUrl || user.avatar_url || ''
            };
        };

const ensureAdminChatUsersLoaded = async () => {
            if (!hasAdminSessionReadyOrCached() || allUsersCache.length) return;
            try {
                const usersSnap = await getDocs(query(collection(db, `artifacts/${appId}/public/data/users`)));
                let list = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const isOwner = checkIsOwner(currentUser, currentUserData);
                if (!isOwner) {
                    list = list.filter(u => (u.id === ADMIN_UID || u.uid === ADMIN_UID || u.email === 'reviewsworld51@gmail.com' || u.email === 'reviewsworld01@gmail.com' || u.role === 'owner') || u.parentAdmin === currentUser?.uid || u.parent_admin === currentUser?.uid);
                }
                allUsersCache = list;
            } catch (error) {
                console.warn('Admin chat user search load failed:', error);
            }
        };

const renderAdminChatsList = () => {
            const list = document.getElementById('admin-chats-list');
            if (!list) return;
            const searchTerm = (document.getElementById('admin-chat-search')?.value || '').trim().toLowerCase();
            const isOwner = checkIsOwner(currentUser, currentUserData);
            const chatsToRender = searchTerm
                ? allSupportChatsCache.filter(chat => [
                    chat.userName,
                    chat.userEmail,
                    chat.userMobile,
                    chat.lastMessage
                ].some(value => String(value || '').toLowerCase().includes(searchTerm)))
                : allSupportChatsCache;
            const existingChatUserIds = new Set(allSupportChatsCache.map(chat => String(chat.userId || chat.id || '')));

            let baseUsersForSearch = [...allUsersCache];
            const hasOwnerInCache = baseUsersForSearch.some(u => u.id === ADMIN_UID || u.uid === ADMIN_UID || u.email === 'reviewsworld51@gmail.com' || u.email === 'reviewsworld01@gmail.com');
            if (!isOwner && !hasOwnerInCache) {
                baseUsersForSearch.push({
                    id: ADMIN_UID,
                    uid: ADMIN_UID,
                    name: 'Main Owner (Admin)',
                    email: 'reviewsworld51@gmail.com',
                    role: 'owner'
                });
            }

            const usersToStartChat = searchTerm
                ? baseUsersForSearch
                    .filter(user => {
                        const uid = user.id || user.uid;
                        if (isOwner) {
                            return uid !== ADMIN_UID && user.role !== 'owner';
                        } else {
                            const isMainOwner = uid === ADMIN_UID || user.email === 'reviewsworld51@gmail.com' || user.email === 'reviewsworld01@gmail.com' || user.role === 'owner';
                            if (isMainOwner) return true;
                            if (user.role === 'admin' || user.role === 'subadmin') return false;
                            const parent = user.parentAdmin || user.parent_admin;
                            return parent === currentUser?.uid;
                        }
                    })
                    .map(getAdminChatUserMeta)
                    .filter(user => user.userId && !existingChatUserIds.has(String(user.userId)))
                    .filter(user => [
                        user.userName,
                        user.userEmail,
                        user.userMobile
                    ].some(value => String(value || '').toLowerCase().includes(searchTerm)))
                    .slice(0, 20)
                : [];

            const chatRows = chatsToRender.map(chat => {
                    const isOwnerChat = chat.userId === ADMIN_UID || chat.id === ADMIN_UID || chat.roomId?.includes(ADMIN_UID);
                    const displayName = isOwnerChat && !isOwner ? 'REVIEWS WORLD (Owner)' : (chat.userName || 'User');
                    const displayEmail = isOwnerChat && !isOwner ? 'reviewsworld01@gmail.com' : (chat.userEmail || '');
                    const avatarUrl = isOwnerChat ? 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' : (chat.userAvatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png');

                    return `
                    <button data-chat-userid="${chat.userId || chat.id}" data-chat-source="cache" class="admin-chat-row w-full flex items-center gap-3 p-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" class="h-11 w-11 rounded-full object-cover shrink-0">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                                <h3 class="font-bold text-sm truncate">${escapeHtml(displayName)}</h3>
                                <span class="text-[10px] text-gray-400 shrink-0">${formatChatTime(chat.updatedAt)}</span>
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">${escapeHtml(displayEmail || chat.userMobile || '')}</p>
                            <p class="text-xs text-gray-600 dark:text-gray-300 truncate mt-1">${escapeHtml(chat.lastMessage || 'No messages yet')}</p>
                        </div>
                    </button>`;
                }).join('');

            const userRows = usersToStartChat.map(user => {
                    const avatarUrl = user.userAvatar || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
                    return `
                    <button data-chat-userid="${user.userId}" data-chat-source="user-search" class="admin-chat-row w-full flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl shadow-sm text-left hover:bg-blue-100 dark:hover:bg-blue-900/40 transition">
                        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(user.userName || 'User')}" class="h-12 w-12 rounded-full object-cover shrink-0">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                                <h3 class="font-bold truncate">${escapeHtml(user.userName || 'User')}</h3>
                                <span class="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-black uppercase text-white">Start chat</span>
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(user.userMobile || user.userEmail || '')}</p>
                            <p class="text-sm text-blue-700 dark:text-blue-300 truncate">Send a new message</p>
                        </div>
                    </button>`;
                }).join('');

            if (!chatRows && !userRows) {
                list.innerHTML = searchTerm
                    ? '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No user or chat found.</p>'
                    : '<p class="text-center text-gray-500 dark:text-gray-400 py-8">No chats received yet.</p>';
            } else {
                list.innerHTML = `
                    ${chatRows ? `<div class="space-y-3">${chatRows}</div>` : ''}
                    ${userRows ? `
                    <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <p class="px-1 pb-2 text-xs font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">Users</p>
                        <div class="space-y-3">${userRows}</div>
                    </div>` : ''}`;
            }
            document.querySelectorAll('.admin-chat-row').forEach(row => {
                row.onclick = () => {
                    const targetUserId = row.dataset.chatUserid;
                    const chat = allSupportChatsCache.find(item => (item.userId || item.id) === targetUserId);
                    const searchedUser = baseUsersForSearch.map(getAdminChatUserMeta).find(item => item.userId === targetUserId);
                    const chatMeta = chat || searchedUser || {};
                    const isTargetingOwner = !isOwner && (targetUserId === ADMIN_UID || chatMeta.userId === ADMIN_UID);

                    const adminId = isOwner ? ADMIN_UID : subAdminUid;
                    const roomId = chatMeta.roomId || getSupportRoomId(targetUserId, adminId);
                    markAdminSupportChatSeen(roomId, readSupportChatCache(roomId));

                    openSupportChatPage(targetUserId, isTargetingOwner ? 'user' : 'admin', {
                        ...chatMeta,
                        roomId,
                        adminId: isTargetingOwner ? ADMIN_UID : adminId,
                        adminName: 'REVIEWS WORLD',
                        adminEmail: 'reviewsworld01@gmail.com'
                    });
                };
            });
        };

const showAdminChatsPage = () => {
            const content = `
                ${getPageHeader('Manage Chat')}
                <div class="max-w-2xl mx-auto space-y-3">
                    <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-3">
                        <input id="admin-chat-search" type="search" placeholder="Search chat or any user by name, email, phone" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div id="admin-chats-list" class="space-y-3"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content);
            setBottomNavActive('bottom-settings-btn');
            document.getElementById('admin-chat-search').addEventListener('input', renderAdminChatsList);
            renderAdminChatsList();
            loadAdminChatsFromBackend({ silent: false, subscribeRealtime: false });
            ensureAdminChatUsersLoaded().then(renderAdminChatsList);
        };

// Expose functions to window for global access
window.updateAdminChatUnreadBadges = updateAdminChatUnreadBadges;
window.calculateAdminChatUnreadCount = calculateAdminChatUnreadCount;
window.refreshAdminChatUnreadCount = refreshAdminChatUnreadCount;
window.preloadAdminChatRooms = preloadAdminChatRooms;
window.subscribeAdminChatRooms = subscribeAdminChatRooms;
window.loadAdminChatsFromBackend = loadAdminChatsFromBackend;
window.getAdminChatUserMeta = getAdminChatUserMeta;
window.ensureAdminChatUsersLoaded = ensureAdminChatUsersLoaded;
window.renderAdminChatsList = renderAdminChatsList;
window.showAdminChatsPage = showAdminChatsPage;
