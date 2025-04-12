// assets/js/ai.js

class AISystem {
    constructor() {
        this.userPreferences = {};
        this.watchHistory = [];
        this.interactionHistory = [];
        this.recommendations = [];
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;

        await this.loadUserData();
        this.setupEventListeners();
        this.isInitialized = true;
        
        // تحميل نموذج الذكاء الاصطناعي عند الحاجة
        if (this.shouldLoadAIModel()) {
            await this.loadAIModel();
        }
    }

    async loadUserData() {
        try {
            const userId = firebase.auth().currentUser?.uid;
            if (!userId) return;

            // تحميل تفضيلات المستخدم
            const userPrefs = await firebase.firestore()
                .collection('users')
                .doc(userId)
                .get();
            
            this.userPreferences = userPrefs.data()?.preferences || {};
            
            // تحميل سجل المشاهدة
            const watchSnap = await firebase.firestore()
                .collection('users')
                .doc(userId)
                .collection('watchHistory')
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();
            
            this.watchHistory = watchSnap.docs.map(doc => doc.data());
            
            // تحميل سجل التفاعلات
            const interactSnap = await firebase.firestore()
                .collection('users')
                .doc(userId)
                .collection('interactions')
                .orderBy('timestamp', 'desc')
                .limit(200)
                .get();
            
            this.interactionHistory = interactSnap.docs.map(doc => doc.data());
            
            console.log('تم تحميل بيانات المستخدم للذكاء الاصطناعي');
        } catch (error) {
            console.error('حدث خطأ أثناء تحميل بيانات المستخدم:', error);
        }
    }

    setupEventListeners() {
        // تتبع مشاهدات الفيديو
        document.addEventListener('videoPlay', (e) => {
            this.recordVideoWatch(e.detail.videoId, e.detail.duration);
        });

        // تتبع التفاعلات
        document.addEventListener('videoLike', (e) => {
            this.recordInteraction({
                type: 'like',
                videoId: e.detail.videoId,
                value: e.detail.isLiked ? 1 : -1
            });
        });

        document.addEventListener('videoShare', (e) => {
            this.recordInteraction({
                type: 'share',
                videoId: e.detail.videoId
            });
        });

        document.addEventListener('commentPosted', (e) => {
            this.recordInteraction({
                type: 'comment',
                videoId: e.detail.videoId,
                text: e.detail.text
            });
        });
    }

    async loadAIModel() {
        try {
            // هنا يمكنك تحميل نماذج TensorFlow.js أو استخدام واجهات برمجة التطبيقات الخارجية
            console.log('جاري تحميل نموذج الذكاء الاصطناعي...');
            
            // مثال: تحميل نموذج توصية
            // this.model = await tf.loadLayersModel('/models/recommendation/model.json');
            
            console.log('تم تحميل نموذج الذكاء الاصطناعي بنجاح');
            return true;
        } catch (error) {
            console.error('حدث خطأ أثناء تحميل نموذج الذكاء الاصطناعي:', error);
            return false;
        }
    }

    shouldLoadAIModel() {
        // يمكنك إضافة شروط محددة لتحميل النموذج عند الحاجة
        return this.watchHistory.length > 5;
    }

