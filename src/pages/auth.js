// File: src/pages/auth.js

const getBackendAuthToken = async (forceRefresh = false) => {
            if (!currentUser) throw new Error('Login required');
            if (backendAuthToken && !forceRefresh) return backendAuthToken;
            if (backendAuthPromise && !forceRefresh) return backendAuthPromise;

            const profilePayload = (typeof window.getBackendProfilePayload === 'function')
                ? window.getBackendProfilePayload()
                : (currentUserData ? { name: currentUserData.name, mobile: currentUserData.mobile } : {});

            backendAuthPromise = currentUser.getIdToken(forceRefresh)
                .then(idToken => fetchWithTimeout(`${BACKEND_BASE_URL}/api/session/firebase`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idToken,
                        profile: profilePayload
                    })
                }, 7000))
                .then(async res => {
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data.ok || !data.token) {
                        throw new Error(data.error || 'Backend session failed');
                    }
                    backendAuthToken = data.token;
                    return backendAuthToken;
                })
                .finally(() => {
                    backendAuthPromise = null;
                });

            return backendAuthPromise;
        };

const hasCachedLoginSession = () => !!getCachedSessionUserId();

const handleAuth = async (e) => {
            e.preventDefault();

            // Get button elements
            const authButton = document.getElementById('auth-button');
            const buttonText = authButton.querySelector('.button-text');
            const loader = authButton.querySelector('.loader');

            // --- Show loading spinner ---
            authButton.disabled = true;
            buttonText.classList.add('hidden');
            loader.classList.remove('hidden');

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const name = document.getElementById('name').value;
            const mobile = normalizePhoneDigits(document.getElementById('mobile').value);
            document.getElementById('auth-error').textContent = '';

            try {
                await setPersistence(auth, browserLocalPersistence);
                if (e.target.dataset.authMode === 'login') {
                    sessionStorage.removeItem('rw_signup_in_progress');
                    const cred = await signInWithEmailAndPassword(auth, email, password);

                    // Check if user is banned
                    const userDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/users`, cred.user.uid));
                    if (userDoc.exists() && (isUserApprovalPending(userDoc.data()) || isUserApprovalRejected(userDoc.data()))) {
                        currentUser = cred.user;
                        currentUserData = { uid: cred.user.uid, id: cred.user.uid, email: cred.user.email, ...userDoc.data() };
                        localStorage.setItem('lastLoggedInUser', cred.user.uid);
                        writeJsonCache(getUserCacheKey(cred.user.uid), sanitizeUserForCache(currentUserData, cred.user.uid));
                        showVerificationPendingPage(currentUserData);
                        return;
                    }
                    if (userDoc.exists() && userDoc.data().isFlagged) {
                        const data = userDoc.data();
                        if (data.banExpiry) {
                            const expiry = getBanExpiryDate(data.banExpiry);
                            // Check if ban has expired
                            if (expiry && new Date() < expiry) {
                                currentUser = cred.user;
                                currentUserData = { uid: cred.user.uid, id: cred.user.uid, email: cred.user.email, ...data };
                                showBlockedAccountPage(currentUserData);
                                return;
                            } else {
                                // Ban expired, auto-unflag
                                await updateDoc(userDoc.ref, {
                                    isFlagged: false,
                                    isDisabled: false,
                                    banReason: deleteField(),
                                    banExpiry: deleteField(),
                                    disabledAt: deleteField(),
                                    disabledBy: deleteField()
                                });
                            }
                        } else {
                            currentUser = cred.user;
                            currentUserData = { uid: cred.user.uid, id: cred.user.uid, email: cred.user.email, ...data };
                            showBlockedAccountPage(currentUserData);
                            return;
                        }
                    }
                } else {
                    if (!name || !mobile) {
                        throw new Error('Name and Mobile Number are required.');
                    }
                    if (!/^\d{10}$/.test(mobile)) {
                        throw new Error('Mobile number must be exactly 10 digits.');
                    }
                    const referralCodeInput = document.getElementById('referral_code') || document.getElementById('referral-code');
                    const referralCode = referralCodeInput ? referralCodeInput.value.trim() : '';
                    if (!referralCode) {
                        throw new Error('Referral code is mandatory.');
                    }

                    // Verify referral code validity strictly
                    let parentAdmin = ADMIN_UID;
                    let referredBy = null;

                    const referralCodeUpper = referralCode.toUpperCase().trim();
                    if (referralCodeUpper === 'RWADMIN182488' || referralCodeUpper === 'RWADMIN01' || referralCodeUpper === 'RWADMIN02') {
                        parentAdmin = ADMIN_UID;
                        referredBy = null;
                    } else {
                        let referrerData = null;

                        // 1. Query Firestore for user or sub-admin matching this referral code
                        try {
                            const possibleCodes = [referralCodeUpper, referralCode.trim()];
                            const q1 = query(
                                collection(db, `artifacts/${appId}/public/data/users`),
                                where("referralCode", "in", possibleCodes)
                            );
                            const snap1 = await getDocs(q1);
                            if (!snap1.empty) {
                                referrerData = { id: snap1.docs[0].id, ...snap1.docs[0].data() };
                            } else {
                                const q2 = query(
                                    collection(db, `artifacts/${appId}/public/data/users`),
                                    where("referral_code", "in", possibleCodes)
                                );
                                const snap2 = await getDocs(q2);
                                if (!snap2.empty) {
                                    referrerData = { id: snap2.docs[0].id, ...snap2.docs[0].data() };
                                }
                            }
                        } catch (err) {
                            console.warn("Firestore referral code lookup failed:", err);
                        }

                        // 2. Fallback to allUsersCache or computed seed matching
                        if (!referrerData && typeof allUsersCache !== 'undefined' && Array.isArray(allUsersCache)) {
                            const matched = allUsersCache.find(u => {
                                const uCode = String(u.referralCode || u.referral_code || u.myReferralCode || u.refCode || u.inviteCode || '').trim().toUpperCase();
                                if (uCode === referralCodeUpper) return true;
                                const rawSeed = String(u.mobile || u.uid || u.id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                                const computedCode = `RW${rawSeed.slice(-6)}`;
                                return computedCode === referralCodeUpper;
                            });
                            if (matched) {
                                referrerData = { id: matched.id || matched.uid, ...matched };
                            }
                        }

                        // 3. Fallback to backend API
                        if (!referrerData) {
                            try {
                                const response = await fetch(`${BACKEND_BASE_URL}/api/auth/verify-referral?code=${encodeURIComponent(referralCodeUpper)}`);
                                if (response.ok) {
                                    const resData = await response.json().catch(() => ({}));
                                    if (resData.ok && resData.exists && resData.referrer) {
                                        referrerData = resData.referrer;
                                    }
                                }
                            } catch (e) {}
                        }

                        // 4. STRICT CHECK: If referral code is not found, BLOCK SIGNUP IMMEDIATELY!
                        if (!referrerData) {
                            throw new Error('Invalid referral code! Please enter a valid Sub-Admin referral code to sign up.');
                        }

                        // Auto-repair referrer's referralCode in Firestore if missing
                        if (referrerData && (referrerData.id || referrerData.uid) && !referrerData.referralCode) {
                            const refUid = referrerData.id || referrerData.uid;
                            updateDoc(doc(db, `artifacts/${appId}/public/data/users`, refUid), {
                                referralCode: referralCodeUpper
                            }).catch(() => {});
                        }

                        // Always store the referrer's UID in referredBy for tracking
                        referredBy = referrerData.id || referrerData.uid;
                        const refRole = String(referrerData.role || '').toLowerCase();

                        if (refRole === 'admin' || refRole === 'subadmin' || refRole === 'owner') {
                            parentAdmin = referrerData.id || referrerData.uid;
                        } else {
                            parentAdmin = referrerData.parentAdmin || referrerData.parent_admin || ADMIN_UID;
                            
                            // If referrer user's parentAdmin is missing or ADMIN_UID, inspect referrer's parent chain recursively
                            if ((!parentAdmin || parentAdmin === ADMIN_UID) && referrerData.referredBy) {
                                try {
                                    const refParentDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/users`, referrerData.referredBy));
                                    if (refParentDoc.exists()) {
                                        const pData = refParentDoc.data();
                                        const pAdmin = pData.parentAdmin || pData.parent_admin;
                                        if (pAdmin) parentAdmin = pAdmin;
                                    }
                                } catch (e) {}
                            }
                        }
                    }

                    const existingMobileUser = await findExistingUserByMobile(mobile);
                    if (existingMobileUser) {
                        throw new Error('This mobile number is already registered. Please use another number.');
                    }
                    localSignupApprovalInProgress = true;
                    const cred = await createUserWithEmailAndPassword(auth, email, password);
                    
                    // Generate new unique 6-character referral code
                    const generateReferralCode = () => {
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                        let code = '';
                        for (let i = 0; i < 6; i++) {
                            code += chars.charAt(Math.floor(Math.random() * chars.length));
                        }
                        return code;
                    };
                    const userReferralCode = generateReferralCode();

                    const pendingUserData = {
                        uid: cred.user.uid,
                        email: cred.user.email,
                        name,
                        mobile,
                        phoneNumber: mobile,
                        paymentMethod: '',
                        paymentDetails: {},
                        balance: 0,
                        approvalStatus: 'pending',
                        signupApprovalStatus: 'pending',
                        accountStatus: 'pending_approval',
                        isApproved: false,
                        signupSource: 'web',
                        webAppBuild: WEB_APP_BUILD,
                        webAppUpdatedOn: WEB_APP_UPDATE_DATE,
                        webAppLastSeenAt: serverTimestamp(),
                        signupRequestedAt: serverTimestamp(),
                        createdAt: serverTimestamp(),
                        role: 'user',
                        status: 'active',
                        parentAdmin,
                        parent_admin: parentAdmin,
                        referredBy,
                        referralCode: userReferralCode,
                        usedReferralCode: referralCodeUpper,
                        referredByCode: referralCodeUpper
                    };
                    await setDoc(doc(db, `artifacts/${appId}/public/data/users`, cred.user.uid), pendingUserData, { merge: true });
                    currentUser = cred.user;
                    currentUserData = {
                        ...pendingUserData,
                        signupRequestedAt: Date.now(),
                        createdAt: Date.now()
                    };
                    localStorage.setItem('lastLoggedInUser', cred.user.uid);
                    writeJsonCache(getUserCacheKey(cred.user.uid), sanitizeUserForCache(currentUserData, cred.user.uid));

                    // Send push notification to target admin/subadmin for approval & referrer user
                    if (typeof window.sendNotification === 'function') {
                        const targetAdmin = parentAdmin || ADMIN_UID;
                        window.sendNotification(
                            targetAdmin,
                            'New User Registration Approval',
                            `User ${name} (${mobile}) registered with referral code ${referralCode}. Click to review and approve.`,
                            { type: 'user_approval', userId: cred.user.uid }
                        ).catch(e => console.warn('Referral signup push notification error:', e));

                        if (referredBy && referredBy !== ADMIN_UID) {
                            const maskMobileForNotification = (mob) => {
                                const clean = String(mob || '').trim();
                                const digitsOnly = clean.replace(/\D/g, '');
                                if (digitsOnly.length >= 10) {
                                    const last10 = digitsOnly.slice(-10);
                                    const prefix = clean.startsWith('+91') ? '+91 ' : (clean.length > 10 ? clean.slice(0, clean.length - 10) + ' ' : '');
                                    return `${prefix}${last10.slice(0, 3)}***${last10.slice(-2)}`;
                                }
                                return clean;
                            };
                            const maskedMob = maskMobileForNotification(mobile);
                            window.sendNotification(
                                referredBy,
                                '👤 New Referral Registered!',
                                `${name} (${maskedMob}) has registered using your referral link!`
                            ).catch(e => console.warn('Referrer registration push notification error:', e));
                        }
                    }

                    showVerificationPendingPage(currentUserData);
                    setTimeout(() => initializeUserListeners(cred.user.uid), 100);
                    localSignupApprovalInProgress = false;
                    return;
                }
            } catch (error) {
                localSignupApprovalInProgress = false;
                document.getElementById('auth-error').textContent = error.message;
                console.error("Auth failed:", error);

                // --- THIS IS IMPORTANT: Hide spinner on error ---
                authButton.disabled = false;
                buttonText.classList.remove('hidden');
                loader.classList.add('hidden');
            }
        };

