// File: src/pages/support.js

const getSupportSocket = async ({ timeoutMs = 2500 } = {}) => {
            await loadSocketIoClient(timeoutMs);
            const token = await getBackendAuthToken();
            if (supportSocket?.connected) return supportSocket;

            if (!supportSocket) {
                supportSocket = window.io(BACKEND_BASE_URL, {
                    transports: ['websocket', 'polling'],
                    auth: { token },
                    autoConnect: false
                });

                supportSocket.on('connect_error', async (error) => {
                    console.warn('Support socket connection failed:', error?.message || error);
                    if (/token|auth/i.test(error.message || '')) {
                        backendAuthToken = '';
                    }
                });
            } else {
                supportSocket.auth = { token };
            }

            if (!supportSocket.connected) {
                supportSocket.connect();
                await new Promise((resolve, reject) => {
                    let done = false;
                    const onConnect = () => {
                        if (done) return;
                        done = true;
                        cleanup();
                        resolve(supportSocket);
                    };
                    const onConnectError = (error) => {
                        if (done) return;
                        done = true;
                        cleanup();
                        reject(error || new Error('Connection failed'));
                    };
                    const timeout = setTimeout(() => {
                        if (done) return;
                        done = true;
                        cleanup();
                        reject(new Error('Connection timeout'));
                    }, timeoutMs);
                    const cleanup = () => {
                        clearTimeout(timeout);
                        supportSocket.off('connect', onConnect);
                        supportSocket.off('connect_error', onConnectError);
                    };
                    supportSocket.on('connect', onConnect);
                    supportSocket.on('connect_error', onConnectError);
                });
            }

            return supportSocket;
        };

const installChatViewportLock = ({ shellId, composerId, inputId, messagesId }) => {
            const shell = document.getElementById(shellId);
            const composer = document.getElementById(composerId);
            const input = document.getElementById(inputId);
            const messages = document.getElementById(messagesId);
            const pageContainer = document.getElementById('page-container');
            if (!shell || !composer || !input || !messages) return null;

            const isSmallTouchScreen = () => {
                const ua = navigator.userAgent || '';
                const isDesktopOS = /Windows|Macintosh|Linux/i.test(ua) && !/Android|iPhone|iPad|iPod/i.test(ua);
                if (isDesktopOS) return false;
                return window.matchMedia?.('(pointer: coarse)')?.matches ||
                       Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 768;
            };

            if (!isSmallTouchScreen()) {
                // On desktop/laptop screen sizes, bypass viewport locking to prevent layout shrinking
                requestAnimationFrame(() => {
                    messages.scrollTop = messages.scrollHeight;
                });
                return () => {};
            }

            let scheduledFrame = 0;
            let keyboardFallbackActive = false;
            let baseViewportHeight = Math.max(
                window.innerHeight || 0,
                document.documentElement.clientHeight || 0,
                window.visualViewport?.height || 0
            );

            const getCurrentLayoutHeight = () => Math.max(
                window.innerHeight || 0,
                document.documentElement.clientHeight || 0,
                window.visualViewport?.height || 0
            );

            const clearChatViewport = () => {
                keyboardFallbackActive = false;
                shell.style.height = '';
                shell.style.maxHeight = '';
                shell.style.minHeight = '';
                shell.classList.remove('chat-keyboard-active');
                composer.classList.remove('chat-composer-floating');
                messages.style.paddingBottom = '';
                if (pageContainer) pageContainer.style.overflowY = 'hidden';
            };

            const getKeyboardHeight = () => {
                const viewport = window.visualViewport;
                const layoutHeight = getCurrentLayoutHeight();
                baseViewportHeight = Math.max(baseViewportHeight, layoutHeight);
                const vkRect = navigator.virtualKeyboard?.boundingRect;
                const virtualKeyboardHeight = Number(vkRect?.height || 0);
                if (virtualKeyboardHeight >= 60) {
                    return Math.min(virtualKeyboardHeight, Math.round(baseViewportHeight * 0.58));
                }
                if (viewport && viewport.height > 0 && viewport.height < baseViewportHeight - 60) {
                    const visualHeight = baseViewportHeight - viewport.height - Math.max(0, viewport.offsetTop || 0);
                    return Math.min(Math.max(0, visualHeight), Math.round(baseViewportHeight * 0.58));
                }
                if (document.activeElement === input && keyboardFallbackActive && isSmallTouchScreen()) {
                    return Math.round(Math.min(360, Math.max(260, baseViewportHeight * 0.42)));
                }
                return 0;
            };

            const syncChatViewport = () => {
                const keyboardHeight = getKeyboardHeight();
                const keyboardOpen = keyboardHeight >= 60;
                const visibleHeight = keyboardOpen
                    ? Math.max(300, baseViewportHeight - keyboardHeight)
                    : Math.max(300, getCurrentLayoutHeight());
                shell.style.height = `${visibleHeight}px`;
                shell.style.maxHeight = `${visibleHeight}px`;
                shell.style.minHeight = `${visibleHeight}px`;
                shell.classList.toggle('chat-keyboard-active', keyboardOpen);
                composer.classList.toggle('chat-composer-floating', keyboardOpen);
                messages.style.paddingBottom = keyboardOpen ? '0.5rem' : '';
                if (pageContainer) pageContainer.style.overflowY = 'hidden';

                requestAnimationFrame(() => {
                    messages.scrollTop = messages.scrollHeight;
                });
            };

            const requestSyncChatViewport = () => {
                if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
                scheduledFrame = requestAnimationFrame(() => {
                    scheduledFrame = 0;
                    syncChatViewport();
                });
            };

            const scheduleSyncChatViewport = () => {
                requestSyncChatViewport();
                setTimeout(requestSyncChatViewport, 80);
                setTimeout(requestSyncChatViewport, 180);
                setTimeout(requestSyncChatViewport, 360);
                setTimeout(requestSyncChatViewport, 700);
            };

            const refreshTypingVisible = () => {
                scheduleSyncChatViewport();
            };
            const handleFocus = () => {
                baseViewportHeight = Math.max(baseViewportHeight, getCurrentLayoutHeight());
                scheduleSyncChatViewport();
                setTimeout(() => {
                    if (document.activeElement !== input) return;
                    if (getKeyboardHeight() < 60) {
                        keyboardFallbackActive = true;
                        scheduleSyncChatViewport();
                    }
                }, 320);
            };
            const handleBlur = () => {
                setTimeout(clearChatViewport, 60);
            };
            const handlePointerDown = (event) => {
                if (event.target === input) return;
                if (composer.contains(event.target)) return;
                input.blur();
                clearChatViewport();
            };
            const handleViewportChange = () => {
                if (document.activeElement === input) {
                    scheduleSyncChatViewport();
                } else {
                    clearChatViewport();
                }
            };

            input.addEventListener('focus', handleFocus);
            input.addEventListener('input', refreshTypingVisible);
            input.addEventListener('blur', handleBlur);
            document.addEventListener('pointerdown', handlePointerDown, true);
            window.visualViewport?.addEventListener('resize', handleViewportChange);
            window.visualViewport?.addEventListener('scroll', handleViewportChange);
            navigator.virtualKeyboard?.addEventListener?.('geometrychange', handleViewportChange);
            window.addEventListener('orientationchange', handleViewportChange);

            return () => {
                input.removeEventListener('focus', handleFocus);
                input.removeEventListener('input', refreshTypingVisible);
                input.removeEventListener('blur', handleBlur);
                document.removeEventListener('pointerdown', handlePointerDown, true);
                window.visualViewport?.removeEventListener('resize', handleViewportChange);
                window.visualViewport?.removeEventListener('scroll', handleViewportChange);
                navigator.virtualKeyboard?.removeEventListener?.('geometrychange', handleViewportChange);
                window.removeEventListener('orientationchange', handleViewportChange);
                clearChatViewport();
            };
        };

const getSupportLogo = () => 'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg';

const getRevyBotLogo = (sizeClass = 'h-14 w-14') => `
            ${getPremiumLogoFrame(`<img src="${CHATBOT_ICON_URL}" alt="REVY AI" class="max-h-full max-w-full rounded-full object-contain" loading="eager" fetchpriority="high" decoding="async">`, sizeClass)}`;

const getSupportLogoFrame = (sizeClass = 'h-14 w-14', extraClass = '') => `
            ${getPremiumLogoFrame(`<img src="${getSupportLogo()}" alt="REVIEWS WORLD" class="h-full w-full rounded-full object-cover" loading="eager" fetchpriority="high" decoding="async">`, sizeClass, extraClass)}`;

