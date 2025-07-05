// --- CONFIG & GAME STATE ---
const config = {
    player: { maxHealth: 100, shieldDuration: 2000, shieldCooldown: 5000, iFrameDuration: 500 },
    game: { waveStartDelay: 3000, bossWaveInterval: 5 },
    powerups: {
        spawnChance: 0.18,
        scoreSurgeDuration: 8000,
        systemFreezeDuration: 5000,
        clusterBombRadius: 250
    },
    wave: { baseThreat: 50, threatPerWave: 25 }
};

let state = {
    gameRunning: false, score: 0, wave: 0,
    health: config.player.maxHealth,
    shield: { active: false, onCooldown: false },
    playerInvincible: false,
    activeAds: new Map(),
    activePowerups: new Set(),
    mouseX: 0, mouseY: 0,
    bossActive: false,
    scoreMultiplier: 1,
    systemFrozen: false
};

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

// --- SVG ICONS ---
const SVGIcons = {
    warning: `<svg class="ad-icon" fill="var(--danger-color)" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`
};

// =================================================================================
// --- PLAYER MODULE ---
// =================================================================================
const Player = {
    init() {
        DOMElements.gameContainer.addEventListener('mousemove', e => {
            const rect = DOMElements.gameContainer.getBoundingClientRect();
            state.mouseX = e.clientX - rect.left; state.mouseY = e.clientY - rect.top;
            DOMElements.playerShield.style.left = `${state.mouseX}px`;
            DOMElements.playerShield.style.top = `${state.mouseY}px`;
        });
        DOMElements.gameContainer.addEventListener('contextmenu', e => { e.preventDefault(); if (state.gameRunning) this.activateShield(); });
    },
    takeDamage(amount) {
        if (state.playerInvincible || state.shield.active) return;
        state.health = Math.max(0, state.health - amount);
        UI.updateHealthBar(); UI.flashDamage();
        if (state.health <= 0) Game.end();
        else { state.playerInvincible = true; setTimeout(() => { state.playerInvincible = false; }, config.player.iFrameDuration); }
    },
    activateShield() {
        if (state.shield.active || state.shield.onCooldown || state.systemFrozen || state.scoreMultiplier > 1) return;
        state.shield.active = true; state.shield.onCooldown = true;
        DOMElements.playerShield.classList.add('active');
        UI.updateAbilityDisplay('SHIELD ACTIVE', config.player.shieldDuration);
        setTimeout(() => { state.shield.active = false; DOMElements.playerShield.classList.remove('active'); }, config.player.shieldDuration);
        setTimeout(() => { state.shield.onCooldown = false; UI.updateAbilityDisplay('ONLINE'); }, config.player.shieldCooldown);
    },
    addScore(points, x, y) {
        const calculatedPoints = points * state.scoreMultiplier;
        state.score += calculatedPoints;
        UI.updateScore();
        UI.showFloatingScore(x, y, `+${calculatedPoints}`);
    }
};

// =================================================================================
// --- UI MODULE ---
// =================================================================================
const UI = {
    updateHealthBar() {
        const p = (state.health / config.player.maxHealth) * 100;
        DOMElements.healthBar.style.width = `${p}%`;
        const color = p > 60 ? 'var(--secondary-color)' : p > 30 ? 'var(--warning-color)' : 'var(--danger-color)';
        DOMElements.healthBar.style.backgroundColor = color;
        DOMElements.healthBar.style.boxShadow = `0 0 10px ${color}`;
    },
    updateScore() {
        DOMElements.scoreDisplay.textContent = state.score;
        if(state.scoreMultiplier > 1) {
            DOMElements.scoreDisplay.textContent += ` (x${state.scoreMultiplier})`;
            DOMElements.scoreDisplay.style.color = 'var(--warning-color)';
        } else {
            DOMElements.scoreDisplay.style.color = '#fff';
        }
    },
    updateWave: () => DOMElements.waveDisplay.textContent = state.wave,
    showFloatingScore(x, y, text) {
        const el = document.createElement('div');
        el.className = 'floating-score'; el.textContent = text;
        el.style.left = `${x}px`; el.style.top = `${y}px`;
        DOMElements.gameScreen.appendChild(el); setTimeout(() => el.remove(), 1000);
    },
    updateAbilityDisplay(text, duration) {
        DOMElements.powerupDisplay.textContent = text.split(' ')[0];
        if (duration) {
            let timeLeft = duration / 1000;
            const interval = setInterval(() => {
                timeLeft -= 0.1;
                if(timeLeft > 0 && (state.shield.active || state.scoreMultiplier > 1 || state.systemFrozen)) {
                    DOMElements.powerupDisplay.textContent = `${text.split(' ')[0]} ${timeLeft.toFixed(1)}s`;
                } else { clearInterval(interval); }
            }, 100);
        }
    },
    flashDamage() {
        DOMElements.gameContainer.classList.add('damage-flash');
        setTimeout(() => DOMElements.gameContainer.classList.remove('damage-flash'), 200);
    },
    showWaveAlert(title, subtitle = '', duration = 2000) {
        DOMElements.waveAlertTitle.textContent = title;
        DOMElements.waveAlertSubtitle.textContent = subtitle;
        DOMElements.waveAlertScreen.style.display = 'flex';
        setTimeout(() => DOMElements.waveAlertScreen.style.display = 'none', duration);
    }
};

