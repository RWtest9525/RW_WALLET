import { db, appId, ADMIN_UID } from '../core/firebase.js';
import { 
    doc, 
    collection, 
    query, 
    where, 
    getDocs, 
    runTransaction, 
    serverTimestamp,
    deleteDoc,
    addDoc,
    orderBy,
    limit,
    onSnapshot,
    updateDoc,
    deleteField,
    setDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatCurrency, formatDate, maskMobile, maskUpi, generateTransactionId } from '../utils/formatters.js';
import { showNotification, renderModal, getPageHeader, getPageFooter } from '../ui/components.js';
import { allUsersCache, allFundRequestsCache, currentUser, currentUserData } from '../core/state.js';
import { notificationSystem } from './notifications.js';

export const handleSendNotification = async (type) => {
    const title = document.getElementById('notification-title').value.trim();
    const message = document.getElementById('notification-message').value.trim();
    const important = document.getElementById('notification-important')?.checked || false;

    if (!title || !message) {
        showNotification('Please fill all fields', true);
        return;
    }

    let userId = 'all';
    if (type === 'user') {
        userId = document.getElementById('notification-user-select').value;
        if (!userId) {
            showNotification('Please select a user', true);
            return;
        }
    }

    const btn = document.getElementById('send-notification-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const notificationData = {
            title,
            message,
            type: 'admin_message',
            important,
            targetUid: type === 'all' ? 'all' : userId,
            adminId: currentUser.uid,
            adminName: currentUserData?.name || 'Admin',
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, `artifacts/${appId}/public/data/notifications`), notificationData);

        // OneSignal logic
        const ONE_SIGNAL_REST_API_KEY = "os_v2_app_jl75pxncyffzjast3xquf5gii54sqa6fycmuglew4vp64rdufzqradkcxzgkeff5rti2ejsth3oiqiqnoclktgkj2onvl5kqoxlyvbi";
        const ONE_SIGNAL_APP_ID = "4affd7dd-a2c1-4b94-8253-dde142f4c847";
        
        if (ONE_SIGNAL_REST_API_KEY) {
            const payload = {
                app_id: ONE_SIGNAL_APP_ID,
                headings: { "en": title },
                contents: { "en": message },
                target_channel: "push"
            };
            if (userId === 'all') payload.included_segments = ["Subscribed Users"];
            else payload.include_external_user_ids = [userId];
            
            try {
                await fetch('https://onesignal.com/api/v1/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${ONE_SIGNAL_REST_API_KEY}` },
                    body: JSON.stringify(payload)
                });
            } catch (e) { console.error("OneSignal Push Failed:", e); }
        }

        showNotification(`Notification sent!`);
        window.closeModal();
        loadNotificationHistory();
    } catch (error) {
        showNotification('Failed to send notification', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Notification';
    }
};

