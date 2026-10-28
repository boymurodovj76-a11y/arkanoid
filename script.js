
"use strict";

// ===== ELEMENTLAR =====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");

const overlay = document.getElementById("overlay");
const overlayIcon = document.getElementById("overlayIcon");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const soundBtn = document.getElementById("soundBtn");

const W = canvas.width;
const H = canvas.height;

let score = 0;
let best = 0;
let lives = 3;
let level = 1;

let running = false;
let paused = false;
let gameOver = false;
let soundEnabled = true;
let audioContext = null;
let lastTime = 0;
let animationId = null;
let messageTimer = null;

try {
  best = Number(localStorage.getItem("arkanoidBest")) || 0;
} catch (error) {
  best = 0;
}
bestEl.textContent = best;

// ===== DIZAYNLAR =====
const themes = {
  classic: {
    background: "#071326",
    paddle: "#e5f4ff",
    ball: "#ffffff",
    bricks: ["#ff4d4d", "#ff9f43", "#ffe66d", "#4ade80", "#38bdf8", "#8b5cf6"]
  },
  neon: {
    background: "#100521",
    paddle: "#ff39e6",
    ball: "#ffffff",
    bricks: ["#ff39e6", "#ff7a18", "#ffe66d", "#39ffb6", "#27d9ff", "#a855f7"]
  },
  colorful: {
    background: "#063b54",
    paddle: "#fbbf24",
    ball: "#ffffff",
    bricks: ["#ef4444", "#f97316", "#facc15", "#22c55e", "#06b6d4", "#8b5cf6"]
  }
};

let themeName = "classic";
let theme = themes[themeName];

// ===== O'YIN OBYEKTLARI =====
const paddle = {
  x: W / 2 - 48,
  y: H - 42,
  w: 96,
  h: 13,
  speed: 420,
  dx: 0
};

const ball = {
  x: W / 2,
  y: H - 62,
  r: 7,
  vx: 0,
  vy: 0,
  speed: 260,
  attached: true
};

const brickSettings = {
  cols: 8,
  rows: 5,
  w: 48,
  h: 17,
  gap: 7,
  top: 64,
  left: 18
};

let bricks = [];
let keys = { left: false, right: false };

// ===== OVOZLAR =====
function playSound(type) {
  if (!soundEnabled) return;

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const sounds = {
      hit: [350, 0.045, "square"],
      brick: [520, 0.075, "sine"],
      paddle: [230, 0.06, "triangle"],
      launch: [440, 0.1, "sine"],
      lose: [160, 0.25, "sawtooth"],
      win: [720, 0.3, "sine"]
    };

    const [frequency, duration, wave] = sounds[type] || sounds.hit;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    if (type === "win") {
      oscillator.frequency.linearRampToValueAtTime(
        1000, audioContext.currentTime + duration
      );
    }

    gain.gain.setValueAtTime(0.09, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001, audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    // Ovoz qurilmada ishlamasa, o'yin davom etaveradi.
  }
}

soundBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundBtn.textContent = soundEnabled
    ? "🔊 Ovoz yoqilgan"
    : "🔇 Ovoz o‘chirilgan";

  if (soundEnabled) playSound("launch");
});

// ===== G'ISHTLAR =====
function createBricks() {
  bricks = [];

  const { cols, rows, w, h, gap, top, left } = brickSettings;
  const totalWidth = cols * w + (cols - 1) * gap;
  const startX = (W - totalWidth) / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      bricks.push({
        x: startX + col * (w + gap),
        y: top + row * (h + gap),
        w,
        h,
        color: theme.bricks[row % theme.bricks.length],
        alive: true,
        hp: level >= 3 && row < 2 ? 2 : 1
      });
    }
  }
}

// ===== TO'PNI JOYLASHTIRISH =====
function attachBall() {
  ball.attached = true;
  ball.vx = 0;
  ball.vy = 0;
  ball.x = paddle.x + paddle.w / 2;
  ball.y = paddle.y - ball.r - 2;
}

