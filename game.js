const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const overlayBtn = document.getElementById('overlayBtn');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const LEVELS = [
  ['011111111110', '011111111110', '001111111100', '000111111000'],
  ['111001111001', '111001111001', '001111001111', '001111001111', '000111111000'],
  ['111111111111', '101010101011', '111111111111', '110011001111', '111111111111']
];

const state = {
  status: 'start',
  score: 0,
  lives: 3,
  levelIndex: 0,
  rightPressed: false,
  leftPressed: false,
  paddleBoostTimer: 0,
  balls: [],
  frame: 0,
  paddle: {
    width: 130,
    baseWidth: 130,
    height: 16,
    x: WIDTH / 2 - 65,
    speed: 8
  },
  bricks: [],
  powerUps: []
};

function createBall(x = WIDTH / 2, y = HEIGHT - 80, speedX = 4, speedY = -5) {
  return { x, y, radius: 9, dx: speedX, dy: speedY, color: '#e2e8f0' };
}

function buildLevel(levelIndex) {
  const pattern = LEVELS[levelIndex];
  const rows = pattern.length;
  const cols = pattern[0].length;
  const topOffset = 85;
  const sidePadding = 60;
  const gap = 6;
  const brickWidth = (WIDTH - sidePadding * 2 - gap * (cols - 1)) / cols;
  const brickHeight = 22;

  const bricks = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (pattern[r][c] === '1') {
        bricks.push({
          x: sidePadding + c * (brickWidth + gap),
          y: topOffset + r * (brickHeight + gap),
          width: brickWidth,
          height: brickHeight,
          alive: true,
          color: `hsl(${(r * 45 + c * 12) % 360} 85% 58%)`
        });
      }
    }
  }
  state.bricks = bricks;
}

function resetForLevel() {
  buildLevel(state.levelIndex);
  state.paddle.width = state.paddle.baseWidth;
  state.paddle.x = WIDTH / 2 - state.paddle.width / 2;
  state.paddleBoostTimer = 0;
  state.powerUps = [];
  state.balls = [createBall(WIDTH / 2, HEIGHT - 80, 3.2 + state.levelIndex * 0.75, -4.8 - state.levelIndex * 0.5)];
  updateHUD();
}

function updateHUD() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(state.lives);
  levelEl.textContent = String(state.levelIndex + 1);
}

function setOverlay(title, message, buttonText = 'Weiter') {
  overlayTitle.textContent = title;
  overlayMessage.innerHTML = message;
  overlayBtn.textContent = buttonText;
  overlay.classList.add('visible');
}

function hideOverlay() {
  overlay.classList.remove('visible');
}

function startNewGame() {
  state.score = 0;
  state.lives = 3;
  state.levelIndex = 0;
  state.status = 'running';
  resetForLevel();
  hideOverlay();
}

function pauseGame() {
  if (state.status !== 'running') return;
  state.status = 'paused';
  setOverlay('Pausiert', 'Drücke <strong>Leertaste</strong> oder den Button zum Fortsetzen.', 'Fortsetzen');
}

function resumeGame() {
  if (!['paused', 'start', 'levelClear', 'gameOver', 'won'].includes(state.status)) return;

  if (state.status === 'start') {
    startNewGame();
    return;
  }
  if (state.status === 'levelClear') {
    state.levelIndex += 1;
    if (state.levelIndex >= LEVELS.length) {
      state.status = 'won';
      setOverlay('Gewonnen! 🎉', `Endscore: <strong>${state.score}</strong><br/>Drücke R oder starte neu.`, 'Neues Spiel');
      return;
    }
    resetForLevel();
  }
  if (state.status === 'gameOver' || state.status === 'won') {
    startNewGame();
    return;
  }

  state.status = 'running';
  hideOverlay();
}

function movePaddle() {
  if (state.rightPressed) state.paddle.x += state.paddle.speed;
  if (state.leftPressed) state.paddle.x -= state.paddle.speed;
  state.paddle.x = Math.max(0, Math.min(WIDTH - state.paddle.width, state.paddle.x));
}

function spawnPowerUp(x, y) {
  state.powerUps.push({ x, y, width: 20, height: 20, dy: 2.2, type: 'paddleBoost' });
}

function updatePowerUps() {
  state.powerUps.forEach((p) => {
    p.y += p.dy;
  });

  state.powerUps = state.powerUps.filter((p) => {
    const hitsPaddle =
      p.y + p.height >= HEIGHT - state.paddle.height - 12 &&
      p.x + p.width >= state.paddle.x &&
      p.x <= state.paddle.x + state.paddle.width;

    if (hitsPaddle) {
      state.paddle.width = Math.min(state.paddle.baseWidth * 1.6, state.paddle.width * 1.45);
      state.paddleBoostTimer = 720;
      return false;
    }

    return p.y < HEIGHT + 30;
  });

  if (state.paddleBoostTimer > 0) {
    state.paddleBoostTimer -= 1;
    if (state.paddleBoostTimer === 0) {
      state.paddle.width = state.paddle.baseWidth;
    }
  }
}

