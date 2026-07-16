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

            const isReviewTask = !!(s.assigned_comment && String(s.assigned_comment).trim().length > 0);

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
            modal.className = 'fixed inset-0 z-[9990] flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 transition-all duration-300';
            
            modal.innerHTML = `
                <!-- Prev Button -->
                ${index > 0 ? `<button id="modal-prev-btn" class="absolute left-1 md:left-6 top-1/2 -translate-y-1/2 h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-full bg-gray-800/60 hover:bg-gray-800 text-white hover:scale-105 active:scale-95 transition shrink-0 z-50 text-xl font-bold">‹</button>` : ''}

                <!-- Container -->
                <div class="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl border border-gray-150 dark:border-gray-850 shadow-2xl overflow-y-auto max-h-[95vh] md:max-h-[90vh]">
                    <!-- Close Button -->
                    <button id="modal-close-btn" class="absolute top-3 right-3 z-50 h-7 w-7 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white text-xs font-bold transition">✕</button>

                    <!-- Left: Image -->
                    <div class="w-full bg-gray-950 flex items-center justify-center p-3 md:p-4 relative select-none">
                        <img id="admin-detail-screenshot-img" src="${escapeHtml(s.screenshot_url)}" alt="Screenshot" class="max-w-full max-h-[30vh] md:max-h-[60vh] object-contain rounded-xl border border-gray-800 shadow-lg cursor-zoom-in">
                    </div>

                    <!-- Right: Info Panel -->
                    <div class="w-full p-4 md:p-5 flex flex-col justify-between border-t border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                        <div class="space-y-3.5">
                            <!-- Header Info: Status, Gmail Name/Mobile, Submitted Time -->
                            <div class="text-left bg-white dark:bg-gray-855 p-3 md:p-4 rounded-2xl border border-gray-155 dark:border-gray-800 shadow-sm">
                                <div class="flex items-center justify-between">
                                    <span class="rounded-xl bg-${statusColor}-500 text-white font-extrabold px-3 py-1 text-[10px] tracking-wider uppercase shadow-sm">${statusLabel}</span>
                                    ${payoutBadge}
                                </div>
                                
                                ${isReviewTask ? `
                                <div class="mt-3 flex items-center gap-2">
                                    ${gmailLogoUrl ? `<img src="${escapeHtml(gmailLogoUrl)}" class="h-9 w-9 rounded-full object-cover border border-gray-200 dark:border-gray-700 shrink-0">` : `<span class="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950 text-xs font-bold text-orange-600 shrink-0">G</span>`}
                                    <div class="min-w-0 flex-1">
                                        <p class="text-[9px] font-black uppercase text-gray-400 tracking-wider">Gmail Reviewer</p>
                                        <h3 class="text-base font-extrabold text-gray-900 dark:text-white truncate">${escapeHtml(gmailName || 'Unknown User')}</h3>
                                    </div>
                                </div>
                                ` : `
                                <div class="mt-3">
                                    <p class="text-[9px] font-black uppercase text-gray-400 tracking-wider">Task Info</p>
                                    <h3 class="text-sm font-extrabold text-gray-900 dark:text-white truncate">${escapeHtml(s.app_name || 'Screenshot Task')}</h3>
                                </div>
                                `}

                                <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-755 flex items-center justify-between text-[11px]">
                                    <span class="font-bold text-orange-500">📱 ${escapeHtml(s.user_mobile || 'No mobile registered')}</span>
                                    <span class="text-gray-450 font-semibold">${timeStr}</span>
                                </div>
                            </div>

                            ${isReviewTask ? `
                            <!-- Comment -->
                            <div class="rounded-2xl bg-white dark:bg-gray-855 p-3 md:p-4 border border-gray-150 dark:border-gray-800 shadow-sm text-left">
                                <p class="text-[9px] font-black uppercase text-gray-400 tracking-wider">Assigned Comment</p>
                                <p class="mt-1.5 text-xs font-bold text-gray-800 dark:text-gray-255 italic">"${escapeHtml(s.assigned_comment || '')}"</p>
                            </div>
                            <!-- Screenshot Review Text -->
                            <div class="rounded-2xl bg-white dark:bg-gray-855 p-3 md:p-4 border border-gray-150 dark:border-gray-800 shadow-sm text-left">
                                <p class="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">Screenshot Review Text</p>
                                <p class="mt-1.5 text-xs font-extrabold text-gray-900 dark:text-white leading-relaxed bg-purple-50/50 dark:bg-purple-950/10 p-3 rounded-xl border border-purple-100/80 dark:border-purple-900/50">
                                    ${escapeHtml(extractedReviewText || 'Not found in screenshot')}
                                </p>
                            </div>

                            <!-- Check badges -->
                            <div class="flex items-center justify-between text-[10px] text-gray-455 border-t border-gray-150 dark:border-gray-850 pt-3">
                                <div class="flex items-center gap-1"><span>Live check:</span> ${liveBadge}</div>
                                <div class="flex items-center gap-1"><span>OCR:</span> ${ocrBadge}</div>
                            </div>
                            ` : ''}
                        </div>

                        <!-- Action Buttons -->
                        <div class="mt-5 border-t border-gray-150 dark:border-gray-800 pt-3.5 space-y-2">
                            <div class="grid grid-cols-2 gap-2">
                                ${s.manual_status === 'pending' ? `
                                    <button id="modal-approve-btn" class="rounded-xl bg-green-600 py-2.5 text-xs font-black text-white hover:bg-green-700 active:scale-98 transition">✅ Approve</button>
                                    <button id="modal-reject-btn" class="rounded-xl bg-red-600 py-2.5 text-xs font-black text-white hover:bg-red-700 active:scale-98 transition">❌ Reject</button>
                                ` : ''}
                                ${s.manual_status === 'approved' && s.payout_status !== 'paid' ? `
                                    <button id="modal-pay-btn" class="col-span-2 rounded-xl bg-cyan-600 py-2.5 text-xs font-black text-white hover:bg-cyan-700 active:scale-98 transition">💰 Pay Now</button>
                                ` : ''}
                            </div>
                            
                            ${isReviewTask ? `
                            <div class="grid grid-cols-2 gap-2">
                                <button id="modal-ocr-btn" class="rounded-xl bg-purple-600 py-2 text-xs font-black text-white hover:bg-purple-700 active:scale-98 transition">🤖 OCR</button>
                                <button id="modal-check-btn" class="rounded-xl bg-indigo-600 py-2 text-xs font-black text-white hover:bg-indigo-700 active:scale-98 transition">🔎 Check</button>
                            </div>
                            ` : ''}
                            
                            <button id="modal-download-jpg-btn" class="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white hover:bg-blue-700 active:scale-98 transition">📥 Download JPG</button>
                        </div>
                    </div>
                </div>

                <!-- Next Button -->
                ${index < list.length - 1 ? `<button id="modal-next-btn" class="absolute right-1 md:right-6 top-1/2 -translate-y-1/2 h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-full bg-gray-800/60 hover:bg-gray-800 text-white hover:scale-105 active:scale-95 transition shrink-0 z-50 text-xl font-bold">›</button>` : ''}
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
            const fetchTasksPromise = (async () => {
                if (window.allTasksCache && window.allTasksCache.length > 0) {
                    return;
                }
                try {
                    const tasksQuery = query(collection(db, `artifacts/${appId}/public/data/tasks`), orderBy("createdAt", "desc"));
                    const tasksSnap = await getDocs(tasksQuery);
                    const taskDocs = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if (taskDocs.length > 0) {
                        window.allTasksCache = taskDocs;
                    }
                    console.log('[AdminSubs] Tasks loaded:', window.allTasksCache.length);
                } catch (e) {
                    console.warn('[AdminSubs] Tasks pre-fetch failed:', e);
                }
            })();

            const fetchSubmissionsPromise = (async () => {
                try {
                    const token = await getBackendAuthToken();
                    const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions?limit=500`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }, 15000);
                    const data = await response.json().catch(() => ({}));
                    if (data.ok && Array.isArray(data.submissions)) {
                        adminSubmissionsCache = data.submissions;
                        console.log('[AdminSubs] Backend submissions loaded:', adminSubmissionsCache.length);
                    }
                } catch (err) {
                    console.warn('[AdminSubs] Backend load failed, trying Firebase:', err);
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
                        console.log('[AdminSubs] Firebase fallback loaded:', adminSubmissionsCache.length);
                    } catch (fbErr) {
                        console.error('[AdminSubs] Firebase also failed:', fbErr);
                    }
                }
            })();

            await Promise.all([fetchTasksPromise, fetchSubmissionsPromise]);
            console.log('[AdminSubs] Calling renderAdminSubmissions. allTasksCache:', window.allTasksCache.length, 'submissions:', adminSubmissionsCache.length);
            renderAdminSubmissions();
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

