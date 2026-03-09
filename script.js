const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');

// Spielzustand und Konstanten in einem Objekt halten = leichter zu verstehen.
const game = {
  width: 800,
  height: 600,
  score: 0,
  lives: 3,
  isGameOver: false,
  isPaused: false,
  keys: {
    left: false,
    right: false,
    thrust: false,
    shoot: false,
  },
  ship: null,
  asteroids: [],
  lasers: [],
  stars: [],
  lastShotAt: 0,
  invulnerableUntil: 0,
};

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  game.width = canvas.width;
  game.height = canvas.height;

  if (!game.ship) return;

  // Bei Resize das Schiff im sichtbaren Bereich halten.
  game.ship.x = Math.min(game.ship.x, game.width);
  game.ship.y = Math.min(game.ship.y, game.height);
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function wrapPosition(entity) {
  if (entity.x < 0) entity.x += game.width;
  if (entity.x > game.width) entity.x -= game.width;
  if (entity.y < 0) entity.y += game.height;
  if (entity.y > game.height) entity.y -= game.height;
}

function spawnStars(count = 140) {
  game.stars = [];
  for (let i = 0; i < count; i += 1) {
    game.stars.push({
      x: Math.random() * game.width,
      y: Math.random() * game.height,
      radius: random(0.6, 2.2),
      alpha: random(0.2, 0.9),
      twinkle: random(0.005, 0.02),
    });
  }
}

function createShip() {
  return {
    x: game.width / 2,
    y: game.height / 2,
    angle: -Math.PI / 2,
    radius: 14,
    vx: 0,
    vy: 0,
    rotationSpeed: 0.07,
    thrustPower: 0.14,
    friction: 0.992,
    coastFriction: 0.965,
    stopThreshold: 0.04,
  };
}

function createAsteroid(size, x = null, y = null) {
  const radiusBySize = {
    3: random(44, 58),
    2: random(26, 36),
    1: random(14, 20),
  };

  let spawnX = x;
  let spawnY = y;

  // Neue Asteroiden starten zufällig am Rand.
  if (spawnX === null || spawnY === null) {
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) {
      spawnX = 0;
      spawnY = random(0, game.height);
    } else if (edge === 1) {
      spawnX = game.width;
      spawnY = random(0, game.height);
    } else if (edge === 2) {
      spawnX = random(0, game.width);
      spawnY = 0;
    } else {
      spawnX = random(0, game.width);
      spawnY = game.height;
    }
  }

  const speed = random(0.6, 1.8) + (3 - size) * 0.4;
  const dir = random(0, Math.PI * 2);

  return {
    x: spawnX,
    y: spawnY,
    vx: Math.cos(dir) * speed,
    vy: Math.sin(dir) * speed,
    angle: random(0, Math.PI * 2),
    spin: random(-0.03, 0.03),
    size,
    radius: radiusBySize[size],
    // Kleine Unregelmäßigkeiten lassen den Stein „natürlicher“ aussehen.
    points: Array.from({ length: 12 }, () => random(0.8, 1.25)),
  };
}

function spawnWave(baseCount = 4) {
  const extra = Math.min(5, Math.floor(game.score / 1400));
  const count = baseCount + extra;
  for (let i = 0; i < count; i += 1) {
    game.asteroids.push(createAsteroid(3));
  }
}

function resetGame() {
  game.score = 0;
  game.lives = 3;
  game.isGameOver = false;
  game.isPaused = false;
  game.lastShotAt = 0;
  game.invulnerableUntil = 0;
  game.ship = createShip();
  game.asteroids = [];
  game.lasers = [];
  spawnWave();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(game.score);
  livesEl.textContent = String(game.lives);
}

function setControlsActive(isActive) {
  game.keys.left = isActive ? game.keys.left : false;
  game.keys.right = isActive ? game.keys.right : false;
  game.keys.thrust = isActive ? game.keys.thrust : false;
  game.keys.shoot = isActive ? game.keys.shoot : false;
}

