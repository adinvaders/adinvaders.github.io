// --- CONFIG & GAME STATE ---
const config = {
    player: {
        maxHealth: 100,
        shieldDuration: 2000, // 2 seconds
        shieldCooldown: 5000, // 5 seconds
        iFrameDuration: 1000 // Invincibility time after taking damage
    },
    game: {
        waveStartDelay: 3000,
        bossWaveInterval: 5,
        chaserSpeed: 0.03,
    }
};

let state = {
    gameRunning: false,
    score: 0,
    wave: 0,
    health: config.player.maxHealth,
    shield: {
        active: false,
        onCooldown: false,
        cooldownTimer: null,
    },
    playerInvincible: false,
    activeAds: new Set(),
    mouseX: 0,
    mouseY: 0,
    bossActive: false,
};

// --- DOM ELEMENTS ---
const DOMElements = {
    gameContainer: document.getElementById('game-container'),
    gameScreen: document.getElementById('game-screen'),
    healthBar: document.getElementById('health-bar'),
    scoreDisplay: document.getElementById('score-display'),
    waveDisplay: document.getElementById('wave-display'),
    startScreen: document.getElementById('start-screen'),
    gameOverScreen: document.getElementById('game-over-screen'),
    finalScore: document.getElementById('final-score'),
    finalWave: document.getElementById('final-wave'),
    playerShield: document.getElementById('player-shield'),
    startButton: document.getElementById('start-button'),
    restartButton: document.getElementById('restart-button'),
    bossAlertScreen: document.getElementById('boss-alert-screen'),
    bossName: document.getElementById('boss-name'),
    bossDescription: document.getElementById('boss-description'),
};


// =================================================================================
// --- PLAYER MODULE ---
// =================================================================================
const Player = {
    init() {
        DOMElements.gameContainer.addEventListener('mousemove', e => {
            const rect = DOMElements.gameContainer.getBoundingClientRect();
            state.mouseX = e.clientX - rect.left;
            state.mouseY = e.clientY - rect.top;
            DOMElements.playerShield.style.left = `${state.mouseX}px`;
            DOMElements.playerShield.style.top = `${state.mouseY}px`;
        });

        DOMElements.gameContainer.addEventListener('contextmenu', e => {
            e.preventDefault();
            if (state.gameRunning) this.activateShield();
        });
    },

    takeDamage(amount) {
        if (state.playerInvincible || (state.shield.active && !state.bossActive)) return; // Shield protects from normal ads

        state.health = Math.max(0, state.health - amount);
        UI.updateHealthBar();
        UI.flashDamage();

        if (state.health <= 0) {
            Game.end();
        } else {
            state.playerInvincible = true;
            setTimeout(() => { state.playerInvincible = false; }, config.player.iFrameDuration);
        }
    },

    activateShield() {
        if (state.shield.active || state.shield.onCooldown) return;

        state.shield.active = true;
        state.shield.onCooldown = true;
        DOMElements.playerShield.classList.add('active');

        setTimeout(() => {
            state.shield.active = false;
            DOMElements.playerShield.classList.remove('active');
        }, config.player.shieldDuration);

        state.shield.cooldownTimer = setTimeout(() => {
            state.shield.onCooldown = false;
        }, config.player.shieldCooldown);
    },

    addScore(points) {
        state.score += points;
        UI.updateScore();
    }
};

// =================================================================================
// --- UI MODULE ---
// =================================================================================
const UI = {
    updateHealthBar() {
        const percentage = (state.health / config.player.maxHealth) * 100;
        DOMElements.healthBar.style.width = `${percentage}%`;
        DOMElements.healthBar.style.backgroundColor = percentage > 50 ? 'var(--primary-color)' : percentage > 25 ? '#ffd60a' : 'var(--danger-color)';
    },

    updateScore() {
        DOMElements.scoreDisplay.textContent = state.score;
    },

    updateWave() {
        DOMElements.waveDisplay.textContent = state.wave;
    },
    
    flashDamage() {
        DOMElements.gameContainer.classList.add('damage-flash');
        setTimeout(() => DOMElements.gameContainer.classList.remove('damage-flash'), 200);
    },
    
    showBossAlert(boss, callback) {
        DOMElements.bossName.textContent = boss.name;
        DOMElements.bossDescription.textContent = boss.description;
        DOMElements.bossAlertScreen.style.display = 'flex';
        
        setTimeout(() => {
            DOMElements.bossAlertScreen.style.display = 'none';
            callback();
        }, 4000);
    }
};

