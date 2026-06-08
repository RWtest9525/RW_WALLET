const path = require('path');

const admin = require(path.join(__dirname, '..', 'backend', 'node_modules', 'firebase-admin'));

const APP_ID = process.env.RW_APP_ID || 'digital-wallet-prod';
const APPLY = process.argv.includes('--apply');
const ONLY_USER_ARG = process.argv.find(arg => arg.startsWith('--user='));
const ONLY_USER = ONLY_USER_ARG ? ONLY_USER_ARG.split('=').slice(1).join('=').trim() : '';

function initAdmin() {
  if (admin.apps.length) return;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    });
    return;
  }
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

function millis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPaidLoan(loan) {
  return ['paid', 'repaid', 'closed', 'completed', 'reversed_duplicate'].includes(String(loan.status || '').toLowerCase());
}

function isActiveLoan(loan) {
  return String(loan.status || 'active').toLowerCase() === 'active';
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const usersRef = db.collection(`artifacts/${APP_ID}/public/data/users`);
  const loansRef = db.collection(`artifacts/${APP_ID}/public/data/loans`);
  const usersSnap = ONLY_USER ? await usersRef.where(admin.firestore.FieldPath.documentId(), '==', ONLY_USER).get() : await usersRef.get();
  const loansSnap = ONLY_USER ? await loansRef.where('userId', '==', ONLY_USER).get() : await loansRef.get();

  const usersById = new Map(usersSnap.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
  const loansByUser = new Map();
  loansSnap.docs.forEach(doc => {
    const loan = { id: doc.id, ref: doc.ref, ...doc.data() };
    const userId = loan.userId || loan.uid;
    if (!userId || isPaidLoan(loan)) return;
    if (!loansByUser.has(userId)) loansByUser.set(userId, []);
    loansByUser.get(userId).push(loan);
  });

  const findings = [];
  loansByUser.forEach((loans, userId) => {
    const activeLoans = loans
      .filter(isActiveLoan)
      .sort((a, b) => millis(a.createdAt || a.timestamp) - millis(b.createdAt || b.timestamp));
    if (activeLoans.length <= 1) return;
    const keepLoan = activeLoans[0];
    const duplicateLoans = activeLoans.slice(1);
    const duplicatePrincipal = duplicateLoans.reduce((sum, loan) => sum + number(loan.amount || loan.principal), 0);
    const user = usersById.get(userId) || {};
    const balance = number(user.balance);
    const reverseFromBalance = Math.min(balance, duplicatePrincipal);
    const recoveryDue = Math.max(0, duplicatePrincipal - reverseFromBalance);
    findings.push({
      userId,
      name: user.name || '',
      mobile: user.mobile || '',
      balance,
      keepLoanId: keepLoan.id,
      duplicateLoanIds: duplicateLoans.map(loan => loan.id),
      duplicatePrincipal,
      reverseFromBalance,
      recoveryDue,
      keepRepayable: number(keepLoan.totalRepayable || keepLoan.repayable || keepLoan.amount)
    });
  });

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    appId: APP_ID,
    usersChecked: usersSnap.size,
    loansChecked: loansSnap.size,
    affectedUsers: findings.length,
    totalDuplicatePrincipal: findings.reduce((sum, item) => sum + item.duplicatePrincipal, 0),
    totalReverseFromBalance: findings.reduce((sum, item) => sum + item.reverseFromBalance, 0),
    totalRecoveryDue: findings.reduce((sum, item) => sum + item.recoveryDue, 0),
    findings
  }, null, 2));

  if (!APPLY || !findings.length) return;

  for (const finding of findings) {
    await db.runTransaction(async tx => {
      const userRef = usersRef.doc(finding.userId);
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists) return;
      const latestBalance = number(userDoc.data().balance);
      const reverseNow = Math.min(latestBalance, finding.duplicatePrincipal);
      const recoveryDue = Math.max(0, finding.duplicatePrincipal - reverseNow);
      tx.update(userRef, {
        balance: latestBalance - reverseNow,
        activeLoanId: finding.keepLoanId,
        activeLoanRepayable: finding.keepRepayable,
        loanLockedAmount: finding.keepRepayable,
        duplicateLoanRecoveryDue: recoveryDue,
        duplicateLoanRecoveryUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      finding.duplicateLoanIds.forEach(loanId => {
        tx.update(loansRef.doc(loanId), {
          status: 'reversed_duplicate',
          reversedAt: admin.firestore.FieldValue.serverTimestamp(),
          reversalReason: 'Duplicate active loan credit reversed; original active loan kept.'
        });
      });
      const txRef = userRef.collection('transactions').doc(`DUPLICATE-LOAN-REVERSAL-${Date.now()}`);
      tx.set(txRef, {
        type: 'debit',
        amount: reverseNow,
        comment: recoveryDue > 0
          ? `Duplicate loan credit partly reversed. Remaining due: ${recoveryDue}`
          : 'Duplicate loan credit reversed',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        transactionId: txRef.id,
        status: 'completed',
        recipientName: 'Reviews World'
      });
    });
  }

  console.log(`Applied duplicate-loan correction for ${findings.length} user(s).`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
