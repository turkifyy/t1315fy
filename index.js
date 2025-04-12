// functions/index.js (الجزء الخاص بالروابط)

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const {Storage} = require('@google-cloud/storage');
const axios = require('axios');

// 1. تقصير الروابط باستخدام Firebase Dynamic Links
exports.shortenUrl = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 'يجب تسجيل الدخول لتقصير الروابط');
    }

    const {url} = data;
    const domainUriPrefix = 'https://yourdomain.page.link'; // استبدله برابطك
    const apiKey = 'YOUR_FIREBASE_WEB_API_KEY'; // استبدله بمفتاحك

    try {
        // التحقق من الرابط أولاً
        const validationResult = await validateLink(url);
        if (!validationResult.valid) {
            throw new functions.https.HttpsError(
                'invalid-argument', 
                'رابط غير صالح: ' + validationResult.reason
            );
        }

        // إنشاء رابط قصير
        const response = await axios.post(
            `https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${apiKey}`,
            {
                dynamicLinkInfo: {
                    domainUriPrefix,
                    link: url
                },
                suffix: {
                    option: 'SHORT'
                }
            }
        );

        return {
            originalUrl: url,
            shortUrl: response.data.shortLink,
            previewUrl: response.data.previewLink
        };
    } catch (error) {
        console.error('Error shortening URL:', error);
        throw new functions.https.HttpsError(
            'internal', 
            'حدث خطأ أثناء تقصير الرابط',
            error.message
        );
    }
});

// 2. التحقق من الروابط باستخدام Safe Browsing API
exports.checkUrlSafety = functions.https.onCall(async (data, context) => {
    const {url} = data;
    const apiKey = 'YOUR_GOOGLE_API_KEY'; // استبدله بمفتاحك

    try {
        const response = await axios.post(
            `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
            {
                client: {
                    clientId: "your-app-id",
                    clientVersion: "1.0"
                },
                threatInfo: {
                    threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
                    platformTypes: ["ANY_PLATFORM"],
                    threatEntryTypes: ["URL"],
                    threatEntries: [{url}]
                }
            }
        );

        return {
            safe: !response.data.matches,
            threats: response.data.matches || []
        };
    } catch (error) {
        console.error('Error checking URL safety:', error);
        throw new functions.https.HttpsError(
            'internal', 
            'حدث خطأ أثناء التحقق من الرابط',
            error.message
        );
    }
});

// 3. دالة مساعدة للتحقق من الروابط
async function validateLink(url) {
    try {
        const parsed = new URL(url);
        
        // قائمة النطاقات المسموحة
        const allowedDomains = [
            'youtube.com',
            'youtu.be',
            'vimeo.com',
            'dailymotion.com',
            'tiktok.com',
            'instagram.com',
            'example.com'
        ];
        
        // التحقق من النطاق
        const domainValid = allowedDomains.some(domain => 
            parsed.hostname.includes(domain)
        );
        
        if (!domainValid) {
            return {
                valid: false,
                reason: 'النطاق غير مسموح به'
            };
        }
        
        // التحقق من HTTPS
        if (parsed.protocol !== 'https:') {
            return {
                valid: false,
                reason: 'يجب استخدام رابط آمن (HTTPS)'
            };
        }
        
        return {valid: true};
        
    } catch (e) {
        return {
            valid: false,
            reason: 'رابط غير صالح'
        };
    }
}