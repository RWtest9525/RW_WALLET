// File: src/pages/auth.js

const getBackendAuthToken = async (forceRefresh = false) => {
            if (!currentUser) throw new Error('Login required');
            if (backendAuthToken && !forceRefresh) return backendAuthToken;
            if (backendAuthPromise && !forceRefresh) return backendAuthPromise;

            backendAuthPromise = currentUser.getIdToken(forceRefresh)
                .then(idToken => fetchWithTimeout(`${BACKEND_BASE_URL}/api/session/firebase`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idToken,
                        profile: getBackendProfilePayload()
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

                    // Verify referral code validity
                    let parentAdmin = ADMIN_UID;
                    let referredBy = null;

                    if (referralCode.toUpperCase().startsWith('RWADMIN')) {
                        // Check if admin exists in Firestore users
                        const adminQ = query(
                            collection(db, `artifacts/${appId}/public/data/users`),
                            where("role", "==", "admin"),
                            where("referralCode", "==", referralCode.toUpperCase())
                        );
                        const adminSnap = await getDocs(adminQ);
                        if (adminSnap.empty && referralCode.toUpperCase() !== 'RWADMIN01' && referralCode.toUpperCase() !== 'RWADMIN02') {
                            throw new Error('Invalid Admin referral code.');
                        }
                        if (!adminSnap.empty) {
                            parentAdmin = adminSnap.docs[0].id;
                        } else {
                            parentAdmin = ADMIN_UID;
                        }
                    } else {
                        // Check if user exists in Firestore users
                        const userQ = query(
                            collection(db, `artifacts/${appId}/public/data/users`),
                            where("referralCode", "==", referralCode)
                        );
                        const userSnap = await getDocs(userQ);
                        if (userSnap.empty) {
                            throw new Error('Invalid user referral code. Please check and try again.');
                        }
                        const referrerDoc = userSnap.docs[0];
                        const referrerData = referrerDoc.data();
                        referredBy = referrerDoc.id;
                        parentAdmin = referrerData.parentAdmin || referrerData.parent_admin || ADMIN_UID;
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
                        referralCode: userReferralCode
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
                    if (typeof sendNotification === 'function') {
                        const targetAdmin = parentAdmin || ADMIN_UID;
                        sendNotification(
                            targetAdmin,
                            'New User Registration Approval',
                            `User ${name} (${mobile}) registered with referral code ${referralCodeInput}. Click to review and approve.`,
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
                            sendNotification(
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