let calendarYear = null;
let calendarMonth = null;

const initCalendarState = (selectedDate) => {
    if (calendarYear === null || calendarMonth === null) {
        const [y, m] = selectedDate.split('-').map(Number);
        calendarYear = y;
        calendarMonth = m - 1;
    }
};

const drawCalendarGrid = (availableDates, dateCounts, selectedDate) => {
    const monthYearEl = document.getElementById('cal-month-year');
    const gridEl = document.getElementById('cal-days-grid');
    if (!monthYearEl || !gridEl) return;

    const dateObj = new Date(calendarYear, calendarMonth, 1);
    monthYearEl.textContent = dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const startDay = new Date(calendarYear, calendarMonth, 1).getDay();

    let html = '';

    for (let i = 0; i < startDay; i++) {
        html += `<div class="aspect-square"></div>`;
    }

    const todayStr = getSubmissionLocalDateStr(new Date());

    for (let day = 1; day <= totalDays; day++) {
        const dStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasSubmissions = dateCounts[dStr] > 0;
        const isTodayDate = dStr === todayStr;
        const isSelectable = isTodayDate || availableDates.includes(dStr) || hasSubmissions;
        const isCurrentlySelected = dStr === selectedDate;
        const count = dateCounts[dStr] || 0;

        let dayClass = 'flex flex-col items-center justify-center aspect-square rounded-xl relative transition ';
        let dotHtml = '';

        if (isCurrentlySelected) {
            dayClass += 'bg-indigo-600 text-white font-extrabold shadow-md';
        } else if (isSelectable) {
            dayClass += 'hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-gray-900 dark:text-gray-100 font-bold cursor-pointer';
            if (isTodayDate) {
                dayClass += ' border border-indigo-400';
            }
        } else {
            dayClass += 'text-gray-300 dark:text-gray-700 pointer-events-none opacity-40';
        }

        if (count > 0 && !isCurrentlySelected) {
            dotHtml = `<span class="absolute bottom-1 h-1 w-1 rounded-full bg-indigo-500"></span>`;
        }

        html += `
            <button type="button" class="${dayClass}" data-date="${dStr}" ${isSelectable ? '' : 'disabled'} style="outline: none;">
                <span>${day}</span>
                ${dotHtml}
                ${count > 0 ? `<span class="absolute -top-1 -right-1 text-[8px] scale-75 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1 rounded-full font-black">${count}</span>` : ''}
            </button>
        `;
    }

    gridEl.innerHTML = html;

    gridEl.querySelectorAll('[data-date]').forEach(btn => {
        btn.onclick = () => {
            window.adminSubmissionsView.selectedDate = btn.dataset.date;
            document.getElementById('admin-sub-calendar-popup')?.classList.add('hidden');
            renderAdminSubmissions();
        };
    });
};

