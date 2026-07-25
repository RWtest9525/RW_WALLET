// File: src/pages/admin/admin-train-ai.js

const showAdminTrainAiPage = async () => {
    if (!currentUser) return;
    
    // Double check owner authorization (must be owner only)
    const isOwner = currentUser?.uid === ADMIN_UID || currentUser?.email === 'reviewsworld51@gmail.com' || currentUser?.email === 'reviewsworld01@gmail.com' || currentUserData?.role === 'owner';
    if (!isOwner) {
        showNotification('Unauthorized! Only the main owner can train the AI.', true);
        return;
    }

    showLoading();
    let currentInstructions = '';
    let lastUpdatedText = 'Never';

    try {
        const docRef = doc(db, `artifacts/${appId}/settings`, 'ai_config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentInstructions = data.instructions || '';
            if (data.updatedAt) {
                const date = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                lastUpdatedText = date.toLocaleString('en-IN');
            }
        }
    } catch (err) {
        console.error("Failed to load AI config:", err);
    } finally {
        hideLoading();
    }

    const content = `
        ${getPageHeader('Train AI')}
        <div class="max-w-3xl mx-auto space-y-6 pb-24 px-4">
            <!-- Info Panel -->
            <div class="bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                <div class="relative z-10 space-y-2">
                    <h3 class="text-lg font-black uppercase tracking-wider">AI Knowledge Base</h3>
                    <p class="text-sm opacity-90 leading-relaxed">
                        Add guidelines, system rules, configurations, or custom notes for the AI coding assistant here. 
                        The AI will reference these instructions in future pairs or sessions to maintain the correct implementation logic.
                    </p>
                    <div class="pt-2 text-[11px] font-bold opacity-75">Last trained: ${escapeHtml(lastUpdatedText)}</div>
                </div>
                <div class="absolute -right-6 -bottom-6 h-28 w-28 rounded-full border border-white/10 bg-white/5 z-0"></div>
            </div>

            <!-- Training Form -->
            <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700 space-y-4">
                <div class="space-y-2">
                    <label class="block text-xs font-black text-gray-400 uppercase tracking-wider">AI Instructions & Training Data</label>
                    <textarea id="ai-training-textarea" rows="12" placeholder="Write rules, logic details, and guidelines (Markdown supported)..." class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white">${escapeHtml(currentInstructions)}</textarea>
                </div>
                <div class="flex justify-end gap-3 pt-2">
                    <button onclick="window.showAdminMainPage()" class="px-5 py-2.5 bg-gray-150 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs transition">Cancel</button>
                    <button id="save-ai-training-btn" class="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl text-xs transition shadow-md hover:scale-102 active:scale-98">
                        Save & Train AI
                    </button>
                </div>
            </div>
        </div>
        ${getPageFooter()}
    `;

    showPage(content, { returnTo: 'admin' });
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

        showNotification('AI Instructions saved successfully! AI will reload this knowledge next time.');
        showAdminTrainAiPage();
    } catch (err) {
        console.error("Failed to save AI config:", err);
        showNotification('Failed to save instructions: ' + err.message, true);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save & Train AI';
        }
    }
};

// Expose to window
window.showAdminTrainAiPage = showAdminTrainAiPage;
window.handleSaveAiTraining = handleSaveAiTraining;
