// assets/js/video.js

class VideoSystem {
    constructor() {
        this.currentVideo = null;
        this.videoPlayer = null;
        this.comments = [];
        this.likesCount = 0;
        this.isLiked = false;
        this.isFollowing = false;
        this.videoList = [];
        this.currentIndex = 0;
        this.init();
    }

    async init() {
        this.setupElements();
        this.setupEventListeners();
        await this.loadVideos();
        this.setupVideoPlayer();
    }

    setupElements() {
        this.videoPlayer = document.getElementById('videoPlayer');
        this.videoContainer = document.querySelector('.video-container');
        this.likeBtn = document.getElementById('likeBtn');
        this.commentBtn = document.getElementById('commentBtn');
        this.shareBtn = document.getElementById('shareBtn');
        this.followBtn = document.getElementById('followBtn');
        this.commentInput = document.getElementById('commentInput');
        this.commentList = document.getElementById('commentList');
        this.videoTitle = document.getElementById('videoTitle');
        this.videoAuthor = document.getElementById('videoAuthor');
        this.videoStats = document.getElementById('videoStats');
        this.progressBar = document.getElementById('progressBar');
    }

    setupEventListeners() {
        this.likeBtn.addEventListener('click', () => this.toggleLike());
        this.commentBtn.addEventListener('click', () => this.toggleComments());
        this.shareBtn.addEventListener('click', () => this.shareVideo());
        this.followBtn.addEventListener('click', () => this.toggleFollow());
        this.commentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.postComment();
        });
        
        this.videoPlayer.addEventListener('timeupdate', () => this.updateProgressBar());
        this.videoPlayer.addEventListener('ended', () => this.playNextVideo());
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this.togglePlayPause();
            if (e.code === 'ArrowRight') this.skipForward();
            if (e.code === 'ArrowLeft') this.skipBackward();
        });
        
        // Swipe events for mobile
        this.videoContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), {passive: true});
        this.videoContainer.addEventListener('touchend', this.handleTouchEnd.bind(this), {passive: true});
    }

    handleTouchStart(e) {
        this.touchStartX = e.changedTouches[0].screenX;
        this.touchStartY = e.changedTouches[0].screenY;
    }

    handleTouchEnd(e) {
        const diffX = e.changedTouches[0].screenX - this.touchStartX;
        const diffY = e.changedTouches[0].screenY - this.touchStartY;
        
        // Horizontal swipe (min 50px difference and less vertical movement)
        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) {
                this.playPreviousVideo();
            } else {
                this.playNextVideo();
            }
        }
    }

    async loadVideos() {
        try {
            const snapshot = await firebase.firestore()
                .collection('videos')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();
            
            this.videoList = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp.toDate()
                };
            });
            
            if (this.videoList.length > 0) {
                this.loadVideo(this.videoList[0]);
            }
        } catch (error) {
            console.error('Error loading videos:', error);
            this.showError('حدث خطأ أثناء تحميل الفيديوهات');
        }
    }

    loadVideo(video) {
        this.currentVideo = video;
        this.videoPlayer.src = video.videoUrl;
        this.videoTitle.textContent = video.title;
        this.videoAuthor.textContent = `@${video.author.username}`;
        this.videoStats.textContent = this.formatVideoStats(video);
        
        this.updateLikeStatus();
        this.updateFollowStatus();
        this.loadComments();
        
        // Preload next video
        if (this.currentIndex < this.videoList.length - 1) {
            const nextVideo = this.videoList[this.currentIndex + 1];
            const preloadLink = document.createElement('link');
            preloadLink.rel = 'preload';
            preloadLink.as = 'video';
            preloadLink.href = nextVideo.videoUrl;
            document.head.appendChild(preloadLink);
        }
    }

    formatVideoStats(video) {
        const views = this.formatNumber(video.views);
        const likes = this.formatNumber(video.likes);
        const date = this.formatDate(video.timestamp);
        return `${views} مشاهدة · ${likes} إعجاب · ${date}`;
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatDate(date) {
        const now = new Date();
        const diff = now - date;
        const day = 24 * 60 * 60 * 1000;
        
        if (diff < day) return 'اليوم';
        if (diff < 2 * day) return 'أمس';
        if (diff < 7 * day) return 'هذا الأسبوع';
        
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    togglePlayPause() {
        if (this.videoPlayer.paused) {
            this.videoPlayer.play();
        } else {
            this.videoPlayer.pause();
        }
    }

    skipForward() {
        this.videoPlayer.currentTime += 5;
    }

    skipBackward() {
        this.videoPlayer.currentTime -= 5;
    }

    updateProgressBar() {
        const percent = (this.videoPlayer.currentTime / this.videoPlayer.duration) * 100;
        this.progressBar.style.width = `${percent}%`;
    }

    playNextVideo() {
        if (this.currentIndex < this.videoList.length - 1) {
            this.currentIndex++;
            this.loadVideo(this.videoList[this.currentIndex]);
            this.videoPlayer.play();
        }
    }

    playPreviousVideo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.loadVideo(this.videoList[this.currentIndex]);
            this.videoPlayer.play();
        }
    }

    async toggleLike() {
        if (!firebase.auth().currentUser) {
            alert('يجب تسجيل الدخول للإعجاب بالفيديوهات');
            return;
        }

        try {
            const videoRef = firebase.firestore().collection('videos').doc(this.currentVideo.id);
            
            if (this.isLiked) {
                await videoRef.update({
                    likes: firebase.firestore.FieldValue.increment(-1),
                    likedBy: firebase.firestore.FieldValue.arrayRemove(firebase.auth().currentUser.uid)
                });
                this.isLiked = false;
                this.likesCount--;
            } else {
                await videoRef.update({
                    likes: firebase.firestore.FieldValue.increment(1),
                    likedBy: firebase.firestore.FieldValue.arrayUnion(firebase.auth().currentUser.uid)
                });
                this.isLiked = true;
                this.likesCount++;
                
                // Send notification to video owner
                if (firebase.auth().currentUser.uid !== this.currentVideo.author.uid) {
                    await sendNotification(this.currentVideo.author.uid, {
                        title: 'إعجاب جديد',
                        body: `أعجب ${firebase.auth().currentUser.displayName} بفيديوك "${this.currentVideo.title}"`,
                        type: 'like',
                        data: {
                            videoId: this.currentVideo.id,
                            userId: firebase.auth().currentUser.uid
                        }
                    });
                }
            }
            
            this.updateLikeStatus();
        } catch (error) {
            console.error('Error toggling like:', error);
            this.showError('حدث خطأ أثناء تحديث الإعجاب');
        }
    }

    updateLikeStatus() {
        const userId = firebase.auth().currentUser?.uid;
        this.isLiked = userId && this.currentVideo.likedBy?.includes(userId);
        this.likesCount = this.currentVideo.likes || 0;
        
        this.likeBtn.innerHTML = `
            <i class="fas fa-heart ${this.isLiked ? 'active' : ''}"></i>
            <span>${this.formatNumber(this.likesCount)}</span>
        `;
    }

    async toggleFollow() {
        if (!firebase.auth().currentUser) {
            alert('يجب تسجيل الدخول لمتابعة المستخدمين');
            return;
        }

        try {
            const userRef = firebase.firestore().collection('users').doc(this.currentVideo.author.uid);
            
            if (this.isFollowing) {
                await userRef.update({
                    followers: firebase.firestore.FieldValue.arrayRemove(firebase.auth().currentUser.uid)
                });
                this.isFollowing = false;
            } else {
                await userRef.update({
                    followers: firebase.firestore.FieldValue.arrayUnion(firebase.auth().currentUser.uid)
                });
                this.isFollowing = true;
                
                // Send notification to user
                await sendNotification(this.currentVideo.author.uid, {
                    title: 'متابعة جديدة',
                    body: `تابعك ${firebase.auth().currentUser.displayName}`,
                    type: 'follow',
                    data: {
                        userId: firebase.auth().currentUser.uid
                    }
                });
            }
            
            this.updateFollowStatus();
        } catch (error) {
            console.error('Error toggling follow:', error);
            this.showError('حدث خطأ أثناء تحديث المتابعة');
        }
    }

    updateFollowStatus() {
        const userId = firebase.auth().currentUser?.uid;
        this.isFollowing = userId && this.currentVideo.author.followers?.includes(userId);
        
        this.followBtn.textContent = this.isFollowing ? 'متابَع' : 'متابعة';
        this.followBtn.className = this.isFollowing ? 'following' : '';
    }

    toggleComments() {
        const commentsSection = document.getElementById('commentsSection');
        commentsSection.style.display = commentsSection.style.display === 'block' ? 'none' : 'block';
        
        if (commentsSection.style.display === 'block') {
            this.commentInput.focus();
        }
    }

    async loadComments() {
        try {
            const snapshot = await firebase.firestore()
                .collection('videos')
                .doc(this.currentVideo.id)
                .collection('comments')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();
            
            this.comments = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp.toDate()
                };
            });
            
            this.renderComments();
        } catch (error) {
            console.error('Error loading comments:', error);
            this.showError('حدث خطأ أثناء تحميل التعليقات');
        }
    }

    renderComments() {
        this.commentList.innerHTML = '';
        
        if (this.comments.length === 0) {
            this.commentList.innerHTML = '<p class="no-comments">لا توجد تعليقات بعد</p>';
            return;
        }
        
        this.comments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.innerHTML = `
                <img src="${comment.author.photoURL || '/assets/default-avatar.jpg'}" alt="${comment.author.username}" class="comment-avatar">
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">@${comment.author.username}</span>
                        <span class="comment-time">${this.formatTime(comment.timestamp)}</span>
                    </div>
                    <p class="comment-text">${comment.text}</p>
                </div>
            `;
            this.commentList.appendChild(commentElement);
        });
    }

    async postComment() {
        const commentText = this.commentInput.value.trim();
        if (!commentText) return;
        
        if (!firebase.auth().currentUser) {
            alert('يجب تسجيل الدخول لإضافة تعليق');
            return;
        }

        try {
            const user = firebase.auth().currentUser;
            const commentData = {
                text: commentText,
                author: {
                    uid: user.uid,
                    username: user.displayName,
                    photoURL: user.photoURL
                },
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const commentRef = await firebase.firestore()
                .collection('videos')
                .doc(this.currentVideo.id)
                .collection('comments')
                .add(commentData);
            
            // Add comment to local list
            this.comments.unshift({
                id: commentRef.id,
                ...commentData,
                timestamp: new Date()
            });
            
            this.renderComments();
            this.commentInput.value = '';
            
            // Send notification to video owner
            if (user.uid !== this.currentVideo.author.uid) {
                await sendNotification(this.currentVideo.author.uid, {
                    title: 'تعليق جديد',
                    body: `علق ${user.displayName} على فيديوك "${this.currentVideo.title}"`,
                    type: 'comment',
                    data: {
                        videoId: this.currentVideo.id,
                        userId: user.uid
                    }
                });
            }
        } catch (error) {
            console.error('Error posting comment:', error);
            this.showError('حدث خطأ أثناء نشر التعليق');
        }
    }

    shareVideo() {
        if (navigator.share) {
            navigator.share({
                title: this.currentVideo.title,
                text: `شاهد هذا الفيديو على قصير: ${this.currentVideo.title}`,
                url: `${window.location.origin}/video.html?id=${this.currentVideo.id}`
            }).catch(error => {
                console.log('Error sharing:', error);
                this.copyVideoLink();
            });
        } else {
            this.copyVideoLink();
        }
    }

    copyVideoLink() {
        const link = `${window.location.origin}/video.html?id=${this.currentVideo.id}`;
        navigator.clipboard.writeText(link).then(() => {
            this.showToast('تم نسخ رابط الفيديو');
        }).catch(error => {
            console.error('Error copying link:', error);
            this.showError('حدث خطأ أثناء مشاركة الفيديو');
        });
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showError(message) {
        const errorToast = document.createElement('div');
        errorToast.className = 'toast-message error';
        errorToast.textContent = message;
        document.body.appendChild(errorToast);
        
        setTimeout(() => {
            errorToast.remove();
        }, 3000);
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        const minute = 60 * 1000;
        const hour = minute * 60;
        const day = hour * 24;
        
        if (diff < minute) return 'الآن';
        if (diff < hour) return `${Math.floor(diff / minute)} دقيقة`;
        if (diff < day) return `${Math.floor(diff / hour)} ساعة`;
        return `${Math.floor(diff / day)} يوم`;
    }
}

// Initialize Video System
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('videoPlayer')) {
        const videoSystem = new VideoSystem();
        window.VideoSystem = videoSystem;
    }
});

// Helper function to format duration (e.g. 125 -> 2:05)
export function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}