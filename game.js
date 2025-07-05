document.addEventListener('DOMContentLoaded', () => {
    // --- SETUP ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 900; canvas.height = 700;

    // --- UI & AUDIO ---
    const scoreDisplay = document.getElementById('score-display');
    const healthBar = document.getElementById('health-bar-inner');
    const shieldBar = document.getElementById('shield-bar-inner');
    const startScreen = document.getElementById('start-screen'), gameOverScreen = document.getElementById('game-over-screen');
    const startButton = document.getElementById('startButton'), restartButton = document.getElementById('restartButton');
    const finalScoreDisplay = document.getElementById('finalScore');
    const sounds = {
        hit: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-the-sound-pack-tree/tspt_computer_mouse_click_single_002.mp3'),
        destroy: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-BFG-sound-effects/BFG_ui_generic_button_click_delete_hard_001.mp3'),
        damage: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-four-stones/fs_ui_jingle_negative_02_082.mp3'),
        powerup: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-four-stones/fs_ui_jingle_positive_01_091.mp3'),
        fakeClick: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-46416/zapsplat_multimedia_button_press_plastic_click_002_47805.mp3')
    };
    const playSound = (sound) => sound.cloneNode().play();

    // --- GAME STATE & PLAYER ---
    let state = {};
    const player = { shield: {}, powerups: {} };

    function resetState() {
        state = {
            score: 0, health: 100, gameOver: false, gameRunning: false,
            mouse: { x: canvas.width / 2, y: canvas.height / 2, targetX: canvas.width / 2, targetY: canvas.height / 2 },
            ads: [], powerups: [], particles: [],
            adSpawnTimer: 120, difficultyMultiplier: 1,
            targetSlowdown: 0, currentSlowdown: 0,
            damageFlash: 0
        };
        Object.assign(player, {
            shield: { active: false, autoActive: false, autoDuration: 0, radius: 40, rechargeTimer: 0, maxRecharge: 250 },
            powerups: { superClick: false }
        });
    }

    // --- EVENT LISTENERS ---
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        state.mouse.targetX = e.clientX - rect.left;
        state.mouse.targetY = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', e => {
        e.preventDefault();
        if (e.button === 0) handleLeftClick();
        if (e.button === 2 && player.shield.rechargeTimer <= 0 && !player.shield.autoActive) player.shield.active = true;
    });
    canvas.addEventListener('mouseup', e => {
        e.preventDefault();
        if (e.button === 2 && player.shield.active) {
            player.shield.active = false;
            player.shield.rechargeTimer = player.shield.maxRecharge;
        }
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);

    // --- GAME FLOW & UI ---
    function startGame() {
        resetState();
        updateUI();
        startScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
        state.gameRunning = true;
        gameLoop();
    }
    function endGame() {
        state.gameOver = true; state.gameRunning = false;
        finalScoreDisplay.textContent = state.score;
        gameOverScreen.style.display = 'flex';
    }
    function updateUI() {
        scoreDisplay.textContent = `SCORE: ${state.score}`;
        healthBar.style.width = `${state.health}%`;
        const shieldCharge = 100 - (player.shield.rechargeTimer / player.shield.maxRecharge) * 100;
        shieldBar.style.width = `${shieldCharge}%`;
    }

    // --- CORE MECHANICS ---
    function takeDamage(amount) {
        if (player.shield.active || player.shield.autoActive) return;
        state.health = Math.max(0, state.health - amount);
        playSound(sounds.damage);
        state.damageFlash = 15; // Flash for 15 frames
        updateUI();
        if (state.health <= 0) endGame();
    }
    function createDestructionParticles(x, y, color) {
        for (let i = 0; i < 20; i++) particles.push(new DestructionParticle(x, y, color));
    }
    function handleLeftClick() {
        for (let i = state.powerups.length - 1; i >= 0; i--) {
            if (isPointInRect(state.mouse, state.powerups[i])) {
                state.powerups[i].activate(); state.powerups.splice(i, 1); return;
            }
        }
        for (let i = state.ads.length - 1; i >= 0; i--) {
            const ad = state.ads[i];
            const superClickDestroy = player.powerups.superClick && isPointInRect(state.mouse, ad);
            if (ad.fakeCloseButton && isPointInRect(state.mouse, ad.fakeCloseButton)) {
                takeDamage(ad.clickDamage * 2); playSound(sounds.fakeClick); break;
            }
            if (superClickDestroy || (ad.closeButton && isPointInRect(state.mouse, ad.closeButton))) {
                state.score += ad.points;
                playSound(sounds.destroy);
                createDestructionParticles(ad.x + ad.width / 2, ad.y + ad.height / 2, ad.color);
                state.ads.splice(i, 1);
                if (player.powerups.superClick) player.powerups.superClick = false;
                break;
            } else if (ad.takeHit && isPointInRect(state.mouse, ad)) {
                ad.takeHit(); break;
            } else if (isPointInRect(state.mouse, ad)) {
                takeDamage(ad.clickDamage); playSound(sounds.hit); break;
            }
        }
        updateUI();
    }
    function spawnAd() {
        const adType = Math.random();
        const x = Math.random() * (canvas.width - 400) + 20;
        const y = Math.random() * (canvas.height - 300) + 20;

        if (adType < 0.35) state.ads.push(new PopupAd(x, y, state.difficultyMultiplier));
        else if (adType < 0.55) state.ads.push(new VideoAd(x, y));
        else if (adType < 0.7) state.ads.push(new CookieConsentStack(x, y));
        else if (adType < 0.85) state.ads.push(new FakeVirusAlert());
        else state.ads.push(new BannerAd());
    }
    function spawnPowerup() {
        if (state.powerups.length === 0 && Math.random() < 0.005) {
            const x = Math.random() * (canvas.width - 60), y = Math.random() * (canvas.height - 60);
            const type = ['BOMB', 'AUTO_SHIELD', 'SUPER_CLICK'][Math.floor(Math.random() * 3)];
            state.powerups.push(new Powerup(x, y, type));
        }
    }
    const isPointInRect = (point, rect) => point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height;

    // --- CLASSES (REDESIGNED) ---
    class PopupAd {
        constructor(x, y, difficulty) {
            this.x = x; this.y = y; this.width = 320; this.height = 180;
            this.clickDamage = 5; this.points = 10; this.color = '#fff';
            this.title = ["Congratulations!", "Claim Your Reward", "System Alert"][Math.floor(Math.random() * 3)];
            this.message = ["You've been selected to receive a FREE gift card.", "Click now to claim an exclusive offer, limited time only.", "Your system requires an immediate security scan."][Math.floor(Math.random() * 3)];
            // Harder difficulty introduces fake close buttons
            this.hasFakeCloseButton = difficulty > 1.5 && Math.random() < 0.5;
            if (this.hasFakeCloseButton) {
                this.fakeCloseButton = { x: this.x + this.width - 28, y: this.y + 8, width: 20, height: 20 };
                this.closeButton = { x: this.x + 5, y: this.y + 5, width: 10, height: 10 }; // Real one is tiny
            } else {
                this.closeButton = { x: this.x + this.width - 28, y: this.y + 8, width: 20, height: 20 };
            }
        }
        update() {}
        draw(ctx) {
            ctx.fillStyle = this.color; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
            ctx.fillRect(this.x, this.y, this.width, this.height); ctx.shadowBlur = 0;
            ctx.fillStyle = '#f0f0f0'; ctx.fillRect(this.x, this.y, this.width, 36);
            ctx.fillStyle = '#333'; ctx.font = "bold 14px 'Inter'"; ctx.textAlign = 'left';
            ctx.fillText(this.title, this.x + 15, this.y + 24);
            ctx.font = "14px 'Inter'"; ctx.textAlign = 'center';
            ctx.fillText(this.message, this.x + this.width / 2, this.y + 90);
            
            // Draw real close button
            ctx.fillStyle = '#ddd';
            ctx.fillRect(this.closeButton.x, this.closeButton.y, this.closeButton.width, this.closeButton.height);
            ctx.strokeStyle = '#555'; ctx.lineWidth = this.hasFakeCloseButton ? 1 : 2; ctx.textAlign = 'center';
            ctx.strokeText('X', this.closeButton.x + this.closeButton.width/2, this.closeButton.y + this.closeButton.height*0.75);
            
            // Draw fake one if it exists
            if (this.hasFakeCloseButton) {
                ctx.fillStyle = '#e8e8e8';
                ctx.fillRect(this.fakeCloseButton.x, this.fakeCloseButton.y, this.fakeCloseButton.width, this.fakeCloseButton.height);
                ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
                ctx.strokeText('X', this.fakeCloseButton.x + 10, this.fakeCloseButton.y + 15);
            }
        }
    }

    class VideoAd {
        constructor(x, y) {
            this.x = x; this.y = y; this.width = 380; this.height = 210;
            this.clickDamage = 10; this.points = 25; this.color = '#000';
            this.progress = 0;
            this.closeButton = { x: this.x + this.width - 95, y: this.y + this.height - 40, width: 80, height: 25 };
        }
        update() { this.progress = (this.progress + 0.2) % 100; }
        draw(ctx) {
            ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.font = "16px 'Inter'"; ctx.fillStyle = '#ccc'; ctx.textAlign = 'center';
            ctx.fillText("An ad is playing...", this.x + this.width / 2, this.y + this.height / 2);
            // Progress Bar
            ctx.fillStyle = '#444'; ctx.fillRect(this.x + 10, this.y + this.height - 15, this.width - 20, 5);
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(this.x + 10, this.y + this.height - 15, (this.width - 20) * (this.progress/100), 5);
            // Skip Button
            ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(this.closeButton.x, this.closeButton.y, this.closeButton.width, this.closeButton.height);
            ctx.fillStyle = '#aaa'; ctx.font = "12px 'Inter'";
            ctx.fillText("Skip Ad >", this.closeButton.x + 40, this.closeButton.y + 17);
        }
    }

    class CookieConsentStack {
        constructor(x, y) {
            this.x = x; this.y = y; this.width = 350; this.height = 160;
            this.clickDamage = 2; this.points = 50; this.layers = 3;
            this.slowFactor = 0.6; this.color = '#333842';
            this.button = { x: this.x + 185, y: this.y + 105, width: 140, height: 35 };
            this.messages = ["Accept All", "Confirm Preferences", "Acknowledge"];
        }
        takeHit() {
            if (isPointInRect(state.mouse, this.button)) {
                this.layers--; playSound(sounds.hit);
                if (this.layers <= 0) {
                    state.score += this.points; playSound(sounds.destroy);
                    createDestructionParticles(this.x + this.width / 2, this.y + this.height / 2, this.color);
                    state.ads = state.ads.filter(ad => ad !== this);
                }
            } else takeDamage(this.clickDamage);
        }
        update() {
            state.targetSlowdown = isPointInRect(state.mouse, this) ? this.slowFactor : 0;
        }
        draw(ctx) {
            ctx.fillStyle = this.color; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
            ctx.fillRect(this.x, this.y, this.width, this.height); ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff'; ctx.font = "bold 16px 'Poppins'"; ctx.textAlign = 'left';
            ctx.fillText("We use cookies to enhance your experience.", this.x + 20, this.y + 40);
            ctx.fillStyle = '#6c63ff'; ctx.fillRect(this.button.x, this.button.y, this.button.width, this.button.height);
            ctx.fillStyle = 'white'; ctx.font = "bold 14px 'Inter'"; ctx.textAlign = 'center';
            ctx.fillText(this.messages[this.layers - 1], this.button.x + this.button.width / 2, this.button.y + 22);
        }
    }
    
    class FakeVirusAlert {
        constructor() {
            this.width = 400; this.height = 120;
            this.x = Math.random() < 0.5 ? -this.width : canvas.width;
            this.y = Math.random() * (canvas.height - this.height);
            this.speed = (0.8 + Math.random() * 0.5) * state.difficultyMultiplier;
            this.contactDamage = 20; this.clickDamage = 15; this.points = 40;
            this.color = '#1E2D3F';
            this.closeButton = { x: this.x + this.width - 25, y: this.y + 5, width: 20, height: 20 };
            this.wobble = Math.random() * 100;
        }
        update() {
            const angle = Math.atan2(state.mouse.y - (this.y + this.height/2), state.mouse.x - (this.x + this.width/2));
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed + Math.sin(this.wobble) * 0.5;
            this.wobble += 0.1;
            this.closeButton.x = this.x + this.width - 25; this.closeButton.y = this.y + 5;
            if (isPointInRect(state.mouse, this)) takeDamage(this.contactDamage * 0.1);
        }
        draw(ctx) {
            ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#D9534F'; ctx.font = "bold 24px 'Poppins'"; ctx.textAlign = 'left';
            ctx.fillText("!", this.x + 20, this.y + 60);
            ctx.fillStyle = '#fff'; ctx.font = "bold 16px 'Inter'";
            ctx.fillText("Security Threat Detected", this.x + 50, this.y + 45);
            ctx.font = "14px 'Inter'"; ctx.fillStyle = '#ccc';
            ctx.fillText("Windows Defender found 5 viruses. Immediate action required.", this.x + 50, this.y + 70);
            ctx.fillStyle = '#aaa'; ctx.fillRect(this.closeButton.x, this.closeButton.y, this.closeButton.width, this.closeButton.height);
            ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.textAlign = 'center';
            ctx.strokeText('X', this.closeButton.x + 10, this.closeButton.y + 15);
        }
    }

    // Unchanged classes (BannerAd, Particles, Powerup) with minor style tweaks
    class BannerAd { /* ... (code from previous version, largely unchanged) ... */
        constructor() {
            this.width = canvas.width; this.height = 80; this.x = 0;
            this.y = Math.random() > 0.5 ? -this.height : canvas.height;
            this.vy = (this.y < 0) ? (1.5 + Math.random()) * state.difficultyMultiplier : (-1.5 - Math.random()) * state.difficultyMultiplier;
            this.contactDamage = 15; this.clickDamage = 10; this.points = 0;
            this.color1 = `hsl(${Math.random() * 360}, 100%, 50%)`;
            this.color2 = `hsl(${Math.random() * 360}, 100%, 50%)`;
            this.closeButton = null;
        }
        update() { this.y += this.vy; if (isPointInRect(state.mouse, this)) takeDamage(this.contactDamage * 0.2); }
        draw(ctx) {
            let gradient = ctx.createLinearGradient(0, this.y, 0, this.y + this.height);
            gradient.addColorStop(0, this.color1); gradient.addColorStop(1, this.color2);
            ctx.fillStyle = gradient; ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'white'; ctx.font = "bold 40px 'Poppins'"; ctx.textAlign = 'center'; ctx.shadowColor = 'black'; ctx.shadowBlur = 10;
            ctx.fillText(">>> UNMISSABLE DEALS! CLICK NOW! <<<", this.x + this.width / 2, this.y + 55);
            ctx.shadowBlur = 0;
        }
    }
    class DestructionParticle { /* ... (code from previous version) ... */ 
        constructor(x, y, color) {
            this.x = x; this.y = y;
            this.vx = (Math.random() - 0.5) * 5; this.vy = (Math.random() - 0.5) * 5;
            this.lifespan = 50; this.radius = Math.random() * 3 + 1; this.color = color;
        }
        update() { this.x += this.vx; this.y += this.vy; this.vy += 0.05; this.lifespan--; }
        draw(ctx) {
            ctx.fillStyle = this.color; ctx.globalAlpha = this.lifespan / 50;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI); ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
    class Powerup { /* ... (code from previous version) ... */ 
        constructor(x, y, type) {
            this.x = x; this.y = y; this.width = 50; this.height = 50; this.type = type;
            this.colors = { 'BOMB': '#ff3d3d', 'AUTO_SHIELD': '#00d4ff', 'SUPER_CLICK': '#ff00ff' };
            this.text = { 'BOMB': 'BOMB', 'AUTO_SHIELD': 'SHLD', 'SUPER_CLICK': 'CLCK' };
        }
        activate() { /* Unchanged */
            playSound(sounds.powerup);
            switch (this.type) {
                case 'BOMB':
                    state.ads = state.ads.filter(ad => ad instanceof BannerAd || ad instanceof FakeVirusAlert);
                    state.score += 50;
                    break;
                case 'AUTO_SHIELD':
                    player.shield.autoActive = true;
                    player.shield.autoDuration = 300; // 5 seconds at 60fps
                    break;
                case 'SUPER_CLICK':
                    player.powerups.superClick = true;
                    break;
            }
        }
        draw(ctx) {
            ctx.fillStyle = this.colors[this.type]; ctx.shadowColor = this.colors[this.type]; ctx.shadowBlur = 15;
            ctx.fillRect(this.x, this.y, this.width, this.height); ctx.shadowBlur = 0;
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.strokeRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'white'; ctx.font = "bold 20px 'Poppins'"; ctx.textAlign = 'center';
            ctx.fillText(this.text[this.type], this.x + 25, this.y + 33);
        }
    }
    
    // --- MAIN GAME LOOP ---
    function gameLoop() {
        if (state.gameOver) return;
        // --- UPDATE ---
        state.adSpawnTimer--;
        if (state.adSpawnTimer <= 0) {
            spawnAd();
            state.difficultyMultiplier += 0.05; // Ramps up faster
            state.adSpawnTimer = Math.max(15, 120 / state.difficultyMultiplier);
        }
        spawnPowerup();

        // **Smooth Cursor Logic**
        state.targetSlowdown = 0;
        state.ads.forEach(ad => ad.update());
        state.currentSlowdown += (state.targetSlowdown - state.currentSlowdown) * 0.1;
        state.mouse.x += (state.mouse.targetX - state.mouse.x) * (1 - state.currentSlowdown);
        state.mouse.y += (state.mouse.targetY - state.mouse.y) * (1 - state.currentSlowdown);
        
        for (let i = state.particles.length - 1; i >= 0; i--) {
            state.particles[i].update(); if (state.particles[i].lifespan <= 0) state.particles.splice(i, 1);
        }
        state.ads = state.ads.filter(ad => !(ad instanceof BannerAd) || (ad.y < canvas.height && ad.y > -ad.height));
        if (player.shield.rechargeTimer > 0) player.shield.rechargeTimer--;
        if (player.shield.autoDuration > 0) player.shield.autoDuration--; else player.shield.autoActive = false;
        if (state.damageFlash > 0) state.damageFlash--;
        updateUI();

        // --- DRAW ---
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.classList.toggle('damage-flash', state.damageFlash > 0);
        state.ads.forEach(ad => ad.draw(ctx));
        state.particles.forEach(p => p.draw(ctx));
        state.powerups.forEach(p => p.draw(ctx));

        // Draw Player Shield
        if (player.shield.active || player.shield.autoActive) {
            const shieldColor = player.shield.autoActive ? 'rgba(0, 255, 100, 0.2)' : 'rgba(0, 200, 255, 0.2)';
            ctx.fillStyle = shieldColor; ctx.strokeStyle = player.shield.autoActive ? 'lime' : 'cyan'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(state.mouse.x, state.mouse.y, player.shield.radius, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }
        
        // Draw Custom Cursor
        const cursorColor = player.powerups.superClick ? '#ff00ff' : '#fff';
        ctx.strokeStyle = cursorColor; ctx.lineWidth = 2;
        ctx.shadowColor = cursorColor; ctx.shadowBlur = player.powerups.superClick ? 10 : 0;
        ctx.beginPath();
        ctx.moveTo(state.mouse.x - 8, state.mouse.y); ctx.lineTo(state.mouse.x + 8, state.mouse.y);
        ctx.moveTo(state.mouse.x, state.mouse.y - 8); ctx.lineTo(state.mouse.x, state.mouse.y + 8);
        ctx.stroke(); ctx.shadowBlur = 0;

        if (state.gameRunning) requestAnimationFrame(gameLoop);
    }
});
