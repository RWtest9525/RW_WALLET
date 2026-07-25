// File: src/pages/giftcard.js

const handleRedeem = async () => {
            const code = document.getElementById('gift-code-input').value.trim().toUpperCase();
            if (!code) return;
            let redeemedAmount = 0;
            try {
                const q = query(collection(db, `artifacts/${appId}/public/data/gift_codes`), where("code", "==", code));
                const snap = await getDocs(q);
                if (snap.empty) throw new Error("Invalid code.");
                const giftCodeRef = snap.docs[0].ref;
                await runTransaction(db, async (tx) => {
                    const giftCodeDoc = await tx.get(giftCodeRef);
                    if (!giftCodeDoc.exists()) throw new Error("Gift code not found.");
                    const giftCodeData = giftCodeDoc.data();
                    if ((giftCodeData.redeemedBy || []).includes(currentUser.uid)) throw new Error("You have already redeemed this code.");
                    if ((giftCodeData.timesUsed || 0) >= (giftCodeData.usageLimit || 1)) throw new Error("This gift code has reached its usage limit.");

                    const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                    const userDoc = await tx.get(userRef);
                    if (!userDoc.exists()) throw new Error("Current user not found.");

                    const amount = giftCodeData.amount;
                    redeemedAmount = amount;

                    const currentBalance = userDoc.data().balance || 0;
                    const balanceAfter = currentBalance + amount;
                    tx.update(userRef, { balance: balanceAfter });
                    tx.update(giftCodeRef, { timesUsed: (giftCodeData.timesUsed || 0) + 1, redeemedBy: arrayUnion(currentUser.uid) });
                    tx.set(doc(collection(userRef, 'transactions')), {
                        type: 'gift_card',
                        amount,
                        comment: `Redeemed code ${code}`,
                        timestamp: serverTimestamp(),
                        transactionId: code,
                        giftCode: code,
                        senderName: 'Reviews World',
                        recipientName: currentUserData.name || 'User',
                        recipientMobile: currentUserData.mobile || '',
                        recipientIsProProfile: !!currentUserData.isProProfile,
                        balanceBefore: currentBalance,
                        balanceAfter,
                        status: 'completed'
                    });
                });
                syncRecentTransactionsToCloud(currentUser.uid).catch(error => console.warn('Redeem background transaction sync failed:', error));
                showNotification(`Success! Added ${formatCurrency(redeemedAmount)} to your wallet.`, false, true);
                if (typeof window.notifyWalletBalanceChange === 'function') {
                    window.notifyWalletBalanceChange(currentUser.uid, 'credit', redeemedAmount, `Redeemed gift code: ${code}`);
                }
                window.closeModal();
            } catch (e) {
                console.error("Redeem failed:", e);
                if (e.message.includes("permission-denied") || e.message.includes("insufficient permissions")) {
                    showNotification('Redeem failed. Please contact support.', true);
                } else {
                    showNotification(`Redeem failed: ${e.message}`, true);
                }
            }
        };

const showCreateGiftCodeModal = () => {
            renderModal('Create Gift Code',
                `<div class="space-y-3">
                    <input type="text" id="new-code-input" placeholder="Code (e.g., DIWALI500)" class="w-full uppercase px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <input type="number" id="new-code-amount" placeholder="Amount (₹)" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <input type="number" id="new-code-limit" placeholder="Usage Limit (e.g., 10)" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg" value="1">
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="modal-submit-btn" class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg">Create</button>`);
            document.getElementById('modal-submit-btn').onclick = handleCreateGiftCode;
        };

const handleCreateGiftCode = async () => {
            const code = document.getElementById('new-code-input').value.trim().toUpperCase();
            const amount = parseFloat(document.getElementById('new-code-amount').value);
            const limit = parseInt(document.getElementById('new-code-limit').value);
            if (!code || isNaN(amount) || amount <= 0 || isNaN(limit) || limit <= 0) {
                return showNotification('Invalid code, amount, or usage limit.', true);
            }

            const totalCost = amount * limit;
            const isOwner = checkIsOwner(currentUser, currentUserData);

            if (!isOwner) {
                const availableBalance = getUserAvailableBalance(currentUserData || currentUser);
                if (availableBalance < totalCost) {
                    return showNotification(`Insufficient balance in your sub-admin wallet. Required: ₹${totalCost}, Available: ₹${availableBalance}`, true);
                }
            }

            try {
                if (!isOwner && currentUser?.uid) {
                    const adminRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                    await updateDoc(adminRef, {
                        balance: increment(-totalCost)
                    });
                    if (currentUserData) {
                        currentUserData.balance = (currentUserData.balance || 0) - totalCost;
                    }
                }

                await addDoc(collection(db, `artifacts/${appId}/public/data/gift_codes`), {
                    code,
                    amount,
                    usageLimit: limit,
                    timesUsed: 0,
                    redeemedBy: [],
                    createdBy: currentUser?.uid || '',
                    createdAt: serverTimestamp()
                });

                showNotification(`Code ${code} created. ${!isOwner ? `₹${totalCost} deducted from your wallet.` : ''}`);
                window.closeModal();
            } catch (e) {
                console.error("Create gift code failed:", e);
                showNotification(`Failed to create gift code: ${e.message}`, true);
            }
        };

