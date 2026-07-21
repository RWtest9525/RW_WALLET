// File: src/pages/recharge.js

const getInsufficientRechargeMessage = (user = currentUserData || {}, requiredAmount = 0) => {
            const balance = Number(user.balance || 0);
            const reservedAmount = getLoanReservedAmount(user);
            if (reservedAmount > 0 && balance >= Number(requiredAmount || 0)) {
                return `Insufficient available balance. ${formatCurrency(reservedAmount)} is reserved for loan repayment.`;
            }
            return 'Insufficient wallet balance for mobile recharge.';
        };

const showMobileRechargePage = () => {
            if (!currentUserData) return showNotification('User data not loaded. Please wait.', true);
            if (currentUserData.isFlagged) {
                return showNotification('Your account is flagged. Please contact support.', true);
            }

            const operatorOptions = RECHARGE_OPERATORS.map(op => `<option value="${op}">${op}</option>`).join('');
            const stateOptions = RECHARGE_STATES.map(state => `<option value="${state}">${state}</option>`).join('');
            const content = `
                ${getPageHeader('Mobile Recharge')}
                <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-5">
                    <div class="text-center">
                        <div class="mx-auto w-14 h-14 rounded-2xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center mb-3 p-2">
                            <img src="https://cdn-icons-png.flaticon.com/512/4108/4108841.png" alt="Mobile recharge" class="w-full h-full object-contain">
                        </div>
                        <h3 class="text-lg font-semibold">Place Recharge Request</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Fill the plan details. Admin will complete it manually.</p>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Mobile Number</label>
                            <input type="tel" id="recharge-mobile-input" maxlength="10" placeholder="Enter 10 digit mobile number" value="${currentUserData.mobile || ''}" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Operator</label>
                                <select id="recharge-operator-select" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
                                    <option value="">Select operator</option>
                                    ${operatorOptions}
                                </select>
                            </div>
                            <div>
                                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">State / Circle</label>
                                <select id="recharge-state-select" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
                                    <option value="">Select state</option>
                                    ${stateOptions}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Recharge Amount</label>
                            <input type="number" id="recharge-amount-input" min="1" placeholder="Enter plan amount (₹)" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Validity / Plan Details</label>
                            <textarea id="recharge-details-input" rows="3" placeholder="Example: 28 days, 1.5GB/day, unlimited calls" class="w-full mt-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"></textarea>
                        </div>
                    </div>

                    <div id="recharge-summary" class="space-y-2 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 rounded-xl p-4"></div>
                    <button id="submit-recharge-btn" class="w-full bg-sky-600 text-white font-semibold py-3 rounded-lg hover:bg-sky-700 transition">Continue to Checkout</button>
                </div>
                ${getPageFooter()}`;

            showPage(content);
            updateRechargeSummary();
            document.getElementById('recharge-amount-input').addEventListener('input', updateRechargeSummary);
            document.getElementById('submit-recharge-btn').onclick = handleRechargeCheckout;
        };