const toggleAuthMode = () => {
            const form = document.getElementById('auth-form');
            const isLogin = form.dataset.authMode === 'signup';
            form.dataset.authMode = isLogin ? 'login' : 'signup';
            form.classList.toggle('signup-mode', !isLogin);
            document.getElementById('auth-error').textContent = '';
            form.reset();
            document.getElementById('auth-title').textContent = isLogin ? 'Login to your Wallet' : 'Create a New Wallet';
            document.getElementById('forgot-password-row')?.classList.toggle('hidden', !isLogin);

            // Get button elements
            const authButton = document.getElementById('auth-button');
            const buttonText = authButton.querySelector('.button-text');
            const loader = authButton.querySelector('.loader');

            // Set the new button text
            buttonText.textContent = isLogin ? 'Login' : 'Sign Up';

            // Reset the button to its normal state
            authButton.disabled = false;
            buttonText.classList.remove('hidden');
            loader.classList.add('hidden');

            document.getElementById('auth-prompt').textContent = isLogin ? "Don't have an account? " : 'Already have an account? ';
            document.getElementById('auth-toggle').textContent = isLogin ? 'Sign Up' : 'Login';
        };

// Expose functions to window for global access
window.getBackendAuthToken = getBackendAuthToken;
window.hasCachedLoginSession = hasCachedLoginSession;
window.handleAuth = handleAuth;
window.toggleAuthMode = toggleAuthMode;