const renderPlayStoreVerifyTabContent = (taskSubs, selectedTask) => {
    const scraped = window.adminSubmissionsView.scrapedReviews || [];
    const starFilter = window.adminSubmissionsView.selectedStarFilter || '5';
    
    // Filter by star
    let filteredReviews = [...scraped];
    if (starFilter !== 'all') {
        const starNum = Number(starFilter);
        filteredReviews = filteredReviews.filter(r => Math.round(Number(r.score || r.rating || 5)) === starNum);
    }
    
    const taskSubsMap = new Map();
    taskSubs.forEach(s => {
        const ocr = String(s.ocr_extracted_name || '').trim().toLowerCase();
        const usr = String(s.user_name || '').trim().toLowerCase();
        if (ocr && ocr !== 'unknown user') taskSubsMap.set(ocr, s);
        if (usr) taskSubsMap.set(usr, s);
    });

    const getMatchedSubmission = (review) => {
        const rName = String(review.userName || review.user || '').trim().toLowerCase();
        if (!rName) return null;
        for (const [key, sub] of taskSubsMap.entries()) {
            if (key.includes(rName) || rName.includes(key)) {
                return sub;
            }
        }
        return null;
    };

    const countAll = scraped.length;
    const countFiltered = filteredReviews.length;

    const actionHtml = `
        <div class="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-3">
                <button type="button" id="fetch-playstore-reviews-btn" class="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2.5 text-xs transition active:scale-95 shadow-sm uppercase tracking-wider">
                    🔄 Fetch Reviews
                </button>
                <div class="flex items-center gap-2">
                    <label for="playstore-star-filter" class="text-xs font-extrabold text-slate-500 uppercase">Rating:</label>
                    <select id="playstore-star-filter" class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 px-2.5 py-1.5 text-xs font-bold text-slate-750 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500" style="outline: none;">
                        <option value="all" ${starFilter === 'all' ? 'selected' : ''}>All Stars</option>
                        <option value="5" ${starFilter === '5' ? 'selected' : ''}>5 Stars</option>
                        <option value="4" ${starFilter === '4' ? 'selected' : ''}>4 Stars</option>
                        <option value="3" ${starFilter === '3' ? 'selected' : ''}>3 Stars</option>
                        <option value="2" ${starFilter === '2' ? 'selected' : ''}>2 Stars</option>
                        <option value="1" ${starFilter === '1' ? 'selected' : ''}>1 Star</option>
                    </select>
                </div>
            </div>
            ${countFiltered > 0 ? `
                <button type="button" id="download-playstore-excel-btn" class="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 text-xs transition active:scale-95 shadow-sm uppercase tracking-wider flex items-center gap-1.5">
                    📥 Download Excel
                </button>
            ` : ''}
        </div>
    `;

    const AVATAR_BG = ['#e97100', '#9c27b0', '#e91e63', '#7e57c2', '#00897b', '#43a047', '#3949ab'];
    const avatarColor = (name, index) => {
        const key = String(name || 'user');
        let h = 0;
        for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
        return AVATAR_BG[(Math.abs(h) + index) % AVATAR_BG.length];
    };

    const starRow = (rating) => {
        const n = Math.min(5, Math.max(0, Math.round(Number(rating) || 5)));
        let html = '<span class="inline-flex items-center gap-px">';
        for (let i = 0; i < 5; i++) {
            html += `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="${i < n ? '#01875f' : '#e3e3e3'}">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
            `;
        }
        html += '</span>';
        return html;
    };

    const listHtml = countFiltered === 0 ? `
        <div class="py-16 text-center text-sm text-gray-455 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
            ${scraped.length === 0 ? 'Click "Fetch Reviews" to load reviews from the Play Store.' : 'No reviews match the selected rating filter.'}
        </div>
    ` : `
        <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            ${filteredReviews.map((r, index) => {
                const user = r.userName || r.user || 'User';
                const userImage = String(r.userImage || r.avatar || '').trim();
                const initial = user.slice(0, 1).toUpperCase() || 'U';
                const rating = Math.round(Number(r.score || r.rating || 5));
                const comment = r.text || r.content || '';
                const dateVal = r.date || r.time;
                const formattedDate = dateVal ? new Date(dateVal).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                const thumbs = r.thumbsUpCount || 0;
                const matched = getMatchedSubmission(r);

                return `
                    <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl space-y-3 shadow-sm hover:shadow transition">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex items-center gap-3">
                                ${userImage ? `
                                    <img src="${escapeHtml(userImage)}" alt="${escapeHtml(user)}" class="h-9 w-9 shrink-0 rounded-full bg-slate-200 object-cover" referrerPolicy="no-referrer" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                ` : ''}
                                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white" style="background-color: ${avatarColor(user, index)}; display: ${userImage ? 'none' : 'flex'}">
                                    ${initial}
                                </div>
                                <div class="min-w-0">
                                    <h4 class="text-xs font-black text-slate-800 dark:text-slate-200 truncate">${escapeHtml(user)}</h4>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        ${starRow(rating)}
                                        <span class="text-[9px] font-bold text-slate-400">${escapeHtml(formattedDate)}</span>
                                    </div>
                                </div>
                            </div>
                            ${matched ? `
                                <div class="shrink-0 flex flex-col items-end gap-1">
                                    <span class="rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[8px] font-black text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">✅ MATCHED</span>
                                    <span class="text-[8px] font-bold text-slate-400 font-mono">${escapeHtml(matched.user_mobile || matched.userMobile || '')}</span>
                                </div>
                            ` : `
                                <span class="rounded-full bg-slate-50 dark:bg-slate-800/40 px-2 py-0.5 text-[8px] font-black text-slate-500 border border-slate-150 dark:border-slate-700 shrink-0">NOT MATCHED</span>
                            `}
                        </div>
                        <p class="text-xs text-slate-650 dark:text-slate-350 leading-relaxed font-medium pl-12 whitespace-pre-wrap">${escapeHtml(comment)}</p>
                        ${thumbs > 0 ? `
                            <div class="flex items-center gap-1 text-[9px] font-black text-slate-400 pl-12">
                                <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.757a2.243 2.243 0 012.243 2.243v.273c0 .5-.107 1.002-.315 1.46l-2.455 5.46c-.302.67-.978 1.104-1.716 1.104H9m4-10.5V4a2 2 0 10-4 0v6.5M9 21H5a2 2 0 01-2-2V11a2 2 0 012-2h4"></path></svg>
                                <span>${thumbs} helpful</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;

    return `
        <div class="space-y-4">
            ${actionHtml}
            <div class="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1">
                Showing ${countFiltered} of ${countAll} reviews
            </div>
            ${listHtml}
        </div>
    `;
};

const renderSubmittedNamesTabContent = (taskSubs, selectedTaskName, selectedDate) => {
    const getCompareName = (s) => String(s.ocr_extracted_name || s.user_name || s.user_email || '').toLowerCase().trim();
    const sortedSubs = [...taskSubs].sort((a, b) => getCompareName(a).localeCompare(getCompareName(b)));

    window.currentActiveSubmissions = sortedSubs; // Cache sorted list for detail modal usage

    const formatDatePickerDateToDMY = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
    };

    const cleanDateStr = formatDatePickerDateToDMY(window.adminSubmissionsView.selectedDate || selectedDate);
    
    let listText = `${escapeHtml(getCleanAppName(selectedTaskName))} :-\n${cleanDateStr}\n\n`;
    
    if (sortedSubs.length === 0) {
        listText += 'No submissions found.';
    } else {
        listText += sortedSubs.map((s, idx) => {
            const revName = s.ocr_extracted_name || 'No OCR Name';
            const statusIcon = s.manual_status === 'approved' ? '✅' : s.manual_status === 'rejected' ? '❌' : '🕒';
            return `${idx + 1}. ${escapeHtml(revName)} ${statusIcon}`;
        }).join('\n');
    }

    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between gap-3">
                <h4 class="text-xs font-black text-slate-500 uppercase tracking-wider pl-1">Submitted Names List</h4>
                <button type="button" id="copy-submitted-names-btn" class="shrink-0 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase transition active:scale-95 shadow-md flex items-center justify-center gap-1.5" style="outline: none;">
                    📋 Copy List
                </button>
            </div>
            <div class="bg-gray-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl font-mono text-sm leading-relaxed whitespace-pre-wrap select-all text-slate-800 dark:text-slate-200" id="submitted-names-text-container">${listText}</div>
        </div>
    `;
};

const renderAdminSubmissions = () => {
    const shellEl = document.getElementById('admin-submissions-page-shell');
    if (!shellEl) return;

    if (typeof window.adminSubmissionsView === 'undefined' || !window.adminSubmissionsView) {
        const d = new Date();
        window.adminSubmissionsView = {
            selectedDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            selectedTaskId: '',
            selectedDetailTab: 'submissions',
            selectedSubFilter: 'all',
            viewState: 'list' // 'list' or 'detail'
        };
    }
    
    if (!window.adminSubmissionsView.viewState) {
        window.adminSubmissionsView.viewState = 'list';
    }

    const selectedDate = window.adminSubmissionsView.selectedDate;

    // Filter submissions by ownership
    let subs = [...adminSubmissionsCache];
    const isOwner = currentUser?.uid === ADMIN_UID || currentUser?.email === 'reviewsworld51@gmail.com' || currentUser?.email === 'reviewsworld01@gmail.com' || currentUserData?.role === 'owner';
    if (!isOwner) {
        // Sub-admins only see submissions for tasks they created
        subs = subs.filter(sub => {
            const task = allTasksCache.find(t => t.id === (sub.task_id || sub.taskId));
            return task && task.createdBy === currentUser.uid;
        });
    }

    // Extract unique dates that actually have submissions
    const dateCounts = {};
    subs.forEach(s => {
        const dStr = getSubmissionLocalDateStr(s.submitted_at || s.submittedAt);
        if (dStr) {
            dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;
        }
    });

    const availableDates = Object.keys(dateCounts).sort((a, b) => b.localeCompare(a));
    
    // Ensure selectedDate is always present in availableDates so select value is valid
    if (!availableDates.includes(selectedDate)) {
        availableDates.push(selectedDate);
        dateCounts[selectedDate] = subs.filter(s => getSubmissionLocalDateStr(s.submitted_at || s.submittedAt) === selectedDate).length;
        availableDates.sort((a, b) => b.localeCompare(a));
    }

    // Filter by selected date
    const dateSubs = subs.filter(s => getSubmissionLocalDateStr(s.submitted_at || s.submittedAt) === selectedDate);

    // Compute stats for overview
    const totalSubmissions = dateSubs.length;
    const ocrPassed = dateSubs.filter(s => s.ocr_status === 'completed').length;
    const pendingVerify = dateSubs.filter(s => s.manual_status === 'pending').length;
    const approvedCount = dateSubs.filter(s => s.manual_status === 'approved').length;
    const rejectedCount = dateSubs.filter(s => s.manual_status === 'rejected').length;
    const activeTaskIds = new Set(dateSubs.map(s => s.task_id || s.taskId).filter(Boolean));
    const totalTasksCount = activeTaskIds.size;

    const getCleanAppName = (fullName = '') => {
        const clean = fullName.split(':')[0].trim();
        return clean || fullName;
    };

    // Group rows by EVERY task in our cache so that OFF tasks also show up!
    let filteredTasks = [...allTasksCache];
    if (!isOwner && filteredTasks.length > 0) {
        filteredTasks = filteredTasks.filter(task => task.createdBy === currentUser.uid);
    }

    let taskRows = [];
    if (filteredTasks.length > 0) {
        // Build from cache — only include tasks that have at least one submission on this selected date
        taskRows = filteredTasks.map(task => {
            const taskSubs = dateSubs.filter(s => s.task_id === task.id || s.taskId === task.id);
            const family = window.getAdminTaskFamily ? window.getAdminTaskFamily(task) : 'review';
            const subtype = window.getAdminTaskSubtype ? window.getAdminTaskSubtype(task) : 'app_review';
            const logo = task.logoUrl || task.imageUrl || task.iconUrl || (window.getTaskLogoFromLink ? window.getTaskLogoFromLink(family, subtype, task.taskLink) : '');
            return {
                id: task.id,
                name: task.appName || task.title || 'Task',
                logo: logo,
                isLive: task.status === 'active',
                total: taskSubs.length,
                ocrPassed: taskSubs.filter(s => s.ocr_status === 'completed').length,
                pending: taskSubs.filter(s => s.manual_status === 'pending').length,
                approved: taskSubs.filter(s => s.manual_status === 'approved').length,
                rejected: taskSubs.filter(s => s.manual_status === 'rejected').length
            };
        }).filter(r => r.total > 0);
    } else {
        // Fallback: Build task rows from submissions data when allTasksCache is empty
        const taskIdMap = {};
        dateSubs.forEach(s => {
            const tid = s.task_id || s.taskId;
            if (!tid) return;
            if (!taskIdMap[tid]) {
                taskIdMap[tid] = {
                    id: tid,
                    name: s.app_name || s.appName || s.task_name || 'Task',
                    logo: '',
                    isLive: true,
                    total: 0, ocrPassed: 0, pending: 0, approved: 0, rejected: 0
                };
            }
            const row = taskIdMap[tid];
            row.total++;
            if (s.ocr_status === 'completed') row.ocrPassed++;
            if (s.manual_status === 'pending') row.pending++;
            if (s.manual_status === 'approved') row.approved++;
            if (s.manual_status === 'rejected') row.rejected++;
        });
        taskRows = Object.values(taskIdMap);
    }

    console.log('[AdminSubs-Render] isOwner:', isOwner, 'allTasksCache.length:', allTasksCache.length, 'filteredTasks.length:', filteredTasks.length, 'dateSubs.length:', dateSubs.length, 'taskRows.length:', taskRows.length, 'subs.length:', subs.length, 'selectedDate:', selectedDate);

    const isDetailView = window.adminSubmissionsView.viewState === 'detail';
    const selectedTaskId = window.adminSubmissionsView.selectedTaskId;

    let html = '';

    if (isDetailView && selectedTaskId) {
        // --- DETAIL VIEW PANEL ---
        const selectedTask = allTasksCache.find(t => t.id === selectedTaskId);
        const selectedTaskName = selectedTask ? (selectedTask.appName || selectedTask.title) : 'Task Detail';

        // Filter right-side details list
        const taskSubs = dateSubs.filter(s => s.task_id === selectedTaskId || s.taskId === selectedTaskId);
        
        // Chips counts
        const countAll = taskSubs.length;
        const countOcr = taskSubs.filter(s => s.ocr_status === 'completed').length;
        const countPending = taskSubs.filter(s => s.manual_status === 'pending').length;
        const countRejected = taskSubs.filter(s => s.manual_status === 'rejected').length;

        // Apply active filter
        let filteredSubs = [...taskSubs];
        if (window.adminSubmissionsView.selectedSubFilter === 'ocr_passed') {
            filteredSubs = filteredSubs.filter(s => s.ocr_status === 'completed');
        } else if (window.adminSubmissionsView.selectedSubFilter === 'pending') {
            filteredSubs = filteredSubs.filter(s => s.manual_status === 'pending');
        } else if (window.adminSubmissionsView.selectedSubFilter === 'rejected') {
            filteredSubs = filteredSubs.filter(s => s.manual_status === 'rejected');
        }

        window.currentActiveSubmissions = filteredSubs; // Cache list for detail modal

        html = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 space-y-6 text-left">
                <!-- Top Detail Toolbar Header -->
                <div class="flex items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                    <div class="flex items-center gap-3">
                        <button id="admin-sub-back-btn" class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 transition active:scale-95 shadow-sm border border-gray-200/20" title="Back" style="outline: none;">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </button>
                        <div class="min-w-0">
                            <h3 class="text-lg font-black text-gray-900 dark:text-white truncate">${escapeHtml(getCleanAppName(selectedTaskName))}</h3>
                            <p class="text-[9px] text-indigo-500 font-extrabold uppercase tracking-wider mt-0.5">Task ID: ${escapeHtml(selectedTaskId)}</p>
                        </div>
                    </div>
                    <span class="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-xs font-black text-gray-700 dark:text-gray-350 border border-gray-200/20 shadow-sm">
                        Date: ${formatDatePickerDate(selectedDate)}
                    </span>
                </div>

                <!-- Detail Tabs -->
                <div class="flex items-center gap-6 border-b border-gray-100 dark:border-gray-700 pb-2 overflow-x-auto scrollbar-none text-xs">
                    ${['overview', 'submissions', 'names_list', 'failed', 'play_store_verify', 'payments'].map(tab => {
                        const isActive = window.adminSubmissionsView.selectedDetailTab === tab;
                        const labels = {
                            overview: 'Overview',
                            submissions: 'Submissions',
                            names_list: 'Submitted Names',
                            failed: 'Failed',
                            play_store_verify: 'Play Store Verify',
                            payments: 'Payments'
                        };
                        return `
                            <button type="button" data-action="select-detail-tab" data-tab="${tab}" class="py-2 font-bold uppercase tracking-wider relative shrink-0 transition-colors ${isActive ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-gray-400 hover:text-gray-650 dark:hover:text-gray-300'}" style="outline: none;">
                                ${labels[tab]}
                                ${isActive ? '<span class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"></span>' : ''}
                            </button>
                        `;
                    }).join('')}
                </div>

                <!-- Tab Contents -->
                ${window.adminSubmissionsView.selectedDetailTab === 'names_list' ? `
                    ${renderSubmittedNamesTabContent(taskSubs, selectedTaskName, selectedDate)}
                ` : window.adminSubmissionsView.selectedDetailTab === 'play_store_verify' ? `
                    ${renderPlayStoreVerifyTabContent(taskSubs, selectedTask)}
                ` : window.adminSubmissionsView.selectedDetailTab !== 'submissions' ? `
                    <div class="py-12 text-center text-sm text-gray-455">
                        <p class="font-extrabold uppercase tracking-wide text-gray-400 dark:text-gray-500">${escapeHtml(window.adminSubmissionsView.selectedDetailTab)} Panel</p>
                        <p class="text-xs text-gray-500 mt-1">This section is configured to run automatically.</p>
                    </div>
                ` : `
                    <!-- Submissions Filter Chips -->
                    <div class="flex flex-wrap items-center gap-2 mb-4">
                        ${[
                            { value: 'all', label: `All (${countAll})` },
                            { value: 'ocr_passed', label: `OCR Passed (${countOcr})` },
                            { value: 'pending', label: `Pending (${countPending})` },
                            { value: 'rejected', label: `Rejected (${countRejected})` }
                        ].map(chip => {
                            const isActive = window.adminSubmissionsView.selectedSubFilter === chip.value;
                            return `
                                <button type="button" data-action="select-sub-filter" data-filter="${chip.value}" class="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all duration-200 border ${isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/80 shadow-sm'}" style="outline: none;">
                                    ${chip.label}
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <!-- Screenshot Grid -->
                    ${filteredSubs.length === 0 ? `
                        <div class="py-12 text-center text-sm text-gray-455 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                            No screenshots found matching this filter.
                        </div>
                    ` : `
                        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
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
                                        <div class="relative aspect-[9/16] rounded-2xl overflow-hidden border border-gray-150 dark:border-gray-755 bg-gray-900 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center" data-action="open-detail-modal" data-index="${idx}">
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
    } else {
        // --- LIST VIEW PANEL (Mockup layout design) ---
        html = `
            <style>
                .admin-desktop-view { display: block !important; }
                .admin-mobile-view { display: none !important; }
                @media (max-width: 767px) {
                    .admin-desktop-view { display: none !important; }
                    .admin-mobile-view { display: block !important; }
                }
            </style>
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 space-y-6 text-left">
                <!-- Top Toolbar Header -->
                <div class="flex items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                    <div>
                        <h3 class="text-lg font-black text-gray-900 dark:text-white">Submissions Overview</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Track and manage task submissions by date.</p>
                    </div>
                    <div class="relative">
                        <button id="admin-sub-date-picker-btn" class="flex items-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-750 dark:hover:bg-gray-700 px-3.5 py-2 text-xs font-black text-gray-850 dark:text-gray-200 border border-gray-200/40 dark:border-gray-700/50 shadow-sm focus:outline-none cursor-pointer" type="button" style="outline: none;">
                            <span>📅 ${formatDatePickerDate(selectedDate)}</span>
                            <span class="text-gray-400 dark:text-gray-500 text-[10px]">▼</span>
                        </button>
                        <div id="admin-sub-calendar-popup" class="hidden absolute right-0 top-full mt-2 z-[9995] w-72 bg-white dark:bg-gray-950 rounded-3xl border border-gray-150 dark:border-gray-850 shadow-2xl p-4 space-y-3">
                            <div class="flex items-center justify-between">
                                <button id="cal-prev-month" type="button" class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300" style="outline: none;">&lt;</button>
                                <span id="cal-month-year" class="text-sm font-black text-gray-905 dark:text-white"></span>
                                <button id="cal-next-month" type="button" class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300" style="outline: none;">&gt;</button>
                            </div>
                            <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase">
                                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                            </div>
                            <div id="cal-days-grid" class="grid grid-cols-7 gap-1 text-center text-xs"></div>
                        </div>
                    </div>
                </div>

                <!-- Today's Overview Section -->
                <section class="space-y-4">
                    <h3 class="text-base font-black text-gray-900 dark:text-white">Today's Overview</h3>
                    <div class="grid grid-cols-2 sm:grid-cols-6 gap-3">
                        <!-- Total Tasks Card -->
                        <div class="bg-indigo-50/40 dark:bg-indigo-950/10 rounded-2xl p-4 border border-indigo-100/80 dark:border-indigo-900/40 shadow-sm">
                            <p class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${totalTasksCount}</p>
                            <p class="text-[10px] font-extrabold text-indigo-500/70 uppercase tracking-wide mt-1">Total Tasks</p>
                        </div>
                        
                        <!-- Total Submissions Card -->
                        <div class="bg-blue-50/40 dark:bg-blue-950/10 rounded-2xl p-4 border border-blue-100/80 dark:border-blue-900/40 shadow-sm">
                            <p class="text-2xl font-black text-blue-600 dark:text-blue-400">${totalSubmissions}</p>
                            <p class="text-[10px] font-extrabold text-blue-500/70 uppercase tracking-wide mt-1">Total Submissions</p>
                        </div>
                        
                        <!-- OCR Passed Card -->
                        <div class="bg-emerald-50/40 dark:bg-emerald-950/10 rounded-2xl p-4 border border-emerald-100/80 dark:border-emerald-900/40 shadow-sm">
                            <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${ocrPassed}</p>
                            <p class="text-[10px] font-extrabold text-emerald-500/70 uppercase tracking-wide mt-1">OCR Passed</p>
                        </div>
                        
                        <!-- Pending Verify Card -->
                        <div class="bg-amber-50/40 dark:bg-amber-950/10 rounded-2xl p-4 border border-amber-100/80 dark:border-amber-900/40 shadow-sm">
                            <p class="text-2xl font-black text-amber-500 dark:text-amber-400">${pendingVerify}</p>
                            <p class="text-[10px] font-extrabold text-amber-500/70 uppercase tracking-wide mt-1">Pending Verify</p>
                        </div>
                        
                        <!-- Approved Card -->
                        <div class="bg-green-50/40 dark:bg-green-950/10 rounded-2xl p-4 border border-green-100/80 dark:border-green-900/40 shadow-sm">
                            <p class="text-2xl font-black text-green-600 dark:text-green-400">${approvedCount}</p>
                            <p class="text-[10px] font-extrabold text-green-500/70 uppercase tracking-wide mt-1">Approved</p>
                        </div>
                        
                        <!-- Rejected Card -->
                        <div class="bg-red-50/40 dark:bg-red-950/10 rounded-2xl p-4 border border-red-100/80 dark:border-red-900/40 shadow-sm">
                            <p class="text-2xl font-black text-red-500 dark:text-red-400">${rejectedCount}</p>
                            <p class="text-[10px] font-extrabold text-red-500/70 uppercase tracking-wide mt-1">Rejected</p>
                        </div>
                    </div>
                </section>

                <!-- Task Wise Overview Table -->
                <section class="space-y-4 pt-2">
                    <h3 class="text-base font-black text-gray-900 dark:text-white">Task Wise Overview</h3>
                    <div class="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                        <!-- Desktop Table View -->
                        <div class="admin-desktop-view overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr class="bg-gray-50/55 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 uppercase font-black text-[9px] tracking-wider">
                                        <th class="py-3.5 px-4">Task Name</th>
                                        <th class="py-3.5 px-3 text-center">Total Submissions</th>
                                        <th class="py-3.5 px-3 text-center">OCR Passed</th>
                                        <th class="py-3.5 px-3 text-center">Pending Verify</th>
                                        <th class="py-3.5 px-3 text-center">Approved</th>
                                        <th class="py-3.5 px-3 text-center">Rejected</th>
                                        <th class="py-3.5 px-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                                    ${taskRows.length === 0 ? `
                                        <tr>
                                            <td colspan="7" class="py-8 text-center text-gray-400 font-bold">No tasks available.</td>
                                        </tr>
                                    ` : taskRows.map(r => {
                                        return `
                                            <tr class="hover:bg-gray-50/30 dark:hover:bg-gray-800/20 transition">
                                                <td class="py-3.5 px-4">
                                                    <div class="flex items-center gap-3">
                                                         <!-- App Logo -->
                                                        <span class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-150 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-900 shadow-sm">
                                                            <img src="${escapeHtml(r.logo || 'https://cdn-icons-png.flaticon.com/512/2659/2659360.png')}" alt="App logo" class="h-full w-full object-contain">
                                                        </span>
                                                        <div class="min-w-0">
                                                            <p class="font-extrabold text-gray-900 dark:text-white text-sm truncate max-w-[180px]">${escapeHtml(getCleanAppName(r.name))}</p>
                                                            <p class="text-[9px] text-gray-400 font-semibold mt-0.5">ID: ${escapeHtml(r.id)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="py-3.5 px-3 text-center font-bold text-gray-800 dark:text-gray-200">${r.total}</td>
                                                <td class="py-3.5 px-3 text-center font-bold text-gray-800 dark:text-gray-200">${r.ocrPassed}</td>
                                                <td class="py-3.5 px-3 text-center font-bold text-gray-800 dark:text-gray-200">${r.pending}</td>
                                                <td class="py-3.5 px-3 text-center font-bold text-gray-800 dark:text-gray-200">${r.approved}</td>
                                                <td class="py-3.5 px-3 text-center font-bold text-gray-800 dark:text-gray-200">${r.rejected}</td>
                                                <td class="py-3.5 px-4 text-right">
                                                    <button type="button" data-action="view-task-submissions" data-taskid="${r.id}" class="rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 text-blue-600 font-black px-4 py-2 text-xs transition active:scale-95 border border-blue-100/50 dark:border-blue-900/35" style="outline: none;">
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>

                        <!-- Mobile Card View -->
                        <div class="admin-mobile-view divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            ${taskRows.length === 0 ? `
                                <div class="py-8 text-center text-gray-400 font-bold">No tasks available.</div>
                            ` : taskRows.map(r => {
                                return `
                                    <div class="p-4 space-y-3.5 text-left">
                                        <div class="flex items-center justify-between gap-3">
                                            <div class="flex items-center gap-3 min-w-0">
                                                <span class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-150 bg-white p-1.5 dark:border-gray-700 dark:bg-gray-900 shadow-sm">
                                                    <img src="${escapeHtml(r.logo || 'https://cdn-icons-png.flaticon.com/512/2659/2659360.png')}" alt="App logo" class="h-full w-full object-contain">
                                                </span>
                                                <div class="min-w-0">
                                                    <p class="font-extrabold text-gray-900 dark:text-white text-sm truncate max-w-[150px]">${escapeHtml(getCleanAppName(r.name))}</p>
                                                    <p class="text-[9px] text-gray-400 font-semibold mt-0.5">ID: ${escapeHtml(r.id)}</p>
                                                </div>
                                            </div>
                                            <button type="button" data-action="view-task-submissions" data-taskid="${r.id}" class="rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 text-blue-600 font-black px-4 py-2 text-xs transition active:scale-95 border border-blue-100/50 dark:border-blue-900/35" style="outline: none;">
                                                View
                                            </button>
                                        </div>
                                        <div class="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                                            <div class="bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
                                                <span class="block font-black text-gray-850 dark:text-gray-200 text-xs">${r.total}</span>
                                                <span class="text-[8px] font-bold text-gray-400 uppercase tracking-wide">Total</span>
                                            </div>
                                            <div class="bg-emerald-50/50 dark:bg-emerald-950/20 p-1.5 rounded-lg border border-emerald-100/10 dark:border-emerald-900/10">
                                                <span class="block font-black text-emerald-600 dark:text-emerald-400 text-xs">${r.ocrPassed}</span>
                                                <span class="text-[8px] font-bold text-emerald-500/70 uppercase tracking-wide">OCR</span>
                                            </div>
                                            <div class="bg-amber-50/50 dark:bg-amber-950/20 p-1.5 rounded-lg border border-amber-100/10 dark:border-amber-900/10">
                                                <span class="block font-black text-amber-600 dark:text-amber-400 text-xs">${r.pending}</span>
                                                <span class="text-[8px] font-bold text-amber-500/70 uppercase tracking-wide">Pend</span>
                                            </div>
                                            <div class="bg-green-50/50 dark:bg-green-950/20 p-1.5 rounded-lg border border-green-100/10 dark:border-green-900/10">
                                                <span class="block font-black text-green-600 dark:text-green-400 text-xs">${r.approved}</span>
                                                <span class="text-[8px] font-bold text-green-500/70 uppercase tracking-wide">Appr</span>
                                            </div>
                                            <div class="bg-red-50/50 dark:bg-red-950/20 p-1.5 rounded-lg border border-red-100/10 dark:border-red-900/10">
                                                <span class="block font-black text-red-600 dark:text-red-400 text-xs">${r.rejected}</span>
                                                <span class="text-[8px] font-bold text-red-500/70 uppercase tracking-wide">Rej</span>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </section>

                <!-- Centered Bottom View All Link -->
                <div class="pt-2 flex justify-center border-t border-gray-100 dark:border-gray-700">
                    <button type="button" class="text-xs font-black text-blue-600 hover:underline py-2" style="outline: none;">View All Tasks</button>
                </div>
            </div>
        `;
    }

    shellEl.innerHTML = html;

    // Bind Event Listeners
    const datePickerBtn = document.getElementById('admin-sub-date-picker-btn');
    if (datePickerBtn) {
        datePickerBtn.onclick = (e) => {
            e.stopPropagation();
            const popup = document.getElementById('admin-sub-calendar-popup');
            if (popup) {
                const isHidden = popup.classList.contains('hidden');
                popup.classList.toggle('hidden', !isHidden);
                if (isHidden) {
                    initCalendarState(selectedDate);
                    drawCalendarGrid(availableDates, dateCounts, selectedDate);
                }
            }
        };
    }

    const prevMonthBtn = document.getElementById('cal-prev-month');
    if (prevMonthBtn) {
        prevMonthBtn.onclick = (e) => {
            e.stopPropagation();
            calendarMonth--;
            if (calendarMonth < 0) {
                calendarMonth = 11;
                calendarYear--;
            }
            drawCalendarGrid(availableDates, dateCounts, selectedDate);
        };
    }

    const nextMonthBtn = document.getElementById('cal-next-month');
    if (nextMonthBtn) {
        nextMonthBtn.onclick = (e) => {
            e.stopPropagation();
            calendarMonth++;
            if (calendarMonth > 11) {
                calendarMonth = 0;
                calendarYear++;
            }
            drawCalendarGrid(availableDates, dateCounts, selectedDate);
        };
    }

    // Close calendar on document click
    if (!window._adminSubCalendarOutsideListenerBound) {
        document.addEventListener('click', (e) => {
            const popup = document.getElementById('admin-sub-calendar-popup');
            const btn = document.getElementById('admin-sub-date-picker-btn');
            if (popup && btn && !popup.contains(e.target) && !btn.contains(e.target)) {
                popup.classList.add('hidden');
            }
        });
        window._adminSubCalendarOutsideListenerBound = true;
    }

    const refreshBtn = document.getElementById('admin-sub-refresh-btn');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            loadAdminSubmissions();
        };
    }

    const backBtn = document.getElementById('admin-sub-back-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            window.adminSubmissionsView.viewState = 'list';
            window.adminSubmissionsView.selectedTaskId = '';
            renderAdminSubmissions();
        };
    }

    shellEl.querySelectorAll('[data-action="view-task-submissions"]').forEach(btn => {
        btn.onclick = (e) => {
            window.adminSubmissionsView.selectedTaskId = e.currentTarget.dataset.taskid;
            window.adminSubmissionsView.viewState = 'detail';
            window.adminSubmissionsView.selectedDetailTab = 'submissions';
            window.adminSubmissionsView.selectedSubFilter = 'all';
            window.adminSubmissionsView.scrapedReviews = [];
            window.adminSubmissionsView.selectedStarFilter = '5';
            renderAdminSubmissions();
        };
    });

    shellEl.querySelectorAll('[data-action="select-detail-tab"]').forEach(btn => {
        btn.onclick = (e) => {
            window.adminSubmissionsView.selectedDetailTab = e.currentTarget.dataset.tab;
            renderAdminSubmissions();
        };
    });

    shellEl.querySelectorAll('[data-action="select-sub-filter"]').forEach(btn => {
        btn.onclick = (e) => {
            window.adminSubmissionsView.selectedSubFilter = e.currentTarget.dataset.filter;
            renderAdminSubmissions();
        };
    });

    shellEl.querySelectorAll('[data-action="open-detail-modal"]').forEach(card => {
        card.onclick = (e) => {
            const idx = Number(e.currentTarget.dataset.index);
            window.showAdminSubmissionDetailModal(idx);
        };
    });

    // --- Submitted Names list event bindings ---
    if (window.adminSubmissionsView.selectedDetailTab === 'names_list') {
        const copyBtn = document.getElementById('copy-submitted-names-btn');
        if (copyBtn) {
            copyBtn.onclick = () => {
                const el = document.getElementById('submitted-names-text-container');
                if (el) {
                    const textToCopy = el.innerText || el.textContent || '';
                    navigator.clipboard.writeText(textToCopy);
                    showNotification('Submitted names list copied to clipboard!');
                }
            };
        }
    }

    // --- Play Store Verify event bindings ---
    if (window.adminSubmissionsView.selectedDetailTab === 'play_store_verify') {
        const fetchBtn = document.getElementById('fetch-playstore-reviews-btn');
        if (fetchBtn) {
            fetchBtn.onclick = async () => {
                const originalText = fetchBtn.innerHTML;
                fetchBtn.disabled = true;
                fetchBtn.innerHTML = '⏳ Fetching...';
                
                const selectedTask = allTasksCache.find(t => t.id === selectedTaskId);
                const taskLink = selectedTask?.taskLink || selectedTask?.task_link || selectedTask?.link || '';
                if (!taskLink) {
                    showNotification('No task link found to fetch reviews.', true);
                    fetchBtn.disabled = false;
                    fetchBtn.innerHTML = originalText;
                    return;
                }
                
                try {
                    const token = await getBackendAuthToken();
                    const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/scraper/fetch-reviews`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: taskLink })
                    }, 15000);
                    
                    const data = await resp.json().catch(() => ({}));
                    if (data.ok && Array.isArray(data.reviews)) {
                        window.adminSubmissionsView.scrapedReviews = data.reviews;
                        showNotification(`Successfully fetched ${data.reviews.length} reviews from Play Store.`);
                        renderAdminSubmissions();
                    } else {
                        throw new Error(data.error || 'Fetch failed');
                    }
                } catch (err) {
                    console.error('Fetch reviews failed:', err);
                    showNotification(`Failed to fetch reviews: ${err.message || 'Server error'}`, true);
                    fetchBtn.disabled = false;
                    fetchBtn.innerHTML = originalText;
                }
            };
        }

        const starFilterEl = document.getElementById('playstore-star-filter');
        if (starFilterEl) {
            starFilterEl.onchange = function() {
                window.adminSubmissionsView.selectedStarFilter = this.value;
                renderAdminSubmissions();
            };
        }

        const downloadExcelBtn = document.getElementById('download-playstore-excel-btn');
        if (downloadExcelBtn) {
            downloadExcelBtn.onclick = () => {
                const scraped = window.adminSubmissionsView.scrapedReviews || [];
                const starFilter = window.adminSubmissionsView.selectedStarFilter || '5';
                
                let filtered = [...scraped];
                if (starFilter !== 'all') {
                    const starNum = Number(starFilter);
                    filtered = filtered.filter(r => Math.round(Number(r.score || r.rating || 5)) === starNum);
                }
                
                if (!filtered.length) {
                    showNotification('No reviews to export.', true);
                    return;
                }
                
                const selectedTask = allTasksCache.find(t => t.id === selectedTaskId);
                const selectedTaskName = selectedTask ? (selectedTask.appName || selectedTask.title) : 'Task';
                const appName = selectedTaskName || 'App';
                
                const d = new Date();
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const dateStr = `${day}_${month}_${year}`;
                const filename = `${appName}_${dateStr}.xls`;
                
                const headers = ['Reviewer Name', 'Rating (Stars)', 'Review Comment', 'Status', 'User Mobile', 'Review Date', 'Helpful Count'];
                
                const taskSubs = dateSubs.filter(s => s.task_id === selectedTaskId || s.taskId === selectedTaskId);
                const taskSubsMap = new Map();
                taskSubs.forEach(s => {
                    const ocr = String(s.ocr_extracted_name || '').trim().toLowerCase();
                    const usr = String(s.user_name || '').trim().toLowerCase();
                    if (ocr && ocr !== 'unknown user') taskSubsMap.set(ocr, s);
                    if (usr) taskSubsMap.set(usr, s);
                });

                const getMatchedSub = (review) => {
                    const rName = String(review.userName || review.user || '').trim().toLowerCase();
                    if (!rName) return null;
                    for (const [key, sub] of taskSubsMap.entries()) {
                        if (key.includes(rName) || rName.includes(key)) {
                            return sub;
                        }
                    }
                    return null;
                };

                const rows = filtered.map(r => {
                    const matched = getMatchedSub(r);
                    const reviewDate = r.date || r.time ? new Date(r.date || r.time).toLocaleDateString('en-GB') : '';
                    return [
                        r.userName || r.user || 'User',
                        Math.round(Number(r.score || r.rating || 5)),
                        r.text || r.content || '',
                        matched ? 'Matched' : 'Not Matched',
                        matched ? (matched.user_mobile || matched.userMobile || '') : '',
                        reviewDate,
                        r.thumbsUpCount || 0
                    ];
                });
                
                let xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sheet1"><Table>`;
                
                xml += '<Row>';
                headers.forEach(h => {
                    xml += `<Cell><Data ss:Type="String">${h.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`;
                });
                xml += '</Row>';
                
                rows.forEach(row => {
                    xml += '<Row>';
                    row.forEach(val => {
                        const cleanVal = String(val === null || val === undefined ? '' : val)
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;');
                        xml += `<Cell><Data ss:Type="String">${cleanVal}</Data></Cell>`;
                    });
                    xml += '</Row>';
                });
                
                xml += '</Table></Worksheet></Workbook>';

                const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showNotification(`Downloaded ${filtered.length} reviews as Excel.`);
            };
        }

        // 3. Quick actions bindings
        shellEl.querySelectorAll('[data-action="quick-approve"]').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const subId = e.currentTarget.dataset.subid;
                const originalContent = e.currentTarget.innerHTML;
                e.currentTarget.disabled = true;
                e.currentTarget.innerHTML = '⏳';
                try {
                    const token = await getBackendAuthToken();
                    const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions/${encodeURIComponent(subId)}`, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ manualStatus: 'approved', verifiedAt: Date.now() })
                    }, 8000);
                    const data = await resp.json().catch(() => ({}));
                    if (data.ok) {
                        const subIdx = adminSubmissionsCache.findIndex(s => s.id === subId);
                        if (subIdx !== -1) {
                            adminSubmissionsCache[subIdx].manual_status = 'approved';
                        }
                        showNotification('Approved successfully.');
                        renderAdminSubmissions();
                    } else {
                        throw new Error(data.error || 'API error');
                    }
                } catch (err) {
                    console.error('Quick approve failed:', err);
                    showNotification('Approval failed. Please try again.', true);
                    e.currentTarget.disabled = false;
                    e.currentTarget.innerHTML = originalContent;
                }
            };
        });

        shellEl.querySelectorAll('[data-action="quick-reject"]').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const subId = e.currentTarget.dataset.subid;
                const originalContent = e.currentTarget.innerHTML;
                e.currentTarget.disabled = true;
                e.currentTarget.innerHTML = '⏳';
                try {
                    const token = await getBackendAuthToken();
                    const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions/${encodeURIComponent(subId)}`, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ manualStatus: 'rejected' })
                    }, 8000);
                    const data = await resp.json().catch(() => ({}));
                    if (data.ok) {
                        const subIdx = adminSubmissionsCache.findIndex(s => s.id === subId);
                        if (subIdx !== -1) {
                            adminSubmissionsCache[subIdx].manual_status = 'rejected';
                        }
                        showNotification('Rejected successfully.');
                        renderAdminSubmissions();
                    } else {
                        throw new Error(data.error || 'API error');
                    }
                } catch (err) {
                    console.error('Quick reject failed:', err);
                    showNotification('Rejection failed. Please try again.', true);
                    e.currentTarget.disabled = false;
                    e.currentTarget.innerHTML = originalContent;
                }
            };
        });

        shellEl.querySelectorAll('[data-action="quick-details"]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const subId = e.currentTarget.dataset.subid;
                const list = window.currentActiveSubmissions || [];
                const idx = list.findIndex(s => s.id === subId);
                if (idx !== -1) {
                    window.showAdminSubmissionDetailModal(idx);
                }
            };
        });
    }
}

window.loadAdminSubmissions = loadAdminSubmissions;
window.renderAdminSubmissions = renderAdminSubmissions;
