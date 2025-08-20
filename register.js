import { firebaseConfig } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

// راه‌اندازی فایربیس
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {

    const registerForm = document.querySelector('form'); // انتخاب فرم بر اساس تگ

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const fullName = registerForm['full-name'].value;
            const email = registerForm['email-address'].value;
            const password = registerForm.password.value;
            const confirmPassword = registerForm['confirm-password'].value;

            // چک کردن برابری رمزهای عبور
            if (password !== confirmPassword) {
                alert('رمزهای عبور با هم مطابقت ندارند.');
                return;
            }

            // ایجاد کاربر جدید در Firebase Authentication
            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    console.log('کاربر با موفقیت ثبت‌نام کرد:', user.uid);

                    // ذخیره اطلاعات اضافی کاربر (مثل نام) در Firestore
                    const userDocRef = doc(db, 'users', user.uid);
                    return setDoc(userDocRef, {
                        fullName: fullName,
                        email: email,
                        createdAt: new Date()
                    });
                })
                .then(() => {
                    console.log('پروفایل کاربر در Firestore ایجاد شد.');
                    // پس از ثبت‌نام و ایجاد پروفایل موفق، کاربر به داشبورد منتقل می‌شود
                    window.location.href = 'dashboard.html';
                })
                .catch((error) => {
                    console.error('خطا در ثبت‌نام:', error);
                    if (error.code === 'auth/email-already-in-use') {
                        alert('این ایمیل قبلا استفاده شده است.');
                    } else if (error.code === 'auth/weak-password') {
                        alert('رمز عبور باید حداقل ۶ کاراکتر باشد.');
                    } else {
                        alert('خطا در ثبت نام. لطفا دوباره تلاش کنید.');
                    }
                });
        });
    }

    // --- منطق تغییر تم (تاریک/روشن) ---
    const themeToggleButton = document.getElementById('theme-toggle');
    const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
    const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

    if (themeToggleButton) {
        const setInitialTheme = () => {
            const savedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
                document.documentElement.classList.add('dark');
                themeToggleLightIcon.classList.remove('hidden');
                themeToggleDarkIcon.classList.add('hidden');
            } else {
                document.documentElement.classList.remove('dark');
                themeToggleDarkIcon.classList.remove('hidden');
                themeToggleLightIcon.classList.add('hidden');
            }
        };
        setInitialTheme();

        themeToggleButton.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            const isDarkMode = document.documentElement.classList.contains('dark');
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            if (isDarkMode) {
                themeToggleLightIcon.classList.remove('hidden');
                themeToggleDarkIcon.classList.add('hidden');
            } else {
                themeToggleDarkIcon.classList.remove('hidden');
                themeToggleLightIcon.classList.add('hidden');
            }
        });
    }
});
