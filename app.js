// App Configuration
const APP_CONFIG = {
    maxRetries: 3,
    retryDelay: 1000,
    pageSize: 5,
    videoBuffer: 2,
    maxVisibleVideos: 5,
    maxVideoDuration: 300, // 5 minutes in seconds
    defaultThumbnail: 'https://via.placeholder.com/300x500/161616/AAAAAA?text=قصير',
    youtubeApiKey: 'YOUR_YOUTUBE_API_KEY',
    tiktokApiKey: 'YOUR_TIKTOK_API_KEY',
    aiEndpoint: 'https://api.example.com/ai',
    maxOfflineVideos: 20,
    notificationInterval: 30000 // 30 seconds
};

// App State
const APP_STATE = {
    currentUser: null,
    videos: [],
    forYouVideos: [],
    followingVideos: [],
    visibleVideos: [],
    likedVideos: [],
    savedVideos: [],
    watchedVideos: [],
    currentVideoIndex: 0,
    isLoading: false,
    videoPlayers: {},
    observers: [],
    hasMoreVideos: true,
    isDarkMode: localStorage.getItem('darkMode') !== 'false',
    muted: true,
    retryCount: 0,
    connectionStatus: 'online',
    userPreferences: {
        videoQuality: 'auto',
        autoplay: true,
        dataSaver: false,
        language: 'ar',
        notificationEnabled: true
    },
    pendingLocalStorageUpdates: {},
    localStorageTimer: null,
    isCreator: false,
    currentTab: 'home',
    currentFeed: 'forYou',
    uploadedVideos: [],
    videoComments: [],
    analyticsData: null,
    currentEditingVideo: null,
    currentCategory: null,
    trendingVideos: [],
    popularCreators: [],
    searchResults: {
        videos: [],
        users: [],
        sounds: []
    },
    notifications: [],
    unseenNotifications: 0,
    notificationTimer: null,
    aiCategories: [],
    aiSentiments: {},
    offlineVideos: [],
    isOfflineMode: false
};