const showSupportProfileModal = async () => {
            let supportProfile = allUsersCache.find(u => u.id === ADMIN_UID) || {};
            try {
                const adminDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/users`, ADMIN_UID));
                if (adminDoc.exists()) supportProfile = { id: ADMIN_UID, ...adminDoc.data() };
            } catch (e) {
                console.error('Support profile load failed:', e);
            }

            const whatsappNumber = supportProfile.whatsappNumber || supportProfile.mobile || '';
            const whatsappDigits = whatsappNumber.replace(/\D/g, '');
            const whatsappHrefNumber = whatsappDigits.length > 10 ? whatsappDigits : `91${whatsappDigits.slice(-10)}`;
            const websiteLinks = Array.isArray(supportProfile.websiteLinks) ? supportProfile.websiteLinks.slice(0, 3) : [];
            const renderSupportLink = (link) => {
                const safeLink = escapeHtml(link);
                return `<a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="block rounded-xl border border-blue-100 dark:border-blue-800 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 break-all hover:underline">${safeLink}</a>`;
            };
            renderModal('REVIEWS WORLD',
                `<div class="space-y-4 text-center">
                    ${getSupportLogoFrame('h-20 w-20', 'mx-auto')}
                    <div class="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4">
                        <h3 class="text-lg font-bold text-blue-900 dark:text-blue-100 inline-flex items-center justify-center gap-1">REVIEWS WORLD ${getVerifiedBadge()}</h3>
                        <p class="text-sm text-blue-600 dark:text-blue-300">${escapeHtml(supportProfile.email || 'reviewsworld01@gmail.com')}</p>
                    </div>
                    <div class="grid grid-cols-1 gap-3 text-left">
                        <div class="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-4">
                            <p class="text-xs font-bold uppercase text-green-600 dark:text-green-300 mb-2">WhatsApp</p>
                            ${whatsappNumber
                                ? `<a href="https://wa.me/${escapeHtml(whatsappHrefNumber)}" target="_blank" rel="noopener noreferrer" class="text-sm font-bold text-green-800 dark:text-green-100 hover:underline">${escapeHtml(whatsappNumber)}</a>`
                                : '<p class="text-sm text-gray-500 dark:text-gray-400">Not added yet</p>'}
                        </div>
                        <div class="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4">
                            <p class="text-xs font-bold uppercase text-blue-600 dark:text-blue-300 mb-2">Website Links</p>
                            <div class="space-y-2">
                                ${websiteLinks.length ? websiteLinks.map(renderSupportLink).join('') : '<p class="text-sm text-gray-500 dark:text-gray-400">No website links added</p>'}
                            </div>
                        </div>
                    </div>
                    <div class="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-4 text-left">
                        <p class="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-300 mb-2">Description</p>
                        <p class="text-sm leading-6 text-gray-700 dark:text-gray-200">${escapeHtml(SUPPORT_PROFILE_DESCRIPTION)}</p>
                    </div>
                </div>`,
                ``,
                'max-w-md');
        };

const formatChatTime = (timestamp) => {
            if (!timestamp) return '';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

const formatChatDate = (timestamp) => {
            if (!timestamp) return '';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            if (Number.isNaN(date.getTime())) return '';
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        };

const markChatMessagesRead = async (messageDocs, readerRole) => {
            const batch = writeBatch(db);
            let hasUpdates = false;
            messageDocs.forEach(messageDoc => {
                const data = messageDoc.data();
                if (data.senderRole !== readerRole && !data.readAt) {
                    batch.update(messageDoc.ref, { readAt: serverTimestamp() });
                    hasUpdates = true;
                }
            });
            if (hasUpdates) {
                await batch.commit();
            }
        };
let isMultiSelectMode = false;
const selectedMessageIds = new Set();

const renderSupportMessages = (messages, viewerRole) => {
            const list = document.getElementById('support-chat-messages');
            if (!list) return;
            const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 90;

            const myUid = (typeof getCurrentUserId === 'function' ? getCurrentUserId() : (currentUser?.uid || ''));
            const deletedIds = JSON.parse(localStorage.getItem(`deleted_message_ids_${myUid}`) || '[]');
            const visibleMessages = messages.filter(msg => !deletedIds.includes(msg.id));

            list.innerHTML = visibleMessages.length === 0
                ? '<p class="text-center text-sm text-gray-500 dark:text-gray-400 py-8">Start a chat with Reviews World support.</p>'
                : visibleMessages.map((message, index) => {
                    const msgSenderId = typeof getResolvedSenderId === 'function' ? getResolvedSenderId(message) : (message.senderId || '');
                    const impersonatedUid = localStorage.getItem('impersonated_sub_admin_uid') || '';
                    const isMine = (msgSenderId && myUid)
                        ? (msgSenderId === myUid || msgSenderId === currentUser?.uid || (impersonatedUid && msgSenderId === impersonatedUid))
                        : (message.senderRole === viewerRole);
                    const messageDate = formatChatDate(message.createdAt);
                    const previousDate = index > 0 ? formatChatDate(visibleMessages[index - 1].createdAt) : '';
                    const dateDivider = messageDate && messageDate !== previousDate
                        ? `<div class="flex justify-center py-1">
                                <span class="rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 shadow-sm">${messageDate}</span>
                           </div>`
                        : '';
                    
                    const isAdminView = viewerRole === 'admin';
                    let inspectBtnHtml = '';
                    if (isAdminView && !isMine && (message.text.includes('Submission ID:') || message.text.includes('Task ID:'))) {
                        inspectBtnHtml = `
                            <div class="mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-755 w-full">
                                <button type="button" class="admin-inspect-btn w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center gap-1" data-msg-id="${message.id}" style="outline: none;">
                                    🔍 Inspect details
                                </button>
                            </div>
                        `;
                    }

                    const isSelected = selectedMessageIds.has(message.id);
                    const selectionCheckHtml = isMultiSelectMode
                        ? `<div class="msg-select-check flex items-center justify-center px-2 shrink-0 select-none cursor-pointer" data-msg-id="${message.id}">
                               <div class="h-5 w-5 min-w-[20px] min-h-[20px] max-w-[20px] max-h-[20px] aspect-square rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-gray-300 dark:border-gray-600 bg-transparent'}">
                                   ${isSelected ? '<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>' : ''}
                               </div>
                           </div>`
                        : '';

                    return `
                        ${dateDivider}
                        <div class="flex items-center ${isMine ? 'justify-end' : 'justify-start'} py-0.5" data-message-id="${message.id}">
                            ${!isMine ? selectionCheckHtml : ''}
                            <div class="support-chat-bubble w-fit max-w-[82%] px-3 py-1.5 shadow-sm cursor-pointer select-none rounded-2xl ${isMine ? 'chat-bubble-user bg-emerald-50 dark:bg-emerald-900/40 text-gray-900 dark:text-white border border-emerald-100 dark:border-emerald-800' : 'chat-bubble-admin bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700'}" data-msg-id="${message.id}" data-is-mine="${isMine}">
                                <span class="text-sm leading-5 break-words align-baseline whitespace-pre-wrap block" id="msg-text-content-${message.id}">${escapeHtml(message.text || '')}</span>
                                ${inspectBtnHtml}
                                <span class="inline-flex items-center text-[10px] ml-2 text-gray-400 align-baseline mt-1.5 w-full justify-end select-none">
                                    <span>${formatChatTime(message.createdAt)}</span>
                                    ${renderMessageTicks(message, isMine, viewerRole)}
                                </span>
                            </div>
                            ${isMine ? selectionCheckHtml : ''}
                        </div>`;
                }).join('');

            // Bind Inspect Details button handlers
            if (viewerRole === 'admin' && window.activeChatUserId) {
                list.querySelectorAll('.admin-inspect-btn').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const msgId = e.currentTarget.dataset.msgId;
                        const textSpan = document.getElementById(`msg-text-content-${msgId}`);
                        const msgText = textSpan ? textSpan.textContent : '';
                        window.openAdminInspectDetailsModal(window.activeChatUserId, msgText);
                    };
                });
            }

            const toggleBubbleSelection = (msgId) => {
                if (selectedMessageIds.has(msgId)) {
                    selectedMessageIds.delete(msgId);
                } else {
                    selectedMessageIds.add(msgId);
                }
                renderSupportMessages(messages, viewerRole);
            };

            list.querySelectorAll('.msg-select-check').forEach(checkEl => {
                checkEl.onclick = (e) => {
                    e.stopPropagation();
                    const msgId = Number(checkEl.dataset.msgId);
                    toggleBubbleSelection(msgId);
                };
            });

            // Bind message bubble click and hold handlers
            list.querySelectorAll('.support-chat-bubble').forEach(bubble => {
                const msgId = Number(bubble.dataset.msgId);
                const isMsgMine = bubble.dataset.isMine === 'true';

                // Right click for Laptop/Desktop
                bubble.oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isMultiSelectMode) {
                        toggleBubbleSelection(msgId);
                        return;
                    }
                    window.showSupportMessageContextMenu(msgId, isMsgMine, viewerRole);
                };

                // Simple click
                bubble.onclick = (e) => {
                    e.stopPropagation();
                    if (isMultiSelectMode) {
                        toggleBubbleSelection(msgId);
                    }
                };

                // Long Press (1 second) for Mobile/Touch devices
                let pressTimer;
                let isMove = false;

                const startPress = () => {
                    if (isMultiSelectMode) return;
                    isMove = false;
                    pressTimer = setTimeout(() => {
                        if (!isMove) {
                            if (navigator.vibrate) navigator.vibrate(40);
                            window.showSupportMessageContextMenu(msgId, isMsgMine, viewerRole);
                        }
                    }, 900);
                };

                const endPress = () => {
                    clearTimeout(pressTimer);
                };

                bubble.addEventListener('touchstart', startPress, { passive: true });
                bubble.addEventListener('touchend', endPress, { passive: true });
                bubble.addEventListener('touchcancel', endPress, { passive: true });
                bubble.addEventListener('touchmove', () => {
                    isMove = true;
                    clearTimeout(pressTimer);
                }, { passive: true });
            });

            // Update bottom floating actions multi-select bar
            if (typeof window.updateMultiSelectBar === 'function') {
                window.updateMultiSelectBar(viewerRole);
            }

            if (wasNearBottom) {
                list.scrollTop = list.scrollHeight;
            }
        };
            const handleNewMessage = (message) => {
                if (message.roomId !== activeSupportRoomId) return;
                activeSupportMessages = mergeSupportMessages(activeSupportMessages, [message]);
                writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
                renderSupportMessages(activeSupportMessages, viewerRole);
                if (!isAdminView) markSupportChatSeen(activeSupportRoomId, activeSupportMessages);
                if (isAdminView) markAdminSupportChatSeen(activeSupportRoomId, activeSupportMessages);
                const myUid = (typeof getCurrentUserId === 'function' ? getCurrentUserId() : (currentUser?.uid || ''));
                const msgSenderId = typeof getResolvedSenderId === 'function' ? getResolvedSenderId(message) : (message.senderId || '');
                const isIncoming = msgSenderId && myUid && msgSenderId !== myUid;
                if (isIncoming && typeof showNativePushNotification === 'function') {
                    showNativePushNotification('💬 New Message', message.text || message.message || 'You received a new message', { roomId: activeSupportRoomId });
                }
            };

            const sendMessage = async () => {
                const input = document.getElementById('support-message-input');
                const sendBtn = document.getElementById('support-send-btn');
                if (!input) return;
                const text = input.value.trim();
                if (!text) return;
                const now = Date.now();
                const myUid = (typeof getCurrentUserId === 'function' ? getCurrentUserId() : (currentUser?.uid || ''));
                const sendSignature = `${activeSupportRoomId}|${myUid}|${text}`;
                if ((supportSendingMessage && supportLastSendSignature === sendSignature) || (supportLastSendSignature === sendSignature && now - supportLastSendAt < 1800)) {
                    return;
                }
                supportSendingMessage = true;
                supportLastSendSignature = sendSignature;
                supportLastSendAt = now;
                if (sendBtn) {
                    sendBtn.disabled = true;
                    sendBtn.classList.add('opacity-70');
                }
                const unlockSend = () => {
                    supportSendingMessage = false;
                    if (sendBtn) {
                        sendBtn.disabled = false;
                        sendBtn.classList.remove('opacity-70');
                    }
                };
                input.value = '';
                input.style.height = 'auto';

                // Optimistically show sent message on right side immediately
                const tempMsgObj = {
                    id: `temp-${Date.now()}`,
                    roomId: activeSupportRoomId,
                    text: text,
                    senderId: myUid,
                    senderRole: viewerRole,
                    createdAt: Date.now(),
                    readAt: null
                };
                activeSupportMessages = mergeSupportMessages(activeSupportMessages, [tempMsgObj]);
                writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
                renderSupportMessages(activeSupportMessages, viewerRole);
                
                const msgListContainer = document.getElementById('support-chat-messages');
                if (msgListContainer) {
                    msgListContainer.scrollTop = msgListContainer.scrollHeight;
                }

                // Trigger Web Push Notification for the recipient
                const targetPushUserId = viewerRole === 'admin' 
                    ? extractUserIdFromRoomId(activeSupportRoomId, chatUserId) 
                    : (chatMeta.adminId || currentUserData?.parentAdmin || currentUserData?.parent_admin || ADMIN_UID);

                if (targetPushUserId) {
                    getBackendAuthToken().then(token => {
                        fetch(`${BACKEND_BASE_URL}/api/chat/send-push`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                targetUserId: targetPushUserId,
                                title: viewerRole === 'admin' ? 'New Message from Admin' : `New Message from ${currentUserData?.name || 'User'}`,
                                message: text,
                                customData: {
                                    type: 'chat',
                                    userId: myUid,
                                    adminId: viewerRole === 'admin' ? (currentUser?.uid || '') : (chatMeta.adminId || ADMIN_UID),
                                    roomId: activeSupportRoomId
                                }
                            })
                        }).catch(err => console.warn('Push notification trigger error:', err));
                    }).catch(() => {});
                }

                const isChatWithOwner = chatUserId === ADMIN_UID;
                const userMeta = {
                    userId: isChatWithOwner ? myUid : chatUserId,
                    userName: isChatWithOwner 
                        ? (currentUserData?.name || currentUser?.email || 'Sub-Admin') 
                        : (chatMeta.userName || currentUserData?.name || currentUser?.email || 'User'),
                    userEmail: isChatWithOwner 
                        ? (currentUserData?.email || currentUser?.email || '') 
                        : (chatMeta.userEmail || currentUserData?.email || ''),
                    userMobile: isChatWithOwner 
                        ? (currentUserData?.mobile || '') 
                        : (chatMeta.userMobile || '')
                };
                if (!socket?.connected) {
                    try {
                        attachSupportRealtime(await getSupportSocket({ timeoutMs: 2500 }));
                    } catch (error) {
                        unlockSend();
                        input.value = text;
                        showNotification('Chat is still connecting. Please try again.', true);
                        return;
                    }
                }
                socket.emit('send_message', {
                    roomId: activeSupportRoomId,
                    message: text,
                    userMeta,
                    clientMessageId: `${activeSupportRoomId}-${myUid || 'user'}-${Date.now()}-${Math.random().toString(36).slice(2)}`
                }, (response) => {
                    unlockSend();
                    if (!response?.ok) {
                        console.error('Send support message failed:', response?.error);
                        showNotification('Message not sent. Please try again.', true);
                    }
                });
                setTimeout(unlockSend, 4000);
                const updatedChat = {
                    userId: chatUserId,
                    roomId: activeSupportRoomId,
                    userName: userMeta.userName,
                    userEmail: userMeta.userEmail,
                    userMobile: userMeta.userMobile,
                    lastMessage: text,
                    lastSenderId: myUid,
                    lastSenderRole: viewerRole,
                    updatedAt: Date.now()
                };
                const index = allSupportChatsCache.findIndex(chat => (chat.userId || chat.id) === chatUserId);
                if (index >= 0) {
                    allSupportChatsCache[index] = { ...allSupportChatsCache[index], ...updatedChat };
                } else {
                    allSupportChatsCache.unshift({ id: chatUserId, ...updatedChat });
                }
            };

const extractUserIdFromRoomId = (roomId = '', fallbackUserId = '') => {
    if (fallbackUserId && typeof fallbackUserId === 'string' && !fallbackUserId.includes('_') && fallbackUserId !== 'undefined') {
        return fallbackUserId;
    }
    if (!roomId) return fallbackUserId || '';
    const clean = String(roomId).replace(/^support_/, '');
    const parts = clean.split('_');
    return parts[0] || clean;
};

const getSupportRoomId = (chatUserId, adminId = ADMIN_UID) => {
    if (!adminId || adminId === ADMIN_UID) {
        return `support_${chatUserId}`;
    }
    return `support_${chatUserId}_${adminId}`;
};

const getSupportChatCacheKey = (roomId) => `rw_support_chat_${roomId}`;

const getSupportChatSeenKey = (roomId) => `rw_support_seen_${roomId}`;

const readSupportChatCache = (roomId) => {
            try {
                const cached = JSON.parse(localStorage.getItem(getSupportChatCacheKey(roomId)) || '[]');
                return Array.isArray(cached) ? cached : [];
            } catch {
                return [];
            }
        };

const writeSupportChatCache = (roomId, messages) => {
            try {
                localStorage.setItem(getSupportChatCacheKey(roomId), JSON.stringify(messages.slice(-200)));
            } catch (error) {
                console.warn('Support chat cache write failed:', error);
            }
        };

const getSupportMessageDedupeKey = (message) => {
            const normalized = normalizeBackendMessage(message);
            if (normalized.clientMessageId) return `client:${normalized.clientMessageId}`;
            const text = String(normalized.text || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const timestamp = timestampToMillis(normalized.createdAt) || Date.now();
            const closeTimeBucket = Math.floor(timestamp / 120000);
            return `${normalized.roomId || activeSupportRoomId}|${normalized.senderId}|${closeTimeBucket}|${text}`;
        };

const mergeSupportMessages = (...groups) => {
            const merged = new Map();
            groups.flat().forEach((message) => {
                if (!message) return;
                const normalized = normalizeBackendMessage(message);
                if (!String(normalized.text || '').trim()) return;
                const key = getSupportMessageDedupeKey(normalized);
                const existing = merged.get(key);
                if (!existing) {
                    merged.set(key, normalized);
                    return;
                }
                const existingTime = timestampToMillis(existing.createdAt);
                const normalizedTime = timestampToMillis(normalized.createdAt);
                merged.set(key, {
                    ...existing,
                    ...normalized,
                    id: existing.id || normalized.id,
                    clientMessageId: existing.clientMessageId || normalized.clientMessageId,
                    createdAt: existingTime && normalizedTime ? Math.min(existingTime, normalizedTime) : (existing.createdAt || normalized.createdAt),
                    readAt: existing.readAt || normalized.readAt
                });
            });
            return Array.from(merged.values()).sort((a, b) => timestampToMillis(a.createdAt) - timestampToMillis(b.createdAt));
        };

const applySupportReadReceipt = (roomId, readerRole, readAt = Date.now()) => {
            const receiptTime = timestampToMillis(readAt) || Date.now();
            const updateMessages = (messages = []) => mergeSupportMessages(messages.map(message => {
                const normalized = normalizeBackendMessage(message);
                if (normalized.roomId !== roomId) return normalized;
                if (normalized.senderRole === readerRole) return normalized;
                if (timestampToMillis(normalized.createdAt) > receiptTime) return normalized;
                return { ...normalized, readAt: normalized.readAt || receiptTime };
            }));
            const cached = updateMessages(readSupportChatCache(roomId));
            writeSupportChatCache(roomId, cached);
            if (activeSupportRoomId === roomId && document.getElementById('support-chat-messages')) {
                activeSupportMessages = updateMessages(activeSupportMessages);
            }
        };

const fetchSupportChatHistory = async (roomId, limit = 80) => {
            const token = await getBackendAuthToken();
            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/chats/${encodeURIComponent(roomId)}?limit=${limit}`, {
                headers: { Authorization: `Bearer ${token}` }
            }, 6000);
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.ok) throw new Error(data.error || 'Chat history load failed');
            return data.history || [];
        };

