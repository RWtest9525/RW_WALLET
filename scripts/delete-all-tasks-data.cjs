const path = require('path');
require(path.join(__dirname, '..', 'backend', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', 'backend', '.env') });
const admin = require(path.join(__dirname, '..', 'backend', 'node_modules', 'firebase-admin'));

const APP_ID = 'digital-wallet-prod';

function initAdmin() {
  if (admin.apps.length) return;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    return;
  }
  admin.initializeApp({
    projectId: APP_ID
  });
}

async function deleteCollectionDocs(db, collectionPath) {
  console.log(`Fetching documents in ${collectionPath}...`);
  const snap = await db.collection(collectionPath).get();
  console.log(`Found ${snap.size} documents in ${collectionPath}.`);
  if (snap.empty) return 0;

  let count = 0;
  const batchSize = 400;
  let batch = db.batch();

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`Deleted ${count}/${snap.size} documents from ${collectionPath}...`);
    }
  }

  if (count % batchSize !== 0) {
    await batch.commit();
  }
  console.log(`Successfully deleted all ${count} documents from ${collectionPath}.`);
  return count;
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  console.log('=== PURGING TASK DATA ONLY ===');

  // 1. Delete all Task Submissions
  const subsCount = await deleteCollectionDocs(db, `artifacts/${APP_ID}/public/data/task_submissions`);

  // 2. Delete all Task Comment Reservations
  const resCount = await deleteCollectionDocs(db, `artifacts/${APP_ID}/public/data/task_comment_reservations`);

  // 3. Delete all Tasks
  const tasksCount = await deleteCollectionDocs(db, `artifacts/${APP_ID}/public/data/tasks`);

  console.log('=== SUMMARY OF DELETION ===');
  console.log(`Tasks deleted: ${tasksCount}`);
  console.log(`Submissions deleted: ${subsCount}`);
  console.log(`Comment reservations deleted: ${resCount}`);
  console.log('=== DATA PURGE COMPLETE (USERS & FINANCIALS INTACT) ===');
}

main().catch(err => {
  console.error('Task deletion failed:', err);
  process.exit(1);
});
