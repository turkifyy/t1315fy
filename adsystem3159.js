<script>
    // ======== Ad System ========
    document.addEventListener('DOMContentLoaded', () => {
        try {
            const adManager = new AdManager();
        } catch (error) {
            console.error('Error initializing AdManager:', error);
        }
    });

    class AdManager {
        constructor() {
            this.config = {
                adDisplayInterval: this.getRandomInterval(120000, 300000), // Random interval between 2 to 5 minutes
                adDuration: this.getRandomInterval(35000, 75000), // Random duration between 35 seconds and 75 seconds
                maxAdFailures: 3, // maximum number of ad failures before switching provider
                providers: {
                    adsterra: 'https://identicaldrench.com/di4cqzc1?key=a4afe59108ebe84706fb603d779b93c0',
                    monetag: 'https://identicaldrench.com/di4cqzc1?key=a4afe59108ebe84706fb603d779b93c0'
                }
            };
  
            this.elements = {
                timer: document.getElementById('timer'),
                container: document.getElementById('adContainer'),
                frame: document.getElementById('adFrame'),
                loading: document.getElementById('loadingOverlay')
            };

            this.state = {
                currentProvider: 'adsterra',
                adFailures: { adsterra: 0, monetag: 0 },
                isAdDisplayed: false,
                loadTimes: [],
                displayTimes: []
            };

            this.initializeSystem();
        }

        getRandomInterval(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        async initializeSystem() {
            try {
                await this.setupMonitoring();
                this.startAdCycle();
            } catch (error) {
                console.error('Error initializing system:', error);
            }
        }

        startAdCycle() {
            setInterval(() => {
                try {
                    this.displayAd();
                } catch (error) {
                    console.error('Error in ad cycle:', error);
                }
            }, this.config.adDisplayInterval);
        }

        async displayAd() {
            if (this.state.isAdDisplayed) return;

            this.state.isAdDisplayed = true;
            this.elements.container.style.display = 'block';
            this.startTimer(this.config.adDuration / 1000);

            try {
                await this.loadAd();
                await this.validateAdDisplay();
                this.scrollFrameToBottom();
                this.simulateUserInteraction();
            } catch (error) {
                console.error('Error displaying ad:', error);
                await this.handleAdFailure();
            }

            setTimeout(() => {
                try {
                    this.hideAd();
                } catch (error) {
                    console.error('Error hiding ad:', error);
                }
            }, this.config.adDuration);
        }

        async loadAd() {
            const url = this.config.providers[this.state.currentProvider];
            this.elements.frame.src = url;

            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const timeout = setTimeout(() => {
                    this.elements.loading.style.display = 'none';
                    reject('Ad load timeout');
                }, 10000);
                this.elements.frame.onload = () => {
                    clearTimeout(timeout);
                    this.elements.loading.style.display = 'none';
                    const loadTime = Date.now() - startTime;
                    this.state.loadTimes.push(loadTime);
                    resolve();
                };
                this.elements.frame.onerror = (error) => {
                    clearTimeout(timeout);
                    this.elements.loading.style.display = 'none';
                    reject(error);
                };
            });
        }

        async validateAdDisplay() {
            return new Promise((resolve) => {
                try {
                    const frameContent = this.elements.frame.contentWindow;
                    if (frameContent) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } catch {
                    resolve(false);
                }
            });
        }

        async handleAdFailure() {
            try {
                this.state.adFailures[this.state.currentProvider]++;

                if (this.state.adFailures[this.state.currentProvider] >= this.config.maxAdFailures) {
                    this.switchProvider();
                }

                await new Promise(resolve => setTimeout(resolve, 5000)); // delay 5 seconds before retrying
                await this.retryAdLoad();
            } catch (error) {
                console.error('Error handling ad failure:', error);
            }
        }

        switchProvider() {
            try {
                this.elements.frame.src = '';
                this.state.currentProvider = this.state.currentProvider === 'adsterra' ? 'monetag' : 'adsterra';
                this.state.adFailures[this.state.currentProvider] = 0;
                console.log(`Switched to ${this.state.currentProvider} provider`);
            } catch (error) {
                console.error('Error switching provider:', error);
            }
        }

        startTimer(duration) {
            try {
                this.elements.timer.style.display = 'block';
                let remaining = duration;

                const updateTimer = () => {
                    this.elements.timer.textContent = remaining;
                    if (remaining > 0) {
                        remaining--;
                        setTimeout(updateTimer, 1000);
                    }
                };

                updateTimer();
            } catch (error) {
                console.error('Error starting timer:', error);
            }
        }

        hideAd() {
            try {
                this.elements.container.style.display = 'none';
                this.elements.timer.style.display = 'none';
                this.elements.frame.src = '';
                this.elements.loading.style.display = 'block';
                this.state.isAdDisplayed = false;
            } catch (error) {
                console.error('Error hiding ad:', error);
            }
        }

        async setupMonitoring() {
            try {
                setInterval(() => {
                    try {
                        this.monitor();
                    } catch (error) {
                        console.error('Error in monitoring:', error);
                    }
                }, 60000);
            } catch (error) {
                console.error('Error setting up monitoring:', error);
            }
        }

        async monitor() {
            const maxRetries = 3;
            let retries = 0;

            const monitorWithRetry = async () => {
                try {
                    const isFrameResponsive = await this.validateAdDisplay();
                    if (!isFrameResponsive && this.state.isAdDisplayed) {
                        console.warn('Ad frame not responsive, initiating recovery...');
                        await this.handleAdFailure();
                    }
                } catch (error) {
                    console.error('Monitoring error:', error);
                    if (retries < maxRetries) {
                        retries++;
                        console.log(`Retrying monitoring (${retries}/${maxRetries})...`);
                        setTimeout(monitorWithRetry, 5000);
                    } else {
                        console.error('Max retries reached. Stopping monitoring.');
                    }
                }
            };

            monitorWithRetry();
        }

        async retryAdLoad() {
            try {
                await this.loadAd();
            } catch (error) {
                console.error('Retry failed:', error);
            }
        }

        scrollFrameToBottom() {
            try {
                // Scroll to the bottom of the iframe content
                this.elements.frame.contentWindow.scrollTo(0, this.elements.frame.contentWindow.document.body.scrollHeight);
            } catch (error) {
                console.error('Error scrolling frame to bottom:', error);
            }
        }

        simulateUserInteraction() {
            try {
                // Simulate random mouse movements before clicks
                const randomInteractionInterval = this.getRandomInterval(5000, 20000); // Random interval between 5 to 20 seconds
                const frameWindow = this.elements.frame.contentWindow;

                const simulateMouseMovement = () => {
                    const x = Math.random() * frameWindow.innerWidth;
                    const y = Math.random() * frameWindow.innerHeight;
                    frameWindow.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }));
                };

                const simulateClick = () => {
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        clientX: frameWindow.innerWidth / 2,
                        clientY: frameWindow.innerHeight / 2
                    });
                    frameWindow.document.dispatchEvent(clickEvent);
                };

                setTimeout(() => {
                    simulateMouseMovement();
                    setTimeout(simulateClick, this.getRandomInterval(1000, 3000)); // Random delay before click
                }, randomInteractionInterval);
            } catch (error) {
                console.error('Error simulating user interaction:', error);
            }
        }
    }
</script>
