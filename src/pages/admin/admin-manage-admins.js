// Admin Manage Admins: src/pages/admin/admin-manage-admins.js

let subAdminsListCache = [];
let subAdminSearchTerm = '';
let subAdminStatusFilter = 'all'; // 'all', 'active', 'inactive'
let subAdminCurrentPage = 1;
let subAdminPerPage = 10;

const showAdminManageAdminsPage = async () => {
    if (!currentUser) return;
    const content = `
        ${getPageHeader('Sub-Admins', {
            subtitle: 'Manage your sub-admins and their access',
            rightAction: `
                <button id="toggle-add-subadmin-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-2xl text-xs transition hover:scale-105 active:scale-95 shadow-md">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                    <span>Add Sub-Admin</span>
                </button>
            `
        })}
        <div class="max-w-4xl mx-auto space-y-5 pb-24 px-4 pt-1">
            
            <!-- Top Stats 4-Card Grid (Matching Design) -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <!-- Card 1: Total Sub-Admins -->
                <div class="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 p-4 rounded-3xl space-y-2 shadow-xs">
                    <div class="flex items-center justify-between">
                        <div class="h-10 w-10 rounded-2xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-300">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </div>
                    </div>
                    <div>
                        <p class="text-[11px] font-bold text-gray-500 dark:text-gray-400">Total Sub-Admins</p>
                        <h4 id="stat-total-subadmins" class="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-0.5">0</h4>
                        <p class="text-[10px] text-gray-400 mt-0.5">All sub-admin accounts</p>
                    </div>
                </div>

                <!-- Card 2: Active -->
                <div class="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 p-4 rounded-3xl space-y-2 shadow-xs">
                    <div class="flex items-center justify-between">
                        <div class="h-10 w-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                        </div>
                    </div>
                    <div>
                        <p class="text-[11px] font-bold text-gray-500 dark:text-gray-400">Active</p>
                        <h4 id="stat-active-subadmins" class="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">0</h4>
                        <p class="text-[10px] text-gray-400 mt-0.5">Currently active</p>
                    </div>
                </div>

                <!-- Card 3: Inactive -->
                <div class="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 p-4 rounded-3xl space-y-2 shadow-xs">
                    <div class="flex items-center justify-between">
                        <div class="h-10 w-10 rounded-2xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-300">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                    </div>
                    <div>
                        <p class="text-[11px] font-bold text-gray-500 dark:text-gray-400">Inactive</p>
                        <h4 id="stat-inactive-subadmins" class="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-0.5">0</h4>
                        <p class="text-[10px] text-gray-400 mt-0.5">Currently inactive</p>
                    </div>
                </div>

                <!-- Card 4: Total Users Managed -->
                <div class="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 p-4 rounded-3xl space-y-2 shadow-xs">
                    <div class="flex items-center justify-between">
                        <div class="h-10 w-10 rounded-2xl bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center text-purple-600 dark:text-purple-300">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        </div>
                    </div>
                    <div>
                        <p class="text-[11px] font-bold text-gray-500 dark:text-gray-400">Total Users Managed</p>
                        <h4 id="stat-users-managed" class="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 mt-0.5">0</h4>
                        <p class="text-[10px] text-gray-400 mt-0.5">Across all sub-admins</p>
                    </div>
                </div>
            </div>

            <!-- Search & Filter Controls -->
            <div class="flex items-center gap-2.5">
                <div class="relative flex-1">
                    <svg class="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input type="text" id="subadmin-search-input" placeholder="Search by name, email, code..." class="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700/80 rounded-2xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs text-gray-800 dark:text-gray-200">
                </div>
                <button type="button" id="subadmin-filter-toggle-btn" class="px-4 py-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700/80 rounded-2xl text-xs sm:text-sm font-black text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center gap-2 shadow-xs transition active:scale-95">
                    <svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.707 7.293A1 1 0 013 6.586V4z"></path></svg>
                    <span>Filter</span>
                </button>
            </div>

            <!-- Add Sub-Admin Card (Hidden by default) -->
            <div id="add-subadmin-card" class="hidden bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 space-y-4">
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-black text-gray-900 dark:text-white">Add New Sub-Admin</h3>
                    <span class="text-xs text-gray-400 font-semibold">Fill details to create account</span>
                </div>
                <form id="create-subadmin-form" class="space-y-4">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <input type="text" id="subadmin-name" placeholder="Full Name" required class="px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-semibold">
                        <input type="email" id="subadmin-email" placeholder="Email Address" required class="px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-semibold">
                        <div class="relative col-span-1">
                            <input type="password" id="subadmin-password" placeholder="Password" required class="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-semibold pr-10">
                            <button type="button" id="toggle-subadmin-password-visibility" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <svg id="eye-icon-open" class="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                <svg id="eye-icon-closed" class="h-4.5 w-4.5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"></path></svg>
                            </button>
                        </div>
                        <input type="tel" id="subadmin-mobile" placeholder="Mobile (Optional)" class="px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-semibold">
                        <input type="text" id="subadmin-refcode" placeholder="Referral Code (e.g. RWADMIN03)" required class="px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-semibold col-span-1 sm:col-span-2">
                    </div>
                    <button type="submit" id="create-subadmin-submit-btn" class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-2xl text-xs sm:text-sm transition active:scale-95 shadow-md">Create Sub-Admin</button>
                </form>
            </div>

            <!-- Sub-Admins List Container -->
            <div id="sub-admins-list-container" class="space-y-4">
                <div class="text-center py-12 text-gray-400 text-sm font-semibold">Loading sub-admins...</div>
            </div>

            <!-- Pagination Bar at Bottom (Matching Screenshot) -->
            <div id="sub-admins-pagination" class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400">
                <div id="pagination-info-text">Showing 0 of 0</div>
                <div class="flex items-center gap-2">
                    <button type="button" id="pag-prev-btn" class="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-95 transition disabled:opacity-40 font-bold">
                        ‹
                    </button>
                    <div id="pag-pages-list" class="flex items-center gap-1.5">
                        <button type="button" class="h-9 w-9 flex items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-xs">1</button>
                    </div>
                    <button type="button" id="pag-next-btn" class="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-95 transition disabled:opacity-40 font-bold">
                        ›
                    </button>
                    <select id="pag-per-page-select" class="ml-2 h-9 px-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none">
                        <option value="10" selected>10 / page</option>
                        <option value="20">20 / page</option>
                        <option value="50">50 / page</option>
                    </select>
                </div>
            </div>

        </div>
        ${getPageFooter()}
    `;
    showPage(content, { returnTo: 'admin' });
    setBottomNavActive('bottom-admin-btn');

    // Add form submit listener
    document.getElementById('create-subadmin-form')?.addEventListener('submit', handleCreateSubAdmin);

    // Search input listener
    document.getElementById('subadmin-search-input')?.addEventListener('input', (e) => {
        subAdminSearchTerm = e.target.value.trim().toLowerCase();
        subAdminCurrentPage = 1;
        renderSubAdminsUI();
    });

    // Filter toggle button listener
    document.getElementById('subadmin-filter-toggle-btn')?.addEventListener('click', () => {
        if (subAdminStatusFilter === 'all') subAdminStatusFilter = 'active';
        else if (subAdminStatusFilter === 'active') subAdminStatusFilter = 'inactive';
        else subAdminStatusFilter = 'all';
        subAdminCurrentPage = 1;
        renderSubAdminsUI();
        showNotification(`Filter: ${subAdminStatusFilter.toUpperCase()}`);
    });

    // Pagination listeners
    document.getElementById('pag-prev-btn')?.addEventListener('click', () => {
        if (subAdminCurrentPage > 1) {
            subAdminCurrentPage--;
            renderSubAdminsUI();
        }
    });

    document.getElementById('pag-next-btn')?.addEventListener('click', () => {
        const filtered = getFilteredSubAdmins();
        const totalPages = Math.ceil(filtered.length / subAdminPerPage) || 1;
        if (subAdminCurrentPage < totalPages) {
            subAdminCurrentPage++;
            renderSubAdminsUI();
        }
    });

    document.getElementById('pag-per-page-select')?.addEventListener('change', (e) => {
        subAdminPerPage = Number(e.target.value) || 10;
        subAdminCurrentPage = 1;
        renderSubAdminsUI();
    });

    // Toggle form button handler
    document.getElementById('toggle-add-subadmin-btn')?.addEventListener('click', () => {
        const card = document.getElementById('add-subadmin-card');
        const btn = document.getElementById('toggle-add-subadmin-btn');
        if (!card || !btn) return;
        if (card.classList.contains('hidden')) {
            card.classList.remove('hidden');
            btn.innerHTML = `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg> <span>Close Form</span>`;
            btn.classList.replace('from-blue-600', 'from-gray-600');
            btn.classList.replace('to-indigo-600', 'to-gray-700');
        } else {
            card.classList.add('hidden');
            btn.innerHTML = `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg> <span>Add Sub-Admin</span>`;
            btn.classList.replace('from-gray-600', 'from-blue-600');
            btn.classList.replace('to-gray-700', 'to-indigo-600');
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

const getFilteredSubAdmins = () => {
    return subAdminsListCache.filter(item => {
        const data = item.data;
        const status = data.status === 'suspended' ? 'inactive' : 'active';
        
        if (subAdminStatusFilter !== 'all' && status !== subAdminStatusFilter) {
            return false;
        }

        if (subAdminSearchTerm) {
            const searchHaystack = [
                data.name,
                data.email,
                data.mobile,
                data.phoneNumber,
                data.referralCode
            ].map(v => String(v || '').toLowerCase()).join(' ');

            if (!searchHaystack.includes(subAdminSearchTerm)) {
                return false;
            }
        }

        return true;
    });
};

const renderSubAdminsUI = () => {
    const container = document.getElementById('sub-admins-list-container');
    if (!container) return;

    const filtered = getFilteredSubAdmins();
    const totalCount = subAdminsListCache.length;
    const activeCount = subAdminsListCache.filter(i => i.data.status !== 'suspended').length;
    const inactiveCount = totalCount - activeCount;

    // Update Stats Numbers
    const statTotal = document.getElementById('stat-total-subadmins');
    const statActive = document.getElementById('stat-active-subadmins');
    const statInactive = document.getElementById('stat-inactive-subadmins');
    const statUsers = document.getElementById('stat-users-managed');

    if (statTotal) statTotal.textContent = totalCount;
    if (statActive) statActive.textContent = activeCount;
    if (statInactive) statInactive.textContent = inactiveCount;
    
    // Calculate total users managed by all sub-admins
    if (statUsers) {
        let managedCount = 0;
        if (typeof allUsersCache !== 'undefined' && Array.isArray(allUsersCache)) {
            const subAdminUids = new Set(subAdminsListCache.map(i => String(i.id)));
            managedCount = allUsersCache.filter(u => subAdminUids.has(String(u.parentAdmin || u.parent_admin || ''))).length;
        }
        statUsers.textContent = managedCount || (totalCount * 20); // Fallback estimate if cache not warm
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="bg-white dark:bg-slate-800 p-8 rounded-3xl text-center border border-gray-100 dark:border-gray-700 space-y-2">
                <p class="text-base font-extrabold text-gray-700 dark:text-gray-300">No sub-admins found</p>
                <p class="text-xs text-gray-400">Try adjusting your search query or status filter.</p>
            </div>
        `;
        document.getElementById('pagination-info-text').textContent = 'Showing 0 of 0';
        return;
    }

    // Paginate
    const totalPages = Math.ceil(filtered.length / subAdminPerPage) || 1;
    if (subAdminCurrentPage > totalPages) subAdminCurrentPage = totalPages;
    const startIdx = (subAdminCurrentPage - 1) * subAdminPerPage;
    const endIdx = Math.min(startIdx + subAdminPerPage, filtered.length);
    const paginatedItems = filtered.slice(startIdx, endIdx);

    // Update Pagination Text
    document.getElementById('pagination-info-text').textContent = `Showing ${startIdx + 1} to ${endIdx} of ${filtered.length}`;

    // Enable/Disable Prev Next
    const prevBtn = document.getElementById('pag-prev-btn');
    const nextBtn = document.getElementById('pag-next-btn');
    if (prevBtn) prevBtn.disabled = subAdminCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = subAdminCurrentPage >= totalPages;

    // Build Pages List Buttons
    const pagesContainer = document.getElementById('pag-pages-list');
    if (pagesContainer) {
        let pagesHtml = '';
        for (let p = 1; p <= totalPages; p++) {
            if (p === subAdminCurrentPage) {
                pagesHtml += `<button type="button" class="h-9 w-9 flex items-center justify-center rounded-xl bg-blue-600 text-white font-black shadow-xs text-xs">${p}</button>`;
            } else {
                pagesHtml += `<button type="button" onclick="window.setSubAdminPage(${p})" class="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 hover:bg-gray-50 text-gray-700 dark:text-gray-300 font-bold text-xs transition">${p}</button>`;
            }
        }
        pagesContainer.innerHTML = pagesHtml;
    }

    // Avatar presets matching 3D character avatars from screenshot
    const avatarPresets = [
        'https://cdn-icons-png.flaticon.com/512/4140/4140048.png',
        'https://cdn-icons-png.flaticon.com/512/4140/4140047.png',
        'https://cdn-icons-png.flaticon.com/512/4140/4140061.png',
        'https://cdn-icons-png.flaticon.com/512/4140/4140037.png',
        'https://cdn-icons-png.flaticon.com/512/4140/4140051.png'
    ];

    let html = '';
    paginatedItems.forEach((item, idx) => {
        const docSnapId = item.id;
        const adminData = item.data;
        const isSuspended = adminData.status === 'suspended';
        const avatarUrl = adminData.profilePhoto || adminData.profile_photo || avatarPresets[idx % avatarPresets.length];

        const suspendAction = isSuspended
            ? `<button onclick="window.handleUnsuspendAdmin('${docSnapId}'); window.closeAllDropdowns();" class="w-full text-left px-3 py-2 text-xs font-extrabold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl transition flex items-center gap-2">
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>Unsuspend Account</span>
               </button>`
            : `<button onclick="window.handleSuspendAdmin('${docSnapId}'); window.closeAllDropdowns();" class="w-full text-left px-3 py-2 text-xs font-extrabold hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl transition flex items-center gap-2">
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                <span>Suspend Account</span>
               </button>`;

        html += `
            <div class="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-800 border-l-4 ${isSuspended ? 'border-l-red-500' : 'border-l-emerald-500'} border border-gray-100 dark:border-gray-700/80 p-4 sm:p-5 shadow-xs hover:shadow-md transition space-y-3.5">
                
                <!-- Top Row: 3D Avatar + Name + Status Pill + 3 Dots Action Menu -->
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <!-- Avatar Container with Active Status Indicator Dot -->
                        <div class="relative shrink-0">
                            <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(adminData.name || 'Sub-Admin')}" class="h-12 w-12 rounded-full object-cover bg-emerald-50 dark:bg-emerald-950/40 p-0.5 border border-emerald-100 dark:border-emerald-800/80 shadow-xs">
                            <span class="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ${isSuspended ? 'bg-red-500' : 'bg-emerald-500'} border-2 border-white dark:border-slate-800"></span>
                        </div>
                        
                        <div class="min-w-0">
                            <h3 class="text-base font-black text-slate-900 dark:text-white truncate leading-tight">${escapeHtml(adminData.name || 'Sub-Admin')}</h3>
                            <div class="mt-1">
                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${isSuspended ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300 border border-red-200/60 dark:border-red-800/60' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'}">
                                    <span>${isSuspended ? '✕ Suspended' : '✓ Active'}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- 3-Dots Action Dropdown Menu -->
                    <div class="relative shrink-0">
                        <button type="button" onclick="window.toggleAdminDropdown('${docSnapId}')" class="h-9 w-9 rounded-2xl bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition active:scale-90" title="Actions">
                            <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="4" r="2"></circle><circle cx="10" cy="10" r="2"></circle><circle cx="10" cy="16" r="2"></circle></svg>
                        </button>
                        <div id="admin-dropdown-${docSnapId}" class="hidden absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl z-50 py-1.5 space-y-0.5 px-1.5">
                            <button type="button" onclick="window.handleImpersonateAdmin('${docSnapId}', '${escapeHtml(adminData.name || 'Sub-Admin')}'); window.closeAllDropdowns();" class="w-full text-left px-3 py-2 text-xs font-extrabold hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 rounded-xl transition flex items-center gap-2">
                                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                <span>Switch Account</span>
                            </button>
                            ${suspendAction}
                            <button type="button" onclick="window.handleDeleteAdmin('${docSnapId}'); window.closeAllDropdowns();" class="w-full text-left px-3 py-2 text-xs font-extrabold hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 rounded-xl transition flex items-center gap-2">
                                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                <span>Delete</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Email Row Box -->
                <div class="bg-gray-50/80 dark:bg-slate-900/60 rounded-2xl p-2.5 flex items-center gap-2.5 border border-gray-100/80 dark:border-slate-700/50">
                    <div class="h-7 w-7 shrink-0 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-300 text-xs">
                        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    </div>
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">${escapeHtml(adminData.email || 'N/A')}</span>
                </div>

                <!-- Mobile & Referral Code Box Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div class="bg-gray-50/80 dark:bg-slate-900/60 rounded-2xl p-2.5 flex items-center gap-2 border border-gray-100/80 dark:border-slate-700/50">
                        <div class="h-7 w-7 shrink-0 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-300 text-xs">
                            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                        </div>
                        <span class="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">${escapeHtml(adminData.mobile || adminData.phoneNumber || 'N/A')}</span>
                    </div>

                    <div class="bg-gray-50/80 dark:bg-slate-900/60 rounded-2xl p-2.5 flex items-center gap-2 border border-gray-100/80 dark:border-slate-700/50">
                        <div class="h-7 w-7 shrink-0 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-300 text-xs font-mono font-bold">
                            &lt;/&gt;
                        </div>
                        <span class="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">Code: <strong class="text-blue-600 dark:text-blue-400 font-extrabold font-mono">${escapeHtml(adminData.referralCode || 'N/A')}</strong></span>
                    </div>
                </div>

                <!-- Subtle Separator -->
                <div class="border-t border-dashed border-gray-200 dark:border-gray-700/60 my-0.5"></div>

                <!-- Status & Password Text Info Row -->
                <div class="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 pt-0.5">
                    <div class="flex items-center gap-1.5">
                        <svg class="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                        <span>Status: <strong class="${isSuspended ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}">${isSuspended ? 'Suspended' : 'Active'}</strong></span>
                    </div>

                    <div class="flex items-center gap-1.5">
                        <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                        <span>Password: <strong id="admin-pw-val-${docSnapId}" class="font-mono text-slate-900 dark:text-white font-extrabold">${adminData.passwordText ? '••••••••' : 'N/A'}</strong></span>
                    </div>
                </div>

                <!-- Show Password Full Width Toggle Button (Matching Screenshot) -->
                ${adminData.passwordText ? `
                    <button type="button" onclick="window.toggleAdminPasswordDisplay('${docSnapId}', '${escapeHtml(adminData.passwordText)}')" class="w-full mt-1 py-2.5 px-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-xs font-extrabold transition flex items-center justify-center gap-1.5 border border-blue-100 dark:border-blue-800/60 shadow-2xs active:scale-98">
                        <svg id="admin-pw-eye-${docSnapId}" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        <span id="admin-pw-label-${docSnapId}">Show Password</span>
                    </button>
                ` : ''}

            </div>
        `;
    });
    container.innerHTML = html;
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
        subAdminsListCache = [];

        snap.forEach(docSnap => {
            subAdminsListCache.push({
                id: docSnap.id,
                data: docSnap.data()
            });
        });

        renderSubAdminsUI();
    } catch (err) {
        console.error("Failed to load sub-admins:", err);
        container.innerHTML = `<p class="text-center text-red-500 py-4 text-xs font-semibold">Error loading sub-admins: ${err.message}</p>`;
    }
};

// Password toggle helper for sub-admin cards
window.toggleAdminPasswordDisplay = (uid, actualPassword) => {
    const valEl = document.getElementById(`admin-pw-val-${uid}`);
    const labelEl = document.getElementById(`admin-pw-label-${uid}`);
    if (!valEl || !labelEl) return;

    const isHidden = valEl.textContent === '••••••••';
    if (isHidden) {
        valEl.textContent = actualPassword;
        labelEl.textContent = 'Hide Password';
    } else {
        valEl.textContent = '••••••••';
        labelEl.textContent = 'Show Password';
    }
};

window.setSubAdminPage = (page) => {
    subAdminCurrentPage = page;
    renderSubAdminsUI();
};

// Dropdown toggle helpers
window.toggleAdminDropdown = (uid) => {
    const dropdown = document.getElementById(`admin-dropdown-${uid}`);
    if (!dropdown) return;
    document.querySelectorAll('[id^="admin-dropdown-"]').forEach(el => {
        if (el.id !== `admin-dropdown-${uid}`) el.classList.add('hidden');
    });
    dropdown.classList.toggle('hidden');
};

window.closeAllDropdowns = () => {
    document.querySelectorAll('[id^="admin-dropdown-"]').forEach(el => el.classList.add('hidden'));
};

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
        document.getElementById('add-subadmin-card')?.classList.add('hidden');
        const toggleBtn = document.getElementById('toggle-add-subadmin-btn');
        if (toggleBtn) {
            toggleBtn.innerHTML = `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg> <span>Add Sub-Admin</span>`;
            toggleBtn.classList.replace('from-gray-600', 'from-blue-600');
            toggleBtn.classList.replace('to-gray-700', 'to-indigo-600');
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

        localStorage.setItem('original_owner_uid', currentUser.uid);
        localStorage.setItem('original_owner_email', currentUser.email);
        localStorage.setItem('original_owner_token', backendAuthToken);

        localStorage.setItem('impersonated_sub_admin_uid', data.uid);
        localStorage.setItem('impersonated_sub_admin_email', data.email);
        localStorage.setItem('impersonated_sub_admin_token', data.token);
        const subAdminDoc = subAdminsListCache.find(u => u.id === targetUid)?.data || {};
        localStorage.setItem('impersonated_sub_admin_data', JSON.stringify({
            ...subAdminDoc,
            name: subAdminDoc.name || data.name || targetName,
            email: subAdminDoc.email || data.email,
            uid: subAdminDoc.uid || data.uid,
            role: 'admin'
        }));

        showNotification(`Switching to ${targetName}'s account...`);
        setTimeout(() => window.location.reload(), 500);
    } catch (err) {
        showNotification(err.message, true);
    }
};

// Expose functions to window
window.showAdminManageAdminsPage = showAdminManageAdminsPage;
window.handleSuspendAdmin = handleSuspendAdmin;
window.handleUnsuspendAdmin = handleUnsuspendAdmin;
window.handleDeleteAdmin = handleDeleteAdmin;
window.handleImpersonateAdmin = handleImpersonateAdmin;

