// File: src/pages/profile.js

const applyTheme = (theme) => {
            // Force light theme
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');

            const lightIcon = document.getElementById('settings-theme-icon-light');
            const darkIcon = document.getElementById('settings-theme-icon-dark');

            if (lightIcon && darkIcon) {
                lightIcon.classList.remove('hidden');
                darkIcon.classList.add('hidden');
            }
        };

const toggleTheme = () => {
            applyTheme('light');
        };

const getProfileAvatarUrl = (user) => {
            if (!user) return PREMIUM_AVATARS[0];
            const localAvatar = localStorage.getItem(`rw_profile_avatar_${user.uid || user.id || ''}`);
            if (localAvatar) return localAvatar;
            
            // 1. Admin always uses the app logo
            const uId = user.uid || user.id || '';
            if (uId === ADMIN_UID || uId === 'admin' || user.email === 'admin@gmail.com') {
                return 'https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg';
            }
            
            // 2. If user has chosen a profile photo, return it
            if (user.profilePhoto || user.profile_photo || user.avatarUrl || user.avatar_url) {
                return user.profilePhoto || user.profile_photo || user.avatarUrl || user.avatar_url;
            }
            
            // 3. Fallback: Determine default based on name (male or female)
            const name = String(user.name || user.userName || user.email || '').toLowerCase().trim();
            
            // Common female name keywords, endings, or prefixes
            const femaleKeywords = [
                'devi', 'kumari', 'lata', 'seema', 'anita', 'sunita', 'kiran', 'pooja', 'priya', 'neha', 'divya',
                'kajal', 'jyoti', 'kavita', 'preeti', 'ritu', 'swati', 'sneha', 'alka', 'usha', 'shanti', 'meena',
                'sushma', 'rekha', 'pinky', 'monika', 'payal', 'asha', 'babita', 'radha', 'sharda', 'mamta', 'sapna',
                'isha', 'tanya', 'riya', 'ananya', 'rashmi', 'shruti', 'komal', 'arti', 'renu', 'savita', 'geeta',
                'sita', 'gita', 'anamika', 'archana', 'disha', 'megha', 'nisha', 'prerna', 'richa', 'shweta', 'sheetal',
                'sakshi', 'simran', 'tanvi', 'vaishali', 'varsha', 'yashaswi', 'girl', 'female', 'woman', 'lady'
            ];
            
            const isFemale = femaleKeywords.some(kw => name.includes(kw)) ||
                             name.endsWith('a') || name.endsWith('i') || name.endsWith('ee') || name.endsWith('ya') || name.endsWith('y');
            
            if (isFemale) {
                const femaleAvatars = PREMIUM_AVATARS.slice(5, 10);
                const charSum = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
                return femaleAvatars[charSum % femaleAvatars.length];
            } else {
                const maleAvatars = PREMIUM_AVATARS.slice(0, 5);
                const charSum = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
                return maleAvatars[charSum % maleAvatars.length];
            }
        };

const getBackendProfilePayload = () => ({
            name: currentUserData?.name || currentUser?.displayName || '',
            mobile: currentUserData?.mobile || '',
            phoneNumber: currentUserData?.mobile || ''
        });

const getProfilePaymentDetails = (method, data = currentUserData || {}) => {
            const details = data.paymentDetails && typeof data.paymentDetails === 'object' ? { ...data.paymentDetails } : {};
            if (method === 'upi') {
                return {
                    ...details,
                    upiId: details.upiId || data.upiId || (typeof data.paymentDetails === 'string' ? data.paymentDetails : '')
                };
            }
            if (method === 'bank') {
                return {
                    ...details,
                    accountNumber: details.accountNumber || data.accountNumber || '',
                    ifsc: details.ifsc || data.ifsc || '',
                    bankName: details.bankName || data.bankName || '',
                    accountName: details.accountName || data.accountName || ''
                };
            }
            if (['play_store', 'amazon_gift', 'flipkart_gift', 'paypal'].includes(method)) {
                const stringDetails = typeof data.paymentDetails === 'string' ? data.paymentDetails : '';
                return {
                    ...details,
                    email: details.email || data.paymentEmail || (stringDetails.includes('@') ? stringDetails : '')
                };
            }
            return details;
        };

const normalizeProfilePaymentMethod = (data = currentUserData || {}) => {
            const rawMethod = String(
                data.paymentMethod ||
                data.payment_method ||
                data.selectedPaymentMethod ||
                data.withdrawalMethod ||
                data.withdrawMethod ||
                data.withdraw_method ||
                data.methodId ||
                data.method ||
                ''
            )
                .trim()
                .toLowerCase()
                .replace(/[\s-]+/g, '_');
            const methodAliases = {
                upi: 'upi',
                upi_id: 'upi',
                bank: 'bank',
                bank_account: 'bank',
                account: 'bank',
                play_store: 'play_store',
                playstore: 'play_store',
                redeem_code: 'play_store',
                amazon: 'amazon_gift',
                amazon_gift: 'amazon_gift',
                amazon_gift_card: 'amazon_gift',
                flipkart: 'flipkart_gift',
                flipkart_gift: 'flipkart_gift',
                flipkart_gift_card: 'flipkart_gift',
                paypal: 'paypal'
            };
            if (methodAliases[rawMethod]) return methodAliases[rawMethod];
            if (rawMethod.includes('upi')) return 'upi';
            if (rawMethod.includes('bank') || rawMethod.includes('account')) return 'bank';
            if (rawMethod.includes('play')) return 'play_store';
            if (rawMethod.includes('amazon')) return 'amazon_gift';
            if (rawMethod.includes('flipkart')) return 'flipkart_gift';
            if (rawMethod.includes('paypal')) return 'paypal';

            const details = data.paymentDetails && typeof data.paymentDetails === 'object' ? data.paymentDetails : {};
            const stringDetails = typeof data.paymentDetails === 'string' ? data.paymentDetails : '';
            if (details.upiId || data.upiId) return 'upi';
            if (details.accountNumber || details.ifsc || data.accountNumber || data.ifsc) return 'bank';
            if (details.email || data.paymentEmail || stringDetails.includes('@')) return 'paypal';
            return '';
        };

const getRawProfilePaymentMethod = (data = currentUserData || {}) =>
            data.paymentMethod || data.payment_method || data.selectedPaymentMethod || data.withdrawalMethod ||
            data.withdrawMethod || data.withdraw_method || data.methodId || data.method || '';

const getProfilePaymentMethodLabel = (method, data = currentUserData || {}) => ({
            upi: 'UPI ID',
            bank: 'Bank Account',
            play_store: 'Play Store Redeem Code',
            amazon_gift: 'Amazon Gift Card',
            flipkart_gift: 'Flipkart Gift Card',
            paypal: 'PayPal',
            crypto: 'Crypto Currency'
        }[method] || toTitleText(getRawProfilePaymentMethod(data)) || 'Payment Method');

