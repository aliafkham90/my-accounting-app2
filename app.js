import { firebaseConfig } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    
    const splashScreen = document.getElementById('splash-screen');
    const mainContent = document.getElementById('main-content');
    const emailInput = document.getElementById('email-address');
    const passwordInput = document.getElementById('password');
    
    // تابع برای نمایش فرم ورود
    const showLoginForm = () => {
        splashScreen.style.opacity = '0';
        // تعیین تم پس‌زمینه بر اساس تنظیمات ذخیره شده
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
        
        setTimeout(() => {
            splashScreen.style.display = 'none';
            // رنگ پس‌زمینه بر اساس تم تنظیم می‌شود
            document.body.style.backgroundColor = isDark ? '#111827' : '#f0f4f8';
            mainContent.style.opacity = '1';
            
            // حذف readonly و tabindex و فوکوس روی ایمیل
            emailInput.removeAttribute('tabindex');
            passwordInput.removeAttribute('tabindex');
            emailInput.readOnly = false;
            passwordInput.readOnly = false;
            emailInput.focus();
        }, 500); // همگام با انیمیشن opacity
    };

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // اگر کاربر لاگین بود، بلافاصله به داشبورد منتقل شود
            // اسپلش اسکرین خود داشبورد مسئولیت نمایش لودینگ را بر عهده می‌گیرد
            window.location.href = 'dashboard.html';
        } else {
            // اگر کاربر لاگین نبود، پس از مدتی فرم ورود نمایش داده شود
            setTimeout(showLoginForm, 2000); // نمایش فرم پس از 2 ثانیه
        }
    });

    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = loginForm['email-address'].value;
            const password = loginForm.password.value;

            signInWithEmailAndPassword(auth, email, password)
                .catch((error) => {
                    console.error('خطا در ورود:', error);
                    alert('ایمیل یا رمز عبور اشتباه است.');
                });
        });
    }

    const tempLoginLink = document.querySelector('a[href="dashboard.html?test=true"]');
    if (tempLoginLink) {
        tempLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signInAnonymously(auth)
                .catch((error) => {
                    console.error('خطا در ورود موقت:', error);
                    alert('ورود موقت با مشکل مواجه شد.');
                });
        });
    }

    const themeToggleButton = document.getElementById('theme-toggle');
    if (themeToggleButton) {
        const setInitialTheme = () => {
            const savedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        };
        setInitialTheme();

        themeToggleButton.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            const isDarkMode = document.documentElement.classList.contains('dark');
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        });
    }

    const togglePasswordButton = document.getElementById('toggle-password');
    if (togglePasswordButton) {
        const toggleIcon = togglePasswordButton.querySelector('i');
        togglePasswordButton.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            toggleIcon.classList.toggle('fa-eye-slash');
            toggleIcon.classList.toggle('fa-eye');
        });
    }
});
