// File: src/pages/user/single/user-tasks.js

class TaskUploadQueueManager {
    constructor() {
        this.queue = {};
        this.isProcessing = {};
        this.callbacks = {};
    }

    registerCallback(taskId, callback) {
        if (!this.callbacks[taskId]) {
            this.callbacks[taskId] = [];
        }
        this.callbacks[taskId].push(callback);
    }

    unregisterCallback(taskId) {
        delete this.callbacks[taskId];
    }

    notify(taskId) {
        if (this.callbacks[taskId]) {
            this.callbacks[taskId].forEach(cb => cb());
        }
    }

    async enqueueTaskSubmission(taskId, submissionFn) {
        if (!this.queue[taskId]) {
            this.queue[taskId] = [];
        }
        
        return new Promise((resolve, reject) => {
            this.queue[taskId].push({ submissionFn, resolve, reject });
            this.processQueue(taskId);
        });
    }

    async processQueue(taskId) {
        if (this.isProcessing[taskId] || !this.queue[taskId] || this.queue[taskId].length === 0) {
            return;
        }

        this.isProcessing[taskId] = true;
        const item = this.queue[taskId].shift();

        try {
            const result = await item.submissionFn();
            item.resolve(result);
        } catch (error) {
            item.reject(error);
        } finally {
            this.isProcessing[taskId] = false;
            this.notify(taskId);
            this.processQueue(taskId);
        }
    }
}

window.TaskUploadQueueManager = new TaskUploadQueueManager();

