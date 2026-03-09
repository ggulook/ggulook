let scene, camera, renderer, player3d;
let obstacles3d = [], stars3d = [];
let game3dActive = false;
let moveSpeed = 0.2;
let baseSpeed = 0.2;
let boostMultiplier = 1.5;
let isBoosted = false;
let boostTimer = 0;
let score3d = 0;
let keys = { w: false, a: false, s: false, d: false };

const threeContainer = document.getElementById('three-container');
const score3dElement = document.getElementById('score-3d');
const speedIndicator = document.getElementById('speed-indicator');

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue
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

  // Ground (Piazza)
  const groundGeo = new THREE.PlaneGeometry(20, 1000);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Player (A simple bird-like or orb shape representing Ggulook)
  const playerGeo = new THREE.SphereGeometry(0.5, 32, 32);
  const playerMat = new THREE.MeshStandardMaterial({ color: 0x662113 });
  player3d = new THREE.Mesh(playerGeo, playerMat);
  player3d.position.y = 0.5;
  scene.add(player3d);

  camera.position.set(0, 3, 5);
  camera.lookAt(player3d.position);

  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
}

function spawnVaticanObstacle(zPos) {
  // Simple representation: Columns or small Domes
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

  // Movement
  const currentSpeed = isBoosted ? baseSpeed * boostMultiplier : baseSpeed;
  
  if (keys.w) player3d.position.z -= currentSpeed;
  if (keys.s) player3d.position.z += currentSpeed;
  if (keys.a) player3d.position.x -= currentSpeed;
  if (keys.d) player3d.position.x += currentSpeed;

  // Boundary check
  player3d.position.x = Math.max(-9, Math.min(9, player3d.position.x));

  // Camera follow
  camera.position.z = player3d.position.z + 5;
  camera.position.x = player3d.position.x * 0.5;
  camera.lookAt(player3d.position.x, 1, player3d.position.z - 5);

  // Boost logic
  if (isBoosted) {
    boostTimer--;
    if (boostTimer <= 0) {
      isBoosted = false;
      speedIndicator.classList.add('hidden');
    }
  }

  // Obstacle/Star spawn
  if (Math.random() < 0.05) spawnVaticanObstacle(player3d.position.z - 50);
  if (Math.random() < 0.02) spawnStar(player3d.position.z - 50);

  // Collision Detection
  const playerBox = new THREE.Box3().setFromObject(player3d);

  for (let i = obstacles3d.length - 1; i >= 0; i--) {
    const obs = obstacles3d[i];
    const obsBox = new THREE.Box3().setFromObject(obs);
    
    if (playerBox.intersectsBox(obsBox)) {
      gameOver3D();
    }

    // Cleanup
    if (obs.position.z > player3d.position.z + 10) {
      scene.remove(obs);
      obstacles3d.splice(i, 1);
      score3d++;
      score3dElement.textContent = `Score: ${score3d}`;
    }
  }

  for (let i = stars3d.length - 1; i >= 0; i--) {
    const star = stars3d[i];
    star.rotation.y += 0.05;
    const starBox = new THREE.Box3().setFromObject(star);

    if (playerBox.intersectsBox(starBox)) {
      isBoosted = true;
      boostTimer = 300; // ~5 seconds at 60fps
      speedIndicator.classList.remove('hidden');
      scene.remove(star);
      stars3d.splice(i, 1);
      score3d += 5;
      score3dElement.textContent = `Score: ${score3d}`;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(update3D);
}

function start3DGame() {
  game3dActive = true;
  score3d = 0;
  score3dElement.textContent = `Score: ${score3d}`;
  player3d.position.set(0, 0.5, 0);
  
  // Clear old objects
  obstacles3d.forEach(o => scene.remove(o));
  stars3d.forEach(s => scene.remove(s));
  obstacles3d = [];
  stars3d = [];
  
  update3D();
}

function gameOver3D() {
  game3dActive = false;
  alert(`Game Over! Final Score: ${score3d}`);
  stop3DAndReturn();
}

function stop3DAndReturn() {
  game3dActive = false;
  document.getElementById('game-3d-screen').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
}

document.getElementById('home-3d-btn').addEventListener('click', stop3DAndReturn);

// Initialize but don't start loop yet
init3D();
