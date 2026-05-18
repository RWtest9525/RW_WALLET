import { getPageHeader, getPageFooter } from './components.js';
import { formatCurrency, formatDate, maskMobile, maskUpi } from '../utils/formatters.js';
import { currentUserData, transactions, pendingRequests, unifiedHistoryCache } from '../core/state.js';
import { renderTransactionItem } from '../features/wallet.js';

export const showPage = (content) => {
    const container = document.getElementById('page-container');
    if (!container) return;
    container.innerHTML = content;
    container.classList.remove('hidden');
    container.classList.add('animate-slide-up');
};

window.hidePage = () => {
    const container = document.getElementById('page-container');
    if (!container) return;
    container.classList.remove('animate-slide-up');
    container.classList.add('animate-slide-down');
    setTimeout(() => {
        container.classList.add('hidden');
        container.classList.remove('animate-slide-down');
        container.innerHTML = '';
    }, 300);
};

export const showAllTransactionsPage = () => {
    const content = `
        <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
            ${getPageHeader('Transaction History')}
            <div class="flex-1 overflow-y-auto px-4 pb-20">
                <div class="max-w-2xl mx-auto space-y-3" id="full-history-list">
                    ${unifiedHistoryCache.length > 0 
                        ? unifiedHistoryCache.map(item => renderTransactionItem(item, true)).join('')
                        : '<div class="text-center py-10 text-gray-500">No transactions yet</div>'}
                </div>
            </div>
            ${getPageFooter()}
        </div>
    `;
    showPage(content);

    // Add click listeners for transaction details
    const list = document.getElementById('full-history-list');
    if (list) {
        list.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.tx-item-clickable');
            if (itemEl && window.showTransactionDetails) {
                window.showTransactionDetails(itemEl.dataset.key);
            }
        });
    }
};

export const showWithdrawPage = () => {
    const content = `
        <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
            ${getPageHeader('Withdraw Funds')}
            <div class="flex-1 overflow-y-auto px-4 pb-20">
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl space-y-6">
                    <div class="text-center">
                        <p class="text-sm text-gray-500 dark:text-gray-400">Available Balance</p>
                        <h3 class="text-3xl font-bold text-gray-800 dark:text-white">${formatCurrency(currentUserData?.balance)}</h3>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Payment Method</label>
                            <div class="grid grid-cols-2 gap-3" id="payment-methods">
                                <button onclick="selectWithdrawMethod('upi')" class="payment-option p-3 border rounded-xl text-center transition hover:bg-blue-50 dark:hover:bg-blue-900/20" id="method-upi">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" class="h-6 mx-auto mb-1">
                                    <span class="text-xs font-bold">UPI</span>
                                </button>
                                <button onclick="selectWithdrawMethod('bank')" class="payment-option p-3 border rounded-xl text-center transition hover:bg-blue-50 dark:hover:bg-blue-900/20" id="method-bank">
                                    <svg class="w-6 h-6 mx-auto mb-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 21h18M3 10h18M5 10V7a2 2 0 012-2h10a2 2 0 012 2v3M7 21v-11m10 11v-11m-8 11v-11m4 11v-11" stroke-width="2"></path></svg>
                                    <span class="text-xs font-bold">Bank</span>
                                </button>
                            </div>
                        </div>

                        <div id="withdraw-details-container" class="hidden space-y-3">
                            <div>
                                <label id="method-label" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"></label>
                                <input type="text" id="withdraw-id" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹)</label>
                                <input type="number" id="withdraw-amount" placeholder="Min ₹100" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <button id="submit-withdraw-btn" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">Request Withdrawal</button>
                        </div>
                    </div>
                </div>
            </div>
            ${getPageFooter()}
        </div>
    `;
    showPage(content);

    let selectedMethod = null;

    window.selectWithdrawMethod = (method) => {
        selectedMethod = method;
        document.querySelectorAll('.payment-option').forEach(el => el.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20'));
        document.getElementById(`method-${method}`).classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
        
        const detailsContainer = document.getElementById('withdraw-details-container');
        detailsContainer.classList.remove('hidden');
        
        const label = document.getElementById('method-label');
        const input = document.getElementById('withdraw-id');
        
        if (method === 'upi') {
            label.textContent = 'UPI ID';
            input.placeholder = 'e.g. name@upi';
        } else {
            label.textContent = 'Bank A/C Details';
            input.placeholder = 'A/C No, IFSC, Name';
        }
    };

    document.getElementById('submit-withdraw-btn').onclick = async () => {
        const id = document.getElementById('withdraw-id').value.trim();
        const amount = parseFloat(document.getElementById('withdraw-amount').value);
        
        if (!id) return showNotification('Please enter payment details', true);
        if (isNaN(amount) || amount < 100) return showNotification('Minimum withdrawal is ₹100', true);
        if (amount > currentUserData.balance) return showNotification('Insufficient balance', true);

        const methodName = selectedMethod === 'upi' ? 'UPI' : 'Bank Transfer';
        
        // We need to import handleWithdrawRequest or expose it
        if (window.app && window.app.handleWithdrawRequest) {
            await window.app.handleWithdrawRequest(amount, selectedMethod, methodName, id);
        } else {
            console.error("handleWithdrawRequest not found in window.app");
        }
    };
};
