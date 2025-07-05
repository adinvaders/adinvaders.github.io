document.addEventListener('DOMContentLoaded', () => {
    // --- SETUP ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1000; canvas.height = 800;

    // --- ASSETS ---
    const assets = {
        images: {},
        sounds: {
            destroy: new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_731c518838.mp3'),
            damage: new Audio('https://cdn.pixabay.com/audio/2022/11/22/audio_7532328a38.mp3'),
            powerup: new Audio('https://cdn.pixabay.com/audio/2022/10/18/audio_c89b3f0729.mp3'),
            fakeClick: new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_a4b3a2896a.mp3'),
            shieldUp: new Audio('https://cdn.pixabay.com/audio/2022/03/23/audio_a1509b8b09.mp3'),
        }
    };
    const playSound = (sound) => { sound.currentTime = 0; sound.volume = 0.7; sound.play(); };
    
    // --- UI ELEMENTS ---
    const ui = {
        score: document.getElementById('score-display'), health: document.getElementById('health-bar-inner'),
        shield: document.getElementById('shield-bar-inner'), startScreen: document.getElementById('start-screen'),
        gameOverScreen: document.getElementById('game-over-screen'), startButton: document.getElementById('startButton'),
        restartButton: document.getElementById('restartButton'), finalScore: document.getElementById('finalScore'),
    };
    
    // --- GAME STATE & PLAYER ---
    let state = {}; const player = {};

    // --- HELPER FUNCTIONS ---
    const drawRoundRect = (x, y, w, h, r) => { if(w<2*r)r=w/2;if(h<2*r)r=h/2;ctx.beginPath(),ctx.moveTo(x+r,y),ctx.arcTo(x+w,y,x+w,y+h,r),ctx.arcTo(x+w,y+h,x,y+h,r),ctx.arcTo(x,y+h,x,y,r),ctx.arcTo(x,y,x+w,y,r),ctx.closePath()};
    const isPointInRect = (point, rect) => point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height;

    // --- ASSET LOADER ---
    async function loadAssets() {
        const imageSources = {
            videoThumb1: 'https://images.pexels.com/photos/163036/mario-luigi-yoschi-figures-163036.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500',
            videoThumb2: 'https://images.pexels.com/photos/1122868/pexels-photo-1122868.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500',
        };
        const promises = Object.entries(imageSources).map(([name, src]) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = src;
                img.onload = () => { assets.images[name] = img; resolve(); };
                img.onerror = reject;
            });
        });
        await Promise.all(promises);
    }
    
    // --- MAIN GAME FLOW ---
    function resetState() { state={score:0,health:100,gameOver:!1,gameRunning:!1,mouse:{x:canvas.width/2,y:canvas.height/2,down:!1},entities:[],particles:[],backgroundStars:[],adSpawnTimer:100,difficulty:1,screenShake:0};for(let i=0;i<100;i++)state.backgroundStars.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*1.5});Object.assign(player,{shield:{active:!1,radius:50,rechargeTimer:0,maxRecharge:300}}); }
    function startGame() { resetState(); updateUI(); ui.startScreen.style.display = 'none'; ui.gameOverScreen.style.display = 'none'; state.gameRunning = true; gameLoop(); }
    function endGame() { state.gameOver=!0;state.gameRunning=!1;ui.finalScore.textContent=state.score;ui.gameOverScreen.style.display='flex'; }
    function updateUI() { ui.score.textContent=`SCORE: ${state.score}`;ui.health.style.width=`${state.health}%`;const e=100-player.shield.rechargeTimer/player.shield.maxRecharge*100;ui.shield.style.width=`${e}%`; }

    // --- EVENT LISTENERS ---
    async function initializeGame() {
        ui.startButton.disabled = true; ui.startButton.textContent = 'Loading Assets...';
        try { await loadAssets(); ui.startButton.textContent = 'Initialize Protocol'; ui.startButton.disabled = false; } 
        catch (error) { console.error("Failed to load assets:", error); ui.startButton.textContent = 'Error - Refresh'; }
    }
    initializeGame(); // Load assets as soon as the script runs
    ui.startButton.addEventListener('click', () => { if (!ui.startButton.disabled) startGame(); });
    ui.restartButton.addEventListener('click', startGame);
    canvas.addEventListener('mousemove', e => { const rect = canvas.getBoundingClientRect(); state.mouse.x = e.clientX - rect.left; state.mouse.y = e.clientY - rect.top; });
    canvas.addEventListener('mousedown', e => { e.preventDefault(); if (e.button === 0) { state.mouse.down = true; handleClick(); } if (e.button === 2) { if(player.shield.rechargeTimer<=0) {player.shield.active = true; playSound(assets.sounds.shieldUp);}}});
    canvas.addEventListener('mouseup', e => { e.preventDefault(); if (e.button === 0) state.mouse.down = false; if (e.button === 2) player.shield.active = false;});
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // --- CORE MECHANICS ---
    function takeDamage(amount) { if(player.shield.active)return;state.health=Math.max(0,state.health-amount),playSound(assets.sounds.damage),state.screenShake=15,updateUI(),state.health<=0&&endGame(); }
    function spawnParticles(x, y, count, color, speed) { for (let i = 0; i < count; i++) state.particles.push(new Particle(x, y, color, speed)); }
    function handleClick() { for (let i = state.entities.length - 1; i >= 0; i--) { if (state.entities[i].alive && state.entities[i].onClick(state.mouse)) return; } }
    function spawnAd() {
        const adType = Math.random(); const x = Math.random() * (canvas.width - 450) + 25; const y = Math.random() * (canvas.height - 400) + 25;
        if (state.entities.length > 10) return; // Prevent too many ads at once
        if (adType < 0.25) state.entities.push(new PopupAd(x, y));
        else if (adType < 0.45) state.entities.push(new VideoAd(x, y));
        else if (adType < 0.60) state.entities.push(new CookieBanner());
        else if (adType < 0.75) state.entities.push(new OSNotification());
        else if (adType < 0.88) state.entities.push(new NewsletterAd(x,y));
        else state.entities.push(new SpinToWinAd(x,y));
    }
    function spawnPowerup() { if(state.entities.some(e => e instanceof Powerup)) return; if(Math.random() < 0.003) state.entities.push(new Powerup(Math.random()*(canvas.width-100)+50, Math.random()*(canvas.height-100)+50)); }

    // --- CLASSES ---
    class Entity { constructor(x, y, w, h) { Object.assign(this, { x, y, w, h, scale: 0, opacity: 0, alive: true }); } update() { if(this.scale<1)this.scale+=.1;if(this.opacity<1)this.opacity+=.1 } destroy(e=0,t=assets.sounds.destroy){this.alive=!1,playSound(t),state.score+=e,state.screenShake=Math.max(state.screenShake,8),spawnParticles(this.x+this.w/2,this.y+this.h/2,25,"#00BFFF",4)} }
    class Particle { constructor(x, y, color, speed) { this.x = x; this.y = y; this.color = color; const angle = Math.random() * Math.PI * 2; this.vx = Math.cos(angle) * (Math.random() * speed); this.vy = Math.sin(angle) * (Math.random() * speed); this.lifespan = 1; this.decay = Math.random() * 0.03 + 0.01; } update() { this.x+=this.vx; this.y+=this.vy; this.vx*=.98; this.vy*=.98; this.lifespan-=this.decay; } draw() { ctx.globalAlpha=this.lifespan;ctx.fillStyle=this.color;ctx.fillRect(this.x,this.y,2,2) } }
    
    class PopupAd extends Entity {
        constructor(x, y) { super(x, y, 380, 200); this.clickDamage = 10; this.points = 20; this.hasFake = state.difficulty > 1.3 && Math.random() < 0.4; this.buttons = {real: { x: this.x + this.w - 30, y: this.y + 10, w: 20, h: 20 }, fake: this.hasFake ? { x: this.x + this.w - 60, y: this.y + 10, w: 20, h: 20 } : null }; }
        onClick(mouse) { if (!this.alive || this.scale < 1) return false; if (!isPointInRect(mouse, this)) return false; if (isPointInRect(mouse, this.buttons.real)) { this.destroy(this.points); return true; } if (this.hasFake && isPointInRect(mouse, this.buttons.fake)) { takeDamage(this.clickDamage * 2); playSound(assets.sounds.fakeClick); return true; } takeDamage(this.clickDamage); return true; }
        draw() { ctx.save();ctx.translate(this.x+this.w/2,this.y+this.h/2);ctx.scale(this.scale,this.scale);ctx.globalAlpha=this.opacity;ctx.translate(-(this.x+this.w/2),-(this.y+this.h/2));ctx.shadowColor="rgba(0,0,0,0.5)";ctx.shadowBlur=30;ctx.fillStyle="#1E1E24";drawRoundRect(this.x,this.y,this.w,this.h,8);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#2A2F3A";drawRoundRect(this.x,this.y,this.w,40,8);ctx.fill();ctx.beginPath();ctx.rect(this.x,this.y+20,this.w,20);ctx.fill();ctx.fillStyle="#EFEFEF";ctx.font="bold 16px Poppins";ctx.textAlign="center";ctx.fillText("Exclusive Offer Just For You!",this.x+this.w/2,this.y+100);const t=(t,e)=>{t.hover=isPointInRect(state.mouse,t);ctx.fillStyle=t.hover?e?"#2ECC40":"#FF4136":"#555";state.mouse.down&&t.hover&&(ctx.fillStyle="#fff");drawRoundRect(t.x,t.y,t.w,t.h,4);ctx.fill();ctx.strokeStyle="#EFEFEF";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(t.x+5,t.y+5);ctx.lineTo(t.x+15,t.y+15);ctx.moveTo(t.x+15,t.y+5);ctx.lineTo(t.x+5,t.y+15);ctx.stroke()};t(this.buttons.real,!0);this.hasFake&&t(this.buttons.fake,!1);ctx.restore(); }
    }
    class VideoAd extends Entity {
        constructor(x, y) { super(x, y, 420, 236); this.clickDamage = 15; this.points = 30; this.progress = 0; this.closeButton = { x: this.x + this.w - 100, y: this.y + this.h - 45, w: 80, h: 30, text: "Skip" }; this.thumb = Math.random() < 0.5 ? 'videoThumb1' : 'videoThumb2';}
        update() { super.update(); if (this.progress < 100) this.progress += 0.2 * state.difficulty; }
        onClick(mouse) { if (!this.alive || this.scale < 1) return false; if (!isPointInRect(mouse, this)) return false; if (this.progress >= 100 && isPointInRect(mouse, this.closeButton)) { this.destroy(this.points); return true; } takeDamage(this.clickDamage); return true; }
        draw() { ctx.save();ctx.translate(this.x+this.w/2,this.y+this.h/2);ctx.scale(this.scale,this.scale);ctx.globalAlpha=this.opacity;ctx.translate(-(this.x+this.w/2),-(this.y+this.h/2)); const thumbImg = assets.images[this.thumb]; ctx.fillStyle="#000"; drawRoundRect(this.x,this.y,this.w,this.h,8); ctx.fill(); if (thumbImg) { ctx.globalAlpha = this.opacity * 0.7; ctx.drawImage(thumbImg, this.x, this.y, this.w, this.h); ctx.globalAlpha = this.opacity; } if(this.progress<100) {ctx.fillStyle="#fff";ctx.globalAlpha=this.opacity*0.5;ctx.beginPath();ctx.moveTo(this.x+this.w/2-20,this.y+this.h/2-30);ctx.lineTo(this.x+this.w/2-20,this.y+this.h/2+30);ctx.lineTo(this.x+this.w/2+30,this.y+this.h/2);ctx.closePath();ctx.fill();ctx.globalAlpha=this.opacity} else { this.closeButton.hover = isPointInRect(state.mouse, this.closeButton);ctx.fillStyle=this.closeButton.hover?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.1)";drawRoundRect(this.closeButton.x, this.closeButton.y, this.closeButton.w, this.closeButton.h, 5);ctx.fill();ctx.fillStyle="#fff";ctx.font="bold 14px Poppins";ctx.textAlign="center";ctx.fillText(this.closeButton.text, this.closeButton.x+40, this.closeButton.y+21); } ctx.fillStyle="#444";drawRoundRect(this.x+10,this.y+this.h-15,this.w-20,5,2.5);ctx.fill();ctx.fillStyle="#FF4136";drawRoundRect(this.x+10,this.y+this.h-15,(this.w-20)*(this.progress/100),5,2.5);ctx.fill();ctx.restore(); }
    }
    class CookieBanner extends Entity {
        constructor() { super(0, canvas.height-120, canvas.width, 120); this.clickDamage = 5; this.points = 40; this.acceptBtn = { x: this.x + this.w - 180, y: this.y + 45, w: 150, h: 40 }; }
        onClick(mouse) { if (!this.alive || this.opacity < 1) return false; if (!isPointInRect(mouse, this)) return false; if (isPointInRect(mouse, this.acceptBtn)) { this.destroy(this.points); return true; } takeDamage(this.clickDamage); return true; }
        draw() { ctx.save();ctx.globalAlpha=this.opacity;ctx.fillStyle="rgba(20, 22, 28, 0.9)";ctx.shadowColor="rgba(0,0,0,0.8)";ctx.shadowBlur=40;ctx.fillRect(this.x,this.y,this.w,this.h);ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.font="bold 18px Poppins";ctx.textAlign="left";ctx.fillText("We value your privacy.",this.x+40,this.y+55);ctx.font="14px Roboto";ctx.fillStyle="#aaa";ctx.fillText("By clicking 'Accept', you agree to us using all your data for things.",this.x+40,this.y+80);this.acceptBtn.hover=isPointInRect(state.mouse,this.acceptBtn);ctx.fillStyle=this.acceptBtn.hover?"#00BFFF":"#007bff";state.mouse.down&&this.acceptBtn.hover&&(ctx.fillStyle="#fff");drawRoundRect(this.acceptBtn.x,this.acceptBtn.y,this.acceptBtn.w,this.acceptBtn.h,6);ctx.fill();ctx.fillStyle="#fff";ctx.font="bold 16px Poppins";ctx.textAlign="center";ctx.fillText("Accept All",this.acceptBtn.x+75,this.acceptBtn.y+26);ctx.restore(); }
    }
    class OSNotification extends Entity {
        constructor() { const w = 400, h = 100; super(canvas.width - w - 20, canvas.height, w, h); this.targetY = canvas.height - h - 20; this.speed = 8; this.clickDamage = 20; this.points = 50; this.closeBtn = { x: this.x + this.w - 30, y: this.y + 10, w: 20, h: 20 }; }
        update() { if (this.y > this.targetY) this.y -= this.speed; else if (this.opacity < 1) this.opacity += 0.1; this.closeBtn.x = this.x + this.w - 30; this.closeBtn.y = this.y + 10; }
        onClick(mouse) { if (!this.alive || this.opacity < 1) return false; if (!isPointInRect(mouse, this)) return false; if (isPointInRect(mouse, this.closeBtn)) { this.destroy(this.points); return true; } takeDamage(this.clickDamage); return true; }
        draw() { ctx.save();ctx.globalAlpha=this.opacity*0.95;ctx.fillStyle="#111827";ctx.shadowColor="rgba(0,0,0,0.7)";ctx.shadowBlur=30;drawRoundRect(this.x,this.y,this.w,this.h,10);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#FF4136";drawRoundRect(this.x+20,this.y+30,40,40,20);ctx.fill();ctx.fillStyle="#fff";ctx.font="bold 30px Poppins";ctx.textAlign="center";ctx.fillText("!",this.x+40,this.y+60);ctx.fillStyle="#fff";ctx.font="bold 16px Roboto";ctx.textAlign="left";ctx.fillText("Security Alert",this.x+80,this.y+45);ctx.fillStyle="#aaa";ctx.font="14px Roboto";ctx.fillText("5 viruses found. Clean system immediately.",this.x+80,this.y+65);this.closeBtn.hover=isPointInRect(state.mouse,this.closeBtn);ctx.strokeStyle=this.closeBtn.hover?"#fff":"#888";ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(this.closeBtn.x+5,this.closeBtn.y+5);ctx.lineTo(this.closeBtn.x+15,this.closeBtn.y+15);ctx.moveTo(this.closeBtn.x+15,this.closeBtn.y+5);ctx.lineTo(this.closeBtn.x+5,this.closeBtn.y+15);ctx.stroke();ctx.restore(); }
    }
    class Powerup extends Entity { constructor(x, y) { super(x, y, 60, 60); this.points = 100; } onClick(t){return!!isPointInRect(t,this)&&(this.destroy(this.points,assets.sounds.powerup),player.shield.rechargeTimer=0,state.health=Math.min(100,state.health+25),state.entities.forEach(t=>{t instanceof PopupAd&&t.destroy(10,new Audio)}),!0)} draw(){ctx.save();const t="#2ECC40";ctx.shadowColor=t,ctx.shadowBlur=30*this.scale,ctx.fillStyle=t,drawRoundRect(this.x,this.y,this.w*this.scale,this.h*this.scale,30*this.scale),ctx.fill(),ctx.shadowBlur=0,ctx.strokeStyle="#fff",ctx.lineWidth=3,ctx.font="bold 24px Poppins",ctx.textAlign="center",ctx.strokeText("+",this.x+this.w/2,this.y+this.h/2+8),ctx.restore()} }

    class NewsletterAd extends Entity {
        constructor(x, y) { super(x, y, 400, 220); this.clickDamage = 15; this.points = 35; this.subscribeBtn = { x: this.x + 50, y: this.y + 130, w: 300, h: 45 }; this.closeLink = { text: "No, thanks.", x: this.x + this.w/2, y: this.y + 195, w: 0, h: 20 }; }
        onClick(mouse) { if (!this.alive || this.scale < 1) return false; if (!isPointInRect(mouse, this)) return false; if (isPointInRect(mouse, this.closeLink)) { this.destroy(this.points); return true; } if (isPointInRect(mouse, this.subscribeBtn)) { takeDamage(this.clickDamage * 2); playSound(assets.sounds.fakeClick); return true; } takeDamage(this.clickDamage); return true; }
        draw() { ctx.save(); ctx.translate(this.x+this.w/2,this.y+this.h/2);ctx.scale(this.scale,this.scale);ctx.globalAlpha=this.opacity;ctx.translate(-(this.x+this.w/2),-(this.y+this.h/2)); ctx.fillStyle='#fff';drawRoundRect(this.x,this.y,this.w,this.h,12);ctx.fill(); ctx.fillStyle='#111';ctx.font="bold 24px Poppins";ctx.textAlign='center';ctx.fillText("Don't Miss Out!",this.x+this.w/2,this.y+50);ctx.font="14px Roboto";ctx.fillText("Sign up for our newsletter for exclusive deals!",this.x+this.w/2,this.y+80); this.subscribeBtn.hover = isPointInRect(state.mouse, this.subscribeBtn); ctx.fillStyle=this.subscribeBtn.hover?'#FF4136':'#dd2c00';drawRoundRect(this.subscribeBtn.x,this.subscribeBtn.y,this.subscribeBtn.w,this.subscribeBtn.h,8);ctx.fill(); ctx.fillStyle='#fff';ctx.font="bold 16px Poppins";ctx.fillText("SUBSCRIBE NOW",this.x+this.w/2,this.y+160); ctx.font="14px Roboto"; const textWidth = ctx.measureText(this.closeLink.text).width; this.closeLink.w = textWidth; this.closeLink.x = this.x + (this.w - textWidth) / 2; this.closeLink.hover = isPointInRect(state.mouse, this.closeLink); ctx.fillStyle=this.closeLink.hover?'#007bff':'#888';ctx.fillText(this.closeLink.text,this.x+this.w/2,this.y+195); ctx.restore(); }
    }
    class SpinToWinAd extends Entity {
        constructor(x, y) { super(x, y, 300, 350); this.clickDamage = 10; this.points = 45; this.rotation = 0; this.spinBtn = { x: this.x + 125, y: this.y + 125, w: 50, h: 50 }; }
        update() { super.update(); this.rotation += 0.02 * state.difficulty; }
        onClick(mouse) { if (!this.alive || this.scale < 1) return false; if (!isPointInRect(mouse, this)) return false; if (isPointInRect(mouse, this.spinBtn)) { this.destroy(this.points); return true; } takeDamage(this.clickDamage); return true; }
        draw() { ctx.save();ctx.translate(this.x+this.w/2,this.y+this.h/2);ctx.scale(this.scale,this.scale);ctx.globalAlpha=this.opacity;ctx.translate(-(this.x+this.w/2),-(this.y+this.h/2));ctx.fillStyle="#222";ctx.shadowColor="rgba(255,220,0,0.4)";ctx.shadowBlur=30;drawRoundRect(this.x,this.y,this.w,this.h,15);ctx.fill();ctx.shadowBlur=0;ctx.font="bold 22px Poppins";ctx.textAlign='center';ctx.fillStyle='#FFDC00';ctx.fillText("SPIN TO WIN!",this.x+this.w/2,this.y+40);const r=100;ctx.save();ctx.translate(this.x+150,this.y+150);ctx.rotate(this.rotation);const colors=['#FF4136','#0074D9','#2ECC40','#FFDC00','#B10DC9','#FF851B'];for(let i=0;i<6;i++){ctx.fillStyle=colors[i];ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,i*Math.PI/3,(i+1)*Math.PI/3);ctx.closePath();ctx.fill()}ctx.restore();this.spinBtn.hover=isPointInRect(state.mouse,this.spinBtn);ctx.fillStyle=this.spinBtn.hover?'#fff':'#FFDC00';ctx.beginPath();ctx.arc(this.spinBtn.x+25,this.spinBtn.y+25,25,0,2*Math.PI);ctx.fill();ctx.fillStyle='#000';ctx.font="bold 12px Poppins";ctx.fillText("SPIN",this.spinBtn.x+25,this.spinBtn.y+30);ctx.fillStyle="#fff";ctx.beginPath();ctx.moveTo(this.x+150,this.y+40);ctx.lineTo(this.x+140,this.y+20);ctx.lineTo(this.x+160,this.y+20);ctx.closePath();ctx.fill();ctx.restore(); }
    }
    
    // --- MAIN GAME LOOP ---
    function gameLoop() {
        if (state.gameOver) return;
        state.adSpawnTimer--;
        if (state.adSpawnTimer <= 0) { spawnAd(); state.difficulty += 0.05; state.adSpawnTimer = Math.max(30, 120 / state.difficulty); }
        spawnPowerup(); if (player.shield.rechargeTimer > 0) player.shield.rechargeTimer--; if (state.screenShake > 0) state.screenShake--;
        state.entities.forEach(e => e.update()); state.particles.forEach(p => p.update());
        state.entities = state.entities.filter(e => e.alive); state.particles = state.particles.filter(p => p.lifespan > 0);
        if (Math.random() > 0.5) state.particles.push(new Particle(state.mouse.x, state.mouse.y, '#00BFFF', 1));
        
        ctx.save(); if (state.screenShake > 0) ctx.translate(Math.random() * 8 - 4, Math.random() * 8 - 4);
        ctx.fillStyle = '#0D0F12'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        state.backgroundStars.forEach(s => { s.y += 0.1; if (s.y > canvas.height) s.y = 0; ctx.fillStyle = `rgba(200,220,255,${s.r * 0.5})`; ctx.fillRect(s.x, s.y, s.r, s.r); });
        state.particles.forEach(p => p.draw()); ctx.globalAlpha = 1; state.entities.forEach(e => e.draw());

        if (player.shield.active) { const g=ctx.createRadialGradient(state.mouse.x,state.mouse.y,0,state.mouse.x,state.mouse.y,player.shield.radius);g.addColorStop(0,'rgba(0,191,255,0)');g.addColorStop(.8,'rgba(0,191,255,0.2)');g.addColorStop(1,'rgba(0,191,255,0.5)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(state.mouse.x,state.mouse.y,player.shield.radius,0,Math.PI*2);ctx.fill(); }
        
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(state.mouse.x-10,state.mouse.y);ctx.lineTo(state.mouse.x+10,state.mouse.y);ctx.moveTo(state.mouse.x,state.mouse.y-10);ctx.lineTo(state.mouse.x,state.mouse.y+10);ctx.stroke();
        ctx.restore(); updateUI();
        if(state.gameRunning) requestAnimationFrame(gameLoop);
    }
});
