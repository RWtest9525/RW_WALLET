import { playSuccessSound, playErrorSound } from '../utils/formatters.js';

let notificationTimeout;

export const closeNotification = () => {
    if (notificationTimeout) clearTimeout(notificationTimeout);
    const toast = document.getElementById('notification-toast');
    if (toast) toast.classList.remove('show');
};

// Make it available globally for inline onclick handlers
window.closeNotification = closeNotification;

export const showNotification = (message, isError = false, playSound = true) => {
    const toast = document.getElementById('notification-toast');
    if (!toast) return;

    if (notificationTimeout) clearTimeout(notificationTimeout);

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
            <div class="toast-message">${message}</div>
            <button class="toast-close" onclick="closeNotification()">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
            </button>
            <div class="toast-progress"></div>
        </div>`;

    toast.classList.add('show');

    if (playSound) {
        if (isError) playErrorSound();
        else playSuccessSound();
    }

    notificationTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

export const renderModal = (title, content, actions, size = 'max-w-md', colorfulBorder = false) => {
    const borderClass = colorfulBorder ? 'colorful-border' : '';
    const container = document.getElementById('modal-container');
    if (!container) return;

    container.innerHTML = `
        <div id="app-modal" class="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div class="fixed inset-0 modal-backdrop" onclick="window.closeModal()"></div>
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 w-full ${size} p-6 transform transition-all scale-95 opacity-0 animate-modal-in ${borderClass}">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">${title}</h3>
                    <button onclick="window.closeModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl">&times;</button>
                </div>
                <div>${content}</div>
                <div class="mt-6 flex justify-end space-x-3">${actions}</div>
            </div>
        </div>
        <style> 
            @keyframes animate-modal-in { to { scale: 1; opacity: 1; } } 
            .animate-modal-in { animation: animate-modal-in 0.2s ease-out forwards; } 
        </style>`;
};

window.closeModal = () => {
    const container = document.getElementById('modal-container');
    if (container) container.innerHTML = '';
};

export const getPageHeader = (title) => `
    <header class="page-header-fixed bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800 px-4 py-4 mb-4">
        <div class="flex items-center">
            <button onclick="window.hidePage()" class="mr-4 text-gray-500 hover:text-gray-800 dark:hover:text-white transition">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
            </button>
            <h2 class="text-xl font-bold">${title}</h2>
        </div>
    </header>
`;

export const getPageFooter = () => `</div>`;
