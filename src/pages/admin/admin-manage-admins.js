// Admin Manage Admins: src/pages/admin/admin-manage-admins.js

const showAdminManageAdminsPage = async () => {
    if (!currentUser) return;
    const content = `
        ${getPageHeader('Manage Admins')}
        <div class="max-w-4xl mx-auto space-y-6">
            <!-- Add Sub-Admin Card -->
            <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
                <h3 class="text-lg font-bold mb-4">Add New Sub-Admin</h3>
                <form id="create-subadmin-form" class="space-y-4">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input type="text" id="subadmin-name" placeholder="Full Name" required class="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none">
                        <input type="email" id="subadmin-email" placeholder="Email" required class="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none">
                        <input type="password" id="subadmin-password" placeholder="Password" required class="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none">
                        <input type="tel" id="subadmin-mobile" placeholder="Mobile (Optional)" class="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none">
                        <input type="text" id="subadmin-refcode" placeholder="Referral Code (e.g. RWADMIN03)" required class="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none">
                    </div>
                    <button type="submit" class="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition">Create Sub-Admin</button>
                </form>
            </div>

            <!-- List of Sub-Admins -->
            <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
                <h3 class="text-lg font-bold mb-4">Existing Sub-Admins</h3>
                <div id="sub-admins-list-container" class="space-y-3">
                    <div class="text-center py-4 text-gray-500">Loading sub-admins...</div>
                </div>
            </div>
        </div>
        ${getPageFooter()}
    `;
    showPage(content, { returnTo: 'admin' });
    setBottomNavActive('bottom-admin-btn');

    document.getElementById('create-subadmin-form').addEventListener('submit', handleCreateSubAdmin);
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
                const actionButton = adminData.status === 'suspended'
                    ? `<button onclick="window.handleUnsuspendAdmin('${docSnap.id}')" class="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition">Unsuspend</button>`
                    : `<button onclick="window.handleSuspendAdmin('${docSnap.id}')" class="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 transition">Suspend</button>`;

                html += `
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 gap-3">
                        <div>
                            <p class="font-bold text-gray-900 dark:text-white">${escapeHtml(adminData.name || 'Admin')}</p>
                            <p class="text-xs text-gray-500">${escapeHtml(adminData.email)} | Code: <strong class="text-blue-600">${escapeHtml(adminData.referralCode || '')}</strong></p>
                            <p class="text-xs">Status: <span class="${statusColor}">${escapeHtml(adminData.status || 'active')}</span></p>
                        </div>
                        <div class="flex gap-2 shrink-0">
                            ${actionButton}
                            <button onclick="window.handleDeleteAdmin('${docSnap.id}')" class="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition">Delete</button>
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

const handleCreateSubAdmin = async (e) => {
    e.preventDefault();
    const name = document.getElementById('subadmin-name').value.trim();
    const email = document.getElementById('subadmin-email').value.trim();
    const password = document.getElementById('subadmin-password').value;
    const mobile = document.getElementById('subadmin-mobile').value.trim();
    const referralCode = document.getElementById('subadmin-refcode').value.trim();

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
        await refreshSubAdminsList();
    } catch (err) {
        showNotification(err.message, true);
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

// Expose to window
window.showAdminManageAdminsPage = showAdminManageAdminsPage;
window.handleSuspendAdmin = handleSuspendAdmin;
window.handleUnsuspendAdmin = handleUnsuspendAdmin;
window.handleDeleteAdmin = handleDeleteAdmin;
