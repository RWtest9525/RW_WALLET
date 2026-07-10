// File: src/pages/admin/admin-tasks.js

const applyAdminTasksSnapshot = (docs = []) => {
            allTasksCache = docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (document.getElementById('admin-task-list')) {
                renderAdminTaskList();
            }
            renderHomeTaskCategories();
            if (document.querySelector('.task-page-shell')) {
                showUserTaskPage();
            }
        };

const getAdminTaskTypes = (family = 'review') => family === 'social' ? ADMIN_TASK_SOCIAL_TYPES : ADMIN_TASK_REVIEW_TYPES;

const getAdminTaskFamilyLabel = (family = 'review') => family === 'social' ? 'Social Task' : 'Review Task';

const getAdminTaskSubtypeMeta = (family = 'review', subtype = '') => {
            const options = getAdminTaskTypes(family);
            return options.find(item => item.value === subtype) || options[0];
        };

const getAdminTaskFamily = (task = {}) => {
            const raw = String(task.taskFamily || task.taskType || task.family || '').toLowerCase();
            if (raw.includes('social')) return 'social';
            if (raw.includes('review')) return 'review';
            const text = [task.category, task.title, task.taskSubtype || task.subtype].join(' ').toLowerCase();
            return text.includes('instagram') || text.includes('youtube') || text.includes('download') || text.includes('social') || text.includes('news') || text.includes('read') ? 'social' : 'review';
        };

const getAdminTaskSubtype = (task = {}) => {
            const family = getAdminTaskFamily(task);
            const subtype = String(task.taskSubtype || task.subtype || '').trim();
            if (getAdminTaskTypes(family).some(item => item.value === subtype)) return subtype;
            const text = [task.category, task.title].join(' ').toLowerCase();
            if (family === 'social') {
                if (text.includes('youtube')) return 'youtube_task';
                if (text.includes('download') || text.includes('install')) return 'app_download_task';
                if (text.includes('facebook')) return 'facebook_task';
                if (text.includes('telegram')) return 'telegram_task';
                if (text.includes('news') || text.includes('read')) return 'read_news';
                return 'instagram_task';
            }
            if (text.includes('map')) return 'map_review';
            if (text.includes('trustpilot')) return 'trustpilot_review';
            if (text.includes('website')) return 'website_review';
            return 'app_review';
        };

const getAdminTaskEffectiveStatus = (task = {}) => {
            const status = String(task.status || 'draft').toLowerCase();
            const expiresAt = timestampToMillis(task.expiresAt || task.autoCloseAt || task.closeAt);
            if (status === 'active' && expiresAt && expiresAt <= Date.now()) return 'closed';
            return status;
        };

const getDefaultAdminTaskInstructions = (family = 'review', subtype = 'app_review') => {
            const defaults = {
                app_review: '1. Open the app link.\n2. Install or open the app.\n3. Copy the review comment from this task.\n4. Submit the review on Play Store.\n5. Upload a clear screenshot proof.',
                map_review: '1. Open the map/place link.\n2. Visit the review section.\n3. Copy the review comment from this task.\n4. Submit the review.\n5. Upload a clear screenshot proof.',
                trustpilot_review: '1. Open the Trustpilot review link.\n2. Copy the review comment from this task.\n3. Submit the review correctly.\n4. Upload a clear screenshot proof.',
                website_review: '1. Open the website link.\n2. Check the page properly.\n3. Copy the review comment from this task.\n4. Submit the review where requested.\n5. Upload a clear screenshot proof.',
                instagram_task: '1. Open the Instagram link.\n2. Complete the required action.\n3. Keep your profile/action visible until verification.\n4. Upload a clear screenshot proof.',
                youtube_task: '1. Open the YouTube link.\n2. Complete the required action.\n3. Keep the action active until verification.\n4. Upload a clear screenshot proof.',
                app_download_task: '1. Open the app download link.\n2. Install the app.\n3. Open it once after install.\n4. Upload a clear screenshot proof.',
                facebook_task: '1. Open the Facebook link.\n2. Complete the required action.\n3. Keep the action active until verification.\n4. Upload a clear screenshot proof.',
                telegram_task: '1. Open the Telegram link.\n2. Join or complete the required action.\n3. Keep it active until verification.\n4. Upload a clear screenshot proof.',
                read_news: '1. Click on each of the news article cards below.\n2. Read the article in the sandboxed browser overlay and wait for the 10-second timer to finish.\n3. Close the article reader.\n4. Complete all news articles.\n5. Click the "Complete Task" button to receive your reward instantly.'
            };
            return defaults[subtype] || (family === 'social'
                ? '1. Open the task link.\n2. Complete the required social action.\n3. Upload a clear screenshot proof.'
                : '1. Open the review link.\n2. Copy the review comment from this task.\n3. Submit the review.\n4. Upload a clear screenshot proof.');
        };

const applyDefaultAdminTaskInstructions = (force = false) => {
            const instructionsInput = document.getElementById('admin-task-instructions');
            if (!instructionsInput) return;
            const family = document.getElementById('admin-task-family')?.value || 'review';
            const subtype = document.getElementById('admin-task-subtype')?.value || getAdminTaskTypes(family)[0].value;
            if (force || !instructionsInput.value.trim() || instructionsInput.dataset.autoDefault === 'true') {
                instructionsInput.value = getDefaultAdminTaskInstructions(family, subtype);
                instructionsInput.dataset.autoDefault = 'true';
            }
        };

const renderAdminTaskSubtypeOptions = (family = 'review', selected = '') => getAdminTaskTypes(family).map(item => `
            <option value="${item.value}" ${item.value === selected ? 'selected' : ''}>${escapeHtml(item.label)}</option>
        `).join('');

const getAdminTaskIconButton = (action, taskId, title, svgPath, tone = 'slate') => {
            const toneClass = {
                slate: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900',
                blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
                red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-200',
                amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
            }[tone] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
            return `
                <button type="button" data-action="${action}" data-taskid="${taskId}" title="${escapeHtml(title)}" class="inline-flex h-10 w-10 items-center justify-center rounded-xl ${toneClass} transition hover:scale-105 active:scale-95">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">${svgPath}</svg>
                </button>`;
        };

const getAdminTaskIconButtonMini = (action, taskId, title, svgPath, tone = 'slate') => {
            const toneClass = {
                slate: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-gray-100',
                blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50',
                red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/50',
                amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50'
            }[tone] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600';
            return `
                <button type="button" data-action="${action}" data-taskid="${taskId}" title="${escapeHtml(title)}" class="inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneClass} transition hover:scale-105 active:scale-95">
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${svgPath}</svg>
                </button>`;
        };

