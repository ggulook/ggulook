let scene, camera, renderer, player3d;
let obstacles3d = [], stars3d = [];
let game3dActive = false;
let moveSpeed = 0.2;
let baseSpeed = 0.2;
let boostMultiplier = 1.5;
let isBoosted = false;
let boostTimer = 0;
let score3d = 0;
let keys = { a: false, d: false };
let isInitialized = false;

// 3D 게임 오버 화면 요소
const gameOver3dScreen = document.getElementById('game-over-3d-screen');
const finalScore3dElement = document.getElementById('final-score-3d');
const restart3dBtn = document.getElementById('restart-3d-btn');
const home3dMenuBtn = document.getElementById('home-3d-menu-btn');


function init3D() {
  if (isInitialized) return true;
  if (typeof THREE === 'undefined') {
    console.error('Three.js is not loaded');
    return false;
  }

  const threeContainer = document.getElementById('three-container');
  if (!threeContainer) return false;

    // 이전 렌더러가 있다면 삭제
  while (threeContainer.firstChild) {
    threeContainer.removeChild(threeContainer.firstChild);
  }


  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 10, 50);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  threeContainer.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
  sunLight.position.set(5, 10, 7.5);
  scene.add(sunLight);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(20, 1000);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Player
  const playerGeo = new THREE.SphereGeometry(0.5, 32, 32);
  const playerMat = new THREE.MeshStandardMaterial({ color: 0x662113 });
  player3d = new THREE.Mesh(playerGeo, playerMat);
  player3d.position.y = 0.5;
  scene.add(player3d);

  camera.position.set(0, 3, 5);
  camera.lookAt(player3d.position);

  window.addEventListener('keydown', (e) => { 
    if(e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = true; 
  });
  window.addEventListener('keyup', (e) => { 
    if(e.key.toLowerCase() in keys) keys[e.key.toLowerCase()] = false; 
  });
  
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  isInitialized = true;
  return true;
}

function spawnVaticanObstacle(zPos) {
  const isDome = Math.random() > 0.5;
  let mesh;
  
  if (isDome) {
    const geo = new THREE.SphereGeometry(1.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    mesh = new THREE.Mesh(geo, mat);
  } else {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 4, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    mesh = new THREE.Mesh(geo, mat);
  }

  mesh.position.set((Math.random() - 0.5) * 15, isDome ? 0 : 2, zPos);
  scene.add(mesh);
  obstacles3d.push(mesh);
}

function spawnStar(zPos) {
  const geo = new THREE.OctahedronGeometry(0.4, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00 });
  const star = new THREE.Mesh(geo, mat);
  star.position.set((Math.random() - 0.5) * 10, 1.5, zPos);
  scene.add(star);
  stars3d.push(star);
}

function update3D() {
  if (!game3dActive) return;

  const currentSpeed = isBoosted ? baseSpeed * boostMultiplier : baseSpeed;
  
  // Player automatically moves forward
  player3d.position.z -= currentSpeed;

  // Sideways movement
  if (keys.a) player3d.position.x -= moveSpeed;
  if (keys.d) player3d.position.x += moveSpeed;

  player3d.position.x = Math.max(-9, Math.min(9, player3d.position.x));

  camera.position.z = player3d.position.z + 5;
  camera.position.x = player3d.position.x * 0.5;
  camera.lookAt(player3d.position.x, 1, player3d.position.z - 5);

  if (isBoosted) {
    boostTimer--;
    if (boostTimer <= 0) {
      isBoosted = false;
      document.getElementById('speed-indicator').classList.add('hidden');
    }
  }

  if (Math.random() < 0.05) spawnVaticanObstacle(player3d.position.z - 100);
  if (Math.random() < 0.03) spawnStar(player3d.position.z - 80);


  const playerBox = new THREE.Box3().setFromObject(player3d);

  for (let i = obstacles3d.length - 1; i >= 0; i--) {
    const obs = obstacles3d[i];
    const obsBox = new THREE.Box3().setFromObject(obs);
    
    if (playerBox.intersectsBox(obsBox)) {
      gameOver3D();
      return;
    }

    if (obs.position.z > player3d.position.z + 10) {
      scene.remove(obs);
      obstacles3d.splice(i, 1);
      score3d++;
      document.getElementById('score-3d').textContent = `Score: ${score3d}`;
    }
  }

  for (let i = stars3d.length - 1; i >= 0; i--) {
    const star = stars3d[i];
    star.rotation.y += 0.05;
    const starBox = new THREE.Box3().setFromObject(star);

    if (playerBox.intersectsBox(starBox)) {
      isBoosted = true;
      boostTimer = 300;
      document.getElementById('speed-indicator').classList.remove('hidden');
      scene.remove(star);
      stars3d.splice(i, 1);
      score3d += 5;
      document.getElementById('score-3d').textContent = `Score: ${score3d}`;
    } else if (star.position.z > player3d.position.z + 10) {
      scene.remove(star);
      stars3d.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(update3D);
}

function start3DGame() {
  if (!init3D()) {
    alert('3D 엔진을 초기화할 수 없습니다.');
    return;
  }
  
  game3dActive = true;
  score3d = 0;
  document.getElementById('score-3d').textContent = `Score: ${score3d}`;
  player3d.position.set(0, 0.5, 0);
  
  gameOver3dScreen.classList.add('hidden');

  obstacles3d.forEach(o => scene.remove(o));
  stars3d.forEach(s => scene.remove(s));
  obstacles3d = [];
  stars3d = [];
  
  // Reset keys
  keys.a = false;
  keys.d = false;

  update3D();
}

function gameOver3D() {
  game3dActive = false;
  finalScore3dElement.textContent = `Score: ${score3d}`;
  gameOver3dScreen.classList.remove('hidden');
}

function stop3DAndReturn() {
  game3dActive = false;
  gameOver3dScreen.classList.add('hidden');
  document.getElementById('game-3d-screen').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
}

document.getElementById('home-3d-btn').addEventListener('click', stop3DAndReturn);
restart3dBtn.addEventListener('click', start3DGame);
home3dMenuBtn.addEventListener('click', stop3DAndReturn);