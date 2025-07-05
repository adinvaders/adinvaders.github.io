// --- CONFIG & GAME STATE ---
const config = {
    player: {
        maxHealth: 100,
        shieldDuration: 2000,
        shieldCooldown: 5000,
        iFrameDuration: 1000,
    },
    game: {
        waveStartDelay: 3000,
        bossWaveInterval: 5,
    },
    powerups: {
        spawnChance: 0.15, // 15% chance to spawn on ad close
        ironCursorDuration: 5000, // 5 seconds
    },
    wave: {
        baseThreat: 50, // Starting "budget" for wave 1
        threatPerWave: 20, // How much the budget increases each wave
    }
};

let state = {
    gameRunning: false,
    score: 0,
    wave: 0,
    health: config.player.maxHealth,
    shield: { active: false, onCooldown: false },
    powerups: { ironCursorActive: false },
    playerInvincible: false,
    activeAds: new Map(), // Use a Map to store ad data and DOM element
    activePowerups: new Set(),
    mouseX: 0,
    mouseY: 0,
};

// --- DOM ELEMENTS ---
const DOMElements = {
    gameContainer: document.getElementById('game-container'),
    gameScreen: document.getElementById('game-screen'),
    healthBar: document.getElementById('health-bar'),
    scoreDisplay: document.getElementById('score-display'),
    waveDisplay: document.getElementById('wave-display'),
    powerupDisplay: document.getElementById('powerup-display'),
    startScreen: document.getElementById('start-screen'),
    gameOverScreen: document.getElementById('game-over-screen'),
    finalScore: document.getElementById('final-score'),
    finalWave: document.getElementById('final-wave'),
    playerShield: document.getElementById('player-shield'),
    startButton: document.getElementById('start-button'),
    restartButton: document.getElementById('restart-button'),
    waveAlertScreen: document.getElementById('wave-alert-screen'),
    waveAlertTitle: document.getElementById('wave-alert-title'),
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
        if (state.playerInvincible || state.shield.active || state.powerups.ironCursorActive) return;

        state.health = Math.max(0, state.health - amount);
        UI.updateHealthBar();
        if (state.health <= 0) Game.end();
        else {
            state.playerInvincible = true;
            setTimeout(() => { state.playerInvincible = false; }, config.player.iFrameDuration);
        }
    },

    activateShield() {
        if (state.shield.active || state.shield.onCooldown) return;
        state.shield.active = true;
        state.shield.onCooldown = true;
        DOMElements.playerShield.classList.add('active');
        UI.updatePowerupDisplay('SHIELD ACTIVE', config.player.shieldDuration);

        setTimeout(() => { state.shield.active = false; }, config.player.shieldDuration);
        setTimeout(() => { state.shield.onCooldown = false; UI.updatePowerupDisplay('READY'); }, config.player.shieldCooldown);
    },

    addScore(points, x, y) {
        state.score += points;
        UI.updateScore();
        UI.showFloatingScore(x, y, `+${points}`);
    }
};

// =================================================================================
// --- UI MODULE ---
// =================================================================================
const UI = {
    updateHealthBar() {
        const percentage = (state.health / config.player.maxHealth) * 100;
        DOMElements.healthBar.style.width = `${percentage}%`;
        DOMElements.healthBar.style.backgroundColor = percentage > 60 ? 'var(--primary-color)' : percentage > 30 ? 'var(--warning-color)' : 'var(--danger-color)';
    },
    updateScore: () => DOMElements.scoreDisplay.textContent = state.score,
    updateWave: () => DOMElements.waveDisplay.textContent = state.wave,
    showFloatingScore(x, y, text) {
        const el = document.createElement('div');
        el.className = 'floating-score';
        el.textContent = text;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        DOMElements.gameScreen.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    },
    updatePowerupDisplay(text, duration) {
        DOMElements.powerupDisplay.textContent = text;
        if(duration) {
            let timeLeft = duration / 1000;
            const interval = setInterval(() => {
                timeLeft -= 0.1;
                if(timeLeft > 0) {
                     DOMElements.powerupDisplay.textContent = `${text} ${timeLeft.toFixed(1)}s`;
                } else {
                    clearInterval(interval);
                }
            }, 100);
        }
    },
    showWaveAlert(text, duration = 2000) {
        DOMElements.waveAlertTitle.textContent = text;
        DOMElements.waveAlertScreen.style.display = 'flex';
        setTimeout(() => DOMElements.waveAlertScreen.style.display = 'none', duration);
    }
};

