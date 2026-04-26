import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

// ── 상태 ──────────────────────────────────────────────
let fwScene, fwCamera, fwRenderer, fwFaceLandmarker;
let fwActive = false;
let fwVideo;
let fwCurrentX = 0, fwCurrentY = 0;
let fwCanopies = [], fwClouds = [], fwClock = 0;

// 카메라 비행 상태
let fwCamPos   = { x: 0, y: 0, z: 0 };
let fwCamVel   = { x: 0, y: 0, z: 0 };
let fwFlying   = false;

// 새총 드래그
let fwDrag     = null;  // { sx, sy, cx, cy }  (screen coords)
let fwSlingshotCtx = null;

const SENSITIVITY  = 4;
const LERP         = 0.08;
const SLING_ORIGIN = () => ({ x: window.innerWidth / 2, y: window.innerHeight * 0.78 });
const MAX_PULL     = 130;  // px

// ── 씬 구성 ──────────────────────────────────────────
function buildScene() {
    const T = window.THREE;
    const container = document.getElementById('face-window-container');

    fwScene = new T.Scene();
    fwCamera = new T.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 20000);
    fwCamera.position.set(0, 0, 0);

    fwRenderer = new T.WebGLRenderer({ antialias: true });
    fwRenderer.setSize(container.clientWidth, container.clientHeight);
    fwRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    fwRenderer.shadowMap.enabled = true;
    fwRenderer.shadowMap.type = T.PCFSoftShadowMap;
    fwRenderer.toneMapping = T.ACESFilmicToneMapping;
    fwRenderer.toneMappingExposure = 0.6;
    container.appendChild(fwRenderer.domElement);

    // 하늘
    const sky = new T.Sky();
    sky.scale.setScalar(10000);
    fwScene.add(sky);
    const su = sky.material.uniforms;
    su['turbidity'].value = 6;
    su['rayleigh'].value = 2.5;
    su['mieCoefficient'].value = 0.004;
    su['mieDirectionalG'].value = 0.85;
    const sunDir = new T.Vector3();
    sunDir.setFromSphericalCoords(1, T.MathUtils.degToRad(50), T.MathUtils.degToRad(200));
    su['sunPosition'].value.copy(sunDir);

    // 조명
    fwScene.add(new T.AmbientLight(0xffeedd, 0.25));
    fwScene.add(new T.HemisphereLight(0x87ceeb, 0x4a7c59, 0.6));
    const sun = new T.DirectionalLight(0xfff4e0, 2.5);
    sun.position.copy(sunDir).multiplyScalar(200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 500;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -80;
    sun.shadow.camera.right = sun.shadow.camera.top = 80;
    sun.shadow.bias = -0.0005;
    fwScene.add(sun);

    // 땅
    const texLoader = new T.TextureLoader();
    const groundMat = new T.MeshStandardMaterial({ color: 0x4a7c59, roughness: 1 });
    texLoader.load(
        'https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/terrain/grasslight-big.jpg',
        tex => {
            tex.wrapS = tex.wrapT = T.RepeatWrapping;
            tex.repeat.set(40, 40);
            groundMat.map = tex;
            groundMat.needsUpdate = true;
        }
    );
    const ground = new T.Mesh(new T.PlaneGeometry(800, 800), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -4;
    ground.receiveShadow = true;
    fwScene.add(ground);

    // 나무
    fwCanopies = [];
    const trunkMat = new T.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.9 });
    const leafColors = [0x2d6a1f, 0x3a7a28, 0x1e5e15, 0x4a8c2a];
    [
        [-8,-4,-18],[8,-4,-18],[-4,-4,-22],[5,-4,-20],
        [-13,-4,-14],[13,-4,-14],[0,-4,-28],
        [-6,-4,-32],[7,-4,-30],[-16,-4,-24],[16,-4,-26],
        [-22,-4,-18],[22,-4,-20],[-30,-4,-30],[30,-4,-28]
    ].forEach(([x,y,z], idx) => {
        const h = 2.5 + Math.random() * 2;
        const trunk = new T.Mesh(new T.CylinderGeometry(0.12, 0.2, h * 0.4, 7), trunkMat);
        trunk.position.set(x, y + h * 0.2, z);
        trunk.castShadow = true;
        fwScene.add(trunk);
        [0.9, 0.65].forEach((sc, layer) => {
            const c = new T.Mesh(
                new T.ConeGeometry((1.2 + Math.random() * 0.5) * sc, h * sc, 8),
                new T.MeshStandardMaterial({ color: leafColors[idx % 4], roughness: 0.9 })
            );
            c.position.set(x, y + h * (0.55 + layer * 0.25), z);
            c.castShadow = true;
            c.userData.swayOffset = Math.random() * Math.PI * 2 + layer;
            c.userData.swaySpeed  = 0.5 + Math.random() * 0.4;
            fwScene.add(c);
            fwCanopies.push(c);
        });
    });

    // 산
    const mtColors = [0x3d5220, 0x2e4018, 0x4a5e28];
    [[-28,-4,-70],[-12,-3,-78],[6,-3.5,-74],[22,-4,-68],[38,-4,-72],
     [-50,-4,-90],[50,-4,-85],[-70,-4,-100],[70,-4,-95],[0,-4,-110]
    ].forEach(([x,y,z],i) => {
        const s = 10 + (i % 3) * 5;
        const m = new T.Mesh(
            new T.ConeGeometry(s, s * 2, 7),
            new T.MeshStandardMaterial({ color: mtColors[i % 3], roughness: 1 })
        );
        m.position.set(x, y, z);
        fwScene.add(m);
    });

    // 구름
    fwClouds = [];
    const cloudMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    [[-20,12,-40,1.2],[5,15,-50,1.0],[25,11,-45,0.8],
     [-35,14,-55,1.4],[15,13,-35,0.9],[-8,16,-60,1.1],
     [40,20,-80,1.5],[-40,18,-75,1.3],[0,22,-90,1.0]
    ].forEach(([x,y,z,sc]) => {
        const g = new T.Group();
        [[0,0,0,1],[1.2,0.2,0,0.8],[-1.1,0.1,0,0.75],[0.5,0.6,0,0.7],[-0.4,0.5,0,0.65]].forEach(([dx,dy,dz,r]) => {
            const s = new T.Mesh(new T.SphereGeometry(r*sc,7,7), cloudMat);
            s.position.set(dx*sc, dy*sc, dz*sc);
            g.add(s);
        });
        g.position.set(x, y, z);
        g.userData.speed = 0.007 + Math.random() * 0.005;
        fwScene.add(g);
        fwClouds.push(g);
    });
}

