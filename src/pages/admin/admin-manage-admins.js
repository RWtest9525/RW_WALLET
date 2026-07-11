// Admin Manage Admins: src/pages/admin/admin-manage-admins.js

const showAdminManageAdminsPage = async () => {
    if (!currentUser) return;
    const content = `
        ${getPageHeader('Manage Admins')}
        <div class="max-w-4xl mx-auto space-y-6 pb-24 px-4">
            <!-- Header Row with Toggle Button -->
            <div class="flex items-center justify-between">
                <h3 class="text-xl font-black text-gray-900 dark:text-white">Existing Sub-Admins</h3>
                <button id="toggle-add-subadmin-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition hover:scale-105 active:scale-95 shadow-md">
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                    Add Sub-Admin
                </button>
            </div>

            <!-- Add Sub-Admin Card (Hidden by default) -->
            <div id="add-subadmin-card" class="hidden bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-4">
                <h3 class="text-base font-extrabold text-gray-900 dark:text-white">Add New Sub-Admin</h3>
                <form id="create-subadmin-form" class="space-y-4">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input type="text" id="subadmin-name" placeholder="Full Name" required class="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold">
                        <input type="email" id="subadmin-email" placeholder="Email" required class="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold">
                        <div class="relative col-span-1">
                            <input type="password" id="subadmin-password" placeholder="Password" required class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold pr-10">
                            <button type="button" id="toggle-subadmin-password-visibility" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 dark:hover:text-gray-300">
                                <svg id="eye-icon-open" class="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                <svg id="eye-icon-closed" class="h-4.5 w-4.5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"></path></svg>
                            </button>
                        </div>
                        <input type="tel" id="subadmin-mobile" placeholder="Mobile (Optional)" class="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold">
                        <input type="text" id="subadmin-refcode" placeholder="Referral Code (e.g. RWADMIN03)" required class="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold">
                    </div>
                    <button type="submit" id="create-subadmin-submit-btn" class="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-sm transition">Create Sub-Admin</button>
                </form>
            </div>

            <!-- List of Sub-Admins -->
            <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div id="sub-admins-list-container" class="space-y-3">
                    <div class="text-center py-8 text-gray-400 text-sm font-semibold">Loading sub-admins...</div>
                </div>
            </div>
        </div>
        ${getPageFooter()}
    `;
    showPage(content, { returnTo: 'admin' });
    setBottomNavActive('bottom-admin-btn');

    // Add form submit listener
    document.getElementById('create-subadmin-form').addEventListener('submit', handleCreateSubAdmin);

    // Toggle button handler
    document.getElementById('toggle-add-subadmin-btn').addEventListener('click', () => {
        const card = document.getElementById('add-subadmin-card');
        const btn = document.getElementById('toggle-add-subadmin-btn');
        if (card.classList.contains('hidden')) {
            card.classList.remove('hidden');
            btn.innerHTML = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg> Close Form`;
            btn.classList.replace('bg-blue-600', 'bg-gray-600');
            btn.classList.replace('hover:bg-blue-700', 'hover:bg-gray-700');
        } else {
            card.classList.add('hidden');
            btn.innerHTML = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg> Add Sub-Admin`;
            btn.classList.replace('bg-gray-600', 'bg-blue-600');
            btn.classList.replace('hover:bg-gray-700', 'hover:bg-blue-700');
        }
    });

    const pwInput = document.getElementById('subadmin-password');
    const togglePwBtn = document.getElementById('toggle-subadmin-password-visibility');
    if (pwInput && togglePwBtn) {
        togglePwBtn.addEventListener('click', () => {
            const isOpen = pwInput.type === 'text';
            pwInput.type = isOpen ? 'password' : 'text';
            document.getElementById('eye-icon-open')?.classList.toggle('hidden', !isOpen);
            document.getElementById('eye-icon-closed')?.classList.toggle('hidden', isOpen);
        });
    }

    await refreshSubAdminsList();
};

