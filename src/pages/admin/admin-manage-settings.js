// Admin Manage Settings: src/pages/admin/admin-manage-settings.js

const showAdminManageSettingsPage = async () => {
    if (!currentUser) return;
    await loadWithdrawalSettingsOnce(true);

    const isOwner = currentUser?.uid === ADMIN_UID || currentUser?.email === 'reviewsworld01@gmail.com' || currentUserData?.role === 'owner';
    const referralReward = getReferralRewardAmount ? getReferralRewardAmount() : (appConfigCache.referralRewardAmount || 0);

    const mEnabled = appConfigCache.maintenanceEnabled || false;
    const mMessage = appConfigCache.maintenanceMessage || 'We are improving your wallet experience. Please wait...';
    const mEndsAt = appConfigCache.maintenanceEndsAt ? toDate(appConfigCache.maintenanceEndsAt) : null;
    const mTimeLeft = mEndsAt ? Math.max(0, Math.floor((mEndsAt.getTime() - Date.now()) / 1000)) : 0;
    const mHours = Math.floor(mTimeLeft / 3600);
    const mMinutes = Math.floor((mTimeLeft % 3600) / 60);
    const mSeconds = mTimeLeft % 60;
    const mDurationVal = mEnabled && mTimeLeft > 0 ? `${String(mHours).padStart(2, '0')}:${String(mMinutes).padStart(2, '0')}:${String(mSeconds).padStart(2, '0')}` : '01:00:00';

    const wnEnabled = appConfigCache.whatsNewEnabled !== false && appConfigCache.whats_new_enabled !== false;
    const wnTitle = appConfigCache.whatsNewTitle || appConfigCache.whats_new_title || "What's New";
    const wnMessage = appConfigCache.whatsNewMessage || appConfigCache.whats_new_message || '';
    const wnUpdatedMillis = timestampToMillis(appConfigCache.whatsNewUpdatedAt || appConfigCache.whats_new_updated_at || 0);
    const wnUpdatedText = wnUpdatedMillis ? new Date(wnUpdatedMillis).toLocaleString('en-IN') : 'Not sent yet';

    const content = `
        ${getPageHeader('Manage Settings')}
        <div class="max-w-4xl mx-auto space-y-6">
            <!-- Tabs Navigation -->
            <div class="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm">
                <button id="tab-rates-btn" class="flex-1 py-3 text-sm font-bold text-center text-blue-600 border-b-2 border-blue-600 transition animate-fade-in" onclick="switchSettingsTab('rates')">Rate Settings</button>
                <button id="tab-maintenance-btn" class="flex-1 py-3 text-sm font-bold text-center text-gray-500 hover:text-blue-600 transition" onclick="switchSettingsTab('maintenance')">Maintenance Mode</button>
                <button id="tab-whatsnew-btn" class="flex-1 py-3 text-sm font-bold text-center text-gray-500 hover:text-blue-600 transition" onclick="switchSettingsTab('whatsnew')">What's New</button>
            </div>

            <!-- Tab 1: Rate Settings -->
            <div id="settings-rates-section" class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-4">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-bold">Rate Settings</h3>
                    <span class="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Editable</span>
                </div>
                <p class="text-sm text-gray-500">Configure withdrawal limits and referral reward rates for users.</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Referral Reward Amount (₹)</label>
                        <input type="number" id="setting-referral-reward" value="${referralReward}" min="0" step="1" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Min. Withdrawal UPI (₹)</label>
                        <input type="number" id="setting-min-upi" value="${minWithdrawalUpi}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Min. Withdrawal Bank (₹)</label>
                        <input type="number" id="setting-min-bank" value="${minWithdrawalBank}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Min. Withdrawal Gift Cards (₹)</label>
                        <input type="number" id="setting-min-redeem" value="${minWithdrawalRedeem}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Max. Withdrawal Per Day (Total ₹)</label>
                        <input type="number" id="setting-max-day" value="${maxWithdrawalPerDay}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Max. Pending Requests Per User</label>
                        <input type="number" id="setting-max-pending" value="${maxPendingWithdrawalsPerUser}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    </div>
                </div>
                <button onclick="handleSaveRatesSettingsTab()" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition">Save Rates Settings</button>
            </div>

            <!-- Tab 2: Maintenance Settings -->
            <div id="settings-maintenance-section" class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-4 hidden animate-fade-in">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-bold">Maintenance Mode</h3>
                    ${isOwner
                        ? `<span class="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Editable</span>`
                        : `<span class="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">Read-Only</span>`
                    }
                </div>
                <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-2">
                    <p class="text-sm">Status: <strong class="${mEnabled ? 'text-amber-600' : 'text-green-600'}">${mEnabled ? 'Maintenance Active' : 'Online'}</strong></p>
                    ${mEnabled ? `<p class="text-xs text-gray-500">Scheduled to end at: ${mEndsAt ? mEndsAt.toLocaleString('en-IN') : 'N/A'}</p>` : ''}
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Maintenance Duration (HH:MM:SS)</label>
                        <input type="text" id="maintenance-duration-input" value="${mDurationVal}" ${!isOwner ? 'disabled' : ''} class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Maintenance Message</label>
                        <textarea id="maintenance-message-input" rows="3" ${!isOwner ? 'disabled' : ''} class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50">${escapeHtml(mMessage)}</textarea>
                    </div>
                </div>

                ${isOwner ? `
                    <div class="flex gap-3">
                        <button onclick="handleStartMaintenanceTab()" class="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition">Start Maintenance</button>
                        ${mEnabled ? `<button onclick="handleTurnOffMaintenanceTab()" class="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition">Turn Off</button>` : ''}
                    </div>
                ` : `<p class="text-xs text-red-500 italic">You must be the main Owner to edit maintenance configuration.</p>`}
            </div>

            <!-- Tab 3: What's New Settings -->
            <div id="settings-whatsnew-section" class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-4 hidden animate-fade-in">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-bold">What's New popup</h3>
                    ${isOwner
                        ? `<span class="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Editable</span>`
                        : `<span class="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">Read-Only</span>`
                    }
                </div>
                <p class="text-xs text-gray-500 font-bold">Last update sent on: ${escapeHtml(wnUpdatedText)}</p>
                
                <div class="space-y-4">
                    <label class="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-black dark:bg-gray-700">
                        <span>Show popup to users</span>
                        <input id="whats-new-enabled-input" type="checkbox" ${wnEnabled ? 'checked' : ''} ${!isOwner ? 'disabled' : ''} class="h-5 w-5 accent-indigo-600 disabled:opacity-50">
                    </label>
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Popup Title</label>
                        <input type="text" id="whats-new-title-input" value="${escapeHtml(wnTitle)}" ${!isOwner ? 'disabled' : ''} class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50 font-bold">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Popup Message</label>
                        <textarea id="whats-new-message-input" rows="4" placeholder="Type what is new..." ${!isOwner ? 'disabled' : ''} class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50">${escapeHtml(wnMessage)}</textarea>
                    </div>
                </div>

                ${isOwner ? `
                    <div class="flex gap-3">
                        <button onclick="handleSaveWhatsNewTab()" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition">Save & Show</button>
                        ${wnEnabled ? `<button onclick="handleDisableWhatsNewTab()" class="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition">Turn Off Popup</button>` : ''}
                    </div>
                ` : `<p class="text-xs text-red-500 italic">You must be the main Owner to edit What's New messages.</p>`}
            </div>
        </div>
        ${getPageFooter()}
    `;
    showPage(content, { returnTo: 'admin' });
    setBottomNavActive('bottom-admin-btn');
};

const switchSettingsTab = (tab) => {
    const tabs = ['rates', 'maintenance', 'whatsnew'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}-btn`);
        const sec = document.getElementById(`settings-${t}-section`);
        if (t === tab) {
            btn?.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            btn?.classList.remove('text-gray-500');
            sec?.classList.remove('hidden');
        } else {
            btn?.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            btn?.classList.add('text-gray-500');
            sec?.classList.add('hidden');
        }
    });
};