// =================================================================================
// --- POWERUP MANAGER ---
// =================================================================================
const PowerupManager = {
    types: {
        'clusterBomb': {
            activate: (el) => {
                const rect = el.getBoundingClientRect(); const gameRect = DOMElements.gameContainer.getBoundingClientRect();
                const x = rect.left - gameRect.left + rect.width / 2; const y = rect.top - gameRect.top + rect.height / 2;
                const shockwave = document.createElement('div');
                shockwave.className = 'shockwave'; shockwave.style.left = `${x}px`; shockwave.style.top = `${y}px`;
                DOMElements.gameScreen.appendChild(shockwave); setTimeout(() => shockwave.remove(), 500);
                AdManager.getAllAds().forEach(ad => {
                    const adRect = ad.element.getBoundingClientRect();
                    const adX = adRect.left - gameRect.left + adRect.width / 2; const adY = adRect.top - gameRect.top + adRect.height / 2;
                    if (Math.hypot(x - adX, y - adY) < config.powerups.clusterBombRadius) AdManager.destroyAd(ad, 0);
                });
            }
        },
        'scoreSurge': {
            activate: () => {
                if (state.scoreMultiplier > 1 || state.systemFrozen || state.shield.active) return;
                state.scoreMultiplier = 2; UI.updateScore();
                UI.updateAbilityDisplay('SCORE SURGE', config.powerups.scoreSurgeDuration);
                setTimeout(() => { state.scoreMultiplier = 1; UI.updateScore(); UI.updateAbilityDisplay('ONLINE'); }, config.powerups.scoreSurgeDuration);
            }
        },
        'systemFreeze': {
            activate: () => {
                if(state.systemFrozen || state.scoreMultiplier > 1 || state.shield.active) return;
                state.systemFrozen = true;
                AdManager.getAllAds().forEach(ad => ad.element.classList.add('frozen'));
                UI.updateAbilityDisplay('SYSTEM FREEZE', config.powerups.systemFreezeDuration);
                setTimeout(() => {
                    state.systemFrozen = false;
                    AdManager.getAllAds().forEach(ad => ad.element.classList.remove('frozen'));
                    UI.updateAbilityDisplay('ONLINE');
                }, config.powerups.systemFreezeDuration);
            }
        }
    },
    spawn(x, y) {
        const powerupTypes = ['clusterBomb', 'scoreSurge', 'systemFreeze'];
        const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        const el = document.createElement('div');
        el.className = `power-up ${type.toLowerCase()}`;
        el.style.left = `${x - 25}px`; el.style.top = `${y - 25}px`;
        el.onclick = () => { this.types[type].activate(el); el.remove(); state.activePowerups.delete(el); };
        state.activePowerups.add(el); DOMElements.gameScreen.appendChild(el);
        setTimeout(() => { if (state.activePowerups.has(el)) { el.remove(); state.activePowerups.delete(el); }}, 8000);
    },
    clearAll() { state.activePowerups.forEach(p => p.remove()); state.activePowerups.clear(); }
};