// DOM Elements
const DOM = {
    appContainer: document.getElementById('appContainer'),
    videoFeed: document.getElementById('videoFeed'),
    themeToggle: document.getElementById('themeToggle'),
    authModal: document.getElementById('authModal'),
    importModal: document.getElementById('importModal'),
    profileBtn: document.getElementById('profileBtn'),
    uploadBtn: document.getElementById('uploadBtn'),
    homeBtn: document.getElementById('homeBtn'),
    discoverBtn: document.getElementById('discoverBtn'),
    notificationsBtn: document.getElementById('notificationsBtn'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    connectionBanner: document.getElementById('connectionBanner'),
    toastContainer: document.getElementById('toastContainer'),
    searchView: document.getElementById('searchView'),
    searchInput: document.getElementById('searchInput'),
    clearSearch: document.getElementById('clearSearch'),
    cancelSearch: document.getElementById('cancelSearch'),
    searchResults: document.getElementById('searchResults'),
    resultTabs: document.querySelectorAll('.result-tab'),
    discoverView: document.getElementById('discoverView'),
    categoriesContainer: document.getElementById('categoriesGrid'),
    trendingVideos: document.getElementById('trendingVideos'),
    popularCreators: document.getElementById('popularCreators'),
    profileView: document.getElementById('profileView'),
    notificationsView: document.getElementById('notificationsView'),
    watchLaterView: document.getElementById('watchLaterView'),
    feedTabs: document.querySelectorAll('.feed-tab'),
    creatorStudio: document.getElementById('creatorStudio'),
    playerModal: document.getElementById('playerModal'),
    commentsModal: document.getElementById('commentsModal'),
    body: document.body
};

// Initialize the app
function initApp() {
    // Set initial theme
    setTheme(APP_STATE.isDarkMode);
    
    // Initialize Firebase services
    initFirebase();
    
    // Initialize auth state listener
    initAuthStateListener();
    
    // Initialize network monitoring
    initNetworkMonitor();
    
    // Load initial videos
    loadVideos();
    
    // Initialize event listeners
    initEventListeners();
    
    // Initialize service worker for PWA
    initServiceWorker();
    
    // Load user data if already logged in
    if (APP_STATE.currentUser) {
        loadUserData();
    }
    
    // Initialize AI services
    initAIServices();
    
    // Start notification polling
    startNotificationPolling();
}

// Initialize Firebase services
function initFirebase() {
    // Firebase is already initialized in the main script
    // Initialize additional services here if needed
    APP_STATE.db = firebase.firestore();
    APP_STATE.auth = firebase.auth();
    APP_STATE.storage = firebase.storage();
    APP_STATE.messaging = firebase.messaging();
    APP_STATE.functions = firebase.functions();
    
    // Use Firebase emulators in development
    if (window.location.hostname === 'localhost') {
        APP_STATE.db.useEmulator('localhost', 8080);
        APP_STATE.functions.useEmulator('localhost', 5001);
    }
}

// Initialize auth state listener
function initAuthStateListener() {
    APP_STATE.auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            APP_STATE.currentUser = {
                id: user.uid,
                name: user.displayName || 'مستخدم جديد',
                email: user.email,
                avatar: user.photoURL || `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
                phone: user.phoneNumber,
                emailVerified: user.emailVerified
            };
            
            // Check if user is a creator
            await checkCreatorStatus();
            
            // Load user data
            await loadUserData();
            
            // Update UI
            updateAuthUI();
            
            showToast(`مرحباً ${APP_STATE.currentUser.name}`, 'success');
            
            // Request notification permission
            requestNotificationPermission();
        } else {
            // User is signed out
            APP_STATE.currentUser = null;
            APP_STATE.isCreator = false;
            updateAuthUI();
        }
    });
}

// Check if user is a content creator
async function checkCreatorStatus() {
    if (!APP_STATE.currentUser) return;
    
    try {
        const userDoc = await APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            APP_STATE.isCreator = userData.isCreator || false;
            
            // Update UI if user is creator
            if (APP_STATE.isCreator) {
                document.getElementById('uploadBtn').innerHTML = '<i class="fas fa-film"></i>';
                document.getElementById('uploadBtn').setAttribute('aria-label', 'استوديو المنشئ');
            }
        }
    } catch (error) {
        console.error('Error checking creator status:', error);
        showToast('حدث خطأ أثناء تحميل بيانات المستخدم', 'error');
    }
}

// Load user data (preferences, videos, etc.)
async function loadUserData() {
    if (!APP_STATE.currentUser) return;
    
    try {
        // Load user preferences
        const userDoc = await APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            APP_STATE.userPreferences = data.preferences || APP_STATE.userPreferences;
            APP_STATE.likedVideos = data.likedVideos || [];
            APP_STATE.savedVideos = data.savedVideos || [];
            APP_STATE.watchedVideos = data.watchedVideos || [];
            
            // Apply preferences
            if (APP_STATE.userPreferences.darkMode !== undefined) {
                setTheme(APP_STATE.userPreferences.darkMode);
            }
            
            // Update language
            if (APP_STATE.userPreferences.language) {
                setLanguage(APP_STATE.userPreferences.language);
            }
        }
        
        // If user is creator, load creator data
        if (APP_STATE.isCreator) {
            await loadCreatorVideos();
            await loadCreatorAnalytics();
        }
        
        // Load saved videos for watch later
        await loadSavedVideos();
        
        // Load offline videos
        await loadOfflineVideos();
        
        // Load notifications
        await loadNotifications();
        
        // Update notification badge
        updateNotificationBadge();
    } catch (error) {
        console.error('Error loading user data:', error);
        showToast('حدث خطأ أثناء تحميل بيانات المستخدم', 'error');
    }
}

// Update UI based on auth state
function updateAuthUI() {
    const profileBtn = document.getElementById('profileBtn');
    if (APP_STATE.currentUser) {
        // User is logged in
        profileBtn.querySelector('span').textContent = 'حسابي';
        
        // Update profile image if available
        if (APP_STATE.currentUser.avatar) {
            profileBtn.innerHTML = `<img src="${APP_STATE.currentUser.avatar}" class="profile-nav-img" alt="Profile">`;
        }
    } else {
        // User is logged out
        profileBtn.innerHTML = '<i class="fas fa-user nav-icon"></i><span>حسابي</span>';
    }
}

// Request notification permission
function requestNotificationPermission() {
    if (!APP_STATE.currentUser || !APP_STATE.userPreferences.notificationEnabled) return;
    
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            // Get FCM token
            getFCMToken();
        }
    });
}

// Get FCM token
function getFCMToken() {
    APP_STATE.messaging.getToken({ vapidKey: 'YOUR_VAPID_KEY' }).then((currentToken) => {
        if (currentToken) {
            // Send token to server
            saveFCMToken(currentToken);
        } else {
            console.log('No registration token available. Request permission to generate one.');
        }
    }).catch((err) => {
        console.log('An error occurred while retrieving token. ', err);
    });
}

// Save FCM token to Firestore
function saveFCMToken(token) {
    if (!APP_STATE.currentUser) return;
    
    APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id).update({
        fcmToken: token,
        fcmTokenUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(error => {
        console.error('Error saving FCM token:', error);
    });
}

// Start notification polling
function startNotificationPolling() {
    if (APP_STATE.notificationTimer) {
        clearInterval(APP_STATE.notificationTimer);
    }
    
    // Check for new notifications immediately
    checkNewNotifications();
    
    // Then set up interval
    APP_STATE.notificationTimer = setInterval(() => {
        checkNewNotifications();
    }, APP_CONFIG.notificationInterval);
}

// Check for new notifications
async function checkNewNotifications() {
    if (!APP_STATE.currentUser || !navigator.onLine) return;
    
    try {
        const lastSeen = APP_STATE.notifications.length > 0 ? 
            APP_STATE.notifications[0].timestamp : firebase.firestore.Timestamp.fromDate(new Date(0));
        
        const snapshot = await APP_STATE.db.collection('users')
            .doc(APP_STATE.currentUser.id)
            .collection('notifications')
            .where('timestamp', '>', lastSeen)
            .orderBy('timestamp', 'desc')
            .get();
        
        if (!snapshot.empty) {
            const newNotifications = [];
            snapshot.forEach(doc => {
                newNotifications.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Add new notifications to the beginning of the array
            APP_STATE.notifications = [...newNotifications, ...APP_STATE.notifications];
            
            // Update unseen count
            APP_STATE.unseenNotifications += newNotifications.length;
            updateNotificationBadge();
            
            // Show notifications to user
            newNotifications.forEach(notification => {
                showNotification(notification);
            });
        }
    } catch (error) {
        console.error('Error checking notifications:', error);
    }
}

// Update notification badge
function updateNotificationBadge() {
    const notificationBtn = document.getElementById('notificationsBtn');
    const badge = notificationBtn.querySelector('.notification-badge') || 
        document.createElement('span');
    
    if (APP_STATE.unseenNotifications > 0) {
        badge.className = 'notification-badge';
        badge.textContent = APP_STATE.unseenNotifications > 9 ? '9+' : APP_STATE.unseenNotifications;
        
        if (!notificationBtn.querySelector('.notification-badge')) {
            notificationBtn.appendChild(badge);
        }
    } else {
        if (notificationBtn.querySelector('.notification-badge')) {
            notificationBtn.removeChild(badge);
        }
    }
}

// Show notification to user
function showNotification(notification) {
    // Show in-app notification
    const toast = document.createElement('div');
    toast.className = 'toast info';
    
    toast.innerHTML = `
        <i class="fas fa-bell toast-icon"></i>
        <span>${notification.message}</span>
        <button class="toast-close" aria-label="إغلاق">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Show browser notification if permission granted
    if (Notification.permission === 'granted' && APP_STATE.userPreferences.notificationEnabled) {
        const notif = new Notification('قصير', {
            body: notification.message,
            icon: '/assets/img/logo.png'
        });
        
        notif.onclick = () => {
            window.focus();
            
            // Handle notification click (e.g., open relevant video)
            if (notification.videoId) {
                openVideoById(notification.videoId);
            }
        };
    }
}

// Load videos from Firestore
async function loadVideos() {
    try {
        if (APP_STATE.isLoading) return;
        
        APP_STATE.isLoading = true;
        showLoading();
        
        // Load different feeds based on current selection
        if (APP_STATE.currentFeed === 'forYou') {
            await loadForYouVideos();
        } else {
            await loadFollowingVideos();
        }
        
        APP_STATE.retryCount = 0;
        APP_STATE.isLoading = false;
        
        if (APP_STATE.videos.length >= APP_CONFIG.pageSize) {
            DOM.loadMoreContainer.style.display = 'flex';
        }
    } catch (error) {
        console.error('Error loading videos:', error);
        showToast('حدث خطأ أثناء تحميل الفيديوهات', 'error');
        APP_STATE.isLoading = false;
        
        // Retry if offline
        if (APP_STATE.connectionStatus === 'offline' && APP_STATE.retryCount < APP_CONFIG.maxRetries) {
            APP_STATE.retryCount++;
            setTimeout(() => loadVideos(), APP_CONFIG.retryDelay);
        }
    }
}

// Load "For You" feed videos
async function loadForYouVideos() {
    let videosQuery = APP_STATE.db.collection('videos')
        .where('isPublic', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(APP_CONFIG.pageSize);
    
    // Filter by category if selected
    if (APP_STATE.currentCategory) {
        videosQuery = videosQuery.where('category', '==', APP_STATE.currentCategory);
    }
    
    const videosSnapshot = await videosQuery.get();
    
    if (videosSnapshot.empty) {
        showError('لا توجد فيديوهات متاحة حالياً');
        return;
    }
    
    APP_STATE.videos = [];
    videosSnapshot.forEach(doc => {
        const videoData = doc.data();
        APP_STATE.videos.push({
            id: doc.id,
            title: videoData.title,
            description: videoData.description,
            videoId: generateVideoId(),
            url: videoData.url,
            author: {
                id: videoData.authorId,
                name: videoData.authorName,
                avatar: videoData.authorAvatar
            },
            likes: videoData.likes,
            comments: videoData.comments,
            views: videoData.views,
            music: videoData.music || "الصوت الأصلي",
            category: videoData.category || "عام",
            duration: videoData.duration || 0,
            thumbnail: videoData.thumbnail || APP_CONFIG.defaultThumbnail,
            createdAt: videoData.createdAt?.toDate() || new Date()
        });
    });
    
    // Apply AI recommendations if available
    if (APP_STATE.currentUser && APP_STATE.aiCategories.length > 0) {
        sortVideosByAIRecommendations();
    }
    
    renderVideos();
}

// Load "Following" feed videos
async function loadFollowingVideos() {
    if (!APP_STATE.currentUser) {
        showAuthModal();
        return;
    }
    
    // Get list of followed users
    const followingSnapshot = await APP_STATE.db.collection('users')
        .doc(APP_STATE.currentUser.id)
        .collection('following')
        .get();
    
    if (followingSnapshot.empty) {
        showEmptyFollowingState();
        return;
    }
    
    const followingIds = followingSnapshot.docs.map(doc => doc.id);
    
    // Get videos from followed users
    let videosQuery = APP_STATE.db.collection('videos')
        .where('authorId', 'in', followingIds)
        .where('isPublic', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(APP_CONFIG.pageSize);
    
    const videosSnapshot = await videosQuery.get();
    
    if (videosSnapshot.empty) {
        showEmptyFollowingState();
        return;
    }
    
    APP_STATE.videos = [];
    videosSnapshot.forEach(doc => {
        const videoData = doc.data();
        APP_STATE.videos.push({
            id: doc.id,
            title: videoData.title,
            description: videoData.description,
            videoId: generateVideoId(),
            url: videoData.url,
            author: {
                id: videoData.authorId,
                name: videoData.authorName,
                avatar: videoData.authorAvatar
            },
            likes: videoData.likes,
            comments: videoData.comments,
            views: videoData.views,
            music: videoData.music || "الصوت الأصلي",
            category: videoData.category || "عام",
            duration: videoData.duration || 0,
            thumbnail: videoData.thumbnail || APP_CONFIG.defaultThumbnail,
            createdAt: videoData.createdAt?.toDate() || new Date()
        });
    });
    
    renderVideos();
}

// Show empty state for following feed
function showEmptyFollowingState() {
    DOM.videoFeed.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-user-friends" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 15px;"></i>
            <h3>لا توجد فيديوهات متاحة</h3>
            <p>ابدأ بمتابعة بعض المنشئين لرؤية فيديوهاتهم هنا</p>
            <button class="primary-btn" id="discoverCreators">اكتشف منشئين جدد</button>
        </div>
    `;
    
    document.getElementById('discoverCreators').addEventListener('click', () => {
        switchTab('discover');
    });
}

// Sort videos by AI recommendations
function sortVideosByAIRecommendations() {
    if (!APP_STATE.aiCategories || APP_STATE.aiCategories.length === 0) return;
    
    // Sort videos based on user's preferred categories
    APP_STATE.videos.sort((a, b) => {
        const aScore = APP_STATE.aiCategories.includes(a.category) ? 1 : 0;
        const bScore = APP_STATE.aiCategories.includes(b.category) ? 1 : 0;
        return bScore - aScore;
    });
}

// Load more videos
async function loadMoreVideos() {
    try {
        if (APP_STATE.isLoading || !APP_STATE.hasMoreVideos) return;
        
        APP_STATE.isLoading = true;
        DOM.loadMoreBtn.disabled = true;
        DOM.loadMoreBtn.textContent = 'جاري التحميل...';
        
        const lastVideo = APP_STATE.videos[APP_STATE.videos.length - 1];
        const lastVideoDoc = await APP_STATE.db.collection('videos').doc(lastVideo.id).get();
        
        let videosQuery = APP_STATE.db.collection('videos')
            .where('isPublic', '==', true)
            .orderBy('createdAt', 'desc')
            .startAfter(lastVideoDoc)
            .limit(APP_CONFIG.pageSize);
        
        // Filter by category if selected
        if (APP_STATE.currentCategory) {
            videosQuery = videosQuery.where('category', '==', APP_STATE.currentCategory);
        }
        
        const videosSnapshot = await videosQuery.get();
        
        if (videosSnapshot.empty) {
            APP_STATE.hasMoreVideos = false;
            DOM.loadMoreContainer.style.display = 'none';
            return;
        }
        
        const newVideos = [];
        videosSnapshot.forEach(doc => {
            const videoData = doc.data();
            newVideos.push({
                id: doc.id,
                title: videoData.title,
                description: videoData.description,
                videoId: generateVideoId(),
                url: videoData.url,
                author: {
                    id: videoData.authorId,
                    name: videoData.authorName,
                    avatar: videoData.authorAvatar
                },
                likes: videoData.likes,
                comments: videoData.comments,
                views: videoData.views,
                music: videoData.music || "الصوت الأصلي",
                category: videoData.category || "عام",
                duration: videoData.duration || 0,
                thumbnail: videoData.thumbnail || APP_CONFIG.defaultThumbnail,
                createdAt: videoData.createdAt?.toDate() || new Date()
            });
        });
        
        APP_STATE.videos = [...APP_STATE.videos, ...newVideos];
        renderVideos();
        
        APP_STATE.retryCount = 0;
        APP_STATE.isLoading = false;
        DOM.loadMoreBtn.disabled = false;
        DOM.loadMoreBtn.textContent = 'تحميل المزيد';
        
        if (newVideos.length < APP_CONFIG.pageSize) {
            APP_STATE.hasMoreVideos = false;
            DOM.loadMoreContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading more videos:', error);
        DOM.loadMoreBtn.disabled = false;
        DOM.loadMoreBtn.textContent = 'تحميل المزيد';
        APP_STATE.isLoading = false;
        showToast('حدث خطأ أثناء تحميل الفيديوهات', 'error');
    }
}

// Generate random video ID for demo
function generateVideoId() {
    return Math.random().toString(36).substring(2, 15);
}

// Render videos to the feed
function renderVideos() {
    if (APP_STATE.videos.length === 0) {
        showError('لا توجد فيديوهات متاحة حالياً');
        return;
    }
    
    const startIndex = Math.max(0, APP_STATE.currentVideoIndex - 2);
    const endIndex = Math.min(APP_STATE.videos.length, APP_STATE.currentVideoIndex + 3);
    
    const videosToRemove = APP_STATE.visibleVideos.filter(videoId => {
        const videoIndex = APP_STATE.videos.findIndex(v => v.id === videoId);
        return videoIndex < startIndex || videoIndex >= endIndex;
    });
    
    videosToRemove.forEach(videoId => {
        const videoElement = document.querySelector(`.video-item[data-video-id="${videoId}"]`);
        if (videoElement) {
            const iframe = videoElement.querySelector('.video-player');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            }
            videoElement.remove();
        }
        
        APP_STATE.visibleVideos = APP_STATE.visibleVideos.filter(id => id !== videoId);
    });
    
    for (let i = startIndex; i < endIndex; i++) {
        const video = APP_STATE.videos[i];
        
        if (APP_STATE.visibleVideos.includes(video.id)) continue;
        
        const isLiked = APP_STATE.likedVideos.includes(video.id);
        const isSaved = APP_STATE.savedVideos.includes(video.id);
        
        const videoElement = document.createElement('div');
        videoElement.className = 'video-item';
        videoElement.dataset.videoId = video.id;
        videoElement.dataset.index = i;
        
        videoElement.innerHTML = `
            <div class="video-container">
                <div class="video-wrapper">
                    <div class="video-placeholder">
                        <div class="loading-spinner" style="width: 30px; height: 30px;"></div>
                        <p class="loader-text">جاري تحميل الفيديو...</p>
                    </div>
                    <iframe 
                        src="https://www.youtube.com/embed/${video.videoId}?autoplay=0&mute=1&controls=0&modestbranding=1&rel=0&enablejsapi=1" 
                        class="video-player"
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen
                        loading="lazy"
                        style="display: none;">
                    </iframe>
                </div>
                
                <button class="sound-control" data-video-id="${video.id}">
                    <i class="fas fa-volume-mute"></i>
                </button>
                
                <div class="video-actions">
                    <button class="action-btn like-btn ${isLiked ? 'active' : ''}" data-video-id="${video.id}" aria-label="إعجاب">
                        <div class="action-icon">
                            <i class="fas fa-heart"></i>
                        </div>
                        <span class="action-text">${formatNumber(video.likes)}</span>
                    </button>
                    <button class="action-btn comment-btn" data-video-id="${video.id}" aria-label="تعليقات">
                        <div class="action-icon">
                            <i class="fas fa-comment"></i>
                        </div>
                        <span class="action-text">${formatNumber(video.comments)}</span>
                    </button>
                    <button class="action-btn save-btn ${isSaved ? 'active' : ''}" data-video-id="${video.id}" aria-label="حفظ">
                        <div class="action-icon">
                            <i class="fas fa-bookmark"></i>
                        </div>
                        <span class="action-text">حفظ</span>
                    </button>
                    <button class="action-btn share-btn" data-video-id="${video.id}" aria-label="مشاركة">
                        <div class="action-icon">
                            <i class="fas fa-share"></i>
                        </div>
                        <span class="action-text">مشاركة</span>
                    </button>
                </div>
                
                <div class="video-info">
                    <div class="video-author">
                        <img src="${video.author.avatar}" alt="${video.author.name}" class="author-avatar" loading="lazy">
                        <span class="author-name">${video.author.name}</span>
                        <button class="follow-btn">متابعة</button>
                    </div>
                    <p class="video-title">${video.title}</p>
                    <div class="video-music">
                        <i class="fas fa-music music-note"></i>
                        <span>${video.music}</span>
                    </div>
                </div>
            </div>
        `;
        
        const nextVideo = document.querySelector(`.video-item[data-index="${i+1}"]`);
        if (nextVideo) {
            DOM.videoFeed.insertBefore(videoElement, nextVideo);
        } else {
            DOM.videoFeed.appendChild(videoElement);
        }
        
        initYouTubePlayer(videoElement, video.videoId);
        
        const likeBtn = videoElement.querySelector('.like-btn');
        const commentBtn = videoElement.querySelector('.comment-btn');
        const saveBtn = videoElement.querySelector('.save-btn');
        const shareBtn = videoElement.querySelector('.share-btn');
        const followBtn = videoElement.querySelector('.follow-btn');
        const soundControl = videoElement.querySelector('.sound-control');
        
        likeBtn.addEventListener('click', () => toggleLike(video.id));
        commentBtn.addEventListener('click', () => showComments(video.id));
        saveBtn.addEventListener('click', () => toggleSave(video.id));
        shareBtn.addEventListener('click', () => shareVideo(video.id));
        followBtn.addEventListener('click', () => followUser(video.author.id));
        soundControl.addEventListener('click', () => toggleSound(video.id));
        
        APP_STATE.visibleVideos.push(video.id);
    }
    
    initIntersectionObserver();
}

// Initialize YouTube player
function initYouTubePlayer(videoElement, videoId) {
    const iframe = videoElement.querySelector('.video-player');
    const placeholder = videoElement.querySelector('.video-placeholder');
    
    iframe.onerror = () => {
        placeholder.innerHTML = `
            <i class="fas fa-exclamation-triangle error-icon"></i>
            <p>تعذر تحميل الفيديو</p>
            <button class="retry-btn" onclick="retryLoadVideo('${videoId}')">إعادة المحاولة</button>
        `;
    };
    
    iframe.onload = () => {
        placeholder.style.display = 'none';
        iframe.style.display = 'block';
        APP_STATE.videoPlayers[videoId] = iframe;
    };
}

// Initialize intersection observer for auto-play
function initIntersectionObserver() {
    APP_STATE.observers.forEach(obs => {
        if (obs.observer) obs.observer.disconnect();
    });
    APP_STATE.observers = [];
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const videoId = entry.target.dataset.videoId;
                const videoIndex = parseInt(entry.target.dataset.index);
                const videoElement = entry.target;
                
                APP_STATE.currentVideoIndex = videoIndex;
                
                document.querySelectorAll('.video-player').forEach(iframe => {
                    if (iframe !== videoElement.querySelector('.video-player')) {
                        iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                    }
                });
                
                const currentIframe = videoElement.querySelector('.video-player');
                if (currentIframe && currentIframe.contentWindow) {
                    currentIframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                }
                
                if (!APP_STATE.watchedVideos.includes(videoId)) {
                    APP_STATE.watchedVideos.push(videoId);
                    scheduleLocalStorageUpdate('watchedVideos', APP_STATE.watchedVideos);
                    saveUserPreferences();
                    
                    // Record view in Firestore
                    recordVideoView(videoId);
                }
                
                if (videoIndex >= APP_STATE.videos.length - APP_CONFIG.videoBuffer && 
                    !APP_STATE.isLoading && 
                    APP_STATE.hasMoreVideos) {
                    loadMoreVideos();
                }
            }
        });
    }, { 
        threshold: 0.8,
        rootMargin: '0px 0px 100px 0px'
    });
    
    document.querySelectorAll('.video-item').forEach(item => {
        observer.observe(item);
        APP_STATE.observers.push({ observer, element: item });
    });
}

// Record video view in Firestore
async function recordVideoView(videoId) {
    if (!APP_STATE.currentUser || !navigator.onLine) return;
    
    try {
        const videoRef = APP_STATE.db.collection('videos').doc(videoId);
        
        // Increment view count
        await videoRef.update({
            views: firebase.firestore.FieldValue.increment(1),
            lastViewedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Record view in user's history
        await APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id)
            .collection('history')
            .doc(videoId)
            .set({
                videoId: videoId,
                viewedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
        // Update AI recommendations based on view
        updateAIRecommendations(videoId);
    } catch (error) {
        console.error('Error recording view:', error);
    }
}

// Update AI recommendations based on viewed video
async function updateAIRecommendations(videoId) {
    if (!APP_STATE.currentUser || !navigator.onLine) return;
    
    try {
        const videoDoc = await APP_STATE.db.collection('videos').doc(videoId).get();
        if (!videoDoc.exists) return;
        
        const videoData = videoDoc.data();
        const category = videoData.category || 'general';
        
        // Call AI service to update user preferences
        const updateRecommendations = APP_STATE.functions.httpsCallable('updateRecommendations');
        await updateRecommendations({
            userId: APP_STATE.currentUser.id,
            category: category,
            action: 'view'
        });
        
        // Refresh AI categories
        await loadAICategories();
    } catch (error) {
        console.error('Error updating AI recommendations:', error);
    }
}

// Toggle like on a video
async function toggleLike(videoId) {
    if (!APP_STATE.currentUser) {
        showAuthModal();
        return;
    }
    
    const video = APP_STATE.videos.find(v => v.id === videoId);
    if (!video) return;
    
    const likeIndex = APP_STATE.likedVideos.indexOf(videoId);
    const isLiked = likeIndex !== -1;
    
    try {
        const videoRef = APP_STATE.db.collection('videos').doc(videoId);
        const likeRef = videoRef.collection('likes').doc(APP_STATE.currentUser.id);
        
        if (isLiked) {
            // Unlike
            await likeRef.delete();
            await videoRef.update({
                likes: firebase.firestore.FieldValue.increment(-1)
            });
            
            video.likes--;
            APP_STATE.likedVideos.splice(likeIndex, 1);
        } else {
            // Like
            await likeRef.set({
                userId: APP_STATE.currentUser.id,
                likedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await videoRef.update({
                likes: firebase.firestore.FieldValue.increment(1)
            });
            
            video.likes++;
            APP_STATE.likedVideos.push(videoId);
            
            // Update AI recommendations based on like
            updateAIRecommendations(videoId);
        }
        
        // Update UI
        document.querySelectorAll(`.like-btn[data-video-id="${videoId}"]`).forEach(btn => {
            btn.classList.toggle('active', !isLiked);
            btn.querySelector('.action-text').textContent = formatNumber(video.likes);
            btn.querySelector('.action-icon').classList.add('pulse');
            setTimeout(() => {
                btn.querySelector('.action-icon').classList.remove('pulse');
            }, 300);
        });
        
        // Save to localStorage and Firestore
        scheduleLocalStorageUpdate('likedVideos', APP_STATE.likedVideos);
        saveUserPreferences();
        
        // Show notification to creator
        if (!isLiked && video.author.id !== APP_STATE.currentUser.id) {
            await APP_STATE.db.collection('users').doc(video.author.id)
                .collection('notifications')
                .add({
                    message: `${APP_STATE.currentUser.name} أعجب بفيديو "${video.title}"`,
                    type: 'like',
                    videoId: videoId,
                    read: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('حدث خطأ أثناء تسجيل الإعجاب', 'error');
    }
}

// Toggle save video (watch later)
async function toggleSave(videoId) {
    if (!APP_STATE.currentUser) {
        showAuthModal();
        return;
    }
    
    const video = APP_STATE.videos.find(v => v.id === videoId);
    if (!video) return;
    
    const saveIndex = APP_STATE.savedVideos.indexOf(videoId);
    const isSaved = saveIndex !== -1;
    
    try {
        if (isSaved) {
            // Remove from saved
            await APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id)
                .collection('savedVideos')
                .doc(videoId)
                .delete();
            
            APP_STATE.savedVideos.splice(saveIndex, 1);
        } else {
            // Add to saved
            await APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id)
                .collection('savedVideos')
                .doc(videoId)
                .set({
                    videoId: videoId,
                    savedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    videoData: {
                        title: video.title,
                        thumbnail: video.thumbnail,
                        author: video.author,
                        views: video.views,
                        likes: video.likes
                    }
                });
            
            APP_STATE.savedVideos.push(videoId);
        }
        
        // Update UI
        document.querySelectorAll(`.save-btn[data-video-id="${videoId}"]`).forEach(btn => {
            btn.classList.toggle('active', !isSaved);
            btn.querySelector('.action-icon').classList.add('pulse');
            setTimeout(() => {
                btn.querySelector('.action-icon').classList.remove('pulse');
            }, 300);
        });
        
        // Save to localStorage and Firestore
        scheduleLocalStorageUpdate('savedVideos', APP_STATE.savedVideos);
        saveUserPreferences();
        
        showToast(isSaved ? 'تمت إزالة الفيديو من المحفوظات' : 'تم حفظ الفيديو للمشاهدة لاحقاً', 'success');
    } catch (error) {
        console.error('Error toggling save:', error);
        showToast('حدث خطأ أثناء حفظ الفيديو', 'error');
    }
}

// Load saved videos (watch later)
async function loadSavedVideos() {
    if (!APP_STATE.currentUser) return;
    
    try {
        const savedSnapshot = await APP_STATE.db.collection('users')
            .doc(APP_STATE.currentUser.id)
            .collection('savedVideos')
            .orderBy('savedAt', 'desc')
            .get();
        
        APP_STATE.savedVideos = [];
        savedSnapshot.forEach(doc => {
            APP_STATE.savedVideos.push(doc.id);
        });
    } catch (error) {
        console.error('Error loading saved videos:', error);
    }
}

// Show watch later view
async function showWatchLaterView() {
    if (!APP_STATE.currentUser) {
        showAuthModal();
        return;
    }
    
    DOM.watchLaterView.innerHTML = `
        <div class="watch-later-header">
            <h2 class="watch-later-title">المشاهدة لاحقاً</h2>
            <button class="text-btn watch-later-clear">مسح الكل</button>
        </div>
        <div class="watch-later-grid" id="watchLaterGrid">
            <!-- Saved videos will be loaded here -->
        </div>
    `;
    
    // Load saved videos from Firestore
    try {
        const savedSnapshot = await APP_STATE.db.collection('users')
            .doc(APP_STATE.currentUser.id)
            .collection('savedVideos')
            .orderBy('savedAt', 'desc')
            .get();
        
        const watchLaterGrid = document.getElementById('watchLaterGrid');
        watchLaterGrid.innerHTML = '';
        
        if (savedSnapshot.empty) {
            watchLaterGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                    <i class="fas fa-bookmark" style="font-size: 2rem; color: var(--text-secondary); margin-bottom: 15px;"></i>
                    <p>لا توجد فيديوهات محفوظة</p>
                </div>
            `;
            return;
        }
        
        savedSnapshot.forEach(doc => {
            const videoData = doc.data().videoData;
            const videoItem = document.createElement('div');
            videoItem.className = 'watch-later-item';
            videoItem.innerHTML = `
                <img src="${videoData.thumbnail}" class="watch-later-thumbnail" alt="${videoData.title}">
                <div class="watch-later-info">
                    <div class="watch-later-title">${videoData.title}</div>
                    <div class="watch-later-author">
                        <img src="${videoData.author.avatar}" class="author-avatar-small" alt="${videoData.author.name}">
                        <span>${videoData.author.name}</span>
                    </div>
                </div>
                <button class="watch-later-remove" data-video-id="${doc.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            videoItem.addEventListener('click', () => {
                openVideoById(doc.id);
            });
            
            watchLaterGrid.appendChild(videoItem);
            
            // Add remove button event
            videoItem.querySelector('.watch-later-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromWatchLater(doc.id);
            });
        });
    } catch (error) {
        console.error('Error loading watch later videos:', error);
        showToast('حدث خطأ أثناء تحميل الفيديوهات المحفوظة', 'error');
    }
    
    // Add clear all button event
    document.querySelector('.watch-later-clear').addEventListener('click', clearWatchLater);
    
    // Show the view
    DOM.videoFeed.style.display = 'none';
    DOM.discoverView.style.display = 'none';
    DOM.creatorStudio.style.display = 'none';
    DOM.profileView.style.display = 'none';
    DOM.notificationsView.style.display = 'none';
    DOM.watchLaterView.style.display = 'block';
    
    // Update navigation
    DOM.homeBtn.classList.remove('active');
    DOM.discoverBtn.classList.remove('active');
    document.querySelector(`.nav-btn[aria-label="حسابي"]`).classList.remove('active');
}

// Remove video from watch later
async function removeFromWatchLater(videoId) {
    try {
        await APP_STATE.db.collection('users')
            .doc(APP_STATE.currentUser.id)
            .collection('savedVideos')
            .doc(videoId)
            .delete();
        
        // Update UI
        const videoItem = document.querySelector(`.watch-later-item button[data-video-id="${videoId}"]`)?.closest('.watch-later-item');
        if (videoItem) {
            videoItem.classList.add('fade-out');
            setTimeout(() => {
                videoItem.remove();
            }, 300);
        }
        
        // Update state
        const index = APP_STATE.savedVideos.indexOf(videoId);
        if (index !== -1) {
            APP_STATE.savedVideos.splice(index, 1);
        }
        
        // Update save buttons in feed
        document.querySelectorAll(`.save-btn[data-video-id="${videoId}"]`).forEach(btn => {
            btn.classList.remove('active');
        });
        
        showToast('تمت إزالة الفيديو من المحفوظات', 'success');
    } catch (error) {
        console.error('Error removing from watch later:', error);
        showToast('حدث خطأ أثناء إزالة الفيديو', 'error');
    }
}

// Clear all watch later videos
async function clearWatchLater() {
    try {
        const batch = APP_STATE.db.batch();
        const savedRef = APP_STATE.db.collection('users')
            .doc(APP_STATE.currentUser.id)
            .collection('savedVideos');
        
        const snapshot = await savedRef.get();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        // Update UI
        document.getElementById('watchLaterGrid').innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <i class="fas fa-bookmark" style="font-size: 2rem; color: var(--text-secondary); margin-bottom: 15px;"></i>
                <p>لا توجد فيديوهات محفوظة</p>
            </div>
        `;
        
        // Update state
        APP_STATE.savedVideos = [];
        
        // Update save buttons in feed
        document.querySelectorAll('.save-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        showToast('تم مسح جميع الفيديوهات المحفوظة', 'success');
    } catch (error) {
        console.error('Error clearing watch later:', error);
        showToast('حدث خطأ أثناء مسح الفيديوهات المحفوظة', 'error');
    }
}

// Follow a user
async function followUser(userId) {
    if (!APP_STATE.currentUser) {
        showAuthModal();
        return;
    }
    
    if (userId === APP_STATE.currentUser.id) {
        showToast('لا يمكنك متابعة نفسك', 'warning');
        return;
    }
    
    try {
        const followRef = APP_STATE.db.collection('users')
            .doc(userId)
            .collection('followers')
            .doc(APP_STATE.currentUser.id);
        
        const followDoc = await followRef.get();
        
        if (followDoc.exists) {
            // Unfollow
            await followRef.delete();
            showToast('تم إلغاء المتابعة', 'info');
            
            // Update follow button in all videos by this user
            document.querySelectorAll(`.video-author[data-user-id="${userId}"] .follow-btn`).forEach(btn => {
                btn.textContent = 'متابعة';
            });
        } else {
            // Follow
            await followRef.set({
                followerId: APP_STATE.currentUser.id,
                followerName: APP_STATE.currentUser.name,
                followerAvatar: APP_STATE.currentUser.avatar,
                followedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('تمت المتابعة بنجاح', 'success');
            
            // Update follow button in all videos by this user
            document.querySelectorAll(`.video-author[data-user-id="${userId}"] .follow-btn`).forEach(btn => {
                btn.textContent = 'متابَع';
            });
            
            // Send notification to the user being followed
            await APP_STATE.db.collection('users').doc(userId)
                .collection('notifications')
                .add({
                    message: `${APP_STATE.currentUser.name} قام بمتابعتك`,
                    type: 'follow',
                    read: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                
            // Update AI recommendations based on follow
            updateAIRecommendations(userId, 'follow');
        }
    } catch (error) {
        console.error('Error following user:', error);
        showToast('حدث خطأ أثناء محاولة المتابعة', 'error');
    }
}

// Show comments for a video
function showComments(videoId) {
    if (!APP_STATE.currentUser) {
        showAuthModal();
        return;
    }
    
    const video = APP_STATE.videos.find(v => v.id === videoId);
    if (!video) return;
    
    // Open comments modal
    openCommentsModal(videoId);
}

// Open comments modal
async function openCommentsModal(videoId) {
    const video = APP_STATE.videos.find(v => v.id === videoId);
    if (!video) return;
    
    DOM.commentsModal.innerHTML = `
        <div class="comments-header">
            <h3 class="comments-title">التعليقات (${formatNumber(video.comments)})</h3>
            <button class="close-comments" id="closeCommentsModal">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="comments-list" id="commentsList">
            <!-- Comments will be loaded here -->
        </div>
        <div class="comment-input-container">
            <input type="text" class="comment-input" id="commentInput" placeholder="أضف تعليقاً...">
            <button class="comment-submit" id="submitComment">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    `;
    
    // Load comments
    try {
        const commentsSnapshot = await APP_STATE.db.collection('videos')
            .doc(videoId)
            .collection('comments')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();
        
        const commentsList = document.getElementById('commentsList');
        commentsList.innerHTML = '';
        
        if (commentsSnapshot.empty) {
            commentsList.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-comment-slash" style="font-size: 2rem; color: var(--text-secondary); margin-bottom: 15px;"></i>
                    <p>لا توجد تعليقات حتى الآن</p>
                </div>
            `;
        } else {
            commentsSnapshot.forEach(doc => {
                const comment = doc.data();
                const commentItem = document.createElement('div');
                commentItem.className = 'comment-item';
                commentItem.innerHTML = `
                    <img src="${comment.userAvatar || 'https://i.pravatar.cc/150?img=3'}" class="comment-avatar" alt="${comment.userName}">
                    <div class="comment-content">
                        <div class="comment-author">${comment.userName}</div>
                        <p class="comment-text">${comment.text}</p>
                        <div class="comment-actions">
                            <button class="comment-action like-comment" data-comment-id="${doc.id}">
                                <i class="fas fa-heart"></i> ${formatNumber(comment.likes || 0)}
                            </button>
                            <button class="comment-action reply-comment" data-comment-id="${doc.id}">
                                <i class="fas fa-reply"></i> رد
                            </button>
                            ${comment.userId === APP_STATE.currentUser.id ? `
                            <button class="comment-action delete-comment" data-comment-id="${doc.id}">
                                <i class="fas fa-trash"></i> حذف
                            </button>
                            ` : ''}
                        </div>
                    </div>
                `;
                
                // Add like comment event
                commentItem.querySelector('.like-comment').addEventListener('click', () => {
                    likeComment(videoId, doc.id);
                });
                
                // Add delete comment event (if owner)
                if (comment.userId === APP_STATE.currentUser.id) {
                    commentItem.querySelector('.delete-comment').addEventListener('click', () => {
                        deleteComment(videoId, doc.id);
                    });
                }
                
                commentsList.appendChild(commentItem);
            });
        }
    } catch (error) {
        console.error('Error loading comments:', error);
        showToast('حدث خطأ أثناء تحميل التعليقات', 'error');
    }
    
    // Add comment submission event
    document.getElementById('submitComment').addEventListener('click', () => {
        addComment(videoId);
    });
    
    // Add Enter key event for comment input
    document.getElementById('commentInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addComment(videoId);
        }
    });
    
    // Add close modal event
    document.getElementById('closeCommentsModal').addEventListener('click', closeCommentsModal);
    
    // Show modal
    DOM.commentsModal.classList.add('active');
}

// Add a comment
async function addComment(videoId) {
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    
    if (!text) {
        showToast('الرجاء إدخال نص التعليق', 'warning');
        return;
    }
    
    try {
        const commentRef = await APP_STATE.db.collection('videos')
            .doc(videoId)
            .collection('comments')
            .add({
                text: text,
                userId: APP_STATE.currentUser.id,
                userName: APP_STATE.currentUser.name,
                userAvatar: APP_STATE.currentUser.avatar,
                likes: 0,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        // Increment comment count
        await APP_STATE.db.collection('videos')
            .doc(videoId)
            .update({
                comments: firebase.firestore.FieldValue.increment(1)
            });
        
        // Update video in state
        const videoIndex = APP_STATE.videos.findIndex(v => v.id === videoId);
        if (videoIndex !== -1) {
            APP_STATE.videos[videoIndex].comments++;
            
            // Update comment count in UI
            document.querySelectorAll(`.comment-btn[data-video-id="${videoId}"] .action-text`).forEach(span => {
                span.textContent = formatNumber(APP_STATE.videos[videoIndex].comments);
            });
        }
        
        // Clear input
        input.value = '';
        
        // Show success message
        showToast('تم إضافة التعليق بنجاح', 'success');
        
        // Send notification to video author
        const video = APP_STATE.videos.find(v => v.id === videoId);
        if (video && video.author.id !== APP_STATE.currentUser.id) {
            await APP_STATE.db.collection('users')
                .doc(video.author.id)
                .collection('notifications')
                .add({
                    message: `${APP_STATE.currentUser.name} علّق على فيديوك "${video.title}"`,
                    type: 'comment',
                    videoId: videoId,
                    commentId: commentRef.id,
                    read: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
        }
        
        // Reload comments
        openCommentsModal(videoId);
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('حدث خطأ أثناء إضافة التعليق', 'error');
    }
}

// Like a comment
async function likeComment(videoId, commentId) {
    if (!APP_STATE.currentUser) {
        showAuthModal();
        return;
    }
    
    try {
        const likeRef = APP_STATE.db.collection('videos')
            .doc(videoId)
            .collection('comments')
            .doc(commentId)
            .collection('likes')
            .doc(APP_STATE.currentUser.id);
        
        const likeDoc = await likeRef.get();
        
        if (likeDoc.exists) {
            // Unlike
            await likeRef.delete();
            await APP_STATE.db.collection('videos')
                .doc(videoId)
                .collection('comments')
                .doc(commentId)
                .update({
                    likes: firebase.firestore.FieldValue.increment(-1)
                });
            
            // Update UI
            const likeBtn = document.querySelector(`.like-comment[data-comment-id="${commentId}"]`);
            if (likeBtn) {
                const icon = likeBtn.querySelector('i');
                const count = parseInt(likeBtn.textContent.trim().split(' ')[0]) || 0;
                likeBtn.innerHTML = `<i class="fas fa-heart"></i> ${formatNumber(count - 1)}`;
                likeBtn.classList.remove('active');
            }
        } else {
            // Like
            await likeRef.set({
                userId: APP_STATE.currentUser.id,
                likedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await APP_STATE.db.collection('videos')
                .doc(videoId)
                .collection('comments')
                .doc(commentId)
                .update({
                    likes: firebase.firestore.FieldValue.increment(1)
                });
            
            // Update UI
            const likeBtn = document.querySelector(`.like-comment[data-comment-id="${commentId}"]`);
            if (likeBtn) {
                const icon = likeBtn.querySelector('i');
                const count = parseInt(likeBtn.textContent.trim().split(' ')[0]) || 0;
                likeBtn.innerHTML = `<i class="fas fa-heart"></i> ${formatNumber(count + 1)}`;
                likeBtn.classList.add('active');
            }
            
            // Send notification to comment author
            const commentDoc = await APP_STATE.db.collection('videos')
                .doc(videoId)
                .collection('comments')
                .doc(commentId)
                .get();
            
            if (commentDoc.exists) {
                const comment = commentDoc.data();
                if (comment.userId !== APP_STATE.currentUser.id) {
                    await APP_STATE.db.collection('users')
                        .doc(comment.userId)
                        .collection('notifications')
                        .add({
                            message: `${APP_STATE.currentUser.name} أعجب بتعليقك`,
                            type: 'commentLike',
                            videoId: videoId,
                            commentId: commentId,
                            read: false,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
                }
            }
        }
    } catch (error) {
        console.error('Error liking comment:', error);
        showToast('حدث خطأ أثناء تسجيل الإعجاب بالتعليق', 'error');
    }
}

// Delete a comment
async function deleteComment(videoId, commentId) {
    try {
        // Delete comment
        await APP_STATE.db.collection('videos')
            .doc(videoId)
            .collection('comments')
            .doc(commentId)
            .delete();
        
        // Decrement comment count
        await APP_STATE.db.collection('videos')
            .doc(videoId)
            .update({
                comments: firebase.firestore.FieldValue.increment(-1)
            });
        
        // Update video in state
        const videoIndex = APP_STATE.videos.findIndex(v => v.id === videoId);
        if (videoIndex !== -1) {
            APP_STATE.videos[videoIndex].comments--;
            
            // Update comment count in UI
            document.querySelectorAll(`.comment-btn[data-video-id="${videoId}"] .action-text`).forEach(span => {
                span.textContent = formatNumber(APP_STATE.videos[videoIndex].comments);
            });
        }
        
        // Remove comment from UI
        const commentItem = document.querySelector(`.comment-item button[data-comment-id="${commentId}"]`)?.closest('.comment-item');
        if (commentItem) {
            commentItem.classList.add('fade-out');
            setTimeout(() => {
                commentItem.remove();
            }, 300);
        }
        
        showToast('تم حذف التعليق بنجاح', 'success');
    } catch (error) {
        console.error('Error deleting comment:', error);
        showToast('حدث خطأ أثناء حذف التعليق', 'error');
    }
}

// Close comments modal
function closeCommentsModal() {
    DOM.commentsModal.classList.remove('active');
}

// Share a video
function shareVideo(videoId) {
    const video = APP_STATE.videos.find(v => v.id === videoId);
    if (!video) return;
    
    const shareData = {
        title: video.title,
        text: 'شاهد هذا الفيديو الرائع على منصة قصير',
        url: `https://example.com/video/${video.id}`
    };
    
    if (navigator.share) {
        navigator.share(shareData)
            .then(() => console.log('Shared successfully'))
            .catch(err => {
                console.log('Error sharing:', err);
                fallbackShare(video);
            });
    } else {
        fallbackShare(video);
    }
}

// Fallback share method
function fallbackShare(video) {
    navigator.clipboard.writeText(`https://example.com/video/${video.id}`)
        .then(() => {
            showToast('تم نسخ رابط الفيديو', 'success');
        })
        .catch(() => {
            window.open(`https://wa.me/?text=${encodeURIComponent(`شاهد هذا الفيديو: https://example.com/video/${video.id}`)}`, '_blank');
        });
}

// Toggle sound for a video
function toggleSound(videoId) {
    const videoElement = document.querySelector(`.video-item[data-video-id="${videoId}"]`);
    if (!videoElement) return;
    
    const iframe = videoElement.querySelector('.video-player');
    const soundControl = videoElement.querySelector('.sound-control');
    
    if (!iframe || !iframe.contentWindow) return;
    
    APP_STATE.muted = !APP_STATE.muted;
    
    if (APP_STATE.muted) {
        iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
        soundControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
    } else {
        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
        soundControl.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
}

// Open video by ID
async function openVideoById(videoId) {
    try {
        // Check if video is already loaded
        const existingVideo = APP_STATE.videos.find(v => v.id === videoId);
        if (existingVideo) {
            const index = APP_STATE.videos.indexOf(existingVideo);
            APP_STATE.currentVideoIndex = index;
            scrollToVideo(index);
            return;
        }
        
        // If not, load the video
        const videoDoc = await APP_STATE.db.collection('videos').doc(videoId).get();
        if (!videoDoc.exists) {
            showToast('الفيديو غير موجود', 'error');
            return;
        }
        
        const videoData = videoDoc.data();
        const video = {
            id: videoDoc.id,
            title: videoData.title,
            description: videoData.description,
            videoId: generateVideoId(),
            url: videoData.url,
            author: {
                id: videoData.authorId,
                name: videoData.authorName,
                avatar: videoData.authorAvatar
            },
            likes: videoData.likes,
            comments: videoData.comments,
            views: videoData.views,
            music: videoData.music || "الصوت الأصلي",
            category: videoData.category || "عام",
            duration: videoData.duration || 0,
            thumbnail: videoData.thumbnail || APP_CONFIG.defaultThumbnail,
            createdAt: videoData.createdAt?.toDate() || new Date()
        };
        
        // Add to videos array and set as current
        APP_STATE.videos.unshift(video);
        APP_STATE.currentVideoIndex = 0;
        
        // Render videos
        renderVideos();
        
        // Scroll to top
        scrollToVideo(0);
    } catch (error) {
        console.error('Error loading video:', error);
        showToast('حدث خطأ أثناء تحميل الفيديو', 'error');
    }
}

// Scroll to video by index
function scrollToVideo(index) {
    const video = document.querySelector(`.video-item[data-index="${index}"]`);
    if (video) {
        video.scrollIntoView({ behavior: 'smooth' });
        
        if (!('scrollBehavior' in document.documentElement.style)) {
            window.scrollTo({
                top: video.offsetTop,
                behavior: 'auto'
            });
        }
    }
}

// Initialize network monitoring
function initNetworkMonitor() {
    window.addEventListener('online', () => {
        APP_STATE.connectionStatus = 'online';
        hideConnectionBanner();
        showToast('تم استعادة الاتصال بالإنترنت', 'success');
        
        // Sync any pending changes
        syncPendingChanges();
        
        // Reload videos if empty
        if (APP_STATE.videos.length === 0) {
            loadVideos();
        }
    });

    window.addEventListener('offline', () => {
        APP_STATE.connectionStatus = 'offline';
        showConnectionBanner('تم فقدان الاتصال بالإنترنت');
        showToast('تم فقدان الاتصال بالإنترنت', 'error');
        
        // Switch to offline mode
        switchToOfflineMode();
    });

    // Check connection speed periodically
    setInterval(() => {
        checkConnectionSpeed();
    }, 10000);
}

// Sync pending changes when back online
async function syncPendingChanges() {
    if (!APP_STATE.currentUser) return;
    
    // Sync liked videos
    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    for (const videoId of likedVideos) {
        try {
                        const likeRef = APP_STATE.db.collection('videos')
                .doc(videoId)
                .collection('likes')
                .doc(APP_STATE.currentUser.id);
            
            await likeRef.set({
                userId: APP_STATE.currentUser.id,
                likedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await APP_STATE.db.collection('videos')
                .doc(videoId)
                .update({
                    likes: firebase.firestore.FieldValue.increment(1)
                });
        } catch (error) {
            console.error(`Error syncing like for video ${videoId}:`, error);
        }
    }
    
    // Sync saved videos
    const savedVideos = JSON.parse(localStorage.getItem('savedVideos') || '[]');
    for (const videoId of savedVideos) {
        try {
            const videoDoc = await APP_STATE.db.collection('videos').doc(videoId).get();
            if (videoDoc.exists) {
                const videoData = videoDoc.data();
                
                await APP_STATE.db.collection('users')
                    .doc(APP_STATE.currentUser.id)
                    .collection('savedVideos')
                    .doc(videoId)
                    .set({
                        videoId: videoId,
                        savedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        videoData: {
                            title: videoData.title,
                            thumbnail: videoData.thumbnail,
                            author: videoData.author,
                            views: videoData.views,
                            likes: videoData.likes
                        }
                    });
            }
        } catch (error) {
            console.error(`Error syncing saved video ${videoId}:`, error);
        }
    }
    
    // Sync watched videos
    const watchedVideos = JSON.parse(localStorage.getItem('watchedVideos') || [];
    for (const videoId of watchedVideos) {
        try {
            await APP_STATE.db.collection('users')
                .doc(APP_STATE.currentUser.id)
                .collection('history')
                .doc(videoId)
                .set({
                    videoId: videoId,
                    viewedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
        } catch (error) {
            console.error(`Error syncing watched video ${videoId}:`, error);
        }
    }
    
    // Clear pending changes from localStorage
    localStorage.removeItem('likedVideos');
    localStorage.removeItem('savedVideos');
    localStorage.removeItem('watchedVideos');
    
    showToast('تم مزامنة جميع التغييرات المعلقة', 'success');
}

// Check connection speed
function checkConnectionSpeed() {
    if (!navigator.onLine) return;
    
    const startTime = Date.now();
    const testImage = new Image();
    const testUrl = `https://httpbin.org/image/jpeg?rand=${startTime}`;
    let fileSize = 0;
    
    testImage.onload = function() {
        const endTime = Date.now();
        fileSize = 10000; // Approximate size of test image in bytes
        const speedKbps = Math.round((fileSize * 8) / (endTime - startTime));
        
        if (speedKbps < 500) { // Less than 500 Kbps
            APP_STATE.userPreferences.videoQuality = 'low';
            showToast('جودة الفيديو تم ضبطها تلقائياً للوضع المنخفض بسبب سرعة الإنترنت البطيئة', 'info');
        } else if (speedKbps < 1500) { // Less than 1.5 Mbps
            APP_STATE.userPreferences.videoQuality = 'medium';
        } else {
            APP_STATE.userPreferences.videoQuality = 'high';
        }
        
        saveUserPreferences();
    };
    
    testImage.onerror = function() {
        console.log('Connection speed test failed');
    };
    
    testImage.src = testUrl;
}

// Switch to offline mode
function switchToOfflineMode() {
    APP_STATE.isOfflineMode = true;
    
    // Load offline videos if any
    if (APP_STATE.offlineVideos.length > 0) {
        APP_STATE.videos = APP_STATE.offlineVideos;
        renderVideos();
    } else {
        showError('لا يوجد اتصال بالإنترنت ولا توجد فيديوهات متاحة للعرض دون اتصال');
    }
}

// Load offline videos
async function loadOfflineVideos() {
    try {
        const offlineVideos = await caches.match('/api/offline-videos');
        if (offlineVideos) {
            const videos = await offlineVideos.json();
            APP_STATE.offlineVideos = videos.slice(0, APP_CONFIG.maxOfflineVideos);
        }
    } catch (error) {
        console.error('Error loading offline videos:', error);
    }
}

// Show connection banner
function showConnectionBanner(message) {
    DOM.connectionBanner.textContent = message;
    DOM.connectionBanner.style.display = 'block';
    setTimeout(() => {
        DOM.connectionBanner.style.opacity = '1';
    }, 10);
}

// Hide connection banner
function hideConnectionBanner() {
    DOM.connectionBanner.style.opacity = '0';
    setTimeout(() => {
        DOM.connectionBanner.style.display = 'none';
    }, 300);
}

// Initialize event listeners
function initEventListeners() {
    // Theme toggle
    DOM.themeToggle.addEventListener('click', () => {
        APP_STATE.isDarkMode = !APP_STATE.isDarkMode;
        setTheme(APP_STATE.isDarkMode);
        localStorage.setItem('darkMode', APP_STATE.isDarkMode);
        
        if (APP_STATE.currentUser) {
            APP_STATE.userPreferences.darkMode = APP_STATE.isDarkMode;
            saveUserPreferences();
        }
    });
    
    // Navigation buttons
    DOM.homeBtn.addEventListener('click', () => switchTab('home'));
    DOM.discoverBtn.addEventListener('click', () => switchTab('discover'));
    DOM.profileBtn.addEventListener('click', () => switchTab('profile'));
    DOM.notificationsBtn.addEventListener('click', () => switchTab('notifications'));
    DOM.uploadBtn.addEventListener('click', () => {
        if (APP_STATE.isCreator) {
            switchTab('creator');
        } else {
            showUploadModal();
        }
    });
    
    // Search functionality
    DOM.searchInput.addEventListener('input', debounce(handleSearch, 300));
    DOM.clearSearch.addEventListener('click', () => {
        DOM.searchInput.value = '';
        DOM.clearSearch.style.display = 'none';
    });
    DOM.cancelSearch.addEventListener('click', () => {
        DOM.searchView.style.display = 'none';
        DOM.videoFeed.style.display = 'block';
    });
    
    // Load more videos
    DOM.loadMoreBtn.addEventListener('click', loadMoreVideos);
    
    // Feed tabs
    DOM.feedTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const feed = tab.dataset.feed;
            APP_STATE.currentFeed = feed;
            
            // Update active tab
            DOM.feedTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Load appropriate feed
            loadVideos();
        });
    });
    
    // Result tabs
    DOM.resultTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const type = tab.dataset.type;
            
            // Update active tab
            DOM.resultTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show appropriate results
            document.querySelectorAll('.result-section').forEach(section => {
                section.style.display = 'none';
            });
            document.getElementById(`${type}Results`).style.display = 'block';
        });
    });
    
    // Window events
    window.addEventListener('scroll', throttle(handleScroll, 100));
    window.addEventListener('resize', throttle(handleResize, 200));
}

// Switch between app tabs
function switchTab(tab) {
    // Hide all views
    DOM.videoFeed.style.display = 'none';
    DOM.discoverView.style.display = 'none';
    DOM.profileView.style.display = 'none';
    DOM.notificationsView.style.display = 'none';
    DOM.creatorStudio.style.display = 'none';
    DOM.watchLaterView.style.display = 'none';
    DOM.searchView.style.display = 'none';
    
    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    switch (tab) {
        case 'home':
            DOM.videoFeed.style.display = 'block';
            DOM.homeBtn.classList.add('active');
            loadVideos();
            break;
            
        case 'discover':
            DOM.discoverView.style.display = 'block';
            DOM.discoverBtn.classList.add('active');
            loadDiscoverContent();
            break;
            
        case 'profile':
            if (APP_STATE.currentUser) {
                DOM.profileView.style.display = 'block';
                DOM.profileBtn.classList.add('active');
                loadProfile();
            } else {
                showAuthModal();
            }
            break;
            
        case 'notifications':
            if (APP_STATE.currentUser) {
                DOM.notificationsView.style.display = 'block';
                DOM.notificationsBtn.classList.add('active');
                loadNotifications();
            } else {
                showAuthModal();
            }
            break;
            
        case 'creator':
            if (APP_STATE.currentUser && APP_STATE.isCreator) {
                DOM.creatorStudio.style.display = 'block';
                loadCreatorStudio();
            } else {
                showAuthModal();
            }
            break;
            
        default:
            DOM.videoFeed.style.display = 'block';
            DOM.homeBtn.classList.add('active');
            loadVideos();
    }
}

// Load discover content (categories, trending, creators)
async function loadDiscoverContent() {
    try {
        // Load categories
        const categoriesSnapshot = await APP_STATE.db.collection('categories')
            .orderBy('order')
            .limit(12)
            .get();
        
        DOM.categoriesContainer.innerHTML = '';
        categoriesSnapshot.forEach(doc => {
            const category = doc.data();
            const categoryEl = document.createElement('div');
            categoryEl.className = 'category-card';
            categoryEl.innerHTML = `
                <img src="${category.image}" alt="${category.name}" loading="lazy">
                <span>${category.name}</span>
            `;
            categoryEl.addEventListener('click', () => {
                APP_STATE.currentCategory = category.id;
                switchTab('home');
                loadVideos();
            });
            DOM.categoriesContainer.appendChild(categoryEl);
        });
        
        // Load trending videos
        const trendingSnapshot = await APP_STATE.db.collection('videos')
            .where('isPublic', '==', true)
            .orderBy('views', 'desc')
            .limit(6)
            .get();
        
        DOM.trendingVideos.innerHTML = '';
        trendingSnapshot.forEach(doc => {
            const video = doc.data();
            const videoEl = document.createElement('div');
            videoEl.className = 'trending-video';
            videoEl.innerHTML = `
                <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                <div class="trending-info">
                    <h4>${video.title}</h4>
                    <p>${video.authorName}</p>
                    <span>${formatNumber(video.views)} مشاهدات</span>
                </div>
            `;
            videoEl.addEventListener('click', () => openVideoById(doc.id));
            DOM.trendingVideos.appendChild(videoEl);
        });
        
        // Load popular creators
        const creatorsSnapshot = await APP_STATE.db.collection('users')
            .where('isCreator', '==', true)
            .orderBy('followersCount', 'desc')
            .limit(8)
            .get();
        
        DOM.popularCreators.innerHTML = '';
        creatorsSnapshot.forEach(doc => {
            const creator = doc.data();
            const creatorEl = document.createElement('div');
            creatorEl.className = 'creator-card';
            creatorEl.innerHTML = `
                <img src="${creator.avatar}" alt="${creator.name}" class="creator-avatar">
                <span>${creator.name}</span>
                <button class="follow-btn" data-user-id="${doc.id}">متابعة</button>
            `;
            
            const followBtn = creatorEl.querySelector('.follow-btn');
            followBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                followUser(doc.id);
            });
            
            creatorEl.addEventListener('click', () => {
                showCreatorProfile(doc.id);
            });
            
            DOM.popularCreators.appendChild(creatorEl);
        });
    } catch (error) {
        console.error('Error loading discover content:', error);
        showToast('حدث خطأ أثناء تحميل المحتوى', 'error');
    }
}

// Show creator profile
async function showCreatorProfile(userId) {
    try {
        const userDoc = await APP_STATE.db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showToast('المنشئ غير موجود', 'error');
            return;
        }
        
        const userData = userDoc.data();
        const videosSnapshot = await APP_STATE.db.collection('videos')
            .where('authorId', '==', userId)
            .where('isPublic', '==', true)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        const videos = [];
        videosSnapshot.forEach(doc => {
            const video = doc.data();
            videos.push({
                id: doc.id,
                title: video.title,
                thumbnail: video.thumbnail,
                views: video.views,
                likes: video.likes,
                createdAt: video.createdAt.toDate()
            });
        });
        
        DOM.profileView.innerHTML = `
            <div class="profile-header">
                <div class="profile-cover">
                    <img src="${userData.coverImage || 'https://via.placeholder.com/800x200/161616/AAAAAA?text=قصير'}" alt="Cover" loading="lazy">
                </div>
                <div class="profile-info">
                    <img src="${userData.avatar}" alt="${userData.name}" class="profile-avatar">
                    <h2 class="profile-name">${userData.name}</h2>
                    <p class="profile-bio">${userData.bio || 'لا يوجد وصف'}</p>
                    <div class="profile-stats">
                        <div class="stat-item">
                            <span class="stat-number">${formatNumber(videos.length)}</span>
                            <span class="stat-label">فيديوهات</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${formatNumber(userData.followersCount || 0)}</span>
                            <span class="stat-label">متابعون</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${formatNumber(userData.likesCount || 0)}</span>
                            <span class="stat-label">إعجابات</span>
                        </div>
                    </div>
                    <button class="follow-btn large" id="profileFollowBtn" data-user-id="${userId}">
                        ${APP_STATE.currentUser?.following?.includes(userId) ? 'متابَع' : 'متابعة'}
                    </button>
                </div>
            </div>
            <div class="profile-videos">
                <h3 class="section-title">فيديوهات ${userData.name}</h3>
                <div class="video-grid" id="creatorVideosGrid">
                    ${videos.map(video => `
                        <div class="video-grid-item" data-video-id="${video.id}">
                            <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                            <div class="video-overlay">
                                <span class="video-views">${formatNumber(video.views)} مشاهدات</span>
                                <span class="video-likes">${formatNumber(video.likes)} إعجاب</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Add follow button event
        document.getElementById('profileFollowBtn').addEventListener('click', () => {
            followUser(userId);
        });
        
        // Add video click events
        document.querySelectorAll('.video-grid-item').forEach(item => {
            item.addEventListener('click', () => {
                openVideoById(item.dataset.videoId);
            });
        });
        
        // Show profile view
        switchTab('profile');
    } catch (error) {
        console.error('Error loading creator profile:', error);
        showToast('حدث خطأ أثناء تحميل الملف الشخصي', 'error');
    }
}

// Load user profile
async function loadProfile() {
    if (!APP_STATE.currentUser) return;
    
    try {
        const userDoc = await APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id).get();
        if (!userDoc.exists) return;
        
        const userData = userDoc.data();
        const videosSnapshot = await APP_STATE.db.collection('videos')
            .where('authorId', '==', APP_STATE.currentUser.id)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        const videos = [];
        videosSnapshot.forEach(doc => {
            const video = doc.data();
            videos.push({
                id: doc.id,
                title: video.title,
                thumbnail: video.thumbnail,
                views: video.views,
                likes: video.likes,
                isPublic: video.isPublic,
                createdAt: video.createdAt.toDate()
            });
        });
        
        DOM.profileView.innerHTML = `
            <div class="profile-header">
                <div class="profile-cover">
                    <img src="${userData.coverImage || 'https://via.placeholder.com/800x200/161616/AAAAAA?text=قصير'}" alt="Cover" loading="lazy">
                    <button class="edit-profile-btn" id="editProfileBtn">
                        <i class="fas fa-pencil-alt"></i> تعديل الملف
                    </button>
                </div>
                <div class="profile-info">
                    <div class="avatar-edit">
                        <img src="${userData.avatar}" alt="${userData.name}" class="profile-avatar">
                        <button class="edit-avatar-btn" id="editAvatarBtn">
                            <i class="fas fa-camera"></i>
                        </button>
                    </div>
                    <h2 class="profile-name">${userData.name}</h2>
                    <p class="profile-bio">${userData.bio || 'لا يوجد وصف'}</p>
                    <div class="profile-stats">
                        <div class="stat-item">
                            <span class="stat-number">${formatNumber(videos.length)}</span>
                            <span class="stat-label">فيديوهات</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${formatNumber(userData.followersCount || 0)}</span>
                            <span class="stat-label">متابعون</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${formatNumber(userData.likesCount || 0)}</span>
                            <span class="stat-label">إعجابات</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="profile-tabs">
                <button class="profile-tab active" data-tab="videos">الفيديوهات</button>
                <button class="profile-tab" data-tab="liked">الإعجابات</button>
                <button class="profile-tab" data-tab="saved">المحفوظات</button>
                ${APP_STATE.isCreator ? `<button class="profile-tab" data-tab="analytics">التحليلات</button>` : ''}
            </div>
            <div class="profile-content">
                <div class="tab-content active" id="videosTab">
                    <div class="video-grid" id="userVideosGrid">
                        ${videos.map(video => `
                            <div class="video-grid-item" data-video-id="${video.id}">
                                <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                                <div class="video-overlay">
                                    <span class="video-views">${formatNumber(video.views)} مشاهدات</span>
                                    <span class="video-likes">${formatNumber(video.likes)} إعجاب</span>
                                    ${!video.isPublic ? `<span class="video-private"><i class="fas fa-lock"></i> خاص</span>` : ''}
                                </div>
                                <button class="video-edit-btn" data-video-id="${video.id}">
                                    <i class="fas fa-ellipsis-h"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="tab-content" id="likedTab">
                    <div class="loading-spinner"></div>
                </div>
                <div class="tab-content" id="savedTab">
                    <div class="loading-spinner"></div>
                </div>
                ${APP_STATE.isCreator ? `
                <div class="tab-content" id="analyticsTab">
                    <div class="loading-spinner"></div>
                </div>
                ` : ''}
            </div>
        `;
        
        // Add tab switching
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                
                // Update active tab
                document.querySelectorAll('.profile-tab').forEach(t => {
                    t.classList.remove('active');
                });
                tab.classList.add('active');
                
                // Show appropriate content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${tabName}Tab`).classList.add('active');
                
                // Load content if not loaded
                if (tabName === 'liked' && document.getElementById('likedTab').innerHTML.includes('loading-spinner')) {
                    loadLikedVideos();
                } else if (tabName === 'saved' && document.getElementById('savedTab').innerHTML.includes('loading-spinner')) {
                    showWatchLaterView();
                } else if (tabName === 'analytics' && document.getElementById('analyticsTab').innerHTML.includes('loading-spinner')) {
                    loadCreatorAnalytics();
                }
            });
        });
        
        // Add video click events
        document.querySelectorAll('.video-grid-item').forEach(item => {
            item.addEventListener('click', () => {
                openVideoById(item.dataset.videoId);
            });
        });
        
        // Add edit buttons events
        document.getElementById('editProfileBtn').addEventListener('click', showEditProfileModal);
        document.getElementById('editAvatarBtn').addEventListener('click', showAvatarUpload);
        
        // Add video edit buttons events
        document.querySelectorAll('.video-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showVideoOptions(btn.dataset.videoId);
            });
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('حدث خطأ أثناء تحميل الملف الشخصي', 'error');
    }
}

