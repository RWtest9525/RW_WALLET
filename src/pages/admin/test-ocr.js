/**
 * File: src/pages/admin/test-ocr.js
 * Secret Local AI OCR Engine Bulk Tester Page (/test-ocr)
 * Allows testing bulk screenshots against line-by-line assigned comments in-memory.
 * NO data is saved to Firestore or Cloud Storage.
 */

let testOcrItems = [];
let testOcrResults = [];
let testOcrActiveIndex = -1;

export function renderTestOcrPage() {
    const root = document.getElementById('rw-wallet-root');
    
    // Hide standard shell, admin/user panels, and bottom navigation
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.getElementById('main-content')?.classList.add('hidden');
    document.getElementById('page-container')?.classList.add('hidden');
    document.getElementById('bottom-nav')?.classList.add('hidden');
    document.getElementById('admin-panel')?.classList.add('hidden');
    document.getElementById('user-panel')?.classList.add('hidden');

    let targetRoot = root || document.body;

    // Create container for test-ocr if not present
    let container = document.getElementById('test-ocr-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'test-ocr-container';
        container.className = 'fixed inset-0 z-[99999] overflow-y-auto bg-gray-900 text-gray-100 p-4 sm:p-8 font-sans';
        targetRoot.appendChild(container);
    } else {
        container.classList.remove('hidden');
    }

    container.innerHTML = `
        <div class="max-w-6xl mx-auto space-y-6">
            <!-- Header -->
            <div class="bg-gray-800/80 border border-gray-700/60 backdrop-blur-md rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xl">
                            🔍
                        </div>
                        <div>
                            <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight">AI OCR Engine Bulk Tester</h1>
                            <p class="text-xs sm:text-sm text-gray-400">Local Verification Test Utility • <span class="text-emerald-400 font-medium">In-Memory Mode (No Database Saves)</span></p>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono">
                        Route: /test-ocr
                    </span>
                    <button id="test-ocr-home-btn" class="px-3.5 py-1.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-semibold transition-all">
                        ← Back to App
                    </button>
                </div>
            </div>

            <!-- Configuration & Input Controls -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Left: Bulk Comments Input -->
                <div class="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-5 shadow-lg flex flex-col">
                    <div class="flex items-center justify-between mb-3">
                        <label class="text-sm font-semibold text-gray-200 flex items-center gap-2">
                            <span>📝 1. Bulk Assigned Comments</span>
                            <span class="text-xs font-normal text-gray-400">(1 comment per line)</span>
                        </label>
                        <span id="test-ocr-comment-count" class="text-xs px-2.5 py-0.5 rounded-full bg-gray-700 text-gray-300 font-medium">
                            0 comments
                        </span>
                    </div>
                    <textarea id="test-ocr-comments-input" rows="8" 
                        placeholder="Paste assigned comments here, line by line:&#10;What Android version is required to use the app?&#10;How does the app help me discover new movies?&#10;Great user interface and smooth navigation."
                        class="w-full flex-1 bg-gray-900/90 border border-gray-700 rounded-xl p-3.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono resize-none leading-relaxed"></textarea>
                </div>

                <!-- Right: Bulk Screenshot Upload & Settings -->
                <div class="bg-gray-800/60 border border-gray-700/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4">
                    <div>
                        <div class="flex items-center justify-between mb-3">
                            <label class="text-sm font-semibold text-gray-200 flex items-center gap-2">
                                <span>🖼️ 2. Bulk Screenshots Upload</span>
                                <span class="text-xs font-normal text-gray-400">(Ordered 1-to-1)</span>
                            </label>
                            <span id="test-ocr-file-count" class="text-xs px-2.5 py-0.5 rounded-full bg-gray-700 text-gray-300 font-medium">
                                0 images
                            </span>
                        </div>

                        <!-- Dropzone -->
                        <div id="test-ocr-dropzone" class="border-2 border-dashed border-gray-700 hover:border-blue-500/50 bg-gray-900/50 hover:bg-gray-900/80 rounded-xl p-6 text-center cursor-pointer transition-all">
                            <input type="file" id="test-ocr-file-input" multiple accept="image/*" class="hidden">
                            <div class="text-3xl mb-2">📸</div>
                            <p class="text-xs font-medium text-gray-300">Click or drag & drop screenshots here</p>
                            <p class="text-[11px] text-gray-500 mt-1">Select multiple PNG, JPG, or WEBP images</p>
                        </div>
                    </div>

                    <!-- Options & Launch -->
                    <div class="space-y-3 pt-2">
                        <div class="flex items-center justify-between gap-4">
                            <label class="text-xs text-gray-400 font-medium">Task Type / Extractor:</label>
                            <select id="test-ocr-task-type" class="bg-gray-900 border border-gray-700 text-xs text-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500">
                                <option value="google_play_review">Google Play Store Review</option>
                                <option value="instagram">Instagram</option>
                                <option value="youtube">YouTube</option>
                            </select>
                        </div>

                        <div class="flex items-center gap-3">
                            <button id="test-ocr-run-btn" class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                                <span>🚀 Run Bulk AI OCR Test</span>
                            </button>
                            <button id="test-ocr-clear-btn" class="bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium text-xs py-3 px-4 rounded-xl transition-all">
                                🧹 Clear
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Stats Bar -->
            <div id="test-ocr-stats" class="hidden grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div class="bg-gray-800/40 border border-gray-700/50 rounded-xl p-3 text-center">
                    <p class="text-[11px] text-gray-400">Total Tested</p>
                    <p id="stat-total" class="text-lg font-bold text-white">0</p>
                </div>
                <div class="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-center">
                    <p class="text-[11px] text-emerald-400">Pass (≥95%)</p>
                    <p id="stat-pass" class="text-lg font-bold text-emerald-400">0</p>
                </div>
                <div class="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-center">
                    <p class="text-[11px] text-amber-400">Vision AI (90-94%)</p>
                    <p id="stat-vision" class="text-lg font-bold text-amber-400">0</p>
                </div>
                <div class="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 text-center">
                    <p class="text-[11px] text-rose-400">Fail (&lt;90%)</p>
                    <p id="stat-fail" class="text-lg font-bold text-rose-400">0</p>
                </div>
                <div class="bg-gray-800/40 border border-gray-700/50 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                    <p class="text-[11px] text-gray-400">Avg Speed</p>
                    <p id="stat-speed" class="text-lg font-bold text-gray-200">0s</p>
                </div>
            </div>

            <!-- Results Grid / List -->
            <div id="test-ocr-results-container" class="space-y-3">
                <!-- Results rendered dynamically -->
            </div>
        </div>

        <!-- Details Modal -->
        <div id="test-ocr-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
            <div class="bg-gray-800 border border-gray-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                <div class="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-900/50">
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <span>🔍 OCR Inspection Details</span>
                        <span id="modal-item-index" class="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">#1</span>
                    </h3>
                    <button id="modal-close-btn" class="text-gray-400 hover:text-white text-xl font-bold px-2">×</button>
                </div>
                <div class="p-6 overflow-y-auto space-y-5 text-xs">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Left: Image -->
                        <div class="bg-gray-900 border border-gray-700 rounded-xl p-2 flex items-center justify-center min-h-[300px]">
                            <img id="modal-image" src="" alt="Screenshot" class="max-h-[450px] object-contain rounded-lg">
                        </div>

                        <!-- Right: Detailed OCR Output -->
                        <div class="space-y-4">
                            <div class="bg-gray-900/60 border border-gray-700/80 rounded-xl p-3.5 space-y-2">
                                <p class="text-gray-400 font-semibold">Matched Status & Score</p>
                                <div class="flex items-center gap-3">
                                    <span id="modal-status-badge" class="px-2.5 py-1 rounded-lg text-xs font-bold">PASS</span>
                                    <span id="modal-score" class="text-lg font-extrabold text-white">100%</span>
                                </div>
                            </div>

                            <div class="bg-gray-900/60 border border-gray-700/80 rounded-xl p-3.5 space-y-1.5">
                                <p class="text-gray-400 font-semibold">Assigned Comment (Input)</p>
                                <p id="modal-assigned-comment" class="text-gray-200 font-mono bg-gray-950 p-2.5 rounded-lg border border-gray-800 break-words"></p>
                            </div>

                            <div class="bg-gray-900/60 border border-gray-700/80 rounded-xl p-3.5 space-y-1.5">
                                <p class="text-gray-400 font-semibold">Extracted Reviewer Name</p>
                                <p id="modal-reviewer-name" class="text-emerald-400 font-semibold font-mono bg-gray-950 p-2.5 rounded-lg border border-gray-800"></p>
                            </div>

                            <div class="bg-gray-900/60 border border-gray-700/80 rounded-xl p-3.5 space-y-1.5">
                                <p class="text-gray-400 font-semibold">Extracted Review Comment</p>
                                <p id="modal-review-comment" class="text-blue-300 font-mono bg-gray-950 p-2.5 rounded-lg border border-gray-800 break-words"></p>
                            </div>

                            <div class="bg-gray-900/60 border border-gray-700/80 rounded-xl p-3.5 space-y-1.5">
                                <p class="text-gray-400 font-semibold">Raw Extracted OCR Lines</p>
                                <div id="modal-raw-lines" class="text-gray-400 font-mono text-[11px] bg-gray-950 p-2.5 rounded-lg border border-gray-800 max-h-36 overflow-y-auto space-y-1"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupTestOcrEvents();
}

function setupTestOcrEvents() {
    const commentsInput = document.getElementById('test-ocr-comments-input');
    const commentCount = document.getElementById('test-ocr-comment-count');
    const fileInput = document.getElementById('test-ocr-file-input');
    const dropzone = document.getElementById('test-ocr-dropzone');
    const fileCount = document.getElementById('test-ocr-file-count');
    const runBtn = document.getElementById('test-ocr-run-btn');
    const clearBtn = document.getElementById('test-ocr-clear-btn');
    const homeBtn = document.getElementById('test-ocr-home-btn');
    const closeBtn = document.getElementById('modal-close-btn');

    if (homeBtn) {
        homeBtn.onclick = () => {
            window.location.href = '/';
        };
    }

    if (commentsInput) {
        commentsInput.oninput = () => {
            const lines = commentsInput.value.split('\n').map(l => l.trim()).filter(Boolean);
            commentCount.textContent = `${lines.length} comments`;
        };
    }

    if (dropzone && fileInput) {
        dropzone.onclick = () => fileInput.click();
        dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('border-blue-500'); };
        dropzone.ondragleave = () => dropzone.classList.remove('border-blue-500');
        dropzone.ondrop = (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-blue-500');
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                fileCount.textContent = `${fileInput.files.length} images`;
            }
        };
        fileInput.onchange = () => {
            fileCount.textContent = `${fileInput.files.length} images`;
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            if (commentsInput) commentsInput.value = '';
            if (fileInput) fileInput.value = '';
            if (commentCount) commentCount.textContent = '0 comments';
            if (fileCount) fileCount.textContent = '0 images';
            testOcrResults = [];
            document.getElementById('test-ocr-stats').classList.add('hidden');
            document.getElementById('test-ocr-results-container').innerHTML = '';
        };
    }

    if (runBtn) {
        runBtn.onclick = async () => {
            const lines = commentsInput.value.split('\n').map(l => l.trim()).filter(Boolean);
            const files = Array.from(fileInput.files || []);
            const taskType = document.getElementById('test-ocr-task-type').value;

            if (!files.length) {
                alert('Please upload at least one screenshot image.');
                return;
            }

            runBtn.disabled = true;
            runBtn.innerHTML = `<span>⏳ Running AI OCR Engine...</span>`;

            testOcrResults = [];
            const resultsContainer = document.getElementById('test-ocr-results-container');
            resultsContainer.innerHTML = '';
            document.getElementById('test-ocr-stats').classList.remove('hidden');

            let passCount = 0;
            let visionCount = 0;
            let failCount = 0;
            let totalSeconds = 0;

            const backendUrl = window.BACKEND_BASE_URL || 'https://rw-wallet.onrender.com';

            const candidatePool = lines.length > 0 ? lines.join('\n') : '';

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const startTime = performance.now();

                // Convert file to Base64
                const base64 = await fileToBase64(file);

                try {
                    const response = await fetch(`${backendUrl}/api/ocr/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          image: base64,
                          assignedComment: candidatePool || lines[i] || '',
                          taskType: taskType
                        })
                    });

                    const data = await response.json();
                    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
                    totalSeconds += parseFloat(elapsed);

                    const status = data.status || (data.isMatched ? 'PASS' : 'FAIL');
                    const score = data.score !== undefined ? data.score : (data.similarityScore ? Math.round(data.similarityScore * 100) : 0);

                    if (status === 'PASS') passCount++;
                    else if (status === 'VISION_AI_REQUIRED') visionCount++;
                    else failCount++;

                    const matchedCommentVal = data.matched_comment || data.matchedComment || data.target_segment || lines[i] || 'N/A';

                    const resultObj = {
                        index: i + 1,
                        filename: file.name,
                        base64: base64,
                        assignedComment: matchedCommentVal,
                        reviewerName: data.reviewer_name || data.extractedUserName || 'N/A',
                        reviewComment: data.review_comment || data.extractedText || 'N/A',
                        status: status,
                        score: score,
                        elapsed: elapsed,
                        rawLines: data.details?.extracted_lines || data.raw_lines || []
                    };

                    testOcrResults.push(resultObj);
                    appendTestResultCard(resultObj);

                } catch (err) {
                    console.error('OCR fetch error:', err);
                    failCount++;
                    const resultObj = {
                        index: i + 1,
                        filename: file.name,
                        base64: base64,
                        assignedComment: assignedComment,
                        reviewerName: 'ERROR',
                        reviewComment: err.message || 'Fetch error',
                        status: 'FAIL',
                        score: 0,
                        elapsed: '0.00',
                        rawLines: []
                    };
                    testOcrResults.push(resultObj);
                    appendTestResultCard(resultObj);
                }

                // Update live stats
                document.getElementById('stat-total').textContent = testOcrResults.length;
                document.getElementById('stat-pass').textContent = passCount;
                document.getElementById('stat-vision').textContent = visionCount;
                document.getElementById('stat-fail').textContent = failCount;
                document.getElementById('stat-speed').textContent = `${(totalSeconds / testOcrResults.length).toFixed(1)}s`;
            }

            runBtn.disabled = false;
            runBtn.innerHTML = `<span>🚀 Run Bulk AI OCR Test</span>`;
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            document.getElementById('test-ocr-modal').classList.add('hidden');
        };
    }
}

