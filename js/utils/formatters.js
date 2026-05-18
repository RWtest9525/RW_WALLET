// --- UI UTILS ---
export const showLoading = () => {
    document.getElementById('loading-overlay').classList.remove('hidden');
};

export const hideLoading = () => {
    document.getElementById('loading-overlay').classList.add('hidden');
};

export const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

export const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const date = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const time = d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    return `${date} ${time}`;
};

export const formatDateDDMMYY = (timestamp) => {
    if (!timestamp) return 'N/A';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const time = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    return `${dd}/${mm}/${yy} ${time}`;
};

export const getTimeFromTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

export const maskMobile = (mobile) => {
    if (!mobile || mobile.length < 10) return '******';
    return mobile.substring(0, 3) + '****' + mobile.substring(7);
};

export const maskUpi = (upiId) => {
    if (!upiId) return '******';
    const atIndex = upiId.indexOf('@');
    if (atIndex <= 2) return '****' + upiId.substring(atIndex);
    return upiId.substring(0, 2) + '****' + upiId.substring(atIndex);
};

export const generateTransactionId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `TXN${timestamp}${random}`.toUpperCase();
};

// Sound functions
export const playSuccessSound = () => {
    const audio = document.getElementById('success-sound');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio play failed:", e));
    }
};

export const playErrorSound = () => {
    const audio = document.getElementById('error-sound');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio play failed:", e));
    }
};
