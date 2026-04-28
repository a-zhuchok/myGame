const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const levelEl = document.getElementById("level");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayTextEl = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const leftBtn = document.getElementById("left-btn");
const rightBtn = document.getElementById("right-btn");
const launchBtn = document.getElementById("launch-btn");

const WORLD = {
  width: canvas.width,
  height: canvas.height
};

const LEVELS = [
  {
    rows: 5,
    cols: 11,
    durability: [1, 1, 1, 1, 2]
  },
  {
    rows: 6,
    cols: 12,
    durability: [2, 1, 2, 1, 2, 3]
  },
  {
    rows: 7,
    cols: 12,
    durability: [2, 2, 3, 1, 3, 2, 3]
  }
];

const COLORS = ["#5dd4ff", "#7dff95", "#ffd95f", "#ff7c7c"];

const paddle = {
  w: 140,
  h: 16,
  x: WORLD.width / 2 - 70,
  y: WORLD.height - 46,
  speed: 640,
  move: 0
};

const ball = {
  r: 9,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  speed: 420,
  stuck: true
};

let bricks = [];
let drops = [];
let score = 0;
let lives = 3;
let level = 0;
let started = false;
let gameOver = false;
let lastTs = 0;

const input = {
  left: false,
  right: false
};

function updateHud() {
  levelEl.textContent = String(level + 1);
  scoreEl.textContent = String(score);
  livesEl.textContent = String(lives);
}

function showOverlay(title, text, btnText = "Старт") {
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  startBtn.textContent = btnText;
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function resetBall(stick = true) {
  ball.x = paddle.x + paddle.w / 2;
  ball.y = paddle.y - ball.r - 1;
  ball.vx = 0;
  ball.vy = -ball.speed;
  ball.stuck = stick;
}

function createBricks(levelCfg) {
  const pad = 10;
  const top = 70;
  const brickW = (WORLD.width - pad * (levelCfg.cols + 1)) / levelCfg.cols;
  const brickH = 24;
  const out = [];
  for (let r = 0; r < levelCfg.rows; r += 1) {
    for (let c = 0; c < levelCfg.cols; c += 1) {
      out.push({
        x: pad + c * (brickW + pad),
        y: top + r * (brickH + 8),
        w: brickW,
        h: brickH,
        hp: levelCfg.durability[r] || 1
      });
    }
  }
  return out;
}

function spawnDrop(x, y) {
  if (Math.random() > 0.22) return;
  const isLife = Math.random() < 0.2;
  drops.push({
    x,
    y,
    r: 11,
    vy: 180,
    type: isLife ? "life" : "score"
  });
}

function startLevel(index) {
  level = index;
  const cfg = LEVELS[level];
  bricks = createBricks(cfg);
  drops = [];
  paddle.w = 140;
  paddle.x = WORLD.width / 2 - paddle.w / 2;
  resetBall(true);
  updateHud();
}

function launchBall() {
  if (!ball.stuck) return;
  const angle = (Math.random() * 0.8 + 0.1) * Math.PI;
  ball.vx = Math.cos(angle) * ball.speed;
  ball.vy = -Math.abs(Math.sin(angle) * ball.speed);
  ball.stuck = false;
}

function applyInput(dt) {
  paddle.move = 0;
  if (input.left) paddle.move -= 1;
  if (input.right) paddle.move += 1;
  paddle.x += paddle.move * paddle.speed * dt;
  if (paddle.x < 0) paddle.x = 0;
  if (paddle.x + paddle.w > WORLD.width) paddle.x = WORLD.width - paddle.w;

  if (ball.stuck) {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 1;
  }
}

function circleRectOverlap(c, r) {
  const nearestX = Math.max(r.x, Math.min(c.x, r.x + r.w));
  const nearestY = Math.max(r.y, Math.min(c.y, r.y + r.h));
  const dx = c.x - nearestX;
  const dy = c.y - nearestY;
  return dx * dx + dy * dy <= c.r * c.r;
}

function handleBallWallCollision() {
  if (ball.x - ball.r <= 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + ball.r >= WORLD.width) {
    ball.x = WORLD.width - ball.r;
    ball.vx = -Math.abs(ball.vx);
  }

  if (ball.y - ball.r <= 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
  }
}

function handleBallPaddleCollision() {
  const hit = circleRectOverlap(ball, paddle);
  if (!hit || ball.vy > 0 === false) return;
  const rel = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
  const clamped = Math.max(-1, Math.min(1, rel));
  const maxBounce = 1.1;
  const angle = clamped * maxBounce;
  ball.vx = Math.sin(angle) * ball.speed;
  ball.vy = -Math.cos(angle) * ball.speed;
  ball.y = paddle.y - ball.r - 1;
}

function handleBallBrickCollision() {
  for (let i = 0; i < bricks.length; i += 1) {
    const b = bricks[i];
    if (!circleRectOverlap(ball, b)) continue;

    const prevX = ball.x - ball.vx * 0.016;
    const prevY = ball.y - ball.vy * 0.016;

    if (prevY + ball.r <= b.y || prevY - ball.r >= b.y + b.h) {
      ball.vy = -ball.vy;
    } else {
      ball.vx = -ball.vx;
    }

    b.hp -= 1;
    if (b.hp <= 0) {
      bricks.splice(i, 1);
      score += 100;
      spawnDrop(b.x + b.w / 2, b.y + b.h / 2);
    } else {
      score += 40;
    }
    updateHud();
    break;
  }
}

function updateDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i -= 1) {
    const d = drops[i];
    d.y += d.vy * dt;
    if (
      d.x > paddle.x &&
      d.x < paddle.x + paddle.w &&
      d.y + d.r > paddle.y &&
      d.y - d.r < paddle.y + paddle.h
    ) {
      if (d.type === "life") {
        lives = Math.min(5, lives + 1);
      } else {
        score += 250;
      }
      updateHud();
      drops.splice(i, 1);
      continue;
    }
    if (d.y - d.r > WORLD.height) {
      drops.splice(i, 1);
    }
  }
}