function appendTestResultCard(res) {
    const container = document.getElementById('test-ocr-results-container');
    if (!container) return;

    let badgeClass = 'bg-rose-500/20 border-rose-500/40 text-rose-400';
    if (res.status === 'PASS') badgeClass = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
    else if (res.status === 'VISION_AI_REQUIRED') badgeClass = 'bg-amber-500/20 border-amber-500/40 text-amber-400';

    const card = document.createElement('div');
    card.className = 'bg-gray-800/70 border border-gray-700/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md hover:border-blue-500/40 transition-all';
    card.innerHTML = `
        <div class="flex items-center gap-4 w-full sm:w-auto">
            <div class="w-16 h-16 rounded-xl bg-gray-900 border border-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                <img src="${res.base64}" alt="${res.filename}" class="w-full h-full object-cover">
            </div>
            <div class="space-y-1 min-w-0 flex-1">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-gray-300">#${res.index}</span>
                    <span class="text-xs font-mono text-gray-400 truncate max-w-[200px]">${res.filename}</span>
                </div>
                <p class="text-xs text-emerald-400 font-mono font-semibold truncate">👤 ${escapeHtml(res.reviewerName)}</p>
                <p class="text-xs text-gray-300 font-mono truncate max-w-[350px]">💬 Assigned: ${escapeHtml(res.assignedComment || 'None')}</p>
                <p class="text-xs text-blue-300 font-mono truncate max-w-[350px]">🔍 Extracted: ${escapeHtml(res.reviewComment || 'None')}</p>
            </div>
        </div>

        <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-700/50">
            <div class="text-right">
                <span class="text-xs px-2.5 py-1 rounded-lg border font-bold ${badgeClass}">
                    ${res.status}
                </span>
                <p class="text-xs font-extrabold text-white mt-1">${res.score}% match <span class="text-[10px] text-gray-400 font-normal">(${res.elapsed}s)</span></p>
            </div>
            <button class="inspect-btn bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-xs px-3 py-2 rounded-xl font-medium transition-all" data-index="${res.index - 1}">
                Inspect 👁️
            </button>
        </div>
    `;

    container.appendChild(card);

    card.querySelector('.inspect-btn').onclick = () => {
        openInspectionModal(res);
    };
}