    async recordVideoWatch(videoId, duration) {
        const userId = firebase.auth().currentUser?.uid;
        if (!userId) return;

        try {
            // تسجيل المشاهدة محليًا
            this.watchHistory.unshift({
                videoId,
                duration,
                timestamp: new Date()
            });

            // تسجيل المشاهدة في Firestore
            await firebase.firestore()
                .collection('users')
                .doc(userId)
                .collection('watchHistory')
                .add({
                    videoId,
                    duration,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

            // تحديث التوصيات
            this.updateRecommendations();
        } catch (error) {
            console.error('حدث خطأ أثناء تسجيل مشاهدة الفيديو:', error);
        }
    }

    async recordInteraction(interaction) {
        const userId = firebase.auth().currentUser?.uid;
        if (!userId) return;

        try {
            // تسجيل التفاعل محليًا
            this.interactionHistory.unshift({
                ...interaction,
                timestamp: new Date()
            });

            // تسجيل التفاعل في Firestore
            await firebase.firestore()
                .collection('users')
                .doc(userId)
                .collection('interactions')
                .add({
                    ...interaction,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

            // تحديث التوصيات بناءً على التفاعل الجديد
            this.updateRecommendations();
        } catch (error) {
            console.error('حدث خطأ أثناء تسجيل التفاعل:', error);
        }
    }

    async updateRecommendations() {
        try {
            // الحصول على توصيات من السحابة (Firebase Functions)
            const getRecommendations = firebase.functions().httpsCallable('getRecommendations');
            const response = await getRecommendations({
                userId: firebase.auth().currentUser?.uid,
                history: this.watchHistory.slice(0, 20),
                interactions: this.interactionHistory.slice(0, 50)
            });

            this.recommendations = response.data.recommendations;
            this.triggerRecommendationsUpdate();
        } catch (error) {
            console.error('حدث خطأ أثناء تحديث التوصيات:', error);
            
            // استخدام خوارزمية بديلة إذا فشل الاتصال
            this.generateLocalRecommendations();
        }
    }

    generateLocalRecommendations() {
        // خوارزمية توصية مبسطة تعمل على الجهاز
        const watchedCategories = this.getTopCategories();
        const likedCreators = this.getTopCreators();
        
        // هنا يمكنك إضافة منطق التوصية المحلي
        // هذا مثال مبسط فقط
        this.recommendations = [
            {videoId: 'rec1', score: 0.9, reason: 'بناءً على مشاهداتك السابقة'},
            {videoId: 'rec2', score: 0.85, reason: 'من صناع المحتوى الذين تتابعهم'},
            {videoId: 'rec3', score: 0.8, reason: 'الأكثر شهرة اليوم'}
        ];
        
        this.triggerRecommendationsUpdate();
    }

    getTopCategories(limit = 3) {
        const categoryCounts = {};
        
        this.watchHistory.forEach(item => {
            const category = item.category || 'general';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });
        
        return Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(item => item[0]);
    }

    getTopCreators(limit = 5) {
        const creatorCounts = {};
        
        this.interactionHistory.forEach(item => {
            if (item.creatorId) {
                creatorCounts[item.creatorId] = (creatorCounts[item.creatorId] || 0) + 
                    (item.type === 'like' ? (item.value > 0 ? 2 : -1) : 1);
            }
        });
        
        return Object.entries(creatorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(item => item[0]);
    }

    triggerRecommendationsUpdate() {
        const event = new CustomEvent('recommendationsUpdated', {
            detail: { recommendations: this.recommendations }
        });
        document.dispatchEvent(event);
    }

    async analyzeVideoContent(videoUrl) {
        try {
            // استخدام واجهة برمجة التطبيقات لتحليل محتوى الفيديو
            const analyzeVideo = firebase.functions().httpsCallable('analyzeVideo');
            const response = await analyzeVideo({ videoUrl });
            
            return response.data;
        } catch (error) {
            console.error('حدث خطأ أثناء تحليل محتوى الفيديو:', error);
            return this.basicVideoAnalysis(videoUrl);
        }
    }

    basicVideoAnalysis(videoUrl) {
        // تحليل أساسي يعمل على الجهاز
        return {
            safe: true,
            categories: ['general'],
            tags: [],
            thumbnail: this.generateThumbnail(videoUrl)
        };
    }

    generateThumbnail(videoUrl) {
        // إنشاء ثومبنييل من الفيديو (هذا مثال فقط)
        return videoUrl.replace('.mp4', '.jpg');
    }

    async generateCaptions(videoUrl) {
        try {
            // استخدام خدمة توليد الترجمة
            const generateCaptions = firebase.functions().httpsCallable('generateCaptions');
            const response = await generateCaptions({ videoUrl });
            
            return response.data.captions;
        } catch (error) {
            console.error('حدث خطأ أثناء توليد الترجمة:', error);
            return [];
        }
    }

    async moderateContent(text) {
        try {
            // استخدام خدمة التحقق من المحتوى
            const moderateText = firebase.functions().httpsCallable('moderateText');
            const response = await moderateText({ text });
            
            return response.data;
        } catch (error) {
            console.error('حدث خطأ أثناء مراجعة المحتوى:', error);
            return { safe: true, reasons: [] };
        }
    }

    async personalizeForYouFeed() {
        if (this.recommendations.length === 0) {
            await this.updateRecommendations();
        }
        
        // ترتيب الفيديوهات بناءً على التوصيات
        return this.recommendations
            .sort((a, b) => b.score - a.score)
            .map(item => item.videoId);
    }

    async getTrendingVideos() {
        try {
            const response = await firebase.functions().httpsCallable('getTrendingVideos')({
                userId: firebase.auth().currentUser?.uid,
                preferences: this.userPreferences
            });
            
            return response.data.videos;
        } catch (error) {
            console.error('حدث خطأ أثناء جلب الفيديوهات الرائجة:', error);
            return [];
        }
    }

    async suggestFollows() {
        const topCreators = this.getTopCreators();
        
        try {
            const response = await firebase.functions().httpsCallable('suggestFollows')({
                userId: firebase.auth().currentUser?.uid,
                likedCreators: topCreators
            });
            
            return response.data.suggestions;
        } catch (error) {
            console.error('حدث خطأ أثناء اقتراح المتابعات:', error);
            return [];
        }
    }
}

// تهيئة نظام الذكاء الاصطناعي
const aiSystem = new AISystem();

// تصدير الدوال للاستخدام في ملفات أخرى
export {
    aiSystem,
    AISystem
};

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            aiSystem.init();
        }
    });
});