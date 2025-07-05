// --- CONFIG & GAME STATE ---
const config = {
    player: { maxHealth: 100, shieldDuration: 2000, shieldCooldown: 5000, iFrameDuration: 1000 },
    game: { waveStartDelay: 3000, bossWaveInterval: 5 },
    powerups: { spawnChance: 0.15, ironCursorDuration: 5000 },
    wave: { baseThreat: 50, threatPerWave: 25 }
};
let state = { gameRunning: false, score: 0, wave: 0, health: config.player.maxHealth, shield: { active: false, onCooldown: false }, powerups: { ironCursorActive: false }, playerInvincible: false, activeAds: new Map(), activePowerups: new Set(), mouseX: 0, mouseY: 0, bossActive: false };

// --- DOM ELEMENTS ---
const DOMElements = {
    gameContainer: document.getElementById('game-container'),
    gameScreen: document.getElementById('game-screen'),
    bossScreen: document.getElementById('boss-screen'),
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
    waveAlertSubtitle: document.getElementById('wave-alert-subtitle'),
};

// --- SVG ICONS --- (for self-contained ads)
const SVGIcons = {
    warning: `<svg class="ad-icon" fill="var(--danger-color)" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L1 21h22M12 2L1 21h22L12 2zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z"/></svg>`,
    download: `<svg class="ad-icon" fill="var(--primary-color)" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`
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
        DOMElements.gameContainer.addEventListener('contextmenu', e => { e.preventDefault(); if (state.gameRunning) this.activateShield(); });
    },
    takeDamage(amount) {
        if (state.playerInvincible || state.shield.active || state.powerups.ironCursorActive) return;
        state.health = Math.max(0, state.health - amount);
        UI.updateHealthBar();
        UI.flashDamage();
        if (state.health <= 0) Game.end();
        else { state.playerInvincible = true; setTimeout(() => { state.playerInvincible = false; }, config.player.iFrameDuration); }
    },
    activateShield() {
        if (state.shield.active || state.shield.onCooldown) return;
        state.shield.active = true; state.shield.onCooldown = true;
        DOMElements.playerShield.classList.add('active');
        UI.updateAbilityDisplay('SHIELD ACTIVE', config.player.shieldDuration);
        setTimeout(() => { state.shield.active = false; }, config.player.shieldDuration);
        setTimeout(() => { state.shield.onCooldown = false; UI.updateAbilityDisplay('READY'); }, config.player.shieldCooldown);
    },
    addScore(points, x, y) {
        state.score += points; UI.updateScore();
        UI.showFloatingScore(x, y, `+${points}`);
    }
};

// =================================================================================
// --- UI MODULE ---
// =================================================================================
const UI = {
    updateHealthBar() {
        const p = (state.health / config.player.maxHealth) * 100;
        DOMElements.healthBar.style.width = `${p}%`;
        DOMElements.healthBar.style.backgroundColor = p > 60 ? 'var(--primary-color)' : p > 30 ? 'var(--warning-color)' : 'var(--danger-color)';
    },
    updateScore: () => DOMElements.scoreDisplay.textContent = state.score,
    updateWave: () => DOMElements.waveDisplay.textContent = state.wave,
    showFloatingScore(x, y, text) {
        const el = document.createElement('div');
        el.className = 'floating-score'; el.textContent = text;
        el.style.left = `${x}px`; el.style.top = `${y}px`;
        DOMElements.gameScreen.appendChild(el); setTimeout(() => el.remove(), 1000);
    },
    updateAbilityDisplay(text, duration) {
        DOMElements.powerupDisplay.textContent = text;
        if(duration) {
            let timeLeft = duration / 1000;
            const interval = setInterval(() => {
                timeLeft -= 0.1;
                if(timeLeft > 0 && (state.shield.active || state.powerups.ironCursorActive)) DOMElements.powerupDisplay.textContent = `${text.split(' ')[0]} ${timeLeft.toFixed(1)}s`;
                else clearInterval(interval);
            }, 100);
        }
    },
    showWaveAlert(title, subtitle = '', duration = 2000) {
        DOMElements.waveAlertTitle.textContent = title;
        DOMElements.waveAlertSubtitle.textContent = subtitle;
        DOMElements.waveAlertScreen.style.display = 'flex';
        setTimeout(() => DOMElements.waveAlertScreen.style.display = 'none', duration);
    },
    flashDamage() {
        DOMElements.gameContainer.classList.add('damage-flash');
        setTimeout(() => DOMElements.gameContainer.classList.remove('damage-flash'), 200);
    }
};

