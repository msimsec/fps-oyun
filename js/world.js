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

// Tahta kasa dokusu: yatay tahtalar + çapraz destek + kenar çerçevesi
function createCrateTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 8; i++) {
        const v = 110 + Math.floor(Math.random() * 30);
        ctx.fillStyle = `rgb(${v + 40},${v},${Math.floor(v * 0.55)})`;
        ctx.fillRect(0, i * 32, 256, 32);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, i * 32 + 30, 256, 2);
    }
    ctx.strokeStyle = '#5b3a1a';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, 238, 238);
    ctx.beginPath(); ctx.moveTo(18, 18); ctx.lineTo(238, 238); ctx.stroke();
    return new THREE.CanvasTexture(c);
}

function init() {
    const container = $('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);
    scene.fog = new THREE.FogExp2(0x0b0f19, 0.025);

    camera = new THREE.PerspectiveCamera(CFG.baseFov, window.innerWidth / window.innerHeight, 0.1, 1000);
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
    crateMaterial = new THREE.MeshStandardMaterial({ map: createCrateTexture(), roughness: 0.85 });
    createBrickMap();
    createCover();
    createWeaponModels();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('wheel', onWheel, { passive: true });
    document.addEventListener('contextmenu', (e) => { if (state === 'playing') e.preventDefault(); });
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('blur', () => { resetKeys(); });
    window.addEventListener('resize', onWindowResize);

    const finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (!finePointer) $('mobileNote').textContent = 'Bu oyun klavye ve fare gerektirir; dokunmatik cihazlarda oynanamaz.';

    resetArsenal();
    updateHUD();
    animate();
}

// ---- Silah modelleri (kamera uzayında, sağ altta) ----
function addPart(group, geo, mat, x, y, z, rotX = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rotX;
    group.add(m);
    return m;
}

function createWeaponModels() {
    weapon3DGroup = new THREE.Group();
    // Gövde ve vurgu renkleri skine göre değişir; tahta ve kabza parçaları sabit kalır
    weaponBodyMat = new THREE.MeshStandardMaterial({ color: SKIN_DEFS.classic.body, roughness: 0.45, metalness: 0.5 });
    weaponAccentMat = new THREE.MeshStandardMaterial({ color: 0x00d4ff, roughness: 0.2, metalness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.8 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const B = weaponBodyMat, A = weaponAccentMat, R = Math.PI / 2;
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (r, len, seg = 10) => new THREE.CylinderGeometry(r, r, len, seg);

    // Tüfek: gövde, el kundağı, namlu, eğik şarjör, kabza, dipçik, üst ray
    const rifle = new THREE.Group();
    addPart(rifle, box(0.1, 0.14, 0.55), B, 0.25, -0.22, -0.45);
    addPart(rifle, box(0.09, 0.1, 0.3), B, 0.25, -0.22, -0.86);
    addPart(rifle, cyl(0.022, 0.25), A, 0.25, -0.2, -1.12, R);
    addPart(rifle, box(0.07, 0.2, 0.1), gripMat, 0.25, -0.37, -0.5, 0.25);
    addPart(rifle, box(0.06, 0.14, 0.07), gripMat, 0.25, -0.34, -0.28, 0.35);
    addPart(rifle, box(0.08, 0.12, 0.26), B, 0.25, -0.24, -0.07);
    addPart(rifle, box(0.04, 0.04, 0.3), A, 0.25, -0.13, -0.5);

    // Tabanca: kısa sürgü, gövde, eğik kabza, namlu ucu ve nişangahlar
    const pistol = new THREE.Group();
    addPart(pistol, box(0.07, 0.07, 0.3), B, 0.22, -0.17, -0.46);
    addPart(pistol, box(0.065, 0.05, 0.26), gripMat, 0.22, -0.225, -0.44);
    addPart(pistol, box(0.065, 0.17, 0.09), gripMat, 0.22, -0.31, -0.33, 0.3);
    addPart(pistol, cyl(0.016, 0.03), A, 0.22, -0.17, -0.625, R);
    addPart(pistol, box(0.015, 0.02, 0.02), A, 0.22, -0.125, -0.59);
    addPart(pistol, box(0.04, 0.02, 0.02), A, 0.22, -0.125, -0.33);

    // Pompalı: kalın tek namlu, altında şarjör tüpü, tahta pompa kolu ve dipçik
    const shotgun = new THREE.Group();
    addPart(shotgun, box(0.11, 0.13, 0.3), B, 0.25, -0.22, -0.4);
    addPart(shotgun, cyl(0.035, 0.75), A, 0.25, -0.18, -0.92, R);
    addPart(shotgun, cyl(0.025, 0.6), B, 0.25, -0.25, -0.85, R);
    addPart(shotgun, box(0.1, 0.08, 0.22), woodMat, 0.25, -0.25, -0.74);
    addPart(shotgun, box(0.09, 0.15, 0.36), woodMat, 0.25, -0.27, -0.1, -0.1);
    addPart(shotgun, box(0.02, 0.02, 0.02), A, 0.25, -0.14, -1.27);

    // Keskin nişancı: uzun ince namlu, namlu freni, büyük dürbün, sürgü kolu,
    // katlanmış iki ayak (bipod) ve dipçik
    const sniper = new THREE.Group();
    addPart(sniper, box(0.1, 0.12, 0.45), B, 0.25, -0.22, -0.45);
    addPart(sniper, cyl(0.02, 1.0), A, 0.25, -0.19, -1.15, R);
    addPart(sniper, box(0.055, 0.055, 0.09), B, 0.25, -0.19, -1.68);
    addPart(sniper, cyl(0.035, 0.42), B, 0.25, -0.08, -0.45, R);
    addPart(sniper, cyl(0.05, 0.08), B, 0.25, -0.08, -0.69, R);
    addPart(sniper, cyl(0.045, 0.07), B, 0.25, -0.08, -0.22, R);
    addPart(sniper, box(0.03, 0.06, 0.03), B, 0.25, -0.13, -0.33);
    addPart(sniper, box(0.03, 0.06, 0.03), B, 0.25, -0.13, -0.57);
    const bolt = addPart(sniper, cyl(0.012, 0.09), A, 0.31, -0.18, -0.34);
    bolt.rotation.z = R;
    addPart(sniper, cyl(0.008, 0.32), gripMat, 0.23, -0.24, -1.05, R);
    addPart(sniper, cyl(0.008, 0.32), gripMat, 0.27, -0.24, -1.05, R);
    addPart(sniper, box(0.08, 0.16, 0.36), gripMat, 0.25, -0.25, -0.06);
    addPart(sniper, box(0.06, 0.13, 0.07), gripMat, 0.25, -0.33, -0.27, 0.35);

    Object.assign(weaponModels, { rifle, pistol, shotgun, sniper });
    WEAPON_ORDER.forEach(id => {
        const m = weaponModels[id];
        // Kameraya çok yakın parçalar ekranı kaplamasın: biraz küçült ve ileri it
        m.scale.setScalar(0.85);
        m.position.set(id === 'pistol' ? 0.0 : 0.03, -0.02, -0.25);
        m.visible = false;
        weapon3DGroup.add(m);
    });
    weaponModels.rifle.visible = true;

    updateWeaponSkinColors();
    camera.add(weapon3DGroup);
    scene.add(camera);
}

function updateWeaponSkinColors() {
    if (!weaponBodyMat) return;
    const s = SKIN_DEFS[player.activeSkin] || SKIN_DEFS.classic;
    weaponBodyMat.color.setHex(s.body);
    weaponAccentMat.color.setHex(s.accent);
}

function skinBulletColor() {
    return (SKIN_DEFS[player.activeSkin] || SKIN_DEFS.classic).bullet;
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

// Kasalar ve alçak siperler. Düello koridoru (x≈0, z 12..34) ve doğma noktaları boş bırakıldı.
// 1 birimlik kasalara zıplayarak, 2 birimliklere yanındaki alçak kasadan çıkılır.
function createCover() {
    const crate = (x, z, w, h, d) => createWall(x, h / 2, z, w, h, d, crateMaterial);
    // Düello koridorunun iki yanı
    crate(-7, 23, 2, 1, 2);
    crate(7, 23, 2, 1, 2);
    crate(-7, 29, 1.5, 1.6, 1.5);
    crate(7, 29, 1.5, 1.6, 1.5);
    // Sol ve sağ kanatlarda basamaklı kasa yığınları
    crate(-30, 2, 3, 1, 3);
    crate(-32.5, 2, 2, 2, 3);
    crate(30, -2, 3, 1, 3);
    crate(32.5, -2, 2, 2, 3);
    // Köşelerde geniş alçak platformlar
    crate(-30, -30, 5, 1, 5);
    crate(30, 30, 5, 1, 5);
    crate(-30, 30, 3, 1.2, 3);
    crate(30, -30, 3, 1.2, 3);
    // Arka tarafta alçak siper duvarı ve dağınık kasalar
    createWall(0, 0.6, -28, 10, 1.2, 1);
    crate(-8, -36, 2, 1, 2);
    crate(8, -36, 2, 1, 2);
    crate(22, 8, 1.5, 1.5, 1.5);
    crate(-22, -8, 1.5, 1.5, 1.5);
    // Taş sütunlar
    createWall(-36, 2.5, 18, 2, 5, 2);
    createWall(36, 2.5, -18, 2, 5, 2);
}

function createWall(x, y, z, w, h, d, material = brickMaterial) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    walls.push({ x, z, w, d, h: y + h / 2 });
}