// Load liked videos for profile
async function loadLikedVideos() {
    try {
        const likedSnapshot = await APP_STATE.db.collection('users')
            .doc(APP_STATE.currentUser.id)
            .collection('likedVideos')
            .orderBy('likedAt', 'desc')
            .limit(20)
            .get();
        
        const likedTab = document.getElementById('likedTab');
        likedTab.innerHTML = '';
        
        if (likedSnapshot.empty) {
            likedTab.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-heart" style="font-size: 2rem; color: var(--text-secondary); margin-bottom: 15px;"></i>
                    <p>لا توجد فيديوهات معجبة</p>
                </div>
            `;
            return;
        }
        
        const videoGrid = document.createElement('div');
        videoGrid.className = 'video-grid';
        
        for (const doc of likedSnapshot.docs) {
            const videoData = doc.data();
            const videoDoc = await APP_STATE.db.collection('videos').doc(doc.id).get();
            
            if (videoDoc.exists) {
                const video = videoDoc.data();
                const videoItem = document.createElement('div');
                videoItem.className = 'video-grid-item';
                videoItem.dataset.videoId = doc.id;
                videoItem.innerHTML = `
                    <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                    <div class="video-overlay">
                        <span class="video-views">${formatNumber(video.views)} مشاهدات</span>
                        <span class="video-likes">${formatNumber(video.likes)} إعجاب</span>
                    </div>
                `;
                videoItem.addEventListener('click', () => openVideoById(doc.id));
                videoGrid.appendChild(videoItem);
            }
        }
        
        likedTab.appendChild(videoGrid);
    } catch (error) {
        console.error('Error loading liked videos:', error);
        document.getElementById('likedTab').innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>حدث خطأ أثناء تحميل الفيديوهات المعجبة</p>
                <button class="retry-btn" onclick="loadLikedVideos()">إعادة المحاولة</button>
            </div>
        `;
    }
}

// Show video options menu
function showVideoOptions(videoId) {
    const video = APP_STATE.videos.find(v => v.id === videoId);
    if (!video) return;
    
    const optionsMenu = document.createElement('div');
    optionsMenu.className = 'video-options-menu';
    optionsMenu.innerHTML = `
        <button class="option-btn" data-action="edit" data-video-id="${videoId}">
            <i class="fas fa-edit"></i> تعديل
        </button>
        <button class="option-btn" data-action="delete" data-video-id="${videoId}">
            <i class="fas fa-trash"></i> حذف
        </button>
        <button class="option-btn" data-action="privacy" data-video-id="${videoId}">
            <i class="fas fa-lock"></i> ${video.isPublic ? 'جعل خاص' : 'جعل عام'}
        </button>
        <button class="option-btn" data-action="stats" data-video-id="${videoId}">
            <i class="fas fa-chart-bar"></i> الإحصائيات
        </button>
        <button class="option-btn" data-action="cancel">
            <i class="fas fa-times"></i> إلغاء
        </button>
    `;
    
    document.body.appendChild(optionsMenu);
    
    // Position menu near the button
    const btn = document.querySelector(`.video-edit-btn[data-video-id="${videoId}"]`);
    const rect = btn.getBoundingClientRect();
    optionsMenu.style.top = `${rect.bottom + window.scrollY}px`;
    optionsMenu.style.left = `${rect.left + rect.width - optionsMenu.offsetWidth + window.scrollX}px`;
    
    // Add event listeners
    optionsMenu.querySelector('[data-action="edit"]').addEventListener('click', () => {
        editVideo(videoId);
        optionsMenu.remove();
    });
    
    optionsMenu.querySelector('[data-action="delete"]').addEventListener('click', () => {
        confirmDeleteVideo(videoId);
        optionsMenu.remove();
    });
    
    optionsMenu.querySelector('[data-action="privacy"]').addEventListener('click', () => {
        toggleVideoPrivacy(videoId);
        optionsMenu.remove();
    });
    
    optionsMenu.querySelector('[data-action="stats"]').addEventListener('click', () => {
        showVideoStats(videoId);
        optionsMenu.remove();
    });
    
    optionsMenu.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        optionsMenu.remove();
    });
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!optionsMenu.contains(e.target) && e.target !== btn) {
                optionsMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Edit video details
async function editVideo(videoId) {
    try {
        const videoDoc = await APP_STATE.db.collection('videos').doc(videoId).get();
        if (!videoDoc.exists) {
            showToast('الفيديو غير موجود', 'error');
            return;
        }
        
        const video = videoDoc.data();
        APP_STATE.currentEditingVideo = {
            id: videoId,
            title: video.title,
            description: video.description,
            category: video.category,
            isPublic: video.isPublic,
            thumbnail: video.thumbnail
        };
        
        // Show edit modal
        showEditVideoModal();
    } catch (error) {
        console.error('Error editing video:', error);
        showToast('حدث خطأ أثناء تحميل بيانات الفيديو', 'error');
    }
}

// Confirm video deletion
function confirmDeleteVideo(videoId) {
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'confirm-dialog';
    confirmDialog.innerHTML = `
        <div class="confirm-content">
            <h3>حذف الفيديو</h3>
            <p>هل أنت متأكد أنك تريد حذف هذا الفيديو؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div class="confirm-buttons">
                <button class="cancel-btn" id="cancelDelete">إلغاء</button>
                <button class="delete-btn" id="confirmDelete" data-video-id="${videoId}">حذف</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(confirmDialog);
    
    document.getElementById('cancelDelete').addEventListener('click', () => {
        confirmDialog.remove();
    });
    
    document.getElementById('confirmDelete').addEventListener('click', async () => {
        try {
            await deleteVideo(document.getElementById('confirmDelete').dataset.videoId);
            confirmDialog.remove();
        } catch (error) {
            console.error('Error deleting video:', error);
            showToast('حدث خطأ أثناء حذف الفيديو', 'error');
        }
    });
}

// Delete video
async function deleteVideo(videoId) {
    try {
        // Delete video document
        await APP_STATE.db.collection('videos').doc(videoId).delete();
        
        // Delete video file from storage
        await APP_STATE.storage.ref(`videos/${videoId}`).delete();
        
        // Delete thumbnail if not default
        const video = APP_STATE.uploadedVideos.find(v => v.id === videoId);
        if (video && video.thumbnail !== APP_CONFIG.defaultThumbnail) {
            await APP_STATE.storage.refFromURL(video.thumbnail).delete();
        }
        
        // Remove from uploaded videos
        APP_STATE.uploadedVideos = APP_STATE.uploadedVideos.filter(v => v.id !== videoId);
        
        // Remove from videos array if exists
        APP_STATE.videos = APP_STATE.videos.filter(v => v.id !== videoId);
        
        // Update UI
        document.querySelector(`.video-grid-item[data-video-id="${videoId}"]`)?.remove();
        
        showToast('تم حذف الفيديو بنجاح', 'success');
    } catch (error) {
        console.error('Error deleting video:', error);
        throw error;
    }
}

// Toggle video privacy
async function toggleVideoPrivacy(videoId) {
    try {
        const videoDoc = await APP_STATE.db.collection('videos').doc(videoId).get();
        if (!videoDoc.exists) return;
        
        const currentPrivacy = videoDoc.data().isPublic;
        
        await APP_STATE.db.collection('videos').doc(videoId).update({
            isPublic: !currentPrivacy
        });
        
        // Update UI
        const privacyBadge = document.querySelector(`.video-grid-item[data-video-id="${videoId}"] .video-private`);
        if (currentPrivacy) {
            if (!privacyBadge) {
                const overlay = document.querySelector(`.video-grid-item[data-video-id="${videoId}"] .video-overlay`);
                if (overlay) {
                    const badge = document.createElement('span');
                    badge.className = 'video-private';
                    badge.innerHTML = '<i class="fas fa-lock"></i> خاص';
                    overlay.appendChild(badge);
                }
            }
        } else {
            privacyBadge?.remove();
        }
        
        showToast(`تم جعل الفيديو ${currentPrivacy ? 'خاص' : 'عام'}`, 'success');
    } catch (error) {
        console.error('Error toggling video privacy:', error);
        showToast('حدث خطأ أثناء تغيير خصوصية الفيديو', 'error');
    }
}

// Show video statistics
async function showVideoStats(videoId) {
    try {
        const videoDoc = await APP_STATE.db.collection('videos').doc(videoId).get();
        if (!videoDoc.exists) {
            showToast('الفيديو غير موجود', 'error');
            return;
        }
        
        const video = videoDoc.data();
        
        // Get analytics data
        const statsDoc = await APP_STATE.db.collection('videoAnalytics').doc(videoId).get();
        const stats = statsDoc.exists ? statsDoc.data() : {};
        
        // Show stats modal
        const statsModal = document.createElement('div');
        statsModal.className = 'stats-modal';
        statsModal.innerHTML = `
            <div class="stats-content">
                <div class="stats-header">
                    <h3>إحصائيات الفيديو</h3>
                    <button class="close-stats" id="closeStatsModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="stats-body">
                    <div class="stats-overview">
                        <div class="stat-card">
                            <span class="stat-number">${formatNumber(video.views)}</span>
                            <span class="stat-label">مشاهدات</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-number">${formatNumber(video.likes)}</span>
                            <span class="stat-label">إعجابات</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-number">${formatNumber(video.comments)}</span>
                            <span class="stat-label">تعليقات</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-number">${formatNumber(stats.shares || 0)}</span>
                            <span class="stat-label">مشاركات</span>
                        </div>
                    </div>
                    <div class="stats-charts">
                        <div class="chart-container">
                            <h4>المشاهدات حسب الوقت</h4>
                            <canvas id="viewsChart"></canvas>
                        </div>
                        <div class="chart-container">
                            <h4>المشاهدات حسب المنطقة</h4>
                            <canvas id="regionChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(statsModal);
        
        // Close modal
        document.getElementById('closeStatsModal').addEventListener('click', () => {
            statsModal.remove();
        });
        
        // Render charts
        renderVideoCharts(videoId, stats);
    } catch (error) {
        console.error('Error showing video stats:', error);
        showToast('حدث خطأ أثناء تحميل إحصائيات الفيديو', 'error');
    }
}