const handleSaveRatesSettingsTab = async () => {
    const referralReward = parseInt(document.getElementById('setting-referral-reward')?.value || '0');
    const minUpi = parseInt(document.getElementById('setting-min-upi').value);
    const minBank = parseInt(document.getElementById('setting-min-bank').value);
    const minRedeem = parseInt(document.getElementById('setting-min-redeem').value);
    const maxDay = parseInt(document.getElementById('setting-max-day').value);
    const maxPending = parseInt(document.getElementById('setting-max-pending').value);

    if (isNaN(referralReward) || referralReward < 0 || isNaN(minUpi) || isNaN(minBank) || isNaN(minRedeem) || isNaN(maxDay) || isNaN(maxPending)) {
        return showNotification('Please enter valid numbers for all settings.', true);
    }

    try {
        const configRef = doc(db, `artifacts/${appId}/settings`, 'app_config');
        const updatedConfig = {
            referralRewardAmount: referralReward,
            referralRewardUpdatedAt: serverTimestamp(),
            referralRewardUpdatedBy: currentUser.uid,
            min_withdrawal_upi: minUpi,
            min_withdrawal_bank: minBank,
            min_withdrawal_redeem: minRedeem,
            min_withdrawal_amount: Math.min(minUpi, minBank, minRedeem),
            max_withdrawal_per_day: maxDay,
            max_pending_withdrawals: maxPending,
            updatedAt: serverTimestamp()
        };
        await setDoc(configRef, updatedConfig, { merge: true });

        // Update local limits
        minWithdrawalUpi = minUpi;
        minWithdrawalBank = minBank;
        minWithdrawalRedeem = minRedeem;
        maxWithdrawalPerDay = maxDay;
        maxPendingWithdrawalsPerUser = maxPending;
        minWithdrawalAmount = Math.min(minUpi, minBank, minRedeem);

        showNotification('Rate settings saved successfully!');
    } catch (e) {
        showNotification(`Error: ${e.message}`, true);
    }
};

