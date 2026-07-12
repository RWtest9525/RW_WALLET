// File: src/pages/admin/admin-submissions.js

window.showAdminSubmissionDetailModal = function(index) {
            const list = window.currentActiveSubmissions || [];
            if (!list || index < 0 || index >= list.length) return;

            const s = list[index];
            const statusColor = s.manual_status === 'approved' ? 'emerald' : s.manual_status === 'rejected' ? 'rose' : 'amber';
            const statusLabel = s.manual_status === 'pending' ? 'PENDING' : s.manual_status === 'approved' ? 'APPROVED' : 'REJECTED';
            const payoutBadge = s.payout_status === 'paid' ? '<span class="rounded-full bg-cyan-500 text-white px-2.5 py-0.5 text-[9px] font-black tracking-wider uppercase shadow-sm">PAID</span>' : '';
            const ocrBadge = s.ocr_status === 'completed' ? '🟢' : s.ocr_status === 'failed' ? '🔴' : '⏳';
            const timeStr = s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unknown';
            
            let details = {};
            try { details = s.details_json ? JSON.parse(s.details_json) : {}; } catch {}
            const gmailLogoUrl = details.gmailLogoUrl || '';
            const gmailName = s.ocr_extracted_name || '';
            const rawOcrText = s.ocr_extracted_text || s.ocrExtractedText || '';
            const extractedReviewText = window.extractActualReviewText(rawOcrText, gmailName);

            let liveBadge = '';
            if (s.scraper_status === 'live_confirmed') {
                liveBadge = '<span class="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[9px] font-black text-emerald-700 dark:text-emerald-300">🟢 LIVE</span>';
            } else if (s.scraper_status === 'not_live') {
                liveBadge = '<span class="rounded-full bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 text-[9px] font-black text-rose-700 dark:text-rose-300">🔴 NOT LIVE</span>';
            } else {
                liveBadge = '<span class="rounded-full bg-gray-150 dark:bg-gray-700 px-2 py-0.5 text-[9px] font-black text-gray-500 dark:text-gray-400">⏳ UNCHECKED</span>';
            }

            // Remove existing modal if any
            const existing = document.getElementById('admin-detail-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'admin-detail-modal';
            modal.className = 'fixed inset-0 z-[9990] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 transition-all duration-300';
            
            modal.innerHTML = `
                <!-- Prev Button -->
                ${index > 0 ? `<button id="modal-prev-btn" class="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 h-12 w-12 flex items-center justify-center rounded-full bg-gray-800/60 hover:bg-gray-800 text-white hover:scale-105 active:scale-95 transition shrink-0 z-50 text-xl font-bold">‹</button>` : ''}

                <!-- Container -->
                <div class="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl border border-gray-150 dark:border-gray-850 shadow-2xl overflow-y-auto max-h-[90vh]">
                    <!-- Close Button -->
                    <button id="modal-close-btn" class="absolute top-4 right-4 z-50 h-8 w-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white text-sm font-bold transition">✕</button>

                    <!-- Left: Image -->
                    <div class="w-full bg-gray-950 flex items-center justify-center p-4 relative select-none">
                        <img id="admin-detail-screenshot-img" src="${escapeHtml(s.screenshot_url)}" alt="Screenshot" class="max-w-full max-h-[60vh] object-contain rounded-xl border border-gray-800 shadow-lg cursor-zoom-in">
                    </div>

                    <!-- Right: Info Panel -->
                    <div class="w-full p-5 flex flex-col justify-between border-t border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                        <div class="space-y-4">
                            <!-- Header Info: Status, Gmail Name, Mobile No, Submitted Time -->
                            <div class="text-left bg-white dark:bg-gray-850 p-4 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm">
                                <div class="flex items-center justify-between">
                                    <span class="rounded-xl bg-${statusColor}-500 text-white font-extrabold px-3 py-1 text-[10px] tracking-wider uppercase shadow-sm">${statusLabel}</span>
                                    ${payoutBadge}
                                </div>
                                <div class="mt-3 flex items-center gap-2">
                                    ${gmailLogoUrl ? `<img src="${escapeHtml(gmailLogoUrl)}" class="h-9 w-9 rounded-full object-cover border border-gray-200 dark:border-gray-700 shrink-0">` : `<span class="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950 text-xs font-bold text-orange-600 shrink-0">G</span>`}
                                    <div class="min-w-0 flex-1">
                                        <p class="text-[9px] font-black uppercase text-gray-400 tracking-wider">Gmail Reviewer</p>
                                        <h3 class="text-base font-extrabold text-gray-900 dark:text-white truncate">${escapeHtml(gmailName || 'Unknown User')}</h3>
                                    </div>
                                </div>
                                <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-750 flex items-center justify-between text-[11px]">
                                    <span class="font-bold text-orange-500">📱 ${escapeHtml(s.user_mobile || 'No mobile registered')}</span>
                                    <span class="text-gray-450 font-semibold">${timeStr}</span>
                                </div>
                            </div>

                            <!-- Comment -->
                            <div class="rounded-2xl bg-white dark:bg-gray-850 p-4 border border-gray-150 dark:border-gray-800 shadow-sm text-left">
                                <p class="text-[9px] font-black uppercase text-gray-400 tracking-wider">Assigned Comment</p>
                                <p class="mt-1.5 text-xs font-bold text-gray-800 dark:text-gray-250 italic">"${escapeHtml(s.assigned_comment || '')}"</p>
                            </div>
                            <!-- Screenshot Review Text -->
                            <div class="rounded-2xl bg-white dark:bg-gray-850 p-4 border border-gray-150 dark:border-gray-800 shadow-sm text-left">
                                <p class="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">Screenshot Review Text</p>
                                <p class="mt-1.5 text-xs font-extrabold text-gray-900 dark:text-white leading-relaxed bg-purple-50/50 dark:bg-purple-950/10 p-3 rounded-xl border border-purple-100/80 dark:border-purple-900/50">
                                    ${escapeHtml(extractedReviewText || 'Not found in screenshot')}
                                </p>
                            </div>

                            <!-- Check badges -->
                            <div class="flex items-center justify-between text-[10px] text-gray-450 border-t border-gray-150 dark:border-gray-850 pt-3">
                                <div class="flex items-center gap-1"><span>Live check:</span> ${liveBadge}</div>
                                <div class="flex items-center gap-1"><span>OCR:</span> ${ocrBadge}</div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="mt-6 border-t border-gray-150 dark:border-gray-800 pt-4 space-y-2">
                            <div class="grid grid-cols-2 gap-2">
                                ${s.manual_status === 'pending' ? `
                                    <button id="modal-approve-btn" class="rounded-xl bg-green-600 py-2.5 text-xs font-black text-white hover:bg-green-700 active:scale-98 transition">✅ Approve</button>
                                    <button id="modal-reject-btn" class="rounded-xl bg-red-600 py-2.5 text-xs font-black text-white hover:bg-red-700 active:scale-98 transition">❌ Reject</button>
                                ` : ''}
                                ${s.manual_status === 'approved' && s.payout_status !== 'paid' ? `
                                    <button id="modal-pay-btn" class="col-span-2 rounded-xl bg-cyan-600 py-2.5 text-xs font-black text-white hover:bg-cyan-700 active:scale-98 transition">💰 Pay Now</button>
                                ` : ''}
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <button id="modal-ocr-btn" class="rounded-xl bg-purple-600 py-2 text-xs font-black text-white hover:bg-purple-700 active:scale-98 transition">🤖 OCR</button>
                                <button id="modal-check-btn" class="rounded-xl bg-indigo-600 py-2 text-xs font-black text-white hover:bg-indigo-700 active:scale-98 transition">🔎 Check</button>
                            </div>
                            <button id="modal-download-jpg-btn" class="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white hover:bg-blue-700 active:scale-98 transition">📥 Download JPG</button>
                        </div>
                    </div>
                </div>

                <!-- Next Button -->
                ${index < list.length - 1 ? `<button id="modal-next-btn" class="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 h-12 w-12 flex items-center justify-center rounded-full bg-gray-800/60 hover:bg-gray-800 text-white hover:scale-105 active:scale-95 transition shrink-0 z-50 text-xl font-bold">›</button>` : ''}
            `;

            document.body.appendChild(modal);

            // Bind image lightbox
            const screenshotImg = document.getElementById('admin-detail-screenshot-img');
            if (screenshotImg) {
                screenshotImg.onclick = () => {
                    window.showScreenshotLightbox(s.screenshot_url, s.view_url || s.screenshot_view_url || '');
                };
            }

            // Close actions
            const closeModal = () => {
                modal.remove();
                document.removeEventListener('keydown', keyHandler);
            };
            modal.onclick = (e) => {
                if (e.target === modal) closeModal();
            };
            const closeBtn = document.getElementById('modal-close-btn');
            if (closeBtn) closeBtn.onclick = closeModal;

            // Nav actions
            const prevBtn = document.getElementById('modal-prev-btn');
            if (prevBtn) prevBtn.onclick = () => {
                closeModal();
                window.showAdminSubmissionDetailModal(index - 1);
            };
            const nextBtn = document.getElementById('modal-next-btn');
            if (nextBtn) nextBtn.onclick = () => {
                closeModal();
                window.showAdminSubmissionDetailModal(index + 1);
            };

            // Keyboard nav
            const keyHandler = (e) => {
                if (e.key === 'ArrowLeft' && index > 0) {
                    closeModal();
                    window.showAdminSubmissionDetailModal(index - 1);
                } else if (e.key === 'ArrowRight' && index < list.length - 1) {
                    closeModal();
                    window.showAdminSubmissionDetailModal(index + 1);
                } else if (e.key === 'Escape') {
                    closeModal();
                }
            };
            document.addEventListener('keydown', keyHandler);

            document.getElementById('modal-download-jpg-btn')?.addEventListener('click', () => {
                const appName = s.app_name || 'App';
                const firstWord = appName.split(' ')[0] || 'App';
                const sanitizedFirstWord = firstWord.replace(/[^a-zA-Z0-9]/g, '');
                const dateStr = s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-IN').replace(/\//g, '-') : 'Date';
                const filename = `${sanitizedFirstWord}_${dateStr}_screenshot_${s.id || index}.jpg`;
                window.downloadScreenshotAsJpg(s.screenshot_url, filename);
            });

            // Bind Action Buttons inside Modal
            const subId = s.id;
            const bindAction = (btnId, callback) => {
                const btn = document.getElementById(btnId);
                if (!btn) return;
                btn.onclick = async () => {
                    const originalText = btn.textContent;
                    btn.disabled = true;
                    btn.textContent = 'Processing...';
                    try {
                        await callback();
                        // Reload data in background
                        await loadAdminSubmissions();
                        // Re-render admin screen
                        renderAdminSubmissions();
                        // Re-open/update modal with new data
                        closeModal();
                        window.showAdminSubmissionDetailModal(index);
                    } catch (err) {
                        console.error('Modal action failed:', err);
                        showNotification('Action failed. Please try again.', true);
                        btn.disabled = false;
                        btn.textContent = originalText;
                    }
                };
            };

            bindAction('modal-approve-btn', async () => {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions/${encodeURIComponent(subId)}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ manualStatus: 'approved', verifiedAt: Date.now() })
                }, 8000);
                showNotification('Submission approved.');
            });

            bindAction('modal-reject-btn', async () => {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions/${encodeURIComponent(subId)}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ manualStatus: 'rejected' })
                }, 8000);
                showNotification('Submission rejected.');
            });

            bindAction('modal-pay-btn', async () => {
                const token = await getBackendAuthToken();
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions/${encodeURIComponent(subId)}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payoutStatus: 'paid', paidAt: Date.now() })
                }, 8000);
                showNotification('Payment credited.');
            });

            bindAction('modal-ocr-btn', async () => {
                showNotification('Running OCR...');
                const token = await getBackendAuthToken();
                const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/ocr-process/${encodeURIComponent(subId)}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                }, 20000);
                const ocrData = await resp.json().catch(() => ({}));
                showNotification(ocrData.ok ? `OCR complete: ${(ocrData.ocr?.text || '').slice(0, 80)}` : 'OCR failed');
            });

            bindAction('modal-check-btn', async () => {
                showNotification('Checking Live list...');
                const token = await getBackendAuthToken();
                const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/scraper/check-review`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        submissionId: subId,
                        taskLink: s.task_link || '',
                        assignedComment: s.assigned_comment || '',
                        appName: s.app_name || ''
                    })
                }, 10000);
                const resData = await resp.json().catch(() => ({}));
                if (resData.ok && resData.result) {
                    if (resData.result.found) {
                        showNotification('Review verified in Live List!');
                    } else {
                        showNotification('Not found in Live List.', true);
                    }
                } else {
                    showNotification('Live check failed.', true);
                }
            });
        };

window.extractReviewerName = async (ocrText, targetComment) => {
            if (!ocrText) return 'Unknown User';
            try {
                const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
                
                const skipPatterns = [
                    /^\d{1,2}:\d{2}/,               // Time (e.g., "10:30")
                    /^\d{1,3}%$/,                   // Battery percentage
                    /LTE|WIFI|4G|5G|VoLTE|KB\/S/i,  // Carrier + Data speed
                    /Google Play/i,                 // "Google Play" header
                    /^Search/i, /^Apps/i, /^Games/i, /^Offers/i,
                    /^Movies/i, /^Books/i,
                    /^Ratings and reviews/i,
                    /^See all reviews/i,
                    /^Post/i, /^Cancel/i,
                    /^Edit your review/i,
                    /^Edit/i,
                    /^Episode/i,
                    /^[★☆* ]+\d{1,2}/,             // Star ratings
                    /^[0-9.]+ stars/,
                    /^[0-9.,]+ reviews/,
                    /^[0-9.]+ [KMG]B/,             // App size
                    /No reviews/i,
                    /VoLTE/i, /KB\/S/i,
                    /Personal into/i,
                    /No data collected/i,
                    /Developer contact/i,
                    /About this app/i,
                    /Rate this app/i,
                    /Tell us what you think/i,
                    /Write a review/i,
                    /Safety/i, /Data privacy/i, /Security/i, /Verified/i,
                ];

                let reviewerName = 'Unknown User';

                // STEP 1: Look for "Your review" header in the text
                const yourReviewPattern = /Your review/i;
                let yourReviewIdx = -1;

                for (let i = 0; i < lines.length; i++) {
                    if (yourReviewPattern.test(lines[i])) {
                        yourReviewIdx = i;
                        break;
                    }
                }

                if (yourReviewIdx !== -1) {
                    // Name is usually in the next 3 lines after "Your review"
                    for (let j = 1; j <= 3; j++) {
                        if (yourReviewIdx + j < lines.length) {
                            const line = lines[yourReviewIdx + j];
                            const isSystemLine = skipPatterns.some(p => p.test(line));
                            if (!isSystemLine && line.length > 2 && /[a-zA-Z]/.test(line) && line.length < 35) {
                                reviewerName = line;
                                break;
                            }
                        }
                    }
                }

                // Fallback Logic: first non-system line matching criteria
                if (reviewerName === 'Unknown User' || reviewerName === 'Unknown') {
                    for (const line of lines) {
                        const isSystemLine = skipPatterns.some(p => p.test(line));
                        if (!isSystemLine && line.length > 2 && /[a-zA-Z]/.test(line) && line.length < 35) {
                            reviewerName = line;
                            break;
                        }
                    }
                }

                return reviewerName;
            } catch (err) {
                console.warn('extractReviewerName failed:', err);
                return 'Unknown User';
            }
        };

const loadAdminSubmissions = async () => {
            if (adminSubmissionsLoading) return;
            adminSubmissionsLoading = true;
            try {
                const token = await getBackendAuthToken();
                const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions?limit=500`, {
                    headers: { Authorization: `Bearer ${token}` }
                }, 15000);
                const data = await response.json().catch(() => ({}));
                if (data.ok && Array.isArray(data.submissions)) {
                    adminSubmissionsCache = data.submissions;
                }
            } catch (err) {
                console.warn('Backend submissions load failed, falling back to Firebase:', err);
                try {
                    const snap = await getDocs(query(
                        collection(db, `artifacts/${appId}/public/data/task_submissions`),
                        orderBy('submittedAt', 'desc'),
                        limit(500)
                    ));
                    adminSubmissionsCache = snap.docs.map(d => {
                        const data = d.data();
                        return {
                            id: d.id,
                            task_id: data.taskId,
                            user_id: data.userId,
                            user_name: data.userName || '',
                            user_email: data.userEmail || '',
                            app_name: data.appName || data.taskTitle || '',
                            assigned_comment: data.assignedComment || '',
                            screenshot_url: data.screenshotUrl || '',
                            manual_status: data.manualStatus || 'pending',
                            ocr_status: data.ocrStatus || 'pending',
                            ocr_extracted_name: data.ocrExtractedName || '',
                            ocr_extracted_text: data.ocrExtractedText || '',
                            details_json: JSON.stringify({ gmailLogoUrl: data.ocrExtractedLogoUrl || '' }),
                            scraper_status: data.scraperStatus || 'not_configured',
                            payout_status: data.payoutStatus || 'pending',
                            reward: Number(data.reward || 0),
                            task_link: data.taskLink || '',
                            submitted_at: timestampToMillis(data.submittedAt),
                            _source: 'firebase'
                        };
                    });
                } catch (fbErr) {
                    console.error('Firebase submissions also failed:', fbErr);
                }
            }
            adminSubmissionsLoading = false;
        };