// ── 새총 UI ───────────────────────────────────────────
function initSlingshot() {
    const canvas = document.getElementById('slingshot-canvas');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    fwSlingshotCtx = canvas.getContext('2d');

    canvas.addEventListener('pointerdown', onDragStart);
    canvas.addEventListener('pointermove',  onDragMove);
    canvas.addEventListener('pointerup',    onDragEnd);
    canvas.addEventListener('pointercancel',() => { fwDrag = null; });
}

function onDragStart(e) {
    if (fwFlying) return;
    const o = SLING_ORIGIN();
    const dx = e.clientX - o.x, dy = e.clientY - o.y;
    if (Math.sqrt(dx*dx + dy*dy) > 80) return;  // 새총 근처만
    fwDrag = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
}

function onDragMove(e) {
    if (!fwDrag) return;
    fwDrag.cx = e.clientX;
    fwDrag.cy = e.clientY;
}

function onDragEnd(e) {
    if (!fwDrag) return;
    const o  = SLING_ORIGIN();
    const pw = window.innerWidth, ph = window.innerHeight;

    // 드래그 벡터: 당긴 방향의 반대로 날아감
    let dx = o.x - fwDrag.cx;   // 오른쪽으로 당기면 왼쪽으로 → 반대 = 오른쪽으로 날아감
    let dy = o.y - fwDrag.cy;   // 아래로 당기면 위로 날아감

    const dist  = Math.min(Math.sqrt(dx*dx + dy*dy), MAX_PULL);
    const power = dist / MAX_PULL;

    if (power < 0.15) { fwDrag = null; return; }  // 너무 약하면 무시

    // 정규화 후 속도 적용
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    fwCamVel.x =  (dx / len) * power * 0.25;
    fwCamVel.y =  (dy / len) * power * 0.35;
    fwCamVel.z = -power * 0.8;       // 항상 씬 안쪽으로

    fwCamPos = { x: 0, y: 0, z: 0 };
    fwFlying  = true;
    fwDrag    = null;
}