const generateUniqueGiftCodeValue = (existingCodes) => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';

            do {
                code = 'RW';
                for (let i = 0; i < 8; i++) {
                    code += chars[Math.floor(Math.random() * chars.length)];
                }
            } while (existingCodes.has(code));

            existingCodes.add(code);
            return code;
        };

const handleGenerateGiftCodes = async () => {
            const count = parseInt(document.getElementById('bulk-gift-code-count').value);
            const amount = parseFloat(document.getElementById('bulk-gift-code-amount').value);

            if (isNaN(count) || count <= 0 || count > 200 || isNaN(amount) || amount <= 0) {
                return showNotification('Enter valid count (1-200) and amount.', true);
            }

            const totalCost = count * amount;
            const isOwner = checkIsOwner(currentUser, currentUserData);

            if (!isOwner) {
                const availableBalance = getUserAvailableBalance(currentUserData || currentUser);
                if (availableBalance < totalCost) {
                    return showNotification(`Insufficient balance in your sub-admin wallet. Required: ₹${totalCost}, Available: ₹${availableBalance}`, true);
                }
            }

            try {
                if (!isOwner && currentUser?.uid) {
                    const adminRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                    await updateDoc(adminRef, {
                        balance: increment(-totalCost)
                    });
                    if (currentUserData) {
                        currentUserData.balance = (currentUserData.balance || 0) - totalCost;
                    }
                }

                const codesRef = collection(db, `artifacts/${appId}/public/data/gift_codes`);
                const snap = await getDocs(codesRef);
                const existingCodes = new Set(snap.docs.map(d => (d.data().code || '').toUpperCase()));
                const batch = writeBatch(db);

                for (let i = 0; i < count; i++) {
                    const code = generateUniqueGiftCodeValue(existingCodes);
                    batch.set(doc(codesRef), {
                        code,
                        amount,
                        usageLimit: 1,
                        timesUsed: 0,
                        redeemedBy: [],
                        createdBy: currentUser?.uid || '',
                        createdAt: serverTimestamp()
                    });
                }

                await batch.commit();
                document.getElementById('bulk-gift-code-count').value = '';
                document.getElementById('bulk-gift-code-amount').value = '';
                const freshSnap = await getDocs(codesRef);
                allGiftCodesCache = freshSnap.docs;
                renderAdminGiftCodesList(freshSnap.docs);
                showNotification(`${count} gift code(s) generated. ${!isOwner ? `₹${totalCost} deducted from your wallet.` : ''}`);
            } catch (e) {
                console.error('Bulk gift code generation failed:', e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

const handleCopyActiveGiftCodes = async (button) => {
            try {
                let docs = allGiftCodesCache;
                if (!docs.length) {
                    const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/gift_codes`));
                    docs = snap.docs;
                    allGiftCodesCache = docs;
                }

                const activeCodes = docs
                    .map(d => d.data())
                    .filter(c => (c.timesUsed || 0) < (c.usageLimit || 1))
                    .map(c => c.code)
                    .filter(Boolean);

                if (!activeCodes.length) return showNotification('No active gift codes to copy.', true);
                await handleCopyText(activeCodes.join('\n'), button);
                showNotification('Active gift codes copied line by line.');
            } catch (e) {
                console.error('Copy active gift codes failed:', e);
                showNotification(`Error: ${e.message}`, true);
            }
        };

const handleDeleteGiftCode = (docId) => {
            renderModal('Delete Code',
                '<p>Are you sure? This cannot be undone.</p>',
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-action-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Delete</button>`,
                'max-w-sm'
            );
            document.getElementById('confirm-action-btn').onclick = async () => {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/gift_codes`, docId));
                showNotification('Gift code deleted.');
                window.closeModal();
            };
        };

// Expose functions to window for global access
window.handleRedeem = handleRedeem;
window.showCreateGiftCodeModal = showCreateGiftCodeModal;
window.handleCreateGiftCode = handleCreateGiftCode;
window.generateUniqueGiftCodeValue = generateUniqueGiftCodeValue;
window.handleGenerateGiftCodes = handleGenerateGiftCodes;
window.handleCopyActiveGiftCodes = handleCopyActiveGiftCodes;
window.handleDeleteGiftCode = handleDeleteGiftCode;
