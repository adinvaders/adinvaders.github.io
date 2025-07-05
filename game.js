// --- CONFIG & GAME STATE ---
const config = {
    player: { maxHealth: 100, shieldDuration: 2000, shieldCooldown: 5000, iFrameDuration: 500 },
    game: { waveStartDelay: 3000, bossWaveInterval: 5 },
    powerups: { spawnChance: 0.15, ironCursorDuration: 5000 },
    wave: { baseThreat: 50, threatPerWave: 25 }
};
let state = { gameRunning: false, score: 0, wave: 0, health: config.player.maxHealth, shield: { active: false, onCooldown: false }, powerups: { ironCursorActive: false }, playerInvincible: false, activeAds: new Map(), activePowerups: new Set(), mouseX: 0, mouseY: 0, bossActive: false };

// --- DOM ELEMENTS ---
// (Same as previous version)
const DOMElements = {
    gameContainer: document.getElementById('game-container'),
    gameScreen: document.getElementById('game-screen'),
    vignette: document.getElementById('vignette'),
    /* ... other elements ... */
};
// ... (rest of DOM elements from previous version)

// ... (Player, UI, PowerupManager modules are mostly the same, with minor tweaks)

// --- UI Module Tweak ---
const UI = {
    //...
    flashDamage() {
        DOMElements.gameContainer.classList.add('damage-flash');
        setTimeout(() => DOMElements.gameContainer.classList.remove('damage-flash'), 200);
    },
    //...
}

