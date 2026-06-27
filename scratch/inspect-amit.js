const APP_ID = 'digital-wallet-prod';
const USER_ID = 'ns1mO2Klg8OxFxe1pDirSXqrE923';

async function main() {
  console.log("Fetching user doc...");
  const userUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${USER_ID}`;
  const userRes = await fetch(userUrl);
  if (!userRes.ok) {
    throw new Error(`Failed to fetch user: ${userRes.statusText}`);
  }
  const user = await userRes.json();
  console.log("User Document:", JSON.stringify(user, null, 2));

  console.log("\nFetching user transactions...");
  const txsUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${USER_ID}/transactions?pageSize=100`;
  const txsRes = await fetch(txsUrl);
  if (!txsRes.ok) {
    throw new Error(`Failed to fetch transactions: ${txsRes.statusText}`);
  }
  const txsData = await txsRes.json();
  const docs = txsData.documents || [];
  console.log(`Found ${docs.length} transactions:`);
  
  for (const doc of docs) {
    const fields = doc.fields || {};
    const type = fields.type?.stringValue || '';
    const amount = fields.amount?.integerValue || fields.amount?.doubleValue || fields.amount?.stringValue || '0';
    const comment = fields.comment?.stringValue || '';
    const timestamp = fields.timestamp?.timestampValue || '';
    const status = fields.status?.stringValue || '';
    const txId = fields.transactionId?.stringValue || doc.name.split('/').pop();
    
    console.log(`- ID: ${txId}, Type: ${type}, Amount: ${amount}, Status: ${status}, Comment: "${comment}", Time: ${timestamp}`);
  }
}

main().catch(console.error);