const setAdminTaskPanel = (panel = 'manage') => {
            const validPanels = ['manage', 'add', 'ads', 'submissions'];
            const normalized = validPanels.includes(panel) ? panel : 'manage';
            window.adminTaskPanel = normalized;
            const addSection = document.getElementById('admin-task-add-section');
            const manageSection = document.getElementById('admin-task-manage-section');
            const adsSection = document.getElementById('admin-ads-section');
            const subsSection = document.getElementById('admin-submissions-section');
            if (addSection) addSection.classList.toggle('hidden', normalized !== 'add');
            if (manageSection) manageSection.classList.toggle('hidden', normalized !== 'manage');
            if (adsSection) adsSection.classList.toggle('hidden', normalized !== 'ads');
            if (subsSection) subsSection.classList.toggle('hidden', normalized !== 'submissions');

            // Lazy-load ads when tab is first opened
            if (normalized === 'ads' && !window._adsTabInitialized) {
                window._adsTabInitialized = true;
                document.getElementById('admin-ad-form')?.addEventListener('submit', handleSaveAdminAd);
                document.getElementById('admin-ad-reset-btn')?.addEventListener('click', resetAdminAdForm);
                if (typeof renderAdminAdsList === 'function') renderAdminAdsList();
                getDocs(query(collection(db, `artifacts/${appId}/public/data/ads`), orderBy("createdAt", "desc")))
                    .then(snapshot => { if (typeof applyAdsSnapshot === 'function') applyAdsSnapshot(snapshot.docs); })
                    .catch(error => console.warn('Ads refresh skipped:', error));
            }

            // Lazy-load submissions when tab is first opened
            if (normalized === 'submissions' && !window._subsTabInitialized) {
                window._subsTabInitialized = true;
                adminSubmissionsView = { view: 'dates', selectedDate: null, selectedApp: null };
                const container = document.getElementById('admin-submissions-content');
                if (container) {
                    container.innerHTML = `
                        <section class="rounded-2xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-3">
                            <div class="flex flex-wrap items-center gap-2">
                                <input id="admin-sub-search" type="text" placeholder="Search user or task..." class="flex-1 min-w-[140px] rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500">
                                <select id="admin-sub-filter" class="rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-semibold">
                                    <option value="all">All</option>
                                    <option value="pending" selected>Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="paid">Paid</option>
                                </select>
                                <button id="admin-sub-refresh-btn" class="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 transition">Refresh</button>
                            </div>
                            <div id="admin-sub-list" class="space-y-3">
                                <div class="py-8 text-center text-sm text-gray-400">Loading submissions...</div>
                            </div>
                        </section>`;
                    loadAdminSubmissions();
                    document.getElementById('admin-sub-refresh-btn')?.addEventListener('click', loadAdminSubmissions);
                    document.getElementById('admin-sub-search')?.addEventListener('input', renderAdminSubmissions);
                    document.getElementById('admin-sub-filter')?.addEventListener('change', renderAdminSubmissions);
                }
            }

            document.querySelectorAll('[data-admin-task-panel]').forEach(button => {
                const isActive = button.dataset.adminTaskPanel === normalized;
                button.classList.toggle('bg-cyan-600', isActive);
                button.classList.toggle('text-white', isActive);
                button.classList.toggle('shadow-md', isActive);
                button.classList.toggle('bg-white', !isActive);
                button.classList.toggle('text-gray-700', !isActive);
                button.classList.toggle('dark:bg-gray-800', !isActive);
                button.classList.toggle('dark:text-gray-200', !isActive);
            });
        };