const calculateSupportUnreadCount = (roomId, messages = readSupportChatCache(roomId)) => {
            const localSeen = Number(localStorage.getItem(getSupportChatSeenKey(roomId)) || 0);
            const firestoreSeen = Number(currentUserData?.[`lastChatSeen_${roomId}`] || currentUserData?.lastChatSeenTimestamp || 0);
            const lastSeen = Math.max(localSeen, firestoreSeen);
            return messages
                .map(normalizeBackendMessage)
                .filter(message => message.senderRole === 'admin' && timestampToMillis(message.createdAt) > lastSeen)
                .length;
        };

const updateSupportChatUnreadBadges = () => {
            const countText = supportChatUnreadCount > 99 ? '99+' : String(supportChatUnreadCount || '');
            ['bottom-help-unread-badge', 'support-chat-unread-badge'].forEach(id => {
                const badge = document.getElementById(id);
                if (!badge) return;
                badge.textContent = countText;
                badge.classList.toggle('hidden', supportChatUnreadCount <= 0);
            });
        };

const markSupportChatSeen = (roomId, messages = readSupportChatCache(roomId)) => {
            const latestAdminTime = getLatestAdminMessageTime(messages);
            if (latestAdminTime) {
                localStorage.setItem(getSupportChatSeenKey(roomId), String(latestAdminTime));
                if (currentUser?.uid && typeof db !== 'undefined') {
                    try {
                        const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                        updateDoc(userRef, {
                            [`lastChatSeen_${roomId}`]: latestAdminTime,
                            lastChatSeenTimestamp: latestAdminTime
                        }).catch(() => {});
                        if (currentUserData) {
                            currentUserData[`lastChatSeen_${roomId}`] = latestAdminTime;
                            currentUserData.lastChatSeenTimestamp = latestAdminTime;
                        }
                    } catch (e) {}
                }
            }
            refreshSupportUnreadFromCache();
        };

const refreshSupportUnreadFromCache = () => {
            if (!currentUser || currentUser.uid === ADMIN_UID) return;
            const parentAdminId = currentUserData?.parentAdmin || currentUserData?.parent_admin || '';
            const mainRoomId = getSupportRoomId(currentUser.uid, ADMIN_UID);
            let count = calculateSupportUnreadCount(mainRoomId);
            
            if (parentAdminId && parentAdminId !== ADMIN_UID) {
                const subRoomId = getSupportRoomId(currentUser.uid, parentAdminId);
                count += calculateSupportUnreadCount(subRoomId);
            }
            
            supportChatUnreadCount = count;
            updateSupportChatUnreadBadges();
        };

const preloadSupportChatForUser = async (userId = currentUser?.uid) => {
            if (!userId || userId === ADMIN_UID) return;
            const parentAdminId = currentUserData?.parentAdmin || currentUserData?.parent_admin || '';
            const hasSubAdmin = parentAdminId && parentAdminId !== ADMIN_UID;
            
            const mainRoomId = getSupportRoomId(userId, ADMIN_UID);
            const subRoomId = hasSubAdmin ? getSupportRoomId(userId, parentAdminId) : null;
            
            if (supportChatPreloadUserId === userId) return;
            supportChatPreloadUserId = userId;
            
            refreshSupportUnreadFromCache();

            const preloadSingleRoom = async (roomId) => {
                const cached = readSupportChatCache(roomId);
                try {
                    const history = await fetchSupportChatHistory(roomId, 200);
                    const merged = mergeSupportMessages(cached, history);
                    writeSupportChatCache(roomId, merged);
                    refreshSupportUnreadFromCache();
                } catch (error) {
                    console.warn('Support chat preload failed for room:', roomId, error);
                }
            };

            preloadSingleRoom(mainRoomId);
            if (subRoomId) {
                preloadSingleRoom(subRoomId);
            }
        };

