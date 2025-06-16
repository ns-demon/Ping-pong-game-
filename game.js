// --- Super Advanced Ping Pong Game ---

// --- Configurable Settings ---
const GAME_WIDTH = 900, GAME_HEIGHT = 540;
const PADDLE_W = 20, PADDLE_H = 110, PADDLE_COLOR = "#3ef1c5";
const AI_PADDLE_COLOR = "#f76cbb";
const BALL_SIZE = 24, BALL_COLOR = "#fff176";
const NET_COLOR = "#e6f3ff";
const PARTICLE_COLOR = "#7ac7ff";
const POWERUP_SIZE = 32;
const POWERUPS = [
  {type: 'grow', color: '#43e97b', icon: '⬆️'},
  {type: 'shrink', color: '#f94f4f', icon: '⬇️'},
  {type: 'speed', color: '#fffa65', icon: '⚡'},
  {type: 'extraBall', color: '#ffb347', icon: '🔵'}
];
const MAX_SCORE = 7;
const BG_COLOR = "#181f36";

const SOUNDS = {
  bounce: document.getElementById("audio-bounce"),
  score: document.getElementById("audio-score"),
  powerup: document.getElementById("audio-powerup"),
  bg: document.getElementById("audio-bg")
};
let bgMusicStarted = false;

// --- DOM Elements ---
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayContent = document.getElementById("overlay-content");
const pauseBtn = document.getElementById("pause-btn");
const restartBtn = document.getElementById("restart-btn");
const resumeBtn = document.getElementById("resume-btn");
const overlayRestartBtn = document.getElementById("overlay-restart-btn");
const difficultySelect = document.getElementById("difficulty");
const highScoreSpan = document.getElementById("high-score");

// --- Game State ---
let gameState = 'init'; // 'init', 'playing', 'paused', 'over'
let difficulty = difficultySelect.value;
let playerScore = 0, aiScore = 0, highScore = 0;
let balls = [];
let player, ai;
let particles = [];
let powerups = [];
let powerupTimer = 0;
const POWERUP_INTERVAL = 8 * 60; // frames (8 sec)
let frame = 0;

// --- Local Storage High Score ---
function getHighScore() {
  return Number(localStorage.getItem("superPongHighScore") || 0);
}
function setHighScore(score) {
  localStorage.setItem("superPongHighScore", score);
  highScoreSpan.textContent = `High Score: ${score}`;
}
function updateHighScore() {
  let maxScore = Math.max(playerScore, aiScore, getHighScore());
  if (maxScore > getHighScore()) setHighScore(maxScore);
}
highScore = getHighScore();
highScoreSpan.textContent = `High Score: ${highScore}`;

// --- Paddle Object ---
class Paddle {
  constructor(x, color) {
    this.x = x;
    this.y = GAME_HEIGHT/2 - PADDLE_H/2;
    this.width = PADDLE_W;
    this.height = PADDLE_H;
    this.baseHeight = PADDLE_H;
    this.color = color;
    this.speed = 11;
    this.targetY = this.y;
    this.growTicks = 0;
    this.shrinkTicks = 0;
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 15;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.shadowBlur = 0;
  }
  moveTo(y) {
    this.y = clamp(y, 0, GAME_HEIGHT - this.height);
  }
  update() {
    // Handle grow/shrink powerups
    if (this.growTicks > 0) {
      this.growTicks--;
      if (this.growTicks === 0) this.height = this.baseHeight;
    }
    if (this.shrinkTicks > 0) {
      this.shrinkTicks--;
      if (this.shrinkTicks === 0) this.height = this.baseHeight;
    }
  }
  grow() {
    this.height = this.baseHeight * 1.5;
    this.growTicks = 6 * 60;
    this.shrinkTicks = 0;
  }
  shrink() {
    this.height = Math.max(this.baseHeight * 0.55, 30);
    this.shrinkTicks = 6 * 60;
    this.growTicks = 0;
  }
}

