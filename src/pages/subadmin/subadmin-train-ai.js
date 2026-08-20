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

    showLoading();
    let currentInstructions = '';
    let lastUpdatedText = 'Never';
    let memories = [];

    try {
        const aiConfigRef = doc(db, `artifacts/${appId}/settings`, 'ai_config');
        const memoryRef = doc(db, `artifacts/${appId}/public/data/bot_memory`, 'global');
        
        const [docSnap, memorySnap] = await Promise.allSettled([
            getDoc(aiConfigRef),
            getDoc(memoryRef)
        ]);

        if (docSnap.status === 'fulfilled' && docSnap.value.exists()) {
            const data = docSnap.value.data();
            currentInstructions = data.instructions || '';
            if (data.updatedAt) {
                const date = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                lastUpdatedText = date.toLocaleString('en-IN');
            }
        }

        if (memorySnap.status === 'fulfilled' && memorySnap.value.exists()) {
            memories = memorySnap.value.data().memories || [];
        }
    } catch (err) {
        console.error("Failed to load AI config:", err);
    } finally {
        hideLoading();
    }

    const memoriesListHtml = memories.length ? memories.map((m, idx) => `
        <div class="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/60 rounded-xl border border-gray-200/50 dark:border-gray-600/50 text-xs text-gray-700 dark:text-gray-200">
            <span class="flex-1 pr-2"><strong class="text-orange-600 mr-1">${idx + 1}.</strong> ${escapeHtml(m)}</span>
            <button onclick="window.handleDeleteAiMemory(${idx})" class="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition" title="Delete memory">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
        </div>
    `).join('') : `<div class="text-xs text-gray-400 italic py-2">No dynamic chat memories saved yet. You can train REVY directly in chat or add rules below!</div>`;

    const content = `
        ${getPageHeader('Train AI')}
        <div class="max-w-3xl mx-auto space-y-6 pb-24 px-4">
            <!-- Info Panel -->
            <div class="bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                <div class="relative z-10 space-y-2">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                        <h3 class="text-lg font-black uppercase tracking-wider">AI Knowledge Base & Training</h3>
                        <button onclick="window.openRevyBotChatPage && window.openRevyBotChatPage(true)" class="px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl text-xs font-bold transition flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            Open AI Chat Training
                        </button>
                    </div>
                    <p class="text-sm opacity-90 leading-relaxed">
                        Add system guidelines, business logic details, and operational rules here. 
                        The AI support bot REVY will strictly enforce these rules and remember what you teach it.
                    </p>
                    <div class="pt-2 text-[11px] font-bold opacity-75">Last updated: ${escapeHtml(lastUpdatedText)}</div>
                </div>
                <div class="absolute -right-6 -bottom-6 h-28 w-28 rounded-full border border-white/10 bg-white/5 z-0"></div>
            </div>

            <!-- Stored Dynamic Memories -->
            <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700 space-y-3">
                <div class="flex items-center justify-between">
                    <label class="block text-xs font-black text-gray-400 uppercase tracking-wider">Dynamic Learned Memories (${memories.length})</label>
                    ${memories.length ? `<button onclick="window.handleClearAllAiMemories()" class="text-xs text-red-500 hover:underline font-semibold">Clear All Memories</button>` : ''}
                </div>
                <div class="space-y-2 max-h-56 overflow-y-auto">
                    ${memoriesListHtml}
                </div>
            </div>

            <!-- Training Form -->
            <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700 space-y-4">
                <div class="space-y-2">
                    <label class="block text-xs font-black text-gray-400 uppercase tracking-wider">Global AI System Rules & Guidelines</label>
                    <textarea id="ai-training-textarea" rows="10" placeholder="Write rules, logic details, withdrawal timelines, and guidelines (Markdown supported)..." class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white">${escapeHtml(currentInstructions)}</textarea>
                </div>
                <div class="flex justify-end gap-3 pt-2">
                    <button onclick="window.showAdminMainPage()" class="px-5 py-2.5 bg-gray-150 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs transition">Cancel</button>
                    <button id="save-ai-training-btn" class="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl text-xs transition shadow-md hover:scale-102 active:scale-98">
                        Save Rules
                    </button>
                </div>
            </div>
        </div>
        ${getPageFooter()}
    `;

    showPage(content, {
        returnTo: 'admin',
        onBack: () => {
            if (typeof window.showAdminMainPage === 'function') {
                window.showAdminMainPage();
            } else if (typeof hidePage === 'function') {
                hidePage();
            }
        }
    });
    setBottomNavActive('bottom-admin-btn');

    document.getElementById('save-ai-training-btn').addEventListener('click', handleSaveAiTraining);
};

const handleSaveAiTraining = async () => {
    const textarea = document.getElementById('ai-training-textarea');
    if (!textarea) return;

    const instructions = textarea.value.trim();
    const saveBtn = document.getElementById('save-ai-training-btn');
    
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }

    try {
        const docRef = doc(db, `artifacts/${appId}/settings`, 'ai_config');
        await setDoc(docRef, {
            instructions: instructions,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.email || currentUser.uid
        }, { merge: true });

        showNotification('AI Instructions saved successfully! AI will reload this knowledge in real time.');
        showAdminTrainAiPage();
    } catch (err) {
        console.error("Failed to save AI config:", err);
        showNotification('Failed to save instructions: ' + err.message, true);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Rules';
        }
    }
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
        showAdminTrainAiPage();
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
        showAdminTrainAiPage();
    }
};

// Expose to window
window.showAdminTrainAiPage = showAdminTrainAiPage;
window.handleSaveAiTraining = handleSaveAiTraining;
window.handleDeleteAiMemory = handleDeleteAiMemory;
window.handleClearAllAiMemories = handleClearAllAiMemories;
