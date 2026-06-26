const APP_ID = 'digital-wallet-prod';
const USER_ID = 'ns1mO2Klg8OxFxe1pDirSXqrE923';

const DUP_INVESTMENT_IDS = [
  'Z2re7ATQOL3cbtTcT8mk',
  'nww2RmHtyPWMOJ9Kxjw2',
  'USQpLrgTJGMQpFYYGkji',
  'Lhgf4toZR2MpYSJ765wt',
  'GrC1KFZ8QMd5ZdjqBAHY'
];

const DUP_TRANSACTION_DOC_IDS = [
  'PPPCuoKksnZ1LuOWSxd8',
  'FdDOWnlCPzhnXNS71QZA',
  'cMfCTsLzdsTZnecGujTp',
  'Gwa3ZCXiLnQoBCX6K0EO',
  'ItlT26OFhBBU43UVC5OX'
];

async function main() {
  console.log('Logging in as Admin via REST API...');
  const loginRes = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyBzF1agrBFFh4cC2DkmZKePf4-gjE05OQo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'reviewsworld01@gmail.com',
      password: 'Yash@952518',
      returnSecureToken: true
    })
  });

  if (!loginRes.ok) {
    throw new Error('Admin login failed: ' + (await loginRes.text()));
  }

  const { idToken } = await loginRes.json();
  console.log('Login successful. Admin ID Token retrieved.');

  // 1. Update Amit's balance to 2023 (1523 + 500)
  console.log('Updating user balance in Firestore...');
  const balanceUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${USER_ID}?updateMask.fieldPaths=balance`;
  const balanceRes = await fetch(balanceUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      fields: {
        balance: {
          integerValue: '2023'
        }
      }
    })
  });

  if (!balanceRes.ok) {
    throw new Error('Balance update failed: ' + (await balanceRes.text()));
  }
  console.log('User balance updated successfully to 2023.');

  // 2. Set the 5 duplicate investments to "cancelled_duplicate"
  console.log('Cancelling 5 duplicate investments...');
  for (const invId of DUP_INVESTMENT_IDS) {
    const invUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/partner_investments/${invId}?updateMask.fieldPaths=status`;
    const invRes = await fetch(invUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        fields: {
          status: {
            stringValue: 'cancelled_duplicate'
          }
        }
      })
    });
    if (!invRes.ok) {
      throw new Error(`Failed to cancel investment ${invId}: ` + (await invRes.text()));
    }
    console.log(`Cancelled investment: ${invId}`);
  }

  // 3. Set the 5 duplicate transactions to "cancelled_duplicate"
  console.log('Marking duplicate debit transactions as cancelled...');
  for (const txDocId of DUP_TRANSACTION_DOC_IDS) {
    const txUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${USER_ID}/transactions/${txDocId}?updateMask.fieldPaths=status`;
    const txRes = await fetch(txUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        fields: {
          status: {
            stringValue: 'cancelled_duplicate'
          }
        }
      })
    });
    if (!txRes.ok) {
      throw new Error(`Failed to update transaction doc ${txDocId}: ` + (await txRes.text()));
    }
    console.log(`Updated transaction doc status: ${txDocId}`);
  }

  // 4. Create a new credit transaction document for the refund of 500 INR
  console.log('Creating refund transaction document...');
  const now = new Date();
  const txId = `REVERSAL-INVESTMENT-${Date.now()}`;
  const newTxUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${USER_ID}/transactions/${txId}`;
  const newTxRes = await fetch(newTxUrl, {
    method: 'PATCH', // using PATCH to set document with specific ID (creates or overrides)
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      fields: {
        type: { stringValue: 'credit' },
        amount: { integerValue: '500' },
        comment: { stringValue: 'Duplicate investment credit reversed/refunded' },
        timestamp: { timestampValue: now.toISOString() },
        transactionId: { stringValue: txId },
        status: { stringValue: 'completed' },
        senderName: { stringValue: 'Reviews World' }
      }
    })
  });

  if (!newTxRes.ok) {
    throw new Error('Failed to create refund transaction doc: ' + (await newTxRes.text()));
  }
  console.log(`Refund transaction doc created: ${txId}`);

  console.log('\nData correction applied successfully!');
}

main().catch(console.error);
