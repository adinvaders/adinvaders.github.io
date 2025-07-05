document.addEventListener('DOMContentLoaded', () => {
    // --- SETUP ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 900;
    canvas.height = 700;

    // --- UI ELEMENTS ---
    const scoreDisplay = document.getElementById('score-display');
    const healthBar = document.getElementById('health-bar-inner');
    const shieldBar = document.getElementById('shield-bar-inner');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const startButton = document.getElementById('startButton');
    const restartButton = document.getElementById('restartButton');
    const finalScoreDisplay = document.getElementById('finalScore');

    // --- AUDIO ASSETS ---
    const sounds = {
        hit: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-the-sound-pack-tree/tspt_computer_mouse_click_single_002.mp3'),
        destroy: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-BFG-sound-effects/BFG_ui_generic_button_click_delete_hard_001.mp3'),
        damage: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-four-stones/fs_ui_jingle_negative_02_082.mp3'),
        powerup: new Audio('https://www.zapsplat.com/wp-content/uploads/2015/sound-effects-four-stones/fs_ui_jingle_positive_01_091.mp3')
    };
    const playSound = (sound) => sound.cloneNode().play();

    // --- GAME STATE ---
    let score, health, gameOver, gameRunning, mouse, ads, powerups, particles, adSpawnTimer, difficultyMultiplier, cursorSlowdown;

    // --- PLAYER STATE ---
    const player = {
        shield: { active: false, autoActive: false, autoDuration: 0, radius: 40, rechargeTimer: 0, maxRecharge: 200 },
        powerups: { superClick: false }
    };

    // --- EVENT LISTENERS ---
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        let targetX = e.clientX - rect.left;
        let targetY = e.clientY - rect.top;
        mouse.x += (targetX - mouse.x) * (1 - cursorSlowdown);
        mouse.y += (targetY - mouse.y) * (1 - cursorSlowdown);
    });
    canvas.addEventListener('mousedown', e => {
        e.preventDefault();
        if (e.button === 0) handleLeftClick();
        if (e.button === 2 && player.shield.rechargeTimer <= 0) {
            player.shield.active = true;
        }
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

    function resetState() {
        score = 0;
        health = 100;
        gameOver = false;
        ads = [];
        powerups = [];
        particles = [];
        adSpawnTimer = 120;
        difficultyMultiplier = 1;
        cursorSlowdown = 0;
        mouse = { x: canvas.width / 2, y: canvas.height / 2 };
        Object.assign(player.shield, { active: false, autoActive: false, autoDuration: 0, rechargeTimer: 0 });
        player.powerups.superClick = false;
    }

    function startGame() {
        resetState();
        updateUI();
        startScreen.style.display = 'none';
        gameOverScreen.style.display = 'none';
        gameRunning = true;
        gameLoop();
    }

    function endGame() {
        gameOver = true;
        gameRunning = false;
        finalScoreDisplay.textContent = score;
        gameOverScreen.style.display = 'flex';
    }

    function updateUI() {
        scoreDisplay.textContent = `SCORE: ${score}`;
        healthBar.style.width = `${health}%`;
        healthBar.style.backgroundColor = health > 50 ? '#00ff00' : health > 25 ? '#ffff00' : '#ff0000';
        const shieldCharge = 100 - (player.shield.rechargeTimer / player.shield.maxRecharge) * 100;
        shieldBar.style.width = `${shieldCharge}%`;
    }

    function takeDamage(amount) {
        if (player.shield.active || player.shield.autoActive) return;
        health = Math.max(0, health - amount);
        playSound(sounds.damage);
        document.body.classList.add('damage-flash');
        setTimeout(() => document.body.classList.remove('damage-flash'), 150);
        updateUI();
        if (health <= 0) endGame();
    }

    function createDestructionParticles(x, y, color) {
        for (let i = 0; i < 20; i++) {
            particles.push(new DestructionParticle(x, y, color));
        }
    }

    function handleLeftClick() {
        // Check powerups first
        for (let i = powerups.length - 1; i >= 0; i--) {
            if (isPointInRect(mouse, powerups[i])) {
                powerups[i].activate();
                powerups.splice(i, 1);
                return;
            }
        }

        // Check ads
        for (let i = ads.length - 1; i >= 0; i--) {
            const ad = ads[i];
            const superClickDestroy = player.powerups.superClick && isPointInRect(mouse, ad);

            if (superClickDestroy || (ad.closeButton && isPointInRect(mouse, ad.closeButton))) {
                score += ad.points;
                playSound(sounds.destroy);
                createDestructionParticles(ad.x + ad.width / 2, ad.y + ad.height / 2, ad.color);
                ads.splice(i, 1);
                if (player.powerups.superClick) player.powerups.superClick = false;
                break;
            } else if (ad.takeHit && isPointInRect(mouse, ad)) {
                ad.takeHit();
                break;
            } else if (isPointInRect(mouse, ad)) {
                takeDamage(ad.clickDamage);
                playSound(sounds.hit);
                break;
            }
        }
        updateUI();
    }

    function spawnAd() {
        const adType = Math.random();
        const x = Math.random() * (canvas.width - 350);
        const y = Math.random() * (canvas.height - 250);

        if (adType < 0.4) ads.push(new PopupAd(x, y));
        else if (adType < 0.6) ads.push(new VideoAd(x, y));
        else if (adType < 0.75) ads.push(new CookieConsentStack(x, y));
        else if (adType < 0.9) ads.push(new FakeVirusAlert());
        else ads.push(new BannerAd());
    }

    function spawnPowerup() {
        if (powerups.length === 0 && Math.random() < 0.005) {
            const x = Math.random() * (canvas.width - 60);
            const y = Math.random() * (canvas.height - 60);
            const type = ['BOMB', 'AUTO_SHIELD', 'SUPER_CLICK'][Math.floor(Math.random() * 3)];
            powerups.push(new Powerup(x, y, type));
        }
    }

    // --- HELPER FUNCTIONS ---
    const isPointInRect = (point, rect) => point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height;
    const getDistance = (x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    // --- AD CLASSES ---
    class PopupAd {
        constructor(x, y) {
            this.x = x; this.y = y; this.width = 200; this.height = 120;
            this.clickDamage = 5; this.points = 10;
            this.color = `hsl(${Math.random() * 360}, 70%, 80%)`;
            this.closeButton = { x: this.x + this.width - 25, y: this.y + 5, width: 20, height: 20 };
            this.message = ["You've Won a Prize!", "Local Singles In Your Area!", "Your PC is Slow!"][Math.floor(Math.random() * 3)];
        }
        update() {}
        draw(ctx) {
            ctx.fillStyle = this.color; ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
            ctx.fillRect(this.x, this.y, this.width, this.height); ctx.strokeRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'black'; ctx.font = "16px 'Comic Sans MS'"; ctx.textAlign = 'center';
            ctx.fillText(this.message, this.x + this.width / 2, this.y + 60);
            ctx.fillStyle = 'red'; ctx.fillRect(this.closeButton.x, this.closeButton.y, this.closeButton.width, this.closeButton.height);
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.strokeText('X', this.closeButton.x + 10, this.closeButton.y + 15);
        }
    }

    class BannerAd {
        constructor() {
            this.width = canvas.width; this.height = 60; this.x = 0;
            this.y = Math.random() > 0.5 ? -this.height : canvas.height;
            this.vy = (this.y < 0) ? (1 + Math.random()) * difficultyMultiplier : (-1 - Math.random()) * difficultyMultiplier;
            this.contactDamage = 15; this.clickDamage = 10; this.points = 0;
            this.color = `hsl(${Math.random() * 360}, 90%, 60%)`;
            this.closeButton = null;
        }
        update() {
            this.y += this.vy;
            if (isPointInRect(mouse, this)) takeDamage(this.contactDamage * 0.2);
        }
        draw(ctx) {
            ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'yellow'; ctx.font = "bold 30px 'VT323'"; ctx.textAlign = 'center';
            ctx.fillText("!!! DOWNLOAD NOW !!! >>> GET RICH QUICK <<< !!!", this.x + this.width / 2, this.y + 40);
        }
    }

    class VideoAd {
        constructor(x, y) {
            this.x = x; this.y = y; this.width = 300; this.height = 180;
            this.clickDamage = 10; this.points = 25;
            this.waveTimer = 60; this.color = '#333';
            this.closeButton = { x: this.x + this.width - 85, y: this.y + this.height - 30, width: 80, height: 25 };
        }
        update() {
            this.waveTimer--;
            if (this.waveTimer <= 0) {
                for (let i = 0; i < 8; i++) {
                    particles.push(new DamageParticle(this.x + this.width / 2, this.y + this.height / 2, (i / 8) * Math.PI * 2));
                }
                this.waveTimer = 120 / difficultyMultiplier;
            }
        }
        draw(ctx) {
            ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'white'; ctx.font = "20px 'VT323'"; ctx.textAlign = 'center';
            ctx.fillText("Your video will play after this ad", this.x + this.width / 2, this.y + 80);
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(this.closeButton.x, this.closeButton.y, this.closeButton.width, this.closeButton.height);
            ctx.fillStyle = 'white'; ctx.font = "18px 'VT323'";
            ctx.fillText("Skip Ad >", this.closeButton.x + 40, this.closeButton.y + 18);
        }
    }

    class CookieConsentStack {
        constructor(x, y) {
            this.x = x; this.y = y; this.width = 320; this.height = 150;
            this.clickDamage = 2; this.points = 50; this.layers = 3;
            this.slowFactor = 0.85; this.color = '#f0f0f0';
            this.closeButton = null; // Has a custom hit mechanic
            this.button = { x: this.x + 90, y: this.y + 100, width: 140, height: 30 };
            this.messages = ["Accept All Cookies", "Accept Essential", "Confirm Choices"];
        }
        takeHit() {
            if (isPointInRect(mouse, this.button)) {
                this.layers--;
                this.points += 15;
                playSound(sounds.hit);
                if (this.layers <= 0) {
                    score += this.points;
                    playSound(sounds.destroy);
                    createDestructionParticles(this.x + this.width / 2, this.y + this.height / 2, this.color);
                    ads = ads.filter(ad => ad !== this);
                }
            } else {
                takeDamage(this.clickDamage);
            }
        }
        update() {
            cursorSlowdown = isPointInRect(mouse, this) ? this.slowFactor : 0;
        }
        draw(ctx) {
            for (let i = this.layers; i > 0; i--) {
                ctx.fillStyle = `rgba(200, 200, 200, ${1 - i*0.2})`;
                ctx.strokeStyle = '#555';
                ctx.fillRect(this.x + i * 4, this.y - i * 4, this.width, this.height);
                ctx.strokeRect(this.x + i * 4, this.y - i * 4, this.width, this.height);
            }
            ctx.fillStyle = 'black'; ctx.font = "bold 18px Arial"; ctx.textAlign = 'center';
            ctx.fillText("We value your privacy (not really)", this.x + this.width / 2, this.y + 40);
            ctx.fillStyle = '#007bff'; ctx.fillRect(this.button.x, this.button.y, this.button.width, this.button.height);
            ctx.fillStyle = 'white'; ctx.font = "bold 16px Arial";
            ctx.fillText(this.messages[this.layers - 1] || "GONE!", this.button.x + this.button.width / 2, this.button.y + 20);
        }
    }
    
    class FakeVirusAlert {
        constructor() {
            this.width = 350; this.height = 180;
            this.x = Math.random() < 0.5 ? -this.width : canvas.width;
            this.y = Math.random() * (canvas.height - this.height);
            this.speed = 0.5 + Math.random() * 0.5 * difficultyMultiplier;
            this.contactDamage = 20; this.clickDamage = 15; this.points = 40;
            this.color = '#c0c0c0';
            this.closeButton = { x: this.x + this.width - 28, y: this.y + 3, width: 25, height: 22 };
        }
        update() {
            const angle = Math.atan2(mouse.y - (this.y + this.height/2), mouse.x - (this.x + this.width/2));
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;
            this.closeButton.x = this.x + this.width - 28; this.closeButton.y = this.y + 3;
            if (isPointInRect(mouse, this)) takeDamage(this.contactDamage * 0.1);
        }
        draw(ctx) {
            ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#000080'; ctx.fillRect(this.x, this.y, this.width, 28);
            ctx.fillStyle = 'white'; ctx.font = "bold 16px 'VT323'"; ctx.textAlign = 'left';
            ctx.fillText("! WARNING !", this.x + 30, this.y + 20);
            ctx.fillStyle = 'red'; ctx.fillRect(this.closeButton.x, this.closeButton.y, this.closeButton.width, this.closeButton.height);
            ctx.fillStyle = 'white'; ctx.font = "bold 16px Arial"; ctx.fillText("X", this.closeButton.x + 8, this.y + 19);
            ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(this.x + 20, this.y + 100, 30, 0, 2*Math.PI); ctx.fill();
            ctx.fillStyle = 'white'; ctx.font = "bold 40px Arial"; ctx.fillText("!", this.x + 18, this.y + 112);
            ctx.fillStyle = 'black'; ctx.font = "18px Arial"; ctx.textAlign = 'left';
            ctx.fillText("VIRUS DETECTED! Your files are", this.x + 70, this.y + 90);
            ctx.fillText("at risk! Click to remove.", this.x + 70, this.y + 120);
        }
    }

    // --- PARTICLE & POWERUP CLASSES ---
    class DamageParticle {
        constructor(x, y, angle) {
            this.x = x; this.y = y; this.radius = 5;
            this.speed = 2 * difficultyMultiplier;
            this.vx = Math.cos(angle) * this.speed; this.vy = Math.sin(angle) * this.speed;
            this.lifespan = 100; this.damage = 5;
        }
        update() {
            this.x += this.vx; this.y += this.vy; this.lifespan--;
            if (getDistance(this.x, this.y, mouse.x, mouse.y) < this.radius + 5) {
                takeDamage(this.damage);
                this.lifespan = 0;
            }
        }
        draw(ctx) {
            ctx.fillStyle = 'orange'; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        }
    }

    class DestructionParticle {
        constructor(x, y, color) {
            this.x = x; this.y = y;
            this.vx = (Math.random() - 0.5) * 4; this.vy = (Math.random() - 0.5) * 4;
            this.lifespan = 50; this.radius = Math.random() * 3 + 1;
            this.color = color;
        }
        update() { this.x += this.vx; this.y += this.vy; this.lifespan--; }
        draw(ctx) {
            ctx.fillStyle = this.color; ctx.globalAlpha = this.lifespan / 50;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI); ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
    
    class Powerup {
        constructor(x, y, type) {
            this.x = x; this.y = y; this.width = 50; this.height = 50; this.type = type;
            this.colors = { 'BOMB': '#00f', 'AUTO_SHIELD': '#0f0', 'SUPER_CLICK': '#f0f' };
            this.text = { 'BOMB': 'BOMB', 'AUTO_SHIELD': 'SHLD', 'SUPER_CLICK': 'CLCK' };
        }
        activate() {
            playSound(sounds.powerup);
            switch (this.type) {
                case 'BOMB':
                    ads = ads.filter(ad => ad instanceof BannerAd || ad instanceof FakeVirusAlert);
                    score += 50;
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
            ctx.fillStyle = this.colors[this.type]; ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.strokeRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'white'; ctx.font = "bold 20px 'VT323'"; ctx.textAlign = 'center';
            ctx.fillText(this.text[this.type], this.x + 25, this.y + 32);
        }
    }

    // --- MAIN GAME LOOP ---
    function gameLoop() {
        if (gameOver) return;

        // --- UPDATE LOGIC ---
        adSpawnTimer--;
        if (adSpawnTimer <= 0) {
            spawnAd();
            difficultyMultiplier += 0.03;
            adSpawnTimer = Math.max(25, 150 / difficultyMultiplier);
        }
        spawnPowerup();

        cursorSlowdown = 0;
        ads.forEach(ad => ad.update());
        
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].lifespan <= 0) particles.splice(i, 1);
        }
        ads = ads.filter(ad => !(ad instanceof BannerAd) || (ad.y < canvas.height && ad.y > -ad.height));

        if (player.shield.rechargeTimer > 0) player.shield.rechargeTimer--;
        if (player.shield.autoDuration > 0) player.shield.autoDuration--;
        else player.shield.autoActive = false;
        
        updateUI();

        // --- DRAWING LOGIC ---
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ads.forEach(ad => ad.draw(ctx));
        particles.forEach(p => p.draw(ctx));
        powerups.forEach(p => p.draw(ctx));

        // Draw Player Shield (manual or auto)
        const shieldIsOn = player.shield.active || player.shield.autoActive;
        const shieldColor = player.shield.autoActive ? 'rgba(0, 255, 100, 0.4)' : 'rgba(0, 200, 255, 0.3)';
        if (shieldIsOn) {
            ctx.fillStyle = shieldColor;
            ctx.strokeStyle = player.shield.autoActive ? 'lime' : 'cyan';
            ctx.lineWidth = 3; ctx.beginPath();
            ctx.arc(mouse.x, mouse.y, player.shield.radius, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }
        
        // Draw Custom Cursor
        const cursorColor = player.powerups.superClick ? '#f0f' : '#000';
        ctx.strokeStyle = cursorColor; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mouse.x - 10, mouse.y); ctx.lineTo(mouse.x + 10, mouse.y);
        ctx.moveTo(mouse.x, mouse.y - 10); ctx.lineTo(mouse.x, mouse.y + 10);
        ctx.stroke();

        if (gameRunning) requestAnimationFrame(gameLoop);
    }
});
