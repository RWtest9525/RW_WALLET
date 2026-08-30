// File: src/pages/admin/admin-train-ai.js

const showAdminTrainAiPage = async () => {
    if (!currentUser) return;
    
    // Check admin/owner authorization
    const isOwner = currentUser?.uid === ADMIN_UID ||
        currentUser?.email === 'reviewsworld51@gmail.com' ||
        currentUser?.email === 'reviewsworld01@gmail.com' ||
        currentUserData?.role === 'owner' ||
        currentUserData?.role === 'admin' ||
        (typeof checkIsUserAdmin === 'function' && checkIsUserAdmin(currentUser, currentUserData));

    if (!isOwner) {
        showNotification('Unauthorized! Admin access required.', true);
        return;
    }

    // Launch the conversational AI chat interface in Admin Training mode
    if (typeof openRevyBotChatPage === 'function') {
        openRevyBotChatPage(true);
    } else if (typeof window.openRevyBotChatPage === 'function') {
        window.openRevyBotChatPage(true);
    }
};

const showAiGlobalRulesModal = async () => {
    showLoading('Loading AI settings...');
    let currentInstructions = '';
    let currentApiKey = '';
    let currentProvider = 'auto';
    let currentModel = '';
    let lastUpdatedText = 'Never';

    try {
        const aiConfigRef = doc(db, `artifacts/${appId}/settings`, 'ai_config');
        const docSnap = await getDoc(aiConfigRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentInstructions = data.instructions || '';
            currentApiKey = data.apiKey || data.api_key || '';
            currentProvider = data.provider || 'auto';
            currentModel = data.model || '';
            if (data.updatedAt) {
                const date = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                lastUpdatedText = date.toLocaleString('en-IN');
            }
        }
    } catch (err) {
        console.error("Failed to load AI rules:", err);
    } finally {
        hideLoading();
    }

    const isKeySet = Boolean(currentApiKey && currentApiKey.trim().length > 8);

    renderModal('AI Rules & API Connection',
        `<div class="space-y-4 text-sm max-h-[75vh] overflow-y-auto pr-1">
            <!-- Status & Instructions Banner -->
            <div class="rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-200/80 dark:border-orange-800/80 p-3.5 text-xs text-orange-900 dark:text-orange-200">
                <div class="flex items-center justify-between">
                    <p class="font-bold flex items-center gap-1.5">
                        <span class="inline-block w-2 h-2 rounded-full ${isKeySet ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                        AI Engine Status: <span class="${isKeySet ? 'text-emerald-700 dark:text-emerald-300 font-black' : 'text-amber-700 dark:text-amber-300 font-bold'}">${isKeySet ? 'Connected' : 'Using Fallback Engine'}</span>
                    </p>
                    <span class="text-[10px] opacity-75 font-mono">Updated: ${escapeHtml(lastUpdatedText)}</span>
                </div>
                <p class="mt-1 opacity-90 leading-relaxed">
                    Connect your free Google Gemini API Key or Groq/OpenAI key to power REVY with high-speed intelligence across all user support chats.
                </p>
            </div>

            <!-- API Configuration Box -->
            <div class="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label class="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">AI API Key & Provider</label>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                        <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Provider</label>
                        <select id="ai-provider-select" class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white">
                            <option value="auto" ${currentProvider === 'auto' ? 'selected' : ''}>Auto Detect (Recommended)</option>
                            <option value="gemini" ${currentProvider === 'gemini' ? 'selected' : ''}>Google Gemini (Free & Fast)</option>
                            <option value="groq" ${currentProvider === 'groq' ? 'selected' : ''}>Groq (Superfast Llama 3.3)</option>
                            <option value="openai" ${currentProvider === 'openai' ? 'selected' : ''}>OpenAI (GPT-4o-mini)</option>
                            <option value="openrouter" ${currentProvider === 'openrouter' ? 'selected' : ''}>OpenRouter (Multi-Model)</option>
                            <option value="nvidia" ${currentProvider === 'nvidia' ? 'selected' : ''}>Nvidia NIM</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Model Name (Optional)</label>
                        <input id="ai-model-input" type="text" placeholder="e.g. gemini-1.5-flash / llama-3.3-70b-versatile" value="${escapeHtml(currentModel)}" class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white" />
                    </div>
                </div>

                <div>
                    <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">API Key</label>
                    <div class="relative flex items-center">
                        <input id="ai-api-key-input" type="password" placeholder="Paste your API Key (e.g. AIzaSy... or gsk_... or sk-...)" value="${escapeHtml(currentApiKey)}" class="w-full pl-3 pr-20 py-2 bg-white dark:bg-gray-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white" />
                        <button type="button" id="toggle-api-key-vis" class="absolute right-2 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold">Show</button>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-1">Get a free Google Gemini key from <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-orange-600 dark:text-orange-400 underline font-semibold">Google AI Studio</a> or Groq key from <a href="https://console.groq.com/keys" target="_blank" class="text-orange-600 dark:text-orange-400 underline font-semibold">Groq Console</a>.</p>
                </div>

                <div class="pt-1 flex items-center justify-between gap-2">
                    <button type="button" id="test-ai-key-btn" class="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1">
                        ⚡ Test AI Connection
                    </button>
                    <span id="ai-test-status" class="text-xs font-medium text-gray-500"></span>
                </div>
            </div>

            <!-- Global System Prompt Rules Box -->
            <div class="space-y-1.5">
                <label class="block text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">Global System Prompt Rules & Guidelines</label>
                <textarea id="ai-training-textarea" rows="6" placeholder="Write rules, logic details, withdrawal timelines, and guidelines (Markdown supported)..." class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white">${escapeHtml(currentInstructions)}</textarea>
            </div>
        </div>`,
        `<div class="flex justify-end gap-2">
            <button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg font-bold">Cancel</button>
            <button id="save-ai-rules-modal-btn" class="px-5 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-black shadow">Save AI Settings</button>
        </div>`,
        'max-w-xl');

    // Toggle API Key visibility
    document.getElementById('toggle-api-key-vis')?.addEventListener('click', () => {
        const input = document.getElementById('ai-api-key-input');
        const btn = document.getElementById('toggle-api-key-vis');
        if (input && btn) {
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'Hide';
            } else {
                input.type = 'password';
                btn.textContent = 'Show';
            }
        }
    });

    // Test AI Key Connection
    document.getElementById('test-ai-key-btn')?.addEventListener('click', async () => {
        const apiKeyInput = document.getElementById('ai-api-key-input');
        const providerSelect = document.getElementById('ai-provider-select');
        const modelInput = document.getElementById('ai-model-input');
        const statusSpan = document.getElementById('ai-test-status');
        const testBtn = document.getElementById('test-ai-key-btn');

        const key = apiKeyInput ? apiKeyInput.value.trim() : '';
        const provider = providerSelect ? providerSelect.value : 'auto';
        const model = modelInput ? modelInput.value.trim() : '';

        if (statusSpan) {
            statusSpan.className = 'text-xs text-orange-600 animate-pulse font-medium';
            statusSpan.textContent = 'Testing connection...';
        }
        if (testBtn) testBtn.disabled = true;

        try {
            let testReply = '';
            // Direct Gemini Client test if starts with AIzaSy or Gemini selected
            if (key.startsWith('AIzaSy') || provider === 'gemini') {
                const targetModel = model || 'gemini-1.5-flash';
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(key)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'Hello REVY! Reply with exact words: "Connected successfully to Gemini"' }] }]
                    })
                });
                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(`Gemini API HTTP ${res.status}: ${err.slice(0, 100)}`);
                }
                const data = await res.json();
                testReply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'OK';
            } else if (key.startsWith('gsk_') || provider === 'groq') {
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                    body: JSON.stringify({
                        model: model || 'llama-3.3-70b-versatile',
                        messages: [{ role: 'user', content: 'Reply with exact words: "Connected successfully to Groq"' }],
                        max_tokens: 30
                    })
                });
                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(`Groq API HTTP ${res.status}: ${err.slice(0, 100)}`);
                }
                const data = await res.json();
                testReply = data.choices?.[0]?.message?.content || 'OK';
            } else {
                // Test via backend endpoint
                const token = await getBackendAuthToken();
                const res = await fetch(`${BACKEND_BASE_URL}/api/revy-bot`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question: 'Hello REVY, status check', history: [] })
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || 'Connection failed');
                testReply = data.answer || 'OK';
            }

            if (statusSpan) {
                statusSpan.className = 'text-xs text-emerald-600 font-bold';
                statusSpan.textContent = `✓ Success! (${testReply.slice(0, 45)}...)`;
            }
        } catch (testErr) {
            console.error('AI Test failed:', testErr);
            if (statusSpan) {
                statusSpan.className = 'text-xs text-red-500 font-medium';
                statusSpan.textContent = `✗ Failed: ${testErr.message.slice(0, 60)}`;
            }
        } finally {
            if (testBtn) testBtn.disabled = false;
        }
    });

    document.getElementById('save-ai-rules-modal-btn')?.addEventListener('click', async () => {
        const textarea = document.getElementById('ai-training-textarea');
        const apiKeyInput = document.getElementById('ai-api-key-input');
        const providerSelect = document.getElementById('ai-provider-select');
        const modelInput = document.getElementById('ai-model-input');
        
        const instructions = textarea ? textarea.value.trim() : '';
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        const provider = providerSelect ? providerSelect.value : 'auto';
        const model = modelInput ? modelInput.value.trim() : '';

        const saveBtn = document.getElementById('save-ai-rules-modal-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }
        try {
            const docRef = doc(db, `artifacts/${appId}/settings`, 'ai_config');
            await setDoc(docRef, {
                instructions: instructions,
                apiKey: apiKey,
                provider: provider,
                model: model,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.email || currentUser.uid
            }, { merge: true });
            window.closeModal();
            showNotification('AI Settings & API Key saved successfully! AI will apply new settings immediately.');
        } catch (err) {
            console.error("Failed to save AI config:", err);
            showNotification('Failed to save settings: ' + err.message, true);
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save AI Settings';
            }
        }
    });
};

