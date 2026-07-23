// scripts/revert-users-to-owner.cjs
const APP_ID = 'digital-wallet-prod';
const OWNER_EMAIL = 'reviewsworld01@gmail.com';
const SUB_ADMIN_EMAIL = 'malasingh40163@gmail.com';

async function revertUsersToOwner() {
    console.log('Starting script to revert owner users back to owner...');

    // 1. Authenticate as Admin via REST API
    const loginRes = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyBzF1agrBFFh4cC2DkmZKePf4-gjE05OQo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: OWNER_EMAIL,
            password: 'Yash@952518',
            returnSecureToken: true
        })
    });

    if (!loginRes.ok) {
        throw new Error('Admin login failed: ' + (await loginRes.text()));
    }

    const { idToken, localId: ownerUid } = await loginRes.json();
    console.log(`Admin login successful. Owner UID: ${ownerUid}`);

    // 2. Fetch all users from Firestore
    const usersUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users?pageSize=1000`;
    const usersRes = await fetch(usersUrl, {
        headers: { 'Authorization': `Bearer ${idToken}` }
    });

    if (!usersRes.ok) {
        throw new Error('Failed to fetch users: ' + (await usersRes.text()));
    }

    const usersData = await usersRes.json();
    const docs = usersData.documents || [];
    console.log(`Total users fetched from Firestore: ${docs.length}`);

    // 3. Find sub-admin malasingh40163@gmail.com
    let subAdminDoc = docs.find(d => {
        const fields = d.fields || {};
        const email = fields.email?.stringValue || '';
        return email.toLowerCase().trim() === SUB_ADMIN_EMAIL.toLowerCase();
    });

    let subAdminUid = null;
    let subAdminRefCode = null;
    if (subAdminDoc) {
        subAdminUid = subAdminDoc.name.split('/').pop();
        const fields = subAdminDoc.fields || {};
        subAdminRefCode = (fields.referralCode?.stringValue || fields.myReferralCode?.stringValue || '').trim().toUpperCase();
        console.log(`Found Sub-Admin ${SUB_ADMIN_EMAIL} with UID: ${subAdminUid}, RefCode: ${subAdminRefCode}`);
    } else {
        throw new Error(`Sub-Admin ${SUB_ADMIN_EMAIL} not found!`);
    }

    let revertedCount = 0;
    let subAdminKeptCount = 0;

    for (const doc of docs) {
        const userId = doc.name.split('/').pop();
        if (userId === ownerUid || userId === subAdminUid) continue;

        const fields = doc.fields || {};
        const role = fields.role?.stringValue || 'user';
        if (role === 'admin' || role === 'owner' || role === 'subadmin') continue;

        const usedRefCode = (fields.usedReferralCode?.stringValue || fields.referredByCode?.stringValue || fields.referralCodeUsed?.stringValue || '').trim().toUpperCase();
        const currentParent = fields.parentAdmin?.stringValue || fields.parent_admin?.stringValue;

        // Check if user genuinely belongs to sub-admin (used sub-admin's referral code)
        const isSubAdminUser = subAdminRefCode && usedRefCode === subAdminRefCode;

        if (!isSubAdminUser && currentParent === subAdminUid) {
            const userName = fields.name?.stringValue || fields.email?.stringValue || 'User';
            console.log(`Reverting user ${userId} (${userName}) back to Owner (${ownerUid})...`);
            const updateUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${userId}?updateMask.fieldPaths=parentAdmin&updateMask.fieldPaths=parent_admin`;
            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    fields: {
                        parentAdmin: { stringValue: ownerUid },
                        parent_admin: { stringValue: ownerUid }
                    }
                })
            });
            if (updateRes.ok) {
                revertedCount++;
            } else {
                console.error(`Failed to update user ${userId}:`, await updateRes.text());
            }
        } else if (isSubAdminUser) {
            subAdminKeptCount++;
        }
    }

    console.log(`Revert Complete! ${revertedCount} users moved back to Owner (${ownerUid}). ${subAdminKeptCount} users retained under Sub-Admin (${subAdminUid}).`);
}

revertUsersToOwner().catch(err => {
    console.error('Revert script failed:', err);
});