const showAdminTaskPage = () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            currentMainSection = 'admin';
            const isTaskPageEnabled = !!appConfigCache?.task_page_enabled;
            const content = `
                ${getPageHeader('Manage Task')}
                <div class="pb-24">
                <div class="max-w-5xl mx-auto space-y-4 sm:space-y-5">
                    <section class="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-cyan-900 to-emerald-700 p-5 text-white shadow-xl">
                        <p class="text-[10px] font-black uppercase text-white/60">Admin Control</p>
                        <div class="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h3 class="text-2xl font-black">Manage Task Board</h3>
                                <p class="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/70">Create review or social tasks here. New tasks stay OFF until you turn them ON.</p>
                            </div>
                            <div class="grid grid-cols-3 gap-2 text-center text-xs">
                                <div class="rounded-2xl bg-white/12 px-4 py-3">
                                    <p class="font-black text-white" id="admin-task-total-count">0</p>
                                    <p class="text-white/60">Total</p>
                                </div>
                                <div class="rounded-2xl bg-white/12 px-4 py-3">
                                    <p class="font-black text-emerald-200" id="admin-task-active-count">0</p>
                                    <p class="text-white/60">Live</p>
                                </div>
                                <div class="rounded-2xl bg-white/12 px-4 py-3">
                                    <p class="font-black text-amber-200" id="admin-task-draft-count">0</p>
                                    <p class="text-white/60">Off</p>
                                </div>
                            </div>
                        </div>
                        <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                            <span class="text-sm font-bold text-white/95">Task Page Status (for Users)</span>
                            <button type="button" id="admin-toggle-task-page-status" class="inline-flex items-center gap-1.5 text-xs font-black ${isTaskPageEnabled ? 'text-emerald-300' : 'text-white/70'}">
                                <span class="relative inline-flex h-5 w-9 rounded-full ${isTaskPageEnabled ? 'bg-emerald-500' : 'bg-white/20'} transition">
                                    <span class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition transform ${isTaskPageEnabled ? 'translate-x-4' : 'translate-x-0'}"></span>
                                </span>
                                ${isTaskPageEnabled ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    </section>

                    <div class="grid grid-cols-4 gap-1.5 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                        <button type="button" data-admin-task-panel="manage" class="rounded-xl px-2 py-2.5 text-xs font-black transition">Tasks</button>
                        <button type="button" data-admin-task-panel="add" class="rounded-xl px-2 py-2.5 text-xs font-black transition">Add Task</button>
                        <button type="button" data-admin-task-panel="ads" class="rounded-xl px-2 py-2.5 text-xs font-black transition">Ads</button>
                        <button type="button" data-admin-task-panel="submissions" class="rounded-xl px-2 py-2.5 text-xs font-black transition">Submissions</button>
                    </div>

                    <section id="admin-task-add-section" class="hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <div>
                                <h3 class="text-lg font-black text-gray-900 dark:text-white">Add New Task</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Choose task type, add link, reward, and payment timing. Instructions are prefilled.</p>
                            </div>
                        </div>

                        <form id="admin-task-form" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input type="hidden" id="admin-task-edit-id" value="">
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Task Type</label>
                                <select id="admin-task-family" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                    <option value="review">Review Task</option>
                                    <option value="social">Social Task</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Choose Work</label>
                                <select id="admin-task-subtype" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                    ${renderAdminTaskSubtypeOptions('review', 'app_review')}
                                </select>
                            </div>
                            <div class="sm:col-span-2">
                                <label class="text-xs font-black uppercase text-gray-400">Task Title</label>
                                <input id="admin-task-title" placeholder="Example: PopClub app review" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            </div>
                            <div class="sm:col-span-2">
                                <label class="text-xs font-black uppercase text-gray-400">Task Link</label>
                                <div class="mt-1 flex gap-2">
                                    <input id="admin-task-link" placeholder="https://..." class="min-w-0 flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                    <span class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
                                        <img id="admin-task-logo-preview" src="${ADMIN_TASK_REVIEW_TYPES[0].logo}" alt="Task logo" class="h-full w-full object-contain" loading="eager" decoding="async">
                                    </span>
                                </div>
                            </div>
                            <div id="admin-task-news-links-wrap" class="hidden sm:col-span-2 space-y-2">
                                <div class="flex items-center justify-between">
                                    <label class="text-xs font-black uppercase text-gray-400">News Links</label>
                                    <button type="button" id="admin-task-add-news-link-btn" class="inline-flex items-center gap-1 rounded-xl bg-slate-950 hover:bg-slate-900 text-white px-3 py-1.5 text-[11px] font-black uppercase">
                                        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                                        Add Link
                                    </button>
                                </div>
                                <div id="admin-task-news-links-container" class="space-y-2">
                                    <!-- Dynamic rows -->
                                </div>
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Rate / Reward</label>
                                <input id="admin-task-rate" type="number" min="0" step="1" placeholder="Amount in rupees" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Task Limit</label>
                                <input id="admin-task-limit" type="number" min="1" step="1" placeholder="Total slots" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">Payment</label>
                                <select id="admin-task-payment-mode" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                    <option value="instant">Instant</option>
                                    <option value="days">Pay after days</option>
                                </select>
                            </div>
                            <div id="admin-task-payment-days-wrap" class="hidden">
                                <label class="text-xs font-black uppercase text-gray-400">Payment Day</label>
                                <select id="admin-task-payment-days" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 font-bold">
                                    <option value="2">2nd Day</option>
                                    <option value="3">3rd Day</option>
                                    <option value="5">5th Day</option>
                                    <option value="7" selected>7th Day (Default)</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-xs font-black uppercase text-gray-400">List Compile Time (IST)</label>
                                <input id="admin-task-list-time" type="time" value="20:00" class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500">
                            </div>
                            <div class="sm:col-span-2">
                                <label class="text-xs font-black uppercase text-gray-400">Instructions</label>
                                <textarea id="admin-task-instructions" rows="4" placeholder="Write exact steps users must follow..." class="mt-1 w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"></textarea>
                            </div>
                            <div class="sm:col-span-2 flex flex-col sm:flex-row gap-2">
                                <button type="submit" id="admin-task-save-btn" class="flex-1 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white hover:bg-cyan-700 transition">Add Task</button>
                                <button type="button" id="admin-task-reset-btn" class="rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 text-sm font-black text-gray-700 dark:text-gray-200">Clear</button>
                            </div>
                        </form>
                    </section>

                    <section id="admin-task-manage-section" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <h3 class="text-lg font-black text-gray-900 dark:text-white">Managing Tasks</h3>
                            <div class="flex gap-2">
                                <input id="admin-task-search" placeholder="Search task..." class="min-w-0 flex-1 sm:w-64 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                <select id="admin-task-filter" class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                    <option value="all">All</option>
                                    <option value="active">Live</option>
                                    <option value="draft">Off</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>
                        </div>
                        <div id="admin-task-list" class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[72vh] overflow-y-auto pr-1"></div>
                    </section>

                    <section id="admin-ads-section" class="hidden space-y-4">
                        <div class="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm">
                            <div class="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h3 class="text-lg font-black">Add Advertisement</h3>
                                    <p class="text-xs text-gray-500 dark:text-gray-400">Paste image link or YouTube link. Users see it instantly in the home carousel.</p>
                                </div>
                                <span class="flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-50 text-2xl font-black text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-200">+</span>
                            </div>
                            <form id="admin-ad-form" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input type="hidden" id="admin-ad-edit-id" value="">
                                <div>
                                    <label class="text-xs font-black uppercase text-gray-400">Ad Title</label>
                                    <input id="admin-ad-title" placeholder="Ad title" class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                                </div>
                                <div>
                                    <label class="text-xs font-black uppercase text-gray-400">Type</label>
                                    <select id="admin-ad-type" class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                                        <option value="auto">Auto detect</option>
                                        <option value="image">Image / Banner</option>
                                        <option value="youtube">YouTube Video</option>
                                    </select>
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="text-xs font-black uppercase text-gray-400">Image / YouTube Link</label>
                                    <input id="admin-ad-media-url" placeholder="https://..." class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="text-xs font-black uppercase text-gray-400">Subtitle</label>
                                    <input id="admin-ad-subtitle" placeholder="Small text shown on ad" class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                                </div>
                                <div>
                                    <label class="text-xs font-black uppercase text-gray-400">Order</label>
                                    <input id="admin-ad-order" type="number" min="0" step="1" value="0" class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                                </div>
                                <div>
                                    <label class="text-xs font-black uppercase text-gray-400">Status</label>
                                    <select id="admin-ad-status" class="mt-1 w-full rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                                        <option value="active">Active</option>
                                        <option value="paused">Paused</option>
                                    </select>
                                </div>
                                <div class="sm:col-span-2 flex flex-col sm:flex-row gap-2">
                                    <button id="admin-ad-save-btn" type="submit" class="flex-1 rounded-xl bg-fuchsia-600 px-4 py-3 text-sm font-black text-white hover:bg-fuchsia-700 transition">Add Ad</button>
                                    <button id="admin-ad-reset-btn" type="button" class="rounded-xl bg-gray-100 dark:bg-gray-700 px-4 py-3 text-sm font-black text-gray-700 dark:text-gray-200">Clear</button>
                                </div>
                            </form>
                        </div>
                        <div class="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm">
                            <div class="mb-4 flex items-center justify-between">
                                <h3 class="text-lg font-black">Active Ads</h3>
                                <span id="admin-ads-count" class="text-xs font-bold text-gray-400">0 ads</span>
                            </div>
                            <div id="admin-ads-list" class="space-y-3"></div>
                        </div>
                    </section>

                    <section id="admin-submissions-section" class="hidden">
                        <div id="admin-submissions-content" class="space-y-4">
                            <p class="text-center text-sm text-gray-400 py-8">Loading submissions...</p>
                        </div>
                    </section>
                </div>
                </div>
                ${getPageFooter()}`;
            showPage(content, { returnTo: 'admin', keepBottomNav: true });
            setBottomNavActive('bottom-admin-btn');
            window._adsTabInitialized = false;
            window._subsTabInitialized = false;
            document.querySelectorAll('[data-admin-task-panel]').forEach(button => {
                button.addEventListener('click', () => setAdminTaskPanel(button.dataset.adminTaskPanel));
            });
            setAdminTaskPanel(window.adminTaskPanel || 'manage');
            const toggleBtn = document.getElementById('admin-toggle-task-page-status');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', async () => {
                    const currentVal = !!appConfigCache?.task_page_enabled;
                    const nextVal = !currentVal;
                    toggleBtn.disabled = true;
                    try {
                        const configRef = doc(db, `artifacts/${appId}/settings`, 'app_config');
                        await setDoc(configRef, { task_page_enabled: nextVal }, { merge: true });
                        showNotification(`User task page is now ${nextVal ? 'ON (Real tasks shown)' : 'OFF (Coming Soon shown)'}`);
                        appConfigCache = { ...appConfigCache, task_page_enabled: nextVal };
                        if (typeof rememberAppConfig === 'function') {
                            rememberAppConfig(appConfigCache);
                        }
                        showAdminTaskPage();
                    } catch (error) {
                        console.error('Failed to toggle task page status:', error);
                        showNotification('Error updating settings.', true);
                        toggleBtn.disabled = false;
                    }
                });
            }
            document.getElementById('admin-task-form')?.addEventListener('submit', handleSaveAdminTask);
            document.getElementById('admin-task-reset-btn')?.addEventListener('click', resetAdminTaskForm);
            document.getElementById('admin-task-add-news-link-btn')?.addEventListener('click', () => {
                const container = document.getElementById('admin-task-news-links-container');
                if (!container) return;
                const rows = Array.from(container.querySelectorAll('.news-link-row'));
                const currentVals = rows.map(row => row.querySelector('.news-link-input')?.value.trim() || '');
                currentVals.push('');
                renderAdminTaskNewsLinkInputs(currentVals);
            });
            document.getElementById('admin-task-family')?.addEventListener('change', () => updateAdminTaskDynamicFields());
            document.getElementById('admin-task-subtype')?.addEventListener('change', () => updateAdminTaskDynamicFields());
            document.getElementById('admin-task-payment-mode')?.addEventListener('change', () => updateAdminTaskDynamicFields());
            document.getElementById('admin-task-link')?.addEventListener('input', () => updateAdminTaskLogoPreview());
            document.getElementById('admin-task-instructions')?.addEventListener('input', (event) => {
                event.currentTarget.dataset.autoDefault = 'false';
            });
            document.getElementById('admin-task-search')?.addEventListener('input', renderAdminTaskList);
            document.getElementById('admin-task-filter')?.addEventListener('change', renderAdminTaskList);
            updateAdminTaskDynamicFields();
            renderAdminTaskList();

            const attachPlayStoreScraper = () => {
                const linkInput = document.getElementById('admin-task-link');
                if (!linkInput) return;
                
                const handleLinkInput = async () => {
                    const link = linkInput.value.trim();
                    if (!link) return;

                    const isPlayStoreUrl = link.includes('play.google.com') && link.includes('id=');
                    if (!isPlayStoreUrl) return;

                    if (linkInput.dataset.scrapingInProgress === 'true' || linkInput.dataset.scrapedUrl === link) {
                        return;
                    }
                    
                    try {
                        linkInput.dataset.scrapingInProgress = 'true';
                        const token = await getBackendAuthToken();
                        linkInput.classList.add('border-cyan-500', 'animate-pulse');
                        const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/scrape-playstore`, {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ url: link })
                        }, 10000);
                        
                        const data = await response.json();
                        linkInput.classList.remove('border-cyan-500', 'animate-pulse');
                        if (response.ok && data.ok) {
                            linkInput.dataset.scrapedUrl = link;
                            if (data.name) {
                                const titleInput = document.getElementById('admin-task-title');
                                if (titleInput) titleInput.value = data.name;
                            }
                            if (data.logoUrl) {
                                linkInput.dataset.scrapedLogoUrl = data.logoUrl;
                                updateAdminTaskLogoPreview();
                            }
                            showNotification('Play Store details fetched successfully.');
                        }
                    } catch (err) {
                        console.error('Play Store scraping failed:', err);
                        linkInput.classList.remove('border-cyan-500', 'animate-pulse');
                    } finally {
                        linkInput.dataset.scrapingInProgress = 'false';
                    }
                };

                linkInput.addEventListener('input', handleLinkInput);
                linkInput.addEventListener('paste', () => {
                    setTimeout(handleLinkInput, 100);
                });
                linkInput.addEventListener('blur', handleLinkInput);
            };
            attachPlayStoreScraper();
            getDocs(query(collection(db, `artifacts/${appId}/public/data/tasks`), orderBy("createdAt", "desc")))
                .then(snapshot => applyAdminTasksSnapshot(snapshot.docs))
                .catch(error => console.warn('Task refresh skipped:', error));
        };

const updateAdminTaskLogoPreview = () => {
            const family = document.getElementById('admin-task-family')?.value || 'review';
            const subtype = document.getElementById('admin-task-subtype')?.value || getAdminTaskTypes(family)[0].value;
            const link = document.getElementById('admin-task-link')?.value.trim() || '';
            const scrapedLogoUrl = document.getElementById('admin-task-link')?.dataset.scrapedLogoUrl || '';
            const preview = document.getElementById('admin-task-logo-preview');
            if (preview) {
                preview.src = scrapedLogoUrl || getTaskLogoFromLink(family, subtype, link);
                preview.onerror = () => {
                    preview.onerror = null;
                    preview.src = getAdminTaskSubtypeMeta(family, subtype).logo;
                };
            }
        };

const renderAdminTaskNewsLinkInputs = (links = []) => {
            const container = document.getElementById('admin-task-news-links-container');
            if (!container) return;
            const items = links.length ? links : [''];
            container.innerHTML = items.map((val, idx) => `
                <div class="flex gap-2 items-center news-link-row">
                    <input value="${escapeHtml(val)}" placeholder="News Link ${idx + 1} (https://...)" class="news-link-input w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm">
                    <button type="button" class="remove-news-link-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-200 transition hover:scale-105 active:scale-95" title="Remove Link">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            `).join('');

            container.querySelectorAll('.remove-news-link-btn').forEach((btn, idx) => {
                btn.onclick = () => {
                    const rows = Array.from(container.querySelectorAll('.news-link-row'));
                    const currentVals = rows.map(row => row.querySelector('.news-link-input')?.value.trim() || '');
                    currentVals.splice(idx, 1);
                    renderAdminTaskNewsLinkInputs(currentVals);
                };
            });
        };

const updateAdminTaskDynamicFields = (preferredSubtype = '') => {
            const familyInput = document.getElementById('admin-task-family');
            const subtypeInput = document.getElementById('admin-task-subtype');
            if (!familyInput || !subtypeInput) return;
            const family = familyInput.value || 'review';
            const options = getAdminTaskTypes(family);
            const currentSubtype = preferredSubtype || subtypeInput.value || options[0].value;
            const selectedSubtype = options.some(item => item.value === currentSubtype) ? currentSubtype : options[0].value;
            subtypeInput.innerHTML = renderAdminTaskSubtypeOptions(family, selectedSubtype);
            subtypeInput.value = selectedSubtype;

            const newsWrap = document.getElementById('admin-task-news-links-wrap');
            const linkInput = document.getElementById('admin-task-link');
            const linkWrap = linkInput ? linkInput.closest('.sm:col-span-2') : null;
            if (selectedSubtype === 'read_news') {
                if (newsWrap) newsWrap.classList.remove('hidden');
                if (linkWrap) linkWrap.classList.add('hidden');
                
                const container = document.getElementById('admin-task-news-links-container');
                if (container && !container.querySelector('.news-link-row')) {
                    renderAdminTaskNewsLinkInputs([]);
                }
            } else {
                if (newsWrap) newsWrap.classList.add('hidden');
                if (linkWrap) linkWrap.classList.remove('hidden');
            }

            const paymentMode = document.getElementById('admin-task-payment-mode')?.value || 'instant';
            document.getElementById('admin-task-payment-days-wrap')?.classList.toggle('hidden', paymentMode !== 'days');
            updateAdminTaskLogoPreview();
            applyDefaultAdminTaskInstructions(false);
        };

const getAdminTaskFormData = (existingTask = null) => {
            const title = document.getElementById('admin-task-title')?.value.trim() || '';
            const family = document.getElementById('admin-task-family')?.value || 'review';
            const subtype = document.getElementById('admin-task-subtype')?.value || getAdminTaskTypes(family)[0].value;
            const subtypeMeta = getAdminTaskSubtypeMeta(family, subtype);
            const rate = Number(document.getElementById('admin-task-rate')?.value || 0);
            const limitValue = Number(document.getElementById('admin-task-limit')?.value || 0);
            let taskLink = document.getElementById('admin-task-link')?.value.trim() || '';
            
            const newsLinks = [];
            if (subtype === 'read_news') {
                const inputs = document.querySelectorAll('.news-link-input');
                inputs.forEach(input => {
                    const lnk = input.value.trim();
                    if (lnk) newsLinks.push(lnk);
                });
                if (newsLinks.length > 0) {
                    taskLink = newsLinks[0];
                }
            }

            const paymentMode = document.getElementById('admin-task-payment-mode')?.value || 'instant';
            const paymentDays = paymentMode === 'days' ? Number(document.getElementById('admin-task-payment-days')?.value || 0) : 0;
            const scrapedLogoUrl = document.getElementById('admin-task-link')?.dataset.scrapedLogoUrl || '';
            const logoUrl = scrapedLogoUrl || getTaskLogoFromLink(family, subtype, taskLink);
            const listTime = document.getElementById('admin-task-list-time')?.value || '20:00';
            const status = existingTask ? (existingTask.status || 'draft') : 'draft';
            const preservedReviewComment = family === 'review' && existingTask ? (existingTask.reviewComment || existingTask.commentToCopy || '') : '';
            return {
                title,
                taskFamily: family,
                taskType: family,
                taskSubtype: subtype,
                taskSubtypeLabel: subtypeMeta.label,
                category: subtypeMeta.label,
                taskGroup: getAdminTaskFamilyLabel(family),
                rate,
                reward: rate,
                limit: Number.isFinite(limitValue) && limitValue > 0 ? limitValue : null,
                status,
                isVisible: status === 'active',
                proofRequired: 'Screenshot',
                priority: 'normal',
                taskLink,
                newsLinks,
                logoUrl,
                imageUrl: logoUrl,
                iconUrl: logoUrl,
                reviewComment: preservedReviewComment,
                commentToCopy: preservedReviewComment,
                paymentMode,
                paymentDelayDays: Number.isFinite(paymentDays) && paymentDays > 0 ? paymentDays : 0,
                paymentLabel: paymentMode === 'days' && paymentDays > 0 ? `${paymentDays} day payment` : 'Instant payment',
                listDays: Number.isFinite(paymentDays) && paymentDays > 0 ? paymentDays : 7,
                list_days: Number.isFinite(paymentDays) && paymentDays > 0 ? paymentDays : 7,
                listDate: existingTask?.listDate || existingTask?.list_date || new Date().toISOString().split('T')[0],
                list_date: existingTask?.listDate || existingTask?.list_date || new Date().toISOString().split('T')[0],
                listTime,
                instructions: document.getElementById('admin-task-instructions')?.value.trim() || '',
                autoCloseDaily: true,
                expiresAt: existingTask?.expiresAt || null
            };
        };

const resetAdminTaskForm = () => {
            document.getElementById('admin-task-form')?.reset();
            const editId = document.getElementById('admin-task-edit-id');
            if (editId) editId.value = '';
            const linkInput = document.getElementById('admin-task-link');
            if (linkInput) delete linkInput.dataset.scrapedLogoUrl;
            const listTimeInput = document.getElementById('admin-task-list-time');
            if (listTimeInput) listTimeInput.value = '20:00';
            const saveBtn = document.getElementById('admin-task-save-btn');
            if (saveBtn) saveBtn.textContent = 'Add Task';
            
            renderAdminTaskNewsLinkInputs([]);

            updateAdminTaskDynamicFields('app_review');
            applyDefaultAdminTaskInstructions(true);
        };

const handleSaveAdminTask = async (event) => {
            event.preventDefault();
            if (currentUser?.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const saveBtn = document.getElementById('admin-task-save-btn');
            const editId = document.getElementById('admin-task-edit-id')?.value || '';
            const existingTask = editId ? allTasksCache.find(task => task.id === editId) : null;
            const payload = getAdminTaskFormData(existingTask);
            if (!payload.title) return showNotification('Please enter task title.', true);
            if (!Number.isFinite(payload.rate) || payload.rate <= 0) return showNotification('Please enter a valid task rate.', true);
            
            if (payload.taskSubtype === 'read_news') {
                if (!payload.newsLinks || payload.newsLinks.length === 0) {
                    return showNotification('Please add at least one news link.', true);
                }
                for (const link of payload.newsLinks) {
                    if (!/^https?:\/\//i.test(link)) {
                        return showNotification('All news links must start with http:// or https://', true);
                    }
                }
            } else {
                if (!payload.taskLink) return showNotification('Please add task link.', true);
                if (payload.taskLink && !/^https?:\/\//i.test(payload.taskLink)) return showNotification('Task link must start with http:// or https://', true);
            }
            
            if (payload.paymentMode === 'days' && (!Number.isFinite(payload.paymentDelayDays) || payload.paymentDelayDays <= 0)) return showNotification('Please enter payment day.', true);
            if (!payload.instructions) return showNotification('Please add task instructions.', true);

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = editId ? 'Updating...' : 'Adding...';
            }
            try {
                if (editId) {
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/tasks`, editId), {
                        ...payload,
                        updatedAt: serverTimestamp(),
                        updatedBy: currentUser.uid
                    });
                    allTasksCache = allTasksCache.map(task => task.id === editId ? { ...task, ...payload, updatedAt: Date.now() } : task);
                    showNotification('Task updated.');
                } else {
                    const taskRef = doc(collection(db, `artifacts/${appId}/public/data/tasks`));
                    const task = {
                        id: taskRef.id,
                        ...payload,
                        submissions: 0,
                        completed: 0,
                        createdAt: Date.now(),
                        createdBy: currentUser.uid
                    };
                    allTasksCache = [task, ...allTasksCache];
                    renderAdminTaskList();
                    await setDoc(taskRef, {
                        ...payload,
                        submissions: 0,
                        completed: 0,
                        createdAt: serverTimestamp(),
                        createdBy: currentUser.uid
                    });
                    showNotification('Task added.');
                }
                resetAdminTaskForm();
                renderAdminTaskList();
                setAdminTaskPanel('manage');
            } catch (error) {
                console.error('Task save failed:', error);
                showNotification(`Could not save task: ${error.message}`, true);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = document.getElementById('admin-task-edit-id')?.value ? 'Update Task' : 'Add Task';
                }
            }
        };