const syncProfilePhotoToDatabase = async (chosenUrl) => {
    showNotification('Updating profile photo...', false);
    try {
        localStorage.setItem(`rw_profile_avatar_${currentUser.uid}`, chosenUrl);
        currentUserData = { ...(currentUserData || {}), profilePhoto: chosenUrl };
        writeJsonCache(getUserCacheKey(currentUser.uid), sanitizeUserForCache(currentUserData, currentUser.uid));

        const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
        await updateDoc(userRef, { profilePhoto: chosenUrl });

        // Update settings preview if open
        const settingsPreview = document.getElementById('settings-avatar-preview');
        if (settingsPreview) settingsPreview.src = chosenUrl;

        // Update profile preview if open
        const profilePreview = document.getElementById('profile-avatar-preview');
        if (profilePreview) {
            profilePreview.src = chosenUrl;
            const urlInput = document.getElementById('profile-avatar-url');
            if (urlInput) urlInput.value = chosenUrl;
        }

        showNotification('Profile photo updated successfully!');
    } catch (e) {
        console.error('Update photo failed:', e);
        const errMsg = String(e?.message || '');
        if (/resource-exhausted|quota exceeded/i.test(errMsg)) {
            showNotification('Database daily quota exceeded. Please try again later.', true);
        } else {
            showNotification('Failed to update profile photo.', true);
        }
    }
};

const showCropperModal = (imageSrc, onSelect) => {
    const cropperHtml = `
        <div class="space-y-4 text-left">
            <p class="text-xs font-semibold text-gray-500">Drag image to position, use slider to zoom.</p>
            <div class="relative w-full aspect-square bg-slate-950 overflow-hidden rounded-2xl flex items-center justify-center select-none" id="cropper-container" style="height: 280px;">
                <img id="cropper-img" src="${imageSrc}" class="absolute max-w-none origin-center cursor-move" style="transform: translate(0px, 0px) scale(1);" draggable="false">
                <div class="absolute pointer-events-none inset-0 border-[40px] border-black/60 flex items-center justify-center">
                    <div class="w-[200px] h-[200px] rounded-full border border-dashed border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]" id="cropper-circle"></div>
                </div>
            </div>
            <div class="space-y-1">
                <div class="flex justify-between text-[11px] font-black text-gray-400 uppercase">
                    <span>Zoom</span>
                    <span id="zoom-value">100%</span>
                </div>
                <input type="range" id="cropper-zoom" min="0.5" max="3" step="0.05" value="1" class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600">
            </div>
        </div>
    `;

    renderModal('Crop Profile Photo', cropperHtml, `
        <div class="flex gap-2 w-full">
            <button id="cropper-cancel-btn" class="flex-1 rounded-xl bg-gray-100 dark:bg-gray-700 py-3 text-sm font-extrabold text-gray-700 dark:text-gray-200">Cancel</button>
            <button id="cropper-save-btn" class="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-sm font-black shadow-md">Crop & Save</button>
        </div>
    `, 'max-w-md');

    const img = document.getElementById('cropper-img');
    const container = document.getElementById('cropper-container');
    const zoomInput = document.getElementById('cropper-zoom');
    const zoomValText = document.getElementById('zoom-value');
    const circle = document.getElementById('cropper-circle');

    let currentX = 0;
    let currentY = 0;
    let scale = 1;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    img.onload = () => {
        const minDim = Math.min(img.naturalWidth, img.naturalHeight);
        if (minDim > 0) {
            const initialScale = 240 / minDim;
            scale = Math.max(0.5, Math.min(3, initialScale));
            zoomInput.value = scale;
            zoomValText.textContent = Math.round(scale * 100) + '%';
        }
        currentX = 0;
        currentY = 0;
        img.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
    };

    zoomInput.oninput = function() {
        scale = Number(this.value);
        zoomValText.textContent = Math.round(scale * 100) + '%';
        img.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
    };

    const startDrag = (clientX, clientY) => {
        isDragging = true;
        startX = clientX - currentX;
        startY = clientY - currentY;
    };

    const doDrag = (clientX, clientY) => {
        if (!isDragging) return;
        currentX = clientX - startX;
        currentY = clientY - startY;
        img.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
    };

    const stopDrag = () => {
        isDragging = false;
    };

    container.onmousedown = (e) => startDrag(e.clientX, e.clientY);
    window.onmousemove = (e) => doDrag(e.clientX, e.clientY);
    window.onmouseup = () => stopDrag();

    container.ontouchstart = (e) => {
        if (e.touches.length === 1) {
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
    };
    window.ontouchmove = (e) => {
        if (isDragging && e.touches.length === 1) {
            doDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
    };
    window.ontouchend = () => stopDrag();

    document.getElementById('cropper-cancel-btn').onclick = () => {
        window.closeModal();
    };

    document.getElementById('cropper-save-btn').onclick = () => {
        showNotification('Cropping image...', false);
        try {
            const cropRect = circle.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();

            const scaleX = img.naturalWidth / imgRect.width;
            const scaleY = img.naturalHeight / imgRect.height;

            const sx = (cropRect.left - imgRect.left) * scaleX;
            const sy = (cropRect.top - imgRect.top) * scaleY;
            const sWidth = cropRect.width * scaleX;
            const sHeight = cropRect.height * scaleY;

            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            ctx.beginPath();
            ctx.arc(128, 128, 128, 0, Math.PI * 2);
            ctx.clip();

            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, 256, 256);

            const croppedUrl = canvas.toDataURL('image/jpeg', 0.88);
            window.closeModal();
            onSelect(croppedUrl);
        } catch (e) {
            console.error('Crop failed:', e);
            showNotification('Could not crop image. Make sure it is fully loaded.', true);
        }
    };
};

window.showProfilePhotoSelectionModal = (currentAvatar, onSelect) => {
    const modalGridHtml = `
        <div class="space-y-4 text-left">
            <p class="text-xs font-black uppercase text-gray-400 tracking-wider">Select Premium Avatar</p>
            <div class="grid grid-cols-5 gap-2.5">
                ${PREMIUM_AVATARS.map((url, idx) => {
                    const isSelected = url === currentAvatar;
                    return `
                    <div class="avatar-modal-option relative cursor-pointer aspect-square rounded-2xl overflow-hidden border-2 ${isSelected ? 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-50 dark:bg-orange-950/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'} p-0.5 transition duration-200" data-avatar-url="${escapeHtml(url)}">
                        <img src="${escapeHtml(url)}" alt="Avatar ${idx + 1}" class="w-full h-full object-cover rounded-xl bg-gray-50">
                        ${isSelected ? '<div class="absolute bottom-1 right-1 h-4 w-4 bg-orange-500 rounded-full flex items-center justify-center text-[9px] font-black text-white">✓</div>' : ''}
                    </div>`;
                }).join('')}
            </div>
            
            <div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2">
                <button type="button" id="upload-custom-avatar-btn" class="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-sm font-black transition shadow-md active:scale-98">
                    📁 Upload Custom Photo
                </button>
                <input type="file" id="custom-avatar-file-input" accept="image/*" class="hidden">
            </div>
        </div>
    `;

    renderModal('Choose Avatar', modalGridHtml, `
        <button onclick="window.closeModal()" class="w-full rounded-xl bg-gray-100 dark:bg-gray-700 py-3 text-sm font-extrabold text-gray-700 dark:text-gray-200">Cancel</button>
    `, 'max-w-md');

    document.querySelectorAll('.avatar-modal-option').forEach(opt => {
        opt.onclick = () => {
            const chosenUrl = opt.getAttribute('data-avatar-url');
            window.closeModal();
            onSelect(chosenUrl);
        };
    });

    const uploadBtn = document.getElementById('upload-custom-avatar-btn');
    const fileInput = document.getElementById('custom-avatar-file-input');
    if (uploadBtn && fileInput) {
        uploadBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showNotification('Please select an image file.', true);
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                window.closeModal();
                showCropperModal(event.target.result, onSelect);
            };
            reader.readAsDataURL(file);
        };
    }
};