window.debugQueryReferralCode = async (code) => {
    console.log("=== Debugging Referral Code ===", code);
    try {
        const appId = window.appId || 'digital-wallet-prod';
        console.log("appId is:", appId);
        
        const possibleCodes = [code, code.toUpperCase(), code.toLowerCase()];
        const uniqueCodes = [...new Set(possibleCodes)];
        
        console.log("Checking in collection:", `artifacts/${appId}/public/data/users`);
        
        const q1 = query(
            collection(db, `artifacts/${appId}/public/data/users`),
            where("referralCode", "in", uniqueCodes)
        );
        const snap1 = await getDocs(q1);
        console.log(`Query by referralCode found ${snap1.size} docs:`);
        snap1.forEach(doc => {
            console.log(`Doc ID: ${doc.id}, Data:`, doc.data());
        });

        const q2 = query(
            collection(db, `artifacts/${appId}/public/data/users`),
            where("referral_code", "in", uniqueCodes)
        );
        const snap2 = await getDocs(q2);
        console.log(`Query by referral_code found ${snap2.size} docs:`);
        snap2.forEach(doc => {
            console.log(`Doc ID: ${doc.id}, Data:`, doc.data());
        });
        
        const q3 = query(
            collection(db, `artifacts/${appId}/public/data/users`),
            where("role", "==", "admin")
        );
        const snap3 = await getDocs(q3);
        console.log(`Query for all admins found ${snap3.size} docs:`);
        snap3.forEach(doc => {
            console.log(`Doc ID: ${doc.id}, Data:`, doc.data());
        });

    } catch (e) {
        console.error("Debug query failed:", e);
    }
};
