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
            renderAdminSubmissions();
        };

const renderAdminSubmissions = () => {
            const listEl = document.getElementById('admin-sub-list');
            if (!listEl) return;
            const search = (document.getElementById('admin-sub-search')?.value || '').trim().toLowerCase();
            const filter = document.getElementById('admin-sub-filter')?.value || 'all';

            let subs = [...adminSubmissionsCache];
            if (filter !== 'all') {
                if (filter === 'paid') {
                    subs = subs.filter(s => s.payout_status === 'paid');
                } else {
                    subs = subs.filter(s => s.manual_status === filter);
                }
            }
            if (search) {
                subs = subs.filter(s =>
                    [s.user_name, s.user_email, s.app_name, s.task_id, s.assigned_comment]
                        .some(v => String(v || '').toLowerCase().includes(search))
                );
            }

            // Update counts on top metrics
            const total = adminSubmissionsCache.length;
            const pending = adminSubmissionsCache.filter(s => s.manual_status === 'pending').length;
            const approved = adminSubmissionsCache.filter(s => s.manual_status === 'approved').length;
            const paid = adminSubmissionsCache.filter(s => s.payout_status === 'paid').length;
            const totalEl = document.getElementById('admin-sub-total');
            const pendingEl = document.getElementById('admin-sub-pending');
            const approvedEl = document.getElementById('admin-sub-approved');
            const paidEl = document.getElementById('admin-sub-paid');
            if (totalEl) totalEl.textContent = total;
            if (pendingEl) pendingEl.textContent = pending;
            if (approvedEl) approvedEl.textContent = approved;
            if (paidEl) paidEl.textContent = paid;

            // Group filtered submissions by Date and App
            const getSubmissionDateStr = (submittedAt) => {
                if (!submittedAt) return 'Unknown Date';
                const d = new Date(timestampToMillis(submittedAt));
                return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
            };

            const grouped = {};
            subs.forEach(s => {
                const dateKey = getSubmissionDateStr(s.submitted_at || s.submittedAt);
                const appKey = s.app_name || s.appName || s.task_id || 'unknown';
                if (!grouped[dateKey]) grouped[dateKey] = {};
                if (!grouped[dateKey][appKey]) {
                    grouped[dateKey][appKey] = {
                        taskName: s.app_name || s.appName || appKey,
                        taskLink: s.task_link || s.taskLink || '',
                        reward: s.reward || 0,
                        appLogoUrl: s.app_logo_url || '',
                        items: []
                    };
                }
                if (s.app_logo_url && !grouped[dateKey][appKey].appLogoUrl) {
                    grouped[dateKey][appKey].appLogoUrl = s.app_logo_url;
                }
                grouped[dateKey][appKey].items.push(s);
            });

            const sortedDates = Object.keys(grouped).sort((a, b) => {
                if (a === 'Unknown Date') return 1;
                if (b === 'Unknown Date') return -1;
                const [da, ma, ya] = a.split('-').map(Number);
                const [db, mb, yb] = b.split('-').map(Number);
                return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
            });

            let html = '';

            if (adminSubmissionsView.view === 'dates') {
                let foldersHtml = sortedDates.map(dateStr => {
                    const dateGroup = grouped[dateStr];
                    const totalCount = Object.values(dateGroup).reduce((sum, app) => sum + app.items.length, 0);
                    const pendingCount = Object.values(dateGroup).reduce((sum, app) => sum + app.items.filter(s => s.manual_status === 'pending').length, 0);
                    
                    return `
                        <div class="flex items-center gap-3 rounded-2xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-800 p-4 hover:border-orange-500 hover:shadow-md cursor-pointer transition select-none" data-action="select-date" data-date="${escapeHtml(dateStr)}">
                            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-900/35 text-2xl">
                                📁
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="text-sm font-extrabold text-gray-850 dark:text-white">${escapeHtml(dateStr)}</p>
                                <p class="text-[10px] text-gray-450">${totalCount} submissions ${pendingCount > 0 ? `· <span class="text-amber-500 font-bold">${pendingCount} pending</span>` : ''}</p>
                            </div>
                            <svg class="h-4 w-4 text-gray-450 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
                        </div>`;
                }).join('');

                html = `
                <div class="flex items-center gap-2 text-xs font-black text-gray-500 mb-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-150 dark:border-gray-800 flex-wrap">
                    <span class="text-orange-500 font-black">📂 Root</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    ${foldersHtml || '<p class="text-center text-sm text-gray-400 py-8 col-span-2">No submission dates found.</p>'}
                </div>`;

            } else if (adminSubmissionsView.view === 'apps') {
                const dateStr = adminSubmissionsView.selectedDate;
                const dateGroup = grouped[dateStr] || {};
                const sortedApps = Object.keys(dateGroup).sort((a, b) => a.localeCompare(b));

                let foldersHtml = sortedApps.map(appKey => {
                    const appGroup = dateGroup[appKey];
                    const totalCount = appGroup.items.length;
                    const pendingCount = appGroup.items.filter(s => s.manual_status === 'pending').length;
                    const logoUrl = appGroup.appLogoUrl || 'https://cdn-icons-png.flaticon.com/512/3176/3176366.png';
                    return `
                        <div class="flex items-center gap-3 rounded-2xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-800 p-4 hover:border-orange-500 hover:shadow-md cursor-pointer transition select-none" data-action="select-app" data-app="${escapeHtml(appKey)}">
                            <img src="${escapeHtml(logoUrl)}" class="h-12 w-12 rounded-2xl object-cover border border-gray-200 dark:border-gray-700 shrink-0" alt="${escapeHtml(appGroup.taskName)}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/3176/3176366.png';">
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-extrabold text-gray-855 dark:text-white">${escapeHtml(appGroup.taskName)}</p>
                                <p class="text-[10px] text-gray-450">${totalCount} items ${pendingCount > 0 ? `· <span class="text-amber-500 font-bold">${pendingCount} pending</span>` : ''}</p>
                            </div>
                            <svg class="h-4 w-4 text-gray-450 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
                        </div>`;
                }).join('');

                html = `
                <div class="flex items-center gap-2 text-xs font-black text-gray-500 mb-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-150 dark:border-gray-800 flex-wrap">
                    <span class="text-orange-500 cursor-pointer hover:underline" data-action="explore-root">📂 Root</span>
                    <span class="text-gray-300">/</span>
                    <span class="text-gray-700 dark:text-gray-300 font-black">${escapeHtml(dateStr)}</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    ${foldersHtml || '<p class="text-center text-sm text-gray-400 py-8 col-span-2">No app folders found.</p>'}
                </div>`;

            } else if (adminSubmissionsView.view === 'submissions') {
                const dateStr = adminSubmissionsView.selectedDate;
                const appKey = adminSubmissionsView.selectedApp;
                const finalSubs = (grouped[dateStr]?.[appKey]?.items || []);
                window.currentActiveSubmissions = finalSubs; // Cache list for detail modal

                // Group finalSubs by user_id
                const userGroups = {};
                finalSubs.forEach((s, globalIdx) => {
                    const uId = s.user_id || 'unknown_user';
                    if (!userGroups[uId]) {
                        userGroups[uId] = {
                            userId: uId,
                            userName: s.user_name || 'Unknown User',
                            userEmail: s.user_email || 'No email',
                            items: []
                        };
                    }
                    userGroups[uId].items.push({ ...s, globalIdx });
                });

                let cardsHtml = `<div class="space-y-5 relative pl-4 border-l-2 border-gray-150 dark:border-gray-800 ml-4 py-2">`;
                Object.values(userGroups).forEach(group => {
                    const initials = group.userName ? group.userName.charAt(0).toUpperCase() : '?';
                    cardsHtml += `
                    <!-- User Submission Group -->
                    <div class="relative group text-left">
                        <!-- Dot Indicator on Timeline -->
                        <div class="absolute -left-[25px] top-2 h-3.5 w-3.5 rounded-full bg-orange-500 border-4 border-white dark:border-gray-900 group-hover:scale-110 transition shadow-sm z-10"></div>
                        
                        <!-- User Identification Tag -->
                        <div class="flex flex-wrap items-center justify-between gap-2 mb-2 bg-gray-50 dark:bg-gray-850/60 p-2 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-left">
                            <div class="flex items-center gap-2">
                                <div class="h-6 w-6 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center font-black text-orange-600 text-xs shrink-0">
                                    ${initials}
                                </div>
                                <div class="min-w-0">
                                    <p class="text-xs font-black text-gray-850 dark:text-white truncate">${escapeHtml(group.userName)}</p>
                                    <p class="text-[9px] text-gray-450 font-semibold truncate mt-0.5">${escapeHtml(group.userEmail)}</p>
                                </div>
                            </div>
                            <span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                                ${group.items.length} file${group.items.length > 1 ? 's' : ''}
                            </span>
                        </div>
                        
                        <!-- Horizontal Scroll of Tiny Thumbnails -->
                        <div class="flex flex-wrap gap-2.5 pl-1.5">
                            ${group.items.map(s => {
                                const statusTextColor = s.manual_status === 'approved' ? 'emerald' : s.manual_status === 'rejected' ? 'rose' : 'amber';
                                return `
                                <div class="relative w-14 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950 cursor-pointer hover:border-orange-500 hover:shadow-md active:scale-95 transition shrink-0" data-action="open-modal" data-index="${s.globalIdx}">
                                    <img src="${escapeHtml(s.screenshot_url)}" alt="Thumbnail" class="h-full w-full object-cover" loading="lazy">
                                    <div class="absolute inset-0 bg-black/5 hover:bg-transparent transition"></div>
                                    <!-- Tiny Status Indicator Badge -->
                                    <div class="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-${statusTextColor}-500 border border-white dark:border-gray-900 shadow-sm" title="Status: ${s.manual_status}"></div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>`;
                });
                cardsHtml += `</div>`;

                const appName = grouped[dateStr]?.[appKey]?.taskName || appKey;
                html = `
                <div class="flex items-center justify-between gap-2 mb-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-150 dark:border-gray-800 flex-wrap">
                    <div class="flex items-center gap-2 text-xs font-black text-gray-500 flex-wrap">
                        <span class="text-orange-500 cursor-pointer hover:underline" data-action="explore-root">📂 Root</span>
                        <span class="text-gray-300">/</span>
                        <span class="text-orange-500 cursor-pointer hover:underline" data-action="explore-date" data-date="${escapeHtml(dateStr)}">${escapeHtml(dateStr)}</span>
                        <span class="text-gray-300">/</span>
                        <span class="text-gray-700 dark:text-gray-300 font-black truncate max-w-[150px]">${escapeHtml(appName)}</span>
                    </div>
                    ${finalSubs.length > 0 ? `
                        <button id="admin-download-pdf-btn" class="rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold px-3 py-1.5 text-xs shadow-sm hover:scale-105 active:scale-95 transition flex items-center gap-1.5 select-none">
                            📥 Save All as PDF
                        </button>
                    ` : ''}
                </div>
                ${finalSubs.length === 0 ? '<p class="text-center text-sm text-gray-400 py-8">No submissions found in this folder.</p>' : cardsHtml}`;
            }

            listEl.innerHTML = html;

            // Bind Navigation Click Listeners
            listEl.querySelectorAll('[data-action="explore-root"]').forEach(el => {
                el.onclick = () => {
                    adminSubmissionsView.view = 'dates';
                    adminSubmissionsView.selectedDate = null;
                    adminSubmissionsView.selectedApp = null;
                    renderAdminSubmissions();
                };
            });
            listEl.querySelectorAll('[data-action="explore-date"]').forEach(el => {
                el.onclick = (e) => {
                    adminSubmissionsView.view = 'apps';
                    adminSubmissionsView.selectedDate = e.currentTarget.dataset.date;
                    adminSubmissionsView.selectedApp = null;
                    renderAdminSubmissions();
                };
            });
            listEl.querySelectorAll('[data-action="select-date"]').forEach(el => {
                el.onclick = (e) => {
                    adminSubmissionsView.view = 'apps';
                    adminSubmissionsView.selectedDate = e.currentTarget.dataset.date;
                    adminSubmissionsView.selectedApp = null;
                    renderAdminSubmissions();
                };
            });
            listEl.querySelectorAll('[data-action="select-app"]').forEach(el => {
                el.onclick = (e) => {
                    adminSubmissionsView.view = 'submissions';
                    adminSubmissionsView.selectedApp = e.currentTarget.dataset.app;
                    renderAdminSubmissions();
                };
            });
            listEl.querySelectorAll('[data-action="open-modal"]').forEach(el => {
                el.onclick = (e) => {
                    const idx = Number(e.currentTarget.dataset.index);
                    window.showAdminSubmissionDetailModal(idx);
                };
            });

            // Bind Save All as PDF event
            const pdfBtn = document.getElementById('admin-download-pdf-btn');
            if (pdfBtn) {
                pdfBtn.onclick = () => {
                    const dateStr = adminSubmissionsView.selectedDate;
                    const appKey = adminSubmissionsView.selectedApp;
                    const appName = grouped[dateStr]?.[appKey]?.taskName || appKey;
                    const finalSubs = (grouped[dateStr]?.[appKey]?.items || []);
                    window.downloadSubmissionsAsPdf(finalSubs, appName, dateStr);
                };
            }

            // Bind action buttons click handlers
            listEl.querySelectorAll('button[data-action]').forEach(btn => {
                btn.onclick = async (e) => {
                    const action = e.currentTarget.dataset.action;
                    const subId = e.currentTarget.dataset.subid;
                    if (!subId) return;
                    try {
                        const token = await getBackendAuthToken();
                        if (action === 'approve-submission') {
                            await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions/${encodeURIComponent(subId)}`, {
                                method: 'PATCH',
                                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ manualStatus: 'approved', verifiedAt: Date.now() })
                            }, 8000);
                            showNotification('Submission approved.');
                        } else if (action === 'reject-submission') {
                            await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions/${encodeURIComponent(subId)}`, {
                                method: 'PATCH',
                                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ manualStatus: 'rejected' })
                            }, 8000);
                            showNotification('Submission rejected.');
                        } else if (action === 'pay-submission') {
                            await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions/${encodeURIComponent(subId)}`, {
                                method: 'PATCH',
                                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ payoutStatus: 'paid', paidAt: Date.now() })
                            }, 8000);
                            showNotification('Payment credited.');
                        } else if (action === 'ocr-submission') {
                            showNotification('Running OCR...');
                            const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/ocr-process/${encodeURIComponent(subId)}`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` }
                            }, 20000);
                            const ocrData = await resp.json().catch(() => ({}));
                            showNotification(ocrData.ok ? `OCR complete: ${(ocrData.ocr?.text || '').slice(0, 80)}` : 'OCR failed');
                        } else if (action === 'scraper-submission') {
                            showNotification('Checking Live list...');
                            const taskLink = e.currentTarget.dataset.tasklink || '';
                            const assignedComment = e.currentTarget.dataset.comment || '';
                            const appName = e.currentTarget.dataset.appname || '';
                            const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/scraper/check-review`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ submissionId: subId, taskLink, assignedComment, appName })
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
                        }
                        await loadAdminSubmissions();
                    } catch (err) {
                        console.error('Submission action failed:', err);
                        showNotification('Action failed. Please try again.', true);
                    }
                };
            });
        };

// Expose functions to window for global access
window.loadAdminSubmissions = loadAdminSubmissions;
window.renderAdminSubmissions = renderAdminSubmissions;
