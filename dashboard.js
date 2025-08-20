import { firebaseConfig } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    // تابع برای نمایش پیام‌های موقت (Toast)
    function showToast(message) {
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // اعمال تم اولیه
    const themeToggleBtn = document.getElementById('theme-toggle');
    const updateThemeIcons = () => {
        const isDark = document.documentElement.classList.contains('dark');
        const lightIcon = document.getElementById('theme-toggle-light-icon');
        const darkIcon = document.getElementById('theme-toggle-dark-icon');
        if (lightIcon && darkIcon) {
            lightIcon.classList.toggle('hidden', !isDark);
            darkIcon.classList.toggle('hidden', isDark);
        }
    };
    if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeIcons();

    // ========================================================================
    // Passkey/WebAuthn Logic
    // ========================================================================
    // *** FIX: Access the library from the global `window` object to prevent reference errors ***
    const { startRegistration, startAuthentication } = window.SimpleWebAuthnBrowser;
    
    const functionsBaseUrl = '/api';

    async function getRegistrationOptions(user) {
        console.log('Requesting registration options from server for user:', user.uid);
        try {
            const response = await fetch(`${functionsBaseUrl}/generate-registration-options`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userID: user.uid,
                    username: user.email,
                }),
            });
            
            const responseBody = await response.json();
            if (!response.ok) {
                console.error('Server returned an error for registration options:', responseBody);
                showToast(`خطای سرور: ${responseBody.error || 'نا مشخص'}`);
                return null;
            }
            console.log('Received registration options:', responseBody);
            return responseBody;
        } catch (error) {
            console.error('Fetch error during getRegistrationOptions:', error);
            showToast('خطا در ارتباط با سرور.');
            return null;
        }
    }

    async function verifyRegistration(verificationData) {
        console.log('Sending registration verification to server:', verificationData);
        const response = await fetch(`${functionsBaseUrl}/verify-registration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(verificationData),
        });
        
        const responseBody = await response.json();
        if (!response.ok) {
            console.error('Server returned an error during verification:', responseBody);
            showToast(`خطای تایید: ${responseBody.error || 'نا مشخص'}`);
        }
        console.log('Received verification response:', responseBody);
        return responseBody;
    }
    
    async function getAuthenticationOptions(user) {
         const response = await fetch(`${functionsBaseUrl}/generate-authentication-options`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userID: user.uid }),
        });
        if (!response.ok) {
            console.error('Failed to get authentication options from server');
            showToast('خطا در ارتباط با سرور');
            return null;
        }
        return response.json();
    }

    async function verifyAuthentication(verificationData) {
        const response = await fetch(`${functionsBaseUrl}/verify-authentication`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(verificationData),
        });
        return response.json();
    }
    
    // ========================================================================

    const app = firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    auth.onAuthStateChanged(user => {
        if (user) {
            initializeAppLogic(user); 
        } else {
            window.location.href = 'index.html';
        }
    });

    async function initializeAppLogic(user) {
        const mobileWrapper = document.getElementById('mobile-wrapper');
        const contentArea = document.getElementById('content-area');
        const bottomNavBar = document.getElementById('bottom-nav-bar');
        const navLinks = bottomNavBar.querySelectorAll('a');
        const appLockOverlay = document.getElementById('app-lock-overlay');
        const unlockBtn = document.getElementById('unlock-with-passkey-btn');

        const isAppLockEnabled = localStorage.getItem(`appLockEnabled_${user.uid}`) === 'true';
        if (isAppLockEnabled) {
            appLockOverlay.classList.add('visible');
            if (unlockBtn) {
                unlockBtn.onclick = async () => {
                    try {
                        const options = await getAuthenticationOptions(user);
                        if (!options) return;

                        const authResult = await startAuthentication(options);
                        const verification = await verifyAuthentication(authResult);

                        if (verification && verification.verified) {
                            appLockOverlay.classList.remove('visible');
                        } else {
                            showToast('احراز هویت با Face ID ناموفق بود.');
                        }
                    } catch (error) {
                        console.error('Authentication error:', error);
                        const errorMessage = error.name === 'NotAllowedError' ? 'درخواست توسط شما لغو شد.' : 'خطا در فرآیند احراز هویت.';
                        showToast(errorMessage);
                    }
                };
            }
        }

        const hideSplash = () => {
            const splashScreen = document.getElementById('dashboard-splash-screen');
            if (splashScreen) {
                splashScreen.classList.add('hidden');
                setTimeout(() => {
                    if(splashScreen.parentNode) {
                       splashScreen.parentNode.removeChild(splashScreen);
                    }
                }, 500);
            }
        };

        const performInitialLoad = async () => {
            try {
                if (!isAppLockEnabled) {
                    const userProfilePromise = db.collection('users').doc(user.uid).get();
                    const accountsPromise = db.collection('users').doc(user.uid).collection('accounts').get();
                    const summaryPromise = db.collection('users').doc(user.uid).collection('summaryCards').get();
                    await Promise.all([userProfilePromise, accountsPromise, summaryPromise]);
                    await loadContent('dashboard-content.html', true);
                    hideSplash();
                } else {
                    await loadContent('dashboard-content.html', true);
                    hideSplash();
                }
            } catch (error) {
                console.error("خطا در بارگذاری داده‌های اولیه:", error);
                hideSplash();
            }
        };
        
        let isAmountsVisible = true;
        const banks = { 'ملت': 'mellat1.png', 'سامان': 'saman.png', 'ملی': 'melli.png', 'صادرات': 'saderat.png', 'تجارت': 'tejarat.png', 'پاسارگاد': 'pasargad.png', 'آینده': 'ayandeh.png', 'شهر': 'shahr.png', 'اقتصاد نوین': 'en.png', 'پارسیان': 'parsian.png', 'بلو بانک': 'blu.png', 'ملل': 'melal.png' };
        const customBankLogo = 'bank.png';
        let accountsData = [];
        let swiperInstance = null;

        const toPersianNumerals = (str) => {
            if (str === null || str === undefined) return '';
            const persian = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' };
            return str.toString().replace(/[0-9]/g, (w) => persian[w]);
        };
        const formatCardNumberWithSpaces = (cardNumber) => {
            if (!cardNumber) return '';
            return cardNumber.toString().replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim();
        };
        
        function calculateAge(birthDateString) {
            if (!birthDateString || !/^\d{4}\/\d{2}\/\d{2}$/.test(birthDateString)) return null;

            function jalaliToGregorian(jy, jm, jd) {
                var sal_a, gy, gm, gd, days;
                jy += 1595;
                days = -355668 + (365 * jy) + (~~(jy / 33) * 8) + ~~(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
                gy = 400 * ~~(days / 146097);
                days %= 146097;
                if (days > 36524) {
                    gy += 100 * ~~(--days / 36524);
                    days %= 36524;
                    if (days >= 365) days++;
                }
                gy += 4 * ~~(days / 1461);
                days %= 1461;
                if (days > 365) {
                    gy += ~~((days - 1) / 365);
                    days = (days - 1) % 365;
                }
                gd = days + 1;
                sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
                return new Date(gy, gm - 1, gd);
            }

            const [jy, jm, jd] = birthDateString.split('/').map(Number);
            const birthDate = jalaliToGregorian(jy, jm, jd);
            const today = new Date();

            let years = today.getFullYear() - birthDate.getFullYear();
            let months = today.getMonth() - birthDate.getMonth();
            let days = today.getDate() - birthDate.getDate();

            if (days < 0) {
                months--;
                const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                days += prevMonth.getDate();
            }
            if (months < 0) {
                years--;
                months += 12;
            }
            return `سن: ${toPersianNumerals(years)} سال و ${toPersianNumerals(months)} ماه و ${toPersianNumerals(days)} روز`;
        }

        async function loadContent(url, isInitialLoad = false) {
            try {
                if (!isInitialLoad) {
                    contentArea.style.opacity = '0';
                }
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const html = await response.text();
                
                setTimeout(async () => {
                    contentArea.innerHTML = html;
                    contentArea.style.transition = 'opacity 0.2s ease-in-out';
                    contentArea.style.opacity = '1';

                    if (url.includes('dashboard-content.html')) {
                        initializeDashboardScripts();
                    } else if (url.includes('calendar.html')) {
                        const calendarModule = await import('./calendar.js');
                        calendarModule.initializeCalendar();
                    }
                }, isInitialLoad ? 0 : 200);
            } catch (error) {
                console.error("Error loading content:", error);
                contentArea.innerHTML = `<div class="p-6 text-center text-red-500">بارگذاری این بخش با مشکل مواجه شد.</div>`;
            }
        }

        bottomNavBar.addEventListener('click', (e) => {
            e.preventDefault();
            const link = e.target.closest('a');
            if (!link || link.classList.contains('active')) return;
            
            const contentUrl = link.dataset.contentUrl;
            if (!contentUrl) return;

            navLinks.forEach(navLink => navLink.classList.remove('active'));
            link.classList.add('active');
            
            loadContent(contentUrl);
        });

        if(themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                document.documentElement.classList.toggle('dark');
                localStorage.setItem('color-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
                updateThemeIcons();
            });
        }

        const openSubPage = (pageClass) => mobileWrapper.classList.add(pageClass, 'nav-hidden');
        const closeSubPage = (pageClass) => mobileWrapper.classList.remove(pageClass, 'nav-hidden');

        function initializeDashboardScripts() {
            swiperInstance = new Swiper('.card-slider', {
                slidesPerView: 1.15, 
                spaceBetween: 16, 
                centeredSlides: true,
                pagination: { el: '.swiper-pagination', clickable: true },
            });

            document.getElementById('go-to-profile').addEventListener('click', (e) => { e.preventDefault(); openSubPage('view-profile'); });
            document.getElementById('go-to-accounts').addEventListener('click', (e) => { e.preventDefault(); openSubPage('view-accounts'); });
            document.getElementById('go-to-summary-details').addEventListener('click', (e) => { e.preventDefault(); openSubPage('view-summary-details'); });
            
            document.getElementById('toggle-amounts-btn').addEventListener('click', () => {
                isAmountsVisible = !isAmountsVisible;
                updateAmountsVisibility();
            });

            document.getElementById('total-balance-container').addEventListener('click', (e) => {
                const container = e.currentTarget;
                container.classList.toggle('details-visible');
                const details = container.querySelector('#balance-details');
                const isVisible = container.classList.contains('details-visible');
                details.style.maxHeight = isVisible ? '20px' : '0';
                details.style.opacity = isVisible ? '1' : '0';
            });
            
            renderDashboardAccounts();
            renderDashboardSummaryCards();
            
            contentArea.addEventListener('click', (e) => {
                const cardItem = e.target.closest('#dashboard-summary-list .summary-details-item');
                if (cardItem) cardItem.classList.toggle('expanded');
            });
        }
        
        function updateAmountsVisibility() {
            const amountElements = document.querySelectorAll('.amount-display');
            const toggleIcon = document.querySelector('#toggle-amounts-icon');
            amountElements.forEach(el => {
                if (!el.dataset.originalValue) el.dataset.originalValue = el.textContent.trim();
                el.textContent = isAmountsVisible ? el.dataset.originalValue : '******';
            });
            if (toggleIcon) toggleIcon.className = isAmountsVisible ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
        }

        function initializeSubPageScripts() {
            initializeProfilePageLogic();
            initializeAccountsPageLogic();
            initializeSummaryPageLogic();
            initializePersonalInfoPage();
        }
        
        function initializeProfilePageLogic() {
            const profilePage = document.getElementById('profile-page');
            profilePage.innerHTML = `
                <header class="page-header">
                    <button id="go-back-to-dashboard-from-profile" class="text-gray-600 dark:text-gray-300"><i class="fa-solid fa-arrow-right text-xl"></i></button>
                    <h1>پروفایل کاربری</h1>
                    <div class="w-6"></div>
                </header>
                <main class="page-content p-4 space-y-6">
                    <div class="flex flex-col items-center space-y-4 pt-4">
                        <img id="profile-avatar" src="https://placehold.co/100x100" alt="Avatar" class="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-700 shadow-lg">
                        <div>
                            <h2 id="profile-name" class="text-2xl font-bold text-center text-gray-800 dark:text-white">...</h2>
                            <p id="profile-phone" class="text-center text-gray-500 dark:text-gray-400 mt-1">...</p>
                            <p id="profile-age" class="hidden text-center text-sm text-gray-500 dark:text-gray-400 mt-1">...</p>
                        </div>
                    </div>

                    <div class="space-y-2 pt-4">
                        <a href="#" id="go-to-personal-info" class="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm">
                            <div class="flex items-center space-x-3 space-x-reverse">
                                <i class="fa-solid fa-user-pen text-gray-500"></i>
                                <span class="font-semibold text-gray-700 dark:text-gray-300">اطلاعات شخصی</span>
                            </div>
                            <i class="fa-solid fa-chevron-left text-gray-400"></i>
                        </a>
                        
                        <div class="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm">
                            <div class="flex items-start justify-between">
                                <div class="flex items-center space-x-3 space-x-reverse">
                                    <i class="fa-solid fa-fingerprint text-gray-500 mt-1"></i>
                                    <div>
                                        <span class="font-semibold text-gray-700 dark:text-gray-300">قفل برنامه با Passkey</span>
                                        <p id="app-lock-status" class="text-xs text-gray-500 dark:text-gray-400 mt-1"></p>
                                    </div>
                                </div>
                                <button id="manage-app-lock-btn" class="px-4 py-2 text-sm font-semibold rounded-lg transition"></button>
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-3 pr-8">
                                با فعال‌سازی، برای ورود به برنامه از Face ID یا Touch ID استفاده کنید.
                            </p>
                        </div>

                        <a href="#" id="logout-btn" class="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm">
                            <div class="flex items-center space-x-3 space-x-reverse">
                                <i class="fa-solid fa-arrow-right-from-bracket text-red-500"></i>
                                <span class="font-semibold text-red-500">خروج از حساب</span>
                            </div>
                        </a>
                    </div>
                </main>
            `;
            
            document.getElementById('go-back-to-dashboard-from-profile').addEventListener('click', (e) => { e.preventDefault(); closeSubPage('view-profile'); });

            const userDocRef = db.collection('users').doc(user.uid);
            userDocRef.onSnapshot((doc) => {
                if (doc.exists) {
                    const { fullName, phoneNumber, birthDate, gender } = doc.data();
                    const profileName = document.getElementById('profile-name');
                    const profilePhone = document.getElementById('profile-phone');
                    const profileAge = document.getElementById('profile-age');
                    const profileAvatar = document.getElementById('profile-avatar');
                    
                    if(profileName) profileName.textContent = fullName || 'کاربر مهمان';
                    if (profilePhone) {
                        if (phoneNumber) profilePhone.innerHTML = `<a href="tel:${phoneNumber}" class="hover:underline">${phoneNumber}</a>`;
                        else profilePhone.textContent = 'شماره ثبت نشده';
                    }
                    if (birthDate) {
                        const ageString = calculateAge(birthDate);
                        if (ageString && profileAge) {
                            profileAge.textContent = ageString;
                            profileAge.classList.remove('hidden');
                        }
                    } else {
                        if(profileAge) profileAge.classList.add('hidden');
                    }
                    if(profileAvatar){
                        if (gender === 'male') profileAvatar.src = 'male.png';
                        else if (gender === 'female') profileAvatar.src = 'female.png';
                        else profileAvatar.src = 'https://placehold.co/100x100';
                    }
                }
            });

            document.getElementById('logout-btn').addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
            document.getElementById('go-to-personal-info').addEventListener('click', (e) => { e.preventDefault(); openSubPage('view-personal-info'); });

            const manageBtn = document.getElementById('manage-app-lock-btn');
            const statusText = document.getElementById('app-lock-status');

            const updateAppLockUI = () => {
                const isEnabled = localStorage.getItem(`appLockEnabled_${user.uid}`) === 'true';
                if (isEnabled) {
                    statusText.textContent = 'وضعیت: فعال';
                    statusText.classList.remove('text-red-500');
                    statusText.classList.add('text-green-500');
                    manageBtn.textContent = 'غیرفعال‌سازی';
                    manageBtn.className = 'px-4 py-2 text-sm font-semibold rounded-lg transition bg-red-100 text-red-700 hover:bg-red-200';
                } else {
                    statusText.textContent = 'وضعیت: غیرفعال';
                    statusText.classList.remove('text-green-500');
                    statusText.classList.add('text-red-500');
                    manageBtn.textContent = 'فعال‌سازی';
                    manageBtn.className = 'px-4 py-2 text-sm font-semibold rounded-lg transition bg-green-100 text-green-700 hover:bg-green-200';
                }
            };
            
            manageBtn.addEventListener('click', async () => {
                const isEnabled = localStorage.getItem(`appLockEnabled_${user.uid}`) === 'true';
                
                if (isEnabled) {
                    localStorage.removeItem(`appLockEnabled_${user.uid}`);
                    showToast('قفل برنامه غیرفعال شد.');
                    updateAppLockUI();
                } else {
                    try {
                        const options = await getRegistrationOptions(user);
                        if (!options) return;
                        
                        const regResult = await startRegistration(options);
                        
                        console.log("Data being sent to verify-registration:", JSON.stringify(regResult, null, 2));

                        const verification = await verifyRegistration(regResult);

                        if (verification && verification.verified) {
                            localStorage.setItem(`appLockEnabled_${user.uid}`, 'true');
                            showToast('قفل برنامه با Passkey فعال شد.');
                            updateAppLockUI();
                        } else {
                            showToast('ثبت Passkey ناموفق بود. لطفا دوباره تلاش کنید.');
                        }
                    } catch (error) {
                        console.error('Registration process failed:', error);
                        const errorMessage = error.name === 'NotAllowedError' 
                            ? 'فرآیند ثبت توسط شما لغو شد.' 
                            : 'یک خطای ناشناخته رخ داد. لطفا کنسول را بررسی کنید.';
                        showToast(errorMessage);
                    }
                }
            });

            updateAppLockUI();
        }
        
        function initializeAccountsPageLogic() {
            const accountsPage = document.getElementById('accounts-page');
            if (!accountsPage.innerHTML.trim()) {
                accountsPage.innerHTML = `
                    <header class="page-header">
                        <button id="go-back-to-dashboard-from-accounts" class="text-gray-600 dark:text-gray-300"><i class="fa-solid fa-arrow-right text-xl"></i></button>
                        <h1>مدیریت حساب‌ها</h1>
                        <div class="w-6"></div>
                    </header>
                    <main class="page-content p-4 space-y-3" style="padding-bottom: 6rem;">
                        <div id="accounts-list" class="space-y-3"></div>
                    </main>
                    <div class="absolute bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                        <button id="add-account-btn" class="w-full bg-blue-600 text-white font-bold rounded-lg py-3">افزودن حساب جدید</button>
                    </div>
                `;
                document.getElementById('go-back-to-dashboard-from-accounts').addEventListener('click', (e) => { e.preventDefault(); closeSubPage('view-accounts'); });
            }

            const accountsQuery = db.collection('users').doc(user.uid).collection('accounts').orderBy('order', 'asc');
            const accountsList = document.getElementById('accounts-list');
            
            accountsQuery.onSnapshot(snapshot => {
                accountsData = [];
                snapshot.forEach(doc => accountsData.push({id: doc.id, ...doc.data()}));
                
                if(!accountsList) return;
                accountsList.innerHTML = '';

                accountsData.forEach(account => {
                    let logoSrc = banks[account.bankName] || customBankLogo;
                    const itemHTML = `<div class="account-item bg-white dark:bg-slate-800 rounded-xl shadow-sm" data-id="${account.id}">
                        <div class="flex items-center p-4">
                            <i class="fas fa-grip-vertical text-gray-400 dark:text-gray-500 mr-2 ml-4 cursor-move drag-handle"></i>
                            <div class="w-16 h-10 rounded-md flex items-center justify-center flex-shrink-0"><img src="${logoSrc}" class="h-6" alt="${account.bankName}"></div>
                            <div class="mr-4 flex-grow cursor-pointer" data-action="toggle-details">
                                <p class="font-semibold text-gray-800 dark:text-gray-200" dir="ltr" data-action="copy-card">${formatCardNumberWithSpaces(account.cardNumber)}</p>
                                <p class="text-sm text-gray-500 dark:text-gray-400 amount-display">${toPersianNumerals(account.balance.toLocaleString('fa-IR'))} تومان</p>
                            </div>
                            <button class="text-gray-400 dark:text-gray-500 p-2" data-action="edit-account"><i class="fa-solid fa-pen-to-square"></i></button>
                        </div>
                        <div class="details px-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
                            <p><strong>شماره حساب:</strong> ${toPersianNumerals(account.accountNumber || '-')}</p>
                            <p><strong>شماره شبا:</strong> ${toPersianNumerals(account.iban || '-')}</p>
                            <p><strong>توضیحات:</strong> ${account.description || '-'}</p>
                        </div>
                    </div>`;
                    accountsList.insertAdjacentHTML('beforeend', itemHTML);
                });
                updateAmountsVisibility();
            });
            
            if(accountsList) {
                new Sortable(accountsList, {
                    handle: '.drag-handle', animation: 150,
                    onEnd: (evt) => {
                        const movedItem = accountsData.splice(evt.oldIndex, 1)[0];
                        accountsData.splice(evt.newIndex, 0, movedItem);
                        const batch = db.batch();
                        accountsData.forEach((account, index) => {
                            const docRef = db.collection('users').doc(user.uid).collection('accounts').doc(account.id);
                            batch.update(docRef, { order: index });
                        });
                        batch.commit().catch(error => console.error("Error updating order: ", error));
                    },
                });

                accountsList.addEventListener('click', e => {
                    const item = e.target.closest('.account-item');
                    if(!item) return;
                    
                    if(e.target.closest('[data-action="toggle-details"]')) {
                        item.classList.toggle('expanded');
                    }
                    if(e.target.closest('[data-action="edit-account"]')) {
                        const accountId = item.dataset.id;
                        const accountToEdit = accountsData.find(acc => acc.id === accountId);
                        if (accountToEdit) {
                            document.getElementById('edit-account-id').value = accountToEdit.id;
                            const editBankSelect = document.getElementById('edit-bank-name-select');
                            const editCustomBankWrapper = document.getElementById('edit-custom-bank-wrapper');
                            const editCustomBankNameInput = document.getElementById('edit-custom-bank-name');

                            if (banks[accountToEdit.bankName]) {
                                editBankSelect.value = accountToEdit.bankName;
                                editCustomBankWrapper.classList.add('hidden');
                                editCustomBankNameInput.required = false;
                            } else {
                                editBankSelect.value = 'other';
                                editCustomBankWrapper.classList.remove('hidden');
                                editCustomBankNameInput.value = accountToEdit.bankName;
                                editCustomBankNameInput.required = true;
                            }
                            document.getElementById('edit-card-number').value = formatCardNumberWithSpaces(accountToEdit.cardNumber);
                            document.getElementById('edit-expiry-date').value = accountToEdit.expiryDate;
                            document.getElementById('correct-balance').value = accountToEdit.balance;
                            mobileWrapper.classList.add('view-edit-account');
                        }
                    }
                    if (e.target.closest('[data-action="copy-card"]')) {
                        const cardNumber = e.target.textContent.replace(/\s/g, '');
                        copyToClipboard(cardNumber);
                    }
                });
            }
            
            const addAccountBtn = document.getElementById('add-account-btn');
            if(addAccountBtn) {
                addAccountBtn.addEventListener('click', () => {
                    mobileWrapper.classList.add('view-add-account');
                });
            }

            const addAccountForm = document.getElementById('add-account-form');
            const editAccountForm = document.getElementById('edit-account-form');
            const closeAddAccountBtn = document.getElementById('close-add-account-btn');
            const closeEditAccountBtn = document.getElementById('close-edit-account-btn');
            const deleteAccountBtn = document.getElementById('delete-account-btn');
            
            if(closeAddAccountBtn) closeAddAccountBtn.addEventListener('click', () => mobileWrapper.classList.remove('view-add-account'));
            if(closeEditAccountBtn) closeEditAccountBtn.addEventListener('click', () => mobileWrapper.classList.remove('view-edit-account'));

            const populateBankSelect = (selectElement) => {
                if (!selectElement) return;
                selectElement.innerHTML = '';
                for (const bankName in banks) {
                    const option = document.createElement('option');
                    option.value = bankName;
                    option.textContent = bankName;
                    selectElement.appendChild(option);
                }
                const otherOption = document.createElement('option');
                otherOption.value = 'other';
                otherOption.textContent = 'سایر موارد...';
                selectElement.appendChild(otherOption);
            };

            const bankSelect = document.getElementById('bank-name-select');
            const customBankWrapper = document.getElementById('custom-bank-wrapper');
            const customBankNameInput = document.getElementById('custom-bank-name');
            if(bankSelect) {
                bankSelect.addEventListener('change', () => {
                    customBankWrapper.classList.toggle('hidden', bankSelect.value !== 'other');
                    customBankNameInput.required = bankSelect.value === 'other';
                });
            }

            const editBankSelect = document.getElementById('edit-bank-name-select');
            const editCustomBankWrapper = document.getElementById('edit-custom-bank-wrapper');
            const editCustomBankNameInput = document.getElementById('edit-custom-bank-name');
            if(editBankSelect) {
                editBankSelect.addEventListener('change', () => {
                    editCustomBankWrapper.classList.toggle('hidden', editBankSelect.value !== 'other');
                    editCustomBankNameInput.required = editBankSelect.value === 'other';
                });
            }

            populateBankSelect(bankSelect);
            populateBankSelect(editBankSelect);
            
            const cardNumberFormatter = (input) => {
                let value = input.value.replace(/\D/g, '');
                if (value.length > 16) {
                    value = value.slice(0, 16);
                }
                input.value = value.replace(/(\d{4})/g, '$1 ').trim();
            };

            const expiryDateFormatter = (input) => {
                let value = input.value.replace(/\D/g, '');
                if (value.length > 2) {
                    value = value.slice(0, 2) + '/' + value.slice(2);
                }
                input.value = value;
            };

            const cardNumberKeydownListener = (e) => {
                const input = e.target;
                const value = input.value.replace(/\D/g, '');
                const isControlKey = e.key.length > 1 || e.ctrlKey || e.metaKey;
                if (value.length >= 16 && !isControlKey) {
                    e.preventDefault();
                }
            };

            const addCardNumberInput = document.getElementById('card-number');
            const addExpiryDateInput = document.getElementById('expiry-date');
            const editCardNumberInput = document.getElementById('edit-card-number');
            const editExpiryDateInput = document.getElementById('edit-expiry-date');

            if(addCardNumberInput) addCardNumberInput.addEventListener('input', () => cardNumberFormatter(addCardNumberInput));
            if(addCardNumberInput) addCardNumberInput.addEventListener('keydown', cardNumberKeydownListener);
            if(addExpiryDateInput) addExpiryDateInput.addEventListener('input', () => expiryDateFormatter(addExpiryDateInput));

            if(editCardNumberInput) editCardNumberInput.addEventListener('input', () => cardNumberFormatter(editCardNumberInput));
            if(editCardNumberInput) editCardNumberInput.addEventListener('keydown', cardNumberKeydownListener);
            if(editExpiryDateInput) editExpiryDateInput.addEventListener('input', () => expiryDateFormatter(editExpiryDateInput));


            if(addAccountForm) {
                addAccountForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    let bankName = bankSelect.value === 'other' ? customBankNameInput.value : bankSelect.value;
                    const newAccount = {
                        bankName: bankName, 
                        cardNumber: e.target['card-number'].value.replace(/\s/g, ''),
                        accountNumber: e.target['account-number'].value, 
                        iban: e.target['iban-number'].value, 
                        balance: parseFloat(e.target['initial-balance'].value), 
                        expiryDate: e.target['expiry-date'].value, 
                        description: e.target['description'].value, 
                        order: accountsData.length, 
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    db.collection('users').doc(user.uid).collection('accounts').add(newAccount)
                    .then(() => { addAccountForm.reset(); customBankWrapper.classList.add('hidden'); mobileWrapper.classList.remove('view-add-account'); })
                    .catch(error => console.error("Error adding document: ", error));
                });
            }

            if(editAccountForm) {
                editAccountForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const accountId = document.getElementById('edit-account-id').value;
                    let bankName = editBankSelect.value === 'other' ? editCustomBankNameInput.value : editBankSelect.value;
                    const updatedData = { 
                        bankName: bankName, 
                        cardNumber: document.getElementById('edit-card-number').value.replace(/\s/g, ''),
                        expiryDate: document.getElementById('edit-expiry-date').value, 
                        balance: parseFloat(document.getElementById('correct-balance').value), 
                    };
                    db.collection('users').doc(user.uid).collection('accounts').doc(accountId).update(updatedData)
                    .then(() => mobileWrapper.classList.remove('view-edit-account'))
                    .catch(error => console.error("Error updating document: ", error));
                });
            }

            if(deleteAccountBtn) {
                deleteAccountBtn.addEventListener('click', () => {
                    const accountId = document.getElementById('edit-account-id').value;
                    if (confirm('آیا از حذف این حساب مطمئن هستید؟')) {
                        db.collection('users').doc(user.uid).collection('accounts').doc(accountId).delete()
                        .then(() => mobileWrapper.classList.remove('view-edit-account'))
                        .catch(error => console.error("Error removing document: ", error));
                    }
                });
            }
        }
        
        function initializeSummaryPageLogic() {
            const summaryPage = document.getElementById('summary-details-page');
            if (!summaryPage.innerHTML.trim()) {
                summaryPage.innerHTML = `
                    <header class="page-header">
                        <button id="go-back-to-dashboard-from-summary" class="text-gray-600 dark:text-gray-300"><i class="fa-solid fa-arrow-right text-xl"></i></button>
                        <h1>ویرایش خلاصه وضعیت</h1>
                        <div class="w-6"></div>
                    </header>
                    <main class="page-content p-4">
                        <div id="summary-details-list" class="space-y-3"></div>
                    </main>
                `;
                document.getElementById('go-back-to-dashboard-from-summary').addEventListener('click', (e) => { e.preventDefault(); closeSubPage('view-summary-details'); });
            }


            const summaryCardsRef = db.collection('users').doc(user.uid).collection('summaryCards').orderBy('order');
            const listEl = document.getElementById('summary-details-list');
            
            if(listEl) {
                summaryCardsRef.onSnapshot(snapshot => {
                    listEl.innerHTML = '';
                    let summaryCardsData = [];
                    snapshot.forEach(doc => summaryCardsData.push({id: doc.id, ...doc.data()}));
                    
                    summaryCardsData.forEach(card => {
                        const checked = card.visible ? 'checked' : '';
                        const itemHTML = `<div class="summary-details-item bg-white dark:bg-slate-800 rounded-xl shadow-sm" data-id="${card.id}">
                            <div class="flex items-center p-4">
                                <i class="fas fa-grip-vertical text-gray-400 dark:text-gray-500 mr-2 ml-4 cursor-move drag-handle"></i>
                                <div class="flex-grow cursor-pointer" data-action="toggle-details">
                                    <p class="font-semibold text-gray-800 dark:text-gray-200">${card.title}</p>
                                    <p class="text-sm text-gray-500 dark:text-gray-400">${card.subtitle}</p>
                                </div>
                                <div class="relative inline-block w-10 mr-2 align-middle select-none">
                                    <input type="checkbox" id="toggle-${card.id}" data-id="${card.id}" class="summary-toggle-checkbox toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" ${checked}/>
                                    <label for="toggle-${card.id}" class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"></label>
                                </div>
                            </div>
                            <div class="details px-4 text-sm text-gray-600 dark:text-gray-400">
                                <p>${card.details || 'جزئیاتی برای نمایش وجود ندارد.'}</p>
                            </div>
                        </div>`;
                        listEl.insertAdjacentHTML('beforeend', itemHTML);
                    });
                });
                
                new Sortable(listEl, {
                    handle: '.drag-handle', animation: 150,
                    onEnd: (evt) => {
                         const newOrder = Array.from(listEl.children).map(item => item.dataset.id);
                         const batch = db.batch();
                         newOrder.forEach((id, index) => {
                             const docRef = db.collection('users').doc(user.uid).collection('summaryCards').doc(id);
                             batch.update(docRef, { order: index });
                         });
                         batch.commit().catch(err => console.error("Error updating order:", err));
                    },
                });

                listEl.addEventListener('click', e => {
                     const item = e.target.closest('.summary-details-item');
                     if(!item) return;

                     if(e.target.closest('[data-action="toggle-details"]')) {
                         item.classList.toggle('expanded');
                     } else if (e.target.classList.contains('summary-toggle-checkbox')) {
                         const cardId = e.target.dataset.id;
                         const isVisible = e.target.checked;
                         db.collection('users').doc(user.uid).collection('summaryCards').doc(cardId).update({ visible: isVisible });
                     }
                });
            }
        }

        function initializePersonalInfoPage() {
            const page = document.getElementById('personal-info-page');
            page.innerHTML = `
                <header class="page-header">
                    <button id="go-back-to-profile-from-info" class="text-gray-600 dark:text-gray-300"><i class="fa-solid fa-arrow-right text-xl"></i></button>
                    <h1>اطلاعات شخصی</h1>
                    <div class="w-6"></div>
                </header>
                <main class="page-content p-6">
                    <form id="personal-info-form" class="space-y-6">
                        <div>
                            <label for="info-fullname" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">نام و نام خانوادگی</label>
                            <input type="text" id="info-fullname" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required>
                        </div>
                         <div>
                            <label for="info-birthdate" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">تاریخ تولد</label>
                            <input type="tel" id="info-birthdate" placeholder="مثلا: ۱۳۷۵/۰۵/۱۴" maxlength="10" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600" style="direction: ltr; text-align: right;">
                        </div>
                        <div>
                            <label for="info-phone" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">شماره تلفن</label>
                            <input type="tel" id="info-phone" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600" style="direction: ltr; text-align: right;">
                        </div>
                        <div>
                            <label class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">جنسیت</label>
                            <div class="flex items-center space-x-4 space-x-reverse">
                                <div class="flex items-center"><input id="gender-male" type="radio" value="male" name="gender" class="w-4 h-4 text-blue-600"><label for="gender-male" class="mr-2 text-sm font-medium text-gray-900 dark:text-gray-300">مرد</label></div>
                                <div class="flex items-center"><input id="gender-female" type="radio" value="female" name="gender" class="w-4 h-4 text-pink-600"><label for="gender-female" class="mr-2 text-sm font-medium text-gray-900 dark:text-gray-300">زن</label></div>
                            </div>
                        </div>
                        <div class="pt-4"><button type="submit" class="w-full text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-3 text-center">ذخیره تغییرات</button></div>
                    </form>
                </main>
            `;
            document.getElementById('go-back-to-profile-from-info').addEventListener('click', (e) => {
                e.preventDefault();
                closeSubPage('view-personal-info');
            });

            const userDocRef = db.collection('users').doc(user.uid);
            const form = document.getElementById('personal-info-form');
            userDocRef.get().then(doc => {
                if(doc.exists) {
                    const data = doc.data();
                    form.querySelector('#info-fullname').value = data.fullName || '';
                    form.querySelector('#info-birthdate').value = data.birthDate || '';
                    form.querySelector('#info-phone').value = data.phoneNumber || '';
                    if(data.gender) {
                        form.querySelector(`input[name="gender"][value="${data.gender}"]`).checked = true;
                    }
                }
            });

            form.addEventListener('submit', e => {
                e.preventDefault();
                const updatedData = {
                    fullName: form.querySelector('#info-fullname').value,
                    birthDate: form.querySelector('#info-birthdate').value,
                    phoneNumber: form.querySelector('#info-phone').value,
                    gender: form.querySelector('input[name="gender"]:checked')?.value || null,
                };
                userDocRef.set(updatedData, { merge: true })
                    .then(() => closeSubPage('view-personal-info'))
                    .catch(err => console.error("Error updating profile:", err));
            });
        }

        function renderDashboardAccounts() {
            db.collection('users').doc(user.uid).collection('accounts').orderBy('order', 'asc').onSnapshot(snapshot => {
                if (!swiperInstance || swiperInstance.destroyed) return;
                
                swiperInstance.removeAllSlides();

                let totalBalance = 0;
                if (snapshot.empty) {
                    swiperInstance.appendSlide(`<div class="swiper-slide"><div class="glass-card rounded-2xl p-4 text-white aspect-[1.586] flex items-center justify-center"><p>حسابی وجود ندارد</p></div></div>`);
                } else {
                    snapshot.forEach(doc => {
                        const account = doc.data();
                        let logoSrc = banks[account.bankName] || customBankLogo;
                        totalBalance += account.balance;
                        const slideHTML = `
                        <div class="swiper-slide">
                            <div class="glass-card rounded-2xl p-4 text-white aspect-[1.586] flex flex-col justify-between">
                                <div class="flex items-center space-x-2 space-x-reverse">
                                    <img src="${logoSrc}" class="h-8 object-contain" alt="${account.bankName}">
                                    <span class="border-r border-white/50 h-6"></span>
                                    <span class="text-sm opacity-80">${account.bankName}</span>
                                </div>
                                <div class="cursor-pointer" data-action="copy-card">
                                    <p class="tracking-wider text-base text-left" dir="ltr">${formatCardNumberWithSpaces(account.cardNumber)}</p>
                                    <div class="flex justify-between items-end mt-2">
                                        <p class="text-lg font-bold card-balance amount-display">${toPersianNumerals(account.balance.toLocaleString('fa-IR'))}</p>
                                        <p class="text-xs opacity-80">${toPersianNumerals(account.expiryDate)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                        swiperInstance.appendSlide(slideHTML);
                    });
                }
                
                swiperInstance.update();

                const totalBalanceEl = document.querySelector('#total-balance-container p.amount-display');
                if(totalBalanceEl) {
                    const formattedTotal = toPersianNumerals(totalBalance.toLocaleString('fa-IR'));
                    totalBalanceEl.textContent = formattedTotal;
                    totalBalanceEl.dataset.originalValue = formattedTotal;
                }
                updateAmountsVisibility();
            });
        }

        function renderDashboardSummaryCards() {
            db.collection('users').doc(user.uid).collection('summaryCards').orderBy('order').onSnapshot(snapshot => {
                const listEl = document.getElementById('dashboard-summary-list');
                if (!listEl) return;
                listEl.innerHTML = '';
                const visibleCards = snapshot.docs.map(doc => doc.data()).filter(card => card.visible);

                if (visibleCards.length === 0) {
                    listEl.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 py-4">کارتی برای نمایش انتخاب نشده است.</p>`;
                } else {
                    visibleCards.forEach(card => {
                        const cardHTML = `<div class="summary-details-item bg-white dark:bg-slate-800 rounded-xl shadow-sm cursor-pointer">
                            <div class="p-4 flex items-center justify-between">
                                <div><p class="font-semibold text-gray-800 dark:text-gray-200">${card.title}</p><p class="text-sm text-gray-500 dark:text-gray-400">${card.subtitle}</p></div>
                                <p class="text-lg font-bold text-gray-700 dark:text-gray-300 amount-display">${toPersianNumerals(card.value)}</p>
                            </div>
                            <div class="details px-4 text-sm text-gray-600 dark:text-gray-400">
                                <p>${card.details || 'جزئیاتی برای نمایش وجود ندارد.'}</p>
                            </div>
                        </div>`;
                        listEl.insertAdjacentHTML('beforeend', cardHTML);
                    });
                }
                updateAmountsVisibility();
            });
        }
        
        function copyToClipboard(text) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast("شماره کارت کپی شد!");
        }

        function showToast(message) {
            let toast = document.getElementById('toast-notification');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'toast-notification';
                document.body.appendChild(toast);
            }
            toast.textContent = message;
            toast.className = 'show';
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="copy-card"]')) {
                const cardElement = e.target.closest('[data-action="copy-card"]').querySelector('p[dir="ltr"]');
                if (cardElement) {
                    const cardNumber = cardElement.textContent.replace(/\s/g, '');
                    copyToClipboard(cardNumber);
                }
            }
        });

        performInitialLoad();
        initializeSubPageScripts();
    }
});
