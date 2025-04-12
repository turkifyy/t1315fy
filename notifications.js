// assets/js/notifications.js

// 1. تهيئة نظام الإشعارات
class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.notificationSound = new Audio('/assets/sounds/notification.mp3');
        this.init();
    }

    // 2. تهيئة النظام
    async init() {
        this.setupUI();
        await this.checkPermission();
        this.setupFirebase();
        this.loadNotifications();
        this.setupEventListeners();
    }

    // 3. إعداد واجهة المستخدم
    setupUI() {
        this.notificationBell = document.getElementById('notificationsBtn');
        this.notificationBadge = document.createElement('span');
        this.notificationBadge.className = 'notification-badge';
        this.notificationBell.appendChild(this.notificationBadge);
        
        this.notificationPanel = document.createElement('div');
        this.notificationPanel.className = 'notification-panel';
        this.notificationPanel.innerHTML = `
            <div class="notification-header">
                <h3>الإشعارات</h3>
                <button class="mark-all-read">تعيين الكل كمقروء</button>
            </div>
            <div class="notification-list"></div>
        `;
        document.body.appendChild(this.notificationPanel);
    }

    // 4. التحقق من أذونات الإشعارات
    async checkPermission() {
        if (!('Notification' in window)) {
            console.warn('هذا المتصفح لا يدعم إشعارات الويب');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    }

    // 5. إعداد Firebase Cloud Messaging
    setupFirebase() {
        if (!firebase.messaging.isSupported()) return;

        const messaging = firebase.messaging();
        
        // تسجيل الخدمة
        messaging.getToken({ vapidKey: 'YOUR_VAPID_KEY' }).then((currentToken) => {
            if (currentToken) {
                this.saveToken(currentToken);
            } else {
                console.log('لا يوجد رمز، تحتاج إلى طلب الإذن');
            }
        }).catch((err) => {
            console.log('حدث خطأ أثناء استرجاع الرمز:', err);
        });

        // معالجة الرسائل الواردة
        messaging.onMessage((payload) => {
            this.handleIncomingNotification(payload.notification);
        });

        // تحديث الرمز عند التغيير
        messaging.onTokenRefresh(() => {
            messaging.getToken().then((refreshedToken) => {
                this.saveToken(refreshedToken);
            }).catch((err) => {
                console.log('حدث خطأ أثناء تحديث الرمز:', err);
            });
        });
    }

    // 6. حفظ رمز الجهاز
    saveToken(token) {
        const userId = firebase.auth().currentUser?.uid;
        if (!userId) return;

        firebase.firestore().collection('users').doc(userId).update({
            fcmTokens: firebase.firestore.FieldValue.arrayUnion(token)
        }).catch(() => {
            firebase.firestore().collection('users').doc(userId).set({
                fcmTokens: [token]
            });
        });
    }

    // 7. تحميل الإشعارات
    async loadNotifications() {
        const userId = firebase.auth().currentUser?.uid;
        if (!userId) return;

        try {
            const snapshot = await firebase.firestore()
                .collection('notifications')
                .doc(userId)
                .collection('userNotifications')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();

            this.notifications = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp.toDate()
                };
            });

            this.updateUnreadCount();
            this.renderNotifications();
        } catch (error) {
            console.error('حدث خطأ أثناء تحميل الإشعارات:', error);
        }
    }

    // 8. معالجة الإشعارات الواردة
    handleIncomingNotification(notification) {
        const newNotification = {
            id: `push-${Date.now()}`,
            title: notification.title,
            body: notification.body,
            type: notification.type || 'general',
            read: false,
            timestamp: new Date(),
            data: notification.data || {}
        };

        this.notifications.unshift(newNotification);
        this.updateUnreadCount();
        this.renderNotifications();
        this.playNotificationSound();

        // عرض إشعار نظام إذا كانت الصفحة غير نشطة
        if (document.visibilityState !== 'visible') {
            this.showSystemNotification(newNotification);
        }
    }

    // 9. عرض إشعار النظام
    showSystemNotification(notification) {
        if (!('Notification' in window)) return;

        const options = {
            body: notification.body,
            icon: '/assets/icons/icon-192x192.png',
            data: notification.data
        };

        new Notification(notification.title, options).onclick = (event) => {
            this.handleNotificationClick(notification.data);
            event.target.close();
        };
    }

    // 10. تشغيل صوت الإشعار
    playNotificationSound() {
        if (this.notificationSound) {
            this.notificationSound.currentTime = 0;
            this.notificationSound.play().catch(e => console.log('تعذر تشغيل صوت الإشعار:', e));
        }
    }

    // 11. تحديث عداد الإشعارات غير المقروءة
    updateUnreadCount() {
        this.unreadCount = this.notifications.filter(n => !n.read).length;
        this.notificationBadge.textContent = this.unreadCount > 0 ? this.unreadCount : '';
        this.notificationBadge.style.display = this.unreadCount > 0 ? 'block' : 'none';
    }

    // 12. عرض الإشعارات في الواجهة
    renderNotifications() {
        const list = this.notificationPanel.querySelector('.notification-list');
        list.innerHTML = '';

        if (this.notifications.length === 0) {
            list.innerHTML = '<p class="no-notifications">لا توجد إشعارات جديدة</p>';
            return;
        }

        this.notifications.forEach(notification => {
            const notificationElement = document.createElement('div');
            notificationElement.className = `notification-item ${notification.read ? '' : 'unread'}`;
            notificationElement.dataset.id = notification.id;
            
            notificationElement.innerHTML = `
                <div class="notification-icon">
                    ${this.getNotificationIcon(notification.type)}
                </div>
                <div class="notification-content">
                    <h4>${notification.title}</h4>
                    <p>${notification.body}</p>
                    <small>${this.formatTime(notification.timestamp)}</small>
                </div>
            `;
            
            notificationElement.addEventListener('click', () => {
                this.handleNotificationClick(notification.data);
                if (!notification.read) {
                    this.markAsRead(notification.id);
                }
            });
            
            list.appendChild(notificationElement);
        });
    }

    // 13. الحصول على أيقونة حسب نوع الإشعار
    getNotificationIcon(type) {
        const icons = {
            'like': '<i class="fas fa-heart"></i>',
            'comment': '<i class="fas fa-comment"></i>',
            'follow': '<i class="fas fa-user-plus"></i>',
            'mention': '<i class="fas fa-at"></i>',
            'system': '<i class="fas fa-bell"></i>',
            'default': '<i class="fas fa-bell"></i>'
        };
        return icons[type] || icons['default'];
    }

    // 14. تنسيق الوقت
    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        const minute = 60 * 1000;
        const hour = minute * 60;
        const day = hour * 24;
        
        if (diff < minute) return 'الآن';
        if (diff < hour) return `${Math.floor(diff / minute)} دقيقة مضت`;
        if (diff < day) return `${Math.floor(diff / hour)} ساعة مضت`;
        return `${Math.floor(diff / day)} يوم مضى`;
    }

    // 15. معالجة النقر على الإشعار
    handleNotificationClick(data) {
        if (data.videoId) {
            // افتح الفيديو المحدد
            window.location.href = `/video.html?id=${data.videoId}`;
        } else if (data.userId) {
            // افتح صفحة المستخدم
            window.location.href = `/profile.html?id=${data.userId}`;
        }
        // يمكن إضافة المزيد من الإجراءات حسب الحاجة
    }

    // 16. تعليم الإشعار كمقروء
    async markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (!notification || notification.read) return;

        notification.read = true;
        this.updateUnreadCount();
        this.renderNotifications();

        // تحديث في Firestore إذا كان إشعارًا مخزنًا
        if (!notificationId.startsWith('push-')) {
            const userId = firebase.auth().currentUser?.uid;
            if (!userId) return;

            try {
                await firebase.firestore()
                    .collection('notifications')
                    .doc(userId)
                    .collection('userNotifications')
                    .doc(notificationId)
                    .update({ read: true });
            } catch (error) {
                console.error('حدث خطأ أثناء تحديث حالة الإشعار:', error);
            }
        }
    }

    // 17. تعليم الكل كمقروء
    async markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.updateUnreadCount();
        this.renderNotifications();

        const userId = firebase.auth().currentUser?.uid;
        if (!userId) return;

        try {
            const batch = firebase.firestore().batch();
            const notificationsRef = firebase.firestore()
                .collection('notifications')
                .doc(userId)
                .collection('userNotifications')
                .where('read', '==', false);

            const snapshot = await notificationsRef.get();
            snapshot.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });

            await batch.commit();
        } catch (error) {
            console.error('حدث خطأ أثناء تحديث جميع الإشعارات:', error);
        }
    }

    // 18. إعداد مستمعي الأحداث
    setupEventListeners() {
        // فتح/إغلاق لوحة الإشعارات
        this.notificationBell.addEventListener('click', (e) => {
            e.stopPropagation();
            this.notificationPanel.style.display = 
                this.notificationPanel.style.display === 'block' ? 'none' : 'block';
        });

        // إغلاق لوحة الإشعارات عند النقر خارجها
        document.addEventListener('click', (e) => {
            if (!this.notificationPanel.contains(e.target) {
                this.notificationPanel.style.display = 'none';
            }
        });

        // تعليم الكل كمقروء
        this.notificationPanel.querySelector('.mark-all-read').addEventListener('click', () => {
            this.markAllAsRead();
        });

        // تحديث الإشعارات عند تسجيل الدخول
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                this.loadNotifications();
            } else {
                this.notifications = [];
                this.unreadCount = 0;
                this.updateUnreadCount();
                this.renderNotifications();
            }
        });
    }
}

// 19. تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('notificationsBtn')) {
        const notificationSystem = new NotificationSystem();
        
        // جعل النظام متاحًا عالميًا للاستخدام من ملفات أخرى
        window.NotificationSystem = notificationSystem;
    }
});

// 20. دالة مساعدة لإرسال إشعارات (للاستخدام في أجزاء أخرى من التطبيق)
export async function sendNotification(toUserId, notificationData) {
    try {
        await firebase.firestore()
            .collection('notifications')
            .doc(toUserId)
            .collection('userNotifications')
            .add({
                ...notificationData,
                read: false,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        return true;
    } catch (error) {
        console.error('حدث خطأ أثناء إرسال الإشعار:', error);
        return false;
    }
}