function handleBall(ball) {
  ball.x += ball.dx;
  ball.y += ball.dy;

  if (ball.x + ball.radius > WIDTH || ball.x - ball.radius < 0) ball.dx *= -1;
  if (ball.y - ball.radius < 0) ball.dy *= -1;

  const paddleTop = HEIGHT - state.paddle.height - 12;
  if (
    ball.y + ball.radius >= paddleTop &&
    ball.y + ball.radius <= paddleTop + 16 &&
    ball.x >= state.paddle.x &&
    ball.x <= state.paddle.x + state.paddle.width
  ) {
    const hitPos = (ball.x - (state.paddle.x + state.paddle.width / 2)) / (state.paddle.width / 2);
    ball.dx = hitPos * 6.2;
    ball.dy = -Math.abs(ball.dy);
  }

  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    const hit =
      ball.x + ball.radius > brick.x &&
      ball.x - ball.radius < brick.x + brick.width &&
      ball.y + ball.radius > brick.y &&
      ball.y - ball.radius < brick.y + brick.height;

    if (hit) {
      brick.alive = false;
      ball.dy *= -1;
      state.score += 100;
      if (Math.random() < 0.16) spawnPowerUp(brick.x + brick.width / 2 - 10, brick.y + brick.height / 2 - 10);
      break;
    }
  }
}

function updateBalls() {
  state.balls.forEach(handleBall);
  state.balls = state.balls.filter((ball) => ball.y - ball.radius <= HEIGHT + 20);

  if (state.balls.length === 0) {
    state.lives -= 1;
    if (state.lives <= 0) {
      state.status = 'gameOver';
      setOverlay('Game Over', `Du hast keine Leben mehr.<br/>Endscore: <strong>${state.score}</strong>`, 'Neustart');
    } else {
      state.balls = [createBall(WIDTH / 2, HEIGHT - 80, 3.5, -5)];
      state.paddle.x = WIDTH / 2 - state.paddle.width / 2;
    }
  }
}

function checkLevelClear() {
  const remaining = state.bricks.some((brick) => brick.alive);
  if (!remaining && state.status === 'running') {
    state.status = 'levelClear';
    setOverlay(
      'Level geschafft! 🚀',
      `Aktueller Score: <strong>${state.score}</strong><br/>Drücke Leertaste für Level ${state.levelIndex + 2}.`,
      'Nächstes Level'
    );
  }
}

function drawArenaGlowGrid() {
  ctx.save();
  const gridGap = 36;
  ctx.strokeStyle = '#22d3ee1a';
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += gridGap) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += gridGap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPaddle() {
  const y = HEIGHT - state.paddle.height - 12;
  ctx.save();
  const glow = state.paddleBoostTimer > 0 ? '#34d399' : '#38bdf8';
  ctx.shadowColor = glow;
  ctx.shadowBlur = 16;
  ctx.fillStyle = glow;
  ctx.fillRect(state.paddle.x, y, state.paddle.width, state.paddle.height);
  ctx.restore();
}

function drawBalls() {
  state.balls.forEach((ball) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 20;
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  });
}

function drawBricks() {
  const pulse = 10 + Math.sin(state.frame * 0.06) * 5;
  state.bricks.forEach((brick) => {
    if (!brick.alive) return;
    ctx.save();
    ctx.shadowColor = brick.color;
    ctx.shadowBlur = pulse;
    ctx.fillStyle = brick.color;
    ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
    ctx.restore();
  });
}

function drawPowerUps() {
  state.powerUps.forEach((p) => {
    ctx.save();
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#fde047';
    ctx.fillRect(p.x, p.y, p.width, p.height);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('+', p.x + 6, p.y + 15);
    ctx.restore();
  });
}

function drawBackgroundHints() {
  if (state.status !== 'running') return;
  ctx.fillStyle = '#93c5fd';
  ctx.font = '14px sans-serif';
  ctx.fillText('Space = Pause  |  R = Restart', 20, HEIGHT - 18);
}

function update() {
  if (state.status !== 'running') return;
  state.frame += 1;
  movePaddle();
  updateBalls();
  updatePowerUps();
  checkLevelClear();
  updateHUD();
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawArenaGlowGrid();
  drawBricks();
  drawPaddle();
  drawBalls();
  drawPowerUps();
  drawBackgroundHints();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Right' || e.key === 'ArrowRight') state.rightPressed = true;
  if (e.key === 'Left' || e.key === 'ArrowLeft') state.leftPressed = true;

  if (e.code === 'Space') {
    e.preventDefault();
    if (state.status === 'running') pauseGame();
    else resumeGame();
  }

  if (e.key.toLowerCase() === 'r') startNewGame();
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Right' || e.key === 'ArrowRight') state.rightPressed = false;
  if (e.key === 'Left' || e.key === 'ArrowLeft') state.leftPressed = false;
});

window.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const relativeX = e.clientX - rect.left;
  const scaledX = (relativeX / rect.width) * WIDTH;
  state.paddle.x = scaledX - state.paddle.width / 2;
  state.paddle.x = Math.max(0, Math.min(WIDTH - state.paddle.width, state.paddle.x));
});

overlayBtn.addEventListener('click', () => {
  if (state.status === 'running') pauseGame();
  else resumeGame();
});

setOverlay(
  'Breakout Deluxe',
  'Drücke <strong>Leertaste</strong> oder den Button, um zu starten.<br/>Schlage den Ball mit dem Paddle und räume alle 3 Level.',
  'Spiel starten'
);
updateHUD();
resetForLevel();
requestAnimationFrame(gameLoop);
