const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = {
  I: '#22d3ee',
  J: '#3b82f6',
  L: '#f97316',
  O: '#eab308',
  S: '#22c55e',
  T: '#a855f7',
  Z: '#ef4444',
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const boardCanvas = document.getElementById('board');
const ctx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const restartBtn = document.getElementById('restart');
const pauseBtn = document.getElementById('pause');

let grid, current, nextType, score, level, lines, dropInterval, dropTimer;
let paused = false;
let gameOver = false;
let rafId = null;

function createGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomType() {
  const types = Object.keys(SHAPES);
  return types[Math.floor(Math.random() * types.length)];
}

function rotateMatrix(matrix) {
  const n = matrix.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      result[x][n - 1 - y] = matrix[y][x];
    }
  }
  return result;
}

function spawnPiece(type) {
  const shape = SHAPES[type].map((row) => row.slice());
  return {
    type,
    shape,
    x: Math.floor((COLS - shape.length) / 2),
    y: type === 'I' ? -1 : -1,
  };
}

function collides(shape, offX, offY) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const gx = current.x + x + offX;
      const gy = current.y + y + offY;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
      if (gy >= 0 && grid[gy][gx]) return true;
    }
  }
  return false;
}

function mergePiece() {
  const { shape, type } = current;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const gy = current.y + y;
      const gx = current.x + x;
      if (gy >= 0) grid[gy][gx] = COLORS[type];
    }
  }
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (grid[y].every((cell) => cell)) {
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800][cleared] * level;
    score += points;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 80);
    updateStats();
  }
}

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

function spawnNext() {
  current = spawnPiece(nextType);
  nextType = randomType();
  drawNext();
  if (collides(current.shape, 0, 0)) {
    endGame();
  }
}

function endGame() {
  gameOver = true;
  overlayText.textContent = 'GAME OVER';
  overlay.classList.remove('hidden');
  cancelAnimationFrame(rafId);
}

function hardDrop() {
  while (!collides(current.shape, 0, 1)) {
    current.y++;
    score += 2;
  }
  lockPiece();
}

function lockPiece() {
  mergePiece();
  clearLines();
  spawnNext();
  updateStats();
}

function move(dx) {
  if (!collides(current.shape, dx, 0)) current.x += dx;
}

function softDrop() {
  if (!collides(current.shape, 0, 1)) {
    current.y++;
    score += 1;
    updateStats();
  } else {
    lockPiece();
  }
}

function rotate() {
  const rotated = rotateMatrix(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const k of kicks) {
    if (!collides(rotated, k, 0)) {
      current.shape = rotated;
      current.x += k;
      return;
    }
  }
}

function drawCell(context, x, y, color) {
  context.fillStyle = color;
  context.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
  context.strokeStyle = 'rgba(0,0,0,0.3)';
  context.strokeRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
}

function draw() {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x]) drawCell(ctx, x, y, grid[y][x]);
    }
  }

  const { shape, type } = current;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const gy = current.y + y;
      if (gy < 0) continue;
      drawCell(ctx, current.x + x, gy, COLORS[type]);
    }
  }
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = SHAPES[nextType];
  const size = shape.length;
  const cell = 100 / 4;
  const offset = (4 - size) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!shape[y][x]) continue;
      nextCtx.fillStyle = COLORS[nextType];
      nextCtx.fillRect((x + offset) * cell, (y + offset) * cell, cell, cell);
    }
  }
}

function loop(timestamp) {
  if (!dropTimer) dropTimer = timestamp;
  if (!paused && !gameOver) {
    if (timestamp - dropTimer > dropInterval) {
      softDrop();
      dropTimer = timestamp;
    }
    draw();
  }
  rafId = requestAnimationFrame(loop);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  overlayText.textContent = 'PAUSED';
  overlay.classList.toggle('hidden', !paused);
  pauseBtn.textContent = paused ? '계속하기' : '일시정지';
}

function startGame() {
  grid = createGrid();
  score = 0;
  level = 1;
  lines = 0;
  dropInterval = 1000;
  dropTimer = null;
  paused = false;
  gameOver = false;
  pauseBtn.textContent = '일시정지';
  overlay.classList.add('hidden');
  nextType = randomType();
  spawnNext();
  updateStats();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', (e) => {
  if (gameOver) return;
  switch (e.key) {
    case 'ArrowLeft':
      if (!paused) move(-1);
      break;
    case 'ArrowRight':
      if (!paused) move(1);
      break;
    case 'ArrowDown':
      if (!paused) softDrop();
      break;
    case 'ArrowUp':
      if (!paused) rotate();
      break;
    case ' ':
      e.preventDefault();
      if (!paused) hardDrop();
      break;
    case 'p':
    case 'P':
      togglePause();
      break;
  }
});

restartBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);

function canAct() {
  return !paused && !gameOver;
}

function bindRepeatButton(el, action, delay = 200, interval = 80) {
  let timer = null;
  const start = (e) => {
    e.preventDefault();
    if (!canAct()) return;
    action();
    timer = setTimeout(function repeat() {
      if (canAct()) action();
      timer = setTimeout(repeat, interval);
    }, delay);
  };
  const stop = () => {
    clearTimeout(timer);
    timer = null;
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('pointerleave', stop);
}

function bindTapButton(el, action) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (canAct()) action();
  });
}

bindRepeatButton(document.getElementById('tLeft'), () => move(-1));
bindRepeatButton(document.getElementById('tRight'), () => move(1));
bindRepeatButton(document.getElementById('tDown'), softDrop);
bindTapButton(document.getElementById('tRotate'), rotate);
bindTapButton(document.getElementById('tDrop'), hardDrop);

startGame();
