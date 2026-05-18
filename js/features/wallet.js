// Wallet Features - Updated 2026-05-18
import { db, appId } from '../core/firebase.js';
import { 
    doc, 
    collection, 
    query, 
    where, 
    getDocs, 
    runTransaction, 
    serverTimestamp,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatCurrency, formatDate, formatDateDDMMYY, getTimeFromTimestamp, maskMobile, maskUpi } from '../utils/formatters.js';
import { showNotification, renderModal } from '../ui/components.js';
import { currentUser, currentUserData, transactions, pendingRequests, setTransactions, setPendingRequests } from '../core/state.js';

export const renderTransactionItem = (item, isFullPage = false) => {
    const clickableClass = item.status !== 'pending' ? 'tx-item-clickable' : '';
    const dataKey = item.status !== 'pending' ? `data-key="${item.key}"` : '';

    if (item.status === 'pending') {
        return `
            <div class="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
                <div class="flex-1">
                    <p class="font-semibold capitalize">Withdrawal Request</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${formatDate(item.timestamp)}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-yellow-600">${formatCurrency(item.amount)}</p>
                    <p class="text-xs font-semibold text-yellow-600">Pending</p>
                </div>
            </div>`;
    }

    if (item.type === 'withdrawal') {
        let statusText = item.status === 'completed' ? 'Completed' : 'Rejected';
        let statusColor = 'text-red-500';
        let bgColor = 'bg-red-50 dark:bg-red-900/20';
        let txnIdBadge = item.adminTransactionId ? `<span class="txn-id-badge text-xs ml-2">${item.adminTransactionId}</span>` : '';

        return `
            <div class="flex justify-between items-center p-3 ${bgColor} rounded-lg text-sm ${clickableClass}" ${dataKey}>
                <div class="flex-1">
                    <p class="font-semibold">Withdrawal ${txnIdBadge}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp)}</p>
                    ${item.rejectionReason ? `<p class="text-xs text-red-400 mt-1">Reason: ${item.rejectionReason}</p>` : ''}
                </div>
                <div class="text-right">
                    <p class="font-bold ${statusColor}">-${formatCurrency(item.amount)}</p>
                    <p class="text-xs font-semibold ${statusColor}">${statusText}</p>
                </div>
            </div>`;
    }

    const isCredit = item.type === 'credit' || (item.type === 'wallet_transfer' && item.amount > 0);
    const amountColor = isCredit ? 'text-green-600' : 'text-red-600';
    const amountSign = isCredit ? '+' : '';
    const title = item.type === 'gift_card' ? 'Gift Card Redeemed' : 
                 (item.type === 'wallet_transfer' ? (isCredit ? 'Received Money' : 'Sent Money') : 'Transaction');

    return `
        <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm ${clickableClass}" ${dataKey}>
            <div class="flex-1">
                <p class="font-semibold">${title}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${formatDateDDMMYY(item.timestamp)}</p>
            </div>
            <div class="text-right">
                <p class="font-bold ${amountColor}">${amountSign}${formatCurrency(item.amount)}</p>
                <p class="text-[10px] text-gray-400 uppercase">${item.type.replace('_', ' ')}</p>
            </div>
        </div>`;
};

export const handleWithdrawRequest = async (amount, method, methodName, paymentId) => {
    if (!currentUser) return showNotification('Error: You are not logged in.', true);
    if (!currentUserData) return showNotification('Your user data is still loading. Please try again.', true);

    const q = query(
        collection(db, `artifacts/${appId}/public/data/fund_requests`),
        where("userId", "==", currentUser.uid),
        where("status", "==", "pending")
    );
    const snap = await getDocs(q);
    
    const maxPending = 5; 
    if (snap.size >= maxPending) {
        return showNotification(`You already have ${snap.size} pending withdrawal request(s).`, true);
    }

    const methodSpecificDetails = { [method]: paymentId };

    try {
        const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
        await runTransaction(db, async (tx) => {
            const userDoc = await tx.get(userRef);
            if (!userDoc.exists()) throw new Error("User account not found!");
            const currentBalance = userDoc.data().balance || 0;
            if (currentBalance < amount) throw new Error("Insufficient balance.");

            tx.update(userRef, { balance: currentBalance - amount });
            const reqRef = doc(collection(db, `artifacts/${appId}/public/data/fund_requests`));
            tx.set(reqRef, {
                userId: currentUser.uid,
                userName: currentUserData.name || 'N/A',
                userMobile: currentUserData.mobile || 'N/A',
                userEmail: currentUserData.email || 'N/A',
                type: 'withdrawal',
                amount,
                method: methodName,
                methodId: method,
                status: 'pending',
                requestedAt: serverTimestamp(),
                ...methodSpecificDetails
            });
        });
        showNotification('Withdrawal request submitted successfully!');
        window.hidePage();
    } catch (error) {
        showNotification(error.message, true);
    }
};
export const handleRedeem = async () => {
    const code = document.getElementById('gift-code-input').value.trim();
    if (!code) return showNotification('Please enter a gift code', true);

    try {
        const giftRef = doc(db, `artifacts/${appId}/public/data/gift_codes`, code);
        await runTransaction(db, async (tx) => {
            const giftDoc = await tx.get(giftRef);
            if (!giftDoc.exists()) throw new Error("Invalid gift code");
            const giftData = giftDoc.data();
            if (giftData.isUsed) throw new Error("This code has already been used");

            const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
            const userDoc = await tx.get(userRef);
            const currentBalance = userDoc.data().balance || 0;

            tx.update(userRef, { balance: currentBalance + giftData.amount });
            tx.update(giftRef, { isUsed: true, usedBy: currentUser.uid, usedAt: serverTimestamp() });
            
            const txRef = doc(collection(userRef, 'transactions'));
            tx.set(txRef, {
                type: 'gift_card',
                amount: giftData.amount,
                code: code,
                timestamp: serverTimestamp(),
                status: 'completed'
            });
        });
        showNotification(`Success! ${code} redeemed successfully.`);
        window.closeModal();
    } catch (e) { showNotification(e.message, true); }
};

export const handlePayToWallet = async (recipientUid, amount) => {
    if (recipientUid === currentUser.uid) return showNotification("You cannot send money to yourself", true);
    
    try {
        const senderRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
        const recipientRef = doc(db, `artifacts/${appId}/public/data/users`, recipientUid);
        
        await runTransaction(db, async (tx) => {
            const senderDoc = await tx.get(senderRef);
            const recipientDoc = await tx.get(recipientRef);
            
            if (!recipientDoc.exists()) throw new Error("Recipient not found");
            const senderBalance = senderDoc.data().balance || 0;
            if (senderBalance < amount) throw new Error("Insufficient balance");

            tx.update(senderRef, { balance: senderBalance - amount });
            tx.update(recipientRef, { balance: (recipientDoc.data().balance || 0) + amount });

            // Record for sender
            const senderTxRef = doc(collection(senderRef, 'transactions'));
            tx.set(senderTxRef, {
                type: 'wallet_transfer',
                amount: -amount,
                recipientName: recipientDoc.data().name || 'User',
                timestamp: serverTimestamp(),
                status: 'completed'
            });

            // Record for recipient
            const recipientTxRef = doc(collection(recipientRef, 'transactions'));
            tx.set(recipientTxRef, {
                type: 'wallet_transfer',
                amount: amount,
                senderName: senderDoc.data().name || 'User',
                timestamp: serverTimestamp(),
                status: 'completed'
            });
        });
        showNotification('Money sent successfully!');
        window.hidePage();
    } catch (e) { showNotification(e.message, true); }
};
