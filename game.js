document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const gameContainer = document.getElementById('game-container');
    const playerCursor = document.getElementById('player-cursor');
    const playerShield = document.getElementById('player-shield');
    const healthBar = document.getElementById('health-bar');
    const scoreValue = document.getElementById('score-value');
    const waveValue = document.getElementById('wave-value');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const startButton = document.getElementById('start-button');
    const restartButton = document.getElementById('restart-button');
    const finalScore = document.getElementById('final-score');
    const finalWave = document.getElementById('final-wave');
    
    // --- Sound Effects ---
    const sfx = {
        click: document.getElementById('sfx-click'),
        error: document.getElementById('sfx-error'),
        shield: document.getElementById('sfx-shield'),
        damage: document.getElementById('sfx-damage'),
        destroy: document.getElementById('sfx-destroy'),
        bomb: document.getElementById('sfx-bomb')
    };

    // --- Game State ---
    let gameState = {
        score: 0,
        wave: 0,
        health: 100,
        isGameOver: true,
        shield: {
            active: false,
            cooldown: false,
            duration: 2000, // 2 seconds
            cooldownTime: 5000 // 5 seconds
        },
        ironCursor: {
            active: false,
            duration: 5000 // 5 seconds
        },
        cursorPos: { x: 0, y: 0 },
        gameLoopId: null,
        activeAds: [],
        activePowerUps: []
    };

    // --- Game Configuration ---
    const config = {
        damage: {
            touch: 0.2,
            misclick: 5,
            fakeDownload: 20
        },
        points: {
            destroyAd: 100
        },
        wave: {
            baseSpawnInterval: 2500, // ms
            intervalDecrement: 100,
            adsPerWave: 5
        }
    };

    // --- AD TEMPLATES & BEHAVIORS ---
    const adTemplates = [
        {
            type: 'popup',
            width: 350,
            height: 200,
            title: '!! CONGRATULATIONS !!',
            content: `<h3>You're the 1,000,000th Visitor!</h3><p>Click below to claim your <strong>FREE</strong> iPhone!</p><div class="fake-download-button">DOWNLOAD</div>`,
            behavior: (ad) => { /* Standard behavior */ }
        },
        {
            type: 'popup',
            width: 300,
            height: 250,
            title: 'Local Singles Alert!',
            content: `<h3>Meet Hot Ghosts Near You!</h3><p>They're dying to meet you. Don't leave them waiting.</p><img src="https://via.placeholder.com/150x80.png/000000/FFFFFF?text=👻" alt="ghost">`,
            behavior: (ad) => { // Moving close button
                const closeBtn = ad.element.querySelector('.close-button');
                ad.vx = ad.vx || (Math.random() > 0.5 ? 0.5 : -0.5);
                ad.vy = ad.vy || (Math.random() > 0.5 ? 0.5 : -0.5);
                let btnX = parseFloat(closeBtn.style.right) || 0;
                let btnY = parseFloat(closeBtn.style.top) || 0;
                if (btnX > 20 || btnX < -20) ad.vx *= -1;
                if (btnY > 10 || btnY < -10) ad.vy *= -1;
                closeBtn.style.position = 'relative';
                closeBtn.style.right = `${btnX + ad.vx}px`;
                closeBtn.style.top = `${btnY + ad.vy}px`;
            }
        },
        {
            type: 'banner',
            height: 80,
            title: 'BANNER',
            content: `<span>>>> ENLARGE YOUR CURSOR! CLICK NOW FOR BIGGAH POINTERS! <<<</span>`,
            behavior: (ad) => {
                ad.x += ad.vx;
                if (ad.x > gameContainer.offsetWidth || ad.x < -ad.element.offsetWidth) {
                    ad.vx *= -1;
                }
                ad.element.style.left = `${ad.x}px`;
            }
        },
        {
            type: 'virus',
            width: 280,
            height: 150,
            title: '⚠️ VIRUS WARNING ⚠️',
            content: `<h3>Your PC is Infected!</h3><p>Error #268D3. Critical security risk detected. Immediate action required!</p>`,
            behavior: (ad) => { // Chase cursor
                const speed = 0.8;
                const dx = gameState.cursorPos.x - (ad.x + ad.width / 2);
                const dy = gameState.cursorPos.y - (ad.y + ad.height / 2);
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 1) {
                    ad.x += (dx / dist) * speed;
                    ad.y += (dy / dist) * speed;
                    ad.element.style.left = `${ad.x}px`;
                    ad.element.style.top = `${ad.y}px`;
                }
            }
        },
        {
            type: 'trap',
            width: 300,
            height: 180,
            title: 'Free RAM Download',
            content: `<h3>Need More Speed?</h3><p>Download our free RAM expansion tool. 100% legitimate.</p>`,
            onClose: (ad) => { // Multiply on close
                for (let i = 0; i < 2; i++) {
                    spawnAd('popup');
                }
            }
        }
    ];

    // --- POWER-UP DEFINITIONS ---
    const powerUpTypes = [
        { 
            type: 'bomb', 
            emoji: '💣',
            onCollect: () => {
                playSound(sfx.bomb);
                gameState.activeAds.forEach(ad => {
                    ad.element.remove();
                    updateScore(config.points.destroyAd / 2); // Less points for a bomb
                });
                gameState.activeAds = [];
            }
        },
        {
            type: 'iron-cursor',
            emoji: '🛡️',
            onCollect: () => {
                playSound(sfx.shield);
                gameState.ironCursor.active = true;
                playerCursor.style.backgroundColor = 'silver';
                setTimeout(() => {
                    gameState.ironCursor.active = false;
                    playerCursor.style.backgroundColor = 'transparent';
                }, gameState.ironCursor.duration);
            }
        }
    ];

    // ===================================================================
    // --- PLAYER & CONTROLS ---
    // ===================================================================

    function updateCursor(e) {
        const rect = gameContainer.getBoundingClientRect();
        gameState.cursorPos.x = e.clientX - rect.left;
        gameState.cursorPos.y = e.clientY - rect.top;

        playerCursor.style.transform = `translate(${gameState.cursorPos.x}px, ${gameState.cursorPos.y}px)`;
        if (gameState.shield.active) {
            playerShield.style.left = `${gameState.cursorPos.x}px`;
            playerShield.style.top = `${gameState.cursorPos.y}px`;
        }
    }

    function handleLeftClick(e) {
        if (gameState.isGameOver) return;

        const target = e.target;
        if (target.classList.contains('close-button')) {
            playSound(sfx.destroy);
            const adElement = target.closest('.ad');
            const adInstance = gameState.activeAds.find(ad => ad.element === adElement);
            if (adInstance) {
                destroyAd(adInstance);
            }
        } else if (target.classList.contains('fake-download-button')) {
            takeDamage(config.damage.fakeDownload, 'Misclick!');
        } else if (target.closest('.ad')) {
            // Clicked inside an ad but not on a button
            takeDamage(config.damage.misclick, 'Misclick!');
        } else if (target.classList.contains('power-up')) {
            const powerUp = gameState.activePowerUps.find(p => p.element === target);
            if (powerUp) collectPowerUp(powerUp);
        }
    }

    function handleRightClick(e) {
        e.preventDefault();
        if (gameState.isGameOver || gameState.shield.active || gameState.shield.cooldown) return;

        playSound(sfx.shield);
        gameState.shield.active = true;
        gameState.shield.cooldown = true;
        playerShield.style.display = 'block';
        playerShield.style.opacity = 1;

        setTimeout(() => {
            gameState.shield.active = false;
            playerShield.style.opacity = 0;
            setTimeout(() => playerShield.style.display = 'none', 200);
        }, gameState.shield.duration);

        setTimeout(() => {
            gameState.shield.cooldown = false;
        }, gameState.shield.cooldownTime);
    }

    function takeDamage(amount, reason = '') {
        if (gameState.shield.active || gameState.ironCursor.active) return;

        playSound(sfx.damage);
        gameState.health -= amount;
        if (gameState.health < 0) gameState.health = 0;
        updateUI();

        if (gameState.health <= 0) {
            endGame();
        }
    }
    
    // ===================================================================
    // --- AD MANAGEMENT ---
    // ===================================================================

    function spawnAd(forceType = null) {
        let template;
        if (forceType) {
            template = adTemplates.find(t => t.type === forceType);
        } else {
            template = adTemplates[Math.floor(Math.random() * adTemplates.length)];
        }

        const adElement = document.createElement('div');
        adElement.classList.add('ad', template.type);
        adElement.style.width = `${template.width || 300}px`;
        adElement.style.height = `${template.height || 200}px`;

        const titleBar = `<div class="ad-title-bar"><span>${template.title}</span><div class="close-button">X</div></div>`;
        adElement.innerHTML = titleBar + `<div class="ad-content">${template.content}</div>`;

        const gameRect = gameContainer.getBoundingClientRect();
        const ad = {
            element: adElement,
            type: template.type,
            behavior: template.behavior,
            onClose: template.onClose,
            width: template.width || 300,
            height: template.height || 200,
            x: Math.random() * (gameRect.width - (template.width || 300)),
            y: Math.random() * (gameRect.height - (template.height || 200)),
            vx: (Math.random() - 0.5) * 2, // for banner
            vy: (Math.random() - 0.5) * 2
        };
        
        if (ad.type === 'banner') {
            ad.y = Math.random() > 0.5 ? 0 : gameRect.height - ad.height;
            ad.x = ad.vx > 0 ? -ad.width : gameRect.width;
        }

        ad.element.style.left = `${ad.x}px`;
        ad.element.style.top = `${ad.y}px`;
        
        gameState.activeAds.push(ad);
        gameContainer.appendChild(adElement);
    }
    
    function destroyAd(ad) {
        if (ad.onClose) ad.onClose(ad);

        ad.element.remove();
        gameState.activeAds = gameState.activeAds.filter(a => a !== ad);
        updateScore(config.points.destroyAd);
    }
    
    function updateAds() {
        // Check for collision and update behavior
        gameState.activeAds.forEach(ad => {
            // Behavior update
            if (ad.behavior) ad.behavior(ad);
            
            // Collision check
            const cursorRect = { x: gameState.cursorPos.x, y: gameState.cursorPos.y, width: 1, height: 1 };
            const adRect = ad.element.getBoundingClientRect();
            const gameRect = gameContainer.getBoundingClientRect();

            const isColliding = cursorRect.x < adRect.right - gameRect.left &&
                                cursorRect.x > adRect.left - gameRect.left &&
                                cursorRect.y < adRect.bottom - gameRect.top &&
                                cursorRect.y > adRect.top - gameRect.top;

            if (isColliding) {
                takeDamage(config.damage.touch);
            }
        });
    }

    // ===================================================================
    // --- POWER-UP MANAGEMENT ---
    // ===================================================================
    function spawnPowerUp() {
        const template = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
        const el = document.createElement('div');
        el.classList.add('power-up', template.type);
        el.textContent = template.emoji;
        
        const powerUp = {
            element: el,
            onCollect: template.onCollect,
            x: Math.random() * (gameContainer.clientWidth - 50),
            y: Math.random() * (gameContainer.clientHeight - 50),
        };

        el.style.left = `${powerUp.x}px`;
        el.style.top = `${powerUp.y}px`;

        gameState.activePowerUps.push(powerUp);
        gameContainer.appendChild(el);

        // Make power-up disappear after some time
        setTimeout(() => {
            el.remove();
            gameState.activePowerUps = gameState.activePowerUps.filter(p => p !== powerUp);
        }, 8000);
    }

    function collectPowerUp(powerUp) {
        powerUp.onCollect();
        powerUp.element.remove();
        gameState.activePowerUps = gameState.activePowerUps.filter(p => p !== powerUp);
    }

    // ===================================================================
    // --- GAME LOOP & STATE MANAGEMENT ---
    // ===================================================================

    let adSpawnCounter = 0;
    let waveManagerCounter = 0;

    function gameLoop() {
        if (gameState.isGameOver) {
            cancelAnimationFrame(gameState.gameLoopId);
            return;
        }

        // --- Updates ---
        updateAds();

        // --- Spawning ---
        const spawnInterval = Math.max(500, config.wave.baseSpawnInterval - (gameState.wave * config.wave.intervalDecrement));
        adSpawnCounter += 16; // approximate ms per frame
        if (adSpawnCounter >= spawnInterval) {
            adSpawnCounter = 0;
            spawnAd();
        }
        
        // --- Wave Management ---
        if (gameState.score >= gameState.wave * (config.points.destroyAd * config.wave.adsPerWave)) {
             nextWave();
        }

        gameState.gameLoopId = requestAnimationFrame(gameLoop);
    }
    
    function nextWave() {
        gameState.wave++;
        // Spawn a power-up every few waves
        if (gameState.wave % 3 === 0) {
            spawnPowerUp();
        }
        // Could trigger boss battles here
        if (gameState.wave % 5 === 0 && gameState.wave > 0) {
            console.log("BOSS BATTLE TRIGGER!");
            // Boss logic would go here
        }
        updateUI();
    }

    function updateScore(amount) {
        gameState.score += amount;
        updateUI();
    }

    function updateUI() {
        scoreValue.textContent = gameState.score;
        waveValue.textContent = gameState.wave;
        const healthPercentage = (gameState.health / 100);
        healthBar.style.width = `${healthPercentage * 100}%`;
        // Change color based on health
        healthBar.style.backgroundPosition = `${100 - (healthPercentage * 100)}% 0%`;
    }

    function playSound(audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(e => console.log("Audio play failed, user interaction needed."));
    }

    function startGame() {
        // Reset state
        gameState.score = 0;
        gameState.wave = 1;
        gameState.health = 100;
        gameState.isGameOver = false;
        gameState.shield.active = false;
        gameState.shield.cooldown = false;
        gameState.activeAds.forEach(ad => ad.element.remove());
        gameState.activeAds = [];
        gameState.activePowerUps.forEach(p => p.element.remove());
        gameState.activePowerUps = [];
        adSpawnCounter = 0;
        
        updateUI();
        
        // Hide screens
        startScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
        
        // Start game
        gameLoop();
    }

    function endGame() {
        gameState.isGameOver = true;
        cancelAnimationFrame(gameState.gameLoopId);
        
        // Show game over screen
        finalScore.textContent = gameState.score;
        finalWave.textContent = gameState.wave;
        gameOverScreen.style.display = 'flex';
    }

    // --- Event Listeners ---
    document.addEventListener('mousemove', updateCursor);
    gameContainer.addEventListener('click', handleLeftClick);
    gameContainer.addEventListener('contextmenu', handleRightClick);
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);

    // Initial setup
    updateUI();
});