function launchBall() {
  if (!running || paused || gameOver || !ball.attached) return;

  ball.attached = false;
  ball.speed = 260 + (level - 1) * 18;

  const direction = Math.random() < 0.5 ? -1 : 1;
  ball.vx = direction * ball.speed * 0.58;
  ball.vy = -Math.sqrt(
    ball.speed * ball.speed - ball.vx * ball.vx
  );

  playSound("launch");
}

// ===== O'YINNI TAYYORLASH =====
function resetGame() {
  score = 0;
  lives = 3;
  level = 1;
  running = true;
  paused = false;
  gameOver = false;

  paddle.x = W / 2 - paddle.w / 2;
  paddle.dx = 0;
  ball.speed = 260;

  createBricks();
  attachBall();
  updateStats();
  hideOverlay();

  pauseBtn.textContent = "⏸ Pauza";
  lastTime = performance.now();

  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }

  animationId = requestAnimationFrame(gameLoop);
}

function updateStats() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  livesEl.textContent = lives;
  levelEl.textContent = level;
}

function saveBest() {
  if (score > best) {
    best = score;
    try {
      localStorage.setItem("arkanoidBest", String(best));
    } catch (error) {
      // Saqlash imkoni bo'lmasa ham o'yin ishlaydi.
    }
  }
  updateStats();
}

function showOverlay(icon, title, text, buttonText) {
  overlayIcon.textContent = icon;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startBtn.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

// ===== PAUZA =====
function togglePause() {
  if (!running || gameOver) return;

  paused = !paused;
  pauseBtn.textContent = paused ? "▶ Davom etish" : "⏸ Pauza";

  if (paused) {
    showOverlay("⏸️", "PAUZA", "Davom etishga tayyormisan?", "▶ DAVOM ETISH");
  } else {
    hideOverlay();
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
  }
}

// ===== BALL HISOBI =====
function addScore(points) {
  score += points;
  saveBest();
}

function loseLife() {
  lives--;
  playSound("lose");
  updateStats();

  if (lives <= 0) {
    running = false;
    gameOver = true;
    saveBest();

    showOverlay(
      "💥",
      "O‘YIN TUGADI",
      `Ball: ${score}. Rekordingni yangilashga urinib ko‘r!`,
      "↻ QAYTA BOSHLASH"
    );
    return;
  }

  attachBall();
  showOverlay("❤️", "HAYOT KAMAYDI", "To‘pni yana uchir!", "▶ DAVOM ETISH");

  running = false;
  clearTimeout(messageTimer);

  messageTimer = setTimeout(() => {
    if (gameOver || paused) return;
    running = true;
    hideOverlay();
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
  }, 900);
}

// ===== KEYINGI BOSQICH =====
function nextLevel() {
  level++;
  playSound("win");
  createBricks();

  paddle.w = Math.max(65, 96 - (level - 1) * 3);
  paddle.x = Math.min(
    W - paddle.w,
    Math.max(0, paddle.x)
  );

  attachBall();
  running = false;

  showOverlay(
    "🚀",
    `BOSQICH ${level}`,
    "Ajoyib! Yangi bosqich boshlandi.",
    "▶ DAVOM ETISH"
  );

  updateStats();
}

// ===== URILISHLAR =====
function updateBall(dt) {
  if (ball.attached) {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 2;
    return;
  }

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Chap va o'ng devor
  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
    playSound("hit");
  }

  if (ball.x + ball.r > W) {
    ball.x = W - ball.r;
    ball.vx = -Math.abs(ball.vx);
    playSound("hit");
  }

  // Yuqori devor
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
    playSound("hit");
  }

  // Platformaga urilish
  const hitsPaddle =
    ball.vy > 0 &&
    ball.x + ball.r >= paddle.x &&
    ball.x - ball.r <= paddle.x + paddle.w &&
    ball.y + ball.r >= paddle.y &&
    ball.y - ball.r <= paddle.y + paddle.h;

  if (hitsPaddle) {
    ball.y = paddle.y - ball.r;

    const hitPosition =
      (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);

    const angle = hitPosition * (Math.PI / 3);
    const speed = Math.hypot(ball.vx, ball.vy);

    ball.vx = speed * Math.sin(angle);
    ball.vy = -Math.abs(speed * Math.cos(angle));

    playSound("paddle");
  }

  // G'ishtlarga urilish
  for (const brick of bricks) {
    if (!brick.alive) continue;

    const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
    const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));

    const dx = ball.x - closestX;
    const dy = ball.y - closestY;

    if (dx * dx + dy * dy <= ball.r * ball.r) {
      brick.hp--;

      if (brick.hp <= 0) {
        brick.alive = false;
        addScore(10 * level);
      } else {
        addScore(3);
      }

      // Urilish tomonini aniqlash
      if (Math.abs(dx) > Math.abs(dy)) {
        ball.vx *= -1;
      } else {
        ball.vy *= -1;
      }

      playSound("brick");
      break;
    }
  }

  // To'p pastga tushdi
  if (ball.y - ball.r > H) {
    loseLife();
    return;
  }

  // Barcha g'ishtlar sindirildi
  if (bricks.every(brick => !brick.alive)) {
    nextLevel();
  }
}

