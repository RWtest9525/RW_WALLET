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
                    <!-- Withdrawal form logic... -->
                </div>
            </div>
            ${getPageFooter()}
        </div>
    `;
    showPage(content);
};