const handleRechargeCheckout = () => {
            const mobileNumber = document.getElementById('recharge-mobile-input').value.trim();
            const operator = document.getElementById('recharge-operator-select').value;
            const state = document.getElementById('recharge-state-select').value;
            const planDetails = document.getElementById('recharge-details-input').value.trim();
            const { amount, discount, chargeAmount } = getRechargeSummary();

            if (!/^\d{10}$/.test(mobileNumber)) return showNotification('Please enter a valid 10 digit mobile number.', true);
            if (!operator) return showNotification('Please select operator.', true);
            if (!state) return showNotification('Please select state.', true);
            if (amount <= 0) return showNotification('Please enter a valid recharge amount.', true);
            if (!planDetails) return showNotification('Please enter validity or plan details.', true);
            if (getSpendableWalletBalance(currentUserData) < chargeAmount) return showNotification(getInsufficientRechargeMessage(currentUserData, chargeAmount), true);

            renderModal('Confirm Mobile Recharge',
                `<div class="space-y-4">
                    <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg space-y-2 text-sm">
                        <div class="flex justify-between gap-3"><span class="text-gray-500 dark:text-gray-400">Mobile</span><span class="font-semibold">${mobileNumber}</span></div>
                        <div class="flex justify-between gap-3"><span class="text-gray-500 dark:text-gray-400">Operator</span><span class="font-semibold">${operator}</span></div>
                        <div class="flex justify-between gap-3"><span class="text-gray-500 dark:text-gray-400">State</span><span class="font-semibold text-right">${state}</span></div>
                        <div class="flex justify-between gap-3"><span class="text-gray-500 dark:text-gray-400">Plan</span><span class="font-semibold text-right">${planDetails}</span></div>
                        <div class="pt-2 mt-2 border-t border-gray-300 dark:border-gray-600 space-y-2">
                            <div class="flex justify-between"><span>Recharge Amount</span><span>${formatCurrency(amount)}</span></div>
                            <div class="flex justify-between text-green-600"><span>1% Discount</span><span>-${formatCurrency(discount)}</span></div>
                            <div class="flex justify-between font-bold"><span>Wallet Deduction</span><span>${formatCurrency(chargeAmount)}</span></div>
                        </div>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 text-center">Recharge will stay pending until admin completes it and enters transaction ID.</p>
                </div>`,
                `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                 <button id="confirm-recharge-btn" class="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg">Place Request</button>`,
                'max-w-md', true
            );

            document.getElementById('confirm-recharge-btn').onclick = () => {
                handleSubmitRechargeRequest({ mobileNumber, operator, state, planDetails, amount, discount, chargeAmount });
            };
        };

const handleSubmitRechargeRequest = async ({ mobileNumber, operator, state, planDetails, amount, discount, chargeAmount }) => {
            if (!currentUser) return showNotification('Error: You are not logged in.', true);
            if (!currentUserData) return showNotification('Your user data is still loading. Please try again.', true);

            try {
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                const reqRef = doc(collection(db, `artifacts/${appId}/public/data/fund_requests`));
                const requestedAt = Date.now();
                const requestPayload = {
                    id: reqRef.id,
                    userId: currentUser.uid,
                    userName: currentUserData.name || 'N/A',
                    userMobile: currentUserData.mobile || 'N/A',
                    userEmail: currentUserData.email || 'N/A',
                    type: 'mobile_recharge',
                    mobileNumber,
                    operator,
                    state,
                    planDetails,
                    amount,
                    discount,
                    discountRate: RECHARGE_DISCOUNT_RATE,
                    chargeAmount,
                    status: 'pending',
                    requestedAt
                };

                await runTransaction(db, async (tx) => {
                    const userDoc = await tx.get(userRef);
                    if (!userDoc.exists()) throw new Error("User account not found!");

                    const currentBalance = userDoc.data().balance || 0;
                    if (getSpendableWalletBalance(userDoc.data()) < chargeAmount) throw new Error(getInsufficientRechargeMessage(userDoc.data(), chargeAmount));

                    const balanceAfter = currentBalance - chargeAmount;
                    requestPayload.balanceBefore = currentBalance;
                    requestPayload.balanceAfter = balanceAfter;
                    tx.update(userRef, { balance: balanceAfter });

                    const { id, ...firebaseRequestPayload } = requestPayload;
                    tx.set(reqRef, {
                        ...firebaseRequestPayload,
                        requestedAt: serverTimestamp()
                    });

                    tx.set(doc(collection(userRef, 'transactions')), {
                        type: 'mobile_recharge',
                        amount,
                        discount,
                        chargeAmount,
                        mobileNumber,
                        operator,
                        state,
                        planDetails,
                        comment: `Mobile Recharge (${operator})`,
                        timestamp: serverTimestamp(),
                        status: 'pending',
                        requestId: reqRef.id,
                        balanceBefore: currentBalance,
                        balanceAfter,
                        transactionId: generateTransactionId()
                    });
                });

                upsertCloudFundRequest(requestPayload).catch(error => {
                    console.warn('Recharge cloud request sync skipped:', error);
                });
                syncRecentTransactionsToCloud(currentUser.uid).catch(error => {
                    console.warn('Recharge cloud transaction sync skipped:', error);
                });
                showNotification('Recharge request submitted and wallet amount deducted!', false, true);
                if (typeof window.notifyWalletBalanceChange === 'function') {
                    window.notifyWalletBalanceChange(currentUser.uid, 'debit', chargeAmount, `Mobile Recharge (${operator} - ${mobileNumber})`);
                }
                if (typeof sendNotification === 'function') {
                    const targetAdmin = currentUserData?.parentAdmin || currentUserData?.parent_admin || ADMIN_UID;
                    sendNotification(
                        targetAdmin,
                        'New Recharge Request',
                        `User ${currentUserData.name || 'User'} (${currentUserData.mobile || ''}) requested recharge of ₹${amount} for mobile ${mobileNumber}.`
                    ).catch(e => console.warn('Recharge push notification error:', e));
                }
                window.closeModal();
                hidePage();
            } catch (e) {
                console.error("Recharge request failed:", e);
                const message = String(e?.message || '').trim();
                showNotification(message && !/permission|firebase|internal|network/i.test(message)
                    ? message
                    : 'Could not submit recharge request. Please try again.', true);
            }
        };