export const loadNotificationHistory = async () => {
    const historyDiv = document.getElementById('notification-history');
    if (!historyDiv) return;
    
    try {
        const q = query(collection(db, `artifacts/${appId}/public/data/notifications`), orderBy("createdAt", "desc"), limit(20));
        const snap = await getDocs(q);
        if (snap.empty) {
            historyDiv.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No notification history</p>';
            return;
        }
        
        historyDiv.innerHTML = snap.docs.map(doc => {
            const data = doc.data();
            return `
                <div class="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-700 mb-2">
                    <div class="flex justify-between items-start">
                        <h5 class="font-bold text-sm">${data.title}</h5>
                        <span class="text-[10px] text-gray-400">${formatDate(data.createdAt)}</span>
                    </div>
                    <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">${data.message}</p>
                    <div class="mt-2 flex justify-between items-center">
                        <span class="text-[9px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full">${data.targetUid === 'all' ? 'All Users' : 'Single User'}</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) { console.error(e); }
};

export const showAdminNotificationsPage = () => {
    const content = `
        ${getPageHeader('Manage Notifications')}
        <div class="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 class="font-semibold text-blue-700 dark:text-blue-300">Broadcast to All</h4>
                    <p class="text-xs text-gray-500 mt-1">Send a message to every registered user.</p>
                    <button id="send-all-btn" class="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Broadcast</button>
                </div>
                <div class="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                    <h4 class="font-semibold text-purple-700 dark:text-purple-300">Direct Message</h4>
                    <p class="text-xs text-gray-500 mt-1">Send a private message to a specific user.</p>
                    <button id="send-user-btn" class="mt-3 w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-bold">Direct Msg</button>
                </div>
            </div>
            <div class="pt-6 border-t dark:border-gray-700">
                <h4 class="font-bold mb-4 text-gray-500 uppercase text-xs tracking-wider">Recent History</h4>
                <div id="notification-history" class="space-y-3 max-h-96 overflow-y-auto pr-2">
                    <div class="flex justify-center py-8"><div class="loading-spinner w-8 h-8 border-2"></div></div>
                </div>
            </div>
        </div>
        ${getPageFooter()}
    `;
    if (window.showPage) window.showPage(content);
    
    document.getElementById('send-all-btn').onclick = () => showSendNotificationModal('all');
    document.getElementById('send-user-btn').onclick = () => showSendNotificationModal('user');
    loadNotificationHistory();
};

export const showSendNotificationModal = (type) => {
    let userSelectHtml = '';
    if (type === 'user') {
        const options = allUsersCache
            .filter(u => u.id !== ADMIN_UID)
            .map(u => `<option value="${u.id}">${u.name || u.email}</option>`)
            .join('');
        userSelectHtml = `
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Select User</label>
                <select id="notification-user-select" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">${options}</select>
            </div>`;
    }

    const content = `
        <div class="space-y-4">
            ${userSelectHtml}
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                <input type="text" id="notification-title" placeholder="e.g. New Update!" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Message</label>
                <textarea id="notification-message" rows="3" placeholder="Enter message here..." class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"></textarea>
            </div>
            <div class="flex items-center">
                <input type="checkbox" id="notification-important" class="mr-2">
                <label for="notification-important" class="text-sm">Mark as Important</label>
            </div>
        </div>`;
    
    const actions = `
        <button onclick="window.closeModal()" class="px-4 py-2 text-sm text-gray-500">Cancel</button>
        <button id="send-notification-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-bold">Send Notification</button>`;
    
    renderModal(`Send ${type === 'all' ? 'Broadcast' : 'Message'}`, content, actions);
    document.getElementById('send-notification-btn').onclick = () => handleSendNotification(type);
};

export const showAdminWithdrawalsPage = () => {
    const content = `
        ${getPageHeader('Pending Withdrawals')}
        <div class="max-w-4xl mx-auto space-y-4 px-4" id="admin-withdrawals-list">
            <p class="text-center py-10 text-gray-500">Loading pending requests...</p>
        </div>
        ${getPageFooter()}
    `;
    if (window.showPage) window.showPage(content);
};

export const showAdminUsersPage = () => {
    const content = `
        ${getPageHeader('Manage Users')}
        <div class="max-w-4xl mx-auto px-4">
            <input type="text" id="user-search" placeholder="Search by name, email or mobile..." class="w-full px-4 py-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
            <div id="admin-users-list" class="space-y-4">
                <p class="text-center py-10 text-gray-500">Loading users...</p>
            </div>
        </div>
        ${getPageFooter()}
    `;
    if (window.showPage) window.showPage(content);
};

export const showAdminGiftCodesPage = () => {
    const content = `
        ${getPageHeader('Gift Codes')}
        <div class="max-w-2xl mx-auto px-4 space-y-6">
            <button id="create-gift-code-btn" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Create New Gift Code</button>
            <div id="admin-gift-codes-list" class="space-y-4">
                <p class="text-center py-10 text-gray-500">Loading gift codes...</p>
            </div>
        </div>
        ${getPageFooter()}
    `;
    if (window.showPage) window.showPage(content);
};

export const showWithdrawalHistoryPage = () => {
    const content = `
        ${getPageHeader('Withdrawal History')}
        <div class="max-w-4xl mx-auto px-4" id="admin-withdrawal-history-list">
            <p class="text-center py-10 text-gray-500">Loading history...</p>
        </div>
        ${getPageFooter()}
    `;
    if (window.showPage) window.showPage(content);
};

export const showAdminWithdrawSettingsModal = () => {
    showNotification('Withdrawal settings coming soon!', false);
};

export const showManageAdminWalletModal = () => {
    const content = `
        <div class="space-y-4">
            <p class="text-sm text-gray-500">Update your administrative wallet balance or settings.</p>
            <input type="number" id="admin-balance-input" value="${currentUserData?.balance || 0}" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
        </div>`;
    const actions = `
        <button onclick="window.closeModal()" class="px-4 py-2 text-sm text-gray-500">Cancel</button>
        <button onclick="showNotification('Feature locked for safety', true)" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-bold">Update Balance</button>`;
    renderModal('Manage Admin Wallet', content, actions);
};