const openSupportChatPage = async (chatUserId, viewerRole = 'user', chatMeta = {}) => {
            window.activeChatUserId = chatUserId;
            isMultiSelectMode = false;
            selectedMessageIds.clear();
            if (activeChatUnsubscribe) {
                activeChatUnsubscribe();
                activeChatUnsubscribe = null;
            }
            const isAdminView = viewerRole === 'admin';
            const isChatWithOwner = chatUserId === ADMIN_UID;
            const displayName = isChatWithOwner
                ? 'REVIEWS WORLD'
                : (isAdminView 
                    ? (chatMeta.userName || 'User') 
                    : (chatMeta.adminName || 'REVIEWS WORLD'));
            const displayEmail = isChatWithOwner
                ? (chatMeta.adminEmail || getSupportAdminEmail())
                : (isAdminView
                    ? (chatMeta.userEmail || '')
                    : (chatMeta.adminEmail || getSupportAdminEmail()));
            let logo = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
            if (isChatWithOwner) {
                logo = chatMeta.adminLogo || getSupportLogo();
            } else if (isAdminView) {
                const userProfile = (typeof allUsersCache !== 'undefined' && Array.isArray(allUsersCache)) 
                    ? allUsersCache.find(u => String(u.id || u.uid) === String(chatUserId)) 
                    : {};
                logo = userProfile.profilePhoto || userProfile.profile_photo || userProfile.avatarUrl || userProfile.avatar_url || chatMeta.userAvatar || logo;
            } else {
                logo = chatMeta.adminLogo || getSupportLogo();
            }
            const initialMessage = chatMeta.initialMessage || '';
            const returnToBlocked = !!chatMeta.returnToBlocked;
            const content = `
                <div id="support-chat-shell" class="max-w-xl mx-auto bg-gray-100 dark:bg-gray-900 h-[100dvh] flex flex-col">
                    <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col h-full min-h-0">
                        <div class="relative flex items-center gap-3 px-3 pb-3 pt-[calc(1.85rem+env(safe-area-inset-top))] border-b border-gray-100 dark:border-gray-700">
                            <button class="page-back-btn h-10 w-10 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                            </button>
                            ${isAdminView ? `<img src="${logo}" alt="${escapeHtml(displayName)}" class="h-10 w-10 rounded-full object-cover">` : getSupportLogoFrame('h-10 w-10 shrink-0')}
                            <button id="support-profile-btn" class="min-w-0 flex-1 text-left">
                                <h3 class="font-bold truncate inline-flex items-center gap-1">${escapeHtml(displayName)} ${!isAdminView ? getVerifiedBadge() : ''}</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(displayEmail)}</p>
                            </button>
                            <button id="chat-disappear-info-btn" class="h-9 w-9 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600" title="Disappearing chat">15d</button>
                            <div id="chat-disappear-info-popup" class="hidden absolute right-3 top-14 z-20 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs leading-5 text-gray-600 dark:text-gray-300 shadow-xl">
                                All chat will automatically delete after 15 days after read by admin.
                            </div>
                        </div>
                        <div id="support-chat-messages" class="flex-1 min-h-0 space-y-3 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900"></div>
                        <div id="emoji-panel" class="hidden flex flex-wrap gap-2 p-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                            ${['😀','😁','🙏','👍','❤️','🔥','🎉','😊','🤗','✅','💰','📞'].map(emoji => `<button class="emoji-choice text-xl">${emoji}</button>`).join('')}
                        </div>
                        <div id="support-chat-composer" class="shrink-0 flex items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 transition-transform duration-150">
                            <button id="emoji-toggle-btn" class="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 text-xl">☺</button>
                            <textarea id="support-message-input" placeholder="Type a message" rows="1" class="flex-1 min-w-0 px-4 py-2 text-[16px] bg-gray-100 dark:bg-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto max-h-24"></textarea>
                            <button id="support-send-btn" class="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`;
            const goBackFromSupportChat = () => {
                isMultiSelectMode = false;
                selectedMessageIds.clear();
                if (activeChatUnsubscribe) {
                    activeChatUnsubscribe();
                    activeChatUnsubscribe = null;
                }
                if (isAdminView) {
                    showAdminChatsPage();
                } else if (returnToBlocked) {
                    showBlockedAccountPage(chatMeta.blockedData || currentUserData || {});
                } else {
                    showHelpSupportPage();
                }
            };
            showPage(content, { fullHeight: true, onBack: goBackFromSupportChat });
            if (!returnToBlocked) setBottomNavActive(isAdminView ? 'bottom-settings-btn' : 'bottom-help-btn');
            const chatBackBtn = document.querySelector('#page-container .page-back-btn');
            if (chatBackBtn) {
                chatBackBtn.onclick = goBackFromSupportChat;
            }

            document.getElementById('support-profile-btn').onclick = () => {
                if (isAdminView) {
                    renderModal('User Details',
                        `<div class="space-y-3">
                            <p><strong>Name:</strong> ${escapeHtml(chatMeta.userName || 'User')}</p>
                            <p><strong>Email:</strong> ${escapeHtml(chatMeta.userEmail || '')}</p>
                            <p><strong>Mobile:</strong> ${escapeHtml(chatMeta.userMobile || '')}</p>
                        </div>`,
                        `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Close</button>`);
                } else {
                    showSupportProfileModal();
                }
            };
            document.getElementById('chat-disappear-info-btn').onclick = (event) => {
                event.stopPropagation();
                document.getElementById('chat-disappear-info-popup').classList.toggle('hidden');
            };
            document.addEventListener('click', function closeDisappearPopup(event) {
                const popup = document.getElementById('chat-disappear-info-popup');
                const button = document.getElementById('chat-disappear-info-btn');
                if (!popup || !button) {
                    document.removeEventListener('click', closeDisappearPopup);
                    return;
                }
                if (!popup.contains(event.target) && !button.contains(event.target)) {
                    popup.classList.add('hidden');
                }
            });

            const keyboardCleanup = installChatViewportLock({
                shellId: 'support-chat-shell',
                composerId: 'support-chat-composer',
                inputId: 'support-message-input',
                messagesId: 'support-chat-messages'
            });

            activeSupportRoomId = chatMeta.roomId || getSupportRoomId(chatUserId, chatMeta.adminId);
            activeSupportMessages = mergeSupportMessages(readSupportChatCache(activeSupportRoomId));
            writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
            renderSupportMessages(activeSupportMessages, viewerRole);
            if (!isAdminView) markSupportChatSeen(activeSupportRoomId, activeSupportMessages);
            if (isAdminView) markAdminSupportChatSeen(activeSupportRoomId, activeSupportMessages);
            fetchSupportChatHistory(activeSupportRoomId, 200)
                .then((history) => {
                    if (!history.length && activeSupportMessages.length) return;
                    activeSupportMessages = mergeSupportMessages(activeSupportMessages, history);
                    writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
                    renderSupportMessages(activeSupportMessages, viewerRole);
                    if (!isAdminView) markSupportChatSeen(activeSupportRoomId, activeSupportMessages);
                    if (isAdminView) markAdminSupportChatSeen(activeSupportRoomId, activeSupportMessages);
                })
                .catch((error) => console.warn('Fast chat history fetch failed:', error));
            const handleHistory = ({ roomId, history = [] }) => {
                if (roomId !== activeSupportRoomId) return;
                if (!history.length && activeSupportMessages.length) return;
                activeSupportMessages = mergeSupportMessages(activeSupportMessages, history);
                writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
                renderSupportMessages(activeSupportMessages, viewerRole);
                if (!isAdminView) markSupportChatSeen(activeSupportRoomId, activeSupportMessages);
                if (isAdminView) markAdminSupportChatSeen(activeSupportRoomId, activeSupportMessages);
            };
            const handleNewMessage = (message) => {
                const normalized = normalizeBackendMessage(message);
                if (normalized.roomId !== activeSupportRoomId) return;
                activeSupportMessages = mergeSupportMessages(activeSupportMessages, [normalized]);
                writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
                renderSupportMessages(activeSupportMessages, viewerRole);
                if (!isAdminView) markSupportChatSeen(activeSupportRoomId, activeSupportMessages);
                if (isAdminView) markAdminSupportChatSeen(activeSupportRoomId, activeSupportMessages);
                const msgListEl = document.getElementById('support-chat-messages');
                if (msgListEl) msgListEl.scrollTop = msgListEl.scrollHeight;
            };
            const handleReadReceipt = ({ roomId, readerRole, readAt }) => {
                if (roomId !== activeSupportRoomId) return;
                applySupportReadReceipt(activeSupportRoomId, readerRole, readAt);
                renderSupportMessages(activeSupportMessages, viewerRole);
            };
            const handleMessageDeleted = ({ roomId, messageId }) => {
                if (roomId !== activeSupportRoomId) return;
                activeSupportMessages = activeSupportMessages.filter(msg => msg.id !== messageId);
                writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
                renderSupportMessages(activeSupportMessages, viewerRole);
            };
            let socket = null;
            let realtimeAttached = false;
            const roomIdAtOpen = activeSupportRoomId;
            const attachSupportRealtime = (nextSocket) => {
                if (!nextSocket || activeSupportRoomId !== roomIdAtOpen || !document.getElementById('support-chat-messages')) return;
                window.activeSupportSocket = nextSocket;
                if (socket && socket !== nextSocket && realtimeAttached) {
                    socket.off('chat_history', handleHistory);
                    socket.off('new_message', handleNewMessage);
                    socket.off('chat_read', handleReadReceipt);
                    socket.off('message_deleted', handleMessageDeleted);
                }
                socket = nextSocket;
                if (!realtimeAttached) {
                    socket.on('chat_history', handleHistory);
                    socket.on('new_message', handleNewMessage);
                    socket.on('chat_read', handleReadReceipt);
                    socket.on('message_deleted', handleMessageDeleted);
                    realtimeAttached = true;
                }
                socket.emit('join_room', { roomId: roomIdAtOpen, limit: 200, markRead: true }, (response) => {
                    if (!response?.ok) {
                        console.warn('Join support room failed:', response?.error);
                    }
                });
            };
            const startSupportRealtime = (timeoutMs = 1800) => {
                getSupportSocket({ timeoutMs })
                    .then(attachSupportRealtime)
                    .catch((error) => console.warn('Support chat realtime is not ready:', error?.message || error));
            };
            startSupportRealtime();
            activeChatUnsubscribe = () => {
                if (keyboardCleanup) keyboardCleanup();
                if (socket && realtimeAttached) {
                    socket.off('chat_history', handleHistory);
                    socket.off('new_message', handleNewMessage);
                    socket.off('chat_read', handleReadReceipt);
                    socket.off('message_deleted', handleMessageDeleted);
                    socket.emit('leave_room', { roomId: roomIdAtOpen });
                }
                realtimeAttached = false;
                window.activeSupportSocket = null;
            };

            const sendMessage = async () => {
                const input = document.getElementById('support-message-input');
                const sendBtn = document.getElementById('support-send-btn');
                if (!input) return;
                const text = input.value.trim();
                if (!text) return;
                const now = Date.now();
                const sendSignature = `${activeSupportRoomId}|${currentUser?.uid || ''}|${text}`;
                if ((supportSendingMessage && supportLastSendSignature === sendSignature) || (supportLastSendSignature === sendSignature && now - supportLastSendAt < 1800)) {
                    return;
                }
                supportSendingMessage = true;
                supportLastSendSignature = sendSignature;
                supportLastSendAt = now;
                if (sendBtn) {
                    sendBtn.disabled = true;
                    sendBtn.classList.add('opacity-70');
                }
                const unlockSend = () => {
                    supportSendingMessage = false;
                    if (sendBtn) {
                        sendBtn.disabled = false;
                        sendBtn.classList.remove('opacity-70');
                    }
                };
                input.value = '';
                input.style.height = 'auto';
                const userMeta = {
                    userId: chatUserId,
                    userName: chatMeta.userName || currentUserData?.name || currentUser?.email || 'User',
                    userEmail: chatMeta.userEmail || currentUserData?.email || currentUser?.email || '',
                    userMobile: chatMeta.userMobile || currentUserData?.mobile || ''
                };
                if (!socket?.connected) {
                    try {
                        attachSupportRealtime(await getSupportSocket({ timeoutMs: 2500 }));
                    } catch (error) {
                        unlockSend();
                        input.value = text;
                        showNotification('Chat is still connecting. Please try again.', true);
                        return;
                    }
                }
                socket.emit('send_message', {
                    roomId: activeSupportRoomId,
                    message: text,
                    userMeta,
                    clientMessageId: `${activeSupportRoomId}-${currentUser?.uid || 'user'}-${Date.now()}-${Math.random().toString(36).slice(2)}`
                }, (response) => {
                    unlockSend();
                    if (!response?.ok) {
                        console.error('Send support message failed:', response?.error);
                        showNotification('Message not sent. Please try again.', true);
                    }
                });
                setTimeout(unlockSend, 4000);
                const updatedChat = {
                    userId: chatUserId,
                    roomId: activeSupportRoomId,
                    userName: userMeta.userName,
                    userEmail: userMeta.userEmail,
                    userMobile: userMeta.userMobile,
                    lastMessage: text,
                    lastSenderId: currentUser?.uid || '',
                    lastSenderRole: viewerRole,
                    updatedAt: Date.now()
                };
                const index = allSupportChatsCache.findIndex(chat => (chat.userId || chat.id) === chatUserId);
                if (index >= 0) {
                    allSupportChatsCache[index] = { ...allSupportChatsCache[index], ...updatedChat };
                } else {
                    allSupportChatsCache.unshift({ id: chatUserId, ...updatedChat });
                }
            };

            const supportSendButton = document.getElementById('support-send-btn');
            const supportMessageInput = document.getElementById('support-message-input');
            const emojiToggleButton = document.getElementById('emoji-toggle-btn');
            const emojiPanel = document.getElementById('emoji-panel');
            if (!supportSendButton || !supportMessageInput || !emojiToggleButton) return;
            supportSendButton.onclick = sendMessage;

            const adjustSupportTextareaHeight = () => {
                supportMessageInput.style.height = 'auto';
                supportMessageInput.style.height = Math.min(supportMessageInput.scrollHeight, 120) + 'px';
            };
            supportMessageInput.addEventListener('input', adjustSupportTextareaHeight);

            supportMessageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
            emojiToggleButton.onclick = () => {
                emojiPanel?.classList.toggle('hidden');
                supportMessageInput.focus();
            };
            document.querySelectorAll('.emoji-choice').forEach(btn => {
                btn.onclick = () => {
                    supportMessageInput.value += btn.textContent;
                    supportMessageInput.focus();
                    adjustSupportTextareaHeight();
                };
            });
            if (initialMessage) {
                supportMessageInput.value = initialMessage;
                sendMessage();
            }
        };