// =================================================================================
// --- AD FACTORY & MANAGER ---
// =================================================================================
const AdManager = {
    adDefinitions: {
        gremlinAd: { threat: 20, points: 250, create: () => AdManager.createAd('gremlin-ad', { title: 'Security Warning',
            content: `${SVGIcons.warning}<div><h3>MALWARE DETECTED!</h3><p>Your system is at risk. Immediate action required.</p></div>`,
            init: (ad) => {
                const closeBtn = ad.element.querySelector('.close-btn');
                ad.element.addEventListener('mouseover', () => {
                    if (state.systemFrozen) return;
                    // Note: We use mouseover on the ad itself, not just the button, for better UX
                    const adRect = ad.element.getBoundingClientRect();
                    const newX = Math.random() * (adRect.width - closeBtn.offsetWidth);
                    const newY = Math.random() * (adRect.height - closeBtn.offsetHeight);
                    closeBtn.style.transform = `translate(${newX}px, ${newY}px)`;
                });
            }
        })},
        misleadingXAd: { threat: 15, points: 150, create: () => AdManager.createAd('misleading-x-ad', { title: 'Claim Your Prize!',
            content: `<p>You have won! Confirm below to receive your reward! <button class="real-x-btn">No thanks</button></p>`,
            init: (ad) => {
                ad.element.querySelector('.close-btn').classList.add('fake-x-btn');
                ad.element.querySelector('.close-btn').onclick = (e) => { e.stopPropagation(); Player.takeDamage(10); };
                ad.element.querySelector('.real-x-btn').onclick = (e) => { e.stopPropagation(); AdManager.destroyAd(ad, AdManager.adDefinitions.misleadingXAd.points); };
            }
        })},
        chatAd: { threat: 22, points: 350, create: () => AdManager.createAd('chat-ad', { title: 'LiveSupport Bot', closeable: false,
            content: `<div class="chat-log"><div class="typing-indicator">Bot is connecting...</div></div><button class="ad-btn" disabled>END CHAT</button>`,
            init: (ad) => {
                const log = ad.element.querySelector('.chat-log'); const endButton = ad.element.querySelector('.ad-btn');
                const messages = [ { text: 'Hello, I am a certified support technician.' }, { text: 'Your system has sent us 17 critical error signals.' }, { text: 'You must install our security patch immediately.' }, { text: 'Download link generating now...', isLink: true } ];
                let messageIndex = 0;
                const typeMessage = () => {
                    if (state.systemFrozen) { ad.timers.push(setTimeout(typeMessage, 200)); return; }
                    if (messageIndex >= messages.length || !state.activeAds.has(ad.id)) return;
                    const msg = messages[messageIndex];
                    log.querySelector('.typing-indicator')?.remove();
                    log.innerHTML += `<div class="message bot">Bot: ${msg.text}</div>`;
                    if (msg.isLink) { ad.damageTimer = setTimeout(() => { if(!state.systemFrozen) Player.takeDamage(25); }, 2000); ad.timers.push(ad.damageTimer); }
                    else { log.innerHTML += `<div class="typing-indicator">Bot is typing...</div>`; }
                    log.scrollTop = log.scrollHeight; messageIndex++;
                    if (messageIndex < messages.length) ad.timers.push(setTimeout(typeMessage, 2000));
                };
                ad.timers.push(setTimeout(typeMessage, 1000), setTimeout(() => { if (!state.systemFrozen) endButton.disabled = false; }, 4000));
                endButton.onclick = (e) => { e.stopPropagation(); this.destroyAd(ad, this.adDefinitions.chatAd.points); };
            }
        })},
        surveyAd: { threat: 18, points: 200, create: () => AdManager.createAd('survey-ad', { title: 'You\'ve been selected!',
            content: `<div class="survey-content"></div>`,
            init: (ad) => {
                ad.quizData = { currentQ: 0, questions: [
                    { q: 'Which of these is NOT a primary color?', a: ['Red', 'Blue', 'Green', 'Yellow'], correct: 2 },
                    { q: 'What is the capital of France?', a: ['London', 'Paris', 'Berlin', 'Rome'], correct: 1 },
                    { q: 'How many planets are in our Solar System?', a: ['7', '8', '9', '10'], correct: 1 }
                ]};
                this.renderSurveyQuestion(ad);
            }
        })},
    },
    renderSurveyQuestion(ad) {
        const { currentQ, questions } = ad.quizData; const questionData = questions[currentQ];
        const optionsHTML = questionData.a.map((opt, i) => `<button class="survey-option" data-index="${i}">${opt}</button>`).join('');
        const progressHTML = questions.map((_, i) => `<div class="progress-dot ${i < currentQ ? 'complete' : ''}"></div>`).join('');
        ad.element.querySelector('.survey-content').innerHTML = `<div class="survey-question">${questionData.q}</div><div class="survey-options">${optionsHTML}</div><div class="survey-progress">${progressHTML}</div>`;
        ad.element.querySelectorAll('.survey-option').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation(); if (state.systemFrozen) return;
                if (parseInt(btn.dataset.index) === questionData.correct) {
                    if (++ad.quizData.currentQ >= questions.length) { this.destroyAd(ad, this.adDefinitions.surveyAd.points + 50); }
                    else { this.renderSurveyQuestion(ad); }
                } else { Player.takeDamage(5); }
            };
        });
    },
    createAd(className, options) {
        const ad = { id: `ad_${Date.now()}_${Math.random()}`, element: document.createElement('div'), timers: [], ...options };
        ad.element.className = `ad ${className}`;
        ad.element.style.left = `${5 + Math.random() * (DOMElements.gameScreen.clientWidth - 450)}px`;
        ad.element.style.top = `${5 + Math.random() * (DOMElements.gameScreen.clientHeight - 400)}px`;
        ad.element.innerHTML = `<div class="ad-header"><span>${options.title}</span><button class="close-btn">×</button></div><div class="ad-content">${options.content || ''}</div>`;
        if (state.systemFrozen) ad.element.classList.add('frozen');
        const closeBtn = ad.element.querySelector('.close-btn');
        if (closeBtn) closeBtn.onclick = e => { e.stopPropagation(); this.destroyAd(ad, this.adDefinitions[className.split(' ')[0]].points); };
        if (options.init) options.init(ad);
        return ad;
    },
    spawn(type) { if(!this.adDefinitions[type]) { console.error(`Ad type "${type}" not found.`); return; } const ad = this.adDefinitions[type].create(); state.activeAds.set(ad.id, ad); DOMElements.gameScreen.appendChild(ad.element); },
    destroyAd(ad, points) {
        if (!state.activeAds.has(ad.id)) return;
        ad.timers.forEach(clearTimeout);
        const rect = ad.element.getBoundingClientRect(); const gameRect = DOMElements.gameContainer.getBoundingClientRect();
        const x = rect.left - gameRect.left + rect.width/2; const y = rect.top - gameRect.top + rect.height/2;
        if (points > 0) Player.addScore(points, x, y);
        if (points > 0 && Math.random() < config.powerups.spawnChance) PowerupManager.spawn(x, y);
        ad.element.classList.add('destroy');
        setTimeout(() => ad.element.remove(), 300); state.activeAds.delete(ad.id);
        if (!state.bossActive && state.activeAds.size === 0 && state.gameRunning) Game.startNextWave();
    },
    getAllAds: () => Array.from(state.activeAds.values()),
    clearAll: () => { AdManager.getAllAds().forEach(ad => { ad.timers.forEach(clearTimeout); ad.element.remove(); }); state.activeAds.clear(); }
};