function togglePause() {
  if (game.isGameOver) return;
  game.isPaused = !game.isPaused;
  if (game.isPaused) {
    setControlsActive(false);
  }
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function splitAsteroid(asteroid) {
  if (asteroid.size <= 1) return;

  const nextSize = asteroid.size - 1;
  game.asteroids.push(createAsteroid(nextSize, asteroid.x, asteroid.y));
  game.asteroids.push(createAsteroid(nextSize, asteroid.x, asteroid.y));
}

function shootLaser(now) {
  // Kleiner Cooldown, damit Schüsse kontrollierbar bleiben.
  if (now - game.lastShotAt < 160 || game.isGameOver) return;
  game.lastShotAt = now;

  const ship = game.ship;
  const speed = 8;
  game.lasers.push({
    x: ship.x + Math.cos(ship.angle) * ship.radius,
    y: ship.y + Math.sin(ship.angle) * ship.radius,
    vx: Math.cos(ship.angle) * speed + ship.vx * 0.4,
    vy: Math.sin(ship.angle) * speed + ship.vy * 0.4,
    life: 70,
    radius: 2,
  });
}

function updateShip(now) {
  const ship = game.ship;

  if (game.keys.left) ship.angle -= ship.rotationSpeed;
  if (game.keys.right) ship.angle += ship.rotationSpeed;

  if (game.keys.thrust) {
    ship.vx += Math.cos(ship.angle) * ship.thrustPower;
    ship.vy += Math.sin(ship.angle) * ship.thrustPower;
  }

  const damping = game.keys.thrust ? ship.friction : ship.coastFriction;
  ship.vx *= damping;
  ship.vy *= damping;

  if (Math.abs(ship.vx) < ship.stopThreshold) ship.vx = 0;
  if (Math.abs(ship.vy) < ship.stopThreshold) ship.vy = 0;
  ship.x += ship.vx;
  ship.y += ship.vy;

  wrapPosition(ship);

  if (game.keys.shoot) {
    shootLaser(now);
  }
}

function updateLasers() {
  game.lasers = game.lasers.filter((laser) => {
    laser.x += laser.vx;
    laser.y += laser.vy;
    wrapPosition(laser);
    laser.life -= 1;
    return laser.life > 0;
  });
}

function updateAsteroids() {
  game.asteroids.forEach((asteroid) => {
    asteroid.x += asteroid.vx;
    asteroid.y += asteroid.vy;
    asteroid.angle += asteroid.spin;
    wrapPosition(asteroid);
  });

  if (!game.isGameOver && game.asteroids.length === 0) {
    spawnWave(5);
  }
}

function handleLaserHits() {
  const removedAsteroids = new Set();
  const removedLasers = new Set();

  game.lasers.forEach((laser, laserIndex) => {
    game.asteroids.forEach((asteroid, asteroidIndex) => {
      if (removedAsteroids.has(asteroidIndex) || removedLasers.has(laserIndex)) return;

      const hitDistance = asteroid.radius + laser.radius;
      if (distanceSquared(laser, asteroid) <= hitDistance * hitDistance) {
        removedAsteroids.add(asteroidIndex);
        removedLasers.add(laserIndex);

        splitAsteroid(asteroid);
        game.score += asteroid.size === 3 ? 20 : asteroid.size === 2 ? 50 : 100;
      }
    });
  });

  game.asteroids = game.asteroids.filter((_, index) => !removedAsteroids.has(index));
  game.lasers = game.lasers.filter((_, index) => !removedLasers.has(index));
}

function handleShipCollisions(now) {
  if (now < game.invulnerableUntil || game.isGameOver) return;

  const ship = game.ship;
  for (const asteroid of game.asteroids) {
    const hitDistance = ship.radius + asteroid.radius * 0.82;
    if (distanceSquared(ship, asteroid) <= hitDistance * hitDistance) {
      game.lives -= 1;
      game.invulnerableUntil = now + 2200;

      // Schiff nach Treffer kurz neu positionieren.
      ship.x = game.width / 2;
      ship.y = game.height / 2;
      ship.vx = 0;
      ship.vy = 0;

      if (game.lives <= 0) {
        game.isGameOver = true;
      }
      updateHud();
      break;
    }
  }
}

function drawStars() {
  ctx.fillStyle = '#04050d';
  ctx.fillRect(0, 0, game.width, game.height);

  game.stars.forEach((star) => {
    star.alpha += star.twinkle;
    if (star.alpha > 1 || star.alpha < 0.2) {
      star.twinkle *= -1;
    }

    ctx.fillStyle = `rgba(173, 216, 255, ${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawShip(now) {
  const ship = game.ship;
  const blink = now < game.invulnerableUntil && Math.floor(now / 120) % 2 === 0;
  if (blink) return;

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-12, -10);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-12, 10);
  ctx.closePath();
  ctx.stroke();

  // Schubflamme nur zeigen, wenn der Spieler wirklich Schub gibt.
  if (game.keys.thrust && !game.isGameOver) {
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(-18 - random(0, 7), 0);
    ctx.lineTo(-10, 6);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAsteroid(asteroid) {
  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.angle);

  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let i = 0; i < asteroid.points.length; i += 1) {
    const angle = (Math.PI * 2 * i) / asteroid.points.length;
    const radius = asteroid.radius * asteroid.points[i];
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawLasers() {
  ctx.fillStyle = '#38bdf8';
  game.lasers.forEach((laser) => {
    ctx.beginPath();
    ctx.arc(laser.x, laser.y, laser.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGameOver() {
  if (!game.isGameOver) return;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, game.width, game.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 56px Inter, sans-serif';
  ctx.fillText('GAME OVER', game.width / 2, game.height / 2 - 20);

  ctx.font = '500 24px Inter, sans-serif';
  ctx.fillText('Drücke R für Neustart', game.width / 2, game.height / 2 + 28);
}

function drawPauseOverlay() {
  if (!game.isPaused || game.isGameOver) return;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, game.width, game.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 52px Inter, sans-serif';
  ctx.fillText('PAUSE', game.width / 2, game.height / 2 - 10);

  ctx.font = '500 22px Inter, sans-serif';
  ctx.fillText('Drücke P zum Fortsetzen', game.width / 2, game.height / 2 + 30);
}

function gameLoop(now) {
  drawStars();

  if (!game.isGameOver && !game.isPaused) {
    updateShip(now);
    updateLasers();
    updateAsteroids();
    handleLaserHits();
    handleShipCollisions(now);
    updateHud();
  }

  game.asteroids.forEach(drawAsteroid);
  drawLasers();
  drawShip(now);
  drawPauseOverlay();
  drawGameOver();

  requestAnimationFrame(gameLoop);
}

function handleKey(isPressed, code) {
  if (code === 'ArrowLeft') game.keys.left = isPressed;
  if (code === 'ArrowRight') game.keys.right = isPressed;
  if (code === 'ArrowUp') game.keys.thrust = isPressed;
  if (code === 'Space') game.keys.shoot = isPressed && !game.isPaused;
}

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyR', 'KeyP'].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === 'KeyR') {
    resetGame();
    return;
  }

  if (event.code === 'KeyP') {
    togglePause();
    return;
  }

  handleKey(true, event.code);
});

window.addEventListener('keyup', (event) => {
  handleKey(false, event.code);
});

window.addEventListener('resize', () => {
  resizeCanvas();
  spawnStars();
});

resizeCanvas();
spawnStars();
resetGame();
requestAnimationFrame(gameLoop);