const showAiMemoriesModal = async () => {
    showLoading('Loading AI memories...');
    let memories = [];

    try {
        const memoryRef = doc(db, `artifacts/${appId}/public/data/bot_memory`, 'global');
        const memorySnap = await getDoc(memoryRef);
        if (memorySnap.exists()) {
            memories = memorySnap.data().memories || [];
        }
    } catch (err) {
        console.error("Failed to load AI memories:", err);
    } finally {
        hideLoading();
    }

    const memoriesListHtml = memories.length ? memories.map((m, idx) => `
        <div class="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200/60 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200">
            <span class="flex-1 pr-2"><strong class="text-orange-600 mr-1">${idx + 1}.</strong> ${escapeHtml(m)}</span>
            <button onclick="window.handleDeleteAiMemory(${idx})" class="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition" title="Delete memory">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
        </div>
    `).join('') : `<div class="text-xs text-gray-400 italic py-4 text-center">No dynamic chat memories saved yet. You can teach REVY directly in chat by typing "remember that..."!</div>`;

    renderModal(`Dynamic Learned Memories (${memories.length})`,
        `<div class="space-y-3 text-sm">
            <p class="text-xs text-gray-500">Memories learned dynamically when admin instructs the AI in chat:</p>
            <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                ${memoriesListHtml}
            </div>
        </div>`,
        `<div class="flex justify-between items-center w-full gap-2">
            ${memories.length ? `<button onclick="window.handleClearAllAiMemories()" class="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg font-bold">Clear All Memories</button>` : '<div></div>'}
            <button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg font-bold">Close</button>
        </div>`,
        'max-w-md');
};