const resetRevyBotTimer = () => {
            if (revyBotTimer) clearTimeout(revyBotTimer);
            revyBotTimer = setTimeout(() => closeRevyBotSession(), 10 * 60 * 1000);
        };

const closeRevyBotSession = () => {
            if (revyBotTimer) clearTimeout(revyBotTimer);
            revyBotTimer = null;
            revyBotMessages = [];
            revyBotLastQuestion = '';
            if (window.revyBotAdminView) {
                showAdminMainPage();
            } else {
                hidePage();
                currentMainSection = 'home';
                switchTab('user-panel');
                setBottomNavActive('bottom-home-btn');
            }
        };

const getRevyBotReply = async (question) => {
            try {
                const token = await getBackendAuthToken();
                const history = (revyBotMessages || [])
                    .slice(0, -1)
                    .map(msg => ({
                        role: msg.senderRole === 'user' ? 'user' : 'assistant',
                        content: msg.text
                    }))
                    .slice(-6);

                const pendingWithdrawal = await getPendingWithdrawalForBot();
                const latestTransactions = await getLatestTransactionsForBot(5);
                const activeLoan = allLoansCache.find(loan => loan.userId === currentUser?.uid && loan.status === 'active' && isModernLoanRecord(loan));
                const activeInvestment = allInvestmentsCache.find(item => item.userId === currentUser?.uid && item.status === 'active');

                const userContext = {
                    userName: currentUserData?.name || 'User',
                    userEmail: currentUserData?.email || '',
                    userMobile: currentUserData?.mobile || '',
                    balance: currentUserData?.balance || 0,
                    pendingWithdrawal: pendingWithdrawal ? {
                        amount: pendingWithdrawal.amount || 0,
                        method: getWithdrawalDisplayMethodName(pendingWithdrawal, 'saved payout method'),
                        status: pendingWithdrawal.status || 'pending',
                        requestedAt: formatDateDDMMYY(pendingWithdrawal.timestamp || pendingWithdrawal.requestedAt || pendingWithdrawal.processedAt)
                    } : null,
                    latestTransactions: latestTransactions.map(item => getBotTransactionSummary(item)),
                    activeLoan: activeLoan ? {
                        amount: activeLoan.amount || activeLoan.principal || 0,
                        status: activeLoan.status || 'active'
                    } : null,
                    activeInvestment: activeInvestment ? {
                        amount: activeInvestment.amount || 0,
                        status: activeInvestment.status || 'active'
                    } : null
                };

                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/revy-bot`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ question, history, userContext })
                }, 25000);
                
                const data = await response.json();
                if (response.ok && data.ok && data.answer) {
                    const ans = data.answer.trim();
                    if (ans.includes('Sorry, I can help only with RW Wallet') || ans.includes('transfer your problem to ADMIN')) {
                        return {
                            unsupported: true,
                            text: 'Sorry, I can help only with RW Wallet, REVIEWS WORLD, earning, account, wallet, transaction, withdrawal, add fund, pay to wallet, recharge, gift code, loan, partner investment, profile, and app usage questions. Would you like me to transfer your problem to ADMIN?'
                        };
                    }
                    return ans;
                }
            } catch (err) {
                console.warn('Backend Revy Bot request failed, falling back to local rules:', err);
            }

            const text = String(question || '').toLowerCase();
            const compactText = text.replace(/[^a-z0-9]+/g, ' ').trim();
            const hasAny = (...words) => words.some(word => compactText.includes(String(word).toLowerCase()));
            const activeLoan = allLoansCache.find(loan => loan.userId === currentUser?.uid && loan.status === 'active' && isModernLoanRecord(loan));
            const activeInvestment = allInvestmentsCache.find(item => item.userId === currentUser?.uid && item.status === 'active');

            if (hasAny('earn', 'earning', 'income', 'make money', 'track income', 'work', 'task', 'review work', 'reviews work', 'map review', 'download work', 'like comment')) {
                return 'Main earning work in REVIEWS WORLD is app reviews work, map review work, app download work, and like/comment work. Work updates are shared on the WhatsApp channel by admin. Complete the given task properly, then admin verifies it and wallet income/payment records can be tracked in the app. You can also check Track Income, Gift Codes if admin gives codes, and Become Partner if investment options are available.';
            }

            if (hasAny('add money', 'add fund', 'add funds', 'deposit', 'recharge wallet', 'top up', 'load wallet', 'add balance')) {
                return 'To add wallet funds, open Add Fund from the dashboard, enter amount and payment details, then submit. After admin verifies your payment, balance is credited. If delayed, send payment proof in REVIEWS WORLD support chat.';
            }

            if (hasAny('send money', 'pay to wallet', 'transfer money', 'wallet transfer', 'pay user', 'send fund')) {
                return 'Use Pay to Wallet to send money to another RW Wallet user. Enter recipient mobile number, amount, and note/details. The app finds the user, asks confirmation, transfers wallet balance, and saves the record in both users transaction history.';
            }

            if (hasAny('withdraw', 'withdrawal', 'payout', 'payment pending', 'pending')) {
                const pendingWithdrawal = await getPendingWithdrawalForBot();
                if (pendingWithdrawal) {
                    return `Your withdrawal request of ${formatCurrency(pendingWithdrawal.amount || 0)} is pending. Method: ${getWithdrawalDisplayMethodName(pendingWithdrawal, 'saved payout method')}. It is not rejected. Admin will process it soon if details are correct.`;
                }
                return 'I do not see a pending withdrawal request right now. To withdraw, first add your payout details in Settings > My Profile, then open Withdraw Fund, choose UPI/Bank/Gift Card/PayPal, enter the amount, and submit. The amount is deducted immediately and stays pending until admin approves or rejects it.';
            }
            if (hasAny('balance', 'wallet', 'fund')) {
                return `Your current wallet balance is ${formatCurrency(currentUserData?.balance || 0)}. If a withdrawal is submitted, the amount is deducted immediately and shown as pending until admin approves or rejects it.`;
            }
            if (hasAny('transaction', 'history', 'invoice', 'receipt', 'last transaction', 'latest transaction', 'recent transaction', 'last 5', 'latest 5')) {
                const latestTransactions = await getLatestTransactionsForBot(5);
                const latestHistory = latestTransactions[0];
                if (latestHistory) {
                    if (hasAny('last 5', 'latest 5', 'recent transaction', 'recent transactions', 'latest transactions', 'transaction history')) {
                        const summary = latestTransactions.map((item, index) =>
                            `${index + 1}. ${getBotTransactionSummary(item)}`
                        ).join('\n');
                        return `Your latest ${latestTransactions.length} wallet records:\n${summary}\nOpen Transaction History to view full details, IDs, and receipts.`;
                    }
                    return `Your latest wallet activity is ${getBotTransactionSummary(latestHistory)}. Open Transaction History to view full details and receipts.`;
                }
                return 'You can check all wallet activity from Transaction History. It shows deposits, withdrawals, transfers, recharge, gift code, and other wallet records.';
            }
            if (hasAny('payment method', 'upi', 'bank', 'ifsc', 'paypal', 'gift card', 'voucher', 'profile')) {
                return 'To update payout details, open Settings, then My Profile. You can add UPI, bank account with IFSC, PayPal or gift-card email details. Withdrawals use the details saved in your profile at request time.';
            }
            if (hasAny('setting', 'settings', 'change name', 'mobile number', 'whatsapp', 'website link', 'account details')) {
                return 'Open Settings to manage your profile, payout method, WhatsApp number, website links, invoices, theme, and support options. Keep your mobile number and payment details correct before requesting withdrawal.';
            }
            if (hasAny('password', 'login', 'reset', 'email')) {
                return 'For password help, use Forgot Password on the login page. A reset link will be sent to your email, and you should also check the spam folder.';
            }
            if (hasAny('recharge', 'mobile recharge')) {
                return 'For mobile recharge, open Mobile Recharge, enter number, choose operator and circle/state, select or type plan details, then submit. Wallet amount is deducted and the request stays pending until admin completes or rejects it.';
            }
            if (hasAny('loan', 'borrow')) {
                if (activeLoan) {
                    return `You have an active loan record of ${formatCurrency(activeLoan.amount || activeLoan.principal || 0)}. Please check the Loan section for repayment status and due details.`;
                }
                return 'Loan options depend on your account eligibility. If your account is eligible, open the Loan section and submit the request from there.';
            }
            if (hasAny('partner', 'investment', 'invest', 'interest', 'monthly income')) {
                if (activeInvestment) {
                    return `Your partner investment of ${formatCurrency(activeInvestment.amount || 0)} is active. Monthly interest is processed after completed periods according to the app rules. Open Become Partner or Track Income for details.`;
                }
                return 'Become Partner lets eligible users create a partner investment. The app calculates monthly interest using the platform rule, shows expected income, and admin manages active investment records. Open Become Partner from the dashboard to check the options.';
            }
            if (hasAny('gift', 'code', 'redeem')) {
                return 'Gift codes can be redeemed from the Gift Code section when you have a valid code. Gift card withdrawals use the email saved in your profile payout details.';
            }
            if (hasAny('admin', 'support', 'contact', 'help from admin', 'human', 'whatsapp')) {
                return 'For direct help, open REVIEWS WORLD chat from Help. Work updates are shared on the WhatsApp channel, and you can check the REVIEWS WORLD profile in chat for WhatsApp number and website links added by admin.';
            }
            if (hasAny('delete chat', 'chat delete', 'disappear', '15 days', 'privacy')) {
                return 'Support chat messages are kept until admin reads them. After admin reads a chat, those read messages automatically become eligible for deletion after 15 days to save storage.';
            }
            if (hasAny('company', 'reviews world', 'rw wallet', 'app', 'developer', 'yash', 'about', 'platform')) {
                return 'RW Wallet is the digital wallet platform of REVIEWS WORLD, developed by YASH VISHAL. It supports wallet balance, add fund, pay to wallet, withdrawals, transaction history, mobile recharge, gift codes, partner investment, loan tools, withdrawal invoices, payout profile details, support chat, and REVY instant help. REVIEWS WORLD work includes app review, map review, app download, and like/comment tasks shared by admin.';
            }
            if (hasAny('hello', 'hi', 'hey', 'help', 'start')) {
                return 'Hi, I am REVY, RW AI BOT. I can help with earning, add fund, pay to wallet, wallet balance, pending withdrawals, transaction history, payout details, password reset, recharge, gift codes, loans, partner investment, invoices, and how to use the app.';
            }

            if (hasAny('how to', 'where is', 'where to', 'can i', 'why', 'what is')) {
                return 'I can help with RW Wallet features like earning, Add Fund, Withdraw Fund, Pay to Wallet, Mobile Recharge, Gift Codes, Loan, Become Partner, Track Income, Transaction History, Invoices, Profile, password reset, and admin support. Please ask using one of these app sections, for example “how to earn” or “where is transaction history”.';
            }

            return {
                unsupported: true,
                text: 'Sorry, I can help only with RW Wallet, REVIEWS WORLD, earning, account, wallet, transaction, withdrawal, add fund, pay to wallet, recharge, gift code, loan, partner investment, profile, and app usage questions. Would you like me to transfer your problem to ADMIN?'
            };
        };

const renderRevyBotMessages = () => {
            const list = document.getElementById('revy-bot-messages');
            if (!list) return;
            let html = revyBotMessages.map((message, index) => {
                const isMine = message.senderRole === 'user';
                const showActions = message.actions === 'escalate' && index === revyBotMessages.length - 1;
                return `
                    <div class="flex ${isMine ? 'justify-end' : 'justify-start'}">
                        <div class="w-fit max-w-[84%] rounded-2xl px-3 py-2 shadow-sm ${isMine ? 'chat-bubble-user bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800' : 'chat-bubble-admin bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'}">
                            <p class="text-sm leading-5 break-words whitespace-pre-line">${escapeHtml(message.text)}</p>
                            <p class="text-[10px] mt-1 text-gray-400">${formatChatTime(message.createdAt)}</p>
                            ${showActions ? `
                                <div class="mt-3 flex flex-wrap gap-2">
                                    <button id="revy-transfer-yes" class="px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold">Yes, I need help</button>
                                    <button id="revy-transfer-no" class="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold">No</button>
                                    <button id="revy-edit-question" class="px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-200 text-xs font-bold">Edit</button>
                                    <button id="revy-exit-chat" class="px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-200 text-xs font-bold">Exit</button>
                                </div>` : ''}
                        </div>
                    </div>`;
            }).join('');

            if (revyBotTyping) {
                html += `
                    <div class="flex justify-start">
                        <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-2 rounded-2xl shadow-sm inline-flex items-center max-w-[60px]">
                            <div class="flex items-center gap-1 py-0.5 justify-center w-full">
                                <span class="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-bounce" style="animation-delay: 0ms"></span>
                                <span class="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400/80 animate-bounce" style="animation-delay: 150ms"></span>
                                <span class="h-1.5 w-1.5 rounded-full bg-blue-400 dark:bg-blue-400/60 animate-bounce" style="animation-delay: 300ms"></span>
                            </div>
                        </div>
                    </div>`;
            }

            list.innerHTML = html;
            list.scrollTop = list.scrollHeight;
            document.getElementById('revy-transfer-yes')?.addEventListener('click', () => {
                const question = revyBotLastQuestion || 'I need admin help.';
                revyBotMessages = [];
                if (revyBotTimer) clearTimeout(revyBotTimer);
                openSupportChatPage(currentUser.uid, 'user', {
                    initialMessage: `REVY - RW AI BOT could not answer this issue. User question: ${question}`
                });
            });
            document.getElementById('revy-transfer-no')?.addEventListener('click', () => {
                addRevyBotMessage('No problem. Please ask any other RW Wallet question, I will try to help instantly.');
            });
            document.getElementById('revy-edit-question')?.addEventListener('click', () => {
                const input = document.getElementById('revy-message-input');
                if (input) {
                    input.value = revyBotLastQuestion;
                    input.focus();
                }
            });
            document.getElementById('revy-exit-chat')?.addEventListener('click', closeRevyBotSession);
        };

const addRevyBotMessage = (text, senderRole = 'bot', actions = '') => {
            revyBotMessages.push({
                id: `revy-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                text,
                senderRole,
                actions,
                createdAt: Date.now()
            });
            renderRevyBotMessages();
            resetRevyBotTimer();
        };