const refreshSubAdminsList = async () => {
    const container = document.getElementById('sub-admins-list-container');
    if (!container) return;

    try {
        const q = query(
            collection(db, `artifacts/${appId}/public/data/users`),
            where("role", "==", "admin")
        );
        const snap = await getDocs(q);
        let html = '';
        if (snap.empty) {
            html = '<p class="text-center text-gray-500 py-4">No sub-admins found.</p>';
        } else {
            snap.forEach(docSnap => {
                const adminData = docSnap.data();
                const statusColor = adminData.status === 'suspended' ? 'text-red-500 font-bold' : 'text-green-500 font-bold';
                const suspendAction = adminData.status === 'suspended'
                    ? `<button onclick="window.handleUnsuspendAdmin('${docSnap.id}'); window.closeAllDropdowns();" class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-green-50 dark:hover:bg-green-900/30 text-green-600 rounded-lg transition flex items-center gap-2">
                        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Unsuspend
                       </button>`
                    : `<button onclick="window.handleSuspendAdmin('${docSnap.id}'); window.closeAllDropdowns();" class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-600 rounded-lg transition flex items-center gap-2">
                        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                        Suspend
                       </button>`;

                const pwDisplay = adminData.passwordText
                    ? `<p class="text-xs text-gray-400 mt-0.5">Password: <span class="font-mono text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">${escapeHtml(adminData.passwordText)}</span></p>`
                    : '';

                html += `
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 gap-3">
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-gray-900 dark:text-white">${escapeHtml(adminData.name || 'Admin')}</p>
                            <p class="text-xs text-gray-500">${escapeHtml(adminData.email)} | Code: <strong class="text-blue-600">${escapeHtml(adminData.referralCode || '')}</strong></p>
                            <p class="text-xs">Status: <span class="${statusColor}">${escapeHtml(adminData.status || 'active')}</span></p>
                            ${pwDisplay}
                        </div>
                        <div class="relative shrink-0">
                            <button onclick="window.toggleAdminDropdown('${docSnap.id}')" class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition" title="Actions">
                                <svg class="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="4" r="2"></circle><circle cx="10" cy="10" r="2"></circle><circle cx="10" cy="16" r="2"></circle></svg>
                            </button>
                            <div id="admin-dropdown-${docSnap.id}" class="hidden absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl z-50 py-1.5 space-y-0.5 px-1.5">
                                <button onclick="window.handleImpersonateAdmin('${docSnap.id}', '${escapeHtml(adminData.name || 'Admin')}'); window.closeAllDropdowns();" class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg transition flex items-center gap-2">
                                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                    Switch Account
                                </button>
                                ${suspendAction}
                                <button onclick="window.handleDeleteAdmin('${docSnap.id}'); window.closeAllDropdowns();" class="w-full text-left px-3 py-2 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition flex items-center gap-2">
                                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        container.innerHTML = html;
    } catch (err) {
        console.error("Failed to load sub-admins:", err);
        container.innerHTML = `<p class="text-center text-red-500 py-4">Error: ${err.message}</p>`;
    }
};

// Dropdown toggle helpers
window.toggleAdminDropdown = (uid) => {
    const dropdown = document.getElementById(`admin-dropdown-${uid}`);
    if (!dropdown) return;
    // Close all others first
    document.querySelectorAll('[id^="admin-dropdown-"]').forEach(el => {
        if (el.id !== `admin-dropdown-${uid}`) el.classList.add('hidden');
    });
    dropdown.classList.toggle('hidden');
};
window.closeAllDropdowns = () => {
    document.querySelectorAll('[id^="admin-dropdown-"]').forEach(el => el.classList.add('hidden'));
};
// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('[id^="admin-dropdown-"]') && !e.target.closest('button[onclick*="toggleAdminDropdown"]')) {
        window.closeAllDropdowns();
    }
});

const handleCreateSubAdmin = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('create-subadmin-submit-btn');
    const name = document.getElementById('subadmin-name').value.trim();
    const email = document.getElementById('subadmin-email').value.trim();
    const password = document.getElementById('subadmin-password').value;
    const mobile = document.getElementById('subadmin-mobile').value.trim();
    const referralCode = document.getElementById('subadmin-refcode').value.trim();

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating...'; }
    try {
        const token = await getBackendAuthToken();
        const res = await fetch(`${BACKEND_BASE_URL}/api/admin/create-sub-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, email, password, mobile, referralCode })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to create sub-admin');

        showNotification('Sub-admin created successfully!');
        document.getElementById('create-subadmin-form').reset();
        // Hide form after success
        document.getElementById('add-subadmin-card')?.classList.add('hidden');
        const toggleBtn = document.getElementById('toggle-add-subadmin-btn');
        if (toggleBtn) {
            toggleBtn.innerHTML = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg> Add Sub-Admin`;
            toggleBtn.classList.replace('bg-gray-600', 'bg-blue-600');
            toggleBtn.classList.replace('hover:bg-gray-700', 'hover:bg-blue-700');
        }
        await refreshSubAdminsList();
    } catch (err) {
        showNotification(err.message, true);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Sub-Admin'; }
    }
};

const handleSuspendAdmin = async (targetUid) => {
    if (!confirm('Are you sure you want to suspend this sub-admin?')) return;
    try {
        const token = await getBackendAuthToken();
        const res = await fetch(`${BACKEND_BASE_URL}/api/admin/suspend-sub-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUid })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to suspend sub-admin');
        showNotification('Sub-admin suspended.');
        await refreshSubAdminsList();
    } catch (err) {
        showNotification(err.message, true);
    }
};