function openInspectionModal(res) {
    const modal = document.getElementById('test-ocr-modal');
    if (!modal) return;

    let badgeClass = 'bg-rose-500/20 border-rose-500/40 text-rose-400';
    if (res.status === 'PASS') badgeClass = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
    else if (res.status === 'VISION_AI_REQUIRED') badgeClass = 'bg-amber-500/20 border-amber-500/40 text-amber-400';

    document.getElementById('modal-item-index').textContent = `#${res.index} - ${res.filename}`;
    document.getElementById('modal-image').src = res.base64;
    
    const badge = document.getElementById('modal-status-badge');
    badge.className = `px-2.5 py-1 rounded-lg text-xs font-bold border ${badgeClass}`;
    badge.textContent = res.status;

    document.getElementById('modal-score').textContent = `${res.score}%`;
    document.getElementById('modal-assigned-comment').textContent = res.assignedComment || '(No comment assigned)';
    document.getElementById('modal-reviewer-name').textContent = res.reviewerName || 'N/A';
    document.getElementById('modal-review-comment').textContent = res.reviewComment || 'N/A';

    const rawLinesContainer = document.getElementById('modal-raw-lines');
    if (res.rawLines && res.rawLines.length) {
        rawLinesContainer.innerHTML = res.rawLines.map((line, i) => `<div>${i + 1}. ${escapeHtml(line)}</div>`).join('');
    } else {
        rawLinesContainer.textContent = '(No raw lines extracted)';
    }

    modal.classList.remove('hidden');
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