function nextLevelOrWin() {
  if (bricks.length > 0) return;
  if (level + 1 < LEVELS.length) {
    showOverlay("Уровень пройден", "Готов к следующему? Нажми старт", "Дальше");
    started = false;
    startLevel(level + 1);
    return;
  }
  started = false;
  gameOver = true;
  showOverlay("Победа!", `Финальный счет: ${score}`, "Играть снова");
}

function loseLife() {
  lives -= 1;
  updateHud();
  if (lives <= 0) {
    started = false;
    gameOver = true;
    showOverlay("Игра окончена", `Ты набрал ${score} очков`, "Новая игра");
    return;
  }
  resetBall(true);
}

function update(dt) {
  applyInput(dt);
  if (!started || ball.stuck) return;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  handleBallWallCollision();
  handleBallPaddleCollision();
  handleBallBrickCollision();
  updateDrops(dt);
  nextLevelOrWin();

  if (ball.y - ball.r > WORLD.height) {
    loseLife();
  }
}

function drawBricks() {
  for (const b of bricks) {
    const color = COLORS[Math.max(0, Math.min(COLORS.length - 1, b.hp - 1))];
    ctx.fillStyle = color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "rgba(9, 14, 28, 0.45)";
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
}

function drawDrops() {
  for (const d of drops) {
    ctx.beginPath();
    ctx.fillStyle = d.type === "life" ? "#ff77cb" : "#ffe66f";
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#091225";
    ctx.font = "bold 14px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(d.type === "life" ? "♥" : "$", d.x, d.y + 1);
  }
}

function draw() {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = "#0f1731";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  drawBricks();
  drawDrops();

  ctx.fillStyle = "#88b8ff";
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

  ctx.beginPath();
  ctx.fillStyle = "#f5f7ff";
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  if (ball.stuck && started) {
    ctx.fillStyle = "rgba(220, 229, 255, 0.8)";
    ctx.font = "18px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("Нажми Пуск / Пробел", WORLD.width / 2, WORLD.height - 90);
  }
}

function loop(ts) {
  const dt = Math.min(0.02, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function restartGame() {
  score = 0;
  lives = 3;
  level = 0;
  started = true;
  gameOver = false;
  startLevel(0);
  resetBall(true);
  hideOverlay();
  updateHud();
}

function continueOrStart() {
  if (gameOver) {
    restartGame();
    return;
  }
  started = true;
  hideOverlay();
}

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
  if (e.code === "Space") {
    e.preventDefault();
    if (!started) continueOrStart();
    else launchBall();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
});

function bindHold(btn, key) {
  const start = (ev) => {
    ev.preventDefault();
    input[key] = true;
  };
  const stop = (ev) => {
    ev.preventDefault();
    input[key] = false;
  };
  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", stop);
  btn.addEventListener("pointercancel", stop);
  btn.addEventListener("pointerleave", stop);
}

bindHold(leftBtn, "left");
bindHold(rightBtn, "right");

launchBtn.addEventListener("click", () => {
  if (!started) {
    continueOrStart();
    return;
  }
  launchBall();
});

canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WORLD.width;
  paddle.x = x - paddle.w / 2;
  if (paddle.x < 0) paddle.x = 0;
  if (paddle.x + paddle.w > WORLD.width) paddle.x = WORLD.width - paddle.w;
});

canvas.addEventListener("pointermove", (e) => {
  if ((e.buttons & 1) !== 1) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WORLD.width;
  paddle.x = x - paddle.w / 2;
  if (paddle.x < 0) paddle.x = 0;
  if (paddle.x + paddle.w > WORLD.width) paddle.x = WORLD.width - paddle.w;
});

startBtn.addEventListener("click", () => {
  continueOrStart();
});

startLevel(0);
showOverlay("Арканоид", "Стрелки / A D для движения. Пробел или Пуск для запуска.");
requestAnimationFrame(loop);