function drawSlingshot() {
    const ctx = fwSlingshotCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (fwFlying) return;

    const o  = SLING_ORIGIN();
    const cx = fwDrag ? fwDrag.cx : o.x;
    const cy = fwDrag ? fwDrag.cy : o.y;

    // 고무줄 (드래그 중)
    if (fwDrag) {
        const dx = o.x - cx, dy = o.y - cy;
        const dist = Math.min(Math.sqrt(dx*dx+dy*dy), MAX_PULL);
        const power = dist / MAX_PULL;

        ctx.strokeStyle = `rgba(180,120,40,0.9)`;
        ctx.lineWidth   = 4;
        ctx.lineCap     = 'round';

        // 왼쪽 줄
        ctx.beginPath();
        ctx.moveTo(o.x - 18, o.y - 30);
        ctx.lineTo(cx, cy);
        ctx.stroke();

        // 오른쪽 줄
        ctx.beginPath();
        ctx.moveTo(o.x + 18, o.y - 30);
        ctx.lineTo(cx, cy);
        ctx.stroke();

        // 파워 원
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,${Math.floor(200*(1-power))},0,0.85)`;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Y자 새총 틀
    ctx.strokeStyle = '#7a4a1e';
    ctx.lineWidth   = 8;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // 기둥
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + 40);
    ctx.lineTo(o.x, o.y);
    ctx.stroke();

    // 왼팔
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x - 22, o.y - 38);
    ctx.stroke();

    // 오른팔
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x + 22, o.y - 38);
    ctx.stroke();

    // 안내 텍스트 (드래그 전)
    if (!fwDrag) {
        ctx.font = '14px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('당겨서 날리기', o.x, o.y + 62);
    }
}

// ── 얼굴 추적 ─────────────────────────────────────────
async function startFaceTracking() {
    const statusEl = document.getElementById('face-window-status');
    statusEl.textContent = '모델 로딩 중...';
    const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    fwFaceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU"
        },
        runningMode: "VIDEO",
        numFaces: 1
    });
    statusEl.textContent = '카메라 권한 요청 중...';
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    fwVideo = document.getElementById('face-window-video');
    fwVideo.srcObject = stream;
    fwVideo.addEventListener("loadeddata", () => {
        statusEl.textContent = '새총을 당겨서 날아보세요!';
        detectFace();
    }, { once: true });
}

function detectFace() {
    if (!fwActive || !fwFaceLandmarker || !fwVideo) return;
    try {
        const results = fwFaceLandmarker.detectForVideo(fwVideo, performance.now());
        if (results.faceLandmarks?.[0]) {
            const nose = results.faceLandmarks[0][1];
            const tx = (nose.x - 0.5) * SENSITIVITY;
            const ty = -(nose.y - 0.5) * SENSITIVITY;
            fwCurrentX += (tx - fwCurrentX) * LERP;
            fwCurrentY += (ty - fwCurrentY) * LERP;
        }
    } catch (_) {}
    requestAnimationFrame(detectFace);
}

// ── 렌더 루프 ─────────────────────────────────────────
function renderLoop() {
    if (!fwActive || !fwRenderer) return;
    fwClock += 0.016;

    // 나무 흔들림
    fwCanopies.forEach(c => {
        const t = fwClock * c.userData.swaySpeed + c.userData.swayOffset;
        c.rotation.z = Math.sin(t) * 0.06;
        c.rotation.x = Math.sin(t * 0.7) * 0.03;
    });

    // 구름 이동
    fwClouds.forEach(c => {
        c.position.x += c.userData.speed;
        if (c.position.x > 80) c.position.x = -80;
    });

    if (fwFlying) {
        // 중력
        fwCamVel.y -= 0.004;

        fwCamPos.x += fwCamVel.x;
        fwCamPos.y += fwCamVel.y;
        fwCamPos.z += fwCamVel.z;

        fwCamera.position.set(fwCamPos.x, fwCamPos.y, fwCamPos.z);
        fwCamera.lookAt(
            fwCamPos.x + fwCamVel.x * 8,
            fwCamPos.y + fwCamVel.y * 8,
            fwCamPos.z + fwCamVel.z * 8
        );

        // 착지
        if (fwCamPos.y < -2 && fwCamVel.y < 0) {
            fwFlying = false;
            fwCamPos = { x: 0, y: 0, z: 0 };
            fwCamVel = { x: 0, y: 0, z: 0 };
        }
    } else {
        // 일반 시차 모드
        fwCamera.position.x = fwCurrentX;
        fwCamera.position.y = fwCurrentY;
        fwCamera.lookAt(fwCurrentX * 0.2, fwCurrentY * 0.2, -10);
    }

    drawSlingshot();
    fwRenderer.render(fwScene, fwCamera);
    requestAnimationFrame(renderLoop);
}

// ── 리사이즈 ──────────────────────────────────────────
function handleResize() {
    if (!fwActive || !fwRenderer || !fwCamera) return;
    const container = document.getElementById('face-window-container');
    fwCamera.aspect = container.clientWidth / container.clientHeight;
    fwCamera.updateProjectionMatrix();
    fwRenderer.setSize(container.clientWidth, container.clientHeight);
    const canvas = document.getElementById('slingshot-canvas');
    if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
}

// ── 시작 / 종료 ───────────────────────────────────────
function initFaceWindow() {
    if (fwActive) return;
    fwActive = true;
    fwCamPos = { x: 0, y: 0, z: 0 };
    fwCamVel = { x: 0, y: 0, z: 0 };
    fwFlying  = false;
    fwClock   = 0;
    buildScene();
    initSlingshot();
    renderLoop();
    window.addEventListener('resize', handleResize);
    startFaceTracking().catch(err => {
        const el = document.getElementById('face-window-status');
        if (el) el.textContent = '오류: ' + (err.message || '?');
        console.error(err);
    });
}

function stopFaceWindow() {
    fwActive = false;
    window.removeEventListener('resize', handleResize);

    const canvas = document.getElementById('slingshot-canvas');
    if (canvas) {
        canvas.removeEventListener('pointerdown', onDragStart);
        canvas.removeEventListener('pointermove',  onDragMove);
        canvas.removeEventListener('pointerup',    onDragEnd);
        if (fwSlingshotCtx) fwSlingshotCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
    fwSlingshotCtx = null;

    if (fwVideo?.srcObject) {
        fwVideo.srcObject.getTracks().forEach(t => t.stop());
        fwVideo.srcObject = null;
    }
    if (fwRenderer) {
        const container = document.getElementById('face-window-container');
        if (container?.contains(fwRenderer.domElement)) container.removeChild(fwRenderer.domElement);
        fwRenderer.dispose();
        fwRenderer = null;
    }
    fwScene = null; fwCamera = null; fwFaceLandmarker = null;
    fwCanopies = []; fwClouds = [];
}

// ── 버튼 연결 ─────────────────────────────────────────
document.getElementById('btn-face-window').addEventListener('click', () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('face-window-screen').classList.remove('hidden');
    initFaceWindow();
});

document.getElementById('home-face-window-btn').addEventListener('click', () => {
    stopFaceWindow();
    document.getElementById('face-window-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
});
