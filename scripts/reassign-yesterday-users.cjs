// scripts/reassign-yesterday-users.cjs
const APP_ID = 'digital-wallet-prod';
const OWNER_EMAIL = 'reviewsworld01@gmail.com';
const SUB_ADMIN_EMAIL = 'malasingh40163@gmail.com';
const OWNER_REF_CODE = 'RWADMIN182488';

async function runMigration() {
    console.log('Starting data migration script...');

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
    console.log(`Total users fetched: ${docs.length}`);

    // 3. Find sub-admin malasingh40163@gmail.com
    let subAdminDoc = docs.find(d => {
        const fields = d.fields || {};
        const email = fields.email?.stringValue || '';
        return email.toLowerCase().trim() === SUB_ADMIN_EMAIL.toLowerCase();
    });

    let subAdminUid = null;
    if (subAdminDoc) {
        subAdminUid = subAdminDoc.name.split('/').pop();
        console.log(`Found Sub-Admin ${SUB_ADMIN_EMAIL} with UID: ${subAdminUid}`);
    } else {
        console.warn(`Sub-admin ${SUB_ADMIN_EMAIL} not found in Firestore docs list. Searching admin records...`);
        const adminCheck = docs.find(d => {
            const fields = d.fields || {};
            return fields.role?.stringValue === 'admin' && fields.email?.stringValue !== OWNER_EMAIL;
        });
        if (adminCheck) {
            subAdminUid = adminCheck.name.split('/').pop();
            console.log(`Fallback: Using Sub-Admin UID ${subAdminUid}`);
        } else {
            throw new Error(`Sub-Admin ${SUB_ADMIN_EMAIL} does not exist in users collection!`);
        }
    }

    // 4. Update Owner's referral code to RWADMIN182488
    console.log(`Updating Owner (${OWNER_EMAIL}) referral code to ${OWNER_REF_CODE}...`);
    const ownerDocPath = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${ownerUid}?updateMask.fieldPaths=referralCode&updateMask.fieldPaths=referral_code`;
    await fetch(ownerDocPath, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
            fields: {
                referralCode: { stringValue: OWNER_REF_CODE },
                referral_code: { stringValue: OWNER_REF_CODE }
            }
        })
    });
    console.log(`Owner referral code set to ${OWNER_REF_CODE}.`);

    // 5. Identify yesterday's users (July 22, 2026 local time)
    const yesterdayStart = new Date('2026-07-22T00:00:00+05:30').getTime();
    const yesterdayEnd = new Date('2026-07-22T23:59:59+05:30').getTime();

    console.log(`Checking users registered between July 22 00:00:00 and July 22 23:59:59 IST...`);

    let reassignedCount = 0;
    for (const doc of docs) {
        const userId = doc.name.split('/').pop();
        if (userId === ownerUid || userId === subAdminUid) continue;

        const fields = doc.fields || {};
        const role = fields.role?.stringValue || 'user';
        if (role === 'admin' || role === 'owner') continue;

        let createdTime = 0;
        if (fields.createdAt?.timestampValue) {
            createdTime = new Date(fields.createdAt.timestampValue).getTime();
        } else if (fields.createdAt?.integerValue) {
            createdTime = Number(fields.createdAt.integerValue);
        } else if (fields.signupRequestedAt?.timestampValue) {
            createdTime = new Date(fields.signupRequestedAt.timestampValue).getTime();
        }

        const isYesterday = (createdTime >= yesterdayStart && createdTime <= yesterdayEnd) || 
                            (createdTime > 0 && Math.abs(createdTime - yesterdayStart) < 86400000);

        const currentParent = fields.parentAdmin?.stringValue || fields.parent_admin?.stringValue || ownerUid;

        if (isYesterday && (currentParent === ownerUid || currentParent === 'ns1mO2Klg8OxFxe1pDirSXqrE923' || !fields.parentAdmin)) {
            console.log(`Reassigning user ${userId} (${fields.name?.stringValue || fields.email?.stringValue || 'User'}) to Sub-Admin ${subAdminUid}...`);
            const updateUrl = `https://firestore.googleapis.com/v1/projects/review-world-1312e/databases/(default)/documents/artifacts/${APP_ID}/public/data/users/${userId}?updateMask.fieldPaths=parentAdmin&updateMask.fieldPaths=parent_admin`;
            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    fields: {
                        parentAdmin: { stringValue: subAdminUid },
                        parent_admin: { stringValue: subAdminUid }
                    }
                })
            });
            if (updateRes.ok) {
                reassignedCount++;
            } else {
                console.error(`Failed to update user ${userId}:`, await updateRes.text());
            }
        }
    }

    console.log(`Migration Complete! Total users reassigned to ${SUB_ADMIN_EMAIL}: ${reassignedCount}`);
}

runMigration().catch(err => {
    console.error('Migration failed with error:', err);
});
