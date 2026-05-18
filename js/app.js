import { auth, db, appId, ADMIN_UID } from './core/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    doc, 
    onSnapshot, 
    collection, 
    query, 
    where, 
    orderBy, 
    limit 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { 
    setCurrentUser, 
    setCurrentUserData, 
    setTransactions, 
    setPendingRequests, 
    setUnifiedHistoryCache,
    currentUser,
    currentUserData,
    transactions,
    pendingRequests,
    unifiedHistoryCache
} from './core/state.js';
import { handleAuth, toggleAuthMode, handleLogout, handleForgotPassword } from './features/auth.js';
import { notificationSystem, showFullNotificationPage } from './features/notifications.js';
import { showNotification, renderModal } from './ui/components.js';
import { formatCurrency } from './utils/formatters.js';
import { showAllTransactionsPage, showWithdrawPage, showPage } from './ui/pages.js';
import { 
    renderTransactionItem, 
    handleRedeem, 
    handlePayToWallet,
    handleWithdrawRequest 
} from './features/wallet.js';
import { 
    showAdminNotificationsPage, 
    handleSendNotification, 
    showSendNotificationModal,
    loadNotificationHistory,
    showAdminWithdrawalsPage,
    showAdminUsersPage,
    showAdminGiftCodesPage,
    showWithdrawalHistoryPage,
    showAdminWithdrawSettingsModal,
    showManageAdminWalletModal
} from './features/admin.js';

// Global app object for inline handlers and easier access
window.app = {
    handleAuth,
    toggleAuthMode,
    handleLogout,
    handleForgotPassword,
    showAllTransactionsPage,
    showWithdrawPage,
    showFullNotificationPage,
    showPage,
    showAdminNotificationsPage,
    handleSendNotification,
    showSendNotificationModal,
    loadNotificationHistory,
    showAdminWithdrawalsPage,
    showAdminUsersPage,
    showAdminGiftCodesPage,
    showWithdrawalHistoryPage,
    showAdminWithdrawSettingsModal,
    showManageAdminWalletModal,
    handleRedeem,
    handlePayToWallet,
    handleWithdrawRequest
};

// Immediately hide loading screen once script starts
document.getElementById('js-fail-msg')?.classList.add('hidden');

// Re-expose some functions to window for existing onclick handlers in index.html
window.showPage = showPage;
window.showAllTransactionsPage = showAllTransactionsPage;
window.showFullNotificationPage = showFullNotificationPage;
window.showAdminNotificationsPage = showAdminNotificationsPage;
window.showAdminWithdrawalsPage = showAdminWithdrawalsPage;
window.showAdminUsersPage = showAdminUsersPage;
window.showAdminGiftCodesPage = showAdminGiftCodesPage;
window.showWithdrawalHistoryPage = showWithdrawalHistoryPage;
window.showAdminWithdrawSettingsModal = showAdminWithdrawSettingsModal;
window.showManageAdminWalletModal = showManageAdminWalletModal;
window.handleRedeem = handleRedeem;
window.handlePayToWallet = handlePayToWallet;

let unsubscribers = [];

const clearListeners = () => {
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
};

const initializeUserListeners = (userId) => {
    console.log(`Initializing listeners for ${userId}`);
    clearListeners();

    // User Data Listener
    const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
    unsubscribers.push(onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setCurrentUserData(data);
            updateUI(data);
            
            // If admin, show admin tab
            if (userId === ADMIN_UID) {
                document.getElementById('admin-tab-button')?.classList.remove('hidden');
            }
        }
    }));

    // Transactions Listener
    const txQuery = query(collection(userRef, 'transactions'), orderBy('timestamp', 'desc'));
    unsubscribers.push(onSnapshot(txQuery, (snap) => {
        const txs = snap.docs.map(d => ({ ...d.data(), key: d.id }));
        setTransactions(txs);
        updateUnifiedHistory();
    }));

    // Fund Requests Listener
    const reqQuery = query(collection(db, `artifacts/${appId}/public/data/fund_requests`), where("userId", "==", userId));
    unsubscribers.push(onSnapshot(reqQuery, (snap) => {
        const reqs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        setPendingRequests(reqs.filter(r => r.status === 'pending'));
        updateUnifiedHistory();
    }));
};

const updateUI = (data) => {
    const balanceEl = document.getElementById('user-balance');
    if (balanceEl) balanceEl.textContent = formatCurrency(data.balance);
    
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = data.name || 'User';

    // Admin dashboard balance
    const adminBalanceEl = document.getElementById('admin-wallet-balance');
    if (adminBalanceEl && currentUser?.uid === ADMIN_UID) {
        adminBalanceEl.textContent = formatCurrency(data.balance);
    }
};

const updateUnifiedHistory = () => {
    const unified = [
        ...pendingRequests.map(r => ({ ...r, key: r.id, timestamp: r.requestedAt })),
        ...transactions
    ].sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return timeB - timeA;
    });

    setUnifiedHistoryCache(unified);
    renderDashboardHistory();
};

