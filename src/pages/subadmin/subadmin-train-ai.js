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
    showLoading('Loading AI rules...');
    let currentInstructions = '';
    let lastUpdatedText = 'Never';

    try {
        const aiConfigRef = doc(db, `artifacts/${appId}/settings`, 'ai_config');
        const docSnap = await getDoc(aiConfigRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentInstructions = data.instructions || '';
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

    renderModal('AI System Rules & Guidelines',
        `<div class="space-y-3 text-sm">
            <div class="rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-3 text-xs text-orange-800 dark:text-orange-200">
                <p class="font-bold">Global System Prompt Rules</p>
                <p class="mt-0.5 opacity-90">Rules and instructions written here are enforced globally across all customer AI chats in real time.</p>
                <p class="mt-1 font-mono text-[10px] opacity-75">Last updated: ${escapeHtml(lastUpdatedText)}</p>
            </div>
            <div>
                <textarea id="ai-training-textarea" rows="8" placeholder="Write rules, logic details, withdrawal timelines, and guidelines (Markdown supported)..." class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white">${escapeHtml(currentInstructions)}</textarea>
            </div>
        </div>`,
        `<div class="flex justify-end gap-2">
            <button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg font-bold">Cancel</button>
            <button id="save-ai-rules-modal-btn" class="px-5 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-black shadow">Save Rules</button>
        </div>`,
        'max-w-lg');

    document.getElementById('save-ai-rules-modal-btn')?.addEventListener('click', async () => {
        const textarea = document.getElementById('ai-training-textarea');
        if (!textarea) return;
        const instructions = textarea.value.trim();
        const saveBtn = document.getElementById('save-ai-rules-modal-btn');
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
            window.closeModal();
            showNotification('AI Instructions saved successfully! AI will apply new rules immediately.');
        } catch (err) {
            console.error("Failed to save AI config:", err);
            showNotification('Failed to save instructions: ' + err.message, true);
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Rules';
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
