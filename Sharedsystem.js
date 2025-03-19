<script>
      const ShareSystem = {
        config: {
            shareText: 'ادعوك لمشاهدة هذه الحلقة من مسلسل ماتنسانيش الحلقة واحد',
            shareUrl: 'https://demo.playtubescript.com/',
            minShareTime: 1500,
            modalDelay: 5000,
            successModalDelay: 10000,
            successModalDuration: 12000
        },

        state: {
            shareStartTime: 0,
            shareCompleted: false,
            progressInterval: null
        },

        init() {
            this.checkLocalStorage();
            this.bindEvents();
            this.setupModalDelay();
        },

        checkLocalStorage() {
            this.state.shareCompleted = localStorage.getItem('shareCompleted') === 'true';
        },

        bindEvents() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.closeShareModal();
            });

            window.addEventListener('offline', () => {
                document.getElementById('whatsappShareBtn').disabled = true;
            });

            window.addEventListener('online', () => {
                document.getElementById('whatsappShareBtn').disabled = false;
            });
        },

        setupModalDelay() {
            if (!this.state.shareCompleted) {
                setTimeout(() => this.showShareModal(), this.config.modalDelay);
            }
        },

        showShareModal() {
            const modal = document.getElementById('shareModal');
            modal.style.display = 'flex';
            requestAnimationFrame(() => modal.classList.add('show'));
        },

        closeShareModal() {
            const modal = document.getElementById('shareModal');
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
            clearInterval(this.state.progressInterval);
        },

        async shareToWhatsApp() {
            const button = document.getElementById('whatsappShareBtn');
            this.toggleLoadingState(button, true);
            this.state.shareStartTime = Date.now();

            try {
                const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
                    this.config.shareText + ' ' + this.config.shareUrl
                )}`;
                window.open(shareUrl, '_blank');

                this.startProgressBar();
                this.handleShareCompletion(button);
            } catch (error) {
                this.toggleLoadingState(button, false);
                alert('حدث خطأ أثناء المشاركة على واتساب. يرجى المحاولة مرة أخرى.');
            }
        },

        toggleLoadingState(button, isLoading) {
            const icon = button.querySelector('.fa-whatsapp');
            const spinner = button.querySelector('.spinner');
            icon.style.display = isLoading ? 'none' : 'block';
            spinner.style.display = isLoading ? 'block' : 'none';
        },

        startProgressBar() {
            const container = document.querySelector('.progress-container');
            const bar = document.querySelector('.progress-bar');
            container.style.display = 'block';
            
            this.state.progressInterval = setInterval(() => {
                const progress = Math.min(
                    ((Date.now() - this.state.shareStartTime) / this.config.minShareTime) * 100,
                    100
                );
                bar.style.width = `${progress}%`;
            }, 100);
        },

        handleShareCompletion(button) {
            const checkVisibility = () => {
                if (document.visibilityState === 'visible') {
                    setTimeout(() => {
                        this.toggleLoadingState(button, false);
                        clearInterval(this.state.progressInterval);
                        this.completeShare();
                    }, 2000);
                    document.removeEventListener('visibilitychange', checkVisibility);
                }
            };
            
            document.addEventListener('visibilitychange', checkVisibility);
        },

        completeShare() {
            this.state.shareCompleted = true;
            localStorage.setItem('shareCompleted', 'true');
            
            const successMessage = document.querySelector('.success-message');
            successMessage.style.display = 'flex';
            
            setTimeout(() => {
                this.closeShareModal();
                setTimeout(() => this.showSuccessModal(), this.config.successModalDelay);
            }, 1500);
        },

        showSuccessModal() {
            const modal = document.getElementById('successModal');
            modal.style.display = 'flex';
            requestAnimationFrame(() => modal.classList.add('show'));

            setTimeout(() => {
                modal.classList.remove('show');
                setTimeout(() => modal.style.display = 'none', 300);
            }, this.config.successModalDuration);
        }
    };
 document.addEventListener('DOMContentLoaded', () => ShareSystem.init());
                  
   </script>