const showProfilePage = (focusMethod = '') => {
            if (!currentUserData) return showNotification('User data not loaded. Please wait.', true);
            const isAdminProfile = currentUser?.uid === ADMIN_UID || currentUserData?.role === 'admin' || currentUserData?.role === 'owner';
            const websiteLinks = Array.isArray(currentUserData.websiteLinks) ? currentUserData.websiteLinks.slice(0, 3) : [];
            const activePaymentMethod = focusMethod || normalizeProfilePaymentMethod(currentUserData);

            const currentAvatar = getProfileAvatarUrl(currentUserData);

            let avatarGridHtml = '';
            if (!isAdminProfile) {
                avatarGridHtml = `
                <div class="flex flex-col items-center justify-center py-4 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-150 dark:border-gray-800">
                    <div class="relative cursor-pointer group" id="profile-avatar-trigger-btn">
                        <img id="profile-avatar-preview" src="${escapeHtml(currentAvatar)}" class="h-24 w-24 rounded-full border-4 border-white dark:border-gray-700 shadow-md object-cover bg-white">
                        <div class="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200">
                            <span class="text-[10px] font-black text-white uppercase tracking-wider">Change</span>
                        </div>
                        <div class="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 text-white shadow-sm border border-white dark:border-gray-700">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                        </div>
                    </div>
                    <p class="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Tap photo to choose avatar</p>
                    <input type="hidden" id="profile-avatar-url" value="${escapeHtml(currentAvatar)}">
                </div>`;
            } else {
                avatarGridHtml = `
                <div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/60 p-4 rounded-2xl border border-gray-150 dark:border-gray-800 text-left">
                    <img src="${escapeHtml(currentAvatar)}" class="h-12 w-12 rounded-xl border border-gray-200 dark:border-gray-755 shrink-0 bg-white p-1">
                    <div>
                        <h4 class="text-sm font-extrabold text-gray-850 dark:text-white">${escapeHtml(currentUserData.name || 'Admin')}</h4>
                        <p class="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">${escapeHtml(currentUserData.mobile || currentUserData.phoneNumber || currentUserData.email || '')}</p>
                    </div>
                </div>`;
            }

            const paymentMethods = [
                { value: '', label: 'Select Payment Method' },
                { value: 'upi', label: 'UPI ID' },
                { value: 'bank', label: 'Bank Account' },
                { value: 'play_store', label: 'Play Store Redeem Code' },
                { value: 'amazon_gift', label: 'Amazon Gift Card' },
                { value: 'flipkart_gift', label: 'Flipkart Gift Card' },
                { value: 'paypal', label: 'PayPal' },
                { value: 'crypto', label: 'Crypto Currency (Coming Soon)', disabled: true }
            ];

            const paymentOptions = paymentMethods.map(method =>
                `<option value="${method.value}" ${method.disabled ? 'disabled' : ''} ${activePaymentMethod === method.value ? 'selected' : ''}>${method.label}</option>`
            ).join('');

            let paymentDetailsForm = '';
            if (activePaymentMethod) {
                paymentDetailsForm = renderPaymentDetailsForm(activePaymentMethod, getProfilePaymentDetails(activePaymentMethod));
            }
            const savedPaymentSummary = activePaymentMethod ? getProfilePaymentSummaryText(activePaymentMethod) : '';
            const isPaymentMethodSaved = activePaymentMethod && !!savedPaymentSummary.trim();
            const savedPaymentCard = isPaymentMethodSaved ? `
                    <div class="rounded-xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
                        <p class="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-300">Saved Payment Method</p>
                        <p class="mt-1 text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(getProfilePaymentMethodLabel(activePaymentMethod, currentUserData))}</p>
                        ${savedPaymentSummary ? `<p class="mt-1 text-sm text-gray-600 dark:text-gray-300 break-words">${escapeHtml(savedPaymentSummary)}</p>` : ''}
                        <button type="button" id="delete-payment-method-btn" class="mt-3 w-full rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm font-bold text-red-600 dark:text-red-200">Delete payment method</button>
                    </div>` : '';
            const paymentMethodControl = isPaymentMethodSaved ? `
                    <input type="hidden" id="profile-payment-method" value="${escapeHtml(activePaymentMethod)}">` : `
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Method</label>
                        <select id="profile-payment-method" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
                            ${paymentOptions}
                        </select>
                    </div>`;

            const content = `
                ${getPageHeader('My Profile')}
                <div class="max-w-lg mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
                    ${avatarGridHtml}
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Email Address</label>
                        <input type="email" value="${escapeHtml(currentUserData.email || '')}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg cursor-not-allowed" readonly>
                    </div>
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name</label>
                        <input type="text" id="profile-name-input" value="${escapeHtml(currentUserData.name || '')}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div class="space-y-1">
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Mobile Number</label>
                        <input type="tel" id="profile-mobile-input" value="${escapeHtml(currentUserData.mobile || '')}" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    ${paymentMethodControl}
                    ${savedPaymentCard}
                    <div id="payment-details-container">
                        ${paymentDetailsForm}
                    </div>
                    ${isAdminProfile ? `
                    <div class="rounded-2xl border border-blue-100 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 p-4 space-y-3">
                        <div>
                            <p class="text-sm font-bold text-blue-900 dark:text-blue-100">Support Profile</p>
                            <p class="text-xs text-blue-600 dark:text-blue-300">Shown in chat profile details.</p>
                        </div>
                        <div class="space-y-1">
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">WhatsApp Number</label>
                            <input type="tel" id="profile-whatsapp-input" value="${escapeHtml(currentUserData.whatsappNumber || currentUserData.mobile || '')}" maxlength="15" placeholder="WhatsApp number" class="w-full px-4 py-3 bg-white dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div class="space-y-2">
                            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Website Links (optional, max 3)</label>
                            <div id="website-links-container" class="space-y-2">${renderWebsiteLinkInputs(websiteLinks)}</div>
                        </div>
                    </div>` : ''}
                    <button id="save-profile-btn" class="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition">Save Changes</button>
                </div>
                ${getPageFooter()}`;
            showPage(content);

            const paymentSelect = document.getElementById('profile-payment-method');
            if (paymentSelect?.tagName === 'SELECT') {
                paymentSelect.value = activePaymentMethod;
                paymentSelect.addEventListener('change', function () {
                    const method = this.value;
                    document.getElementById('payment-details-container').innerHTML = renderPaymentDetailsForm(method, getProfilePaymentDetails(method));
                });
            }

            document.getElementById('save-profile-btn').onclick = handleUpdateProfile;

            if (!isAdminProfile) {
                const triggerBtn = document.getElementById('profile-avatar-trigger-btn');
                if (triggerBtn) {
                    triggerBtn.onclick = () => {
                        const activeAvatar = document.getElementById('profile-avatar-url').value;
                        window.showProfilePhotoSelectionModal(activeAvatar, async (chosenUrl) => {
                            await syncProfilePhotoToDatabase(chosenUrl);
                        });
                    };
                }
            }
            document.getElementById('delete-payment-method-btn')?.addEventListener('click', async () => {
                if (!confirm('Delete saved payment method? You can add a new one after deleting it.')) return;
                try {
                    const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                    await updateDoc(userRef, {
                        paymentMethod: '',
                        paymentDetails: {},
                        upiId: deleteField(),
                        accountNumber: deleteField(),
                        ifsc: deleteField(),
                        bankName: deleteField(),
                        accountName: deleteField(),
                        paymentEmail: deleteField()
                    });
                    currentUserData = { ...(currentUserData || {}), paymentMethod: '', paymentDetails: {} };
                    ['upiId', 'accountNumber', 'ifsc', 'bankName', 'accountName', 'paymentEmail'].forEach(key => delete currentUserData[key]);
                    writeJsonCache(getUserCacheKey(currentUser.uid), sanitizeUserForCache(currentUserData, currentUser.uid));
                    showNotification('Payment method deleted. You can add a new one now.');
                    showProfilePage();
                } catch (error) {
                    console.error('Delete payment method failed:', error);
                    showNotification('Could not delete payment method.', true);
                }
            });
            bindWebsiteLinkControls();
            if (focusMethod) {
                if (paymentSelect) paymentSelect.value = focusMethod;
                document.getElementById('payment-details-container').innerHTML = renderPaymentDetailsForm(focusMethod, getProfilePaymentDetails(focusMethod));
                setTimeout(() => document.getElementById('payment-details-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
            }
        };

const showSettingsPage = () => {
            if (!ensureUserSessionReady()) return;
            const currentTheme = localStorage.getItem('theme') || 'light';
            const isAdmin = currentUser && currentUser.uid === ADMIN_UID;
            
            const userAvatarUrl = getProfileAvatarUrl(currentUserData);
            const userName = currentUserData?.name || 'User';
            const userEmail = currentUserData?.email || '';
            const profileCardHtml = `
                <div class="flex items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-150 dark:border-gray-700 text-left">
                    <div class="relative cursor-pointer group shrink-0" id="settings-avatar-trigger-btn">
                        <img id="settings-avatar-preview" src="${escapeHtml(userAvatarUrl)}" class="h-16 w-16 rounded-2xl border border-gray-200 dark:border-gray-750 bg-white p-1 object-cover" alt="Profile Photo">
                        ${!isAdmin ? `
                        <div class="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200">
                            <span class="text-[8px] font-black text-white uppercase tracking-wider">Edit</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="min-w-0 flex-1">
                        <h3 class="text-lg font-black text-gray-900 dark:text-white truncate">${escapeHtml(userName)}</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">${escapeHtml(userEmail)}</p>
                        <span class="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-[9px] font-black text-blue-600 dark:text-blue-300 uppercase mt-2">
                            ${isAdmin ? 'ADMIN' : 'MEMBER'}
                        </span>
                    </div>
                </div>`;

            const content = `
                ${getPageHeader('Setting', { showBack: false })}
                <div class="max-w-lg mx-auto space-y-4">
                    ${profileCardHtml}
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-3">
                        ${renderSettingAction('settings-profile-btn', 'My Profile', 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', 'blue')}
                        ${renderSettingAction('settings-track-income-btn', 'Track Income', 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png', 'emerald')}
                        ${renderSettingAction('settings-invoice-btn', 'Invoice', 'https://cdn-icons-png.flaticon.com/512/337/337946.png', 'yellow')}
                        ${renderSettingAction('settings-task-history-btn', 'Task History', TASK_ICON_URL, 'purple')}
                        ${renderSettingAction('settings-live-lists-btn', 'Live Lists Verification', 'https://cdn-icons-png.flaticon.com/512/2620/2620743.png', 'indigo')}
                    </div>
                    ${isAdmin ? `
                    <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 space-y-3">
                        <p class="text-xs font-bold uppercase text-gray-400 px-1">Admin</p>
                        ${renderSettingAction('settings-admin-withdrawals', 'Pending Requests', 'https://cdn-icons-png.flaticon.com/512/7939/7939990.png', 'blue')}
                        ${renderSettingAction('settings-admin-users', 'User Management', 'https://cdn-icons-png.flaticon.com/512/681/681494.png', 'green')}
                        ${renderSettingAction('settings-admin-gift-codes', 'Gift Codes', 'https://cdn-icons-png.flaticon.com/512/2611/2611152.png', 'purple')}
                        ${renderSettingAction('settings-admin-history', 'Withdrawal History', 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png', 'yellow')}
                        ${renderSettingAction('settings-admin-chat', 'Manage Chat', 'https://cdn-icons-png.flaticon.com/512/5962/5962463.png', 'rose')}
                        ${renderSettingAction('settings-admin-rates', 'Rate Settings', 'https://cdn-icons-png.flaticon.com/512/3524/3524659.png', 'emerald')}
                        ${renderSettingAction('settings-admin-maintenance', 'Maintenance Mode', 'https://cdn-icons-png.flaticon.com/512/2099/2099058.png', 'red')}
                        ${renderSettingAction('settings-admin-whats-new', "What's New Popup", 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png', 'blue')}
                    </div>` : ''}
                    <button id="settings-logout-btn" class="flex items-center justify-center w-full p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-300 font-bold">Logout</button>
                </div>
                ${getPageFooter()}`;
            showPage(content, { keepBottomNav: true });
            currentMainSection = 'settings';
            setBottomNavActive('bottom-settings-btn');
            document.getElementById('settings-profile-btn').onclick = showProfilePage;
            document.getElementById('settings-track-income-btn').onclick = showTrackIncomePage;
            document.getElementById('settings-invoice-btn').onclick = showWithdrawalInvoicesPage;
            document.getElementById('settings-task-history-btn').onclick = showUserTaskHistoryPage;
            document.getElementById('settings-live-lists-btn').onclick = showUserLiveListsPage;
            document.getElementById('settings-logout-btn').onclick = () => signOut(auth);
            if (isAdmin) {
                document.getElementById('settings-admin-withdrawals').onclick = showAdminWithdrawalsPage;
                document.getElementById('settings-admin-users').onclick = showAdminUsersPage;
                document.getElementById('settings-admin-gift-codes').onclick = showAdminGiftCodesPage;
                document.getElementById('settings-admin-history').onclick = showWithdrawalHistoryPage;
                document.getElementById('settings-admin-chat').onclick = showAdminChatsPage;
                document.getElementById('settings-admin-rates').onclick = showAdminWithdrawSettingsModal;
                document.getElementById('settings-admin-maintenance').onclick = showMaintenanceSettingsPage;
                document.getElementById('settings-admin-whats-new').onclick = showWhatsNewSettingsPage;
            }

            if (!isAdmin) {
                const settingsAvatarTrigger = document.getElementById('settings-avatar-trigger-btn');
                if (settingsAvatarTrigger) {
                    settingsAvatarTrigger.onclick = () => {
                        const currentAvatar = getProfileAvatarUrl(currentUserData);
                        window.showProfilePhotoSelectionModal(currentAvatar, async (chosenUrl) => {
                            await syncProfilePhotoToDatabase(chosenUrl);
                        });
                    };
                }
            }
        };

const showMaintenanceSettingsPage = () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const parentSection = currentMainSection === 'admin' ? 'admin' : 'settings';
            const handleBack = parentSection === 'admin' ? showAdminMainPage : showSettingsPage;
            const active = isMaintenanceConfigActive(appConfigCache);
            const endMillis = getMaintenanceEndMillis(appConfigCache);
            const remainingSeconds = active && endMillis ? Math.max(60, Math.ceil((endMillis - Date.now()) / 1000)) : 30 * 60;
            const durationValue = formatMaintenanceDurationInput(remainingSeconds);
            const endText = active && endMillis ? new Date(endMillis).toLocaleString('en-IN') : 'Not scheduled';
            const message = appConfigCache.maintenanceMessage || 'We are improving your wallet experience. Please wait until the maintenance window is complete.';

            showPage(`
                ${getPageHeader('Maintenance Mode')}
                <div class="max-w-lg mx-auto space-y-4">
                    <div class="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-900 to-emerald-700 p-5 text-white shadow-xl">
                        <p class="text-xs font-extrabold uppercase text-white/70">Admin Control</p>
                        <div class="mt-4 flex items-center justify-between gap-3">
                            <div>
                                <h3 class="text-2xl font-extrabold">${active ? 'Maintenance is ON' : 'Maintenance is OFF'}</h3>
                                <p class="mt-1 text-sm text-white/70">${active ? `Ends: ${escapeHtml(endText)}` : 'Users can open the app normally.'}</p>
                            </div>
                            <span class="rounded-2xl px-4 py-2 text-xs font-extrabold ${active ? 'bg-red-500 text-white animate-pulse' : 'bg-white/20 text-white'}">${active ? 'ON' : 'OFF'}</span>
                        </div>
                        ${active ? `
                        <div class="mt-5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                            <p class="text-xs font-extrabold uppercase text-cyan-100/75" id="admin-maintenance-timer-label">Remaining Time</p>
                            <p class="mt-1 text-3xl font-extrabold tabular-nums" id="admin-maintenance-timer-val">${durationValue}</p>
                        </div>
                        ` : ''}
                    </div>
                    <button id="maintenance-configure-btn" class="w-full rounded-2xl bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 py-3.5 px-4 font-extrabold text-sm text-gray-800 dark:text-white flex items-center justify-between gap-2 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition select-none">
                        <span class="flex items-center gap-2">⚙️ Configure Maintenance Settings</span>
                        <span id="maintenance-configure-chevron" class="text-xs font-bold text-gray-400">➕ Show</span>
                    </button>

                    <div id="maintenance-form-container" class="hidden space-y-4 transition-all duration-300">
                        <div class="rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-md border border-gray-100 dark:border-gray-700 space-y-4">
                            <div>
                                <label class="text-sm font-extrabold text-gray-700 dark:text-gray-200">Maintenance time (HH:MM:SS)</label>
                                <input id="maintenance-duration-input" type="text" inputmode="numeric" maxlength="8" value="${durationValue}" placeholder="00:30:00" class="mt-2 w-full rounded-2xl bg-gray-100 dark:bg-gray-700 px-4 py-3 text-2xl font-extrabold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <p class="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Example: 01:30:00 for 1 hour 30 minutes. Maximum 72:00:00.</p>
                            </div>
                            <div class="grid grid-cols-4 gap-2">
                                <button type="button" data-maintenance-duration="00:15:00" class="maintenance-quick-btn rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-extrabold">15m</button>
                                <button type="button" data-maintenance-duration="00:30:00" class="maintenance-quick-btn rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-extrabold">30m</button>
                                <button type="button" data-maintenance-duration="01:00:00" class="maintenance-quick-btn rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-extrabold">1h</button>
                                <button type="button" data-maintenance-duration="02:00:00" class="maintenance-quick-btn rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-extrabold">2h</button>
                            </div>
                            <div>
                                <label class="text-sm font-extrabold text-gray-700 dark:text-gray-200">Message for users</label>
                                <textarea id="maintenance-message-input" rows="3" maxlength="180" class="mt-2 w-full rounded-2xl bg-gray-100 dark:bg-gray-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500">${escapeHtml(message)}</textarea>
                            </div>
                            <div class="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 text-sm text-blue-800 dark:text-blue-100">
                                Users will see a full-screen maintenance page with countdown. Admin account will keep working normally.
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <button id="maintenance-off-btn" class="rounded-2xl bg-gray-100 dark:bg-gray-700 px-4 py-4 font-extrabold text-gray-700 dark:text-gray-100">Turn Off</button>
                            <button id="maintenance-save-btn" class="rounded-2xl bg-blue-600 px-4 py-4 font-extrabold text-white shadow-lg shadow-blue-200 dark:shadow-none">${active ? 'Update Timer' : 'Start Maintenance'}</button>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`, {
                returnTo: parentSection,
                keepBottomNav: false,
                onBack: () => {
                    if (adminMaintenanceInterval) {
                        clearInterval(adminMaintenanceInterval);
                        adminMaintenanceInterval = null;
                    }
                    handleBack();
                }
            });

            if (adminMaintenanceInterval) {
                clearInterval(adminMaintenanceInterval);
                adminMaintenanceInterval = null;
            }

            if (active && endMillis) {
                adminMaintenanceInterval = setInterval(() => {
                    const diff = endMillis - Date.now();
                    if (diff <= 0) {
                        clearInterval(adminMaintenanceInterval);
                        adminMaintenanceInterval = null;
                        appConfigCache = { ...appConfigCache, maintenanceEnabled: false, maintenanceEndsAt: null, maintenanceEndsAtMillis: 0 };
                        rememberAppConfig(appConfigCache);
                        applyMaintenanceMode();
                        showMaintenanceSettingsPage();
                        return;
                    }
                    const valEl = document.getElementById('admin-maintenance-timer-val');
                    if (valEl) {
                        valEl.textContent = formatMaintenanceCountdown(diff);
                    }
                }, 1000);
            }

            document.getElementById('maintenance-configure-btn')?.addEventListener('click', () => {
                const container = document.getElementById('maintenance-form-container');
                const label = document.getElementById('maintenance-configure-chevron');
                if (container && label) {
                    const isHidden = container.classList.toggle('hidden');
                    label.textContent = isHidden ? '➕ Show' : '➖ Hide';
                }
            });

            const durationInput = document.getElementById('maintenance-duration-input');
            durationInput?.addEventListener('blur', () => {
                const seconds = parseMaintenanceDurationInput(durationInput.value);
                if (seconds) durationInput.value = formatMaintenanceDurationInput(seconds);
            });
            document.querySelectorAll('.maintenance-quick-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const input = document.getElementById('maintenance-duration-input');
                    if (input) input.value = button.dataset.maintenanceDuration || '00:30:00';
                });
            });
            document.getElementById('maintenance-off-btn')?.addEventListener('click', handleTurnOffMaintenance);
            document.getElementById('maintenance-save-btn')?.addEventListener('click', handleSaveMaintenanceSettings);
        };

const handleSaveMaintenanceSettings = async () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const saveBtn = document.getElementById('maintenance-save-btn');
            const durationSeconds = parseMaintenanceDurationInput(document.getElementById('maintenance-duration-input')?.value || '');
            const message = String(document.getElementById('maintenance-message-input')?.value || '').trim()
                || 'We are improving your wallet experience. Please wait until the maintenance window is complete.';
            if (!durationSeconds) {
                return showNotification('Please enter time as HH:MM:SS between 00:01:00 and 72:00:00.', true);
            }
            try {
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Saving...';
                }
                const endDate = new Date(Date.now() + durationSeconds * 1000);
                const writePromise = setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
                    maintenanceEnabled: true,
                    maintenanceEndsAt: Timestamp.fromDate(endDate),
                    maintenanceDurationSeconds: durationSeconds,
                    maintenanceMessage: message,
                    maintenanceUpdatedAt: serverTimestamp(),
                    maintenanceUpdatedBy: currentUser.uid
                }, { merge: true });

                await Promise.race([
                    writePromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
                ]);

                showNotification('Maintenance mode started.');
                appConfigCache = {
                    ...appConfigCache,
                    maintenanceEnabled: true,
                    maintenanceEndsAt: Timestamp.fromDate(endDate),
                    maintenanceEndsAtMillis: endDate.getTime(),
                    maintenanceDurationSeconds: durationSeconds,
                    maintenanceMessage: message
                };
                rememberAppConfig(appConfigCache);
                applyMaintenanceMode();
                showMaintenanceSettingsPage();
            } catch (error) {
                console.error('Maintenance settings save failed:', error);
                const message = String(error?.message || '');
                if (message === 'timeout') {
                    showNotification('Database write timed out. Daily quota may be exceeded.', true);
                } else if (/resource-exhausted|quota exceeded/i.test(message)) {
                    showNotification('Database daily quota exceeded. Please try again later.', true);
                } else {
                    showNotification('Could not save maintenance settings. Please try again.', true);
                }
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = isMaintenanceConfigActive(appConfigCache) ? 'Update Timer' : 'Start Maintenance';
                }
            }
        };

const showWhatsNewSettingsPage = () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const parentSection = currentMainSection === 'admin' ? 'admin' : 'settings';
            const handleBack = parentSection === 'admin' ? showAdminMainPage : showSettingsPage;
            const enabled = appConfigCache.whatsNewEnabled !== false && appConfigCache.whats_new_enabled !== false;
            const title = appConfigCache.whatsNewTitle || appConfigCache.whats_new_title || "What's New";
            const message = appConfigCache.whatsNewMessage || appConfigCache.whats_new_message || '';
            const updatedMillis = timestampToMillis(appConfigCache.whatsNewUpdatedAt || appConfigCache.whats_new_updated_at || 0);
            const updatedText = updatedMillis ? new Date(updatedMillis).toLocaleString('en-IN') : 'Not sent yet';

            showPage(`
                ${getPageHeader("What's New")}
                <div class="mx-auto max-w-lg space-y-4">
                    <div class="rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-600 to-emerald-500 p-5 text-white shadow-xl">
                        <p class="text-xs font-black uppercase tracking-[0.25em] text-white/70">User Popup</p>
                        <h3 class="mt-2 text-2xl font-black">What's New Message</h3>
                        <p class="mt-2 text-sm text-white/75">Last update: ${escapeHtml(updatedText)}</p>
                    </div>
                    <button id="whats-new-configure-btn" class="w-full rounded-2xl bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 py-3.5 px-4 font-extrabold text-sm text-gray-800 dark:text-white flex items-center justify-between gap-2 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition select-none">
                        <span class="flex items-center gap-2">✍️ Edit / Create Update Message</span>
                        <span id="whats-new-configure-chevron" class="text-xs font-bold text-gray-400">➕ Show</span>
                    </button>

                    <div id="whats-new-form-container" class="hidden space-y-4 transition-all duration-300">
                        <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800">
                            <label class="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-black dark:bg-gray-700">
                                <span>Show popup to users</span>
                                <input id="whats-new-enabled-input" type="checkbox" ${enabled ? 'checked' : ''} class="h-5 w-5 accent-indigo-600">
                            </label>
                            <div class="mt-4">
                                <label class="text-sm font-black text-gray-700 dark:text-gray-200">Popup title</label>
                                <input id="whats-new-title-input" maxlength="80" value="${escapeHtml(title)}" class="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700">
                            </div>
                            <div class="mt-4">
                                <label class="text-sm font-black text-gray-700 dark:text-gray-200">Message</label>
                                <textarea id="whats-new-message-input" rows="7" maxlength="1200" placeholder="Type new update for users..." class="mt-2 w-full rounded-2xl bg-gray-100 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700">${escapeHtml(message)}</textarea>
                                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Saving creates a new update ID, so every user will see it once. After they close it, it will not repeat until you save another update.</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <button id="whats-new-disable-btn" class="rounded-2xl bg-gray-100 dark:bg-gray-700 px-4 py-4 font-black text-gray-700 dark:bg-gray-700 dark:text-gray-100">Turn Off</button>
                            <button id="whats-new-save-btn" class="rounded-2xl bg-indigo-600 px-4 py-4 font-black text-white shadow-lg shadow-indigo-200 dark:shadow-none">Save & Show</button>
                        </div>
                    </div>
                    
                    <!-- User Seen Status Section -->
                    <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800">
                        <div class="flex items-center justify-between">
                            <div>
                                <h4 class="text-sm font-black text-gray-850 dark:text-white">Seen Status</h4>
                                <p class="text-[11px] text-gray-450 mt-0.5">Users who opened the app and saw this update.</p>
                            </div>
                            <button id="whats-new-seen-btn" class="rounded-xl bg-orange-100 dark:bg-orange-950/40 px-3.5 py-2 text-xs font-black text-orange-600 dark:text-orange-300 hover:bg-orange-200 transition">
                                👥 View Users (Loading...)
                            </button>
                        </div>
                        <div id="whats-new-seen-list-container" class="mt-4 hidden border-t border-gray-100 dark:border-gray-750 pt-4 max-h-60 overflow-y-auto space-y-2">
                            <p class="text-center text-xs text-gray-400 py-4">Loading users...</p>
                        </div>
                    </div>
                </div>
                ${getPageFooter()}`, { returnTo: parentSection, keepBottomNav: false, onBack: handleBack });

            // Load Seen Users Async
            const loadWhatsNewSeenUsers = async () => {
                const id = getWhatsNewId(appConfigCache);
                const btn = document.getElementById('whats-new-seen-btn');
                const container = document.getElementById('whats-new-seen-list-container');
                if (!id) {
                    if (btn) btn.textContent = '👥 View Users (0)';
                    if (container) container.innerHTML = '<p class="text-center text-xs text-gray-400 py-4">No update configured.</p>';
                    return;
                }
                try {
                    const snap = await getDocs(query(
                        collection(db, `artifacts/${appId}/public/data/whats_new_seen/${id}/users`),
                        orderBy('seenAt', 'desc')
                    ));
                    
                    // Resolve user details using allUsersCache
                    const users = snap.docs.map(doc => {
                        const d = doc.data();
                        const uid = d.userId || doc.id;
                        const profile = allUsersCache.find(x => x.id === uid || x.uid === uid) || {};
                        return {
                            ...d,
                            userId: uid,
                            name: profile.name || d.name || 'Unknown User',
                            mobile: profile.mobile || d.mobile || 'No mobile',
                            email: profile.email || 'No email'
                        };
                    });
                    
                    const count = users.length;
                    if (btn) {
                        btn.textContent = `👥 View Users (${count})`;
                    }
                    if (container) {
                        if (count === 0) {
                            container.innerHTML = `<p class="text-center text-xs text-gray-400 py-4">No users have seen this update yet.</p>`;
                        } else {
                            container.innerHTML = users.map(u => {
                                const time = u.seenAt ? new Date(timestampToMillis(u.seenAt)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unknown';
                                const initial = (u.name && u.name !== 'Unknown User') ? u.name.charAt(0).toUpperCase() : '?';
                                return `
                                    <div class="flex items-center gap-3 justify-between text-xs bg-gray-50/70 dark:bg-gray-900/30 p-2.5 rounded-xl border border-gray-150 dark:border-gray-800 shadow-sm">
                                        <div class="flex items-center gap-3.5 min-w-0">
                                            <div class="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center font-bold text-orange-600 shrink-0 text-sm">
                                                ${initial}
                                            </div>
                                            <div class="min-w-0 flex-1">
                                                <p class="font-extrabold text-gray-800 dark:text-white truncate">${escapeHtml(u.name)}</p>
                                                <div class="flex flex-col gap-0.5 mt-0.5 text-[10px] text-gray-400 font-semibold">
                                                    <span class="text-orange-500 font-bold">📱 ${escapeHtml(u.mobile)}</span>
                                                    ${u.email && u.email !== 'No email' ? `<span class="truncate">✉ ${escapeHtml(u.email)}</span>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <span class="text-[9px] text-gray-400 font-semibold shrink-0 text-right">${time}</span>
                                    </div>
                                `;
                            }).join('');
                        }
                    }
                } catch (err) {
                    console.error("Failed to load seen users:", err);
                    if (btn) btn.textContent = '👥 View Users (Error)';
                    if (container) container.innerHTML = '<p class="text-center text-xs text-red-500 py-4">Error loading users.</p>';
                }
            };

            loadWhatsNewSeenUsers();

            document.getElementById('whats-new-seen-btn')?.addEventListener('click', () => {
                const container = document.getElementById('whats-new-seen-list-container');
                if (container) {
                    container.classList.toggle('hidden');
                }
            });

            document.getElementById('whats-new-configure-btn')?.addEventListener('click', () => {
                const container = document.getElementById('whats-new-form-container');
                const label = document.getElementById('whats-new-configure-chevron');
                if (container && label) {
                    const isHidden = container.classList.toggle('hidden');
                    label.textContent = isHidden ? '➕ Show' : '➖ Hide';
                }
            });

            document.getElementById('whats-new-save-btn')?.addEventListener('click', handleSaveWhatsNewSettings);
            document.getElementById('whats-new-disable-btn')?.addEventListener('click', handleDisableWhatsNew);
        };

const handleSaveWhatsNewSettings = async () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const saveBtn = document.getElementById('whats-new-save-btn');
            const title = String(document.getElementById('whats-new-title-input')?.value || '').trim() || "What's New";
            const message = String(document.getElementById('whats-new-message-input')?.value || '').trim();
            const enabled = !!document.getElementById('whats-new-enabled-input')?.checked;
            if (!message) return showNotification('Please type What\'s New message.', true);
            const whatsNewId = `wn-${Date.now()}`;
            try {
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Saving...';
                }
                await setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
                    whatsNewEnabled: enabled,
                    whatsNewTitle: title,
                    whatsNewMessage: message,
                    whatsNewId,
                    whatsNewUpdatedAt: serverTimestamp(),
                    whatsNewUpdatedBy: currentUser.uid
                }, { merge: true });
                appConfigCache = {
                    ...appConfigCache,
                    whatsNewEnabled: enabled,
                    whatsNewTitle: title,
                    whatsNewMessage: message,
                    whatsNewId,
                    whatsNewUpdatedAt: Date.now()
                };
                showNotification(enabled ? "What's New popup saved." : "What's New saved but turned off.");
                showWhatsNewSettingsPage();
            } catch (error) {
                console.error("What's New save failed:", error);
                showNotification("Could not save What's New message. Please try again.", true);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save & Show';
                }
            }
        };