const renderDashboardHistory = () => {
    const list = document.getElementById('transactions-list');
    if (!list) return;
    
    const displayList = unifiedHistoryCache || [];
    if (displayList.length === 0) {
        list.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No transactions yet.</p>';
    } else {
        list.innerHTML = displayList.slice(0, 5).map(item => renderTransactionItem(item)).join('');
    }
};

onAuthStateChanged(auth, (user) => {
    console.log("Auth state changed:", user ? "User logged in" : "No user");
    
    setCurrentUser(user);
    const authScreen = document.getElementById('auth-screen');
    const mainContent = document.getElementById('main-content');

    if (user) {
        authScreen.classList.add('hidden');
        mainContent.classList.remove('hidden');
        initializeUserListeners(user.uid);
        localStorage.setItem('lastLoggedInUser', user.uid);
    } else {
        authScreen.classList.remove('hidden');
        mainContent.classList.add('hidden');
        clearListeners();
        localStorage.removeItem('lastLoggedInUser');
    }
});

// Tab Switching Logic
const switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId)?.classList.remove('hidden');
    
    document.querySelectorAll('.tab-button').forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        btn.setAttribute('aria-selected', isActive);
        btn.classList.toggle('text-blue-600', isActive);
        btn.classList.toggle('border-blue-600', isActive);
    });
};

// Initialize Static Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Auth Form
    document.getElementById('auth-form')?.addEventListener('submit', handleAuth);
    document.getElementById('auth-toggle')?.addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode(); });
    
    // Tab Switching
    document.getElementById('tabs-container')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-button');
        if (btn) switchTab(btn.dataset.tab);
    });

    // Main Dashboard Buttons
    document.getElementById('withdraw-fund-btn')?.addEventListener('click', showWithdrawPage);
    document.getElementById('view-all-tx-btn')?.addEventListener('click', showAllTransactionsPage);
    document.getElementById('notification-bell')?.addEventListener('click', showFullNotificationPage);
    document.getElementById('redeem-gift-card-btn')?.addEventListener('click', () => {
        renderModal('Redeem Gift Card',
            `<input type="text" id="gift-code-input" placeholder="Enter your code" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">`,
            `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
             <button id="modal-submit-btn" class="px-4 py-2 text-sm bg-green-500 text-white rounded-lg">Redeem</button>`);
        document.getElementById('modal-submit-btn').onclick = handleRedeem;
    });
    document.getElementById('pay-to-wallet-btn')?.addEventListener('click', () => {
        showNotification('Transfer feature coming soon!', false);
    });
    
    // Admin Buttons
    document.getElementById('manage-admin-wallet-btn')?.addEventListener('click', () => {
        if (window.showManageAdminWalletModal) window.showManageAdminWalletModal();
    });
    
    document.getElementById('admin-notifications-btn')?.addEventListener('click', showAdminNotificationsPage);
    document.getElementById('admin-withdrawals-btn')?.addEventListener('click', () => {
        if (window.showAdminWithdrawalsPage) window.showAdminWithdrawalsPage();
    });
    document.getElementById('admin-users-btn')?.addEventListener('click', () => {
        if (window.showAdminUsersPage) window.showAdminUsersPage();
    });
    document.getElementById('admin-gift-codes-btn')?.addEventListener('click', () => {
        if (window.showAdminGiftCodesPage) window.showAdminGiftCodesPage();
    });
    document.getElementById('admin-withdrawal-history-btn')?.addEventListener('click', () => {
        if (window.showWithdrawalHistoryPage) window.showWithdrawalHistoryPage();
    });
    document.getElementById('admin-withdraw-settings-btn')?.addEventListener('click', () => {
        if (window.showAdminWithdrawSettingsModal) window.showAdminWithdrawSettingsModal();
    });
    document.getElementById('admin-pro-users-btn')?.addEventListener('click', () => {
        if (window.showAdminUsersPage) window.showAdminUsersPage();
    });

    // Password Toggle
    document.getElementById('password-toggle')?.addEventListener('click', () => {
        const passInput = document.getElementById('password');
        const isPassword = passInput.type === 'password';
        passInput.type = isPassword ? 'text' : 'password';
        document.getElementById('eye-open')?.classList.toggle('hidden', !isPassword);
        document.getElementById('eye-closed')?.classList.toggle('hidden', isPassword);
    });

    // Forgot Password
    document.getElementById('forgot-password-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('forgot-password-modal')?.classList.remove('hidden');
        document.getElementById('forgot-password-modal')?.classList.add('flex');
    });

    window.closeForgotPasswordModal = () => {
        document.getElementById('forgot-password-modal')?.classList.add('hidden');
        document.getElementById('forgot-password-modal')?.classList.remove('flex');
    };

    document.getElementById('send-reset-btn')?.addEventListener('click', handleForgotPassword);
});