// =================================================================================
// --- AD FACTORY & MANAGER (MAJOR UPDATE) ---
// =================================================================================
const AdManager = {
    adDefinitions: {
        // ... (previous ads would be here, restyled)
        chatAd: {
            threat: 22,
            points: 350,
            create: () => AdManager.createAd('chat-ad', {
                title: 'LiveSupport Bot',
                closeable: false,
                init: (ad) => {
                    const log = ad.element.querySelector('.chat-log');
                    const endButton = ad.element.querySelector('.ad-btn');
                    endButton.disabled = true;

                    const messages = [
                        { author: 'Bot', text: 'Connecting to secure server...' },
                        { author: 'Bot', text: 'Hello, I am a certified support technician.' },
                        { author: 'Bot', text: 'Your system has sent us 17 critical error signals.' },
                        { author: 'Bot', text: 'You must install our security patch immediately.' },
                        { author: 'Bot', text: 'Download link generating now...', isLink: true }
                    ];

                    let messageIndex = 0;
                    ad.timers = [];

                    const typeMessage = () => {
                        if (messageIndex >= messages.length || !state.activeAds.has(ad.id)) return;
                        
                        const msg = messages[messageIndex];
                        const typingEl = log.querySelector('.typing-indicator');
                        if (typingEl) typingEl.remove();

                        const msgEl = document.createElement('div');
                        msgEl.className = `message ${msg.author.toLowerCase()}`;
                        msgEl.textContent = `${msg.author}: ${msg.text}`;
                        log.appendChild(msgEl);
                        log.scrollTop = log.scrollHeight;

                        if (msg.isLink) {
                            // This is the final message, start damage timer
                            ad.damageTimer = setTimeout(() => Player.takeDamage(25), 2000);
                            ad.timers.push(ad.damageTimer);
                            msgEl.style.color = 'var(--danger-color)';
                        } else {
                           // Add next typing indicator
                           const typingTimer = setTimeout(() => {
                                const newTypingEl = document.createElement('div');
                                newTypingEl.className = 'typing-indicator';
                                newTypingEl.textContent = 'Bot is typing...';
                                log.appendChild(newTypingEl);
                                log.scrollTop = log.scrollHeight;
                           }, 800);
                           ad.timers.push(typingTimer);
                        }

                        messageIndex++;
                        if (messageIndex < messages.length) {
                             const nextTimer = setTimeout(typeMessage, 2000);
                             ad.timers.push(nextTimer);
                        }
                    };

                    const firstTimer = setTimeout(typeMessage, 1000);
                    const enableButtonTimer = setTimeout(() => { endButton.disabled = false; }, 4000);
                    ad.timers.push(firstTimer, enableButtonTimer);

                    endButton.onclick = (e) => {
                        e.stopPropagation();
                        this.destroyAd(ad, this.adDefinitions.chatAd.points);
                    };
                },
                content: `<div class="chat-log"><div class="typing-indicator">Bot is connecting...</div></div><button class="ad-btn">END CHAT</button>`
            })
        },
        surveyAd: {
            threat: 18,
            points: 200,
            create: () => AdManager.createAd('survey-ad', {
                title: 'You\'ve been selected!',
                closeable: true,
                init: (ad) => {
                    ad.quizData = {
                        currentQ: 0,
                        questions: [
                            { q: 'Which of these is NOT a primary color?', a: ['Red', 'Blue', 'Green', 'Yellow'], correct: 2 },
                            { q: 'What is the capital of France?', a: ['London', 'Paris', 'Berlin', 'Rome'], correct: 1 },
                            { q: 'How many planets are in our Solar System?', a: ['7', '8', '9', '10'], correct: 1 }
                        ]
                    };
                    this.renderSurveyQuestion(ad);
                },
                content: `<div class="survey-content"></div>`
            })
        }
    },
    
    renderSurveyQuestion(ad) {
        const { currentQ, questions } = ad.quizData;
        const questionData = questions[currentQ];
        const contentEl = ad.element.querySelector('.survey-content');

        const optionsHTML = questionData.a.map((option, index) => 
            `<button class="survey-option" data-index="${index}">${option}</button>`
        ).join('');

        const progressHTML = questions.map((_, index) => 
            `<div class="progress-dot ${index < currentQ ? 'complete' : ''}"></div>`
        ).join('');

        contentEl.innerHTML = `
            <div class="survey-question">${questionData.q}</div>
            <div class="survey-options">${optionsHTML}</div>
            <div class="survey-progress">${progressHTML}</div>
        `;

        contentEl.querySelectorAll('.survey-option').forEach(button => {
            button.onclick = (e) => {
                e.stopPropagation();
                const selectedIndex = parseInt(button.dataset.index);
                if (selectedIndex === questionData.correct) {
                    ad.quizData.currentQ++;
                    if (ad.quizData.currentQ >= questions.length) {
                        Player.addScore(50); // Bonus for finishing quiz
                        this.destroyAd(ad, this.adDefinitions.surveyAd.points);
                    } else {
                        this.renderSurveyQuestion(ad);
                    }
                } else {
                    Player.takeDamage(5);
                    UI.flashDamage();
                }
            };
        });
    },

    createAd(className, options) {
        const ad = {
            id: `ad_${Date.now()}_${Math.random()}`,
            element: document.createElement('div'),
            timers: [], // To store timers for cleanup
            ...options
        };
        // ... (rest of createAd is similar to previous version) ...
        
        // Run initializer function if it exists
        if (options.init) {
            options.init(ad);
        }
        
        return ad;
    },

    destroyAd(ad, points) {
        if (!state.activeAds.has(ad.id)) return;

        // Clear any associated timers to prevent errors
        if (ad.timers) {
            ad.timers.forEach(timerId => clearTimeout(timerId));
        }

        const rect = ad.element.getBoundingClientRect();
        if (points > 0) Player.addScore(points, rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (points > 0 && Math.random() < config.powerups.spawnChance) PowerupManager.spawn(rect.left + rect.width / 2, rect.top + rect.height / 2);
        
        ad.element.classList.add('destroy'); // Use class for dissolve animation
        
        setTimeout(() => ad.element.remove(), 300);
        state.activeAds.delete(ad.id);
        
        if (!state.bossActive && state.activeAds.size === 0 && state.gameRunning) {
            Game.startNextWave();
        }
    },
    // ... (rest of AdManager is the same)
};

// ... (Spawner, BossManager, Game logic are mostly the same)

// --- Kick things off ---
// Game.init(); // This would be at the end of the file.
