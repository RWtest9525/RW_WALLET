import { auth, db, appId, ADMIN_UID } from '../core/firebase.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    deleteField, 
    serverTimestamp,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { hideLoading, showNotification } from '../ui/components.js';
import { 
    setCurrentUser, 
    setCurrentUserData, 
    setAllUsersCache, 
    setAllFundRequestsCache, 
    setUnifiedHistoryCache 
} from '../core/state.js';

export const handleAuth = async (e) => {
    e.preventDefault();
    const authButton = document.getElementById('auth-button');
    const buttonText = authButton.querySelector('.button-text');
    const loader = authButton.querySelector('.loader');

    authButton.disabled = true;
    buttonText.classList.add('hidden');
    loader.classList.remove('hidden');

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value;
    const mobile = document.getElementById('mobile').value;
    document.getElementById('auth-error').textContent = '';

    try {
        if (e.target.dataset.authMode === 'signup') {
            if (!name || !mobile) throw new Error('Name and Mobile Number are required.');
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, `artifacts/${appId}/public/data/users`, cred.user.uid), {
                uid: cred.user.uid,
                email: cred.user.email,
                name,
                mobile,
                paymentMethod: '',
                paymentDetails: {},
                balance: 0,
                createdAt: serverTimestamp()
            });
        } else {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            const userDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/users`, cred.user.uid));
            if (userDoc.exists() && userDoc.data().isFlagged) {
                const data = userDoc.data();
                let banMsg = `Your account has been suspended.\nReason: ${data.banReason || 'No reason specified.'}`;
                if (data.banExpiry) {
                    const expiry = data.banExpiry.toDate();
                    if (new Date() < expiry) {
                        banMsg += `\nSuspension ends on: ${expiry.toLocaleString()}`;
                        await auth.signOut();
                        throw new Error(banMsg);
                    } else {
                        await updateDoc(userDoc.ref, { isFlagged: false, banReason: deleteField(), banExpiry: deleteField() });
                    }
                } else {
                    banMsg += `\nThis is a permanent suspension.`;
                    await auth.signOut();
                    throw new Error(banMsg);
                }
            }
        }
    } catch (error) {
        let friendlyMessage = error.message;
        if (error.code === 'auth/user-not-found') friendlyMessage = "No account found with this email.";
        if (error.code === 'auth/wrong-password') friendlyMessage = "Incorrect password.";
        document.getElementById('auth-error').textContent = friendlyMessage;
        authButton.disabled = false;
        buttonText.classList.remove('hidden');
        loader.classList.add('hidden');
    }
};

export const toggleAuthMode = () => {
    const form = document.getElementById('auth-form');
    const isLogin = form.dataset.authMode === 'signup';
    form.dataset.authMode = isLogin ? 'login' : 'signup';
    form.classList.toggle('signup-mode', !isLogin);
    document.getElementById('auth-error').textContent = '';
    form.reset();
    document.getElementById('auth-title').textContent = isLogin ? 'Access your Account' : 'Create Secure Account';
    const authButton = document.getElementById('auth-button');
    const buttonText = authButton.querySelector('.button-text');
    const loader = authButton.querySelector('.loader');
    buttonText.textContent = isLogin ? 'Login' : 'Sign Up';
    authButton.disabled = false;
    buttonText.classList.remove('hidden');
    loader.classList.add('hidden');
    document.getElementById('auth-prompt').textContent = isLogin ? "Don't have an account? " : 'Already have an account? ';
    document.getElementById('auth-toggle').textContent = isLogin ? 'Sign Up' : 'Login';
};

export const handleLogout = async () => {
    try {
        await signOut(auth);
        showNotification('Logged out successfully');
    } catch (error) {
        console.error("Logout error:", error);
    }
};

export const handleForgotPassword = async () => {
    const email = document.getElementById('reset-email-input').value.trim();
    const errorElement = document.getElementById('reset-error');
    if (!email) {
        errorElement.textContent = 'Please enter your email address';
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        showNotification('Password reset email sent! Check your inbox.');
        if (window.closeForgotPasswordModal) window.closeForgotPasswordModal();
    } catch (error) {
        errorElement.textContent = error.message;
    }
};