const getSubmissionLocalDateStr = (submittedAt) => {
    if (!submittedAt) return '';
    const d = new Date(timestampToMillis(submittedAt));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDatePickerDate = (dateStr) => {
    if (!dateStr) return 'Select Date';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

const renderAdminSubmissions = () => {
    const shellEl = document.getElementById('admin-submissions-page-shell');
    if (!shellEl) return;

    if (typeof adminSubmissionsView === 'undefined') {
        const d = new Date();
        window.adminSubmissionsView = {
            view: 'overview',
            selectedDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            selectedTaskId: '',
            selectedDetailTab: 'submissions',
            selectedSubFilter: 'all'
        };
    }

    const selectedDate = adminSubmissionsView.selectedDate;

    // Filter submissions by ownership
    let subs = [...adminSubmissionsCache];
    const isOwner = currentUser?.uid === ADMIN_UID || currentUser?.email === 'reviewsworld51@gmail.com' || currentUser?.email === 'reviewsworld01@gmail.com' || currentUserData?.role === 'owner';
    if (isOwner) {
        subs = subs.filter(sub => {
            const task = allTasksCache.find(t => t.id === (sub.task_id || sub.taskId));
            const isOwnerTask = !task || !task.createdBy || task.createdBy === ADMIN_UID || task.createdBy === 'owner';
            return isOwnerTask;
        });
    } else {
        subs = subs.filter(sub => {
            const task = allTasksCache.find(t => t.id === (sub.task_id || sub.taskId));
            return task && task.createdBy === currentUser.uid;
        });
    }

    // Filter by selected date
    const dateSubs = subs.filter(s => getSubmissionLocalDateStr(s.submitted_at || s.submittedAt) === selectedDate);

    let html = '';

    if (adminSubmissionsView.view === 'overview') {
        // Compute overview stats for the date
        const totalSubmissions = dateSubs.length;
        const ocrPassed = dateSubs.filter(s => s.ocr_status === 'completed').length;
        const pendingVerify = dateSubs.filter(s => s.manual_status === 'pending').length;
        const approvedCount = dateSubs.filter(s => s.manual_status === 'approved').length;
        const rejectedCount = dateSubs.filter(s => s.manual_status === 'rejected').length;
        
        const activeTaskIds = new Set(dateSubs.map(s => s.task_id || s.taskId).filter(Boolean));
        const totalTasksCount = activeTaskIds.size;

        // Group rows by active tasks on this date
        const taskRows = allTasksCache.map(task => {
            const taskSubs = dateSubs.filter(s => s.task_id === task.id || s.taskId === task.id);
            return {
                id: task.id,
                name: task.appName || task.title || 'Task',
                total: taskSubs.length,
                ocrPassed: taskSubs.filter(s => s.ocr_status === 'completed').length,
                pending: taskSubs.filter(s => s.manual_status === 'pending').length,
                approved: taskSubs.filter(s => s.manual_status === 'approved').length,
                rejected: taskSubs.filter(s => s.manual_status === 'rejected').length
            };
        }).filter(r => r.total > 0 || r.approved > 0 || r.pending > 0);

        html = `
            <!-- Date Picker Header -->
            <div class="flex items-center justify-between gap-4 px-5 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 shadow-sm">
                <h1 class="text-base md:text-lg font-black uppercase text-slate-950 dark:text-white tracking-wider">Submissions</h1>
                <div class="flex items-center gap-2">
                    <button id="admin-sub-refresh-btn" class="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95 border border-slate-200/30 shadow-sm" title="Refresh">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12"></path></svg>
                    </button>
                    <div class="relative flex items-center">
                        <input type="date" id="admin-sub-date-input" value="${selectedDate}" class="absolute inset-0 opacity-0 cursor-pointer z-10">
                        <button type="button" class="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-slate-800 dark:text-slate-200 border border-slate-200/40 shadow-sm">
                            <span>${formatDatePickerDate(selectedDate)}</span>
                            <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="px-5 py-4">
                <h2 class="text-xs font-black uppercase text-slate-400 tracking-wider mb-3 text-left">Today's Overview</h2>
                <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <div class="bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-900/40 rounded-2xl p-4 text-left shadow-sm">
                        <p class="text-2xl font-black text-purple-600 dark:text-purple-400">${totalTasksCount}</p>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1.5 leading-none">Total Tasks</p>
                    </div>
                    <div class="bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-4 text-left shadow-sm">
                        <p class="text-2xl font-black text-blue-600 dark:text-blue-400">${totalSubmissions}</p>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1.5 leading-none">Total Submissions</p>
                    </div>
                    <div class="bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 text-left shadow-sm">
                        <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${ocrPassed}</p>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1.5 leading-none">OCR Passed</p>
                    </div>
                    <div class="bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/40 rounded-2xl p-4 text-left shadow-sm">
                        <p class="text-2xl font-black text-amber-600 dark:text-amber-400">${pendingVerify}</p>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1.5 leading-none">Pending Verify</p>
                    </div>
                    <div class="bg-white dark:bg-slate-900 border border-green-100 dark:border-green-900/40 rounded-2xl p-4 text-left shadow-sm">
                        <p class="text-2xl font-black text-green-600 dark:text-green-400">${approvedCount}</p>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1.5 leading-none">Approved</p>
                    </div>
                    <div class="bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/40 rounded-2xl p-4 text-left shadow-sm">
                        <p class="text-2xl font-black text-red-600 dark:text-red-400">${rejectedCount}</p>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1.5 leading-none">Rejected</p>
                    </div>
                </div>
            </div>

            <!-- Table Section -->
            <div class="px-5 py-2">
                <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[1.75rem] overflow-hidden shadow-sm">
                    <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 text-left">
                        <h2 class="text-xs font-black uppercase text-slate-400 tracking-wider">Task Wise Overview</h2>
                    </div>
                    ${taskRows.length === 0 ? `
                        <div class="py-12 text-center text-sm text-gray-400">No submissions found on this date.</div>
                    ` : `
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse text-xs md:text-sm">
                                <thead>
                                    <tr class="border-b border-slate-100 dark:border-slate-800/80 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50/50 dark:bg-slate-950/20">
                                        <th class="py-3.5 px-5">Task Name</th>
                                        <th class="py-3.5 px-5 text-center">Total Submissions</th>
                                        <th class="py-3.5 px-5 text-center">OCR Passed</th>
                                        <th class="py-3.5 px-5 text-center">Pending Verify</th>
                                        <th class="py-3.5 px-5 text-center">Approved</th>
                                        <th class="py-3.5 px-5 text-center">Rejected</th>
                                        <th class="py-3.5 px-5 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80 font-bold text-slate-700 dark:text-slate-200">
                                    ${taskRows.map(r => `
                                        <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td class="py-4 px-5 text-left font-extrabold text-slate-900 dark:text-white">${escapeHtml(r.name)}</td>
                                            <td class="py-4 px-5 text-center">${r.total}</td>
                                            <td class="py-4 px-5 text-center text-emerald-600 dark:text-emerald-400">${r.ocrPassed}</td>
                                            <td class="py-4 px-5 text-center text-amber-600 dark:text-amber-400">${r.pending}</td>
                                            <td class="py-4 px-5 text-center text-green-600 dark:text-green-400">${r.approved}</td>
                                            <td class="py-4 px-5 text-center text-red-600 dark:text-red-400">${r.rejected}</td>
                                            <td class="py-4 px-5 text-center">
                                                <button type="button" data-action="view-task-detail" data-taskid="${r.id}" class="rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 px-4 py-2 text-xs font-black tracking-wider uppercase transition shadow-sm active:scale-95">View</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    } else if (adminSubmissionsView.view === 'task_detail') {
        const taskId = adminSubmissionsView.selectedTaskId;
        const task = allTasksCache.find(t => t.id === taskId);
        const taskName = task ? (task.appName || task.title) : 'Task';

        const taskSubs = dateSubs.filter(s => s.task_id === taskId || s.taskId === taskId);

        // Filter chips counts
        const countAll = taskSubs.length;
        const countOcr = taskSubs.filter(s => s.ocr_status === 'completed').length;
        const countPending = taskSubs.filter(s => s.manual_status === 'pending').length;
        const countRejected = taskSubs.filter(s => s.manual_status === 'rejected').length;

        // Apply filter tab selection
        let filteredSubs = [...taskSubs];
        if (adminSubmissionsView.selectedSubFilter === 'ocr_passed') {
            filteredSubs = filteredSubs.filter(s => s.ocr_status === 'completed');
        } else if (adminSubmissionsView.selectedSubFilter === 'pending') {
            filteredSubs = filteredSubs.filter(s => s.manual_status === 'pending');
        } else if (adminSubmissionsView.selectedSubFilter === 'rejected') {
            filteredSubs = filteredSubs.filter(s => s.manual_status === 'rejected');
        }

        window.currentActiveSubmissions = filteredSubs; // Cache list for detail modal

        html = `
            <!-- Task Detail Header -->
            <div class="flex items-center justify-between gap-4 px-5 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 shadow-sm">
                <div class="flex items-center gap-3">
                    <button type="button" id="admin-sub-back-btn" class="rounded-full p-2 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </button>
                    <h2 class="text-base font-black text-slate-950 dark:text-white">Task Detail - ${escapeHtml(taskName)}</h2>
                </div>
                <span class="rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider shadow-sm select-all">Task ID: ${escapeHtml(taskId)}</span>
            </div>

            <div class="px-5 py-4">
                <!-- Navigation Tabs -->
                <div class="flex items-center gap-6 border-b border-slate-100 dark:border-slate-800/80 px-4 py-1 mb-4 overflow-x-auto scrollbar-none text-xs md:text-sm">
                    ${['overview', 'submissions', 'failed', 'play_store_verify', 'payments'].map(tab => {
                        const isActive = adminSubmissionsView.selectedDetailTab === tab;
                        const labels = {
                            overview: 'Overview',
                            submissions: 'Submissions',
                            failed: 'Failed',
                            play_store_verify: 'Play Store Verify',
                            payments: 'Payments'
                        };
                        return `
                            <button type="button" data-action="select-detail-tab" data-tab="${tab}" class="py-2.5 font-bold uppercase tracking-wider relative shrink-0 transition-colors ${isActive ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400 hover:text-slate-650 dark:hover:text-slate-350'}" style="outline: none;">
                                ${labels[tab]}
                                ${isActive ? '<span class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"></span>' : ''}
                            </button>
                        `;
                    }).join('')}
                </div>

                <!-- Submissions Tab View -->
                ${adminSubmissionsView.selectedDetailTab !== 'submissions' ? `
                    <div class="py-12 text-center text-sm text-gray-400">
                        <p class="font-extrabold uppercase tracking-wide text-slate-400 dark:text-slate-500">${escapeHtml(adminSubmissionsView.selectedDetailTab)} Panel</p>
                        <p class="text-xs text-gray-500 mt-1">This section is configured to run automatically.</p>
                    </div>
                ` : `
                    <!-- Submissions Filter Chips -->
                    <div class="flex flex-wrap items-center gap-2 mb-5">
                        ${[
                            { value: 'all', label: `All (${countAll})` },
                            { value: 'ocr_passed', label: `OCR Passed (${countOcr})` },
                            { value: 'pending', label: `Pending (${countPending})` },
                            { value: 'rejected', label: `Rejected (${countRejected})` }
                        ].map(chip => {
                            const isActive = adminSubmissionsView.selectedSubFilter === chip.value;
                            return `
                                <button type="button" data-action="select-sub-filter" data-filter="${chip.value}" class="rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-200 border ${isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/80 shadow-sm'}">
                                    ${chip.label}
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <!-- Screenshot Grid -->
                    ${filteredSubs.length === 0 ? `
                        <div class="py-12 text-center text-sm text-gray-400">No screenshots found matching this filter.</div>
                    ` : `
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            ${filteredSubs.map((s, idx) => {
                                let badgeClass = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
                                let label = 'Pending Verify';
                                if (s.manual_status === 'approved') {
                                    badgeClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
                                    label = 'OCR Passed';
                                } else if (s.manual_status === 'rejected') {
                                    badgeClass = 'bg-red-500/10 text-red-600 border-red-500/20';
                                    label = 'Rejected';
                                }
                                
                                return `
                                    <div class="flex flex-col gap-2">
                                        <div class="relative aspect-[9/16] rounded-2xl overflow-hidden border border-slate-155 dark:border-slate-800 bg-slate-900 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center" data-action="open-detail-modal" data-index="${idx}">
                                            <img src="${escapeHtml(s.screenshot_url)}" alt="Screenshot" class="h-full w-full object-cover" loading="lazy">
                                        </div>
                                        <span class="rounded-lg py-1 border text-[9px] font-black uppercase tracking-wider text-center ${badgeClass} shadow-sm select-none">
                                            ${label}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                `}
            </div>
        `;
    }

    shellEl.innerHTML = html;

    // Bind Overview Click Listeners
    const dateInput = document.getElementById('admin-sub-date-input');
    if (dateInput) {
        dateInput.onchange = (e) => {
            adminSubmissionsView.selectedDate = e.target.value;
            renderAdminSubmissions();
        };
    }

    const refreshBtn = document.getElementById('admin-sub-refresh-btn');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            loadAdminSubmissions();
        };
    }

    shellEl.querySelectorAll('[data-action="view-task-detail"]').forEach(btn => {
        btn.onclick = (e) => {
            adminSubmissionsView.view = 'task_detail';
            adminSubmissionsView.selectedTaskId = e.currentTarget.dataset.taskid;
            adminSubmissionsView.selectedDetailTab = 'submissions';
            adminSubmissionsView.selectedSubFilter = 'all';
            renderAdminSubmissions();
        };
    });

    // Bind Detail Click Listeners
    const backBtn = document.getElementById('admin-sub-back-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            adminSubmissionsView.view = 'overview';
            renderAdminSubmissions();
        };
    }

    shellEl.querySelectorAll('[data-action="select-detail-tab"]').forEach(btn => {
        btn.onclick = (e) => {
            adminSubmissionsView.selectedDetailTab = e.currentTarget.dataset.tab;
            renderAdminSubmissions();
        };
    });

    shellEl.querySelectorAll('[data-action="select-sub-filter"]').forEach(btn => {
        btn.onclick = (e) => {
            adminSubmissionsView.selectedSubFilter = e.currentTarget.dataset.filter;
            renderAdminSubmissions();
        };
    });

    shellEl.querySelectorAll('[data-action="open-detail-modal"]').forEach(card => {
        card.onclick = (e) => {
            const idx = Number(e.currentTarget.dataset.index);
            window.showAdminSubmissionDetailModal(idx);
        };
    });
};

window.loadAdminSubmissions = loadAdminSubmissions;
window.renderAdminSubmissions = renderAdminSubmissions;