// =================================================================================
// --- POWERUP MODULE ---
// =================================================================================
const PowerupManager = {
    types: {
        'bomb': {
            activate: () => {
                AdManager.getAllAds().forEach(ad => AdManager.destroyAd(ad, 0));
                UI.showFloatingScore(state.mouseX, state.mouseY, "KABOOM!");
            }
        },
        'iron-cursor': {
            activate: () => {
                state.powerups.ironCursorActive = true;
                DOMElements.gameContainer.classList.add('iron-cursor-active');
                UI.updatePowerupDisplay('IRON CURSOR', config.powerups.ironCursorDuration);
                setTimeout(() => {
                    state.powerups.ironCursorActive = false;
                    DOMElements.gameContainer.classList.remove('iron-cursor-active');
                     if(!state.shield.onCooldown) UI.updatePowerupDisplay('READY');
                }, config.powerups.ironCursorDuration);
            }
        }
    },

    spawn(x, y) {
        const type = Math.random() > 0.5 ? 'bomb' : 'iron-cursor';
        const el = document.createElement('div');
        el.className = `power-up ${type}`;
        el.dataset.type = type;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;

        el.onclick = () => {
            this.types[type].activate();
            el.remove();
            state.activePowerups.delete(el);
        };

        state.activePowerups.add(el);
        DOMElements.gameScreen.appendChild(el);
        setTimeout(() => {
            if (state.activePowerups.has(el)) {
                el.remove();
                state.activePowerups.delete(el);
            }
        }, 7000); // Powerups disappear after 7 seconds
    },

    clearAll() {
        state.activePowerups.forEach(p => p.remove());
        state.activePowerups.clear();
    }
};


// =================================================================================
// --- AD FACTORY & MANAGER ---
// =================================================================================
const AdManager = {
    adDefinitions: {
        popup: {
            threat: 10,
            points: 100,
            create: () => AdManager.createAd('popup', {
                title: 'Congratulations!',
                content: `<h3>You are the 1,000,000th visitor!</h3><p>Click to claim your unbelievable prize!</p>`,
                clickDamage: 10,
            })
        },
        gremlinAd: {
            threat: 20,
            points: 250,
            create: () => AdManager.createAd('gremlin-ad', {
                title: 'System Alert',
                content: `<h3>Your drivers are out of date.</h3><p>Please update to continue.</p>`,
                clickDamage: 10,
                isGremlin: true,
            })
        },
        downloadAd: {
            threat: 25,
            points: 300,
            create: () => AdManager.createAd('download-ad', {
                title: 'Download Required',
                content: `<h3>Free Movie Player Update</h3>
                          <div class="button-grid">
                            <button class="ad-btn primary fake">DOWNLOAD</button>
                            <button class="ad-btn primary fake">DOWNLOAD NOW</button>
                            <button class="ad-btn secondary fake">Install Fast</button>
                            <button class="ad-btn secondary safe">Continue without installing</button>
                          </div>`,
                closeable: false
            })
        },
        cookieWall: {
            threat: 35,
            points: 400,
            create: () => AdManager.createAd('cookie-wall', {
                title: 'Our Site Uses Cookies',
                content: `<p>We use cookies and other data to improve your online experience. By clicking "Accept All", you agree to this.</p>
                          <div>
                            <button class="ad-btn secondary fake">Manage Preferences</button>
                            <button class="ad-btn primary safe">ACCEPT ALL</button>
                          </div>`,
                isFullScreen: true,
                closeable: false
            })
        }
    },
    
    createAd(className, options) {
        const ad = {
            id: `ad_${Date.now()}_${Math.random()}`,
            element: document.createElement('div'),
            ...options
        };
        ad.element.className = `ad ${className}`;

        if (!options.isFullScreen) {
            ad.element.style.left = `${5 + Math.random() * (DOMElements.gameScreen.clientWidth - 450)}px`;
            ad.element.style.top = `${5 + Math.random() * (DOMElements.gameScreen.clientHeight - 350)}px`;
        }

        let headerHTML = '';
        if (options.closeable !== false) {
             headerHTML = `<div class="ad-header"><span>${options.title}</span><button class="close-btn">×</button></div>`;
        } else {
             headerHTML = `<div class="ad-header"><span>${options.title}</span></div>`;
        }

        ad.element.innerHTML = `${headerHTML}<div class="ad-content">${options.content}</div>`;
        
        // --- Event Handling ---
        const closeBtn = ad.element.querySelector('.close-btn');
        if (closeBtn) {
            if(options.isGremlin){
                let moveCount = 0;
                const moveButton = () => {
                    if(moveCount > 4) return; // Prevent infinite running
                    const rect = ad.element.getBoundingClientRect();
                    const newX = Math.random() * (rect.width - 20);
                    const newY = Math.random() * (rect.height - ad.element.querySelector('.ad-header').offsetHeight - 20) + ad.element.querySelector('.ad-header').offsetHeight;
                    closeBtn.style.transform = `translate(${newX}px, ${newY}px)`;
                    moveCount++;
                }
                closeBtn.addEventListener('mouseover', moveButton);
            }
            closeBtn.onclick = e => { e.stopPropagation(); this.destroyAd(ad, this.adDefinitions[className.split(' ')[0]].points); };
        }

        if (options.clickDamage) {
            ad.element.onclick = () => Player.takeDamage(options.clickDamage);
        }

        ad.element.querySelectorAll('.fake').forEach(btn => btn.onclick = e => { e.stopPropagation(); Player.takeDamage(15); });
        ad.element.querySelectorAll('.safe').forEach(btn => btn.onclick = e => { e.stopPropagation(); this.destroyAd(ad, this.adDefinitions[className.split(' ')[0]].points); });

        ad.element.addEventListener('click', (e) => {
             if (state.powerups.ironCursorActive) {
                e.stopPropagation();
                this.destroyAd(ad, 0); // No points for iron cursor destroy
                UI.showFloatingScore(e.clientX, e.clientY, "ZAP!");
             }
        });

        return ad;
    },

    spawn(type) {
        const definition = this.adDefinitions[type];
        if (!definition) return;
        const ad = definition.create();
        state.activeAds.set(ad.id, ad);
        DOMElements.gameScreen.appendChild(ad.element);
    },

    destroyAd(ad, points) {
        if (!state.activeAds.has(ad.id)) return;
        
        const rect = ad.element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        if (points > 0) Player.addScore(points, centerX, centerY);
        if (Math.random() < config.powerups.spawnChance) PowerupManager.spawn(centerX, centerY);

        ad.element.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        ad.element.style.transform = 'scale(0)';
        ad.element.style.opacity = '0';
        
        setTimeout(() => ad.element.remove(), 200);
        state.activeAds.delete(ad.id);
        
        if (!state.bossActive && state.activeAds.size === 0 && state.gameRunning) {
            Game.startNextWave();
        }
    },
    
    getAllAds: () => Array.from(state.activeAds.values()),
    clearAll: () => { AdManager.getAllAds().forEach(ad => ad.element.remove()); state.activeAds.clear(); }
};

