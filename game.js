document.addEventListener('DOMContentLoaded', () => {
    // --- SETUP ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1000; canvas.height = 800;

    // --- UI & AUDIO ---
    const ui = {
        score: document.getElementById('score-display'),
        health: document.getElementById('health-bar-inner'),
        shield: document.getElementById('shield-bar-inner'),
        startScreen: document.getElementById('start-screen'),
        gameOverScreen: document.getElementById('game-over-screen'),
        startButton: document.getElementById('startButton'),
        restartButton: document.getElementById('restartButton'),
        finalScore: document.getElementById('finalScore'),
    };
    const sounds = {
        destroy: new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_731c518838.mp3'),
        damage: new Audio('https://cdn.pixabay.com/audio/2022/11/22/audio_7532328a38.mp3'),
        powerup: new Audio('https://cdn.pixabay.com/audio/2022/10/18/audio_c89b3f0729.mp3'),
        fakeClick: new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_a4b3a2896a.mp3'),
        shieldUp: new Audio('https://cdn.pixabay.com/audio/2022/03/23/audio_a1509b8b09.mp3'),
    };
    const playSound = (sound) => { sound.currentTime = 0; sound.play(); };

    // --- GAME STATE & PLAYER ---
    let state = {}; const player = { shield: {}, powerups: {} };

    // --- DRAWING HELPERS ---
    const drawRoundRect = (x, y, w, h, r) => {
        if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2;
        ctx.beginPath(); ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    };

    // --- MAIN GAME FLOW ---
    function resetState() {
        state = {
            score: 0, health: 100, gameOver: false, gameRunning: false,
            mouse: { x: canvas.width / 2, y: canvas.height / 2, down: false },
            entities: [], particles: [], backgroundStars: [],
            adSpawnTimer: 100, difficulty: 1, screenShake: 0
        };
        for (let i=0; i<100; i++) state.backgroundStars.push({x:Math.random()*canvas.width, y:Math.random()*canvas.height, r:Math.random()*1.5});
        Object.assign(player, {
            shield: { active: false, radius: 50, rechargeTimer: 0, maxRecharge: 300 },
            powerups: { superClick: false }
        });
    }
    function startGame() {
        resetState(); updateUI();
        ui.startScreen.style.display = 'none'; ui.gameOverScreen.style.display = 'none';
        state.gameRunning = true; gameLoop();
    }
    function endGame() {
        state.gameOver = true; state.gameRunning = false;
        ui.finalScore.textContent = state.score; ui.gameOverScreen.style.display = 'flex';
    }
    function updateUI() {
        ui.score.textContent = `SCORE: ${state.score}`;
        ui.health.style.width = `${state.health}%`;
        const shieldCharge = 100 - (player.shield.rechargeTimer / player.shield.maxRecharge) * 100;
        ui.shield.style.width = `${shieldCharge}%`;
    }

    // --- EVENT LISTENERS ---
    canvas.addEventListener('mousemove', e => { const rect = canvas.getBoundingClientRect(); state.mouse.x = e.clientX - rect.left; state.mouse.y = e.clientY - rect.top; });
    canvas.addEventListener('mousedown', e => { e.preventDefault(); if (e.button === 0) { state.mouse.down = true; handleClick(); } if (e.button === 2) { if(player.shield.rechargeTimer<=0) {player.shield.active = true; playSound(sounds.shieldUp);}}});
    canvas.addEventListener('mouseup', e => { e.preventDefault(); if (e.button === 0) state.mouse.down = false; if (e.button === 2) player.shield.active = false;});
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    ui.startButton.addEventListener('click', startGame); ui.restartButton.addEventListener('click', startGame);

    // --- CORE MECHANICS ---
    function takeDamage(amount) {
        if (player.shield.active) return;
        state.health = Math.max(0, state.health - amount);
        playSound(sounds.damage); state.screenShake = 15;
        updateUI(); if (state.health <= 0) endGame();
    }
    function spawnParticles(x, y, count, color, speed) { for (let i = 0; i < count; i++) state.particles.push(new Particle(x, y, color, speed)); }
    function handleClick() {
        // Handle entities in reverse order (top ones first)
        for (let i = state.entities.length - 1; i >= 0; i--) {
            const entity = state.entities[i];
            if (entity.onClick && entity.onClick(state.mouse)) return; // Entity handled the click
        }
    }
    function spawnAd() {
        const adType = Math.random(); const x = Math.random() * (canvas.width - 450) + 25; const y = Math.random() * (canvas.height - 400) + 25;
        if (adType < 0.4) state.entities.push(new PopupAd(x, y));
        else if (adType < 0.6) state.entities.push(new VideoAd(x, y));
        else if (adType < 0.75) state.entities.push(new CookieBanner());
        else if (adType < 0.9) state.entities.push(new OSNotification());
        else state.entities.push(new Powerup(Math.random()*(canvas.width-100)+50, Math.random()*(canvas.height-100)+50));
    }
    const isPointInRect = (point, rect) => point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height;

    // --- ENTITY & PARTICLE CLASSES ---
    class Entity {
        constructor(x, y, w, h) {
            Object.assign(this, { x, y, w, h, scale: 0, opacity: 0, alive: true });
        }
        update() {
            if (this.scale < 1) this.scale += 0.1;
            if (this.opacity < 1) this.opacity += 0.1;
        }
        destroy(addScore = 0, sound = sounds.destroy) {
            this.alive = false;
            playSound(sound);
            state.score += addScore;
            state.screenShake = Math.max(state.screenShake, 8);
            spawnParticles(this.x + this.w / 2, this.y + this.h / 2, 25, '#00BFFF', 4);
        }
    }

    class Particle {
        constructor(x, y, color, speed) {
            this.x = x; this.y = y; this.color = color;
            const angle = Math.random() * Math.PI * 2;
            this.vx = Math.cos(angle) * (Math.random() * speed);
            this.vy = Math.sin(angle) * (Math.random() * speed);
            this.lifespan = 1; this.decay = Math.random() * 0.03 + 0.01;
        }
        update() {
            this.x += this.vx; this.y += this.vy; this.vx *= 0.98; this.vy *= 0.98;
            this.lifespan -= this.decay;
        }
        draw() {
            ctx.globalAlpha = this.lifespan;
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, 2, 2);
        }
    }

    class PopupAd extends Entity {
        constructor(x, y) {
            super(x, y, 380, 200);
            this.clickDamage = 10; this.points = 20;
            this.hasFake = state.difficulty > 1.3 && Math.random() < 0.4;
            this.buttons = {
                real: { x: this.x + this.w - 30, y: this.y + 10, w: 20, h: 20 },
                fake: this.hasFake ? { x: this.x + this.w - 60, y: this.y + 10, w: 20, h: 20 } : null,
            };
        }
        onClick(mouse) {
            if (!isPointInRect(mouse, this)) return false;
            // Check buttons first
            if (isPointInRect(mouse, this.buttons.real)) { this.destroy(this.points); return true; }
            if (this.hasFake && isPointInRect(mouse, this.buttons.fake)) { takeDamage(this.clickDamage * 2); playSound(sounds.fakeClick); return true; }
            // Clicked on body
            takeDamage(this.clickDamage);
            return true;
        }
        draw() {
            ctx.save();
            ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
            ctx.scale(this.scale, this.scale);
            ctx.globalAlpha = this.opacity;
            ctx.translate(-(this.x + this.w / 2), -(this.y + this.h / 2));
            
            // Main body
            ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30;
            ctx.fillStyle = '#1E1E24'; drawRoundRect(this.x, this.y, this.w, this.h, 8); ctx.fill();
            ctx.shadowBlur = 0;
            
            // Header
            ctx.fillStyle = '#2A2F3A'; drawRoundRect(this.x, this.y, this.w, 40, 8); ctx.fill();
            ctx.beginPath(); ctx.rect(this.x, this.y+20, this.w, 20); ctx.fill();
            
            // Text
            ctx.fillStyle = '#EFEFEF'; ctx.font = "bold 16px Poppins"; ctx.textAlign = 'center';
            ctx.fillText("Exclusive Offer Just For You!", this.x + this.w/2, this.y + 100);

            // Draw buttons
            const drawButton = (btn, isReal) => {
                btn.hover = isPointInRect(state.mouse, btn);
                ctx.fillStyle = btn.hover ? (isReal ? '#2ECC40' : '#FF4136') : '#555';
                if(state.mouse.down && btn.hover) ctx.fillStyle = '#fff';
                drawRoundRect(btn.x, btn.y, btn.w, btn.h, 4); ctx.fill();
                ctx.strokeStyle = '#EFEFEF'; ctx.lineWidth = 2; ctx.beginPath();
                ctx.moveTo(btn.x+5, btn.y+5); ctx.lineTo(btn.x+15, btn.y+15);
                ctx.moveTo(btn.x+15, btn.y+5); ctx.lineTo(btn.x+5, btn.y+15);
                ctx.stroke();
            };
            drawButton(this.buttons.real, true);
            if (this.hasFake) drawButton(this.buttons.fake, false);
            
            ctx.restore();
        }
    }
    
    class VideoAd extends Entity {
        constructor(x, y) {
            super(x, y, 420, 236);
            this.clickDamage = 15; this.points = 30; this.progress = 0;
            this.closeButton = { x: this.x + this.w - 100, y: this.y + this.h - 45, w: 80, h: 30, text: "Skip" };
        }
        update() {
            super.update();
            if (this.progress < 100) this.progress += 0.2 * state.difficulty;
        }
        onClick(mouse) {
            if (!isPointInRect(mouse, this)) return false;
            if (this.progress >= 100 && isPointInRect(mouse, this.closeButton)) {
                this.destroy(this.points); return true;
            }
            takeDamage(this.clickDamage);
            return true;
        }
        draw() {
            ctx.save();
            ctx.translate(this.x + this.w / 2, this.y + this.h / 2); ctx.scale(this.scale, this.scale);
            ctx.globalAlpha = this.opacity; ctx.translate(-(this.x + this.w / 2), -(this.y + this.h / 2));
            
            ctx.fillStyle = '#000'; drawRoundRect(this.x, this.y, this.w, this.h, 8); ctx.fill();
            
            if (this.progress < 100) {
                const timeLeft = Math.ceil((100 - this.progress) / (0.2 * state.difficulty) / 60);
                ctx.fillStyle = '#ccc'; ctx.font = "14px Roboto"; ctx.textAlign = 'left';
                ctx.fillText(`Your video will start in ${timeLeft}s...`, this.x + 20, this.y + 30);
            } else {
                this.closeButton.hover = isPointInRect(state.mouse, this.closeButton);
                ctx.fillStyle = this.closeButton.hover ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)';
                drawRoundRect(this.closeButton.x, this.closeButton.y, this.closeButton.w, this.closeButton.h, 5); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = "bold 14px Poppins"; ctx.textAlign = 'center';
                ctx.fillText(this.closeButton.text, this.closeButton.x + 40, this.closeButton.y + 21);
            }
            
            ctx.fillStyle = '#444'; drawRoundRect(this.x + 10, this.y + this.h - 15, this.w - 20, 5, 2.5); ctx.fill();
            ctx.fillStyle = '#FF4136'; drawRoundRect(this.x + 10, this.y + this.h - 15, (this.w - 20) * (this.progress/100), 5, 2.5); ctx.fill();
            
            ctx.restore();
        }
    }
    
    class CookieBanner extends Entity {
        constructor() {
            super(0, canvas.height-120, canvas.width, 120);
            this.clickDamage = 5; this.points = 40;
            this.acceptBtn = { x: this.x + this.w - 180, y: this.y + 45, w: 150, h: 40 };
        }
        onClick(mouse) {
            if (!isPointInRect(mouse, this)) return false;
            if (isPointInRect(mouse, this.acceptBtn)) {
                this.destroy(this.points); return true;
            }
            takeDamage(this.clickDamage);
            return true;
        }
        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            
            ctx.fillStyle = 'rgba(20, 22, 28, 0.9)'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 40;
            ctx.fillRect(this.x, this.y, this.w, this.h); ctx.shadowBlur = 0;
            
            ctx.fillStyle = '#fff'; ctx.font = "bold 18px Poppins"; ctx.textAlign = 'left';
            ctx.fillText("We value your privacy.", this.x + 40, this.y + 55);
            ctx.font = "14px Roboto"; ctx.fillStyle = '#aaa';
            ctx.fillText("By clicking 'Accept', you agree to us using all your data for things.", this.x + 40, this.y + 80);

            this.acceptBtn.hover = isPointInRect(state.mouse, this.acceptBtn);
            ctx.fillStyle = this.acceptBtn.hover ? '#00BFFF' : '#007bff';
            if(state.mouse.down && this.acceptBtn.hover) ctx.fillStyle = '#fff';
            drawRoundRect(this.acceptBtn.x, this.acceptBtn.y, this.acceptBtn.w, this.acceptBtn.h, 6); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = "bold 16px Poppins"; ctx.textAlign = 'center';
            ctx.fillText("Accept All", this.acceptBtn.x + 75, this.acceptBtn.y + 26);
            
            ctx.restore();
        }
    }
    
    class OSNotification extends Entity {
        constructor() {
            const w = 400, h = 100;
            super(canvas.width - w - 20, canvas.height, w, h); // Start below screen
            this.targetY = canvas.height - h - 20; this.speed = 8;
            this.clickDamage = 20; this.points = 50;
            this.closeBtn = { x: this.x + this.w - 30, y: this.y + 10, w: 20, h: 20 };
        }
        update() {
            if(this.y > this.targetY) this.y -= this.speed;
            this.closeBtn.x = this.x + this.w - 30; this.closeBtn.y = this.y + 10;
        }
        onClick(mouse) {
            if(!isPointInRect(mouse, this)) return false;
            if(isPointInRect(mouse, this.closeBtn)) { this.destroy(this.points); return true; }
            takeDamage(this.clickDamage);
            return true;
        }
        draw() {
            ctx.save();
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = '#111827'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 30;
            drawRoundRect(this.x, this.y, this.w, this.h, 10); ctx.fill(); ctx.shadowBlur = 0;
            
            ctx.fillStyle = '#FF4136'; drawRoundRect(this.x+20, this.y+30, 40, 40, 20); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = "bold 30px Poppins"; ctx.textAlign = 'center';
            ctx.fillText("!", this.x + 40, this.y + 60);

            ctx.fillStyle = '#fff'; ctx.font = "bold 16px Roboto"; ctx.textAlign = 'left';
            ctx.fillText("Security Alert", this.x + 80, this.y + 45);
            ctx.fillStyle = '#aaa'; ctx.font = "14px Roboto";
            ctx.fillText("5 viruses found. Clean system immediately.", this.x + 80, this.y + 65);
            
            this.closeBtn.hover = isPointInRect(state.mouse, this.closeBtn);
            ctx.strokeStyle = this.closeBtn.hover ? '#fff' : '#888'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(this.closeBtn.x + 5, this.closeBtn.y + 5); ctx.lineTo(this.closeBtn.x + 15, this.closeBtn.y + 15);
            ctx.moveTo(this.closeBtn.x + 15, this.closeBtn.y + 5); ctx.lineTo(this.closeBtn.x + 5, this.closeBtn.y + 15); ctx.stroke();
            ctx.restore();
        }
    }
    
    class Powerup extends Entity {
        constructor(x, y) {
            super(x, y, 60, 60);
            this.points = 100;
        }
        onClick(mouse) {
            if(isPointInRect(mouse, this)) {
                this.destroy(this.points, sounds.powerup);
                player.shield.rechargeTimer = 0;
                state.health = Math.min(100, state.health + 25);
                state.entities.forEach(e => { if (e instanceof PopupAd) e.destroy(10, new Audio()) }); // Bomb effect
                return true;
            }
            return false;
        }
        draw() {
            ctx.save();
            const glowColor = '#2ECC40';
            ctx.shadowColor = glowColor; ctx.shadowBlur = 30 * this.scale;
            ctx.fillStyle = glowColor;
            drawRoundRect(this.x, this.y, this.w * this.scale, this.h * this.scale, 30*this.scale); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.font = "bold 24px Poppins";
            ctx.textAlign = 'center'; ctx.strokeText("+", this.x + this.w/2, this.y + this.h/2 + 8);
            ctx.restore();
        }
    }

    // --- MAIN GAME LOOP ---
    function gameLoop() {
        if (state.gameOver) return;
        // --- UPDATE ---
        state.adSpawnTimer--;
        if (state.adSpawnTimer <= 0) {
            spawnAd(); state.difficulty += 0.05;
            state.adSpawnTimer = Math.max(20, 120 / state.difficulty);
        }
        if (player.shield.rechargeTimer > 0) player.shield.rechargeTimer--;
        if (state.screenShake > 0) state.screenShake--;
        
        state.entities.forEach(e => e.update()); state.particles.forEach(p => p.update());
        state.entities = state.entities.filter(e => e.alive); state.particles = state.particles.filter(p => p.lifespan > 0);
        
        // Cursor trail
        if (Math.random() > 0.5) state.particles.push(new Particle(state.mouse.x, state.mouse.y, '#00BFFF', 1));
        
        // --- DRAW ---
        ctx.save();
        if(state.screenShake > 0) ctx.translate(Math.random()*8-4, Math.random()*8-4);
        
        ctx.fillStyle = '#0D0F12'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw background
        state.backgroundStars.forEach(s => { s.y += 0.1; if(s.y>canvas.height) s.y=0; ctx.fillStyle=`rgba(200,220,255,${s.r*0.5})`; ctx.fillRect(s.x, s.y, s.r, s.r); });
        
        state.particles.forEach(p => p.draw()); ctx.globalAlpha = 1;
        state.entities.forEach(e => e.draw());

        // Draw Player Shield
        if (player.shield.active) {
            const shieldGradient = ctx.createRadialGradient(state.mouse.x, state.mouse.y, 0, state.mouse.x, state.mouse.y, player.shield.radius);
            shieldGradient.addColorStop(0, 'rgba(0, 191, 255, 0)'); shieldGradient.addColorStop(0.8, 'rgba(0, 191, 255, 0.2)');
            shieldGradient.addColorStop(1, 'rgba(0, 191, 255, 0.5)');
            ctx.fillStyle = shieldGradient; ctx.beginPath(); ctx.arc(state.mouse.x, state.mouse.y, player.shield.radius, 0, Math.PI * 2); ctx.fill();
        }
        
        // Draw Custom Cursor
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(state.mouse.x - 10, state.mouse.y); ctx.lineTo(state.mouse.x + 10, state.mouse.y);
        ctx.moveTo(state.mouse.x, state.mouse.y - 10); ctx.lineTo(state.mouse.x, state.mouse.y + 10); ctx.stroke();
        
        ctx.restore();
        
        updateUI();
        requestAnimationFrame(gameLoop);
    }
});
