// assets/js/offline.js

// 1. تسجيل Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// 2. إعداد كاش التطبيق
const CACHE_NAME = 'qasir-offline-v1';
const OFFLINE_URL = '/offline.html';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/app.html',
    '/assets/css/main.css',
    '/assets/css/auth.css',
    '/assets/js/app.js',
    '/assets/js/auth.js',
    '/assets/js/video.js',
    '/assets/images/logo.svg',
    '/assets/images/offline-illustration.svg',
    '/manifest.webmanifest'
];

// 3. تنصيب Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching assets for offline use');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// 4. تفعيل Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    event.waitUntil(self.clients.claim());
});

// 5. إستراتيجية التخزين المؤقت (Cache First with Network Fallback)
self.addEventListener('fetch', event => {
    // تجاهل طلبات POST وطلبات أخرى غير GET
    if (event.request.method !== 'GET') return;

    // معالجة طلبات الصفحات
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    // معالجة طلبات الأصول الأخرى
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                const fetchPromise = fetch(event.request)
                    .then(networkResponse => {
                        // تحديث الكاش مع النسخة الجديدة من المورد
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(event.request, networkResponse.clone()));
                        return networkResponse;
                    })
                    .catch(() => {
                        // إذا فشل الاتصال بالإنترنت
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                    });
                return cachedResponse || fetchPromise;
            })
    );
});

// 6. اكتشاف حالة الاتصال
const updateOnlineStatus = () => {
    const connectionBanner = document.getElementById('connectionBanner');
    if (navigator.onLine) {
        connectionBanner.style.display = 'none';
        console.log('Connection restored');
    } else {
        connectionBanner.style.display = 'flex';
        console.log('Connection lost - Offline mode activated');
    }
};

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// 7. تخزين الفيديوهات مؤقتًا للعرض بدون اتصال
const videoCache = {
    init: async () => {
        this.cache = await caches.open('videos-cache');
    },

    storeVideo: async (videoId, videoData) => {
        const url = `/api/videos/${videoId}`;
        const response = new Response(JSON.stringify(videoData), {
            headers: { 'Content-Type': 'application/json' }
        });
        await this.cache.put(url, response);
    },

    getVideo: async (videoId) => {
        const url = `/api/videos/${videoId}`;
        const response = await this.cache.match(url);
        return response ? response.json() : null;
    },

    getAllVideos: async () => {
        const keys = await this.cache.keys();
        const videoRequests = keys.filter(request => request.url.includes('/api/videos/'));
        return Promise.all(videoRequests.map(request => this.cache.match(request).then(res => res.json())));
    }
};

// 8. تهيئة التطبيق للعمل بدون اتصال
const initOfflineMode = () => {
    // التحقق من حالة الاتصال عند التحميل
    updateOnlineStatus();
    
    // تهيئة كاش الفيديوهات
    videoCache.init();
    
    // اعتراض طلبات API للعمل بدون اتصال
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            if (registration.active) {
                console.log('Service Worker ready for offline use');
            }
        });
    }
    
    // عرض رسالة عند محاولة رفع فيديو بدون اتصال
    document.getElementById('importBtn').addEventListener('click', () => {
        if (!navigator.onLine) {
            alert('لا يمكن استيراد الفيديوهات بدون اتصال بالإنترنت');
            return false;
        }
    });
};

// 9. تصدير الدوال للاستخدام في الملفات الأخرى
export { initOfflineMode, videoCache };