// =================================================================================
// --- POWERUP MODULE ---
// =================================================================================
const PowerupManager = {
    types: {
        'bomb': { activate: () => { AdManager.getAllAds().forEach(ad => AdManager.destroyAd(ad, 0)); UI.showFloatingScore(state.mouseX, state.mouseY, "KABOOM!"); }},
        'iron-cursor': { activate: () => {
            state.powerups.ironCursorActive = true; DOMElements.gameContainer.classList.add('iron-cursor-active');
            UI.updateAbilityDisplay('IRON CURSOR', config.powerups.ironCursorDuration);
            setTimeout(() => {
                state.powerups.ironCursorActive = false; DOMElements.gameContainer.classList.remove('iron-cursor-active');
                if(!state.shield.onCooldown) UI.updateAbilityDisplay('READY');
            }, config.powerups.ironCursorDuration);
        }}
    },
    spawn(x, y) {
        const type = Math.random() > 0.5 ? 'bomb' : 'iron-cursor';
        const el = document.createElement('div');
        el.className = `power-up ${type}`; el.dataset.type = type;
        el.style.left = `${x}px`; el.style.top = `${y}px`;
        el.onclick = () => { this.types[type].activate(); el.remove(); state.activePowerups.delete(el); };
        state.activePowerups.add(el); DOMElements.gameScreen.appendChild(el);
        setTimeout(() => { if (state.activePowerups.has(el)) { el.remove(); state.activePowerups.delete(el); }}, 7000);
    },
    clearAll() { state.activePowerups.forEach(p => p.remove()); state.activePowerups.clear(); }
};

