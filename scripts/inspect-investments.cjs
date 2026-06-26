const path = require('path');
const admin = require(path.join(__dirname, '..', 'backend', 'node_modules', 'firebase-admin'));

const APP_ID = 'digital-wallet-prod';

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

async function main() {
  initAdmin();
  const db = admin.firestore();
  
  console.log('Fetching all users...');
  const usersSnap = await db.collection(`artifacts/${APP_ID}/public/data/users`).get();
  console.log(`Found ${usersSnap.size} users.`);

  console.log('Searching for users with "Partner Investment Started" transactions...');
  const affectedUsers = [];

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const txSnap = await userDoc.ref.collection('transactions')
      .where('comment', '==', 'Partner Investment Started')
      .get();
    
    if (txSnap.size > 0) {
      const userData = userDoc.data();
      const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      affectedUsers.push({
        userId,
        name: userData.name,
        email: userData.email,
        mobile: userData.mobile,
        balance: userData.balance,
        transactionsCount: txSnap.size,
        transactions: txs
      });
    }
  }

  console.log('\nAffected Users found:');
  console.log(JSON.stringify(affectedUsers, null, 2));

  console.log('\nFetching all partner investments...');
  const investmentsSnap = await db.collection(`artifacts/${APP_ID}/public/data/partner_investments`).get();
  console.log(`Found ${investmentsSnap.size} investments in total.`);
  
  const investments = investmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(JSON.stringify(investments, null, 2));
}

main().catch(error => {
  console.error('Inspection failed:', error);
  process.exit(1);
});