const handleRechargeAction = (userId, requestId, newStatus) => {
            const reqData = allRechargeRequestsCache.find(r => r.id === requestId);
            if (!reqData) return showNotification('Error: Recharge request not found.', true);

            if (newStatus === 'completed') {
                renderModal('Complete Recharge',
                    `<div class="space-y-4">
                        <p class="mb-2">Enter the recharge transaction ID after completing ${formatCurrency(reqData.amount)} recharge for ${reqData.mobileNumber}.</p>
                        <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-xs space-y-1">
                            <p><strong>Operator:</strong> ${reqData.operator}</p>
                            <p><strong>State:</strong> ${reqData.state}</p>
                            <p><strong>Plan:</strong> ${reqData.planDetails}</p>
                            <p><strong>Wallet Deducted:</strong> ${formatCurrency(reqData.chargeAmount || reqData.amount || 0)}</p>
                        </div>
                        <input type="text" id="admin-recharge-tx-id-input" placeholder="Enter Transaction ID" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    </div>`,
                    `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                     <button id="modal-recharge-confirm-btn" class="px-4 py-2 text-sm bg-sky-600 text-white rounded-lg">Mark Done</button>`,
                    'max-w-md'
                );
                document.getElementById('modal-recharge-confirm-btn').onclick = () => {
                    const txnId = document.getElementById('admin-recharge-tx-id-input').value.trim();
                    if (!txnId) return showNotification('Transaction ID is required.', true);
                    proceedWithRechargeAction(userId, requestId, newStatus, txnId, reqData);
                };
            } else {
                renderModal('Reject Recharge Request',
                    `<div class="space-y-4">
                        <p class="font-semibold text-red-500">Reject this recharge request and refund wallet deduction?</p>
                        <textarea id="recharge-rejection-reason-input" placeholder="Enter rejection reason" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" rows="3"></textarea>
                    </div>`,
                    `<button onclick="window.closeModal()" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                     <button id="modal-recharge-reject-btn" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Reject & Refund</button>`,
                    'max-w-md'
                );
                document.getElementById('modal-recharge-reject-btn').onclick = () => {
                    const reason = document.getElementById('recharge-rejection-reason-input').value.trim();
                    if (!reason) return showNotification('Please provide a rejection reason.', true);
                    proceedWithRechargeAction(userId, requestId, newStatus, null, reqData, reason);
                };
            }
        };

