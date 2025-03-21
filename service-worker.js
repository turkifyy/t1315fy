// تحديد اسم الكاش وإصداره
const CACHE_NAME = "turkify-cache-v3"; // قم بتحديث رقم الإصدار عند تحديث الموقع

// الملفات التي سيتم تخزينها في الكاش
const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/script.js",
  "/icons/icon-72x72.png",
  "/icons/icon-96x96.png",
  "/icons/icon-144x144.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/manifest.json"
];

// تثبيت الـ Service Worker وتخزين الملفات في الكاش
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// تفعيل Service Worker وحذف الكاش القديم عند التحديث
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("حذف الكاش القديم:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// جلب الملفات من الكاش أو الشبكة إذا كانت غير موجودة في الكاش
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    }).catch(() => caches.match("/offline.html")) // عرض صفحة Offline إذا لم يكن هناك اتصال
  );
});

// تحديث الكاش تلقائيًا عند توفر نسخة جديدة
self.addEventListener("message", (event) => {
  if (event.data.action === "skipWaiting") {
    self.skipWaiting();
  }
});