const openRevyBotChatPage = (isAdminView = false) => {
            window.revyBotAdminView = isAdminView;
            if (activeChatUnsubscribe) {
                activeChatUnsubscribe();
                activeChatUnsubscribe = null;
            }
            revyBotMessages = [];
            const content = `
                <div id="revy-chat-shell" class="max-w-xl mx-auto bg-gray-100 dark:bg-gray-900 h-[100dvh] flex flex-col">
                    <div class="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col h-full min-h-0">
                        <div class="flex items-center gap-3 px-3 pb-3 pt-[calc(1.85rem+env(safe-area-inset-top))] border-b border-gray-100 dark:border-gray-700">
                            <button id="revy-back-btn" class="h-10 w-10 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                            </button>
                            ${getRevyBotLogo('h-10 w-10')}
                            <div class="min-w-0 flex-1">
                                <h3 class="font-bold truncate inline-flex items-center gap-1">REVY - RW AI BOT ${getVerifiedBadge()}</h3>
                                <p class="text-xs text-emerald-600 dark:text-emerald-300 truncate">Instant help solution</p>
                            </div>
                            <button id="revy-close-btn" class="px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-200 text-xs font-bold">Exit</button>
                        </div>
                        <div id="revy-bot-messages" class="flex-1 min-h-0 space-y-3 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900"></div>
                        <div id="revy-quick-options" class="shrink-0 flex gap-2 overflow-x-auto px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                            ${[
                                ['how to earn', 'Earn'],
                                ['how to withdraw', 'Withdraw'],
                                ['pending withdrawal', 'Pending'],
                                ['pay to wallet', 'Pay'],
                                ['transaction history', 'History'],
                                ['payment method', 'Profile'],
                                ['become partner investment', 'Partner'],
                                ['loan help', 'Loan']
                            ].map(([question, label]) => `<button data-revy-question="${question}" class="revy-option shrink-0 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 text-xs font-bold">${label}</button>`).join('')}
                        </div>
                        <div id="revy-chat-composer" class="shrink-0 flex items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                            <textarea id="revy-message-input" placeholder="Or type your question" rows="1" class="flex-1 min-w-0 px-4 py-2 text-[16px] bg-gray-100 dark:bg-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto max-h-24"></textarea>
                            <button id="revy-send-btn" class="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { fullHeight: true });
            setBottomNavActive(window.revyBotAdminView ? 'bottom-admin-btn' : 'bottom-help-btn');
            const revyKeyboardCleanup = installChatViewportLock({
                shellId: 'revy-chat-shell',
                composerId: 'revy-chat-composer',
                inputId: 'revy-message-input',
                messagesId: 'revy-bot-messages'
            });
            const sendBotMessage = async () => {
                const input = document.getElementById('revy-message-input');
                const text = input.value.trim();
                if (!text) return;
                input.value = '';
                input.style.height = 'auto';
                revyBotLastQuestion = text;
                addRevyBotMessage(text, 'user');

                revyBotTyping = true;
                renderRevyBotMessages();

                const reply = await getRevyBotReply(text);
                
                revyBotTyping = false;

                if (reply?.unsupported) {
                    addRevyBotMessage(reply.text, 'bot', 'escalate');
                } else {
                    addRevyBotMessage(reply, 'bot');
                }
            };
            document.getElementById('revy-send-btn').onclick = sendBotMessage;
            const revyInput = document.getElementById('revy-message-input');
            if (revyInput) {
                const adjustRevyTextareaHeight = () => {
                    revyInput.style.height = 'auto';
                    revyInput.style.height = Math.min(revyInput.scrollHeight, 120) + 'px';
                };
                revyInput.addEventListener('input', adjustRevyTextareaHeight);

                document.querySelectorAll('.revy-option').forEach(btn => {
                    btn.onclick = () => {
                        revyInput.value = btn.dataset.revyQuestion;
                        sendBotMessage();
                        adjustRevyTextareaHeight();
                    };
                });

                revyInput.addEventListener('keydown', (e) => {
                    resetRevyBotTimer();
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendBotMessage();
                    }
                });
            }
            document.getElementById('revy-back-btn').onclick = () => {
                if (revyKeyboardCleanup) revyKeyboardCleanup();
                if (window.revyBotAdminView) {
                    showAdminMainPage();
                } else {
                    showHelpSupportPage();
                }
            };
            document.getElementById('revy-close-btn').onclick = () => {
                if (revyKeyboardCleanup) revyKeyboardCleanup();
                closeRevyBotSession();
            };
            addRevyBotMessage(`Hi ${currentUserData?.name || 'there'}, I am REVY, RW AI BOT. I can instantly help with wallet balance, withdrawal status, transaction history, payment details, recharge, gift code, loan, invoices, password reset, and app usage.`);
        };

const loadSubAdminChatCard = async (parentAdminId) => {
            let subAdminProfile = null;
            try {
                const adminDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/users`, parentAdminId));
                if (adminDoc.exists()) {
                    subAdminProfile = { id: parentAdminId, ...adminDoc.data() };
                }
            } catch (e) {
                console.warn("Could not load sub-admin profile:", e);
            }
            
            const container = document.getElementById('sub-admin-chat-card-wrapper');
            if (!container) return;

            const subAdminName = subAdminProfile?.name || 'My Admin';
            const subAdminLogo = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
            
            const roomId = getSupportRoomId(currentUser.uid, parentAdminId);
            const unreadCount = calculateSupportUnreadCount(roomId);

            container.innerHTML = `
                <button id="sub-admin-chat-card" class="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-md text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition animate-fade-in">
                    <img src="${subAdminLogo}" alt="${escapeHtml(subAdminName)}" class="h-14 w-14 shrink-0 rounded-full object-contain bg-blue-50 p-2">
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-gray-900 dark:text-white inline-flex items-center gap-1">${escapeHtml(subAdminName)} ${getVerifiedBadge()}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 truncate">Chat with your team admin</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span id="sub-admin-chat-unread-badge" class="${unreadCount > 0 ? '' : 'hidden'} min-w-6 h-6 rounded-full bg-red-600 px-2 text-center text-xs font-black leading-6 text-white shadow">${unreadCount}</span>
                        <span class="text-blue-600 dark:text-blue-300 font-bold">Chat</span>
                    </div>
                </button>
            `;
            container.classList.remove('hidden');
            
            document.getElementById('sub-admin-chat-card').onclick = () => {
                openSupportChatPage(currentUser.uid, 'user', {
                    adminId: parentAdminId,
                    adminName: subAdminName,
                    adminEmail: subAdminProfile?.email || '',
                    adminMobile: subAdminProfile?.mobile || '',
                    adminLogo: subAdminLogo
                });
            };
        };