// =================================================================================
// --- AD FACTORY & MANAGER ---
// =================================================================================
const AdManager = {
    adDefinitions: {
        popup: { threat: 10, points: 100, create: () => AdManager.createAd('popup', {
            title: 'Your perfect match is waiting!', clickDamage: 10,
            content: `<img class="popup-profile-pic" src="https://picsum.photos/seed/${Math.random()}/80" alt="Profile"><div class="popup-text"><h3>Jessica, 24</h3><p>Wants to connect with you!</p></div>`
        })},
        gremlinAd: { threat: 20, points: 250, create: () => AdManager.createAd('gremlin-ad', {
            title: 'Security Warning', clickDamage: 10, isGremlin: true,
            content: `${SVGIcons.warning}<div class="gremlin-text"><h3>MALWARE DETECTED!</h3><p>Your system is at risk. Immediate action required to prevent data loss.</p></div>`
        })},
        downloadAd: { threat: 25, points: 300, create: () => AdManager.createAd('download-ad', {
            title: 'Download Manager', closeable: false,
            content: `<h3>${SVGIcons.download} FreeAntivirusPlus.exe</h3><div class="file-info">File Size: 84.3MB | Uploaded: today | Seeds: 2,481</div><div class="progress-bar"><div class="progress-bar-inner" style="width: ${20 + Math.random()*50}%"></div></div><div class="button-grid"><button class="ad-btn primary fake">DOWNLOAD (2.3MB/s)</button><button class="ad-btn primary fake">START DOWNLOAD</button><button class="ad-btn secondary fake">Install with Manager</button><button class="ad-btn secondary safe">Decline</button></div>`
        })},
        cookieWall: { threat: 35, points: 400, create: () => AdManager.createAd('cookie-wall', {
            title: 'About Your Privacy', isFullScreen: true, closeable: false,
            content: `<p>We use cookies to personalize your experience and for marketing purposes. It's how we keep the lights on! To continue, please accept our policies.</p><div><button class="ad-btn secondary fake">Customize Settings</button><button class="ad-btn primary safe">ACCEPT & CLOSE</button></div>`
        })}
    },
    createAd(className, options) {
        const ad = { id: `ad_${Date.now()}_${Math.random()}`, element: document.createElement('div'), ...options };
        ad.element.className = `ad ${className}`;
        if (!options.isFullScreen) {
            ad.element.style.left = `${5 + Math.random() * (DOMElements.gameScreen.clientWidth - 450)}px`;
            ad.element.style.top = `${5 + Math.random() * (DOMElements.gameScreen.clientHeight - 350)}px`;
        }
        ad.element.innerHTML = `${options.closeable !== false ? `<div class="ad-header"><span>${options.title}</span><button class="close-btn">×</button></div>` : `<div class="ad-header"><span>${options.title}</span></div>`}<div class="ad-content">${options.content}</div>`;
        const closeBtn = ad.element.querySelector('.close-btn');
        if (closeBtn) {
            if(options.isGremlin){
                closeBtn.addEventListener('mouseover', () => {
                    const rect = ad.element.getBoundingClientRect();
                    const newX = Math.random() * (rect.width - 50);
                    const newY = Math.random() * (rect.height - 50);
                    closeBtn.style.transform = `translate(${newX}px, ${newY}px)`;
                });
            }
            closeBtn.onclick = e => { e.stopPropagation(); this.destroyAd(ad, this.adDefinitions[className.split(' ')[0]].points); };
        }
        if (options.clickDamage) { ad.element.onclick = () => Player.takeDamage(options.clickDamage); }
        ad.element.querySelectorAll('.fake').forEach(btn => btn.onclick = e => { e.stopPropagation(); Player.takeDamage(15); });
        ad.element.querySelectorAll('.safe').forEach(btn => btn.onclick = e => { e.stopPropagation(); this.destroyAd(ad, this.adDefinitions[className.split(' ')[0]].points); });
        ad.element.addEventListener('click', e => { if (state.powerups.ironCursorActive) { e.stopPropagation(); this.destroyAd(ad, 0); UI.showFloatingScore(e.clientX, e.clientY, "ZAP!"); } });
        return ad;
    },
    spawn(type) {
        const ad = this.adDefinitions[type].create(); state.activeAds.set(ad.id, ad);
        DOMElements.gameScreen.appendChild(ad.element);
    },
    destroyAd(ad, points) {
        if (!state.activeAds.has(ad.id)) return;
        const rect = ad.element.getBoundingClientRect();
        if (points > 0) Player.addScore(points, rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (points > 0 && Math.random() < config.powerups.spawnChance) PowerupManager.spawn(rect.left + rect.width / 2, rect.top + rect.height / 2);
        ad.element.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        ad.element.style.transform = 'scale(0)'; ad.element.style.opacity = '0';
        setTimeout(() => ad.element.remove(), 200); state.activeAds.delete(ad.id);
        if (!state.bossActive && state.activeAds.size === 0 && state.gameRunning) Game.startNextWave();
    },
    getAllAds: () => Array.from(state.activeAds.values()),
    clearAll: () => { AdManager.getAllAds().forEach(ad => ad.element.remove()); state.activeAds.clear(); }
};

// =================================================================================
// --- BOSS MANAGER MODULE ---
// =================================================================================
const BossManager = {
    systemHijacker: {
        name: "SYSTEM HIJACKER", description: "This looks serious...",
        start() {
            state.bossActive = true;
            this.phase = 1;
            this.scanPercent = 0;
            DOMElements.bossScreen.innerHTML = `
                <div id="boss-ui">
                    <h2>SYSTEM SCAN IN PROGRESS</h2>
                    <div id="boss-scan-progress"><div id="boss-scan-progress-bar"></div></div>
                    <div id="boss-scan-log"><div>[${new Date().toLocaleTimeString()}] Initializing scan...</div></div>
                    <div id="boss-phase2-overlay" style="display: none;">
                        <h3>487 THREATS FOUND!</h3>
                        <p>System integrity is critical. Quarantine all threats immediately.</p>
                        <button id="boss-quarantine-btn">QUARANTINE ALL</button>
                        <button id="boss-cancel-btn">Cancel</button>
                    </div>
                </div>`;
            const log = DOMElements.bossScreen.querySelector('#boss-scan-log');
            const bar = DOMElements.bossScreen.querySelector('#boss-scan-progress-bar');
            
            this.scanInterval = setInterval(() => {
                this.scanPercent += 2;
                bar.style.width = `${this.scanPercent}%`;
                const newLog = document.createElement('div');
                if(Math.random() < 0.25){
                    newLog.textContent = `[${new Date().toLocaleTimeString()}] Threat found: Adware.Popupper.v2`;
                    newLog.className = 'boss-threat-found';
                    Spawner.spawnAds(1, ['popup', 'gremlinAd']);
                } else {
                    newLog.textContent = `[${new Date().toLocaleTimeString()}] Scanning C:\\Windows\\System32... OK`;
                }
                log.appendChild(newLog);
                log.scrollTop = log.scrollHeight;
                if(this.scanPercent >= 100) this.enterPhase2();
            }, 500);
        },
        enterPhase2(){
            clearInterval(this.scanInterval);
            this.phase = 2;
            const overlay = DOMElements.bossScreen.querySelector('#boss-phase2-overlay');
            const cancelBtn = DOMElements.bossScreen.querySelector('#boss-cancel-btn');
            const quarantineBtn = DOMElements.bossScreen.querySelector('#boss-quarantine-btn');
            
            overlay.style.display = 'flex';
            cancelBtn.style.top = `${Math.random() * 90 + 5}%`;
            cancelBtn.style.left = `${Math.random() * 90 + 5}%`;
            
            quarantineBtn.onclick = () => Player.takeDamage(50);
            cancelBtn.onclick = () => this.defeat();
        },
        defeat() {
            Player.addScore(5000, window.innerWidth / 2, window.innerHeight / 2);
            DOMElements.bossScreen.innerHTML = '';
            AdManager.clearAll();
            state.bossActive = false;
            setTimeout(() => Game.startNextWave(), 1000);
        }
    }
};

// =================================================================================
// --- SPAWNER MODULE ---
// =================================================================================
const Spawner = {
    generateWave(waveNumber) {
        const budget = config.wave.baseThreat + (waveNumber * config.wave.threatPerWave);
        let currentBudget = budget;
        const spawnList = [];
        const availableAds = Object.entries(AdManager.adDefinitions).filter(([type]) => {
            if (waveNumber < 3 && (type === 'downloadAd' || type === 'cookieWall')) return false;
            if (waveNumber < 2 && type === 'gremlinAd') return false;
            return true;
        });
        while (currentBudget > 0 && spawnList.length < 15) {
            const affordableAds = availableAds.filter(([, def]) => def.threat <= currentBudget);
            if (affordableAds.length === 0) break;
            const [type, def] = affordableAds[Math.floor(Math.random() * affordableAds.length)];
            spawnList.push(type);
            currentBudget -= def.threat;
        }
        return spawnList;
    },
    spawnAds(count, types) {
        for (let i = 0; i < count; i++) {
            AdManager.spawn(types[Math.floor(Math.random() * types.length)]);
        }
    },
    spawnWave(waveNumber) {
        if (waveNumber > 0 && waveNumber % config.game.bossWaveInterval === 0) {
            const boss = BossManager.systemHijacker;
            UI.showWaveAlert(`WARNING: INCOMING BOSS`, boss.description, 4000);
            setTimeout(() => boss.start(), 4000);
        } else {
            const adsToSpawn = this.generateWave(waveNumber);
            UI.showWaveAlert(`WAVE ${waveNumber}`);
            adsToSpawn.forEach((type, i) => setTimeout(() => AdManager.spawn(type), 1000 + i * 400));
        }
    }
};

// =================================================================================
// --- GAME LOOP & MAIN LOGIC ---
// =================================================================================
const Game = {
    init() {
        DOMElements.startButton.onclick = () => this.start();
        DOMElements.restartButton.onclick = () => this.start(); Player.init();
    },
    start() {
        Object.assign(state, { gameRunning: true, score: 0, wave: 0, health: config.player.maxHealth, shield: { active: false, onCooldown: false }, powerups: { ironCursorActive: false }, playerInvincible: false, bossActive: false });
        AdManager.clearAll(); PowerupManager.clearAll();
        DOMElements.startScreen.style.display = 'none'; DOMElements.gameOverScreen.style.display = 'none';
        DOMElements.gameContainer.classList.remove('iron-cursor-active');
        UI.updateHealthBar(); UI.updateScore(); UI.updateAbilityDisplay('READY');
        this.startNextWave(); if (!this.loopRunning) this.loop();
    },
    end() {
        state.gameRunning = false;
        DOMElements.finalScore.textContent = state.score;
        DOMElements.finalWave.textContent = state.wave;
        DOMElements.gameOverScreen.style.display = 'flex';
    },
    startNextWave() {
        state.wave++; UI.updateWave();
        setTimeout(() => Spawner.spawnWave(state.wave), 500);
    },
    loop() {
        if (!state.gameRunning) { this.loopRunning = false; return; }
        this.loopRunning = true;
        // Frame-by-frame logic would go here if needed (e.g., constant chaser movement)
        requestAnimationFrame(() => this.loop());
    }
};

// --- START THE GAME ---
Game.init();