// =================================================================================
// --- AD FACTORY & MANAGER ---
// =================================================================================
const AdManager = {
    adTypes: {
        // Simple popup
        popup: {
            create: () => {
                const ad = AdManager.createGenericAd('popup', 'WINNER!', 'You won a FREE iPhone 18!');
                ad.onclick = () => Player.takeDamage(5);
                return ad;
            },
            points: 10
        },
        // Banner that scrolls
        banner: {
            create: () => {
                const ad = AdManager.createGenericAd('banner', 'Advertisement', 'Hot single ghosts in your area want to meet you!');
                ad.style.top = '0';
                ad.style.left = '0';
                ad.onclick = () => Player.takeDamage(10);
                return ad;
            },
            points: 15
        },
        // Chases the cursor
        chaser: {
            create: () => {
                const ad = AdManager.createGenericAd('chaser', 'VIRUS ALERT!', 'Your PC is infected! Click here to clean!');
                ad.dataset.isChaser = true;
                // Damage is handled in game loop by proximity
                return ad;
            },
            points: 25
        },
        // Multiplies when closed
        trap: {
             create: () => {
                const ad = AdManager.createGenericAd('popup', 'CRITICAL UPDATE', 'Your system requires an immediate update.');
                ad.onclick = () => Player.takeDamage(5);
                ad.dataset.isTrap = true;
                return ad;
            },
            points: 5 // Low points because it spawns more
        },
        // Area damage until skipped
        video: {
            create: () => {
                const ad = AdManager.createGenericAd('video-ad', 'Video Player', '');
                ad.innerHTML = `
                    <div class="ad-header"><span>Unskippable Ad</span></div>
                    <div class="ad-content">
                        <div class="damage-aura"></div>
                        <div class="skip-btn">Skip Ad >></div>
                    </div>`;
                
                const skipBtn = ad.querySelector('.skip-btn');
                setTimeout(() => {
                    skipBtn.style.display = 'block';
                }, 3000);

                skipBtn.onclick = (e) => {
                    e.stopPropagation();
                    AdManager.destroyAd(ad, this.video.points);
                };
                
                // Damage handled by interval in game loop
                ad.dataset.isVideo = true;
                return ad;
            },
            points: 30
        }
    },

    createGenericAd(typeClass, headerText, contentText) {
        const ad = document.createElement('div');
        ad.className = `ad ${typeClass}`;
        ad.style.left = `${Math.random() * (DOMElements.gameScreen.clientWidth - 350)}px`;
        ad.style.top = `${Math.random() * (DOMElements.gameScreen.clientHeight - 200)}px`;

        const header = document.createElement('div');
        header.className = 'ad-header';
        header.textContent = headerText;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            if (ad.dataset.isTrap) {
                AdManager.destroyAd(ad, this.adTypes.trap.points);
                Spawner.spawnAds(2, ['popup']); // Spawn 2 basic popups as the trap
            } else {
                AdManager.destroyAd(ad, this.adTypes[typeClass].points);
            }
        };

        const content = document.createElement('div');
        content.className = 'ad-content';
        content.innerHTML = `<h3>${contentText}</h3>`;

        header.appendChild(closeBtn);
        ad.appendChild(header);
        ad.appendChild(content);

        return ad;
    },

    spawnAd(type) {
        if (!this.adTypes[type]) return;
        const ad = this.adTypes[type].create();
        state.activeAds.add(ad);
        DOMElements.gameScreen.appendChild(ad);
    },

    destroyAd(adElement, points) {
        if (!state.activeAds.has(adElement)) return; // Already destroyed
        
        adElement.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        adElement.style.transform = 'scale(0)';
        adElement.style.opacity = '0';

        setTimeout(() => {
            adElement.remove();
        }, 200);
        
        state.activeAds.delete(adElement);
        Player.addScore(points);

        if (!state.bossActive && state.activeAds.size === 0 && state.gameRunning) {
            Game.startNextWave();
        }
    },
    
    clearAllAds() {
        state.activeAds.forEach(ad => ad.remove());
        state.activeAds.clear();
    }
};

// =================================================================================
// --- SPAWNER MODULE ---
// =================================================================================
const Spawner = {
    waveConfig: [
        { count: 3, types: ['popup'] },          // Wave 1
        { count: 5, types: ['popup'] },          // Wave 2
        { count: 4, types: ['popup', 'banner'] }, // Wave 3
        { count: 6, types: ['popup', 'banner', 'trap'] }, // Wave 4
        { boss: 'cookieMonster' },                // Wave 5 (Boss)
        { count: 5, types: ['chaser', 'popup'] }, // Wave 6
        { count: 7, types: ['banner', 'video'] }, // Wave 7
        { count: 8, types: ['chaser', 'trap', 'video'] }, // Wave 8
        // ... gets harder
    ],

    spawnWave(waveNumber) {
        const configIndex = Math.min(waveNumber - 1, this.waveConfig.length - 1);
        const wave = this.waveConfig[configIndex];

        if (wave.boss) {
            state.bossActive = true;
            UI.showBossAlert(Bosses[wave.boss], () => {
                Bosses[wave.boss].start();
            });
        } else {
            const typesToSpawn = wave.types || ['popup'];
            this.spawnAds(wave.count, typesToSpawn);
        }
    },
    
    spawnAds(count, types) {
        for (let i = 0; i < count; i++) {
            const randomType = types[Math.floor(Math.random() * types.length)];
            AdManager.spawnAd(randomType);
        }
    }
};