const editAdminTask = (taskId) => {
            const task = allTasksCache.find(item => item.id === taskId);
            if (!task) return;
            const family = getAdminTaskFamily(task);
            const subtype = getAdminTaskSubtype(task);
            document.getElementById('admin-task-edit-id').value = task.id;
            document.getElementById('admin-task-title').value = task.title || '';
            document.getElementById('admin-task-family').value = family;
            updateAdminTaskDynamicFields(subtype);
            if (subtype === 'read_news' && Array.isArray(task.newsLinks)) {
                renderAdminTaskNewsLinkInputs(task.newsLinks);
            } else {
                renderAdminTaskNewsLinkInputs([]);
            }
            document.getElementById('admin-task-rate').value = task.rate || task.reward || '';
            document.getElementById('admin-task-limit').value = task.limit || '';
            const linkInput = document.getElementById('admin-task-link');
            if (linkInput) {
                linkInput.value = task.taskLink || '';
                if (task.logoUrl) {
                    linkInput.dataset.scrapedLogoUrl = task.logoUrl;
                } else {
                    delete linkInput.dataset.scrapedLogoUrl;
                }
            }
            const listTimeInput = document.getElementById('admin-task-list-time');
            if (listTimeInput) {
                listTimeInput.value = task.listTime || task.list_time || '20:00';
            }
            document.getElementById('admin-task-payment-mode').value = (task.paymentMode || (Number(task.paymentDelayDays || 0) > 0 ? 'days' : 'instant')) === 'days' ? 'days' : 'instant';
            document.getElementById('admin-task-payment-days').value = task.paymentDelayDays || task.paymentDays || '';
            const instructionsInput = document.getElementById('admin-task-instructions');
            if (instructionsInput) {
                instructionsInput.value = task.instructions || '';
                instructionsInput.dataset.autoDefault = task.instructions ? 'false' : 'true';
            }
            document.getElementById('admin-task-save-btn').textContent = 'Update Task';
            updateAdminTaskDynamicFields(subtype);
            setAdminTaskPanel('add');
            document.getElementById('admin-task-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

const handleToggleAdminTaskStatus = async (taskId) => {
            const task = allTasksCache.find(item => item.id === taskId);
            if (!task) return;
            const currentStatus = getAdminTaskEffectiveStatus(task);
            const nextStatus = currentStatus === 'active' ? 'draft' : 'active';
            const nextExpiresAt = nextStatus === 'active' ? getNextTaskMidnightMillis() : null;
            allTasksCache = allTasksCache.map(item => item.id === taskId ? { ...item, status: nextStatus, isVisible: nextStatus === 'active', expiresAt: nextExpiresAt } : item);
            renderAdminTaskList();
            try {
                await updateDoc(doc(db, `artifacts/${appId}/public/data/tasks`, taskId), {
                    status: nextStatus,
                    isVisible: nextStatus === 'active',
                    expiresAt: nextExpiresAt,
                    autoCloseDaily: true,
                    updatedAt: serverTimestamp(),
                    updatedBy: currentUser.uid
                });
                showNotification(nextStatus === 'active' ? 'Task is live until 12 AM.' : 'Task turned off.');
            } catch (error) {
                console.error('Task status update failed:', error);
                showNotification(`Could not update task: ${error.message}`, true);
            }
        };

const handleDeleteAdminTask = async (taskId) => {
            const task = allTasksCache.find(item => item.id === taskId);
            if (!task) return;
            renderModal('Delete Task',
                `<p class="text-sm text-gray-600 dark:text-gray-300">Delete <strong>${escapeHtml(task.title || 'this task')}</strong>? This removes it from the manage task list.</p>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-delete-admin-task-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Delete</button>`);
            document.getElementById('confirm-delete-admin-task-btn').onclick = async () => {
                try {
                    allTasksCache = allTasksCache.filter(item => item.id !== taskId);
                    renderAdminTaskList();
                    window.closeModal();
                    await deleteDoc(doc(db, `artifacts/${appId}/public/data/tasks`, taskId));
                    showNotification('Task deleted.');
                } catch (error) {
                    console.error('Task delete failed:', error);
                    showNotification(`Could not delete task: ${error.message}`, true);
                }
            };
        };

const handleEditAdminTaskComment = (taskId) => {
            const task = allTasksCache.find(item => item.id === taskId);
            if (!task || !isAdminReviewTask(task)) return;
            const existingComments = getTaskCommentPool(task).join('\n');
            renderModal('Review Comment',
                `<div class="space-y-3">
                    <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">Add one review comment per line. A copied comment is reserved for one user for 5 minutes.</p>
                    <textarea id="admin-task-comment-modal-input" rows="7" class="w-full rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white">${escapeHtml(existingComments)}</textarea>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="save-admin-task-comment-btn" class="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg">Save</button>`);
            document.getElementById('save-admin-task-comment-btn').onclick = async () => {
                const comment = document.getElementById('admin-task-comment-modal-input')?.value.trim() || '';
                const comments = comment.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
                if (!comments.length) return showNotification('Please add review comment.', true);
                try {
                    allTasksCache = allTasksCache.map(item => item.id === taskId ? { ...item, reviewComments: comments, reviewComment: comments[0], commentToCopy: comments[0] } : item);
                    renderAdminTaskList();
                    window.closeModal();
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/tasks`, taskId), {
                        reviewComments: comments,
                        reviewComment: comments[0],
                        commentToCopy: comments[0],
                        updatedAt: serverTimestamp(),
                        updatedBy: currentUser.uid
                    });
                    showNotification('Review comment updated.');
                } catch (error) {
                    console.error('Review comment update failed:', error);
                    showNotification(`Could not update comment: ${error.message}`, true);
                }
            };
        };

const renderAdminTaskList = () => {
            const listEl = document.getElementById('admin-task-list');
            if (!listEl) return;
            const search = (document.getElementById('admin-task-search')?.value || '').trim().toLowerCase();
            const filter = document.getElementById('admin-task-filter')?.value || 'all';
            const tasks = [...allTasksCache].filter(task => {
                const status = getAdminTaskEffectiveStatus(task);
                if (filter !== 'all' && status !== filter) return false;
                if (!search) return true;
                return [task.title, task.category, task.instructions, task.taskGroup, task.taskSubtypeLabel, status]
                    .some(value => String(value || '').toLowerCase().includes(search));
            });
            const activeCount = allTasksCache.filter(task => getAdminTaskEffectiveStatus(task) === 'active').length;
            const draftCount = allTasksCache.filter(task => getAdminTaskEffectiveStatus(task) !== 'active').length;
            const totalEl = document.getElementById('admin-task-total-count');
            const activeEl = document.getElementById('admin-task-active-count');
            const draftEl = document.getElementById('admin-task-draft-count');
            if (totalEl) totalEl.textContent = allTasksCache.length;
            if (activeEl) activeEl.textContent = activeCount;
            if (draftEl) draftEl.textContent = draftCount;

            if (!tasks.length && !allTasksCache.length) {
                listEl.innerHTML = `
                    <div class="md:col-span-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
                        No task added yet. The faded missions below are preview only and are not clickable.
                    </div>
                    ${[
                        { title: 'PopClub', category: 'Active App Review', rate: '₹8', image: 'Pop' },
                        { title: 'Map Review Work', category: 'Review Task', rate: '₹12', image: 'Map' },
                        { title: 'App Install Mission', category: 'Instant Payment Task', rate: '₹10', image: 'App' }
                    ].map(item => `
                        <div class="pointer-events-none rounded-xl border border-slate-100 bg-slate-50 p-3 opacity-55 dark:border-slate-700 dark:bg-gray-900 flex flex-col justify-between">
                            <div class="flex items-start gap-2.5 min-w-0">
                                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-400 dark:border-slate-700 dark:bg-gray-800">${item.image}</span>
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center justify-between gap-1">
                                        <span class="truncate text-xs font-bold text-gray-400 dark:text-gray-500">${item.category}</span>
                                        <span class="text-sm font-black text-emerald-600 dark:text-emerald-400 shrink-0">${item.rate}</span>
                                    </div>
                                    <h4 class="mt-0.5 text-sm font-black text-gray-900 dark:text-white line-clamp-1 truncate">${item.title}</h4>
                                </div>
                            </div>
                        </div>
                    `).join('')}`;
                return;
            }

            listEl.innerHTML = tasks.length ? tasks.map(task => {
                const family = getAdminTaskFamily(task);
                const subtype = getAdminTaskSubtype(task);
                const subtypeMeta = getAdminTaskSubtypeMeta(family, subtype);
                const status = getAdminTaskEffectiveStatus(task);
                const isLive = status === 'active';
                const logo = task.logoUrl || task.imageUrl || task.iconUrl || getTaskLogoFromLink(family, subtype, task.taskLink);
                const expiresAt = timestampToMillis(task.expiresAt || task.autoCloseAt || task.closeAt);
                const closesText = isLive && expiresAt ? new Date(expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Off';
                const statusClass = {
                    active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
                    draft: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
                    paused: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
                    closed: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                }[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
                return `
                    <div class="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm hover:shadow-md transition flex flex-col justify-between min-h-[145px]">
                        <div class="flex items-start gap-2.5 min-w-0">
                            <span class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-1.5 dark:border-gray-700 dark:bg-gray-900">
                                <img src="${escapeHtml(logo)}" alt="${escapeHtml(subtypeMeta.label)}" class="h-full w-full object-contain" loading="lazy" decoding="async" onerror="this.src='${escapeHtml(subtypeMeta.logo)}'">
                            </span>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center justify-between gap-1">
                                    <span class="truncate text-[11px] font-bold text-gray-400 dark:text-gray-500">${escapeHtml(subtypeMeta.label)}</span>
                                    <span class="text-sm font-black text-emerald-600 dark:text-emerald-400 shrink-0">${formatCurrency(task.rate || task.reward || 0)}</span>
                                </div>
                                <h4 class="mt-0.5 text-sm font-black text-gray-900 dark:text-white truncate" title="${escapeHtml(task.title || subtypeMeta.label)}">${escapeHtml(task.title || subtypeMeta.label)}</h4>
                                <div class="mt-1 flex items-center gap-1 flex-wrap">
                                    <span class="rounded bg-cyan-50 dark:bg-cyan-900/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-700 dark:text-cyan-300">${escapeHtml(getAdminTaskFamilyLabel(family))}</span>
                                    <span class="rounded px-1.5 py-0.5 text-[9px] font-bold ${statusClass}">${isLive ? 'Live' : status === 'closed' ? 'Closed' : 'Off'}</span>
                                    <span class="text-[9px] font-bold text-gray-400 dark:text-gray-500">Lim: ${task.limit || 'Open'}</span>
                                    ${expiresAt ? `<span class="text-[9px] font-bold text-amber-600 dark:text-amber-400">Close: ${escapeHtml(closesText)}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="mt-3 pt-2 border-t border-gray-50 dark:border-gray-700/50 flex items-center justify-between gap-2">
                            <button type="button" data-action="toggle-admin-task-status" data-taskid="${task.id}" class="inline-flex items-center gap-1.5 text-xs font-black ${isLive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}">
                                <span class="relative inline-flex h-5 w-9 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'} transition">
                                    <span class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition transform ${isLive ? 'translate-x-4' : 'translate-x-0'}"></span>
                                </span>
                                ${isLive ? 'ON' : 'OFF'}
                            </button>
                            <div class="flex gap-1">
                                ${isAdminReviewTask(task) ? getAdminTaskIconButtonMini('manage-task-comments', task.id, 'Comments', '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a10.6 10.6 0 0 1-4.51-.98L3 20l1.26-3.78A7.55 7.55 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>', 'blue') : ''}
                                ${getAdminTaskIconButtonMini('edit-admin-task', task.id, 'Edit', '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 7.125 16.875 4.5"></path>', 'slate')}
                                ${getAdminTaskIconButtonMini('delete-admin-task', task.id, 'Delete', '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"></path>', 'red')}
                        </div>
                    </div>`;
            }).join('') : '<p class="md:col-span-2 rounded-2xl border border-dashed border-gray-200 py-8 text-center text-sm font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">No matching task found.</p>';
        };

const showAdminTaskCommentsPage = async (taskId) => {
            const task = allTasksCache.find(item => item.id === taskId);
            if (!task) return showNotification('Task not found.', true);
            
            const content = `
                ${getPageHeader(`Comments - ${escapeHtml(task.title || 'Task')}`)}
                <div class="max-w-2xl mx-auto space-y-6 pb-24 px-4">
                    <!-- Add Comment Form -->
                    <section class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-4">
                        <h3 class="text-base font-extrabold text-gray-900 dark:text-white">Add Review Comment</h3>
                        <div class="flex gap-2">
                            <input type="text" id="admin-comment-input" placeholder="Enter review comment..." class="flex-grow px-4 py-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm border border-gray-100 dark:border-gray-600">
                            <button id="admin-comment-add-btn" class="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shrink-0">Add</button>
                        </div>
                    </section>

                    <!-- Comments Listing & Tracking -->
                    <section class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-4">
                        <h3 class="text-base font-extrabold text-gray-900 dark:text-white">Review Comments & Reservations</h3>
                        <div id="admin-comments-container" class="divide-y divide-gray-100 dark:divide-gray-700">
                            <div class="py-6 text-center text-sm text-gray-400">Loading comments & reservations...</div>
                        </div>
                    </section>
                </div>
                ${getPageFooter()}`;

            showPage(content, { onBack: showAdminTaskPage, returnTo: 'admin', keepBottomNav: true });
            
            let reservations = [];
            try {
                const token = await getBackendAuthToken();
                const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-reservations/${encodeURIComponent(taskId)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }, 8000);
                const data = await resp.json().catch(() => ({}));
                if (data.ok && Array.isArray(data.reservations)) {
                    reservations = data.reservations;
                }
            } catch (err) {
                console.error('Failed to load active reservations:', err);
            }

            const renderComments = () => {
                const container = document.getElementById('admin-comments-container');
                if (!container) return;
                
                const comments = getTaskCommentPool(task);
                if (comments.length === 0) {
                    container.innerHTML = `<p class="py-6 text-center text-sm text-gray-400 italic">No comments added yet.</p>`;
                    return;
                }

                container.innerHTML = comments.map((comment, index) => {
                    const reservation = reservations.find(r => r.comment === comment);
                    let resInfo = '';
                    if (reservation) {
                        const remaining = Math.max(0, reservation.expiresAt - Date.now());
                        const mins = Math.floor(remaining / 60000);
                        const secs = Math.floor((remaining % 60000) / 1000);
                        const timeStr = remaining > 0 ? `${mins}m ${secs}s` : 'Expired';
                        resInfo = `
                            <div class="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-lg w-fit">
                                <span class="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Reserved by: ${escapeHtml(reservation.userName)} (${escapeHtml(reservation.userEmail)}) · Expires: ${timeStr}
                            </div>`;
                    }

                    return `
                        <div class="py-4 flex flex-col gap-1.5">
                            <div class="flex justify-between items-start gap-4">
                                <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">${index + 1}. "${escapeHtml(comment)}"</p>
                                <div class="flex gap-1 shrink-0">
                                    <button data-action="edit-comment-item" data-index="${index}" class="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                    </button>
                                    <button data-action="delete-comment-item" data-index="${index}" class="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                            </div>
                            ${resInfo}
                        </div>`;
                }).join('');

                container.querySelectorAll('[data-action="delete-comment-item"]').forEach(btn => {
                    btn.onclick = async (e) => {
                        const index = Number(e.currentTarget.dataset.index);
                        if (!confirm('Are you sure you want to delete this comment?')) return;
                        
                        const currentComments = getTaskCommentPool(task);
                        currentComments.splice(index, 1);
                        await saveTaskComments(taskId, currentComments);
                        renderComments();
                    };
                });

                container.querySelectorAll('[data-action="edit-comment-item"]').forEach(btn => {
                    btn.onclick = async (e) => {
                        const index = Number(e.currentTarget.dataset.index);
                        const currentComments = getTaskCommentPool(task);
                        const original = currentComments[index];
                        const updated = prompt('Edit review comment:', original);
                        if (updated === null) return;
                        const clean = updated.trim();
                        if (!clean) return showNotification('Comment cannot be empty.', true);
                        
                        currentComments[index] = clean;
                        await saveTaskComments(taskId, currentComments);
                        renderComments();
                    };
                });
            };

            const saveTaskComments = async (taskId, comments) => {
                try {
                    showLoading();
                    task.reviewComments = comments;
                    task.reviewComment = comments[0] || '';
                    task.commentToCopy = comments[0] || '';
                    
                    await updateDoc(doc(db, `artifacts/${appId}/public/data/tasks`, taskId), {
                        reviewComments: comments,
                        reviewComment: comments[0] || '',
                        commentToCopy: comments[0] || '',
                        updatedAt: serverTimestamp(),
                        updatedBy: currentUser.uid
                    });
                    hideLoading();
                    showNotification('Comments updated successfully.');
                } catch (err) {
                    hideLoading();
                    console.error('Failed to save comments:', err);
                    showNotification('Failed to save comments.', true);
                }
            };

            renderComments();

            document.getElementById('admin-comment-add-btn').onclick = async () => {
                const input = document.getElementById('admin-comment-input');
                const text = input.value.trim();
                if (!text) return showNotification('Please enter comment text.', true);
                
                const currentComments = getTaskCommentPool(task);
                currentComments.push(text);
                input.value = '';
                await saveTaskComments(taskId, currentComments);
                renderComments();
            };
        };

const showAdminTaskSubmissionsPage = async () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            currentMainSection = 'admin';
            adminSubmissionsView = {
                view: 'dates',
                selectedDate: null,
                selectedApp: null
            };
            const content = `
                ${getPageHeader('Task Submissions')}
                <div class="max-w-5xl mx-auto space-y-4 pb-24">
                    <section class="rounded-2xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-3">
                        <div class="flex flex-wrap items-center gap-2">
                            <input id="admin-sub-search" type="text" placeholder="Search user or task..." class="flex-1 min-w-[140px] rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500">
                            <select id="admin-sub-filter" class="rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-semibold">
                                <option value="all">All</option>
                                <option value="pending" selected>Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="paid">Paid</option>
                            </select>
                            <button id="admin-sub-refresh-btn" class="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 transition">Refresh</button>
                        </div>
                        <div id="admin-sub-list" class="space-y-3">
                            <div class="py-8 text-center text-sm text-gray-400">Loading submissions...</div>
                        </div>
                    </section>
                </div>`;
            showPage(content, { returnTo: 'admin', keepBottomNav: true });
            setBottomNavActive('bottom-admin-btn');
            loadAdminSubmissions();
            document.getElementById('admin-sub-refresh-btn')?.addEventListener('click', loadAdminSubmissions);
            document.getElementById('admin-sub-search')?.addEventListener('input', renderAdminSubmissions);
            document.getElementById('admin-sub-filter')?.addEventListener('change', renderAdminSubmissions);
        };

// Expose functions to window for global access
window.applyAdminTasksSnapshot = applyAdminTasksSnapshot;
window.getAdminTaskTypes = getAdminTaskTypes;
window.getAdminTaskFamilyLabel = getAdminTaskFamilyLabel;
window.getAdminTaskSubtypeMeta = getAdminTaskSubtypeMeta;
window.getAdminTaskFamily = getAdminTaskFamily;
window.getAdminTaskSubtype = getAdminTaskSubtype;
window.getAdminTaskEffectiveStatus = getAdminTaskEffectiveStatus;
window.getDefaultAdminTaskInstructions = getDefaultAdminTaskInstructions;
window.applyDefaultAdminTaskInstructions = applyDefaultAdminTaskInstructions;
window.renderAdminTaskSubtypeOptions = renderAdminTaskSubtypeOptions;
window.getAdminTaskIconButton = getAdminTaskIconButton;
window.getAdminTaskIconButtonMini = getAdminTaskIconButtonMini;
window.setAdminTaskPanel = setAdminTaskPanel;
window.showAdminTaskPage = showAdminTaskPage;
window.updateAdminTaskLogoPreview = updateAdminTaskLogoPreview;
window.renderAdminTaskNewsLinkInputs = renderAdminTaskNewsLinkInputs;
window.updateAdminTaskDynamicFields = updateAdminTaskDynamicFields;
window.getAdminTaskFormData = getAdminTaskFormData;
window.resetAdminTaskForm = resetAdminTaskForm;
window.handleSaveAdminTask = handleSaveAdminTask;
window.editAdminTask = editAdminTask;
window.handleToggleAdminTaskStatus = handleToggleAdminTaskStatus;
window.handleDeleteAdminTask = handleDeleteAdminTask;
window.handleEditAdminTaskComment = handleEditAdminTaskComment;
window.renderAdminTaskList = renderAdminTaskList;
window.showAdminTaskCommentsPage = showAdminTaskCommentsPage;
window.showAdminTaskSubmissionsPage = showAdminTaskSubmissionsPage;
