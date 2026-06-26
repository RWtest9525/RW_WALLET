const APP_ID = 'digital-wallet-prod';

async function fetchAllDocuments(collectionPath) {
  let documents = [];
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/${collectionPath}?pageSize=100` + (pageToken ? `&pageToken=${pageToken}` : '');
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${collectionPath}: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.documents) {
      documents = documents.concat(data.documents);
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return documents;
}

async function main() {
  console.log('Fetching all partner investments via REST...');
  const investments = await fetchAllDocuments(`artifacts/${APP_ID}/public/data/partner_investments`);
  console.log(`Fetched ${investments.length} total investments.`);

  console.log('Fetching all users via REST...');
  const users = await fetchAllDocuments(`artifacts/${APP_ID}/public/data/users`);
  console.log(`Fetched ${users.length} total users.`);

  console.log('Scanning users for transactions of type "debit" with comment "Partner Investment Started"...');
  
  const affectedUsers = [];
  for (const user of users) {
    const userId = user.name.split('/').pop();
    const txsUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${userId}/transactions?pageSize=100`;
    const res = await fetch(txsUrl);
    if (!res.ok) continue;
    const data = await res.json();
    if (!data.documents) continue;

    const debitTxs = data.documents.filter(doc => {
      const fields = doc.fields || {};
      const comment = fields.comment?.stringValue || '';
      return comment === 'Partner Investment Started';
    });

    if (debitTxs.length > 0) {
      const fields = user.fields || {};
      affectedUsers.push({
        userId,
        name: fields.name?.stringValue || 'N/A',
        email: fields.email?.stringValue || 'N/A',
        mobile: fields.mobile?.stringValue || 'N/A',
        balance: fields.balance?.doubleValue || fields.balance?.integerValue || 0,
        debitTransactions: debitTxs.map(doc => {
          const f = doc.fields || {};
          return {
            id: doc.name.split('/').pop(),
            amount: f.amount?.doubleValue || f.amount?.integerValue || 0,
            comment: f.comment?.stringValue || '',
            timestamp: f.timestamp?.timestampValue || '',
            transactionId: f.transactionId?.stringValue || ''
          };
        })
      });
    }
  }

  console.log('\nAffected Users found:');
  console.log(JSON.stringify(affectedUsers, null, 2));

  console.log('\nMatching investments for affected users in partner_investments collection:');
  for (const affected of affectedUsers) {
    const userInvestments = investments.filter(inv => {
      const f = inv.fields || {};
      return f.userId?.stringValue === affected.userId;
    }).map(inv => {
      const f = inv.fields || {};
      return {
        id: inv.name.split('/').pop(),
        amount: f.amount?.doubleValue || f.amount?.integerValue || 0,
        status: f.status?.stringValue || '',
        createdAt: f.createdAt?.timestampValue || '',
        invoiceId: f.invoiceId?.stringValue || ''
      };
    });
    console.log(`User ${affected.name} (${affected.userId}) has ${userInvestments.length} investment docs:`, userInvestments);
  }
}

main().catch(console.error);
