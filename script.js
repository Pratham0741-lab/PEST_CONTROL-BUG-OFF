const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const menu = document.getElementById("menu");

// Set Fullscreen
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

/* ================= AUDIO SYSTEM ================= */
const bgm = {
  normal: new Audio("sounds/bgm.mp3"),
  boss1: new Audio("sounds/boss_bgm.mp3"),
  boss2: new Audio("sounds/boss_bgm2.mp3"),
  final: new Audio("sounds/final_boss_bgm.mp3")
};

const sfx = {
  shoot: new Audio("sounds/shoot.mp3"),
  explosion: new Audio("sounds/explosion.mp3")
};

Object.values(bgm).forEach(b => {
  b.loop = true;
  b.volume = 0.5;
});

function playSfx(key) {
  if (sfx[key]) {
    const sound = sfx[key].cloneNode(); 
    sound.volume = 0.3; 
    sound.play().catch(() => {});
  }
}

function playBgm(key) {
  Object.values(bgm).forEach(b => {
    b.pause();
    b.currentTime = 0;
  });
  bgm[key]?.play().catch(e => console.log("Audio play failed (interact first):", e));
}

function stopAllBgm() {
  Object.values(bgm).forEach(b => {
    b.pause();
    b.currentTime = 0;
  });
}

/* ================= CONFIG ================= */
const COLORS = {
  player: "#0ff",     
  enemy: "#f0f",      
  boss: "#f00",       
  bullet: "#ff0",     
  bg_normal: "#000510" 
};

/* ================= STATE ================= */
let game = {
  running: false,
  score: 0,
  lives: 5,
  level: 1,
  shake: 0,
  frames: 0,
  theme: "normal"     
};

// Player Speed 6.5
let player = { 
    x: canvas.width / 2, 
    y: canvas.height - 100, 
    w: 30, h: 30, 
    speed: 6.5, 
    dx: 0, 
    weaponLevel: 1,
    shield: false // NEW: Shield State
};

let bullets = [];
let enemies = [];
let particles = [];
let powerups = [];
let boss = null;
let stars = [];

/* ================= INPUT ================= */
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.key === "Enter" && !game.running) initGame();
  if (e.key === "p") {
      game.running = !game.running;
  }
});
window.addEventListener("keyup", e => keys[e.key] = false);
menu.onclick = initGame;

/* ================= DRAWING HELPERS ================= */
function drawGlow(color, blur = 20) {
  ctx.shadowBlur = blur;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
}

function resetGlow() {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

function drawPoly(x, y, radius, sides, color, rotation = 0, stroke = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  drawGlow(color);
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  for (let i = 1; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  if (stroke) {
      ctx.lineWidth = 3;
      ctx.stroke();
  } else {
      ctx.fill();
  }
  ctx.restore();
  resetGlow();
}

/* --- ADVANCED BOSS RENDERER --- */
function drawBossModel(b) {
  if (game.level === 1) {
    // === BOSS 1: THE HELL-GRINDER ===
    drawPoly(b.x, b.y, 90, 8, "#500", 0); 
    drawPoly(b.x, b.y, 85, 12, "#ff0000", -game.frames * 0.15); 
    drawPoly(b.x, b.y, 60, 20, "#aa0000", game.frames * 0.05); 
    const heat = 30 + Math.sin(game.frames * 0.5) * 5;
    drawPoly(b.x, b.y, heat, 4, "#fff", game.frames * 0.1); 
    ctx.fillStyle = "rgba(0,0,0,0.5)"; 
    ctx.fillRect(b.x - 20, b.y - 20, 10, 40);
    ctx.fillRect(b.x + 10, b.y - 20, 10, 40);
  } 
  else if (game.level === 2) {
    // === BOSS 2: THE SERAPH VIRUS ===
    const breath = Math.sin(game.frames * 0.05) * 10;
    drawPoly(b.x, b.y, 100 + breath, 3, "#0f0", game.frames * 0.02, true); 
    drawPoly(b.x, b.y, 100 + breath, 3, "#0f0", -game.frames * 0.02 + Math.PI, true); 
    drawPoly(b.x, b.y, 60, 4, "#00ff00", Math.sin(game.frames * 0.02)); 
    for(let i=0; i<4; i++) { 
        const angle = (game.frames * 0.05) + (i * (Math.PI/2));
        const dist = 70;
        const bx = b.x + Math.cos(angle) * dist;
        const by = b.y + Math.sin(angle) * dist;
        drawPoly(bx, by, 15, 6, "#fff", -angle * 2);
    }
    drawPoly(b.x, b.y, 20, 8, "#fff", 0); 
  } 
  else {
    // === BOSS 3: THE VOID SINGULARITY ===
    ctx.save();
    ctx.translate(b.x, b.y);
    drawGlow("#a0f", 50);
    ctx.beginPath();
    for (let i = 0; i <= 360; i+=10) {
        const rad = (i * Math.PI) / 180;
        const r = 80 + Math.sin((game.frames * 0.1) + (i * 0.1)) * 10;
        ctx.lineTo(Math.cos(rad) * r, Math.sin(rad) * r);
    }
    ctx.closePath();
    ctx.strokeStyle = "#80f";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
    
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(game.frames * 0.05);
    drawPoly(0, 0, 60, 3, "#303", 0); 
    drawPoly(0, 0, 60, 3, "#303", Math.PI); 
    ctx.restore();

    const angle = Math.atan2(player.y - b.y, player.x - b.x);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI*2);
    ctx.fill();
    drawGlow("#f0f", 20);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(10, 0, 12, 3, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    resetGlow();
  }
}

/* ================= PARTICLES & STARS ================= */
function createStars() {
  stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    z: Math.random() * 2 + 0.5,
    offset: Math.random() * 100
  }));
}