// ===== HARAKAT =====
function updatePaddle(dt) {
  if (keys.left) paddle.x -= paddle.speed * dt;
  if (keys.right) paddle.x += paddle.speed * dt;

  paddle.x += paddle.dx * dt;
  paddle.dx = 0;

  paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
}

// ===== CHIZISH =====
function drawBackground() {
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, W, H);

  // Yulduzchalar
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = theme.paddle;

  for (let i = 0; i < 35; i++) {
    const x = (i * 137 + 23) % W;
    const y = (i * 89 + 31) % H;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.restore();
}

function drawBricks() {
  for (const brick of bricks) {
    if (!brick.alive) continue;

    ctx.save();

    ctx.shadowColor = brick.color;
    ctx.shadowBlur = themeName === "neon" ? 13 : 5;

    const gradient = ctx.createLinearGradient(
      brick.x, brick.y, brick.x, brick.y + brick.h
    );

    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.18, brick.color);
    gradient.addColorStop(1, brick.color);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 4);
    ctx.fill();

    if (brick.hp > 1) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.fillText("2", brick.x + brick.w / 2, brick.y + 12);
    }

    ctx.restore();
  }
}

function drawPaddle() {
  ctx.save();
  ctx.shadowColor = theme.paddle;
  ctx.shadowBlur = 16;

  const gradient = ctx.createLinearGradient(
    paddle.x, paddle.y, paddle.x, paddle.y + paddle.h
  );

  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.3, theme.paddle);
  gradient.addColorStop(1, theme.paddle);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 7);
  ctx.fill();

  ctx.restore();
}

function drawBall() {
  ctx.save();
  ctx.shadowColor = theme.ball;
  ctx.shadowBlur = 16;

  const gradient = ctx.createRadialGradient(
    ball.x - 2, ball.y - 2, 1,
    ball.x, ball.y, ball.r
  );

  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, theme.ball);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function draw() {
  drawBackground();
  drawBricks();
  drawPaddle();
  drawBall();
}

// ===== ASOSIY SIKL =====
function gameLoop(timestamp) {
  if (!running || paused || gameOver) {
    draw();
    animationId = null;
    return;
  }

  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // Katta sakrashlarni cheklash
  dt = Math.min(dt, 0.025);

  updatePaddle(dt);
  updateBall(dt);
  draw();

  if (running && !paused && !gameOver) {
    animationId = requestAnimationFrame(gameLoop);
  } else {
    animationId = null;
  }
}