// =================================================================================
// --- WAVE SPAWNER MODULE ---
// =================================================================================
const Spawner = {
    generateWave(waveNumber) {
        const budget = config.wave.baseThreat + (waveNumber * config.wave.threatPerWave);
        let currentBudget = budget;
        const spawnList = [];

        const availableAds = Object.entries(AdManager.adDefinitions).filter(([type, def]) => {
            if (waveNumber < 3 && (type === 'downloadAd' || type === 'cookieWall')) return false;
            if (waveNumber < 2 && type === 'gremlinAd') return false;
            return true;
        });

        while (currentBudget > 0 && spawnList.length < 15) { // Cap ads per wave
            const affordableAds = availableAds.filter(([_, def]) => def.threat <= currentBudget);
            if(affordableAds.length === 0) break;
            
            const [type, def] = affordableAds[Math.floor(Math.random() * affordableAds.length)];
            spawnList.push(type);
            currentBudget -= def.threat;
        }
        return spawnList;
    },

    spawnWave(waveNumber) {
        // if (waveNumber % config.game.bossWaveInterval === 0) { ... BOSS LOGIC ... }
        const adsToSpawn = this.generateWave(waveNumber);
        adsToSpawn.forEach((type, i) => {
            setTimeout(() => AdManager.spawn(type), i * 300); // Stagger spawns
        });
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
        Object.assign(state, {
            gameRunning: true, score: 0, wave: 0,
            health: config.player.maxHealth,
            shield: { active: false, onCooldown: false },
            powerups: { ironCursorActive: false },
            playerInvincible: false
        });
        AdManager.clearAll();
        PowerupManager.clearAll();

        // Update UI
        DOMElements.startScreen.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => DOMElements.startScreen.style.display = 'none', 500);
        DOMElements.gameOverScreen.style.display = 'none';
        DOMElements.gameContainer.classList.remove('iron-cursor-active');
        UI.updateHealthBar();
        UI.updateScore();
        UI.updatePowerupDisplay('READY');
        
        this.startNextWave();
        if (!this.loopRunning) this.loop();
    },
    
    end() {
        state.gameRunning = false;
        DOMElements.finalScore.textContent = state.score;
        DOMElements.finalWave.textContent = state.wave;
        DOMElements.gameOverScreen.style.display = 'flex';
        DOMElements.gameOverScreen.style.animation = 'fadeIn 0.5s ease forwards';
    },
    
    startNextWave() {
        state.wave++;
        UI.updateWave();
        UI.showWaveAlert(`WAVE ${state.wave}`);
        setTimeout(() => Spawner.spawnWave(state.wave), config.game.waveStartDelay);
    },

    loop() {
        if (!state.gameRunning) {
            this.loopRunning = false;
            return;
        }
        this.loopRunning = true;
        // Game logic that needs to run every frame can go here
        
        requestAnimationFrame(() => this.loop());
    }
};

// --- START THE GAME ---
Game.init();
