importScripts('https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js');
// تحديد اسم الكاش وإصداره
const CACHE_NAME = "turkify-cache-v3"; // قم بتحديث رقم الإصدار عند تحديث الموقع

// الملفات التي سيتم تخزينها في الكاش
const urlsToCache = [
  "/",
  "https://turkify.netlify.app",
  "https://turkify.netlify.app/logo-72%C3%9772-20252026.png",
  "https://turkify.netlify.app/logo%C3%9796%C3%9796-20252026.png",
  "https://turkify.netlify.app/logo-144%C3%97144-20252026.png",
  "https://turkify.netlify.app/logo-192%C3%97192-20252026.png",
  "https://turkify.netlify.app/logo-512x512-20252026.png",
  "https://turkify.netlify.app/manifest.json"
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
    }).catch(() => caches.match("https://turkify.netlify.app")) // عرض صفحة Offline إذا لم يكن هناك اتصال
  );
});

// تحديث الكاش تلقائيًا عند توفر نسخة جديدة
self.addEventListener("message", (event) => {
  if (event.data.action === "skipWaiting") {
    self.skipWaiting();
  }
});