function drawBackground() {
  const w = canvas.width;
  const h = canvas.height;

  // --- DYNAMIC THEMES ---
  if (game.theme === "normal") {
    ctx.fillStyle = COLORS.bg_normal;
    ctx.fillRect(0, 0, w, h);
  } 
  else if (game.theme === "boss1") {
    const pulse = Math.sin(game.frames * 0.2) * 30; 
    ctx.fillStyle = `rgb(${40 + pulse}, 0, 0)`; 
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w/2, h/2, h/3, w/2, h/2, h);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, "rgba(0,0,0,0.9)");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);
  }
  else if (game.theme === "boss2") {
    ctx.fillStyle = "#000800"; 
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
    for(let i=0; i<20; i++) {
        const nx = Math.random() * w;
        const ny = Math.random() * h;
        ctx.fillRect(nx, ny, Math.random() * 50, 2);
    }
  }
  else if (game.theme === "boss3") {
    ctx.fillStyle = "#000"; 
    ctx.fillRect(0, 0, w, h);
  }

  // Draw Stars
  ctx.fillStyle = "white";
  if (game.theme === "boss1") ctx.fillStyle = "#ff4444"; 
  if (game.theme === "boss2") ctx.fillStyle = "#00ff00"; 
  if (game.theme === "boss3") ctx.fillStyle = "#440044"; 

  stars.forEach(s => {
    s.y += s.z * (game.level * 0.4 + 0.5); 
    
    let xOffset = 0;
    let yOffset = 0;

    if (game.theme === "boss2" && Math.random() < 0.2) {
        xOffset = (Math.random() - 0.5) * 50;
    }
    if (game.theme === "boss3") {
        xOffset = (Math.random() - 0.5) * 2;
        yOffset = (Math.random() - 0.5) * 2;
    }

    if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
    
    ctx.globalAlpha = Math.random() * 0.5 + 0.3;
    if (game.theme === "boss3") ctx.globalAlpha = 0.2;

    ctx.fillRect(s.x + xOffset, s.y + yOffset, s.z, s.z);
    ctx.globalAlpha = 1.0;
  });
}

function spawnExplosion(x, y, color, count = 10) {
  playSfx("explosion");
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 8, 
      vy: (Math.random() - 0.5) * 8,
      life: 1.0,
      color: color
    });
  }
}

/* ================= GAME LOGIC ================= */
function initGame() {
  game.running = true;
  game.score = 0;
  game.lives = 5;
  game.level = 1;
  game.theme = "normal"; 
  player.weaponLevel = 1;
  player.shield = false; // Reset shield
  player.x = canvas.width / 2;
  player.y = canvas.height - 100;
  
  bullets = [];
  enemies = [];
  particles = [];
  powerups = [];
  boss = null;
  
  menu.style.display = "none";
  createStars();
  
  playBgm("normal");
}

