const APP_ID = 'digital-wallet-prod';
const USER_ID = 'ns1mO2Klg8OxFxe1pDirSXqrE923';

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

  // Fetch current user document
  const userUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${USER_ID}`;
  const userRes = await fetch(userUrl);
  if (!userRes.ok) {
    throw new Error(`Failed to fetch user: ${userRes.statusText}`);
  }
  const user = await userRes.json();
  const currentBalance = user.fields?.balance?.integerValue || user.fields?.balance?.doubleValue || '0';
  console.log(`Current Balance in Firestore: ${currentBalance}`);

  if (currentBalance !== '1523') {
    console.log('Warning: Current balance is not 1523. Please verify before proceeding.');
  }

  // Update user balance to 2023
  console.log("Updating Amit's balance to 2023 (adding the 500 refund)...");
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
    throw new Error('Balance correction failed: ' + (await balanceRes.text()));
  }
  console.log("User balance corrected successfully to 2023.");

  // Verify updated user balance
  const verifyRes = await fetch(userUrl);
  if (!verifyRes.ok) {
    throw new Error(`Failed to verify updated user: ${verifyRes.statusText}`);
  }
  const verifiedUser = await verifyRes.json();
  const newBalance = verifiedUser.fields?.balance?.integerValue || verifiedUser.fields?.balance?.doubleValue || '0';
  console.log(`Verified New Balance in Firestore: ${newBalance}`);
}

main().catch(console.error);
