// File: src/pages/admin/admin-submissions.js

const getCleanAppName = (fullName = '') => {
    const clean = fullName.split(':')[0].trim();
    return clean || fullName;
};

const loadJSZip = () => {
    return new Promise((resolve, reject) => {
        if (window.JSZip) return resolve(window.JSZip);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve(window.JSZip);
        script.onerror = () => reject(new Error('Failed to load JSZip library.'));
        document.head.appendChild(script);
    });
};

const downloadAllSubmissionsZip = async (subs, appName, selectedDate) => {
    const zipBtn = document.getElementById('admin-sub-download-zip-btn');
    const originalHtml = zipBtn ? zipBtn.innerHTML : '📥 Download ZIP';
    if (zipBtn) {
        zipBtn.disabled = true;
        zipBtn.innerHTML = '⏳ Initializing ZIP...';
    }
    
    try {
        const JSZip = await loadJSZip();
        const zip = new JSZip();
        
        // Split by ":" and take the part before it as clean app name
        const cleanAppName = appName.split(':')[0].trim().replace(/[^a-zA-Z0-9\s-_]/g, '');
        
        // Format YYYY-MM-DD to DD-MM-YYYY
        const formatDateStr = (dateStr) => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
        };
        const formattedDate = formatDateStr(selectedDate);
        
        // zip filename format: cleanAppName + " ss " + formattedDate + ".zip"
        const zipFilename = `${cleanAppName} ss ${formattedDate}.zip`;
        
        let downloaded = 0;
        const fetchPromises = subs.map(async (s, idx) => {
            try {
                const url = s.screenshot_url;
                if (!url) return;
                
                const response = await fetch(url);
                const blob = await response.blob();
                
                const revName = (s.ocr_extracted_name || s.user_name || s.user_mobile || `user_${idx}`).replace(/[^a-zA-Z0-9\s-_]/g, '');
                const imgFilename = `${revName}_ss_${idx + 1}.jpg`;
                
                zip.file(imgFilename, blob);
                downloaded++;
                if (zipBtn) {
                    zipBtn.innerHTML = `⏳ Downloading (${downloaded}/${subs.length})...`;
                }
            } catch (e) {
                console.error('Failed to download screenshot for ZIP:', e);
            }
        });
        
        await Promise.all(fetchPromises);
        
        if (downloaded === 0) {
            showNotification('Could not download any screenshots. Please verify connection.', true);
            if (zipBtn) {
                zipBtn.disabled = false;
                zipBtn.innerHTML = originalHtml;
            }
            return;
        }
        
        if (zipBtn) zipBtn.innerHTML = '⚡ Generating ZIP...';
        const content = await zip.generateAsync({ type: 'blob' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = zipFilename;
        link.click();
        
        showNotification(`Downloaded ZIP: ${zipFilename}`);
        if (zipBtn) {
            zipBtn.disabled = false;
            zipBtn.innerHTML = originalHtml;
        }
    } catch (err) {
        console.error('ZIP generation failed:', err);
        showNotification(`ZIP Generation Failed: ${err.message}`, true);
        if (zipBtn) {
            zipBtn.disabled = false;
            zipBtn.innerHTML = originalHtml;
        }
    }
};

window.downloadAllSubmissionsZip = downloadAllSubmissionsZip;

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

                                <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-755 flex flex-col gap-1.5 text-[11px] text-left">
                                    <div class="flex items-center justify-between">
                                        <span class="font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[9px]">Submitted By:</span>
                                        <span class="font-extrabold text-indigo-600 dark:text-indigo-400">${escapeHtml(s.user_name || 'No Name')}</span>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[9px]">User Email:</span>
                                        <span class="font-bold text-gray-700 dark:text-gray-300">${escapeHtml(s.user_email || 'No Email')}</span>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[9px]">Mobile:</span>
                                        <span class="font-extrabold text-orange-500">📱 ${escapeHtml(s.user_mobile || 'No mobile registered')}</span>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider text-[9px]">Submitted At:</span>
                                        <span class="text-gray-450 font-semibold">${timeStr}</span>
                                    </div>
                                </div>
                            </div>

                            ${isReviewTask ? `
                            <!-- Comment -->
                            <div class="rounded-2xl bg-white dark:bg-gray-855 p-3 md:p-4 border border-gray-150 dark:border-gray-800 shadow-sm text-left">
                                <p class="text-[9px] font-black uppercase text-gray-400 tracking-wider">Assigned Comment</p>
                                <p class="mt-1.5 text-xs font-bold text-gray-800 dark:text-gray-255 italic">${escapeHtml(s.assigned_comment || '')}</p>
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
    
    const selectedDate = window.adminSubmissionsView.selectedDate;
    let filteredReviews = scraped.filter(r => {
        const dateVal = r.date || r.time;
        if (!dateVal) return false;
        const d = new Date(dateVal);
        const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return localDateStr === selectedDate;
    });

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
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <button type="button" id="fetch-playstore-reviews-btn" class="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2.5 text-xs transition active:scale-95 shadow-sm uppercase tracking-wider text-center cursor-pointer">
                    🔄 Fetch Reviews
                </button>
                
                <button type="button" id="admin-sub-manual-list-btn" class="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black px-4 py-2.5 text-xs transition active:scale-95 shadow-sm uppercase tracking-wider text-center flex items-center justify-center gap-1.5 cursor-pointer">
                    ✍️ Paste Manual List
                </button>

                <div class="flex items-center justify-between xs:justify-start gap-2 bg-white dark:bg-slate-850 border border-slate-200/50 dark:border-slate-700 rounded-xl px-3 py-2">
                    <label for="playstore-star-filter" class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Rating:</label>
                    <select id="playstore-star-filter" class="bg-transparent text-xs font-bold text-slate-750 dark:text-slate-200 focus:outline-none cursor-pointer" style="outline: none;">
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
                <button type="button" id="download-playstore-excel-btn" class="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 text-xs transition active:scale-95 shadow-sm uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer">
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

    const hasFetched = !!(window.adminSubmissionsView?.fetchedTasks?.[`${selectedTask?.id || ''}_${selectedDate}`] || scraped.length > 0);

    const listHtml = countFiltered === 0 ? (
        !hasFetched ? `
            <div class="py-16 text-center text-sm border border-dashed border-indigo-200/50 dark:border-indigo-900/40 bg-indigo-50/10 dark:bg-indigo-950/5 rounded-2xl p-6">
                <p class="font-extrabold text-indigo-650 dark:text-indigo-400">ℹ️ Reviews Not Loaded Yet</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    Please click "Fetch Reviews" or "Paste Manual List" to load reviewer data from Google Play.
                </p>
            </div>
        ` : `
            <div class="py-16 text-center text-sm border border-dashed border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/5 rounded-2xl p-6">
                <p class="font-extrabold text-red-650 dark:text-red-400">⚠️ No Reviews Found (0 Live Reviews)</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    There are no reviews posted on the selected date (${selectedDate}) with the chosen star rating filter. The reviews might not be published or live yet.
                </p>
            </div>
        `
    ) : `
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
                        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                                ${userImage ? `
                                    <img src="${escapeHtml(userImage)}" alt="${escapeHtml(user)}" class="h-9 w-9 shrink-0 rounded-full bg-slate-200 object-cover" referrerPolicy="no-referrer" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                ` : ''}
                                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white" style="background-color: ${avatarColor(user, index)}; display: ${userImage ? 'none' : 'flex'}">
                                    ${initial}
                                </div>
                                <div class="min-w-0">
                                    <h4 class="text-xs font-black text-slate-800 dark:text-slate-200 truncate max-w-[150px] sm:max-w-none">${escapeHtml(user)}</h4>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        ${starRow(rating)}
                                        <span class="text-[9px] font-bold text-slate-400">${escapeHtml(formattedDate)}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex sm:flex-col items-center sm:items-end gap-1.5 mt-2 sm:mt-0 shrink-0">
                                ${matched ? `
                                    <span class="rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[8px] font-black text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">✅ MATCHED</span>
                                    <span class="text-[8px] font-bold text-slate-400 font-mono">${escapeHtml(matched.user_mobile || matched.userMobile || '')}</span>
                                ` : `
                                    <span class="rounded-full bg-slate-50 dark:bg-slate-800/40 px-2 py-0.5 text-[8px] font-black text-slate-500 border border-slate-150 dark:border-slate-700 shrink-0">NOT MATCHED</span>
                                `}
                            </div>
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

const showAdminManualNamesModal = () => {
    let modal = document.getElementById('admin-manual-names-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'admin-manual-names-modal';
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm hidden';
        document.body.appendChild(modal);
    }

    const currentNames = (window.adminSubmissionsView.scrapedReviews || [])
        .filter(r => r.text === 'Manually entered reviewer name')
        .map(r => r.userName)
        .join('\n');

    modal.innerHTML = `
        <div class="bg-white dark:bg-slate-950 rounded-3xl border border-slate-155 dark:border-slate-850 shadow-2xl w-full max-w-lg p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 class="text-sm sm:text-base font-black text-slate-850 dark:text-white flex items-center gap-2">
                    ✍️ Paste Manual Reviewer Names
                </h3>
                <button type="button" id="close-manual-names-modal-btn" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650 transition cursor-pointer" style="outline: none;">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <div class="space-y-1">
                <label class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reviewer Names List</label>
                <textarea id="manual-names-textarea" class="w-full h-56 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white dark:focus:ring-indigo-400/50 placeholder-slate-450" placeholder="Paste reviewer names here (one name per line)...">${escapeHtml(currentNames)}</textarea>
            </div>

            <div class="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-850">
                <button type="button" id="cancel-manual-names-btn" class="rounded-xl px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-250 font-black text-xs uppercase transition active:scale-95 shadow-sm cursor-pointer" style="outline: none;">
                    Cancel
                </button>
                <button type="button" id="submit-manual-names-btn" class="rounded-xl px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase transition active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer" style="outline: none;">
                    ⚡ Verify & Match
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    const closeModal = () => modal.classList.add('hidden');
    
    document.getElementById('close-manual-names-modal-btn').onclick = closeModal;
    document.getElementById('cancel-manual-names-btn').onclick = closeModal;
    
    document.getElementById('submit-manual-names-btn').onclick = async () => {
        const input = document.getElementById('manual-names-textarea').value;
        const names = input.split('\n').map(n => n.trim()).filter(n => n.length > 1);
        
        const scrapedOnly = (window.adminSubmissionsView.scrapedReviews || [])
            .filter(r => r.text !== 'Manually entered reviewer name');

        const selectedTaskId = window.adminSubmissionsView.selectedTaskId;
        const selectedDate = window.adminSubmissionsView.selectedDate;

        if (names.length > 0) {
            const manualReviews = names.map(name => ({
                userName: name,
                score: 5,
                text: 'Manually entered reviewer name',
                date: new Date().toISOString()
            }));
            window.adminSubmissionsView.scrapedReviews = [
                ...scrapedOnly,
                ...manualReviews
            ];
            
            window.adminSubmissionsView.fetchedTasks = window.adminSubmissionsView.fetchedTasks || {};
            window.adminSubmissionsView.fetchedTasks[`${selectedTaskId}_${selectedDate}`] = true;

            showNotification(`Added ${names.length} manual reviewer names to search list.`);
            closeModal();
            renderAdminSubmissions();

            // Auto-process if payout day is passed
            const selectedTask = (window.allTasksCache || []).find(t => t.id === selectedTaskId);
            const dateSubs = (adminSubmissionsCache || []).filter(s => getSubmissionLocalDateStr(s.submitted_at || s.submittedAt) === selectedDate);
            const taskSubs = dateSubs.filter(s => s.task_id === selectedTaskId || s.taskId === selectedTaskId);
            const delayDays = Number(selectedTask?.paymentDelayDays || selectedTask?.listDays || selectedTask?.list_days || 7);
            const payoutDayPassed = isPayoutDayPassed(selectedDate, delayDays);
            if (payoutDayPassed) {
                await saveReviewsToFirestore(selectedTaskId, selectedDate, window.adminSubmissionsView.scrapedReviews);
                await autoProcessSubmissions(taskSubs, window.adminSubmissionsView.scrapedReviews, payoutDayPassed);
            }
        } else {
            window.adminSubmissionsView.scrapedReviews = scrapedOnly;
            showNotification('Cleared all manual reviewer names.');
            closeModal();
            renderAdminSubmissions();
        }
    };
};

const isPayoutDayPassed = (selectedDate, delayDays) => {
    const today = new Date();
    const todayIstDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const [yVal, mVal, dVal] = selectedDate.split('-').map(Number);
    const releaseDateObj = new Date(yVal, mVal - 1, dVal);
    releaseDateObj.setDate(releaseDateObj.getDate() + delayDays);
    const releaseDateStr = `${releaseDateObj.getFullYear()}-${String(releaseDateObj.getMonth() + 1).padStart(2, '0')}-${String(releaseDateObj.getDate()).padStart(2, '0')}`;

    return todayIstDateStr >= releaseDateStr;
};

const saveReviewsToFirestore = async (taskId, dateVal, reviewsList) => {
    try {
        console.log(`[Permanent-Reviews] Saving ${reviewsList.length} reviews to Firestore for ${taskId} on ${dateVal}`);
        const scrapedDocRef = window.doc(window.db, `artifacts/${appId}/public/data/tasks/${taskId}/scraped_reviews`, dateVal);
        await window.setDoc(scrapedDocRef, {
            reviews: reviewsList,
            savedAt: Date.now()
        }, { merge: true });
        console.log('[Permanent-Reviews] Successfully saved reviews to Firestore.');
    } catch (err) {
        console.error('[Permanent-Reviews] Failed to save reviews to Firestore:', err);
    }
};

const fetchPlayStoreReviewsDirectly = async (taskId, dateVal) => {
    const selectedTask = (window.allTasksCache || []).find(t => t.id === taskId);
    const taskLink = selectedTask?.taskLink || selectedTask?.task_link || selectedTask?.link || '';
    if (!taskLink) {
        console.warn('No task link found to fetch reviews.');
        return false;
    }

    // Helper to extract package ID
    const extractPkgId = (val) => {
        const raw = String(val || '').trim();
        if (raw.includes('id=')) {
            try {
                const url = new URL(raw);
                const pkg = url.searchParams.get('id');
                return pkg ? pkg.trim() : raw;
            } catch {
                const match = raw.match(/[?&]id=([^&#]+)/);
                return match ? match[1] : raw;
            }
        }
        return raw;
    };

    const packageId = extractPkgId(taskLink);
    const dateSubs = (adminSubmissionsCache || []).filter(s => getSubmissionLocalDateStr(s.submitted_at || s.submittedAt) === dateVal);
    const taskSubs = dateSubs.filter(s => s.task_id === taskId || s.taskId === taskId);
    
    let success = false;
    let fetchedReviews = [];

    // Try Hugging Face Space first (good IP addresses, CORS enabled)
    try {
        console.log(`[Fetch-Reviews] Trying Hugging Face Space for ${packageId} on ${dateVal}`);
        const hfResp = await fetchWithTimeout(`https://yash9525-rw-live-checker.hf.space/api/public-reviews?packageId=${encodeURIComponent(packageId)}&date=${encodeURIComponent(dateVal)}`, {
            method: 'GET'
        }, 12000);
        
        const hfData = await hfResp.json().catch(() => ({}));
        if (hfData && hfData.ok && Array.isArray(hfData.reviews)) {
            fetchedReviews = hfData.reviews;
            success = true;
        }
    } catch (hfErr) {
        console.warn('[Fetch-Reviews] Hugging Face Space failed, falling back to backend:', hfErr.message);
    }

    // Fallback to Render backend scraper if Hugging Face failed
    if (!success) {
        try {
            const token = await getBackendAuthToken();
            const resp = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/scraper/fetch-reviews`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: taskLink,
                    taskId: taskId,
                    selectedDate: dateVal
                })
            }, 15000);
            
            const data = await resp.json().catch(() => ({}));
            if (data.ok && Array.isArray(data.reviews)) {
                fetchedReviews = data.reviews;
                success = true;
            }
        } catch (err) {
            console.error('[Fetch-Reviews] Fallback backend fetch failed:', err);
        }
    }

    if (success && fetchedReviews.length >= 0) {
        window.adminSubmissionsView.scrapedReviews = fetchedReviews;
        
        window.adminSubmissionsView.fetchedTasks = window.adminSubmissionsView.fetchedTasks || {};
        window.adminSubmissionsView.fetchedTasks[`${taskId}_${dateVal}`] = true;

        showNotification(`Successfully fetched ${fetchedReviews.length} reviews from Play Store.`);
        renderAdminSubmissions();

        // Determine if today is on or after the payout day
        const delayDays = Number(selectedTask?.paymentDelayDays || selectedTask?.listDays || selectedTask?.list_days || 7);
        const payoutDayPassed = isPayoutDayPassed(dateVal, delayDays);

        // Auto-process if payout day is passed
        if (payoutDayPassed) {
            // Save permanently in Firestore
            await saveReviewsToFirestore(taskId, dateVal, fetchedReviews);
            
            // Auto approve/reject pending submissions
            await autoProcessSubmissions(taskSubs, fetchedReviews, payoutDayPassed);
        }
        return true;
    }
    return false;
};

const loadPermanentScrapedReviews = async (taskId, dateVal) => {
    if (!taskId || !dateVal) return;
    
    // Guard: already fetched or loading in this session
    window.adminSubmissionsView.fetchedTasks = window.adminSubmissionsView.fetchedTasks || {};
    if (window.adminSubmissionsView.fetchedTasks[`${taskId}_${dateVal}`]) {
        return;
    }
    
    const selectedTask = (window.allTasksCache || []).find(t => t.id === taskId);
    if (!selectedTask) return;
    
    const delayDays = Number(selectedTask.paymentDelayDays || selectedTask.listDays || selectedTask.list_days || 7);
    const payoutDayPassed = isPayoutDayPassed(dateVal, delayDays);
    
    if (!payoutDayPassed) {
        // If before payout day, we don't load from Firestore
        return;
    }

    // Mark as loaded to prevent multiple requests
    window.adminSubmissionsView.fetchedTasks[`${taskId}_${dateVal}`] = true;

    try {
        console.log(`[Permanent-Reviews] Checking Firestore for saved reviews of task ${taskId} on ${dateVal}`);
        const scrapedDocRef = window.doc(window.db, `artifacts/${appId}/public/data/tasks/${taskId}/scraped_reviews`, dateVal);
        const scrapedDocSnap = await window.getDoc(scrapedDocRef);
        
        if (scrapedDocSnap.exists()) {
            const data = scrapedDocSnap.data();
            if (data && Array.isArray(data.reviews)) {
                console.log(`[Permanent-Reviews] Loaded ${data.reviews.length} reviews from Firestore.`);
                window.adminSubmissionsView.scrapedReviews = data.reviews;
                renderAdminSubmissions();
                return;
            }
        }
        
        // If document doesn't exist, we auto-run the fetch!
        // But check if there are pending submissions first.
        const dateSubs = (adminSubmissionsCache || []).filter(s => getSubmissionLocalDateStr(s.submitted_at || s.submittedAt) === dateVal);
        const taskSubs = dateSubs.filter(s => s.task_id === taskId || s.taskId === taskId);
        const pendingSubs = taskSubs.filter(s => s.manual_status === 'pending');
        
        if (pendingSubs.length === 0) {
            console.log('[Permanent-Reviews] No pending submissions left, skipping auto-fetch.');
            return;
        }
        
        console.log('[Permanent-Reviews] No saved reviews found, auto-triggering fetch...');
        await fetchPlayStoreReviewsDirectly(taskId, dateVal);
    } catch (err) {
        console.error('[Permanent-Reviews] Error loading reviews:', err);
    }
};


const autoProcessSubmissions = async (taskSubs, scraped, payoutDayPassed) => {
    if (!payoutDayPassed) return;
    
    const pendingSubs = taskSubs.filter(s => s.manual_status === 'pending');
    if (pendingSubs.length === 0) return;

    const isSubmissionLive = (s) => {
        if (!scraped || scraped.length === 0) return false;
        const ocrName = String(s.ocr_extracted_name || '').trim().toLowerCase();
        if (!ocrName || ocrName === 'unknown user') return false;
        return scraped.some(r => {
            const rName = String(r.userName || r.user || '').trim().toLowerCase();
            return rName === ocrName || rName.includes(ocrName) || ocrName.includes(rName);
        });
    };

    showNotification(`⚡ Auto-processing ${pendingSubs.length} pending submissions...`);
    
    try {
        const token = await getBackendAuthToken();
        let approvedCount = 0;
        let rejectedCount = 0;

        for (const s of pendingSubs) {
            const isLive = isSubmissionLive(s);
            const body = isLive 
                ? { manualStatus: 'approved', verifiedAt: Date.now() }
                : { manualStatus: 'rejected' };
                
            try {
                await fetchWithTimeout(`${BACKEND_BASE_URL}/api/admin/task-submissions/${encodeURIComponent(s.id)}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }, 8000);
                if (isLive) approvedCount++;
                else rejectedCount++;
            } catch (err) {
                console.error(`Failed to auto-process submission ${s.id}:`, err);
            }
        }

        showNotification(`✅ Auto-process complete: ${approvedCount} approved, ${rejectedCount} rejected.`);
        loadAdminSubmissions();
    } catch (err) {
        console.error('Auto-processing failed:', err);
        showNotification('Auto-processing failed: ' + err.message, true);
    }
};