// Render video analytics charts
function renderVideoCharts(videoId, stats) {
    // Views over time chart
    const viewsCtx = document.getElementById('viewsChart').getContext('2d');
    const viewsChart = new Chart(viewsCtx, {
        type: 'line',
        data: {
            labels: stats.viewsOverTime?.labels || ['اليوم 1', 'اليوم 2', 'اليوم 3', 'اليوم 4', 'اليوم 5', 'اليوم 6', 'اليوم 7'],
            datasets: [{
                label: 'المشاهدات',
                data: stats.viewsOverTime?.data || [10, 20, 35, 50, 45, 60, 75],
                borderColor: '#ff4757',
                backgroundColor: 'rgba(255, 71, 87, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Regions chart
    const regionCtx = document.getElementById('regionChart').getContext('2d');
    const regionChart = new Chart(regionCtx, {
        type: 'doughnut',
        data: {
            labels: stats.regions?.labels || ['المملكة', 'مصر', 'الجزائر', 'العراق', 'دول أخرى'],
            datasets: [{
                data: stats.regions?.data || [45, 20, 15, 10, 10],
                backgroundColor: [
                    '#ff4757',
                    '#ff6b81',
                    '#ff8d9e',
                    '#ffb0bb',
                    '#ffd3d9'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Show edit profile modal
function showEditProfileModal() {
    const modal = document.createElement('div');
    modal.className = 'edit-profile-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>تعديل الملف الشخصي</h3>
                <button class="close-modal" id="closeEditProfileModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="profileName">الاسم</label>
                    <input type="text" id="profileName" value="${APP_STATE.currentUser.name}">
                </div>
                <div class="form-group">
                    <label for="profileBio">الوصف</label>
                    <textarea id="profileBio">${APP_STATE.currentUser.bio || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="profileCover">صورة الغلاف</label>
                    <input type="file" id="profileCover" accept="image/*">
                </div>
                <div class="form-actions">
                    <button class="cancel-btn" id="cancelEditProfile">إلغاء</button>
                    <button class="save-btn" id="saveProfile">حفظ التغييرات</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal
    document.getElementById('closeEditProfileModal').addEventListener('click', () => {
        modal.remove();
    });
    
    document.getElementById('cancelEditProfile').addEventListener('click', () => {
        modal.remove();
    });
    
    // Save profile
    document.getElementById('saveProfile').addEventListener('click', async () => {
        const name = document.getElementById('profileName').value.trim();
        const bio = document.getElementById('profileBio').value.trim();
        
        if (!name) {
            showToast('الرجاء إدخال الاسم', 'warning');
            return;
        }
        
        try {
            // Update profile in Firestore
            await APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id).update({
                name: name,
                bio: bio || firebase.firestore.FieldValue.delete(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update cover image if selected
            const coverFile = document.getElementById('profileCover').files[0];
            if (coverFile) {
                const coverRef = APP_STATE.storage.ref(`users/${APP_STATE.currentUser.id}/cover`);
                await coverRef.put(coverFile);
                const coverUrl = await coverRef.getDownloadURL();
                
                await APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id).update({
                    coverImage: coverUrl
                });
                
                APP_STATE.currentUser.coverImage = coverUrl;
            }
            
            // Update current user in state
            APP_STATE.currentUser.name = name;
            APP_STATE.currentUser.bio = bio || null;
            
            // Update UI
            updateAuthUI();
            loadProfile();
            
            showToast('تم تحديث الملف الشخصي بنجاح', 'success');
            modal.remove();
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('حدث خطأ أثناء تحديث الملف الشخصي', 'error');
        }
    });
}

// Show avatar upload dialog
function showAvatarUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.click();
    
    input.addEventListener('change', async () => {
        if (!input.files.length) return;
        
        const file = input.files[0];
        if (!file.type.match('image.*')) {
            showToast('الرجاء اختيار صورة صالحة', 'warning');
            return;
        }
        
        try {
            showLoading('جاري تحديث الصورة...');
            
            // Upload new avatar
            const avatarRef = APP_STATE.storage.ref(`users/${APP_STATE.currentUser.id}/avatar`);
            await avatarRef.put(file);
            const avatarUrl = await avatarRef.getDownloadURL();
            
            // Update user document
            await APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id).update({
                avatar: avatarUrl,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update current user in state
            APP_STATE.currentUser.avatar = avatarUrl;
            
            // Update UI
            updateAuthUI();
            loadProfile();
            
            hideLoading();
            showToast('تم تحديث الصورة بنجاح', 'success');
        } catch (error) {
            console.error('Error updating avatar:', error);
            hideLoading();
            showToast('حدث خطأ أثناء تحديث الصورة', 'error');
        }
    });
}

// Show edit video modal
function showEditVideoModal() {
    if (!APP_STATE.currentEditingVideo) return;
    
    const modal = document.createElement('div');
    modal.className = 'edit-video-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>تعديل الفيديو</h3>
                <button class="close-modal" id="closeEditVideoModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="video-preview">
                    <img src="${APP_STATE.currentEditingVideo.thumbnail}" alt="Video thumbnail">
                </div>
                <div class="form-group">
                    <label for="videoTitle">عنوان الفيديو</label>
                    <input type="text" id="videoTitle" value="${APP_STATE.currentEditingVideo.title}">
                </div>
                <div class="form-group">
                    <label for="videoDescription">وصف الفيديو</label>
                    <textarea id="videoDescription">${APP_STATE.currentEditingVideo.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="videoCategory">التصنيف</label>
                    <select id="videoCategory">
                        <option value="comedy" ${APP_STATE.currentEditingVideo.category === 'comedy' ? 'selected' : ''}>كوميديا</option>
                        <option value="music" ${APP_STATE.currentEditingVideo.category === 'music' ? 'selected' : ''}>موسيقى</option>
                        <option value="education" ${APP_STATE.currentEditingVideo.category === 'education' ? 'selected' : ''}>تعليمي</option>
                        <option value="gaming" ${APP_STATE.currentEditingVideo.category === 'gaming' ? 'selected' : ''}>ألعاب</option>
                        <option value="sports" ${APP_STATE.currentEditingVideo.category === 'sports' ? 'selected' : ''}>رياضة</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="videoThumbnail">صورة مصغرة جديدة</label>
                    <input type="file" id="videoThumbnail" accept="image/*">
                </div>
                <div class="form-group">
                    <label class="checkbox-container">
                        <input type="checkbox" id="videoPublic" ${APP_STATE.currentEditingVideo.isPublic ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        فيديو عام (يمكن للجميع مشاهدته)
                    </label>
                </div>
                <div class="form-actions">
                    <button class="cancel-btn" id="cancelEditVideo">إلغاء</button>
                    <button class="save-btn" id="saveVideoChanges">حفظ التغييرات</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal
    document.getElementById('closeEditVideoModal').addEventListener('click', () => {
        modal.remove();
    });
    
    document.getElementById('cancelEditVideo').addEventListener('click', () => {
        modal.remove();
    });
    
    // Save video changes
    document.getElementById('saveVideoChanges').addEventListener('click', async () => {
        const title = document.getElementById('videoTitle').value.trim();
        const description = document.getElementById('videoDescription').value.trim();
        const category = document.getElementById('videoCategory').value;
        const isPublic = document.getElementById('videoPublic').checked;
        const thumbnailFile = document.getElementById('videoThumbnail').files[0];
        
        if (!title) {
            showToast('الرجاء إدخال عنوان الفيديو', 'warning');
            return;
        }
        
        try {
            showLoading('جاري حفظ التغييرات...');
            
            const updates = {
                title: title,
                description: description || firebase.firestore.FieldValue.delete(),
                category: category,
                isPublic: isPublic,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Upload new thumbnail if selected
            if (thumbnailFile) {
                const thumbnailRef = APP_STATE.storage.ref(`videos/${APP_STATE.currentEditingVideo.id}/thumbnail`);
                await thumbnailRef.put(thumbnailFile);
                const thumbnailUrl = await thumbnailRef.getDownloadURL();
                updates.thumbnail = thumbnailUrl;
                
                // Delete old thumbnail if not default
                if (APP_STATE.currentEditingVideo.thumbnail !== APP_CONFIG.defaultThumbnail) {
                    try {
                        await APP_STATE.storage.refFromURL(APP_STATE.currentEditingVideo.thumbnail).delete();
                    } catch (error) {
                        console.error('Error deleting old thumbnail:', error);
                    }
                }
            }
            
            // Update video document
            await APP_STATE.db.collection('videos').doc(APP_STATE.currentEditingVideo.id).update(updates);
            
            // Update video in state if exists
            const videoIndex = APP_STATE.videos.findIndex(v => v.id === APP_STATE.currentEditingVideo.id);
            if (videoIndex !== -1) {
                APP_STATE.videos[videoIndex].title = title;
                APP_STATE.videos[videoIndex].description = description || '';
                APP_STATE.videos[videoIndex].category = category;
                APP_STATE.videos[videoIndex].isPublic = isPublic;
                if (thumbnailFile) {
                    APP_STATE.videos[videoIndex].thumbnail = updates.thumbnail;
                }
            }
            
            // Update uploaded videos if exists
            const uploadedIndex = APP_STATE.uploadedVideos.findIndex(v => v.id === APP_STATE.currentEditingVideo.id);
            if (uploadedIndex !== -1) {
                APP_STATE.uploadedVideos[uploadedIndex].title = title;
                APP_STATE.uploadedVideos[uploadedIndex].description = description || '';
                APP_STATE.uploadedVideos[uploadedIndex].category = category;
                APP_STATE.uploadedVideos[uploadedIndex].isPublic = isPublic;
                if (thumbnailFile) {
                    APP_STATE.uploadedVideos[uploadedIndex].thumbnail = updates.thumbnail;
                }
            }
            
            // Update UI
            loadProfile();
            
            hideLoading();
            showToast('تم تحديث الفيديو بنجاح', 'success');
            modal.remove();
        } catch (error) {
            console.error('Error updating video:', error);
            hideLoading();
            showToast('حدث خطأ أثناء تحديث الفيديو', 'error');
        }
    });
}

// Load creator studio
async function loadCreatorStudio() {
    try {
        // Load creator videos
        const videosSnapshot = await APP_STATE.db.collection('videos')
            .where('authorId', '==', APP_STATE.currentUser.id)
            .orderBy('createdAt', 'desc')
            .get();
        
        APP_STATE.uploadedVideos = [];
        videosSnapshot.forEach(doc => {
            const video = doc.data();
            APP_STATE.uploadedVideos.push({
                id: doc.id,
                title: video.title,
                thumbnail: video.thumbnail,
                views: video.views,
                likes: video.likes,
                comments: video.comments,
                isPublic: video.isPublic,
                createdAt: video.createdAt.toDate()
            });
        });
        
        // Load analytics data
        await loadCreatorAnalytics();
        
        // Render creator studio
        DOM.creatorStudio.innerHTML = `
            <div class="creator-header">
                <h2>استوديو المنشئ</h2>
                <button class="upload-video-btn" id="uploadVideoBtn">
                    <i class="fas fa-plus"></i> رفع فيديو جديد
                </button>
            </div>
            <div class="creator-tabs">
                <button class="creator-tab active" data-tab="videos">فيديوهاتي</button>
                <button class="creator-tab" data-tab="analytics">التحليلات</button>
                <button class="creator-tab" data-tab="earnings">الأرباح</button>
                <button class="creator-tab" data-tab="settings">الإعدادات</button>
            </div>
            <div class="creator-content">
                <div class="tab-content active" id="videosTab">
                    <div class="video-grid" id="creatorVideosGrid">
                        ${APP_STATE.uploadedVideos.map(video => `
                            <div class="video-grid-item" data-video-id="${video.id}">
                                <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                                <div class="video-overlay">
                                    <span class="video-views">${formatNumber(video.views)} مشاهدات</span>
                                    <span class="video-likes">${formatNumber(video.likes)} إعجاب</span>
                                    ${!video.isPublic ? `<span class="video-private"><i class="fas fa-lock"></i> خاص</span>` : ''}
                                </div>
                                <button class="video-edit-btn" data-video-id="${video.id}">
                                    <i class="fas fa-ellipsis-h"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="tab-content" id="analyticsTab">
                    <div class="analytics-overview">
                        <div class="analytics-card">
                            <span class="analytics-number">${formatNumber(APP_STATE.analyticsData?.totalViews || 0)}</span>
                            <span class="analytics-label">إجمالي المشاهدات</span>
                        </div>
                        <div class="analytics-card">
                            <span class="analytics-number">${formatNumber(APP_STATE.analyticsData?.totalLikes || 0)}</span>
                            <span class="analytics-label">إجمالي الإعجابات</span>
                        </div>
                        <div class="analytics-card">
                            <span class="analytics-number">${formatNumber(APP_STATE.analyticsData?.totalFollowers || 0)}</span>
                            <span class="analytics-label">إجمالي المتابعين</span>
                        </div>
                        <div class="analytics-card">
                            <span class="analytics-number">${formatNumber(APP_STATE.analyticsData?.engagementRate || 0)}%</span>
                            <span class="analytics-label">معدل التفاعل</span>
                        </div>
                    </div>
                    <div class="analytics-chart">
                        <canvas id="viewsChart"></canvas>
                    </div>
                </div>
                <div class="tab-content" id="earningsTab">
                    <div class="earnings-card">
                        <div class="earnings-header">
                            <h3>أرباح هذا الشهر</h3>
                            <span class="earnings-amount">${APP_STATE.analyticsData?.earnings?.currentMonth || 0} ر.س</span>
                        </div>
                        <div class="earnings-stats">
                            <div class="stat-item">
                                <span class="stat-number">${APP_STATE.analyticsData?.earnings?.lastMonth || 0} ر.س</span>
                                <span class="stat-label">الشهر الماضي</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">${APP_STATE.analyticsData?.earnings?.total || 0} ر.س</span>
                                <span class="stat-label">الإجمالي</span>
                            </div>
                        </div>
                        <div class="earnings-chart">
                            <canvas id="earningsChart"></canvas>
                        </div>
                    </div>
                </div>
                <div class="tab-content" id="settingsTab">
                    <div class="settings-form">
                        <h3>إعدادات المنشئ</h3>
                        <div class="form-group">
                            <label for="creatorName">اسم القناة</label>
                            <input type="text" id="creatorName" value="${APP_STATE.currentUser.name}">
                        </div>
                        <div class="form-group">
                            <label for="creatorBio">وصف القناة</label>
                            <textarea id="creatorBio">${APP_STATE.currentUser.bio || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="creatorCategory">تصنيف المحتوى</label>
                            <select id="creatorCategory">
                                <option value="comedy" ${APP_STATE.currentUser.creatorCategory === 'comedy' ? 'selected' : ''}>كوميديا</option>
                                <option value="music" ${APP_STATE.currentUser.creatorCategory === 'music' ? 'selected' : ''}>موسيقى</option>
                                <option value="education" ${APP_STATE.currentUser.creatorCategory === 'education' ? 'selected' : ''}>تعليمي</option>
                                <option value="gaming" ${APP_STATE.currentUser.creatorCategory === 'gaming' ? 'selected' : ''}>ألعاب</option>
                                <option value="sports" ${APP_STATE.currentUser.creatorCategory === 'sports' ? 'selected' : ''}>رياضة</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="creatorPaypal">بريد PayPal للإيرادات</label>
                            <input type="email" id="creatorPaypal" value="${APP_STATE.currentUser.paypalEmail || ''}">
                        </div>
                        <div class="form-actions">
                            <button class="save-btn" id="saveCreatorSettings">حفظ الإعدادات</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add tab switching
        document.querySelectorAll('.creator-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                
                // Update active tab
                document.querySelectorAll('.creator-tab').forEach(t => {
                    t.classList.remove('active');
                });
                tab.classList.add('active');
                
                // Show appropriate content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${tabName}Tab`).classList.add('active');
            });
        });
        
        // Add video click events
        document.querySelectorAll('.video-grid-item').forEach(item => {
            item.addEventListener('click', () => {
                openVideoById(item.dataset.videoId);
            });
        });
        
        // Add video edit buttons events
        document.querySelectorAll('.video-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showVideoOptions(btn.dataset.videoId);
            });
        });
        
        // Add upload video button event
        document.getElementById('uploadVideoBtn').addEventListener('click', showUploadModal);
        
        // Add save settings event
        document.getElementById('saveCreatorSettings').addEventListener('click', saveCreatorSettings);
        
        // Render charts
        renderCreatorCharts();
    } catch (error) {
        console.error('Error loading creator studio:', error);
        showToast('حدث خطأ أثناء تحميل استوديو المنشئ', 'error');
    }
}

// Load creator analytics
async function loadCreatorAnalytics() {
    try {
        const analyticsDoc = await APP_STATE.db.collection('creatorAnalytics').doc(APP_STATE.currentUser.id).get();
        if (analyticsDoc.exists) {
            APP_STATE.analyticsData = analyticsDoc.data();
        } else {
            APP_STATE.analyticsData = {
                totalViews: 0,
                totalLikes: 0,
                totalFollowers: 0,
                engagementRate: 0,
                earnings: {
                    currentMonth: 0,
                    lastMonth: 0,
                    total: 0
                }
            };
        }
    } catch (error) {
        console.error('Error loading creator analytics:', error);
        APP_STATE.analyticsData = null;
    }
}

// Render creator analytics charts
function renderCreatorCharts() {
    if (!APP_STATE.analyticsData) return;
    
    // Views chart
    const viewsCtx = document.getElementById('viewsChart')?.getContext('2d');
    if (viewsCtx) {
        new Chart(viewsCtx, {
            type: 'line',
            data: {
                labels: APP_STATE.analyticsData.viewsOverTime?.labels || ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو'],
                datasets: [{
                    label: 'المشاهدات',
                    data: APP_STATE.analyticsData.viewsOverTime?.data || [100, 200, 350, 500, 450, 600, 750],
                    borderColor: '#ff4757',
                    backgroundColor: 'rgba(255, 71, 87, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    // Earnings chart
    const earningsCtx = document.getElementById('earningsChart')?.getContext('2d');
    if (earningsCtx) {
        new Chart(earningsCtx, {
            type: 'bar',
            data: {
                labels: APP_STATE.analyticsData.earnings?.months || ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
                datasets: [{
                    label: 'الأرباح',
                    data: APP_STATE.analyticsData.earnings?.monthlyData || [50, 75, 100, 125, 150, 175],
                    backgroundColor: '#ff4757',
                    borderColor: '#ff4757',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Save creator settings
async function saveCreatorSettings() {
    const name = document.getElementById('creatorName').value.trim();
    const bio = document.getElementById('creatorBio').value.trim();
    const category = document.getElementById('creatorCategory').value;
    const paypalEmail = document.getElementById('creatorPaypal').value.trim();
    
    if (!name) {
        showToast('الرجاء إدخال اسم القناة', 'warning');
        return;
    }
    
    try {
        await APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id).update({
            name: name,
            bio: bio || firebase.firestore.FieldValue.delete(),
            creatorCategory: category,
            paypalEmail: paypalEmail || firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Update current user in state
        APP_STATE.currentUser.name = name;
        APP_STATE.currentUser.bio = bio || null;
        APP_STATE.currentUser.creatorCategory = category;
        APP_STATE.currentUser.paypalEmail = paypalEmail || null;
        
        // Update UI
        updateAuthUI();
        
        showToast('تم حفظ إعدادات المنشئ بنجاح', 'success');
    } catch (error) {
        console.error('Error saving creator settings:', error);
        showToast('حدث خطأ أثناء حفظ الإعدادات', 'error');
    }
}

// Show upload modal
function showUploadModal() {
    if (!APP_STATE.currentUser) {
        showAuthModal();
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'upload-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>رفع فيديو جديد</h3>
                <button class="close-modal" id="closeUploadModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="upload-dropzone" id="uploadDropzone">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>اسحب وأسقط ملف الفيديو هنا أو</p>
                    <button class="browse-btn" id="browseFiles">تصفح الملفات</button>
                    <input type="file" id="videoFile" accept="video/*" style="display: none;">
                    <div class="upload-progress" id="uploadProgress">
                        <div class="progress-bar" id="progressBar"></div>
                        <span class="progress-text" id="progressText">0%</span>
                    </div>
                </div>
                <div class="upload-form" id="uploadForm" style="display: none;">
                    <div class="video-preview">
                        <video id="videoPreview" controls></video>
                        <div class="thumbnail-selector">
                            <h4>اختر صورة مصغرة</h4>
                            <div class="thumbnail-options" id="thumbnailOptions"></div>
                            <button class="custom-thumbnail-btn" id="customThumbnailBtn">
                                <i class="fas fa-image"></i> اختيار صورة مخصصة
                            </button>
                            <input type="file" id="customThumbnail" accept="image/*" style="display: none;">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="videoTitle">عنوان الفيديو</label>
                        <input type="text" id="videoTitle" placeholder="أدخل عنواناً جذاباً">
                    </div>
                    <div class="form-group">
                        <label for="videoDescription">وصف الفيديو</label>
                        <textarea id="videoDescription" placeholder="أضف وصفاً للفيديو (اختياري)"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="videoCategory">تصنيف الفيديو</label>
                        <select id="videoCategory">
                            <option value="comedy">كوميديا</option>
                            <option value="music">موسيقى</option>
                            <option value="education">تعليمي</option>
                            <option value="gaming">ألعاب</option>
                            <option value="sports">رياضة</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-container">
                            <input type="checkbox" id="videoPublic" checked>
                            <span class="checkmark"></span>
                            فيديو عام (يمكن للجميع مشاهدته)
                        </label>
                    </div>
                    <div class="form-actions">
                        <button class="cancel-btn" id="cancelUpload">إلغاء</button>
                        <button class="publish-btn" id="publishVideo">نشر الفيديو</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal
    document.getElementById('closeUploadModal').addEventListener('click', () => {
        modal.remove();
    });
    
    document.getElementById('cancelUpload').addEventListener('click', () => {
        modal.remove();
    });
    
    // Browse files
    document.getElementById('browseFiles').addEventListener('click', () => {
        document.getElementById('videoFile').click();
    });
    
    // File selection
    document.getElementById('videoFile').addEventListener('change', handleFileSelect);
    
    // Custom thumbnail
    document.getElementById('customThumbnailBtn').addEventListener('click', () => {
        document.getElementById('customThumbnail').click();
    });
    
    document.getElementById('customThumbnail').addEventListener('change', handleCustomThumbnail);
    
    // Drag and drop
    const dropzone = document.getElementById('uploadDropzone');
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        
        if (e.dataTransfer.files.length) {
            document.getElementById('videoFile').files = e.dataTransfer.files;
            handleFileSelect({ target: document.getElementById('videoFile') });
        }
    });
}

// Handle video file selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('video/')) {
        showToast('الرجاء اختيار ملف فيديو صالح', 'error');
        return;
    }
    
    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
        showToast('حجم الفيديو يجب أن يكون أقل من 100MB', 'error');
        return;
    }
    
    // Show upload progress
    document.getElementById('uploadProgress').style.display = 'block';
    
    // Create video preview
    const videoPreview = document.getElementById('videoPreview');
    videoPreview.src = URL.createObjectURL(file);
    
    // Generate thumbnails
    generateThumbnails(videoPreview);
    
    // Show upload form
    document.getElementById('uploadForm').style.display = 'block';
    
    // Upload file to storage
    uploadVideoFile(file);
}

// Generate video thumbnails
function generateThumbnails(video) {
    const thumbnailOptions = document.getElementById('thumbnailOptions');
    thumbnailOptions.innerHTML = '';
    
    // Generate 3 thumbnails at different points in the video
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 160;
    canvas.height = 90;
    
    // Capture at 10%, 50%, and 90% of video duration
    video.addEventListener('loadedmetadata', () => {
        const duration = video.duration;
        const capturePoints = [duration * 0.1, duration * 0.5, duration * 0.9];
        
        capturePoints.forEach((time, index) => {
            video.currentTime = time;
            
            video.addEventListener('seeked', function capture() {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const thumbnailUrl = canvas.toDataURL('image/jpeg');
                
                const thumbnailOption = document.createElement('div');
                thumbnailOption.className = 'thumbnail-option';
                thumbnailOption.dataset.thumbnail = thumbnailUrl;
                thumbnailOption.innerHTML = `
                    <img src="${thumbnailUrl}" alt="Thumbnail ${index + 1}">
                    <div class="thumbnail-check"><i class="fas fa-check"></i></div>
                `;
                
                // Select first thumbnail by default
                if (index === 0) {
                    thumbnailOption.classList.add('selected');
                    APP_STATE.currentThumbnail = thumbnailUrl;
                }
                
                thumbnailOption.addEventListener('click', () => {
                    document.querySelectorAll('.thumbnail-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    thumbnailOption.classList.add('selected');
                    APP_STATE.currentThumbnail = thumbnailUrl;
                });
                
                thumbnailOptions.appendChild(thumbnailOption);
                
                // Remove event listener after capture
                video.removeEventListener('seeked', capture);
            });
        });
    });
}

// Handle custom thumbnail selection
function handleCustomThumbnail(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('الرجاء اختيار صورة صالحة', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const thumbnailOptions = document.getElementById('thumbnailOptions');
        thumbnailOptions.innerHTML = '';
        
        const thumbnailOption = document.createElement('div');
        thumbnailOption.className = 'thumbnail-option selected';
        thumbnailOption.dataset.thumbnail = event.target.result;
        thumbnailOption.innerHTML = `
            <img src="${event.target.result}" alt="Custom thumbnail">
            <div class="thumbnail-check"><i class="fas fa-check"></i></div>
        `;
        
        thumbnailOption.addEventListener('click', () => {
            document.querySelectorAll('.thumbnail-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            thumbnailOption.classList.add('selected');
            APP_STATE.currentThumbnail = event.target.result;
        });
        
        thumbnailOptions.appendChild(thumbnailOption);
        APP_STATE.currentThumbnail = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Upload video file to storage
function uploadVideoFile(file) {
    const storageRef = APP_STATE.storage.ref(`videos/${APP_STATE.currentUser.id}/${Date.now()}_${file.name}`);
    const uploadTask = storageRef.put(file);
    
    uploadTask.on('state_changed',
        (snapshot) => {
            // Upload progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            document.getElementById('progressBar').style.width = `${progress}%`;
            document.getElementById('progressText').textContent = `${Math.round(progress)}%`;
        },
        (error) => {
            // Upload error
            console.error('Upload error:', error);
            showToast('حدث خطأ أثناء رفع الفيديو', 'error');
            document.getElementById('uploadProgress').style.display = 'none';
        },
        () => {
            // Upload complete
            uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                APP_STATE.currentVideoUrl = downloadURL;
                document.getElementById('uploadProgress').style.display = 'none';
                showToast('تم رفع الفيديو بنجاح', 'success');
            });
        }
    );
}

// Publish video
async function publishVideo() {
    const title = document.getElementById('videoTitle').value.trim();
    const description = document.getElementById('videoDescription').value.trim();
    const category = document.getElementById('videoCategory').value;
    const isPublic = document.getElementById('videoPublic').checked;
    
    if (!title) {
        showToast('الرجاء إدخال عنوان الفيديو', 'warning');
        return;
    }
    
    if (!APP_STATE.currentVideoUrl) {
           showToast('الرجاء الانتظار حتى يكتمل رفع الفيديو', 'warning');
        return;
    }
    
    try {
        showLoading('جاري نشر الفيديو...');
        
        // Upload thumbnail if custom was selected
        let thumbnailUrl = APP_CONFIG.defaultThumbnail;
        if (APP_STATE.currentThumbnail && !APP_STATE.currentThumbnail.startsWith('data:')) {
            // Thumbnail is a URL (from generated thumbnails)
            thumbnailUrl = APP_STATE.currentThumbnail;
        } else if (APP_STATE.currentThumbnail) {
            // Thumbnail is a data URL (custom uploaded)
            const thumbnailBlob = dataURLtoBlob(APP_STATE.currentThumbnail);
            const thumbnailRef = APP_STATE.storage.ref(`thumbnails/${APP_STATE.currentUser.id}/${Date.now()}_thumbnail.jpg`);
            await thumbnailRef.put(thumbnailBlob);
            thumbnailUrl = await thumbnailRef.getDownloadURL();
        }
        
        // Create video document
        const videoRef = await APP_STATE.db.collection('videos').add({
            title: title,
            description: description || '',
            url: APP_STATE.currentVideoUrl,
            thumbnail: thumbnailUrl,
            authorId: APP_STATE.currentUser.id,
            authorName: APP_STATE.currentUser.name,
            authorAvatar: APP_STATE.currentUser.avatar,
            category: category,
            isPublic: isPublic,
            views: 0,
            likes: 0,
            comments: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Add to uploaded videos
        APP_STATE.uploadedVideos.unshift({
            id: videoRef.id,
            title: title,
            thumbnail: thumbnailUrl,
            views: 0,
            likes: 0,
            comments: 0,
            isPublic: isPublic,
            createdAt: new Date()
        });
        
        // Update UI
        loadCreatorStudio();
        
        hideLoading();
        showToast('تم نشر الفيديو بنجاح', 'success');
        document.querySelector('.upload-modal')?.remove();
    } catch (error) {
        console.error('Error publishing video:', error);
        hideLoading();
        showToast('حدث خطأ أثناء نشر الفيديو', 'error');
    }
}

// Convert data URL to Blob
function dataURLtoBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
}

// Initialize AI services
function initAIServices() {
    if (!APP_STATE.currentUser) return;
    
    // Load AI categories
    loadAICategories();
    
    // Load AI sentiments
    loadAISentiments();
}

// Load AI recommended categories
async function loadAICategories() {
    try {
        const recommendationsDoc = await APP_STATE.db.collection('aiRecommendations')
            .doc(APP_STATE.currentUser.id)
            .get();
        
        if (recommendationsDoc.exists) {
            const data = recommendationsDoc.data();
            APP_STATE.aiCategories = data.categories || [];
            
            // Sort videos by recommendations if videos are loaded
            if (APP_STATE.videos.length > 0) {
                sortVideosByAIRecommendations();
            }
        }
    } catch (error) {
        console.error('Error loading AI categories:', error);
    }
}

// Load AI sentiment analysis
async function loadAISentiments() {
    try {
        const sentimentsDoc = await APP_STATE.db.collection('aiSentiments')
            .doc(APP_STATE.currentUser.id)
            .get();
        
        if (sentimentsDoc.exists) {
            APP_STATE.aiSentiments = sentimentsDoc.data() || {};
        }
    } catch (error) {
        console.error('Error loading AI sentiments:', error);
    }
}

// Initialize service worker
function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
                
                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000); // Check every hour
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    }
}

// Set app theme
function setTheme(isDark) {
    if (isDark) {
        DOM.body.classList.add('dark-theme');
        DOM.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        DOM.body.classList.remove('dark-theme');
        DOM.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

// Set app language
function setLanguage(lang) {
    document.documentElement.lang = lang;
    // Here you would typically load language strings and update the UI
}

// Show loading state
function showLoading(message = 'جاري التحميل...') {
    const loading = document.createElement('div');
    loading.className = 'fullscreen-loading';
    loading.id = 'appLoading';
    loading.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `;
    DOM.body.appendChild(loading);
}

// Hide loading state
function hideLoading() {
    document.getElementById('appLoading')?.remove();
}

// Show error state
function showError(message) {
    DOM.videoFeed.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <button class="retry-btn" onclick="loadVideos()">إعادة المحاولة</button>
        </div>
    `;
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle'} toast-icon"></i>
        <span>${message}</span>
        <button class="toast-close" aria-label="إغلاق">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
}

// Show auth modal
function showAuthModal() {
    DOM.authModal.classList.add('active');
    
    // Initialize auth UI if not already initialized
    if (!window.authUI) {
        window.authUI = new firebaseui.auth.AuthUI(firebase.auth());
        
        const uiConfig = {
            signInSuccessUrl: '/',
            signInOptions: [
                firebase.auth.EmailAuthProvider.PROVIDER_ID,
                firebase.auth.PhoneAuthProvider.PROVIDER_ID,
                {
                    provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                    customParameters: {
                        prompt: 'select_account'
                    }
                },
                {
                    provider: firebase.auth.FacebookAuthProvider.PROVIDER_ID,
                    scopes: ['public_profile', 'email']
                }
            ],
            tosUrl: '/terms',
            privacyPolicyUrl: '/privacy',
            credentialHelper: firebaseui.auth.CredentialHelper.NONE,
            signInFlow: 'popup',
            callbacks: {
                signInSuccessWithAuthResult: function(authResult, redirectUrl) {
                    // Handle successful sign-in
                    DOM.authModal.classList.remove('active');
                    return false;
                },
                uiShown: function() {
                    // The widget is rendered
                }
            }
        };
        
        window.authUI.start('#authUIContainer', uiConfig);
    }
}

// Show import modal
function showImportModal() {
    DOM.importModal.classList.add('active');
}

// Close all modals
function closeAllModals() {
    DOM.authModal.classList.remove('active');
    DOM.importModal.classList.remove('active');
    DOM.playerModal.classList.remove('active');
    DOM.commentsModal.classList.remove('active');
}

// Format large numbers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// Schedule localStorage update (batches frequent updates)
function scheduleLocalStorageUpdate(key, value) {
    APP_STATE.pendingLocalStorageUpdates[key] = value;
    
    if (APP_STATE.localStorageTimer) {
        clearTimeout(APP_STATE.localStorageTimer);
    }
    
    APP_STATE.localStorageTimer = setTimeout(() => {
        for (const [key, value] of Object.entries(APP_STATE.pendingLocalStorageUpdates)) {
            localStorage.setItem(key, JSON.stringify(value));
        }
        APP_STATE.pendingLocalStorageUpdates = {};
    }, 1000);
}

// Save user preferences to Firestore
async function saveUserPreferences() {
    if (!APP_STATE.currentUser) return;
    
    try {
        await APP_STATE.db.collection('users').doc(APP_STATE.currentUser.id).update({
            preferences: APP_STATE.userPreferences,
            likedVideos: APP_STATE.likedVideos,
            savedVideos: APP_STATE.savedVideos,
            watchedVideos: APP_STATE.watchedVideos,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error saving user preferences:', error);
    }
}

// Handle scroll events
function handleScroll() {
    // Implement scroll-based logic here
    // For example, hide/show header based on scroll direction
}

// Handle resize events
function handleResize() {
    // Implement responsive layout adjustments here
}

// Handle search
function handleSearch() {
    const query = DOM.searchInput.value.trim();
    DOM.clearSearch.style.display = query ? 'block' : 'none';
    
    if (query.length > 2) {
        performSearch(query);
    } else {
        DOM.searchResults.innerHTML = '';
    }
}

// Perform search
async function performSearch(query) {
    try {
        // Search videos
        const videosQuery = APP_STATE.db.collection('videos')
            .where('title', '>=', query)
            .where('title', '<=', query + '\uf8ff')
            .limit(5);
        
        const videosSnapshot = await videosQuery.get();
        APP_STATE.searchResults.videos = [];
        videosSnapshot.forEach(doc => {
            const video = doc.data();
            APP_STATE.searchResults.videos.push({
                id: doc.id,
                title: video.title,
                thumbnail: video.thumbnail,
                author: video.authorName
            });
        });
        
        // Search users
        const usersQuery = APP_STATE.db.collection('users')
            .where('name', '>=', query)
            .where('name', '<=', query + '\uf8ff')
            .limit(5);
        
        const usersSnapshot = await usersQuery.get();
        APP_STATE.searchResults.users = [];
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            APP_STATE.searchResults.users.push({
                id: doc.id,
                name: user.name,
                avatar: user.avatar,
                isCreator: user.isCreator || false
            });
        });
        
        // Search sounds (music)
        const soundsQuery = APP_STATE.db.collection('sounds')
            .where('name', '>=', query)
            .where('name', '<=', query + '\uf8ff')
            .limit(5);
        
        const soundsSnapshot = await soundsQuery.get();
        APP_STATE.searchResults.sounds = [];
        soundsSnapshot.forEach(doc => {
            const sound = doc.data();
            APP_STATE.searchResults.sounds.push({
                id: doc.id,
                name: sound.name,
                author: sound.author,
                cover: sound.cover
            });
        });
        
        // Render search results
        renderSearchResults();
    } catch (error) {
        console.error('Error performing search:', error);
        showToast('حدث خطأ أثناء البحث', 'error');
    }
}

// Render search results
function renderSearchResults() {
    DOM.searchResults.innerHTML = '';
    
    // Videos results
    const videosSection = document.createElement('div');
    videosSection.className = 'result-section active';
    videosSection.id = 'videosResults';
    
    if (APP_STATE.searchResults.videos.length > 0) {
        videosSection.innerHTML = `
            <h4 class="result-title">الفيديوهات</h4>
            <div class="result-grid">
                ${APP_STATE.searchResults.videos.map(video => `
                    <div class="result-item video-result" data-video-id="${video.id}">
                        <img src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                        <div class="result-info">
                            <h5>${video.title}</h5>
                            <p>${video.author}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        videosSection.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-film"></i>
                <p>لا توجد فيديوهات مطابقة</p>
            </div>
        `;
    }
    
    // Users results
    const usersSection = document.createElement('div');
    usersSection.className = 'result-section';
    usersSection.id = 'usersResults';
    
    if (APP_STATE.searchResults.users.length > 0) {
        usersSection.innerHTML = `
            <h4 class="result-title">المستخدمون</h4>
            <div class="result-grid">
                ${APP_STATE.searchResults.users.map(user => `
                    <div class="result-item user-result" data-user-id="${user.id}">
                        <img src="${user.avatar}" alt="${user.name}" class="user-avatar" loading="lazy">
                        <div class="result-info">
                            <h5>${user.name}</h5>
                            <p>${user.isCreator ? 'منشئ محتوى' : 'مستخدم'}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        usersSection.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-user"></i>
                <p>لا توجد مستخدمون مطابقون</p>
            </div>
        `;
    }
    
    // Sounds results
    const soundsSection = document.createElement('div');
    soundsSection.className = 'result-section';
    soundsSection.id = 'soundsResults';
    
    if (APP_STATE.searchResults.sounds.length > 0) {
        soundsSection.innerHTML = `
            <h4 class="result-title">الموسيقى</h4>
            <div class="result-grid">
                ${APP_STATE.searchResults.sounds.map(sound => `
                    <div class="result-item sound-result" data-sound-id="${sound.id}">
                        <img src="${sound.cover}" alt="${sound.name}" class="sound-cover" loading="lazy">
                        <div class="result-info">
                            <h5>${sound.name}</h5>
                            <p>${sound.author}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        soundsSection.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-music"></i>
                <p>لا توجد موسيقى مطابقة</p>
            </div>
        `;
    }
    
    DOM.searchResults.appendChild(videosSection);
    DOM.searchResults.appendChild(usersSection);
    DOM.searchResults.appendChild(soundsSection);
    
    // Add click events
    document.querySelectorAll('.video-result').forEach(item => {
        item.addEventListener('click', () => {
            openVideoById(item.dataset.videoId);
            DOM.searchView.style.display = 'none';
            DOM.videoFeed.style.display = 'block';
        });
    });
    
    document.querySelectorAll('.user-result').forEach(item => {
        item.addEventListener('click', () => {
            showCreatorProfile(item.dataset.userId);
            DOM.searchView.style.display = 'none';
        });
    });
    
    document.querySelectorAll('.sound-result').forEach(item => {
        item.addEventListener('click', () => {
            // TODO: Implement sound playback
            showToast('جاري تشغيل الصوت: ' + item.querySelector('h5').textContent, 'info');
        });
    });
    
    // Show search view
    DOM.searchView.style.display = 'block';
    DOM.videoFeed.style.display = 'none';
}

// Load notifications
async function loadNotifications() {
    if (!APP_STATE.currentUser) return;
    
    try {
        const notificationsSnapshot = await APP_STATE.db.collection('users')
            .doc(APP_STATE.currentUser.id)
            .collection('notifications')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();
        
        APP_STATE.notifications = [];
        notificationsSnapshot.forEach(doc => {
            APP_STATE.notifications.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Mark all as read
        APP_STATE.unseenNotifications = 0;
        updateNotificationBadge();
        
        // Render notifications
        renderNotifications();
    } catch (error) {
        console.error('Error loading notifications:', error);
        showToast('حدث خطأ أثناء تحميل الإشعارات', 'error');
    }
}

// Render notifications
function renderNotifications() {
    DOM.notificationsView.innerHTML = `
        <div class="notifications-header">
            <h2>الإشعارات</h2>
            <button class="text-btn" id="clearNotifications">مسح الكل</button>
        </div>
        <div class="notifications-list" id="notificationsList">
            ${APP_STATE.notifications.length > 0 ? 
                APP_STATE.notifications.map(notification => `
                    <div class="notification-item ${notification.read ? '' : 'unread'}" data-notification-id="${notification.id}">
                        <img src="${notification.senderAvatar || 'https://i.pravatar.cc/150?img=3'}" class="notification-avatar" alt="Sender">
                        <div class="notification-content">
                            <p class="notification-message">${notification.message}</p>
                            <span class="notification-time">${formatTime(notification.timestamp?.toDate())}</span>
                        </div>
                        ${notification.videoId ? `<img src="${notification.videoThumbnail || APP_CONFIG.defaultThumbnail}" class="notification-thumbnail" alt="Video">` : ''}
                    </div>
                `).join('') : `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>لا توجد إشعارات</p>
                </div>
            `}
        </div>
    `;
    
    // Add clear notifications button event
    document.getElementById('clearNotifications')?.addEventListener('click', clearAllNotifications);
    
    // Add notification click events
    document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', () => {
            const notificationId = item.dataset.notificationId;
            const notification = APP_STATE.notifications.find(n => n.id === notificationId);
            
            // Mark as read
            markNotificationAsRead(notificationId);
            
            // Handle notification action
            if (notification.videoId) {
                openVideoById(notification.videoId);
            }
        });
    });
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
    try {
        await APP_STATE.db.collection('users')
            .doc(APP_STATE.currentUser.id)
            .collection('notifications')
            .doc(notificationId)
            .update({
                read: true
            });
        
        // Update in state
        const notification = APP_STATE.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
        }
        
        // Update UI
        document.querySelector(`.notification-item[data-notification-id="${notificationId}"]`)?.classList.remove('unread');
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Clear all notifications
async function clearAllNotifications() {
    try {
        const batch = APP_STATE.db.batch();
        const notificationsRef = APP_STATE.db.collection('users')
            .doc(APP_STATE.currentUser.id)
            .collection('notifications');
        
        const snapshot = await notificationsRef.get();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        // Update state
        APP_STATE.notifications = [];
        APP_STATE.unseenNotifications = 0;
        
        // Update UI
        renderNotifications();
        updateNotificationBadge();
        
        showToast('تم مسح جميع الإشعارات', 'success');
    } catch (error) {
        console.error('Error clearing notifications:', error);
        showToast('حدث خطأ أثناء مسح الإشعارات', 'error');
    }
}

// Format time (e.g., "منذ ساعة")
function formatTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `منذ ${days} يوم`;
    } else if (hours > 0) {
        return `منذ ${hours} ساعة`;
    } else if (minutes > 0) {
        return `منذ ${minutes} دقيقة`;
    }
    return 'الآن';
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);