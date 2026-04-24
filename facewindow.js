// Face-tracked 3D parallax window effect using Three.js + MediaPipe
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

let fwScene, fwCamera, fwRenderer, fwFaceLandmarker;
let fwActive = false;
let fwVideo;
let fwCurrentX = 0, fwCurrentY = 0;
let fwCanopies = [];
let fwClouds = [];
let fwClock = 0;

const SENSITIVITY = 5;
const LERP = 0.08;

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

    // 물리 기반 하늘 (Rayleigh 대기 산란)
    const sky = new T.Sky();
    sky.scale.setScalar(10000);
    fwScene.add(sky);
    const su = sky.material.uniforms;
    su['turbidity'].value = 6;
    su['rayleigh'].value = 2.5;
    su['mieCoefficient'].value = 0.004;
    su['mieDirectionalG'].value = 0.85;
    const sunDir = new T.Vector3();
    sunDir.setFromSphericalCoords(1,
        T.MathUtils.degToRad(90 - 40),
        T.MathUtils.degToRad(200)
    );
    su['sunPosition'].value.copy(sunDir);

    // 조명
    fwScene.add(new T.AmbientLight(0xffeedd, 0.25));
    fwScene.add(new T.HemisphereLight(0x87ceeb, 0x4a7c59, 0.6));
    const sun = new T.DirectionalLight(0xfff4e0, 2.5);
    sun.position.copy(sunDir).multiplyScalar(200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.0005;
    fwScene.add(sun);

    // 풀밭 (텍스처)
    const texLoader = new T.TextureLoader();
    const grassMat = new T.MeshStandardMaterial({ color: 0x4a7c59, roughness: 1, metalness: 0 });
    const grassTex = texLoader.load(
        'https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/terrain/grasslight-big.jpg',
        tex => {
            tex.wrapS = tex.wrapT = T.RepeatWrapping;
            tex.repeat.set(30, 30);
            grassMat.map = tex;
            grassMat.needsUpdate = true;
        }
    );
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -4;
    ground.receiveShadow = true;
    fwScene.add(ground);

    // 나무
    fwCanopies = [];
    const treeDefs = [
        [-8, -4, -18], [8, -4, -18], [-4, -4, -22], [5, -4, -20],
        [-13, -4, -14], [13, -4, -14], [0, -4, -28],
        [-6, -4, -32], [7, -4, -30], [-16, -4, -24], [16, -4, -26]
    ];
    const trunkMat = new T.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.9 });
    const leafColors = [0x2d6a1f, 0x3a7a28, 0x1e5e15, 0x4a8c2a];
    treeDefs.forEach(([x, y, z], idx) => {
        const h = 2.5 + Math.random() * 2;
        const trunk = new T.Mesh(new T.CylinderGeometry(0.12, 0.2, h * 0.4, 7), trunkMat);
        trunk.position.set(x, y + h * 0.2, z);
        trunk.castShadow = true;
        fwScene.add(trunk);

        // 2겹 캐노피 (더 풍성하게)
        [0.9, 0.65].forEach((scale, layer) => {
            const canopy = new T.Mesh(
                new T.ConeGeometry((1.2 + Math.random() * 0.5) * scale, h * scale, 8),
                new T.MeshStandardMaterial({ color: leafColors[idx % 4], roughness: 0.9 })
            );
            canopy.position.set(x, y + h * (0.55 + layer * 0.25), z);
            canopy.castShadow = true;
            canopy.receiveShadow = true;
            canopy.userData.swayOffset = Math.random() * Math.PI * 2 + layer;
            canopy.userData.swaySpeed = 0.5 + Math.random() * 0.4;
            fwScene.add(canopy);
            fwCanopies.push(canopy);
        });
    });

    // 원경 산
    const mtColors = [0x3d5220, 0x2e4018, 0x4a5e28];
    [[-28,-4,-70],[-12,-3,-78],[6,-3.5,-74],[22,-4,-68],[38,-4,-72],[-50,-4,-90],[50,-4,-85]].forEach(([x,y,z],i) => {
        const s = 10 + (i % 3) * 4;
        const mtn = new T.Mesh(
            new T.ConeGeometry(s, s * 2, 7),
            new T.MeshStandardMaterial({ color: mtColors[i % 3], roughness: 1 })
        );
        mtn.position.set(x, y, z);
        fwScene.add(mtn);
    });

    // 구름
    fwClouds = [];
    const cloudMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
    [[-20,12,-40,1.2],[5,15,-50,1.0],[25,11,-45,0.8],[-35,14,-55,1.4],[15,13,-35,0.9],[-8,16,-60,1.1]].forEach(([x,y,z,sc]) => {
        const g = new T.Group();
        [[0,0,0,1],[1.2,0.2,0,0.8],[-1.1,0.1,0,0.75],[0.5,0.6,0,0.7],[-0.4,0.5,0,0.65]].forEach(([dx,dy,dz,r]) => {
            const s = new T.Mesh(new T.SphereGeometry(r*sc,7,7), cloudMat);
            s.position.set(dx*sc, dy*sc, dz*sc);
            g.add(s);
        });
        g.position.set(x, y, z);
        g.userData.speed = 0.008 + Math.random() * 0.006;
        fwScene.add(g);
        fwClouds.push(g);
    });
}

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
        statusEl.textContent = '얼굴을 화면 중앙에 위치시키세요';
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

function renderLoop() {
    if (!fwActive || !fwRenderer) return;
    fwClock += 0.016;

    fwCanopies.forEach(c => {
        const t = fwClock * c.userData.swaySpeed + c.userData.swayOffset;
        c.rotation.z = Math.sin(t) * 0.06;
        c.rotation.x = Math.sin(t * 0.7) * 0.03;
    });

    fwClouds.forEach(cloud => {
        cloud.position.x += cloud.userData.speed;
        if (cloud.position.x > 60) cloud.position.x = -60;
    });

    fwCamera.position.x = fwCurrentX;
    fwCamera.position.y = fwCurrentY;
    fwCamera.lookAt(fwCurrentX * 0.2, fwCurrentY * 0.2, -10);
    fwRenderer.render(fwScene, fwCamera);
    requestAnimationFrame(renderLoop);
}

function handleResize() {
    if (!fwActive || !fwRenderer || !fwCamera) return;
    const container = document.getElementById('face-window-container');
    fwCamera.aspect = container.clientWidth / container.clientHeight;
    fwCamera.updateProjectionMatrix();
    fwRenderer.setSize(container.clientWidth, container.clientHeight);
}

function initFaceWindow() {
    if (fwActive) return;
    fwActive = true;
    fwCurrentX = 0;
    fwCurrentY = 0;
    fwClock = 0;
    buildScene();
    renderLoop();
    window.addEventListener('resize', handleResize);
    startFaceTracking().catch(err => {
        const statusEl = document.getElementById('face-window-status');
        if (statusEl) statusEl.textContent = '오류: ' + (err.message || '알 수 없는 오류');
        console.error('Face window error:', err);
    });
}

function stopFaceWindow() {
    fwActive = false;
    window.removeEventListener('resize', handleResize);
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
    fwScene = null;
    fwCamera = null;
    fwFaceLandmarker = null;
    fwCanopies = [];
    fwClouds = [];
}

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