const showReferralSettingsPage = () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const parentSection = currentMainSection === 'admin' ? 'admin' : 'settings';
            const handleBack = parentSection === 'admin' ? showAdminMainPage : showSettingsPage;
            const reward = getReferralRewardAmount();
            showPage(`
                ${getPageHeader('Referral Price')}
                <div class="mx-auto max-w-lg space-y-4">
                    <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-700 p-5 text-white shadow-xl">
                        <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full border border-white/20"></div>
                        <div class="absolute right-5 bottom-5 h-14 w-14 rounded-2xl bg-white/10"></div>
                        <p class="relative text-xs font-black uppercase tracking-[0.25em] text-white/70">Refer & Earn</p>
                        <h3 class="relative mt-2 text-3xl font-black">${formatCurrency(reward).replace('.00', '')}</h3>
                        <p class="relative mt-1 text-sm font-semibold text-white/75">This amount will show on the user referral page.</p>
                    </section>
                    <section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800">
                        <label class="text-sm font-black text-gray-700 dark:text-gray-200">Referral reward amount</label>
                        <div class="mt-2 flex items-center gap-3 rounded-2xl bg-gray-100 px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-500 dark:bg-gray-700">
                            <span class="text-xl font-black text-gray-500 dark:text-gray-300">&#8377;</span>
                            <input id="referral-price-input" type="number" min="0" step="1" value="${reward}" class="min-w-0 flex-1 bg-transparent text-2xl font-black text-gray-950 outline-none dark:text-white">
                        </div>
                        <p class="mt-3 text-xs font-semibold text-gray-500 dark:text-gray-400">The referral link itself is still marked Coming Soon for users.</p>
                    </section>
                    <button id="referral-price-save-btn" class="w-full rounded-2xl bg-emerald-600 px-4 py-4 font-black text-white shadow-lg shadow-emerald-200 transition active:scale-[0.99] dark:shadow-none">Save Referral Price</button>
                </div>
                ${getPageFooter()}`, { returnTo: parentSection, keepBottomNav: false, onBack: handleBack });

            document.getElementById('referral-price-save-btn')?.addEventListener('click', handleSaveReferralSettings);
        };