// ===== TUGMALAR =====
startBtn.addEventListener("click", () => {
  if (gameOver) {
    resetGame();
    playSound("launch");
    return;
  }

  if (paused) {
    togglePause();
    return;
  }

  if (!running) {
    if (score === 0 && level === 1 && lives === 3) {
      resetGame();
    } else {
      running = true;
      hideOverlay();
      lastTime = performance.now();
      animationId = requestAnimationFrame(gameLoop);
    }
  }

  launchBall();
});

pauseBtn.addEventListener("click", togglePause);

document.getElementById("restartBtn").addEventListener("click", () => {
  clearTimeout(messageTimer);
  resetGame();
});

document.getElementById("launchBtn").addEventListener("click", () => {
  if (paused) {
    togglePause();
    return;
  }

  if (!running && !gameOver) {
    running = true;
    hideOverlay();
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
  }

  launchBall();
});

// ===== DIZAYN ALMASHTIRISH =====
document.querySelectorAll(".theme-btn").forEach(button => {
  button.addEventListener("click", () => {
    themeName = button.dataset.theme;
    theme = themes[themeName];

    document.body.classList.remove("classic", "neon", "colorful");
    document.body.classList.add(themeName);

    document.querySelectorAll(".theme-btn").forEach(btn => {
      btn.classList.toggle("active", btn === button);
    });

    bricks.forEach(brick => {
      brick.color = theme.bricks[
        Math.floor((brick.y - brickSettings.top) /
          (brickSettings.h + brickSettings.gap)) %
        theme.bricks.length
      ];
    });

    draw();
  });
});

// ===== KLAVIATURA =====
document.addEventListener("keydown", event => {
  if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    keys.left = true;
  }

  if (event.code === "ArrowRight" || event.code === "KeyD") {
    keys.right = true;
  }

  if (event.code === "Space" && !event.repeat) {
    if (paused) {
      togglePause();
    } else if (!running && !gameOver) {
      running = true;
      hideOverlay();
      lastTime = performance.now();
      animationId = requestAnimationFrame(gameLoop);
      launchBall();
    } else {
      launchBall();
    }
  }

  if (event.code === "Escape" || event.code === "KeyP") {
    togglePause();
  }
});

document.addEventListener("keyup", event => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    keys.left = false;
  }

  if (event.code === "ArrowRight" || event.code === "KeyD") {
    keys.right = false;
  }
});

window.addEventListener("blur", () => {
  keys.left = false;
  keys.right = false;
});

// ===== SICHQONCHA =====
canvas.addEventListener("pointermove", event => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const x = (event.clientX - rect.left) * scaleX;

  paddle.x = Math.max(
    0,
    Math.min(W - paddle.w, x - paddle.w / 2)
  );

  if (ball.attached) {
    ball.x = paddle.x + paddle.w / 2;
  }

  if (!running || paused || gameOver) draw();
});

// ===== TELEFON SENSORI =====
let touchStartX = null;

canvas.addEventListener("pointerdown", event => {
  touchStartX = event.clientX;

  if (event.pointerType === "touch" && ball.attached) {
    event.preventDefault();
  }
});

canvas.addEventListener("pointerup", event => {
  if (event.pointerType === "touch" && touchStartX !== null) {
    const movement = event.clientX - touchStartX;

    if (Math.abs(movement) < 12) {
      launchBall();
    }

    touchStartX = null;
  }
});

// Mobil tugmalar: bosib turganda platforma harakatlanadi.
function setupMoveButton(buttonId, direction) {
  const button = document.getElementById(buttonId);

  const press = event => {
    event.preventDefault();
    keys[direction] = true;
  };

  const release = event => {
    event.preventDefault();
    keys[direction] = false;
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

setupMoveButton("leftBtn", "left");
setupMoveButton("rightBtn", "right");

// ===== DASTLABKI HOLAT =====
createBricks();
attachBall();
updateStats();
draw();
