// assets/js/linkValidation.js

class LinkValidator {
    constructor() {
        this.allowedDomains = [
            'youtube.com',
            'youtu.be',
            'vimeo.com',
            'dailymotion.com',
            'tiktok.com',
            'instagram.com',
            'example.com' // استبدله بالنطاقات المسموحة في تطبيقك
        ];
        
        this.whitelist = [];
        this.blacklist = [];
        this.suspiciousPatterns = [
            /(?:phishing|malware|scam|spam)/i,
            /\.exe$|\.js$|\.jar$|\.bat$/i,
            /[\u0590-\u05FF]/ // حروف عبرية للكشف عن روابط احتيالية
        ];
        
        this.init();
    }

    async init() {
        await this.loadDomainLists();
        this.setupEventListeners();
    }

    async loadDomainLists() {
        try {
            // تحميل القوائم من Firestore أو ملف محلي
            const snapshot = await firebase.firestore()
                .collection('securitySettings')
                .doc('linkValidation')
                .get();
            
            const data = snapshot.data();
            this.whitelist = data?.whitelist || [];
            this.blacklist = data?.blacklist || [];
            
            console.log('تم تحميل قوائم التحقق من الروابط');
        } catch (error) {
            console.error('حدث خطأ أثناء تحميل قوائم التحقق:', error);
        }
    }