// =================================================================================
// --- BOSS MODULE ---
// =================================================================================
const Bosses = {
    cookieMonster: {
        name: "THE COOKIE MONSTER",
        description: "It wants your data. And it won't take 'no' for an answer.",
        clicksNeeded: 5,
        clicks: 0,
        
        start() {
            this.clicks = 0;
            const bossAd = document.createElement('div');
            bossAd.className = 'ad boss cookie-monster';
            bossAd.innerHTML = `
                <h1>We use cookies to enhance your demise.</h1>
                <p>Accepting our cookies is mandatory. There is no escape.</p>
                <div class="button-container">
                    <button class="accept-btn">Accept</button>
                    <button class="accept-btn">Accept All</button>
                    <button class="reject-btn">REJECT (THIS WILL NOT WORK)</button>
                </div>
            `;
            
            bossAd.querySelectorAll('.accept-btn').forEach(btn => {
                btn.onclick = () => Player.takeDamage(20);
            });
            
            bossAd.querySelector('.reject-btn').onclick = () => {
                this.clicks++;
                Player.takeDamage(5); // Takes damage even on correct click
                bossAd.style.animation = 'screen-shake 0.2s';
                setTimeout(() => bossAd.style.animation = '', 200);

                if (this.clicks >= this.clicksNeeded) {
                    this.defeat(bossAd);
                }
            };
            
            state.activeAds.add(bossAd);
            DOMElements.gameScreen.appendChild(bossAd);

            this.minionInterval = setInterval(() => {
                Spawner.spawnAds(1, ['popup']);
            }, 2500);
        },
        
        defeat(bossAd) {
            clearInterval(this.minionInterval);
            AdManager.destroyAd(bossAd, 500);
            state.bossActive = false;
            // Clear remaining minions
            setTimeout(() => {
                AdManager.clearAllAds();
                Player.addScore(500);
                Game.startNextWave();
            }, 500);
        }
    }
};

// =================================================================================
// --- GAME LOOP & MAIN LOGIC ---
// =================================================================================
const Game = {
    init() {
        DOMElements.startButton.onclick = () => this.start();
        DOMElements.restartButton.onclick = () => this.start();
        Player.init();
    },

    start() {
        // Reset state
        state.gameRunning = true;
        state.score = 0;
        state.wave = 0;
        state.health = config.player.maxHealth;
        state.shield.active = false;
        state.shield.onCooldown = false;
        state.bossActive = false;
        clearTimeout(state.shield.cooldownTimer);
        AdManager.clearAllAds();
        
        // Update UI
        DOMElements.startScreen.style.display = 'none';
        DOMElements.gameOverScreen.style.display = 'none';
        UI.updateHealthBar();
        UI.updateScore();
        
        this.startNextWave();
        
        if (!this.loopRunning) {
            this.loopRunning = true;
            requestAnimationFrame(this.loop);
        }
    },
    
    end() {
        state.gameRunning = false;
        DOMElements.finalScore.textContent = state.score;
        DOMElements.finalWave.textContent = state.wave;
        DOMElements.gameOverScreen.style.display = 'flex';
    },
    
    startNextWave() {
        state.wave++;
        UI.updateWave();
        setTimeout(() => {
            Spawner.spawnWave(state.wave);
        }, config.game.waveStartDelay);
    },

    loop() {
        if (!state.gameRunning) {
            Game.loopRunning = false;
            return;
        }

        const now = Date.now();

        state.activeAds.forEach(ad => {
            // Chaser logic
            if (ad.dataset.isChaser) {
                const adRect = ad.getBoundingClientRect();
                const gameRect = DOMElements.gameContainer.getBoundingClientRect();
                const adX = ad.offsetLeft + adRect.width / 2;
                const adY = ad.offsetTop + adRect.height / 2;
                
                const dx = state.mouseX - adX;
                const dy = state.mouseY - adY;

                ad.style.left = `${ad.offsetLeft + dx * config.game.chaserSpeed}px`;
                ad.style.top = `${ad.offsetTop + dy * config.game.chaserSpeed}px`;
                
                // Check for collision with cursor
                if (Math.sqrt(dx*dx + dy*dy) < 50) { // 50px collision radius
                    Player.takeDamage(15);
                    AdManager.destroyAd(ad, 0); // No points for collision
                }
            }
            
            // Video ad damage pulse
            if (ad.dataset.isVideo) {
                if (!ad.lastDamageTime || now - ad.lastDamageTime > 2000) {
                    Player.takeDamage(2);
                    ad.lastDamageTime = now;
                }
            }
        });
        
        requestAnimationFrame(Game.loop);
    }
};

// --- START THE GAME ---
Game.init();