const renderOverviewTabContent = (taskSubs, selectedTask, selectedDate) => {
    const total = taskSubs.length;
    const reward = Number(selectedTask?.reward || selectedTask?.ratePerReview || selectedTask?.rate_per_review || 0);

    if (total === 0) {
        return `
            <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                <div class="bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 p-5 sm:p-6 rounded-2xl md:col-span-5 flex flex-col items-center justify-center shadow-sm py-12">
                    <p class="font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide">No Screenshots</p>
                    <p class="text-xs text-slate-450 dark:text-slate-550 text-center mt-1">No screenshots received for this task on this date.</p>
                </div>
                <div class="bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 p-5 sm:p-6 rounded-2xl md:col-span-7 flex flex-col justify-between shadow-sm space-y-4">
                    <div>
                        <h4 class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Task Details & Summary</h4>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div class="bg-white dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-150/40 dark:border-slate-850 shadow-sm flex flex-col">
                                <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Target Date</span>
                                <span class="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">${formatDatePickerDate(selectedDate)}</span>
                            </div>
                            <div class="bg-white dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-150/40 dark:border-slate-850 shadow-sm flex flex-col">
                                <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Review Payout Rate</span>
                                <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1">₹${reward} per review</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    const approvedCount = taskSubs.filter(s => s.manual_status === 'approved').length;
    const pendingCount = taskSubs.filter(s => s.manual_status === 'pending').length;
    const rejectedCount = taskSubs.filter(s => s.manual_status === 'rejected').length;

    const approvedPercent = Math.round((approvedCount / total) * 100);
    const pendingPercent = Math.round((pendingCount / total) * 100);
    const rejectedPercent = Math.max(0, 100 - (approvedPercent + pendingPercent)); // Ensure sum is 100

    const totalRevenueSpent = approvedCount * reward;

    const val1 = approvedPercent;
    const val2 = val1 + pendingPercent;
    const gradientStyle = `background: conic-gradient(
        #10b981 0% ${val1}%, 
        #f59e0b ${val1}% ${val2}%, 
        #ef4444 ${val2}% 100%
    );`;

    return `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            <!-- Left Card: Circular Chart -->
            <div class="bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 p-5 sm:p-6 rounded-2xl flex flex-col items-center justify-center md:col-span-5 shadow-sm">
                <h4 class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-6">Submission Breakdown</h4>
                
                <div class="relative w-44 h-44 sm:w-48 sm:h-48 rounded-full shadow-lg flex items-center justify-center" style="${gradientStyle}">
                    <div class="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-white dark:bg-slate-950 flex flex-col items-center justify-center shadow-inner">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Received</span>
                        <span class="text-3xl font-black text-slate-850 dark:text-white mt-1">${total}</span>
                        <span class="text-[8px] font-black text-indigo-500 uppercase tracking-widest mt-1.5">Screenshots</span>
                    </div>
                </div>

                <!-- Small labels inside the card -->
                <div class="flex flex-wrap items-center justify-center gap-4 mt-6 text-[10px] font-extrabold tracking-wide uppercase">
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Approved (${approvedPercent}%)</span>
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Pending (${pendingPercent}%)</span>
                    <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Rejected (${rejectedPercent}%)</span>
                </div>
            </div>

            <!-- Right Card: Stats & Financials -->
            <div class="bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 p-5 sm:p-6 rounded-2xl md:col-span-7 flex flex-col justify-between shadow-sm space-y-4">
                <div>
                    <h4 class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Task Details & Summary</h4>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="bg-white dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-150/40 dark:border-slate-850 shadow-sm flex flex-col">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Target Date</span>
                            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">${formatDatePickerDate(selectedDate)}</span>
                        </div>
                        <div class="bg-white dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-150/40 dark:border-slate-850 shadow-sm flex flex-col">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Review Payout Rate</span>
                            <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1">₹${reward} per review</span>
                        </div>
                    </div>
                </div>

                <div class="border-t border-dashed border-slate-200 dark:border-slate-700/60 pt-4">
                    <h4 class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Financial Overview</h4>
                    <div class="bg-emerald-500/[0.04] dark:bg-emerald-950/[0.08] p-4 rounded-2xl border border-emerald-500/10 dark:border-emerald-900/20 flex items-center justify-between">
                        <div>
                            <span class="text-[10px] font-black text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider">Total Revenue Spent</span>
                            <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">₹${totalRevenueSpent}</p>
                            <p class="text-[9px] font-bold text-slate-400 mt-0.5">${approvedCount} approved submissions paid out</p>
                        </div>
                        <div class="h-10 w-10 rounded-full bg-emerald-500/10 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                            ₹
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

const renderPaymentsTabContent = (taskSubs) => {
    const paidSubs = taskSubs.filter(s => s.manual_status === 'approved');

    if (paidSubs.length === 0) {
        return `
            <div class="py-16 text-center text-sm border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10 rounded-2xl p-6">
                <p class="font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide">No Approved Submissions</p>
                <p class="text-xs text-slate-450 dark:text-slate-550 mt-1">Once you approve user submissions, their payment status will be recorded here.</p>
            </div>
        `;
    }

    return `
        <div class="space-y-4">
            <div class="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1">
                Showing Payments for ${paidSubs.length} Approved Submissions
            </div>
            
            <div class="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr class="bg-slate-50/50 dark:bg-slate-850/40 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 uppercase font-black text-[9px] tracking-wider">
                            <th class="py-3 px-4">User Name</th>
                            <th class="py-3 px-3">Mobile No.</th>
                            <th class="py-3 px-3 text-center">Amount</th>
                            <th class="py-3 px-3 text-center">Status</th>
                            <th class="py-3 px-4 text-right">Payment Time</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
                        ${paidSubs.map((s, idx) => {
                            const user = s.user_name || 'No Name';
                            const mobile = s.user_mobile || 'No Mobile';
                            const amt = s.reward || 0;
                            const isPaid = s.payout_status === 'paid';
                            const statusColor = isPaid ? 'bg-cyan-500' : 'bg-amber-500';
                            const statusText = isPaid ? 'PAID' : 'PENDING';
                            
                            const paymentTime = s.paidAt || s.paid_at || s.verifiedAt || s.verified_at || s.submitted_at || s.submittedAt;
                            const formattedTime = paymentTime ? new Date(paymentTime).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                            }) : 'Pending';

                            return `
                                <tr class="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition">
                                    <td class="py-3.5 px-4 font-extrabold text-slate-800 dark:text-slate-200">${escapeHtml(user)}</td>
                                    <td class="py-3.5 px-3 font-mono font-bold text-slate-500 dark:text-slate-400">${escapeHtml(mobile)}</td>
                                    <td class="py-3.5 px-3 text-center font-black text-emerald-600 dark:text-emerald-400">₹${amt}</td>
                                    <td class="py-3.5 px-3 text-center">
                                        <span class="inline-block rounded-full ${statusColor} text-white px-2 py-0.5 text-[8px] font-black tracking-wider uppercase shadow-sm">
                                            ${statusText}
                                        </span>
                                    </td>
                                    <td class="py-3.5 px-4 text-right font-bold text-slate-450 dark:text-slate-500">${formattedTime}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
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
            const task = (window.allTasksCache || []).find(t => t.id === (sub.task_id || sub.taskId));
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



    // Group rows by EVERY task in our cache so that OFF tasks also show up!
    let filteredTasks = [...(window.allTasksCache || [])];
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

    console.log('[AdminSubs-Render] isOwner:', isOwner, 'allTasksCache.length:', (window.allTasksCache || []).length, 'filteredTasks.length:', filteredTasks.length, 'dateSubs.length:', dateSubs.length, 'taskRows.length:', taskRows.length, 'subs.length:', subs.length, 'selectedDate:', selectedDate);

    const isDetailView = window.adminSubmissionsView.viewState === 'detail';
    const selectedTaskId = window.adminSubmissionsView.selectedTaskId;

    let html = '';

    if (isDetailView && selectedTaskId) {
        // Automatically check/load permanent reviews if on or after payout day
        loadPermanentScrapedReviews(selectedTaskId, selectedDate);

        // --- DETAIL VIEW PANEL ---
        const selectedTask = (window.allTasksCache || []).find(t => t.id === selectedTaskId);
        const selectedTaskName = selectedTask ? (selectedTask.appName || selectedTask.title) : 'Task Detail';

        // Filter right-side details list
        const taskSubs = dateSubs.filter(s => s.task_id === selectedTaskId || s.taskId === selectedTaskId);
        
        // Check if a reviewer name has appeared in the live scraped reviews list
        const scraped = window.adminSubmissionsView.scrapedReviews || [];
        const isSubmissionLive = (s) => {
            if (!scraped || scraped.length === 0) return false;
            const ocrName = String(s.ocr_extracted_name || '').trim().toLowerCase();
            if (!ocrName || ocrName === 'unknown user') return false;
            return scraped.some(r => {
                const rName = String(r.userName || r.user || '').trim().toLowerCase();
                return rName === ocrName || rName.includes(ocrName) || ocrName.includes(rName);
            });
        };

        // Determine if payout day (delay) is passed
        const delayDays = Number(selectedTask?.paymentDelayDays || selectedTask?.listDays || selectedTask?.list_days || 7);
        const payoutDayPassed = isPayoutDayPassed(selectedDate, delayDays);

        // Calculate duplicate usernames
        const ocrNamesMap = {};
        taskSubs.forEach(s => {
            const name = String(s.ocr_extracted_name || '').trim().toLowerCase();
            if (name && name !== 'unknown user' && name !== 'no review name found' && name !== 'failed') {
                ocrNamesMap[name] = (ocrNamesMap[name] || 0) + 1;
            }
        });
        const duplicateNames = new Set(
            Object.keys(ocrNamesMap).filter(name => ocrNamesMap[name] > 1)
        );

        // Chips counts
        const countAll = taskSubs.length;
        const countOcr = taskSubs.filter(s => s.ocr_status === 'completed').length;
        const countSameUsername = taskSubs.filter(s => {
            const name = String(s.ocr_extracted_name || '').trim().toLowerCase();
            return duplicateNames.has(name);
        }).length;
        
        let countPending = 0;
        let countRejected = 0;
        
        if (payoutDayPassed) {
            countPending = taskSubs.filter(s => s.manual_status === 'pending' && isSubmissionLive(s)).length;
            countRejected = taskSubs.filter(s => s.manual_status === 'rejected' || (s.manual_status === 'pending' && !isSubmissionLive(s))).length;
        } else {
            countPending = taskSubs.filter(s => s.manual_status === 'pending').length;
            countRejected = taskSubs.filter(s => s.manual_status === 'rejected').length;
        }

        // Apply active filter
        let filteredSubs = [...taskSubs];
        if (window.adminSubmissionsView.selectedSubFilter === 'ocr_passed') {
            filteredSubs = filteredSubs.filter(s => s.ocr_status === 'completed');
        } else if (window.adminSubmissionsView.selectedSubFilter === 'pending') {
            if (payoutDayPassed) {
                filteredSubs = filteredSubs.filter(s => s.manual_status === 'pending' && isSubmissionLive(s));
            } else {
                filteredSubs = filteredSubs.filter(s => s.manual_status === 'pending');
            }
        } else if (window.adminSubmissionsView.selectedSubFilter === 'rejected') {
            if (payoutDayPassed) {
                filteredSubs = filteredSubs.filter(s => s.manual_status === 'rejected' || (s.manual_status === 'pending' && !isSubmissionLive(s)));
            } else {
                filteredSubs = filteredSubs.filter(s => s.manual_status === 'rejected');
            }
        } else if (window.adminSubmissionsView.selectedSubFilter === 'same_username') {
            filteredSubs = filteredSubs.filter(s => {
                const name = String(s.ocr_extracted_name || '').trim().toLowerCase();
                return duplicateNames.has(name);
            });
        }

        window.currentActiveSubmissions = filteredSubs; // Cache list for detail modal

        html = `
            <style>
                /* Thin scrollbar for mobile */
                @media (max-width: 639px) {
                    .mobile-thin-scroll::-webkit-scrollbar { height: 2px !important; }
                    .mobile-thin-scroll::-webkit-scrollbar-track { background: transparent; }
                    .mobile-thin-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.25); border-radius: 999px; }
                    .mobile-thin-scroll { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.25) transparent; }
                    @keyframes mobileFilterBlink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
                    .mobile-filter-blink { animation: mobileFilterBlink 1.2s ease-in-out infinite; }
                }
            </style>

            <!-- Mobile Compact Header (replaces detail toolbar on small screens) -->
            <div class="sm:hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-2.5 mb-1.5 flex items-center gap-2">
                <button id="admin-sub-back-btn-mobile" class="h-8 w-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center transition active:scale-95 shadow-sm" style="outline: none;" title="Back">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                </button>
                <div class="min-w-0 flex-1">
                    <h3 class="text-[11px] font-black text-gray-900 dark:text-white truncate leading-tight">${escapeHtml(getCleanAppName(selectedTaskName))}</h3>
                    <p class="text-[8px] text-slate-400 dark:text-slate-500 font-bold">${formatDatePickerDate(selectedDate)}</p>
                </div>
                ${window.adminSubmissionsView.selectedDetailTab === 'submissions' ? `
                    <!-- Filter Icon Button -->
                    <div class="relative">
                        <button type="button" id="mobile-filter-icon-btn" class="h-8 w-8 shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-200/50 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition active:scale-95 shadow-sm" style="outline: none;" title="Filter">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                        </button>
                        ${countSameUsername > 0 ? '<span class="mobile-filter-blink absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-gray-800"></span>' : ''}
                    </div>
                ` : ''}
                ${window.adminSubmissionsView.selectedDetailTab === 'submissions' && countAll > 0 ? `
                    <button type="button" id="admin-sub-download-zip-btn" class="h-8 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1 transition active:scale-95 shadow-sm px-2.5 cursor-pointer" style="outline: none;" title="Download ZIP">
                        <span class="text-xs">📥</span>
                        <span class="text-[9px] font-black uppercase tracking-wider">ZIP</span>
                    </button>
                ` : ''}
            </div>

            <!-- Mobile Filter Dropdown Popup (hidden by default) -->
            ${window.adminSubmissionsView.selectedDetailTab === 'submissions' ? `
                <div id="mobile-filter-popup" class="sm:hidden hidden fixed inset-0 z-[9999]" style="pointer-events: none;">
                    <div id="mobile-filter-popup-overlay" class="absolute inset-0 bg-black/20" style="pointer-events: auto;"></div>
                    <div id="mobile-filter-popup-menu" class="absolute bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 w-56" style="pointer-events: auto; top: 64px; right: 60px;">
                        <div class="px-3 py-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Filter By</div>
            ${(() => {
                const filterOpts = [
                    { value: 'all', label: 'All Submissions', count: countAll, icon: '📋' },
                    { value: 'ocr_passed', label: 'OCR Passed', count: countOcr, icon: '✅' },
                    { value: 'pending', label: 'Pending', count: countPending, icon: '⏳' },
                    { value: 'rejected', label: 'Rejected', count: countRejected, icon: '❌' },
                    { value: 'same_username', label: 'Same User Name', count: countSameUsername, icon: '⚠️' }
                ];
                return filterOpts.map(opt => {
                    const isActive = window.adminSubmissionsView.selectedSubFilter === opt.value;
                    const activeCls = isActive ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50';
                    const labelCls = isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300';
                    const countCls = isActive ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900' : 'text-slate-400 bg-slate-100 dark:bg-slate-800';
                    const checkSvg = isActive ? '<svg class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>' : '';
                    return '<button type="button" data-action="mobile-popup-filter" data-filter="' + opt.value + '" class="w-full flex items-center gap-2.5 px-3 py-2 text-left transition ' + activeCls + '" style="outline: none;">'
                        + '<span class="text-sm">' + opt.icon + '</span>'
                        + '<span class="text-[11px] font-bold ' + labelCls + ' flex-1">' + opt.label + '</span>'
                        + '<span class="text-[10px] font-black ' + countCls + ' rounded-full px-1.5 py-0.5">' + opt.count + '</span>'
                        + checkSvg
                        + '</button>';
                }).join('');
            })()}
                    </div>
                </div>
            ` : ''}

            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 space-y-6 text-left">
                <!-- Top Detail Toolbar Header (Desktop Only) -->
                 <div class="hidden sm:flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
                     <div class="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                         <button id="admin-sub-back-btn" class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 transition active:scale-95 shadow-sm border border-gray-200/20" title="Back" style="outline: none;">
                             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                         </button>
                         <div class="min-w-0 flex-1">
                             <h3 class="text-base sm:text-lg font-black text-gray-900 dark:text-white truncate">${escapeHtml(getCleanAppName(selectedTaskName))}</h3>
                             <p class="text-[9px] text-indigo-500 font-extrabold uppercase tracking-wider mt-0.5">Task ID: ${escapeHtml(selectedTaskId)}</p>
                         </div>
                     </div>
                     <div class="flex items-center gap-2 w-fit shrink-0 sm:ml-auto">
                         <span class="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-xs font-black text-gray-700 dark:text-gray-350 border border-gray-200/20 shadow-sm shrink-0">
                             Date: ${formatDatePickerDate(selectedDate)}
                         </span>
                         ${window.adminSubmissionsView.selectedDetailTab === 'submissions' && countAll > 0 ? `
                             <button type="button" id="admin-sub-download-zip-btn-desktop" class="rounded-full px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider transition active:scale-95 shadow-sm flex items-center justify-center gap-1 cursor-pointer shrink-0" style="outline: none;" title="Download Screenshots ZIP">
                                 📥 <span>Download ZIP</span>
                             </button>
                         ` : ''}
                     </div>
                 </div>

                 <!-- Detail Tabs -->
                 <div class="flex items-center gap-6 border-b border-gray-100 dark:border-gray-700 pb-2 overflow-x-auto mobile-thin-scroll text-xs">
                     ${['overview', 'submissions', 'names_list', 'play_store_verify', 'payments'].map(tab => {
                         const isActive = window.adminSubmissionsView.selectedDetailTab === tab;
                         const labels = {
                             overview: 'Overview',
                             submissions: 'Submissions',
                             names_list: 'Submitted Names',
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
                 ` : window.adminSubmissionsView.selectedDetailTab === 'overview' ? `
                     ${renderOverviewTabContent(taskSubs, selectedTask, selectedDate)}
                 ` : window.adminSubmissionsView.selectedDetailTab === 'payments' ? `
                     ${renderPaymentsTabContent(taskSubs)}
                 ` : window.adminSubmissionsView.selectedDetailTab !== 'submissions' ? `
                     <div class="py-12 text-center text-sm text-gray-455">
                         <p class="font-extrabold uppercase tracking-wide text-gray-400 dark:text-gray-500">${escapeHtml(window.adminSubmissionsView.selectedDetailTab)} Panel</p>
                         <p class="text-xs text-gray-500 mt-1">This section is configured to run automatically.</p>
                     </div>
                 ` : `
                     <!-- Submissions Filter (Desktop chips only, Mobile uses icon popup) -->
                     <div class="w-full mb-4">
                         <!-- Desktop horizontal chips filter -->
                         <div class="hidden sm:flex flex-wrap items-center gap-2 w-full">
                             ${[
                                 { value: 'all', label: `All (${countAll})` },
                                 { value: 'ocr_passed', label: `OCR Passed (${countOcr})` },
                                 { value: 'pending', label: `Pending (${countPending})` },
                                 { value: 'rejected', label: `Rejected (${countRejected})` },
                                 { value: 'same_username', label: `Same User Name (${countSameUsername})` }
                             ].map(chip => {
                                 const isActive = window.adminSubmissionsView.selectedSubFilter === chip.value;
                                 return `
                                     <button type="button" data-action="select-sub-filter" data-filter="${chip.value}" class="rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all duration-200 border ${isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/80 shadow-sm'}" style="outline: none;">
                                         ${chip.label}
                                     </button>
                                 `;
                             }).join('')}
                         </div>
                         <!-- Mobile: show current filter as inline badge (tapping filter icon in header changes it) -->
                         <div class="sm:hidden">
                             <span class="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border border-indigo-200/40 dark:border-indigo-800/40">
                                 ${{all:'📋 All', ocr_passed:'✅ OCR Passed', pending:'⏳ Pending', rejected:'❌ Rejected', same_username:'⚠️ Same Name'}[window.adminSubmissionsView.selectedSubFilter] || '📋 All'}
                                 <span class="text-indigo-400 dark:text-indigo-500">(${filteredSubs.length})</span>
                             </span>
                         </div>
                     </div>

                    <!-- Screenshot Grid or Duplicate Group View -->
                    ${filteredSubs.length === 0 ? `
                        <div class="py-12 text-center text-sm text-gray-455 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                            No screenshots found matching this filter.
                        </div>
                    ` : window.adminSubmissionsView.selectedSubFilter === 'same_username' ? `
                        <!-- Grouped by OCR name with connector thread -->
                        <div class="space-y-6">
                            ${(() => {
                                const grouped = {};
                                filteredSubs.forEach(s => {
                                    const name = String(s.ocr_extracted_name || 'Unrecognized OCR').trim();
                                    if (!grouped[name]) grouped[name] = [];
                                    grouped[name].push(s);
                                });
                                return Object.keys(grouped).map((name) => {
                                    const items = grouped[name];
                                    return `
                                        <div class="bg-rose-500/[0.02] dark:bg-rose-950/[0.04] border border-rose-200/60 dark:border-rose-900/40 rounded-2xl p-4 space-y-3.5">
                                            <!-- Group Header -->
                                            <div class="flex flex-col xs:flex-row xs:items-center justify-between gap-2 border-b border-rose-100/50 dark:border-rose-900/20 pb-2">
                                                <div class="flex items-center gap-2">
                                                    <span class="text-xs font-black text-rose-650 dark:text-rose-400 uppercase tracking-wider bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded-md">
                                                        ⚠️ Duplicate User Name
                                                    </span>
                                                    <span class="text-sm font-black text-slate-800 dark:text-slate-100">${escapeHtml(name)}</span>
                                                </div>
                                                <span class="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase">
                                                    ${items.length} Submissions Matched
                                                </span>
                                            </div>
                                            
                                            <!-- Connecting Thread & Screenshot Cards -->
                                            <div class="flex flex-wrap items-center gap-3">
                                                ${items.map((s, idx) => {
                                                    let showBadge = false;
                                                    let badgeBg = '';
                                                    let icon = '';
                                                    if (s.manual_status === 'approved') {
                                                        showBadge = true;
                                                        badgeBg = 'bg-emerald-500';
                                                        icon = '✓';
                                                    } else if (s.manual_status === 'rejected') {
                                                        showBadge = true;
                                                        badgeBg = 'bg-rose-500';
                                                        icon = '✕';
                                                    }

                                                    // Find absolute index in the parent taskSubs list to open modal correctly
                                                    const originalIndex = taskSubs.findIndex(item => item.id === s.id);

                                                    // Connection line between items
                                                    const connectionLine = idx > 0 ? `
                                                        <div class="hidden sm:flex items-center justify-center text-rose-400 dark:text-rose-800 font-black select-none h-4 px-1">
                                                            ◀─────────▶
                                                        </div>
                                                    ` : '';

                                                    return `
                                                        ${connectionLine}
                                                        <div class="relative w-16 xs:w-20 sm:w-24 md:w-28 aspect-square rounded-xl overflow-hidden border border-rose-200 dark:border-rose-900/60 bg-gray-900 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center shrink-0" data-action="open-detail-modal" data-index="${originalIndex}">
                                                            <img src="${escapeHtml(s.screenshot_url)}" alt="Screenshot" class="h-full w-full object-cover" loading="lazy">
                                                            
                                                            ${showBadge ? `
                                                            <!-- Overlay Mini Status Badge -->
                                                            <div class="absolute top-1 right-1 flex items-center justify-center h-4 w-4 rounded-full shadow text-[8px] font-black ${badgeBg} text-white border border-white/20 select-none">
                                                                ${icon}
                                                            </div>
                                                            ` : ''}
                                                            
                                                            <!-- Mini Tag with user initials/short name -->
                                                            <div class="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[7px] font-black text-center py-0.5 truncate uppercase">
                                                                ${escapeHtml(s.user_name || 'User')}
                                                            </div>
                                                        </div>
                                                    `;
                                                }).join('')}
                                            </div>
                                        </div>
                                    `;
                                }).join('');
                            })()}
                        </div>
                    ` : `
                        <div class="flex flex-wrap gap-2 justify-start items-start">
                            ${filteredSubs.map((s, idx) => {
                                let showBadge = false;
                                let badgeBg = '';
                                let icon = '';
                                if (s.manual_status === 'approved') {
                                    showBadge = true;
                                    badgeBg = 'bg-emerald-500';
                                    icon = '✓';
                                } else if (s.manual_status === 'rejected') {
                                    showBadge = true;
                                    badgeBg = 'bg-rose-500';
                                    icon = '✕';
                                }
                                
                                return `
                                    <div class="relative w-16 xs:w-20 sm:w-24 md:w-28 aspect-square rounded-xl overflow-hidden border border-gray-150 dark:border-gray-755 bg-gray-900 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center shrink-0" data-action="open-detail-modal" data-index="${idx}">
                                        <img src="${escapeHtml(s.screenshot_url)}" alt="Screenshot" class="h-full w-full object-cover" loading="lazy">
                                        
                                        ${showBadge ? `
                                        <!-- Overlay Mini Status Badge -->
                                        <div class="absolute top-1 right-1 flex items-center justify-center h-4 w-4 rounded-full shadow text-[8px] font-black ${badgeBg} text-white border border-white/20 select-none">
                                            ${icon}
                                        </div>
                                        ` : ''}
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
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
                    <div>
                        <h3 class="text-base sm:text-lg font-black text-gray-900 dark:text-white">Submissions Overview</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Track and manage task submissions by date.</p>
                    </div>
                    <div class="relative w-fit sm:w-auto mt-1 sm:mt-0">
                        <button id="admin-sub-date-picker-btn" class="flex items-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-750 dark:hover:bg-gray-700 px-3.5 py-2 text-xs font-black text-gray-850 dark:text-gray-200 border border-gray-200/40 dark:border-gray-700/50 shadow-sm focus:outline-none cursor-pointer" type="button" style="outline: none;">
                            <span>📅 ${formatDatePickerDate(selectedDate)}</span>
                            <span class="text-gray-400 dark:text-gray-500 text-[10px]">▼</span>
                        </button>
                        <div id="admin-sub-calendar-popup" class="hidden fixed md:absolute left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 top-[30%] md:top-full mt-2 z-[9995] w-[90vw] max-w-[288px] bg-white dark:bg-gray-950 rounded-3xl border border-gray-150 dark:border-gray-850 shadow-2xl p-4 space-y-3">
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
                                        <div class="grid grid-cols-5 gap-1.5 text-center">
                                            <div class="bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-lg border border-gray-100 dark:border-gray-800 min-w-0">
                                                <span class="block font-black text-gray-850 dark:text-gray-200 text-xs truncate tracking-tight">${r.total}</span>
                                                <span class="text-[7.5px] sm:text-[8px] font-bold text-gray-400 uppercase tracking-tight block truncate">Total</span>
                                            </div>
                                            <div class="bg-emerald-50/50 dark:bg-emerald-950/20 p-1.5 rounded-lg border border-emerald-100/10 dark:border-emerald-900/10 min-w-0">
                                                <span class="block font-black text-emerald-600 dark:text-emerald-400 text-xs truncate tracking-tight">${r.ocrPassed}</span>
                                                <span class="text-[7.5px] sm:text-[8px] font-bold text-emerald-500/70 uppercase tracking-tight block truncate">OCR</span>
                                            </div>
                                            <div class="bg-amber-50/50 dark:bg-amber-950/20 p-1.5 rounded-lg border border-amber-100/10 dark:border-amber-900/10 min-w-0">
                                                <span class="block font-black text-amber-600 dark:text-amber-400 text-xs truncate tracking-tight">${r.pending}</span>
                                                <span class="text-[7.5px] sm:text-[8px] font-bold text-amber-500/70 uppercase tracking-tight block truncate">Pend</span>
                                            </div>
                                            <div class="bg-green-50/50 dark:bg-green-950/20 p-1.5 rounded-lg border border-green-100/10 dark:border-green-900/10 min-w-0">
                                                <span class="block font-black text-green-600 dark:text-green-400 text-xs truncate tracking-tight">${r.approved}</span>
                                                <span class="text-[7.5px] sm:text-[8px] font-bold text-green-500/70 uppercase tracking-tight block truncate">Appr</span>
                                            </div>
                                            <div class="bg-red-50/50 dark:bg-red-950/20 p-1.5 rounded-lg border border-red-100/10 dark:border-red-900/10 min-w-0">
                                                <span class="block font-black text-red-600 dark:text-red-400 text-xs truncate tracking-tight">${r.rejected}</span>
                                                <span class="text-[7.5px] sm:text-[8px] font-bold text-red-500/70 uppercase tracking-tight block truncate">Rej</span>
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
    const backBtnMobile = document.getElementById('admin-sub-back-btn-mobile');
    const goBack = () => {
        window.adminSubmissionsView.viewState = 'list';
        window.adminSubmissionsView.selectedTaskId = '';
        renderAdminSubmissions();
    };
    if (backBtn) backBtn.onclick = goBack;
    if (backBtnMobile) backBtnMobile.onclick = goBack;

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

    // --- Mobile Filter Icon Popup ---
    const mobileFilterIconBtn = document.getElementById('mobile-filter-icon-btn');
    const mobileFilterPopup = document.getElementById('mobile-filter-popup');
    const mobileFilterOverlay = document.getElementById('mobile-filter-popup-overlay');
    if (mobileFilterIconBtn && mobileFilterPopup) {
        mobileFilterIconBtn.onclick = () => {
            mobileFilterPopup.classList.toggle('hidden');
        };
    }
    if (mobileFilterOverlay && mobileFilterPopup) {
        mobileFilterOverlay.onclick = () => {
            mobileFilterPopup.classList.add('hidden');
        };
    }
    shellEl.querySelectorAll('[data-action="mobile-popup-filter"]').forEach(btn => {
        btn.onclick = (e) => {
            window.adminSubmissionsView.selectedSubFilter = e.currentTarget.dataset.filter;
            if (mobileFilterPopup) mobileFilterPopup.classList.add('hidden');
            renderAdminSubmissions();
        };
    });

    shellEl.querySelectorAll('[data-action="open-detail-modal"]').forEach(card => {
        card.onclick = (e) => {
            const idx = Number(e.currentTarget.dataset.index);
            window.showAdminSubmissionDetailModal(idx);
        };
    });

    // ZIP download — bind both mobile and desktop buttons
    const zipBtnMobile = document.getElementById('admin-sub-download-zip-btn');
    const zipBtnDesktop = document.getElementById('admin-sub-download-zip-btn-desktop');
    const handleZipDownload = () => {
        const selectedTaskId = window.adminSubmissionsView.selectedTaskId;
        const selectedDate = window.adminSubmissionsView.selectedDate;
        const taskSubs = window.currentActiveSubmissions || [];
        const selectedTask = (window.allTasksCache || []).find(t => t.id === selectedTaskId);
        const taskName = selectedTask ? (selectedTask.appName || selectedTask.title) : 'Task';
        window.downloadAllSubmissionsZip(taskSubs, taskName, selectedDate);
    };
    if (zipBtnMobile) zipBtnMobile.onclick = handleZipDownload;
    if (zipBtnDesktop) zipBtnDesktop.onclick = handleZipDownload;

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
                
                const ok = await fetchPlayStoreReviewsDirectly(selectedTaskId, selectedDate);
                if (!ok) {
                    showNotification('Failed to fetch reviews from Play Store. Please try again.', true);
                }
                
                fetchBtn.disabled = false;
                fetchBtn.innerHTML = originalText;
            };
        }

        const manualBtn = document.getElementById('admin-sub-manual-list-btn');
        if (manualBtn) {
            manualBtn.onclick = () => {
                showAdminManualNamesModal();
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
                
                const selectedDate = window.adminSubmissionsView.selectedDate;
                let filtered = scraped.filter(r => {
                    const dateVal = r.date || r.time;
                    if (!dateVal) return false;
                    const d = new Date(dateVal);
                    const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    return localDateStr === selectedDate;
                });
                if (starFilter !== 'all') {
                    const starNum = Number(starFilter);
                    filtered = filtered.filter(r => Math.round(Number(r.score || r.rating || 5)) === starNum);
                }
                
                if (!filtered.length) {
                    showNotification('No reviews to export.', true);
                    return;
                }
                
                const selectedTask = (window.allTasksCache || []).find(t => t.id === selectedTaskId);
                const selectedTaskName = selectedTask ? (selectedTask.appName || selectedTask.title) : 'Task';
                const appName = selectedTaskName || 'App';
                
                const d = new Date();
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const dateStr = `${day}_${month}_${year}`;
                const filename = `${appName}_${dateStr}.xls`;
                
                const headers = ['Reviewer Name', 'Rating (Stars)', 'Review Comment', 'Status', 'User Mobile', 'Review Date', 'Helpful Count'];
                
                const dateSubs = (adminSubmissionsCache || []).filter(s => getSubmissionLocalDateStr(s.submitted_at || s.submittedAt) === selectedDate);
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