function updatePlayer() {
  if (keys["ArrowLeft"]) player.dx = -player.speed;
  else if (keys["ArrowRight"]) player.dx = player.speed;
  else player.dx *= 0.9; 

  player.x += player.dx;
  if (player.x < 20) player.x = 20;
  if (player.x > canvas.width - 20) player.x = canvas.width - 20;

  if (keys[" "] && game.frames % 10 === 0) {
    playSfx("shoot");
    if (player.weaponLevel === 1) {
       bullets.push({ x: player.x, y: player.y - 20, w: 4, h: 15, vx: 0, vy: -12, color: COLORS.bullet });
    } else {
       bullets.push({ x: player.x - 10, y: player.y - 20, w: 4, h: 15, vx: -2, vy: -12, color: COLORS.bullet });
       bullets.push({ x: player.x + 10, y: player.y - 20, w: 4, h: 15, vx: 2, vy: -12, color: COLORS.bullet });
       bullets.push({ x: player.x, y: player.y - 25, w: 4, h: 15, vx: 0, vy: -12, color: COLORS.bullet });
    }
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.dx * 0.02); 
  
  // Draw Shield if Active
  if (player.shield) {
      drawGlow("#0ff", 10);
      ctx.strokeStyle = "#0ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI*2);
      ctx.stroke();
      resetGlow();
  }

  drawGlow(COLORS.player, 15);
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(-15, 15);
  ctx.lineTo(0, 5);
  ctx.lineTo(15, 15);
  ctx.closePath();
  ctx.fill();
  
  if (Math.random() > 0.5) {
    ctx.fillStyle = "orange";
    ctx.shadowColor = "red";
    ctx.beginPath();
    ctx.moveTo(-5, 15);
    ctx.lineTo(0, 25 + Math.random() * 10);
    ctx.lineTo(5, 15);
    ctx.fill();
  }
  ctx.restore();
  resetGlow();
}

function updateEntities() {
  // --- BULLETS ---
  bullets.forEach((b, i) => {
    b.x += b.vx;
    b.y += b.vy;
    drawGlow(b.color, 10);
    ctx.fillRect(b.x - b.w/2, b.y, b.w, b.h);
    resetGlow();
    if (b.y < 0 || b.y > canvas.height) bullets.splice(i, 1);
  });

  // --- ENEMIES ---
  if (game.frames % (75 - game.level * 5) === 0 && !boss) {
    enemies.push({
      x: Math.random() * (canvas.width - 40) + 20,
      y: -40,
      size: 20,
      speed: 1.5 + Math.random() * game.level,
      angle: 0
    });
  }

  enemies.forEach((e, i) => {
    e.y += e.speed;
    e.angle += 0.05;
    drawPoly(e.x, e.y, e.size, 4, COLORS.enemy, e.angle);

    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist < e.size + 15) {
      if (player.shield) {
          player.shield = false;
          spawnExplosion(player.x, player.y, "#0ff", 15);
          enemies.splice(i, 1); // Shield kills enemy on impact
      } else {
          game.shake = 20;
          game.lives--;
          spawnExplosion(player.x, player.y, COLORS.player, 20);
          enemies.splice(i, 1);
          if (game.lives <= 0) endGame();
      }
    }

    bullets.forEach((b, bi) => {
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.size) {
        spawnExplosion(e.x, e.y, COLORS.enemy);
        enemies.splice(i, 1);
        bullets.splice(bi, 1);
        game.score += 50;
        
        if (Math.random() < 0.1) powerups.push({ x: e.x, y: e.y, vy: 2, type: 'weapon' });
        if (Math.random() < 0.1) powerups.push({ x: e.x, y: e.y, vy: 2, type: 'life' });
        if (Math.random() < 0.12) powerups.push({ x: e.x, y: e.y, vy: 2, type: 'shield' }); // 12% Shield
      }
    });
    
    if (e.y > canvas.height) enemies.splice(i, 1);
  });

  // --- POWERUPS ---
  powerups.forEach((p, i) => {
    p.y += p.vy; 
    
    if (p.type === 'weapon') {
        drawPoly(p.x, p.y, 10, 6, "#0f0", game.frames * 0.1);
        ctx.fillStyle = "#fff";
        ctx.font = "12px Arial";
        ctx.fillText("UP", p.x - 8, p.y + 4);
    } else if (p.type === 'life') {
        drawGlow("#f00", 20);
        ctx.fillStyle = "#f00";
        ctx.fillRect(p.x - 4, p.y - 10, 8, 20);
        ctx.fillRect(p.x - 10, p.y - 4, 20, 8);
        resetGlow();
    } else if (p.type === 'shield') {
        // Shield Powerup Visual
        drawGlow("#0ff", 20);
        ctx.strokeStyle = "#0ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI*2);
        ctx.stroke();
        ctx.fillStyle = "#0ff";
        ctx.fillText("S", p.x - 4, p.y + 4);
        resetGlow();
    }
    
    if (Math.hypot(player.x - p.x, player.y - p.y) < 30) {
      if (p.type === 'weapon') {
          player.weaponLevel = 2;
          game.score += 200;
          drawGlow("#0f0", 50);
      } else if (p.type === 'life') {
          game.lives++;
          drawGlow("#f00", 50);
      } else if (p.type === 'shield') {
          player.shield = true;
          drawGlow("#0ff", 50);
      }
      powerups.splice(i, 1);
    }
  });

  // --- PARTICLES ---
  particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
    ctx.globalAlpha = 1.0;
    if (p.life <= 0) particles.splice(i, 1);
  });
}