// --- Ball Object ---
class Ball {
  constructor(x, y, dx, dy, speed=8) {
    this.x = x;
    this.y = y;
    this.size = BALL_SIZE;
    this.dx = dx;
    this.dy = dy;
    this.baseSpeed = speed;
    this.speed = speed;
    this.lastHit = dx < 0 ? "ai" : "player"; // Ensure lastHit is never null
    this.speedTicks = 0;
  }
  draw() {
    ctx.save();
    ctx.fillStyle = BALL_COLOR;
    ctx.shadowColor = "#ffe477";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(this.x+this.size/2, this.y+this.size/2, this.size/2, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  update() {
    this.x += this.dx * this.speed;
    this.y += this.dy * this.speed;
    // Wall collision
    if (this.y <= 0 && this.dy < 0 || this.y+this.size >= GAME_HEIGHT && this.dy > 0) {
      this.dy *= -1;
      SOUNDS.bounce.currentTime = 0; SOUNDS.bounce.play();
      addParticles(this.x+this.size/2, this.y+this.size/2, 8);
      // Clamp to bounds
      this.y = clamp(this.y, 0, GAME_HEIGHT-this.size);
    }
    // Powerup effect
    if (this.speedTicks > 0) {
      this.speedTicks--;
      if (this.speedTicks === 0) this.speed = this.baseSpeed;
    }
  }
  setSpeedUp() {
    this.speed = this.baseSpeed * 1.5;
    this.speedTicks = 6 * 60;
  }
}

// --- Utility Functions ---
function clamp(val, min, max) { return Math.max(min, Math.min(val, max)); }
function rand(min, max) {
  // If called as rand(a, b): returns [a, b)
  // If called as rand([-1,1]): returns -1 or 1
  if (Array.isArray(min)) return min[Math.floor(Math.random()*min.length)];
  return Math.random() * (max-min) + min;
}
function pick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

// --- Particles for Effects ---
function addParticles(x, y, n=12) {
  for (let i=0; i<n; i++) {
    particles.push({
      x, y,
      dx: Math.cos(2*Math.PI*i/n) * rand(2,4),
      dy: Math.sin(2*Math.PI*i/n) * rand(2,4),
      radius: rand(2,6),
      alpha: 1
    });
  }
}
function drawParticles() {
  particles.forEach(p=>{
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = PARTICLE_COLOR;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  });
}
function updateParticles() {
  for (let i=particles.length-1; i>=0; i--) {
    let p = particles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.radius *= 0.94;
    p.alpha *= 0.92;
    if (p.radius < 0.5 || p.alpha < 0.1) particles.splice(i,1);
  }
}

// --- Powerup ---
function spawnPowerup() {
  let kind = pick(POWERUPS);
  let px = rand(GAME_WIDTH*0.27, GAME_WIDTH*0.73);
  let py = rand(GAME_HEIGHT*0.15, GAME_HEIGHT*0.85);
  powerups.push({
    type: kind.type,
    color: kind.color,
    icon: kind.icon,
    x: px, y: py,
    size: POWERUP_SIZE,
    active: true
  });
}
function drawPowerups() {
  powerups.forEach(pu=>{
    if (!pu.active) return;
    ctx.save();
    ctx.globalAlpha = 0.98;
    ctx.beginPath();
    ctx.arc(pu.x, pu.y, pu.size/2, 0, Math.PI*2);
    ctx.fillStyle = pu.color;
    ctx.shadowColor = pu.color;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.font = "20px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#222";
    ctx.fillText(pu.icon, pu.x, pu.y+1);
    ctx.restore();
  });
}
function checkPowerupCollision(ball) {
  for (let pu of powerups) {
    if (!pu.active) continue;
    if (Math.abs(ball.x+ball.size/2 - pu.x) < pu.size/2 + ball.size/2 &&
        Math.abs(ball.y+ball.size/2 - pu.y) < pu.size/2 + ball.size/2) {
      pu.active = false;
      SOUNDS.powerup.currentTime = 0; SOUNDS.powerup.play();
      addParticles(pu.x, pu.y, 18);
      applyPowerup(pu.type, ball.lastHit || "player");
    }
  }
}
function applyPowerup(type, side) {
  if (type === "grow") {
    if (side==="player") player.grow();
    else ai.grow();
  } else if (type === "shrink") {
    if (side==="player") ai.shrink();
    else player.shrink();
  } else if (type === "speed") {
    balls.forEach(b=>b.setSpeedUp());
  } else if (type === "extraBall") {
    // Add a new ball in random direction
    balls.push(new Ball(
      GAME_WIDTH/2-BALL_SIZE/2,
      GAME_HEIGHT/2-BALL_SIZE/2,
      Math.random()>0.5?1:-1,
      rand(-0.5,0.5),
      8
    ));
  }
}

// --- Game Logic ---

// Reset game objects
function resetGame() {
  playerScore = 0; aiScore = 0;
  player = new Paddle(24, PADDLE_COLOR);
  ai = new Paddle(GAME_WIDTH-24-PADDLE_W, AI_PADDLE_COLOR);
  // Fix: Use Math.random() > 0.5 ? 1 : -1 for direction
  balls = [new Ball(
    GAME_WIDTH/2-BALL_SIZE/2,
    GAME_HEIGHT/2-BALL_SIZE/2,
    Math.random() > 0.5 ? 1 : -1,
    rand(-0.5,0.5),
    8
  )];
  particles = [];
  powerups = [];
  frame = 0; powerupTimer = 0;
  updateScoreUI();
}

// Update score UI
function updateScoreUI() {
  document.title = `Pong | ${playerScore} : ${aiScore}`;
  updateHighScore();
}

// Draw net
function drawNet() {
  ctx.save();
  ctx.strokeStyle = NET_COLOR;
  ctx.lineWidth = 6;
  ctx.setLineDash([16, 18]);
  ctx.beginPath();
  ctx.moveTo(GAME_WIDTH/2, 0);
  ctx.lineTo(GAME_WIDTH/2, GAME_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// Draw scores
function drawScores() {
  ctx.save();
  ctx.font = "bold 52px Segoe UI";
  ctx.fillStyle = "#ffe477";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(playerScore, GAME_WIDTH/2 - 90, 22);
  ctx.fillText(aiScore, GAME_WIDTH/2 + 90, 22);
  ctx.restore();
}

// Draw all objects
function draw() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  // BG
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawNet();
  drawScores();
  player.draw();
  ai.draw();
  balls.forEach(ball=>ball.draw());
  drawPowerups();
  drawParticles();
}

// --- Ball / Paddle Collision ---
function checkPaddleCollision(ball, paddle, side) {
  if (ball.x < paddle.x + paddle.width && ball.x + ball.size > paddle.x &&
      ball.y < paddle.y + paddle.height && ball.y + ball.size > paddle.y) {
    ball.lastHit = side;
    SOUNDS.bounce.currentTime = 0; SOUNDS.bounce.play();
    addParticles(ball.x+ball.size/2, ball.y+ball.size/2, 12);

    // Ball direction and "spin"
    let rel = ((ball.y+ball.size/2) - (paddle.y+paddle.height/2)) / (paddle.height/2);
    ball.dy = rel * 0.9;
    ball.dx = side==="player" ? Math.abs(ball.dx) : -Math.abs(ball.dx);

    // Slight increase in speed
    ball.baseSpeed *= 1.04;
    ball.speed = ball.baseSpeed;

    // Clamp ball within paddle so it doesn't get stuck
    if (side === "player") ball.x = paddle.x + paddle.width + 1;
    else ball.x = paddle.x - ball.size - 1;
  }
}

// --- Player Control (Mouse/Touch) ---
function onMove(e) {
  let rect = canvas.getBoundingClientRect();
  let clientY = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  player.moveTo(clientY - player.height/2);
}
canvas.addEventListener("mousemove", onMove);
canvas.addEventListener("touchmove", onMove, {passive:true});

// --- AI Logic ---
function aiMove(ai, balls) {
  // Target nearest ball moving toward AI
  let targetBall = balls.reduce((best, b) => {
    if (b.dx > 0) {
      if (!best || b.x > best.x) return b;
    }
    return best;
  }, null) || balls[0];
  // Predict ball destination (simple linear, improve w/difficulty)
  let predictedY = targetBall.y;
  if (difficulty === "easy") {
    ai.speed = 7;
    predictedY += rand(-80, 80);
  } else if (difficulty === "normal") {
    ai.speed = 10;
    predictedY += rand(-35, 35);
  } else {
    ai.speed = 13;
    predictedY += rand(-15, 15);
  }
  // Smooth movement
  let centerY = ai.y + ai.height/2;
  if (centerY < predictedY) ai.y += ai.speed;
  else if (centerY > predictedY) ai.y -= ai.speed;
  ai.y = clamp(ai.y, 0, GAME_HEIGHT - ai.height);
}

// --- Game Loop ---
function gameLoop() {
  if (gameState !== "playing") return;
  frame++;
  // Update objects
  player.update(); ai.update();
  aiMove(ai, balls);
  balls.forEach(ball=>{
    ball.update();
    // Collisions
    checkPaddleCollision(ball, player, "player");
    checkPaddleCollision(ball, ai, "ai");
    checkPowerupCollision(ball);
  });

  // Score detection & ball out
  for (let i=balls.length-1; i>=0; i--) {
    let ball = balls[i];
    if (ball.x < -BALL_SIZE) {
      aiScore++; SOUNDS.score.currentTime=0; SOUNDS.score.play();
      addParticles(ball.x, ball.y, 16);
      balls.splice(i,1);
      continue;
    }
    if (ball.x > GAME_WIDTH+BALL_SIZE) {
      playerScore++; SOUNDS.score.currentTime=0; SOUNDS.score.play();
      addParticles(ball.x, ball.y, 16);
      balls.splice(i,1);
      continue;
    }
  }
  if (balls.length === 0) {
    balls.push(new Ball(
      GAME_WIDTH/2-BALL_SIZE/2,
      GAME_HEIGHT/2-BALL_SIZE/2,
      Math.random() > 0.5 ? 1 : -1,
      rand(-0.5,0.5),
      8
    ));
    updateScoreUI();
  }
  // Powerup spawn
  if (frame % POWERUP_INTERVAL === 0 && powerups.length < 2) spawnPowerup();

  updateParticles();
  draw();

  // Game end?
  if (playerScore >= MAX_SCORE || aiScore >= MAX_SCORE) {
    gameState = 'over';
    showOverlay(playerScore > aiScore ? "🏆 YOU WIN!" : "🤖 AI WINS!");
    updateScoreUI();
    SOUNDS.bg.pause();
    return;
  }
  requestAnimationFrame(gameLoop);
}

// --- Overlay UI ---
function showOverlay(text) {
  overlay.hidden = false;
  overlayContent.innerHTML = text;
  resumeBtn.hidden = !(gameState === "paused");
  overlayRestartBtn.hidden = !(gameState === "over");
}
function hideOverlay() { overlay.hidden = true; }

// --- Gateway Overlay for User Interaction ---
function showGateway() {
  overlay.hidden = false;
  overlayContent.innerHTML = "Click to play Ping Pong";
  resumeBtn.hidden = true;
  overlayRestartBtn.hidden = true;
  // Disable in-game controls until started
  pauseBtn.disabled = true;
  restartBtn.disabled = true;
  difficultySelect.disabled = true;
  overlay.onclick = () => {
    overlay.onclick = null;
    hideOverlay();
    pauseBtn.disabled = false;
    restartBtn.disabled = false;
    difficultySelect.disabled = false;
    unlockAudioAndStart();
  };
}

// --- Button Events ---
pauseBtn.onclick = () => {
  if (gameState === "playing") {
    gameState = "paused";
    showOverlay("⏸️ Paused");
    SOUNDS.bg.pause();
  }
};
resumeBtn.onclick = () => {
  gameState = "playing";
  hideOverlay();
  SOUNDS.bg.play();
  requestAnimationFrame(gameLoop);
};
restartBtn.onclick = () => { startGame(); };
overlayRestartBtn.onclick = () => { startGame(); };
difficultySelect.onchange = () => {
  difficulty = difficultySelect.value;
  startGame();
};

// --- Keyboard Shortcuts ---
document.addEventListener("keydown", e => {
  if (gameState === "init") return;
  if (e.code === "Space") {
    if (gameState === "playing") pauseBtn.onclick();
    else if (gameState === "paused") resumeBtn.onclick();
  }
  if (e.key === "r") startGame();
});

// --- Responsive Canvas ---
function resizeCanvas() {
  let w = Math.min(window.innerWidth*0.97, GAME_WIDTH);
  canvas.style.width = w + "px";
}
window.addEventListener("resize", resizeCanvas);

// --- Audio Unlock (for browsers that require interaction) ---
function unlockAudioAndStart() {
  if (!bgMusicStarted) {
    SOUNDS.bg.play().catch(()=>{});
    bgMusicStarted = true;
  }
  startGame();
}

// --- Start Game ---
function startGame() {
  hideOverlay();
  gameState = "playing";
  resetGame();
  SOUNDS.bg.volume = 0.38;
  if (!bgMusicStarted) {
    SOUNDS.bg.currentTime = 0; SOUNDS.bg.play();
    bgMusicStarted = true;
  } else {
    SOUNDS.bg.play();
  }
  requestAnimationFrame(gameLoop);
  resizeCanvas();
}

window.onload = showGateway;
