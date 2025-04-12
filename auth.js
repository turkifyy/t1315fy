// auth.js - منطق المصادقة باستخدام Google فقط

// تهيئة Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDxAsJt7qc0jJgi2k4mvXDGWKY34wGm60k",
    authDomain: "turkify-afa2f.firebaseapp.com",
    projectId: "turkify-afa2f",
    storageBucket: "turkify-afa2f.firebasestorage.app",
    messagingSenderId: "387845497284",
    appId: "1:387845497284:web:ff1d1022e8eac9db374491"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);

// العناصر DOM
const DOM = {
    authContainer: document.getElementById('authContainer'),
    googleLoginBtn: document.getElementById('googleLoginBtn'),
    authError: document.getElementById('authError'),
    authLoading: document.getElementById('authLoading')
};

// تهيئة المصادقة
function initAuth() {
    // تعيين معالج الأحداث
    setupEventListeners();
    
    // التحقق من حالة المصادقة
    checkAuthState();
}

// تعيين معالج الأحداث
function setupEventListeners() {
    // المصادقة باستخدام جوجل
    DOM.googleLoginBtn.addEventListener('click', loginWithGoogle);
}

// المصادقة باستخدام جوجل
function loginWithGoogle() {
    // إظهار شاشة التحميل
    showLoading();
    
    // إنشاء مزود جوجل
    const provider = new firebase.auth.GoogleAuthProvider();
    
    // إضافة نطاقات إضافية إذا لزم الأمر
    provider.addScope('profile');
    provider.addScope('email');
    
    // تسجيل الدخول
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            // تسجيل الدخول الناجح
            handleSuccessfulAuth(result.user);
            
            // حفظ معلومات إضافية إذا كان المستخدم جديداً
            if (result.additionalUserInfo?.isNewUser) {
                saveAdditionalUserData(result.user.uid, {
                    name: result.user.displayName,
                    email: result.user.email,
                    photoURL: result.user.photoURL,
                    provider: 'google.com',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        })
        .catch((error) => {
            // معالجة الأخطاء
            handleAuthError(error);
        })
        .finally(() => {
            // إخفاء شاشة التحميل
            hideLoading();
        });
}

// حفظ بيانات إضافية للمستخدم في Firestore
function saveAdditionalUserData(userId, data) {
    return firebase.firestore().collection('users').doc(userId).set(data, { merge: true });
}

// التحقق من حالة المصادقة
function checkAuthState() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // المستخدم مسجل الدخول
            handleSuccessfulAuth(user);
        } else {
            // لا يوجد مستخدم مسجل الدخول
            handleSignOut();
        }
    });
}

// معالجة تسجيل الدخول الناجح
function handleSuccessfulAuth(user) {
    // إخفاء رسائل الخطأ
    hideError();
    
    // حفظ بيانات الجلسة
    sessionStorage.setItem('authUser', JSON.stringify({
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        provider: user.providerData[0].providerId
    }));
    
    // التوجيه إلى الصفحة الرئيسية
    window.location.href = '/dashboard';
}

// معالجة تسجيل الخروج
function handleSignOut() {
    // مسح بيانات الجلسة
    sessionStorage.removeItem('authUser');
}

// معالجة أخطاء المصادقة
function handleAuthError(error) {
    let errorMessage = 'حدث خطأ أثناء المصادقة';
    
    switch (error.code) {
        case 'auth/popup-closed-by-user':
            errorMessage = 'تم إغلاق نافذة المصادقة';
            break;
        case 'auth/cancelled-popup-request':
            errorMessage = 'تم إلغاء طلب المصادقة';
            break;
        case 'auth/popup-blocked':
            errorMessage = 'تم حظر نافذة المصادقة، الرجاء السماح بالنوافذ المنبثقة';
            break;
        case 'auth/account-exists-with-different-credential':
            errorMessage = 'يوجد حساب آخر بنفس البريد الإلكتروني';
            break;
        default:
            errorMessage = error.message || 'حدث خطأ غير متوقع';
    }
    
    showError(errorMessage);
}

// إظهار رسالة خطأ
function showError(message) {
    DOM.authError.textContent = message;
    DOM.authError.classList.add('show');
}

// إخفاء رسالة الخطأ
function hideError() {
    DOM.authError.classList.remove('show');
}

// إظهار شاشة التحميل
function showLoading() {
    DOM.authLoading.classList.add('show');
    DOM.googleLoginBtn.disabled = true;
}

// إخفاء شاشة التحميل
function hideLoading() {
    DOM.authLoading.classList.remove('show');
    DOM.googleLoginBtn.disabled = false;
}

// تسجيل الخروج
function signOut() {
    firebase.auth().signOut().then(() => {
        handleSignOut();
        window.location.href = '/login';
    }).catch((error) => {
        console.error('Error signing out:', error);
    });
}

// تهيئة المصادقة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initAuth);

// تصدير الدوال اللازمة للاستخدام في ملفات أخرى
export {
    signOut,
    checkAuthState,
    getCurrentUser: () => JSON.parse(sessionStorage.getItem('authUser'))
};
