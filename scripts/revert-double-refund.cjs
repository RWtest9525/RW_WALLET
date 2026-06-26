const APP_ID = 'digital-wallet-prod';
const USER_ID = 'ns1mO2Klg8OxFxe1pDirSXqrE923';
const DUP_REVERSAL_TX_ID = 'REVERSAL-INVESTMENT-1782452760035';

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

  // 1. Correct user balance to 1523
  console.log("Correcting Amit's balance back to 1523...");
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
          integerValue: '1523'
        }
      }
    })
  });

  if (!balanceRes.ok) {
    throw new Error('Balance correction failed: ' + (await balanceRes.text()));
  }
  console.log("User balance corrected successfully to 1523.");

  // 2. Delete the extra refund transaction document
  console.log('Deleting duplicate refund transaction document...');
  const txUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${USER_ID}/transactions/${DUP_REVERSAL_TX_ID}`;
  const txRes = await fetch(txUrl, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${idToken}`
    }
  });

  if (!txRes.ok) {
    throw new Error('Failed to delete transaction doc: ' + (await txRes.text()));
  }
  console.log(`Duplicate refund transaction ${DUP_REVERSAL_TX_ID} deleted successfully.`);

  console.log('\nDouble refund correction applied successfully!');
}

main().catch(console.error);