const handleStartMaintenanceTab = async () => {
    const durationSeconds = parseMaintenanceDurationInput(document.getElementById('maintenance-duration-input')?.value || '');
    const message = String(document.getElementById('maintenance-message-input')?.value || '').trim()
        || 'We are improving your wallet experience. Please wait...';
    if (!durationSeconds) {
        return showNotification('Please enter duration as HH:MM:SS.', true);
    }
    try {
        const endDate = new Date(Date.now() + durationSeconds * 1000);
        await setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
            maintenanceEnabled: true,
            maintenanceEndsAt: Timestamp.fromDate(endDate),
            maintenanceDurationSeconds: durationSeconds,
            maintenanceMessage: message,
            maintenanceUpdatedAt: serverTimestamp(),
            maintenanceUpdatedBy: currentUser.uid
        }, { merge: true });

        appConfigCache = {
            ...appConfigCache,
            maintenanceEnabled: true,
            maintenanceEndsAt: Timestamp.fromDate(endDate),
            maintenanceEndsAtMillis: endDate.getTime(),
            maintenanceDurationSeconds: durationSeconds,
            maintenanceMessage: message
        };
        rememberAppConfig(appConfigCache);
        applyMaintenanceMode();
        showNotification('Maintenance mode activated.');
        await showAdminManageSettingsPage();
        switchSettingsTab('maintenance');
    } catch (error) {
        showNotification(error.message, true);
    }
};

const handleTurnOffMaintenanceTab = async () => {
    try {
        await setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
            maintenanceEnabled: false,
            maintenanceEndsAt: deleteField(),
            maintenanceMessage: deleteField(),
            maintenanceUpdatedAt: serverTimestamp(),
            maintenanceUpdatedBy: currentUser.uid
        }, { merge: true });

        appConfigCache = {
            ...appConfigCache,
            maintenanceEnabled: false,
            maintenanceEndsAt: null,
            maintenanceEndsAtMillis: 0,
            maintenanceMessage: ''
        };
        rememberAppConfig(appConfigCache);
        applyMaintenanceMode();
        showNotification('Maintenance mode turned off.');
        await showAdminManageSettingsPage();
        switchSettingsTab('maintenance');
    } catch (error) {
        showNotification(error.message, true);
    }
};

const handleSaveWhatsNewTab = async () => {
    const title = String(document.getElementById('whats-new-title-input')?.value || '').trim() || "What's New";
    const message = String(document.getElementById('whats-new-message-input')?.value || '').trim();
    const enabled = !!document.getElementById('whats-new-enabled-input')?.checked;
    if (!message) return showNotification('Please enter a message.', true);
    const whatsNewId = `wn-${Date.now()}`;
    try {
        await setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
            whatsNewEnabled: enabled,
            whatsNewTitle: title,
            whatsNewMessage: message,
            whatsNewId,
            whatsNewUpdatedAt: serverTimestamp(),
            whatsNewUpdatedBy: currentUser.uid
        }, { merge: true });
        appConfigCache = {
            ...appConfigCache,
            whatsNewEnabled: enabled,
            whatsNewTitle: title,
            whatsNewMessage: message,
            whatsNewId,
            whatsNewUpdatedAt: Date.now()
        };
        showNotification(enabled ? "What's New saved & popup activated." : "What's New saved but turned off.");
        await showAdminManageSettingsPage();
        switchSettingsTab('whatsnew');
    } catch (error) {
        showNotification(error.message, true);
    }
};

const handleDisableWhatsNewTab = async () => {
    try {
        await setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
            whatsNewEnabled: false,
            whatsNewUpdatedAt: serverTimestamp(),
            whatsNewUpdatedBy: currentUser.uid
        }, { merge: true });
        appConfigCache = {
            ...appConfigCache,
            whatsNewEnabled: false,
            whatsNewUpdatedAt: Date.now()
        };
        showNotification("What's New popup disabled.");
        await showAdminManageSettingsPage();
        switchSettingsTab('whatsnew');
    } catch (error) {
        showNotification(error.message, true);
    }
};

// Expose to window
window.showAdminManageSettingsPage = showAdminManageSettingsPage;
window.switchSettingsTab = switchSettingsTab;
window.handleSaveRatesSettingsTab = handleSaveRatesSettingsTab;
window.handleStartMaintenanceTab = handleStartMaintenanceTab;
window.handleTurnOffMaintenanceTab = handleTurnOffMaintenanceTab;
window.handleSaveWhatsNewTab = handleSaveWhatsNewTab;
window.handleDisableWhatsNewTab = handleDisableWhatsNewTab;