const showHelpSupportPage = () => {
            if (!ensureUserSessionReady()) return;
            const parentAdminId = currentUserData?.parentAdmin || currentUserData?.parent_admin || '';
            const hasSubAdmin = parentAdminId && parentAdminId !== ADMIN_UID;

            const content = `
                ${getPageHeader('Help', { showBack: false })}
                <div class="max-w-lg mx-auto space-y-4">
                    <button id="revy-ai-chat-card" class="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-md text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                        ${getRevyBotLogo('h-14 w-14 shrink-0')}
                        <div class="flex-1 min-w-0">
                            <h3 class="font-bold text-gray-900 dark:text-white inline-flex items-center gap-1">REVY - RW AI BOT ${getVerifiedBadge()}</h3>
                            <p class="text-sm text-emerald-600 dark:text-emerald-300 truncate">Instant help solution</p>
                        </div>
                        <span class="text-blue-600 dark:text-blue-300 font-bold">Ask</span>
                    </button>
                    ${!hasSubAdmin ? `
                    <button id="reviews-world-chat-card" class="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-md text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                        ${getSupportLogoFrame('h-14 w-14 shrink-0')}
                        <div class="flex-1 min-w-0">
                            <h3 class="font-bold text-gray-900 dark:text-white inline-flex items-center gap-1">REVIEWS WORLD ${getVerifiedBadge()}</h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400 truncate">Chat with admin support</p>
                        </div>
                        <span id="support-chat-unread-badge" class="hidden min-w-6 h-6 rounded-full bg-red-600 px-2 text-center text-xs font-black leading-6 text-white shadow"></span>
                        <span class="text-blue-600 dark:text-blue-300 font-bold">Chat</span>
                    </button>
                    ` : ''}
                    <div id="sub-admin-chat-card-wrapper" class="hidden"></div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { keepBottomNav: true });
            currentMainSection = 'help';
            setBottomNavActive('bottom-help-btn');
            updateSupportChatUnreadBadges();
            document.getElementById('revy-ai-chat-card').onclick = openRevyBotChatPage;
            if (!hasSubAdmin) {
                document.getElementById('reviews-world-chat-card').onclick = () => openSupportChatPage(currentUser.uid, 'user', { adminId: ADMIN_UID });
            }
            
            if (hasSubAdmin) {
                loadSubAdminChatCard(parentAdminId);
            }
        };

const openAdminInspectDetailsModal = async (chatUserId, messageText) => {
    if (typeof showLoading === 'function') showLoading();
    
    try {
        const taskIdMatch = messageText.match(/(?:Task ID:|🆔)\s*([^\n\r]+)/i);
        const displayIdMatch = messageText.match(/(?:Submission ID:|🔢)\s*([^\n\r]+)/i);
        const dbSubIdMatch = messageText.match(/(?:\[DbSubId:|📄\s*\[DbSubId:)\s*([^\]\s]+)\]?/i);

        const taskId = taskIdMatch ? taskIdMatch[1].trim() : '';
        const displayId = displayIdMatch ? displayIdMatch[1].trim() : '';
        const dbSubId = dbSubIdMatch ? dbSubIdMatch[1].trim() : '';

        const token = await getBackendAuthToken();
        const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions?userId=${chatUserId}`, {
            headers: { Authorization: `Bearer ${token}` }
        }, 10000);
        
        if (!response.ok) throw new Error('Failed to fetch submissions');
        const resData = await response.json();
        const submissions = resData.submissions || [];
        
        let s = null;
        if (dbSubId) {
            s = submissions.find(x => x.id === dbSubId);
        }
        if (!s && displayId) {
            s = submissions.find(x => {
                const taskIndexVal = x.task_index || x.taskIndex || 1;
                const commentIndexVal = x.comment_index !== undefined ? x.comment_index : (x.commentIndex ?? x.assignedCommentIndex ?? 0);
                const subDisplayId = `#${String(taskIndexVal).padStart(2, '0')}_${String(commentIndexVal + 1).padStart(2, '0')}`;
                return subDisplayId === displayId;
            });
        }
        if (!s && taskId) {
            s = submissions.find(x => x.task_id === taskId || x.taskId === taskId);
        }
        
        if (!s) {
            if (typeof hideLoading === 'function') hideLoading();
            showNotification('Could not find submission details for this task.', true);
            return;
        }
        
        if (typeof hideLoading === 'function') hideLoading();
        
        const getSubDisplayId = (sub) => {
            const taskIndexVal = sub.task_index || sub.taskIndex || 1;
            const commentIndexVal = sub.comment_index !== undefined ? sub.comment_index : (sub.commentIndex ?? sub.assignedCommentIndex ?? 0);
            return `#${String(taskIndexVal).padStart(2, '0')}_${String(commentIndexVal + 1).padStart(2, '0')}`;
        };

        const getPrefilledReply = (sub) => {
            const displayIdVal = getSubDisplayId(sub);
            if (sub.manual_status === 'approved') {
                return `Hello! We inspected your task submission for "${sub.app_name || 'Task'}" (${displayIdVal}). It is already approved and paid. Your reward of ₹${sub.reward || 0} has been credited. Please verify your balance. Thank you!`;
            } else if (sub.manual_status === 'pending') {
                return `Hello! We inspected your task submission for "${sub.app_name || 'Task'}" (${displayIdVal}). It is currently under review (Pending). Our quality team is verifying that your review comment is active on the Play Store. It will be verified within 1-7 working days. Thanks for your patience!`;
            } else if (sub.manual_status === 'rejected') {
                const reason = sub.reject_reason || (sub.ocr_status === 'failed' ? 'Verification check failed' : 'Review comment not found on Play Store');
                return `Hello! We inspected your task submission for "${sub.app_name || 'Task'}" (${displayIdVal}). The verification team rejected it for the following reason: "${reason}". Please verify the steps and submit again if correct. Thank you!`;
            } else {
                return `Hello! Regarding your task submission for "${sub.app_name || 'Task'}" (${displayIdVal}), we have checked the details. Our team is looking into it and will update you shortly. Thank you!`;
            }
        };

        const rawOcrText = s.ocr_extracted_text || s.ocrExtractedText || '';
        const gmailName = s.ocr_extracted_name || '';
        const extractedReviewText = typeof window.extractActualReviewText === 'function'
            ? window.extractActualReviewText(rawOcrText, gmailName)
            : rawOcrText;

        let currentReplyText = getPrefilledReply(s);
        const subDate = s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-GB') : 'Unknown';
        
        const existing = document.getElementById('admin-inspect-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'admin-inspect-modal';
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4';
        
        const updateModalContent = () => {
            modal.innerHTML = `
                <div class="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl border border-gray-150 dark:border-gray-800 shadow-2xl overflow-y-auto max-h-[95vh] text-left">
                    <button id="inspect-close-btn" class="absolute top-4 right-4 z-50 h-7 w-7 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white text-xs font-bold transition">✕</button>
                    
                    <div class="p-6 space-y-4">
                        <div class="border-b border-gray-100 dark:border-gray-800 pb-3">
                            <h3 class="text-base font-black text-gray-900 dark:text-white">Inspect details</h3>
                            <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide mt-0.5">Support ID: support_${chatUserId}</p>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span class="block text-[9px] font-black uppercase text-gray-400">Task Name</span>
                                <span class="font-extrabold text-gray-800 dark:text-gray-200">${escapeHtml(s.app_name || 'Task')}</span>
                            </div>
                            <div>
                                <span class="block text-[9px] font-black uppercase text-gray-400">Submission Date</span>
                                <span class="font-extrabold text-gray-800 dark:text-gray-200">${subDate}</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span class="block text-[9px] font-black uppercase text-gray-400">Task ID</span>
                                <span class="font-bold text-gray-800 dark:text-gray-200 font-mono">${escapeHtml(s.task_id || '')}</span>
                            </div>
                            <div>
                                <span class="block text-[9px] font-black uppercase text-gray-400">Status</span>
                                <span class="font-bold uppercase tracking-wider ${s.manual_status === 'approved' ? 'text-emerald-500' : s.manual_status === 'rejected' ? 'text-rose-500' : 'text-amber-500'}">${s.manual_status}</span>
                            </div>
                        </div>
                        
                        <div class="space-y-1.5 text-xs">
                            <span class="block text-[9px] font-black uppercase text-gray-400">Screenshot Proof</span>
                            <div class="relative w-32 aspect-[9/16] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-950 flex items-center justify-center cursor-zoom-in">
                                <img id="inspect-screenshot-img" src="${escapeHtml(s.screenshot_url)}" alt="Screenshot" class="h-full w-full object-cover">
                            </div>
                        </div>

                        <div class="space-y-1.5 text-xs bg-gray-50 dark:bg-gray-800/40 p-3 rounded-2xl border border-gray-150 dark:border-gray-800">
                            <span class="block text-[9px] font-black uppercase text-gray-400">Assigned Comment</span>
                            <p class="font-bold text-gray-800 dark:text-gray-200 italic">"${escapeHtml(s.assigned_comment || 'None')}"</p>
                        </div>

                        <div class="space-y-1.5 text-xs bg-gray-50 dark:bg-gray-800/40 p-3 rounded-2xl border border-gray-150 dark:border-gray-800">
                            <span class="block text-[9px] font-black uppercase text-purple-500 dark:text-purple-400">Used Comment (OCR Extracted Text)</span>
                            <p class="font-semibold text-gray-800 dark:text-gray-200 leading-relaxed bg-purple-50/50 dark:bg-purple-950/10 p-2.5 rounded-xl border border-purple-100/50 dark:border-purple-900/30">${escapeHtml(extractedReviewText || 'Not found in screenshot')}</p>
                        </div>
                        
                        <div class="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                            <span class="block text-[9px] font-black uppercase text-gray-400">Automated Reply / Response</span>
                            <textarea id="inspect-reply-textarea" class="w-full h-24 p-3 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-950 dark:text-white resize-none" style="outline: none;">${escapeHtml(currentReplyText)}</textarea>
                        </div>
                        
                        <div class="flex flex-col gap-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                            <div class="grid grid-cols-2 gap-2">
                                ${s.manual_status !== 'approved' ? `
                                    <button id="inspect-approve-btn" class="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 text-xs transition active:scale-95 shadow-sm">✅ Approve Manual</button>
                                ` : ''}
                                <button id="inspect-solve-btn" class="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black py-2.5 text-xs transition active:scale-95 shadow-sm ${s.manual_status === 'approved' ? 'col-span-2' : ''}">⭐ Mark as Solved</button>
                            </div>
                            <button id="inspect-send-btn" class="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 text-xs transition active:scale-95 shadow-sm uppercase tracking-wider">📤 Send Reply</button>
                        </div>
                    </div>
                </div>
            `;
            
            modal.querySelector('#inspect-close-btn').onclick = () => modal.remove();
            
            const screenshotImg = modal.querySelector('#inspect-screenshot-img');
            if (screenshotImg) {
                screenshotImg.onclick = () => {
                    if (typeof window.showScreenshotLightbox === 'function') {
                        window.showScreenshotLightbox(s.screenshot_url, s.view_url || s.screenshot_view_url || '');
                    }
                };
            }
            
            const approveBtn = modal.querySelector('#inspect-approve-btn');
            if (approveBtn) {
                approveBtn.onclick = async () => {
                    approveBtn.disabled = true;
                    approveBtn.textContent = 'Approving...';
                    try {
                        const token = await getBackendAuthToken();
                        await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions/${encodeURIComponent(s.id)}`, {
                            method: 'PATCH',
                            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ manualStatus: 'approved', verifiedAt: Date.now() })
                        }, 8000);
                        
                        s.manual_status = 'approved';
                        showNotification('Submission approved manually.');
                        currentReplyText = getPrefilledReply(s);
                        updateModalContent();
                    } catch (err) {
                        console.error('Approve failed:', err);
                        showNotification('Approval failed. Please try again.', true);
                        approveBtn.disabled = false;
                        approveBtn.textContent = '✅ Approve Manual';
                    }
                };
            }
            
            const solveBtn = modal.querySelector('#inspect-solve-btn');
            if (solveBtn) {
                solveBtn.onclick = () => {
                    const textarea = modal.querySelector('#inspect-reply-textarea');
                    const displayIdVal = getSubDisplayId(s);
                    const resolvedMsg = `Hello! We checked your task submission for "${s.app_name || 'Task'}" (${displayIdVal}). The issue is resolved now. Thank you for your support!`;
                    if (textarea) {
                        textarea.value = resolvedMsg;
                        currentReplyText = resolvedMsg;
                    }
                    showNotification('Doubt response prefilled with resolved reply.');
                };
            }
            
            const sendBtn = modal.querySelector('#inspect-send-btn');
            if (sendBtn) {
                sendBtn.onclick = () => {
                    const textarea = modal.querySelector('#inspect-reply-textarea');
                    const text = textarea ? textarea.value.trim() : '';
                    if (!text) {
                        showNotification('Please enter a response message.', true);
                        return;
                    }
                    
                    const socket = window.activeSupportSocket;
                    if (!socket?.connected) {
                        showNotification('Chat socket not connected. Please try again in a moment.', true);
                        return;
                    }
                    
                    const clientMsgId = `${window.activeSupportRoomId}-admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                    const userMeta = {
                        userId: chatUserId,
                        userName: 'User',
                        userEmail: '',
                        userMobile: ''
                    };
                    
                    socket.emit('send_message', {
                        roomId: window.activeSupportRoomId,
                        message: text,
                        userMeta,
                        clientMessageId: clientMsgId
                    }, (response) => {
                        if (response?.ok) {
                            showNotification('Reply sent successfully.');
                        } else {
                            console.error('Failed to send admin support message:', response?.error);
                            showNotification('Failed to send reply.', true);
                        }
                    });
                    
                    modal.remove();
                };
            }
        };
        
        document.body.appendChild(modal);
        updateModalContent();
        
    } catch (err) {
        if (typeof hideLoading === 'function') hideLoading();
        console.error('Inspect details load failed:', err);
        showNotification('Failed to load submission details.', true);
    }
};