const handleUnsuspendAdmin = async (targetUid) => {
    try {
        const token = await getBackendAuthToken();
        const res = await fetch(`${BACKEND_BASE_URL}/api/admin/unsuspend-sub-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUid })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to unsuspend sub-admin');
        showNotification('Sub-admin unsuspended.');
        await refreshSubAdminsList();
    } catch (err) {
        showNotification(err.message, true);
    }
};

const handleDeleteAdmin = async (targetUid) => {
    if (!confirm('Are you sure you want to delete this sub-admin? This action cannot be undone.')) return;
    try {
        const token = await getBackendAuthToken();
        const res = await fetch(`${BACKEND_BASE_URL}/api/admin/delete-sub-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUid })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to delete sub-admin');
        showNotification('Sub-admin deleted.');
        await refreshSubAdminsList();
    } catch (err) {
        showNotification(err.message, true);
    }
};

const handleImpersonateAdmin = async (targetUid, targetName) => {
    if (!confirm(`Switch to account: ${targetName}?`)) return;
    try {
        const token = await getBackendAuthToken();
        const res = await fetch(`${BACKEND_BASE_URL}/api/admin/impersonate-sub-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetUid })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to impersonate sub-admin');

        // Backup owner session
        localStorage.setItem('original_owner_uid', currentUser.uid);
        localStorage.setItem('original_owner_email', currentUser.email);
        localStorage.setItem('original_owner_token', backendAuthToken);

        // Store impersonated sub-admin session
        localStorage.setItem('impersonated_sub_admin_uid', data.uid);
        localStorage.setItem('impersonated_sub_admin_email', data.email);
        localStorage.setItem('impersonated_sub_admin_token', data.token);
        localStorage.setItem('impersonated_sub_admin_data', JSON.stringify({
            name: data.name || targetName,
            email: data.email,
            uid: data.uid,
            role: 'admin'
        }));

        showNotification(`Switching to ${targetName}'s account...`);
        setTimeout(() => window.location.reload(), 500);
    } catch (err) {
        showNotification(err.message, true);
    }
};

// Expose to window
window.showAdminManageAdminsPage = showAdminManageAdminsPage;
window.handleSuspendAdmin = handleSuspendAdmin;
window.handleUnsuspendAdmin = handleUnsuspendAdmin;
window.handleDeleteAdmin = handleDeleteAdmin;
window.handleImpersonateAdmin = handleImpersonateAdmin;
