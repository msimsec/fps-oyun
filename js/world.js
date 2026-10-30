'use strict';

// =====================================================================
//  SAHNE
// =====================================================================
function createBrickTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8b7d7b';
    ctx.fillRect(0, 0, 512, 512);
    const rows = 12, cols = 6, rh = 512 / rows, cw = 512 / cols;
    for (let i = 0; i < rows; i++) {
        const offset = (i % 2 === 0) ? 0 : cw / 2;
        for (let j = -1; j < cols + 1; j++) {
            const bx = j * cw + offset, by = i * rh, bw = cw - 4, bh = rh - 4;
            const r = 160 + Math.floor(Math.random() * 45);
            const g = 60 + Math.floor(Math.random() * 25);
            const b = 45 + Math.floor(Math.random() * 20);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(bx + 2, by + 2, bw, bh);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(bx + 2, by + bh - 4, bw, 4);
        }
    }
    const texture = new THREE.CanvasTexture(c);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function init() {
    const container = $('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);
    scene.fog = new THREE.FogExp2(0x0b0f19, 0.025);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.rotation.order = 'YXZ';
    camera.position.set(0, CFG.eyeHeight, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    canvas = renderer.domElement;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(25, 50, 25);
    dirLight.castShadow = true;
    // Gölge kamerası tüm haritayı kapsasın (varsayılan ±5 birimdi)
    dirLight.shadow.camera.left = -55;
    dirLight.shadow.camera.right = 55;
    dirLight.shadow.camera.top = 55;
    dirLight.shadow.camera.bottom = -55;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ceiling = new THREE.Mesh(floorGeo, floorMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 10;
    scene.add(ceiling);

    const brickTex = createBrickTexture();
    brickTex.repeat.set(4, 2);
    brickMaterial = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.7 });
    createBrickMap();
    createWeaponModel();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', (e) => { if (e.button === 0) firing = false; });
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('blur', () => { resetKeys(); });
    window.addEventListener('resize', onWindowResize);

    const finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (!finePointer) $('mobileNote').textContent = 'Bu oyun klavye ve fare gerektirir; dokunmatik cihazlarda oynanamaz.';

    updateHUD();
    animate();
}

function createWeaponModel() {
    weapon3DGroup = new THREE.Group();
    weaponBodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.8 });
    weaponAccentMat = new THREE.MeshStandardMaterial({ color: 0x00d4ff, roughness: 0.2, metalness: 0.9 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.8), weaponBodyMat);
    body.position.set(0.25, -0.22, -0.5);
    weapon3DGroup.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), weaponAccentMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.25, -0.2, -0.85);
    weapon3DGroup.add(barrel);

    updateWeaponSkinColors();
    camera.add(weapon3DGroup);
    scene.add(camera);
}

function updateWeaponSkinColors() {
    if (!weaponBodyMat) return;
    if (player.activeSkin === 'prime') {
        weaponBodyMat.color.setHex(0xa349a4); weaponAccentMat.color.setHex(0xffcc00);
    } else if (player.activeSkin === 'reaver') {
        weaponBodyMat.color.setHex(0x4b0082); weaponAccentMat.color.setHex(0x9932cc);
    } else {
        weaponBodyMat.color.setHex(0x222222); weaponAccentMat.color.setHex(0x00ffff);
    }
}

function skinBulletColor() {
    if (player.activeSkin === 'prime') return 0xcc66ff;
    if (player.activeSkin === 'reaver') return 0x9933ff;
    return 0x00ffcc;
}

function createBrickMap() {
    const b = 45;
    createWall(0, 5, -b, 90, 10, 2);
    createWall(0, 5, b, 90, 10, 2);
    createWall(-b, 5, 0, 2, 10, 90);
    createWall(b, 5, 0, 2, 10, 90);

    createWall(-15, 2.5, -15, 16, 5, 2);
    createWall(15, 2.5, -15, 16, 5, 2);
    createWall(-15, 2.5, 15, 2, 5, 16);
    createWall(15, 2.5, 15, 2, 5, 16);
    createWall(0, 2.5, 0, 12, 5, 12);
}

function createWall(x, y, z, w, h, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brickMaterial);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    walls.push({ x, z, w, d, h: y + h / 2 });
}