    setupEventListeners() {
        // التحقق من الروابط عند إدخالها في النماذج
        document.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                this.detectAndValidateLinks(e.target);
            }
        });

        // التحقق من الروابط قبل إرسال النماذج
        document.addEventListener('submit', (e) => {
            const links = this.extractLinksFromForm(e.target);
            const validation = this.validateMultipleLinks(links);
            
            if (!validation.allValid) {
                e.preventDefault();
                this.showLinkValidationAlert(validation);
            }
        });
    }

    detectAndValidateLinks(element) {
        const text = element.value;
        const links = this.extractLinks(text);
        
        links.forEach(link => {
            const result = this.validateLink(link);
            if (!result.valid) {
                this.highlightInvalidLink(element, link, result.reason);
            }
        });
    }

    extractLinksFromForm(form) {
        const links = [];
        const inputs = form.querySelectorAll('input, textarea');
        
        inputs.forEach(input => {
            links.push(...this.extractLinks(input.value));
        });
        
        return links;
    }

    extractLinks(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.match(urlRegex) || [];
    }

    validateMultipleLinks(links) {
        const results = {
            allValid: true,
            invalidLinks: []
        };
        
        links.forEach(link => {
            const validation = this.validateLink(link);
            if (!validation.valid) {
                results.allValid = false;
                results.invalidLinks.push({
                    link,
                    reason: validation.reason
                });
            }
        });
        
        return results;
    }

    validateLink(url) {
        try {
            // 1. التحقق من الشكل العام للرابط
            const parsedUrl = new URL(url);
            
            // 2. التحقق من النطاقات المسموحة
            const domainValid = this.allowedDomains.some(domain => 
                parsedUrl.hostname.includes(domain)
            );
            
            if (!domainValid) {
                return {
                    valid: false,
                    reason: 'النطاق غير مسموح به',
                    domain: parsedUrl.hostname
                };
            }
            
            // 3. التحقق من القائمة السوداء
            if (this.blacklist.some(blackDomain => 
                parsedUrl.hostname.includes(blackDomain))
            ) {
                return {
                    valid: false,
                    reason: 'النطاق محظور',
                    domain: parsedUrl.hostname
                };
            }
            
            // 4. التحقق من الأنماط المشبوهة
            const suspicious = this.suspiciousPatterns.some(pattern => 
                pattern.test(url)
            );
            
            if (suspicious) {
                return {
                    valid: false,
                    reason: 'الرابط يحتوي على أنماط مشبوهة',
                    domain: parsedUrl.hostname
                };
            }
            
            // 5. التحقق من القائمة البيضاء (إذا كانت غير فارغة)
            if (this.whitelist.length > 0 && !this.whitelist.some(whiteDomain => 
                parsedUrl.hostname.includes(whiteDomain))
            ) {
                return {
                    valid: false,
                    reason: 'النطاق غير موجود في القائمة البيضاء',
                    domain: parsedUrl.hostname
                };
            }
            
            // 6. التحقق من HTTPS (اختياري)
            if (parsedUrl.protocol !== 'https:') {
                return {
                    valid: false,
                    reason: 'يجب استخدام رابط آمن (HTTPS)',
                    domain: parsedUrl.hostname
                };
            }
            
            return { valid: true };
            
        } catch (e) {
            return {
                valid: false,
                reason: 'رابط غير صالح',
                domain: ''
            };
        }
    }

    highlightInvalidLink(element, link, reason) {
        // يمكنك تخصيص هذه الدالة لتظهر تحذيرات في الواجهة
        const errorSpan = document.createElement('span');
        errorSpan.className = 'link-validation-error';
        errorSpan.textContent = `تحذير: ${reason} - ${link}`;
        errorSpan.style.color = 'red';
        errorSpan.style.display = 'block';
        errorSpan.style.fontSize = '12px';
        
        element.parentNode.insertBefore(errorSpan, element.nextSibling);
        
        // إزالة التحذير بعد 5 ثواني
        setTimeout(() => {
            errorSpan.remove();
        }, 5000);
    }

    showLinkValidationAlert(validation) {
        const alertBox = document.createElement('div');
        alertBox.className = 'link-validation-alert';
        alertBox.style.position = 'fixed';
        alertBox.style.top = '20px';
        alertBox.style.right = '20px';
        alertBox.style.backgroundColor = '#ffebee';
        alertBox.style.border = '1px solid #f44336';
        alertBox.style.borderRadius = '4px';
        alertBox.style.padding = '15px';
        alertBox.style.zIndex = '10000';
        alertBox.style.maxWidth = '400px';
        
        let alertContent = `
            <h3 style="margin-top: 0; color: #d32f2f;">تحذير: روابط غير صالحة</h3>
            <p>يحتوي النموذج على الروابط التالية التي لا تلبي شروط الأمان:</p>
            <ul style="padding-left: 20px;">
        `;
        
        validation.invalidLinks.forEach(item => {
            alertContent += `<li><strong>${item.link}</strong>: ${item.reason}</li>`;
        });
        
        alertContent += `
            </ul>
            <p>الرجاء إزالة أو تصحيح هذه الروابط قبل الإرسال.</p>
            <button id="dismissAlert" style="
                background: #d32f2f;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
            ">حسنًا</button>
        `;
        
        alertBox.innerHTML = alertContent;
        document.body.appendChild(alertBox);
        
        alertBox.querySelector('#dismissAlert').addEventListener('click', () => {
            alertBox.remove();
        });
    }

    async checkLinkSafety(url) {
        try {
            // استخدام Safe Browsing API من Google (يتطلب مفتاح API)
            const apiKey = 'YOUR_GOOGLE_API_KEY'; // استبدله بمفتاحك
            const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
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
                })
            });
            
            const data = await response.json();
            return data.matches ? {safe: false, threats: data.matches} : {safe: true};
            
        } catch (error) {
            console.error('Error checking link safety:', error);
            return {safe: false, error: 'Failed to check link'};
        }
    }

    async shortenLink(url) {
        try {
            // تقصير الروابط باستخدام Firebase Dynamic Links
            const shortenUrl = firebase.functions().httpsCallable('shortenUrl');
            const result = await shortenUrl({url});
            return result.data.shortUrl;
        } catch (error) {
            console.error('Error shortening URL:', error);
            return url; // إرجاع الرابط الأصلي في حالة الخطأ
        }
    }

    extractDomain(url) {
        try {
            const parsed = new URL(url);
            return parsed.hostname.replace('www.', '');
        } catch {
            return null;
        }
    }

    isInternalLink(url) {
        const domain = this.extractDomain(url);
        return domain && (domain === window.location.hostname);
    }
}

// تهيئة النظام عند تحميل الصفحة
const linkValidator = new LinkValidator();

// تصدير الدوال للاستخدام في ملفات أخرى
export {
    linkValidator,
    LinkValidator
};