const handleDeleteAiMemory = async (index) => {
    try {
        showLoading('Removing memory...');
        const memoryRef = doc(db, `artifacts/${appId}/public/data/bot_memory`, 'global');
        const memorySnap = await getDoc(memoryRef);
        if (memorySnap.exists()) {
            let memories = memorySnap.data().memories || [];
            memories.splice(index, 1);
            await setDoc(memoryRef, { memories, updatedAt: serverTimestamp() }, { merge: true });
            showNotification('Memory removed successfully.');
        }
    } catch (err) {
        console.error("Failed to delete memory:", err);
        showNotification('Error deleting memory: ' + err.message, true);
    } finally {
        hideLoading();
        showAiMemoriesModal();
    }
};

const handleClearAllAiMemories = async () => {
    if (!confirm('Are you sure you want to clear all learned dynamic memories?')) return;
    try {
        showLoading('Clearing memories...');
        const memoryRef = doc(db, `artifacts/${appId}/public/data/bot_memory`, 'global');
        await setDoc(memoryRef, { memories: [], updatedAt: serverTimestamp() }, { merge: true });
        showNotification('All dynamic memories cleared.');
    } catch (err) {
        console.error("Failed to clear memories:", err);
        showNotification('Error clearing memories: ' + err.message, true);
    } finally {
        hideLoading();
        showAiMemoriesModal();
    }
};

// Expose to window
window.showAdminTrainAiPage = showAdminTrainAiPage;
window.showAiGlobalRulesModal = showAiGlobalRulesModal;
window.showAiMemoriesModal = showAiMemoriesModal;
window.handleDeleteAiMemory = handleDeleteAiMemory;
window.handleClearAllAiMemories = handleClearAllAiMemories;