const proceedWithRechargeAction = async (userId, requestId, newStatus, txnId, reqData, rejectionReason = '') => {
            try {
                const reqRef = doc(db, `artifacts/${appId}/public/data/fund_requests`, requestId);
                await runTransaction(db, async (tx) => {
                    const reqDoc = await tx.get(reqRef);
                    if (!reqDoc.exists() || reqDoc.data().status !== 'pending') throw new Error("Recharge request not found or already processed.");

                    const data = reqDoc.data();
                    const userRef = doc(db, `artifacts/${appId}/public/data/users`, userId);
                    const userDoc = await tx.get(userRef);
                    const chargeAmount = data.chargeAmount || data.amount || 0;

                    if (newStatus === 'completed') {
                        tx.update(reqRef, {
                            status: 'completed',
                            processedAt: serverTimestamp(),
                            adminTransactionId: txnId
                        });
                    } else {
                        tx.update(reqRef, {
                            status: 'rejected',
                            processedAt: serverTimestamp(),
                            rejectionReason
                        });
                        if (userDoc.exists()) {
                            tx.update(userRef, { balance: (userDoc.data().balance || 0) + chargeAmount });
                        }
                    }

                    if (userDoc.exists()) {
                        const txQuery = query(collection(userRef, 'transactions'), where("requestId", "==", requestId));
                        const txSnap = await getDocs(txQuery);
                        const txUpdate = newStatus === 'completed'
                            ? {
                                status: 'completed',
                                adminTransactionId: txnId,
                                transactionId: txnId,
                                processedAt: serverTimestamp()
                            }
                            : {
                                status: 'rejected',
                                rejectionReason,
                                processedAt: serverTimestamp(),
                                comment: `Mobile Recharge Rejected: ${rejectionReason}`
                            };

                        if (!txSnap.empty) {
                            tx.update(txSnap.docs[0].ref, txUpdate);
                        } else {
                            tx.set(doc(collection(userRef, 'transactions')), {
                                type: 'mobile_recharge',
                                amount: data.amount,
                                chargeAmount,
                                discount: data.discount || 0,
                                mobileNumber: data.mobileNumber,
                                operator: data.operator,
                                state: data.state,
                                planDetails: data.planDetails,
                                comment: newStatus === 'completed' ? `Mobile Recharge (${data.operator})` : `Mobile Recharge Rejected: ${rejectionReason}`,
                                timestamp: serverTimestamp(),
                                requestId,
                                transactionId: txnId || generateTransactionId(),
                                status: newStatus,
                                adminTransactionId: txnId || ''
                            });
                        }
                    }
                });
                await updateCloudFundRequestStatus(requestId, newStatus, {
                    ...(reqData || {}),
                    status: newStatus,
                    adminTransactionId: txnId || '',
                    rejectionReason,
                    processedAt: Date.now()
                });
                syncRecentTransactionsToCloud(userId).catch(error => console.warn('Recharge transaction background sync skipped:', error));
                allRechargeRequestsCache = allRechargeRequestsCache.filter(req => req.id !== requestId);
                renderAdminRechargeRequests(allRechargeRequestsCache);
                updateAdminPendingRequestSummary();
                refreshAdminFundRequestsFromCloud().catch(error => console.warn('Recharge request background refresh skipped:', error));
                showNotification(`Recharge request has been ${newStatus === 'completed' ? 'completed' : 'rejected'}.`);
                if (typeof window.sendNotification === 'function') {
                    if (newStatus === 'completed') {
                        window.sendNotification(userId, 'Recharge Completed', `Your recharge of ₹${reqData.amount || ''} for mobile ${reqData.mobileNumber || ''} is successful. Txn ID: ${txnId || 'N/A'}`);
                    } else {
                        window.sendNotification(userId, 'Recharge Rejected', `Your recharge of ₹${reqData.amount || ''} was rejected. Reason: ${rejectionReason || 'Not specified'}. ₹${reqData.chargeAmount} refunded to your wallet.`);
                        if (typeof window.notifyWalletBalanceChange === 'function') {
                            window.notifyWalletBalanceChange(userId, 'credit', reqData.chargeAmount, 'Recharge Refund');
                        }
                    }
                }
                window.closeModal();
            } catch (e) {
                console.error("Recharge action failed:", e);
                showFriendlyError('Could not update recharge request. Please try again.');
                window.closeModal();
            }
        };

// Expose functions to window for global access
window.getInsufficientRechargeMessage = getInsufficientRechargeMessage;
window.showMobileRechargePage = showMobileRechargePage;
window.handleRechargeCheckout = handleRechargeCheckout;
window.handleSubmitRechargeRequest = handleSubmitRechargeRequest;
window.handleRechargeAction = handleRechargeAction;
window.proceedWithRechargeAction = proceedWithRechargeAction;
