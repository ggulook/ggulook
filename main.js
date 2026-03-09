const player = document.getElementById('player');
const gameContainer = document.getElementById('game-container');
const scoreElement = document.getElementById('score');
const gameMessage = document.getElementById('game-message');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// 게임 설정
const GRAVITY = 0.6;
const JUMP_STRENGTH = -10;
const SPAWN_RATE = 1500; // ms
const MIN_OBSTACLE_HEIGHT = 30;
const MAX_OBSTACLE_HEIGHT = 80;
const HITBOX_PADDING = 8; // 히트박스 축소 보정 (픽셀)
const MAX_JUMPS = 2; // 최대 점프 가능 횟수 (이단 점프)

let playerY = 0;
let playerVelocity = 0;
let jumpCount = 0; // 현재 점프 횟수
let score = 0;
let gameActive = false;
let obstacles = [];
let animationFrameId;
let lastSpawnTime = 0;

// 테마 초기화
const savedTheme = localStorage.getItem('theme') || 'light';
body.setAttribute('data-theme', savedTheme);
updateButtonText(savedTheme);

themeToggle.addEventListener('click', () => {
  const currentTheme = body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  body.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateButtonText(newTheme);
});

function updateButtonText(theme) {
  themeToggle.textContent = theme === 'dark' ? '화이트 모드로 전환' : '다크 모드로 전환';
}

// 점프 로직 (이단 점프 가능)
function jump() {
  if (!gameActive) {
    startGame();
    return;
  }
  if (jumpCount < MAX_JUMPS) {
    playerVelocity = JUMP_STRENGTH;
    jumpCount++;
    player.style.transform = 'rotate(-20deg)';
  }
}

function startGame() {
  gameActive = true;
  score = 0;
  playerY = 0;
  playerVelocity = 0;
  jumpCount = 0;
  obstacles.forEach(obs => obs.remove());
  obstacles = [];
  scoreElement.textContent = `Score: ${score}`;
  gameMessage.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  lastSpawnTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function gameOver() {
  gameActive = false;
  cancelAnimationFrame(animationFrameId);
  gameOverScreen.classList.remove('hidden');
  finalScoreElement.textContent = `Score: ${score}`;
}

function spawnObstacle() {
  const height = Math.floor(Math.random() * (MAX_OBSTACLE_HEIGHT - MIN_OBSTACLE_HEIGHT)) + MIN_OBSTACLE_HEIGHT;
  const obstacle = document.createElement('div');
  obstacle.className = 'obstacle';
  obstacle.style.height = `${height}px`;
  obstacle.style.right = '-50px';
  gameContainer.appendChild(obstacle);
  obstacles.push(obstacle);
}

function updateObstacles() {
  const speed = 5 + (score / 10); // 점수가 오를수록 빨라짐
  
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];
    const currentRight = parseFloat(obstacle.style.right);
    obstacle.style.right = `${currentRight + speed}px`;

    // 충돌 감지 (히트박스 보정 적용)
    const playerRect = player.getBoundingClientRect();
    const obstacleRect = obstacle.getBoundingClientRect();

    if (
      playerRect.left + HITBOX_PADDING < obstacleRect.right - HITBOX_PADDING &&
      playerRect.right - HITBOX_PADDING > obstacleRect.left + HITBOX_PADDING &&
      playerRect.bottom - HITBOX_PADDING > obstacleRect.top + HITBOX_PADDING
    ) {
      gameOver();
    }

    // 화면 밖으로 나간 장애물 제거 및 점수 획득
    if (currentRight > 850) {
      obstacle.remove();
      obstacles.splice(i, 1);
      score++;
      scoreElement.textContent = `Score: ${score}`;
    }
  }
}

function gameLoop(timestamp) {
  if (!gameActive) return;

  // 플레이어 물리 엔진
  playerVelocity += GRAVITY;
  playerY += playerVelocity;

  // 지면 착지 판정
  if (playerY > 0) {
    playerY = 0;
    playerVelocity = 0;
    jumpCount = 0; // 점프 횟수 초기화
    player.style.transform = 'rotate(0deg)';
  }

  player.style.bottom = `${50 - playerY}px`;

  // 장애물 생성
  if (timestamp - lastSpawnTime > SPAWN_RATE) {
    spawnObstacle();
    lastSpawnTime = timestamp;
  }

  updateObstacles();

  animationFrameId = requestAnimationFrame(gameLoop);
}

// 이벤트 리스너
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    jump();
  }
});

gameContainer.addEventListener('mousedown', (e) => {
  e.preventDefault();
  jump();
});

restartBtn.addEventListener('click', startGame);
