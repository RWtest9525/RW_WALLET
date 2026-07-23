// scripts/approve-all-subadmin-users.cjs
const APP_ID = 'digital-wallet-prod';
const OWNER_EMAIL = 'reviewsworld01@gmail.com';

async function approveAllSubAdminUsers() {
    console.log('Starting script to approve all sub-admin users...');

    // 1. Admin login
    const loginRes = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyBzF1agrBFFh4cC2DkmZKePf4-gjE05OQo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: OWNER_EMAIL,
            password: 'Yash@952518',
            returnSecureToken: true
        })
    });

    if (!loginRes.ok) throw new Error('Admin login failed: ' + (await loginRes.text()));
    const { idToken, localId: ownerUid } = await loginRes.json();

    // 2. Fetch all users from Firestore
    const usersUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users?pageSize=1000`;
    const usersRes = await fetch(usersUrl, { headers: { 'Authorization': `Bearer ${idToken}` } });
    if (!usersRes.ok) throw new Error('Failed to fetch users: ' + (await usersRes.text()));

    const usersData = await usersRes.json();
    const docs = usersData.documents || [];

    let approvedCount = 0;
    for (const doc of docs) {
        const userId = doc.name.split('/').pop();
        const fields = doc.fields || {};
        const role = fields.role?.stringValue || 'user';
        if (role === 'admin' || role === 'owner' || role === 'subadmin') continue;

        const parent = fields.parentAdmin?.stringValue || fields.parent_admin?.stringValue;
        // If user belongs to a sub-admin (parent is not owner)
        if (parent && parent !== ownerUid) {
            const updateUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${userId}?updateMask.fieldPaths=approvalStatus&updateMask.fieldPaths=accountStatus&updateMask.fieldPaths=signupApprovalStatus&updateMask.fieldPaths=isApproved`;
            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    fields: {
                        approvalStatus: { stringValue: 'approved' },
                        accountStatus: { stringValue: 'active' },
                        signupApprovalStatus: { stringValue: 'approved' },
                        isApproved: { booleanValue: true }
                    }
                })
            });

            if (updateRes.ok) approvedCount++;
        }
    }

    console.log(`Successfully approved ${approvedCount} sub-admin users in Firestore.`);
}

approveAllSubAdminUsers().catch(err => console.error('Script error:', err));
