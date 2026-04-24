// Face-tracked 3D parallax window effect using Three.js + MediaPipe
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

let fwScene, fwCamera, fwRenderer, fwFaceLandmarker;
let fwActive = false;
let fwVideo;
let fwCurrentX = 0, fwCurrentY = 0;

const SENSITIVITY = 5;
const LERP = 0.08;

function buildScene() {
    const T = window.THREE;
    const container = document.getElementById('face-window-container');

    fwScene = new T.Scene();
    fwScene.background = new T.Color(0x87ceeb);

    fwCamera = new T.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
    fwCamera.position.set(0, 0, 0);

    fwRenderer = new T.WebGLRenderer({ antialias: true });
    fwRenderer.setSize(container.clientWidth, container.clientHeight);
    fwRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(fwRenderer.domElement);

    // Lighting
    fwScene.add(new T.AmbientLight(0xffffff, 0.7));
    const sun = new T.DirectionalLight(0xfffbe0, 1.0);
    sun.position.set(10, 20, -10);
    fwScene.add(sun);

    // Sky sphere (inside face)
    fwScene.add(new T.Mesh(
        new T.SphereGeometry(100, 16, 16),
        new T.MeshBasicMaterial({ color: 0x87ceeb, side: T.BackSide })
    ));

    // Ground
    const ground = new T.Mesh(
        new T.PlaneGeometry(200, 200),
        new T.MeshLambertMaterial({ color: 0x4a7c59 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -4;
    fwScene.add(ground);

    // Trees
    const treeDefs = [
        [-8, -4, -18], [8, -4, -18], [-4, -4, -22], [5, -4, -20],
        [-13, -4, -14], [13, -4, -14], [0, -4, -28],
        [-6, -4, -32], [7, -4, -30], [-16, -4, -24], [16, -4, -26]
    ];
    treeDefs.forEach(([x, y, z]) => {
        const h = 2.5 + Math.random() * 2;
        const trunk = new T.Mesh(
            new T.CylinderGeometry(0.12, 0.18, h * 0.35, 6),
            new T.MeshLambertMaterial({ color: 0x6b3a1f })
        );
        trunk.position.set(x, y + h * 0.175, z);
        fwScene.add(trunk);

        const canopy = new T.Mesh(
            new T.ConeGeometry(1.1 + Math.random() * 0.6, h * 0.9, 8),
            new T.MeshLambertMaterial({ color: 0x2a5e1a })
        );
        canopy.position.set(x, y + h * 0.6, z);
        fwScene.add(canopy);
    });

    // Distant mountains
    const mtColors = [0x4a5e2a, 0x3a4d20, 0x556b35];
    [[-28, -3, -60], [-12, -2, -65], [6, -2.5, -62], [22, -3, -58], [38, -3, -60]].forEach(([x, y, z], i) => {
        const s = 9 + (i % 3) * 3;
        const mtn = new T.Mesh(
            new T.ConeGeometry(s, s * 1.8, 7),
            new T.MeshLambertMaterial({ color: mtColors[i % 3] })
        );
        mtn.position.set(x, y, z);
        fwScene.add(mtn);
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
            delegate: "GPU"
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
        if (container?.contains(fwRenderer.domElement)) {
            container.removeChild(fwRenderer.domElement);
        }
        fwRenderer.dispose();
        fwRenderer = null;
    }

    fwScene = null;
    fwCamera = null;
    fwFaceLandmarker = null;
}

// Wire up buttons (DOM is ready by the time this module executes)
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