// =================================================================================
// --- SPAWNER & GAME LOGIC ---
// =================================================================================
const Spawner = {
    generateWave(waveNumber) {
        const budget = config.wave.baseThreat + (waveNumber * config.wave.threatPerWave); let currentBudget = budget;
        const spawnList = []; const availableAds = Object.entries(AdManager.adDefinitions);
        while (currentBudget > 0 && spawnList.length < 15) {
            const affordable = availableAds.filter(([, def]) => def.threat <= currentBudget);
            if (affordable.length === 0) break;
            const [type, def] = affordable[Math.floor(Math.random() * affordable.length)];
            spawnList.push(type); currentBudget -= def.threat;
        }
        return spawnList;
    },
    spawnWave(waveNumber) {
        // Boss logic would go here
        const adsToSpawn = this.generateWave(waveNumber);
        UI.showWaveAlert(`THREAT LEVEL ${waveNumber}`);
        adsToSpawn.forEach((type, i) => setTimeout(() => { if(state.gameRunning) AdManager.spawn(type); }, 1000 + i * 400));
    }
};

const Game = {
    init() { DOMElements.startButton.onclick = () => this.start(); DOMElements.restartButton.onclick = () => this.start(); Player.init(); },
    start() {
        Object.assign(state, { gameRunning: true, score: 0, wave: 0, health: config.player.maxHealth, shield: { active: false, onCooldown: false }, playerInvincible: false, bossActive: false, scoreMultiplier: 1, systemFrozen: false });
        AdManager.clearAll(); PowerupManager.clearAll();
        DOMElements.startScreen.style.display = 'none'; DOMElements.gameOverScreen.style.display = 'none';
        UI.updateHealthBar(); UI.updateScore(); UI.updateAbilityDisplay('ONLINE');
        this.startNextWave();
    },
    end() {
        state.gameRunning = false;
        DOMElements.finalScore.textContent = state.score; DOMElements.finalWave.textContent = state.wave;
        DOMElements.gameOverScreen.style.display = 'flex';
    },
    startNextWave() {
        state.wave++; UI.updateWave();
        setTimeout(() => Spawner.spawnWave(state.wave), 500);
    }
};

// --- INITIALIZE GAME ---
Game.init();