const showUserTaskPage = () => {
    if (!ensureUserSessionReady()) return;
    currentMainSection = 'task';
    localStorage.setItem('last_active_section', 'task');
    const isTaskPageEnabled = true;

    const renderUI = (takenCommentsMap = {}, isBackground = false) => {
        if (currentMainSection !== 'task') return;
        
        let taskCategories = [];
        if (isTaskPageEnabled) {
            const appReviewItems = [];
            const mapReviewItems = [];
            const socialTaskItems = [];

            const isTaskVisibleToUser = (task) => {
                const userRole = String(currentUserData?.role || '').toLowerCase();
                const isOwner = currentUser?.uid === ADMIN_UID || currentUser?.email === 'reviewsworld51@gmail.com' || currentUser?.email === 'reviewsworld01@gmail.com' || userRole === 'owner';
                const isUserSubAdmin = userRole === 'admin' || userRole === 'subadmin';
                const userUid = currentUser?.uid || currentUserData?.uid || '';
                const parentAdminId = currentUserData?.parentAdmin || currentUserData?.parent_admin || currentUserData?.assignedSubAdmin || currentUserData?.subAdminId || '';

                const effectiveSubAdminId = isUserSubAdmin ? userUid : parentAdminId;
                const taskCreator = task.createdBy || '';
                const assigned = Array.isArray(task.assignedToSubAdmins) ? task.assignedToSubAdmins : [];

                const isOwnerTask = !taskCreator || taskCreator === ADMIN_UID || taskCreator === 'owner' || taskCreator === 'REVIEWS_WORLD_ADMIN' || taskCreator === 'reviewsworld01@gmail.com';

                if (isOwner) return isOwnerTask;
                if (assigned.includes('all')) return true;

                if (isOwnerTask) {
                    if (!effectiveSubAdminId || effectiveSubAdminId === ADMIN_UID) {
                        return assigned.length === 0;
                    } else {
                        return assigned.length === 0 || assigned.includes(effectiveSubAdminId);
                    }
                } else {
                    if (!effectiveSubAdminId || effectiveSubAdminId === ADMIN_UID) {
                        return false;
                    }
                    return taskCreator === effectiveSubAdminId || assigned.includes(effectiveSubAdminId);
                }
            };

            const isBulker = isBulkTaskUser();
            const hideNewTasksForDailyLimit = !isBulker && userTaskTodaySubmissionIds.size >= NORMAL_USER_DAILY_TASK_LIMIT;

            allTasksCache
                .filter(isTaskVisibleToUser)
                .filter(task => getAdminTaskEffectiveStatus(task) === 'active')
                .filter(task => {
                    const subtype = task.subtype || task.taskSubtype || '';
                    const isReview = subtype === 'app_review' || subtype === 'map_review' || subtype === 'trustpilot_review' || subtype === 'website_review';
                    if (isReview) {
                        const comments = getTaskCommentPool(task);
                        if (comments.length === 0) return false;

                        const taken = takenCommentsMap[task.id] || [];
                        const takenSet = new Set(taken.map(c => String(c).trim()));
                        const available = comments.filter(c => !takenSet.has(String(c).trim()));
                        if (available.length === 0) {
                            return false;
                        }
                    }
                    return true;
                })
                .filter(task => {
                    const isBulker = isBulkTaskUser();
                    if (typeof userTaskSubmissionIds !== 'undefined' && userTaskSubmissionIds && userTaskSubmissionIds.has(task.id)) {
                        if (!isBulker) {
                            return false;
                        }
                        const subtype = task.subtype || task.taskSubtype || '';
                        if (subtype === 'read_news') return false;
                        return userTaskTodaySubmissionIds.has(task.id);
                    }
                    return true;
                })
                .filter(() => !hideNewTasksForDailyLimit)
                .forEach(task => {
                    const subtype = task.subtype || task.taskSubtype || '';
                    if (subtype === 'app_review' || subtype === 'app_download_task') {
                        appReviewItems.push(task);
                    } else if (subtype === 'map_review' || subtype === 'trustpilot_review' || subtype === 'website_review') {
                        mapReviewItems.push(task);
                    } else {
                        socialTaskItems.push(task);
                    }
                });

            taskCategories = [
                {
                    label: 'App Review',
                    accent: 'task-accent-blue',
                    logo: PLAY_STORE_LOGO_URL,
                    items: appReviewItems
                },
                {
                    label: 'Map Review',
                    accent: 'task-accent-emerald',
                    logo: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
                    items: mapReviewItems
                },
                {
                    label: 'Social Media Task',
                    accent: 'task-accent-rose',
                    logo: 'https://cdn-icons-png.flaticon.com/512/4187/4187336.png',
                    items: socialTaskItems
                }
            ].filter(cat => cat.items.length > 0);
        }

        const renderTaskCard = (category, task, index) => {
            const isReal = isTaskPageEnabled;
            const status = isReal ? getAdminTaskEffectiveStatus(task) : 'draft';
            const isLive = isReal && status === 'active';
            const rewardVal = isReal ? getTaskRewardForUser(task, currentUserData) : (task.reward || 0);
            const reward = `₹${rewardVal}`;
            const imageUrl = isReal ? (task.imageUrl || category.logo) : category.logo;
            const taskTitle = isReal ? (task.title || 'Task Mission') : task.title;

            const subtype = task.subtype || task.taskSubtype || '';
            const acc = getTaskAccent(subtype);
            const taskTypeLabel = (subtype === 'app_review' || subtype === 'app_download_task') ? 'Play Store Review' : (subtype === 'map_review' ? 'Map Review' : 'Screenshot Task');
            const platformLabel = (subtype === 'app_review' || subtype === 'app_download_task') ? 'Play Store App Review' : (subtype === 'map_review' ? 'Google Maps Place Review' : 'Screenshot + Review');
            const platformLogo = (subtype === 'app_review' || subtype === 'app_download_task') ? PLAY_STORE_LOGO_URL : (subtype === 'map_review' ? 'https://cdn-icons-png.flaticon.com/512/854/854878.png' : 'https://cdn-icons-png.flaticon.com/512/4187/4187336.png');

            const payoutDelayText = getPayoutDelayText(task);
            const payoutVal = payoutDelayText.replace(' Payout', '');
            const approvalVal = payoutVal === 'Instant' ? 'Instant' : `${payoutVal} Later`;

            const totalSlots = getTaskCommentPool(task).length || 60;
            const takenList = Array.isArray(takenCommentsMap[task.id]) ? takenCommentsMap[task.id] : [];
            const submissionsCount = Math.max(task.submissionsCount || 0, takenList.length);

            if (isLive) {
                return `
                    <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[1.75rem] p-5 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 flex flex-col gap-4 cursor-pointer" data-action="open-user-task" data-taskid="${task.id}">
                        <!-- Top Row: Icon, Title & Reward -->
                        <div class="flex items-start justify-between gap-3 text-left">
                            <div class="flex items-center gap-3.5 min-w-0">
                                <div class="h-14 w-14 overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 shadow-inner">
                                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(taskTitle)}" class="h-full w-full object-cover">
                                </div>
                                <div class="min-w-0 flex flex-col">
                                    <span class="inline-flex rounded-lg px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider w-fit border ${acc.bgPill}">
                                        ${escapeHtml(taskTypeLabel)}
                                    </span>
                                    <h4 class="text-sm md:text-base font-black text-slate-950 dark:text-white mt-1.5 truncate pr-1 leading-tight">${escapeHtml(taskTitle)}</h4>
                                    <div class="flex items-center gap-1.5 mt-1 text-[10px] text-gray-500">
                                        <img src="${platformLogo}" alt="platform" class="h-3.5 w-3.5 object-contain shrink-0">
                                        <span>${escapeHtml(platformLabel)}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex flex-col items-end shrink-0">
                                <span class="text-lg md:text-xl font-black text-${acc.color}-600 dark:text-${acc.color}-400">${escapeHtml(reward)}</span>
                                <span class="text-[8px] font-black text-gray-400 uppercase tracking-wider mt-0.5">Per Approve</span>
                            </div>
                        </div>

                        <div class="border-t border-slate-100 dark:border-slate-800/80"></div>

                        <div class="grid grid-cols-3 gap-2 py-1 text-left">
                            <div class="flex items-center gap-2">
                                <span class="p-1.5 rounded-lg bg-${acc.color}-500/10 ${acc.textClass} shrink-0">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"></path></svg>
                                </span>
                                <div class="min-w-0">
                                    <p class="text-[8px] font-black text-gray-400 uppercase tracking-wider leading-none">Payout</p>
                                    <p class="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">${escapeHtml(payoutVal)}</p>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 border-l border-slate-100 dark:border-slate-800/80 pl-2">
                                <span class="p-1.5 rounded-lg bg-${acc.color}-500/10 ${acc.textClass} shrink-0">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </span>
                                <div class="min-w-0">
                                    <p class="text-[8px] font-black text-gray-400 uppercase tracking-wider leading-none">Approval</p>
                                    <p class="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">${escapeHtml(approvalVal)}</p>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 border-l border-slate-100 dark:border-slate-800/80 pl-2">
                                <span class="p-1.5 rounded-lg bg-${acc.color}-500/10 ${acc.textClass} shrink-0">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                </span>
                                <div class="min-w-0">
                                    <p class="text-[8px] font-black text-gray-400 uppercase tracking-wider leading-none">Used</p>
                                    <p class="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">${submissionsCount}/${totalSlots}</p>
                                </div>
                            </div>
                        </div>

                        <button class="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-200 active:scale-[0.99] shadow-sm ${acc.bgBtn}" data-action="open-user-task" data-taskid="${task.id}">
                            <span>Start Task</span>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                    </div>`;
            } else {
                return '';
            }
        };

        const renderCategory = (category) => `
            <section class="task-category-block ${category.accent} mb-6">
                <div class="task-category-title flex items-center gap-2 mb-3">
                    <span class="task-category-mark h-4 w-1 bg-indigo-600 dark:bg-indigo-400 rounded-full"></span>
                    <h3 class="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">${escapeHtml(category.label)}</h3>
                </div>
                <div class="flex flex-col gap-4">
                    ${category.items.map((task, index) => renderTaskCard(category, task, index)).join('')}
                </div>
            </section>`;

        let bodyContent = '';
        if (taskCategories.length === 0) {
            bodyContent = `
                <div class="rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center bg-white dark:bg-gray-800 shadow-sm">
                    <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 mb-4">
                        <img src="https://cdn-icons-png.flaticon.com/512/3176/3176366.png" alt="Coming soon" class="h-8 w-8 object-contain">
                    </div>
                    <h3 class="text-lg font-black text-gray-900 dark:text-white">Missions Coming Soon</h3>
                    <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">New activities and updates are coming soon. Keep the app updated for future releases.</p>
                </div>`;
        } else {
            bodyContent = taskCategories.map(renderCategory).join('');
        }

        const shellContainer = document.querySelector('.task-page-shell .max-w-xl');
        if (shellContainer && currentMainSection === 'task') {
            shellContainer.innerHTML = bodyContent;
        } else if (!isBackground) {
            const content = `
                <header class="mb-4 bg-white/95 px-4 py-3 shadow-sm backdrop-blur page-header-fixed dark:bg-gray-900/95">
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-lg font-black uppercase text-slate-950 dark:text-white">RW TASK</p>
                        </div>
                        <div class="task-header-actions">
                            <button type="button" data-action="open-task-ads-page" class="task-mini-action">
                                <img src="https://cdn-icons-png.flaticon.com/512/2659/2659360.png" alt="Ads" loading="eager" decoding="async">
                                <span>Ads</span>
                            </button>
                            <button type="button" data-action="open-task-bonus-page" class="task-mini-action">
                                <img src="https://cdn-icons-png.flaticon.com/512/2611/2611152.png" alt="Bonus" loading="eager" decoding="async">
                                <span>Bonus</span>
                            </button>
                        </div>
                    </div>
                </header>
                <div class="task-page-shell px-4 pt-1 pb-28">
                    <div class="mx-auto max-w-xl space-y-4">
                        ${bodyContent}
                    </div>
                </div>
                ${getPageFooter()}`;
            
            showPage(content, { returnTo: currentUser?.uid === ADMIN_UID ? 'admin' : 'home', keepBottomNav: true });
            setBottomNavActive('bottom-task-btn');
        }
    };

    renderUI(window.lastTakenCommentsMap || {}, false);

    fetchTaskCommentsRealtimeMap().then(map => {
        window.lastTakenCommentsMap = map;
        renderUI(map, true);
    }).catch(err => {
        console.warn('Realtime comments map fetch failed:', err);
    });
};

window.showUserTaskPage = showUserTaskPage;
