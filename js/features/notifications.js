import { getPageHeader, getPageFooter, showNotification } from '../ui/components.js';
import { unreadNotificationsCount, setUnreadNotificationsCount } from '../core/state.js';
import { APP_VERSION } from '../core/constants.js';

class PushNotificationSystem {
    constructor() {
        this.notifications = [];
        this.permission = Notification.permission;
        this.initialize();
    }

    async initialize() {
        const appVersionEl = document.getElementById('app-version');
        if (appVersionEl) appVersionEl.textContent = `v${APP_VERSION}`;

        if (this.permission === 'default') {
            this.requestPermission();
        }
        this.loadNotifications();
    }

    async requestPermission() {
        try {
            this.permission = await Notification.requestPermission();
            if (this.permission === 'granted') {
                showNotification('Notifications enabled!', false);
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    }

    async sendNotification(title, body, data = {}) {
        this.showInAppNotification(title, body, data);

        if (this.permission === 'granted') {
            const notification = new Notification(title, {
                body: body,
                icon: 'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg',
                badge: 'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg',
                data: data,
                tag: data.type || 'general'
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
                this.handleNotificationClick(data);
            };
        }
    }

    showInAppNotification(title, body, data = {}) {
        const notificationId = `notif-${Date.now()}`;
        const container = document.getElementById('push-notification-container');
        if (!container) return;

        const notificationEl = document.createElement('div');
        notificationEl.className = 'push-notification';
        notificationEl.id = notificationId;

        const audio = document.getElementById('notification-sound') || document.getElementById('success-sound');
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log("Notification sound play failed:", e));
        }

        this.updateNotificationCount(1);

        notificationEl.innerHTML = `
            <div class="p-4" onclick="window.closeNotificationById('${notificationId}'); notificationSystem.handleNotificationClick(${JSON.stringify(data).replace(/"/g, '&quot;')})">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mr-3">
                            <svg class="w-5 h-5 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                            </svg>
                        </div>
                        <div>
                            <h4 class="font-semibold text-gray-800 dark:text-gray-200">${title}</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${body}</p>
                        </div>
                    </div>
                    <button onclick="event.stopPropagation(); window.closeNotificationById('${notificationId}')" class="text-gray-400 hover:text-gray-600">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="text-right">
                    <small class="text-xs text-gray-500">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                </div>
            </div>
        `;

        container.appendChild(notificationEl);

        setTimeout(() => {
            this.removeNotification(notificationId);
        }, 8000);

        this.notifications.unshift({
            id: notificationId,
            title,
            body,
            data,
            timestamp: new Date().toISOString(),
            read: false
        });

        if (this.notifications.length > 50) this.notifications.pop();
        this.saveNotifications();
        this.addToNotificationsList({
            title,
            message: body,
            type: data.type || 'general',
            createdAt: { toDate: () => new Date() }
        });
    }

    removeNotification(id) {
        const notification = document.getElementById(id);
        if (notification) {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }

    updateNotificationCount(change) {
        if (change !== 0) {
            setUnreadNotificationsCount(Math.max(0, unreadNotificationsCount + change));
        }
        const badge = document.getElementById('notification-count');
        const bell = document.getElementById('notification-bell');

        if (badge) {
            if (unreadNotificationsCount > 0) {
                badge.textContent = unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount;
                badge.classList.remove('hidden');
                if (bell) bell.classList.add('notification-bell-animate');
            } else {
                badge.classList.add('hidden');
                if (bell) bell.classList.remove('notification-bell-animate');
            }
        }
    }

    handleNotificationClick(data) {
        console.log("Notification clicked:", data);
        setUnreadNotificationsCount(Math.max(0, unreadNotificationsCount - 1));
        this.updateNotificationCount(0);

        if (['fund_received', 'money_sent', 'withdrawal_approved', 'gift_card'].includes(data.type)) {
            if (window.showAllTransactionsPage) window.showAllTransactionsPage();
        } else {
            showFullNotificationPage();
        }
    }

    addToNotificationsList(data) {
        const list = document.getElementById('notifications-list');
        if (!list) return;

        const timeAgo = this.formatTimeAgo(data.createdAt);
        const type = data.type || 'general';

        const notificationItem = document.createElement('div');
        notificationItem.className = 'p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-500 transition-all cursor-pointer';
        notificationItem.onclick = () => this.handleNotificationClick(data);

        let iconBg = 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
        let icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"></path></svg>';

        if (type === 'admin_message') {
            iconBg = 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
            icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" stroke-width="2"></path></svg>';
        } else if (type === 'fund_received' || type === 'gift_card') {
            iconBg = 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
            icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"></path></svg>';
        } else if (type === 'withdrawal_approved') {
            iconBg = 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
            icon = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"></path></svg>';
        }

        notificationItem.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0">
                    ${icon}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="font-bold text-gray-800 dark:text-gray-200 truncate">${data.title || 'Notification'}</h4>
                        <span class="text-[10px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2">${timeAgo}</span>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">${data.message || data.body || ''}</p>
                </div>
            </div>
        `;

        if (list.firstChild) list.insertBefore(notificationItem, list.firstChild);
        else list.appendChild(notificationItem);

        if (list.children.length > 50) list.removeChild(list.lastChild);
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return 'Just now';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    saveNotifications() {
        localStorage.setItem('wallet_notifications', JSON.stringify(this.notifications));
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        setUnreadNotificationsCount(0);
        this.updateNotificationCount(0);
        this.saveNotifications();
    }

    loadNotifications() {
        const saved = localStorage.getItem('wallet_notifications');
        if (saved) {
            try {
                this.notifications = JSON.parse(saved);
                setUnreadNotificationsCount(this.notifications.filter(n => !n.read).length);
                this.updateNotificationCount(0);

                const list = document.getElementById('notifications-list');
                if (list) list.innerHTML = '';
                this.notifications.slice(0, 50).forEach(notif => {
                    this.addToNotificationsList({
                        title: notif.title,
                        message: notif.body,
                        type: notif.data?.type,
                        createdAt: { toDate: () => new Date(notif.timestamp) }
                    });
                });
            } catch (e) {
                console.error('Error loading notifications:', e);
            }
        }
    }
}

export const notificationSystem = new PushNotificationSystem();

export const showFullNotificationPage = () => {
    const list = document.getElementById('notifications-list');
    const notificationsHtml = list ? list.innerHTML : '<div class="text-center py-10 text-gray-500">No notifications yet</div>';

    const content = `
        <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
            ${getPageHeader('Notifications')}
            <div class="flex-1 overflow-y-auto px-4 pb-20">
                <div class="max-w-2xl mx-auto space-y-4 py-4" id="full-notifications-container">
                    ${notificationsHtml}
                </div>
                ${unreadNotificationsCount > 0 ? `
                <div class="max-w-2xl mx-auto mt-6">
                    <button id="mark-all-read-btn" class="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition">
                        Mark All as Read
                    </button>
                </div>` : ''}
            </div>
            ${getPageFooter()}
        </div>
    `;
    if (window.showPage) window.showPage(content);
    
    const markBtn = document.getElementById('mark-all-read-btn');
    if (markBtn) {
        markBtn.onclick = () => {
            notificationSystem.markAllAsRead();
            showFullNotificationPage();
        };
    }
};

window.closeNotificationById = (id) => {
    notificationSystem.removeNotification(id);
};