const handleSaveReferralSettings = async () => {
            if (!currentUser || currentUser.uid !== ADMIN_UID) return showNotification('Admin access only.', true);
            const saveBtn = document.getElementById('referral-price-save-btn');
            const reward = Number(document.getElementById('referral-price-input')?.value || 0);
            if (!Number.isFinite(reward) || reward < 0) {
                return showNotification('Please enter a valid referral amount.', true);
            }
            try {
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Saving...';
                }
                await setDoc(doc(db, `artifacts/${appId}/settings`, 'app_config'), {
                    referralRewardAmount: reward,
                    referralRewardUpdatedAt: serverTimestamp(),
                    referralRewardUpdatedBy: currentUser.uid
                }, { merge: true });
                appConfigCache = {
                    ...appConfigCache,
                    referralRewardAmount: reward,
                    referralRewardUpdatedAt: Date.now()
                };
                rememberAppConfig(appConfigCache);
                showNotification('Referral price updated.');
                showReferralSettingsPage();
            } catch (error) {
                console.error('Referral settings save failed:', error);
                showNotification('Could not save referral price. Please try again.', true);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Referral Price';
                }
            }
        };

const handleUpdateProfile = async () => {
            const newName = document.getElementById('profile-name-input').value.trim();
            const newMobile = normalizePhoneDigits(document.getElementById('profile-mobile-input').value);
            const selectedPaymentMethod = document.getElementById('profile-payment-method').value;
            const paymentMethod = selectedPaymentMethod || normalizeProfilePaymentMethod(currentUserData);
            const isAdminProfile = currentUser?.uid === ADMIN_UID;

            if (!newName || !newMobile) {
                return showNotification('Name and Mobile are required.', true);
            }

            // Phone number validation: must be exactly 10 digits
            const phoneRegex = /^\d{10}$/;
            if (!phoneRegex.test(newMobile)) {
                return showNotification('Mobile number must be exactly 10 digits.', true);
            }
            let existingMobileUser = null;
            try {
                existingMobileUser = await findExistingUserByMobile(newMobile, currentUser?.uid);
            } catch (error) {
                console.warn('Mobile duplicate check failed:', error);
                return showNotification('Could not verify mobile number. Please try again.', true);
            }
            if (existingMobileUser) return showNotification('This mobile number is already used by another account.', true);

            let paymentDetails = getProfilePaymentDetails(paymentMethod);

            // Collect payment details based on selected method
            switch (paymentMethod) {
                case 'upi':
                    const upiId = document.getElementById('payment-upi-id')?.value.trim();
                    if (!upiId) {
                        return showNotification('UPI ID is required for UPI payments.', true);
                    }
                    paymentDetails = { upiId };
                    break;

                case 'bank':
                    const accountNumber = document.getElementById('payment-bank-account')?.value.trim();
                    const ifsc = document.getElementById('payment-ifsc')?.value.trim();
                    const bankName = document.getElementById('payment-bank-name')?.value.trim();
                    const accountName = document.getElementById('payment-account-name')?.value.trim();

                    if (!accountNumber || !ifsc || !bankName || !accountName) {
                        return showNotification('All bank details are required.', true);
                    }
                    paymentDetails = { accountNumber, ifsc, bankName, accountName };
                    break;

                case 'play_store':
                case 'amazon_gift':
                case 'flipkart_gift':
                case 'paypal':
                    const email = document.getElementById('payment-email')?.value.trim();
                    if (!email) {
                        return showNotification('Email is required for this payment method.', true);
                    }
                    paymentDetails = { email };
                    break;
            }
            const profilePhoto = document.getElementById('profile-avatar-url')?.value || '';
            const profileUpdate = {
                name: newName,
                mobile: newMobile,
                phoneNumber: newMobile,
                profilePhoto: profilePhoto || currentUserData?.profilePhoto || '',
                paymentMethod: paymentMethod,
                paymentDetails: paymentMethod ? paymentDetails : getProfilePaymentDetails(currentUserData?.paymentMethod || '')
            };
            if (paymentMethod === 'upi') {
                profileUpdate.upiId = paymentDetails.upiId || '';
            } else if (paymentMethod === 'bank') {
                profileUpdate.accountNumber = paymentDetails.accountNumber || '';
                profileUpdate.ifsc = paymentDetails.ifsc || '';
                profileUpdate.bankName = paymentDetails.bankName || '';
                profileUpdate.accountName = paymentDetails.accountName || '';
            } else if (['play_store', 'amazon_gift', 'flipkart_gift', 'paypal'].includes(paymentMethod)) {
                profileUpdate.paymentEmail = paymentDetails.email || '';
            }

            if (isAdminProfile) {
                const whatsappNumber = document.getElementById('profile-whatsapp-input')?.value.trim() || newMobile;
                if (!/^\d{10,15}$/.test(whatsappNumber)) {
                    return showNotification('WhatsApp number must be 10 to 15 digits.', true);
                }

                const websiteLinks = Array.from(document.querySelectorAll('.profile-website-input'))
                    .map(input => input.value.trim())
                    .filter(Boolean)
                    .slice(0, 3);
                const invalidLink = websiteLinks.find(link => !/^https?:\/\/.+\..+/.test(link));
                if (invalidLink) {
                    return showNotification('Website links must start with http:// or https://', true);
                }
                profileUpdate.whatsappNumber = whatsappNumber;
                profileUpdate.websiteLinks = websiteLinks.slice(0, 3);
            }

            try {
                const userRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.uid);
                await updateDoc(userRef, profileUpdate);
                currentUserData = { ...(currentUserData || {}), ...profileUpdate };
                writeJsonCache(getUserCacheKey(currentUser.uid), sanitizeUserForCache(currentUserData, currentUser.uid));
                showNotification('Profile updated successfully!');
                hidePage();
            } catch (e) {
                console.error('Failed to update profile:', e);
                showNotification('Error: Could not update profile.', true);
            }
        };

// Expose functions to window for global access
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.getProfileAvatarUrl = getProfileAvatarUrl;
window.getBackendProfilePayload = getBackendProfilePayload;
window.getProfilePaymentDetails = getProfilePaymentDetails;
window.normalizeProfilePaymentMethod = normalizeProfilePaymentMethod;
window.getRawProfilePaymentMethod = getRawProfilePaymentMethod;
window.getProfilePaymentMethodLabel = getProfilePaymentMethodLabel;
window.showProfilePage = showProfilePage;
window.showSettingsPage = showSettingsPage;
window.showMaintenanceSettingsPage = showMaintenanceSettingsPage;
window.handleSaveMaintenanceSettings = handleSaveMaintenanceSettings;
window.showWhatsNewSettingsPage = showWhatsNewSettingsPage;
window.handleSaveWhatsNewSettings = handleSaveWhatsNewSettings;
window.showReferralSettingsPage = showReferralSettingsPage;
window.handleSaveReferralSettings = handleSaveReferralSettings;
window.handleUpdateProfile = handleUpdateProfile;