function updateBoss() {
  if (!boss) {
    let threshold = 1000;
    if (game.level === 2) threshold = 2000;
    if (game.level === 3) threshold = 3000;
    if (game.level > 3) threshold = 1000 + (game.level * 500);

    if (game.score >= threshold) {
      // HP 120 * LEVEL
      boss = { x: canvas.width/2, y: -100, hp: 120 * game.level, w: 100, dir: 1 };
      
      if (game.level === 1) { playBgm("boss1"); game.theme = "boss1"; }
      else if (game.level === 2) { playBgm("boss2"); game.theme = "boss2"; }
      else { playBgm("final"); game.theme = "boss3"; }
    }
  }

  if (boss) {
    if (boss.y < 80) boss.y += 1.5;
    
    boss.x += boss.dir * (0.8 + game.level * 0.4);
    if (boss.x > canvas.width - 80 || boss.x < 80) boss.dir *= -1;

    if (game.theme === "boss3" && game.shake === 0) {
        game.shake = 2; 
    }

    if (game.frames % 110 === 0) {
      let offsets = [];
      if (game.level === 1) offsets = [-1, 0, 1];
      else if (game.level === 2) offsets = [-1.5, -0.5, 0.5, 1.5];
      else offsets = [-2, -1, 0, 1, 2];

      offsets.forEach(k => {
         bullets.push({
           x: boss.x, y: boss.y + 50, w: 8, h: 8, 
           vx: k * 1, 
           vy: 2.0, 
           color: COLORS.boss
         });
      });
    }

    drawBossModel(boss);

    bullets.forEach((b, bi) => {
       if (b.color === COLORS.bullet && Math.hypot(b.x - boss.x, b.y - boss.y) < 60) {
         boss.hp--;
         bullets.splice(bi, 1);
         spawnExplosion(b.x, b.y, "#fff", 2);
         if (boss.hp <= 0) {
           game.shake = 50;
           spawnExplosion(boss.x, boss.y, COLORS.boss, 100);
           boss = null;
           
           game.theme = "normal";
           
           game.level++;
           game.score = 0; 
           playBgm("normal");
         }
       }
       if (b.color === COLORS.boss && Math.hypot(b.x - player.x, b.y - player.y) < 20) {
         if (player.shield) {
             player.shield = false;
             bullets.splice(bi, 1);
             spawnExplosion(player.x, player.y, "#0ff", 15);
         } else {
             game.lives--;
             game.shake = 10;
             bullets.splice(bi, 1);
             spawnExplosion(player.x, player.y, "red", 10);
             if(game.lives <= 0) endGame();
         }
       }
    });
  }
}

function endGame() {
  game.running = false;
  stopAllBgm();
  menu.style.display = "flex";
  document.querySelector("#menu h1").innerText = "GAME OVER";
  document.querySelector("#menu p").innerHTML = `Score: ${game.score}<br>Press Enter to Restart`;
}

function loop() {
  requestAnimationFrame(loop);
  
  if (game.running) {
    game.frames++;
    
    let tx = 0, ty = 0;
    if (game.shake > 0) {
      tx = (Math.random() - 0.5) * game.shake;
      ty = (Math.random() - 0.5) * game.shake;
      game.shake *= 0.9;
      if(game.shake < 0.5) game.shake = 0;
    }

    ctx.save();
    ctx.translate(tx, ty);

    drawBackground();
    updatePlayer();
    updateEntities();
    updateBoss();
    
    ctx.fillStyle = "white";
    ctx.font = "20px Orbitron";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${game.score}`, 20, 40);
    ctx.fillText(`LEVEL: ${game.level}`, 20, 70);
    
    for(let i=0; i<game.lives; i++) {
      drawPoly(canvas.width - 40 - (i*30), 40, 10, 3, COLORS.player, -Math.PI/2);
    }
    
    ctx.restore();
  }
}

createStars();
loop();