// Expose functions to window for global access
window.getSupportSocket = getSupportSocket;
window.installChatViewportLock = installChatViewportLock;
window.getSupportLogo = getSupportLogo;
window.getRevyBotLogo = getRevyBotLogo;
window.getSupportLogoFrame = getSupportLogoFrame;
window.showSupportProfileModal = showSupportProfileModal;
window.formatChatTime = formatChatTime;
window.formatChatDate = formatChatDate;
window.markChatMessagesRead = markChatMessagesRead;
window.renderSupportMessages = renderSupportMessages;
window.getSupportRoomId = getSupportRoomId;
window.getSupportChatCacheKey = getSupportChatCacheKey;
window.getSupportChatSeenKey = getSupportChatSeenKey;
window.readSupportChatCache = readSupportChatCache;
window.writeSupportChatCache = writeSupportChatCache;
window.getSupportMessageDedupeKey = getSupportMessageDedupeKey;
window.mergeSupportMessages = mergeSupportMessages;
window.applySupportReadReceipt = applySupportReadReceipt;
window.fetchSupportChatHistory = fetchSupportChatHistory;
window.calculateSupportUnreadCount = calculateSupportUnreadCount;
window.updateSupportChatUnreadBadges = updateSupportChatUnreadBadges;
window.markSupportChatSeen = markSupportChatSeen;
window.refreshSupportUnreadFromCache = refreshSupportUnreadFromCache;
window.preloadSupportChatForUser = preloadSupportChatForUser;
window.openSupportChatPage = openSupportChatPage;
window.resetRevyBotTimer = resetRevyBotTimer;
window.closeRevyBotSession = closeRevyBotSession;
window.getRevyBotReply = getRevyBotReply;
window.renderRevyBotMessages = renderRevyBotMessages;
window.addRevyBotMessage = addRevyBotMessage;
window.openRevyBotChatPage = openRevyBotChatPage;
window.showHelpSupportPage = showHelpSupportPage;
window.openAdminInspectDetailsModal = openAdminInspectDetailsModal;

const showDeleteSupportMessageModal = (messageId, isMine, viewerRole, messageObj = null) => {
    const isSender = isMine || viewerRole === 'admin';
    const targetMsg = messageObj || (typeof activeSupportMessages !== 'undefined' ? activeSupportMessages.find(m => String(m.id) === String(messageId)) : null);
    const isReadByRecipient = !!(targetMsg && (targetMsg.readAt || targetMsg.read || targetMsg.status === 'read'));
    const canDeleteForEveryone = isSender && !isReadByRecipient;

    renderModal('Delete Message', `
        <div class="space-y-4 text-center">
            <p class="text-sm text-gray-600 dark:text-gray-300">Choose how you want to delete this message:</p>
            <div class="space-y-2 pt-2">
                <button id="delete-for-me-btn" class="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl text-sm font-bold text-gray-800 dark:text-white transition">🗑️ Delete for me</button>
                ${canDeleteForEveryone ? `
                <button id="delete-for-everyone-btn" class="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 rounded-xl text-sm font-bold text-rose-600 dark:text-rose-400 transition">🌍 Delete for everyone</button>
                ` : ''}
            </div>
        </div>
    `, `
        <button onclick="window.closeModal()" class="w-full rounded-xl bg-gray-100 dark:bg-gray-700 py-3 text-sm font-extrabold text-gray-700 dark:text-gray-200">Cancel</button>
    `, 'max-w-xs');

    document.getElementById('delete-for-me-btn').onclick = () => {
        const myUid = (typeof getCurrentUserId === 'function' ? getCurrentUserId() : (currentUser?.uid || ''));
        const deletedIds = JSON.parse(localStorage.getItem(`deleted_message_ids_${myUid}`) || '[]');
        deletedIds.push(messageId);
        localStorage.setItem(`deleted_message_ids_${myUid}`, JSON.stringify(deletedIds));
        
        window.closeModal();
        showNotification('Message deleted for you.');
        
        if (typeof activeSupportMessages !== 'undefined') {
            renderSupportMessages(activeSupportMessages, viewerRole);
        }
    };

    if (canDeleteForEveryone) {
        document.getElementById('delete-for-everyone-btn').onclick = async () => {
            const socket = window.activeSupportSocket;
            if (!socket || !socket.connected) {
                showNotification('Connecting delete request...', false);
                try {
                    const token = await getBackendAuthToken();
                    const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/chats/${encodeURIComponent(activeSupportRoomId)}/messages/${messageId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    }, 5000);
                    const res = await response.json().catch(() => ({}));
                    window.closeModal();
                    if (response.ok && res.ok) {
                        showNotification('Message deleted for everyone.');
                        activeSupportMessages = activeSupportMessages.filter(msg => msg.id !== messageId);
                        writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
                        renderSupportMessages(activeSupportMessages, viewerRole);
                    } else {
                        showNotification(res.error || 'Failed to delete message.', true);
                    }
                } catch (e) {
                    window.closeModal();
                    showNotification('Network error deleting message.', true);
                }
                return;
            }
            
            showNotification('Deleting message...', false);
            socket.emit('delete_message', { roomId: activeSupportRoomId, messageId }, (res) => {
                window.closeModal();
                if (res && res.ok) {
                    showNotification('Message deleted for everyone.');
                    activeSupportMessages = activeSupportMessages.filter(msg => msg.id !== messageId);
                    writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
                    renderSupportMessages(activeSupportMessages, viewerRole);
                } else {
                    showNotification(res?.error || 'Failed to delete message.', true);
                }
            });
        };
    }
};

window.showDeleteSupportMessageModal = showDeleteSupportMessageModal;

const updateMultiSelectBar = (viewerRole) => {
    const composer = document.getElementById('support-chat-composer');
    let bar = document.getElementById('support-chat-multiselect-bar');
    
    if (!isMultiSelectMode) {
        if (composer) composer.classList.remove('hidden');
        if (bar) bar.remove();
        return;
    }
    
    if (composer) composer.classList.add('hidden');
    
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'support-chat-multiselect-bar';
        bar.className = 'shrink-0 flex items-center justify-between gap-3 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-gray-150 dark:border-gray-750 bg-white dark:bg-gray-800 transition-all';
        composer.parentNode.insertBefore(bar, composer.nextSibling);
    }
    
    const count = selectedMessageIds.size;
    
    let canDeleteForEveryone = count > 0;
    if (canDeleteForEveryone && viewerRole !== 'admin') {
        const allMsgMine = Array.from(selectedMessageIds).every(id => {
            const bubble = document.querySelector(`.support-chat-bubble[data-msg-id="${id}"]`);
            return bubble && bubble.dataset.isMine === 'true';
        });
        if (!allMsgMine) {
            canDeleteForEveryone = false;
        }
    }
    
    bar.innerHTML = `
        <div class="flex items-center gap-2">
            <button id="multiselect-cancel-btn" class="h-8 px-3 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-black text-gray-700 dark:text-gray-200 transition">✕ Cancel</button>
            <span id="multiselect-count-text" class="text-xs font-bold text-gray-600 dark:text-gray-300">${count} selected</span>
        </div>
        <div class="flex items-center gap-2">
            <button id="multiselect-delete-me-btn" ${count === 0 ? 'disabled' : ''} class="h-9 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-xs font-black text-gray-800 dark:text-white transition flex items-center gap-1 ${count === 0 ? 'opacity-50 pointer-events-none' : ''}">🗑️ Delete for me</button>
            ${canDeleteForEveryone ? `
            <button id="multiselect-delete-everyone-btn" class="h-9 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-xs font-black text-rose-600 dark:text-rose-400 transition flex items-center gap-1">🌍 Delete for everyone</button>
            ` : ''}
        </div>
    `;
    
    bar.querySelector('#multiselect-cancel-btn').onclick = () => {
        isMultiSelectMode = false;
        selectedMessageIds.clear();
        renderSupportMessages(activeSupportMessages, viewerRole);
    };
    
    const deleteMeBtn = bar.querySelector('#multiselect-delete-me-btn');
    if (deleteMeBtn && count > 0) {
        deleteMeBtn.onclick = () => {
            const myUid = (typeof getCurrentUserId === 'function' ? getCurrentUserId() : (currentUser?.uid || ''));
            const deletedIds = JSON.parse(localStorage.getItem(`deleted_message_ids_${myUid}`) || '[]');
            selectedMessageIds.forEach(id => deletedIds.push(id));
            localStorage.setItem(`deleted_message_ids_${myUid}`, JSON.stringify(deletedIds));
            
            showNotification(`${count} messages deleted for you.`);
            isMultiSelectMode = false;
            selectedMessageIds.clear();
            renderSupportMessages(activeSupportMessages, viewerRole);
        };
    }
    
    const deleteEveryoneBtn = bar.querySelector('#multiselect-delete-everyone-btn');
    if (deleteEveryoneBtn && canDeleteForEveryone) {
        deleteEveryoneBtn.onclick = async () => {
            const socket = window.activeSupportSocket;
            const countToDelete = selectedMessageIds.size;
            showNotification(`Deleting ${countToDelete} messages...`, false);
            
            const promises = Array.from(selectedMessageIds).map(messageId => {
                return new Promise(async (resolve) => {
                    if (socket && socket.connected) {
                        socket.emit('delete_message', { roomId: activeSupportRoomId, messageId }, (res) => {
                            resolve(res && res.ok);
                        });
                    } else {
                        try {
                            const token = await getBackendAuthToken();
                            const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/chats/${encodeURIComponent(activeSupportRoomId)}/messages/${messageId}`, {
                                method: 'DELETE',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                }
                            }, 4000);
                            const res = await response.json().catch(() => ({}));
                            resolve(response.ok && res.ok);
                        } catch (e) {
                            resolve(false);
                        }
                    }
                });
            });
            
            await Promise.all(promises);
            showNotification(`${countToDelete} messages deleted for everyone.`);
            
            activeSupportMessages = activeSupportMessages.filter(msg => !selectedMessageIds.has(msg.id));
            writeSupportChatCache(activeSupportRoomId, activeSupportMessages);
            
            isMultiSelectMode = false;
            selectedMessageIds.clear();
            renderSupportMessages(activeSupportMessages, viewerRole);
        };
    }
};

const showSupportMessageContextMenu = (messageId, isMine, viewerRole) => {
    renderModal('Message Options', `
        <div class="space-y-3 py-1">
            <button id="context-delete-btn" class="w-full py-3.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 rounded-2xl text-sm font-extrabold text-rose-600 dark:text-rose-400 transition flex items-center justify-center gap-2">
                🗑️ Delete Message
            </button>
            <button id="context-select-btn" class="w-full py-3.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 rounded-2xl text-sm font-extrabold text-blue-600 dark:text-blue-400 transition flex items-center justify-center gap-2">
                📝 Select Multiple
            </button>
        </div>
    `, `
        <button onclick="window.closeModal()" class="w-full rounded-2xl bg-gray-100 dark:bg-gray-700 py-3 text-sm font-extrabold text-gray-700 dark:text-gray-200">Cancel</button>
    `, 'max-w-xs');

    document.getElementById('context-delete-btn').onclick = () => {
        window.closeModal();
        window.showDeleteSupportMessageModal(messageId, isMine, viewerRole);
    };

    document.getElementById('context-select-btn').onclick = () => {
        window.closeModal();
        isMultiSelectMode = true;
        selectedMessageIds.clear();
        selectedMessageIds.add(messageId);
        renderSupportMessages(activeSupportMessages, viewerRole);
    };
};

window.updateMultiSelectBar = updateMultiSelectBar;
window.showSupportMessageContextMenu = showSupportMessageContextMenu;
