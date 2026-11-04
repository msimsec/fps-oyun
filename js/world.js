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

    const brickTex = createBrickTexture();
    brickTex.repeat.set(4, 2);
    brickMaterial = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.7 });
    crateMaterial = new THREE.MeshStandardMaterial({ map: createCrateTexture(), roughness: 0.85 });
    buildMap(settings.map);           // seçili bölüm (Depo / Space)
    placeAtSpawn();
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

    // Tabanca: iki elle tutulur, ekranın ortasına yakın ve göze daha yakın durur.
    // Kayar sürgü (üstte yivli), gövde, tetik korkuluğu, eğik kabza, namlu ucu, gez ve arpacık
    const pistol = new THREE.Group();
    addPart(pistol, box(0.075, 0.075, 0.34), B, 0.14, -0.2, -0.56);              // sürgü
    for (let i = 0; i < 4; i++) addPart(pistol, box(0.078, 0.06, 0.008), gripMat, 0.14, -0.2, -0.43 - i * 0.018);
    addPart(pistol, box(0.07, 0.05, 0.3), gripMat, 0.14, -0.255, -0.56);         // gövde
    addPart(pistol, box(0.012, 0.012, 0.08), gripMat, 0.14, -0.3, -0.58);        // tetik korkuluğu
    addPart(pistol, box(0.07, 0.19, 0.095), gripMat, 0.14, -0.34, -0.45, 0.25);  // kabza
    addPart(pistol, cyl(0.016, 0.03), A, 0.14, -0.2, -0.745, R);                // namlu ucu
    addPart(pistol, box(0.012, 0.02, 0.02), A, 0.14, -0.155, -0.71);             // arpacık
    addPart(pistol, box(0.045, 0.02, 0.02), A, 0.14, -0.155, -0.41);             // gez

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

    // Taramalı Tabanca: AR tipi kısa karabina, tamamı siyah (skin rengi gövdeyi değiştirmez).
    // Kabza ve şarjör tırtıklı (taramalı) dokuda; dipçikte yatay kanallar, el kundağında
    // havalandırma yarıkları, üstte ray ve katlanır gez-arpacık, namlu ucunda alev gizleyici.
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5, metalness: 0.45 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8, metalness: 0.2 });
    const knurlMat = new THREE.MeshStandardMaterial({ map: createKnurlTexture(), color: 0x4a4a4a, roughness: 0.9, metalness: 0.1 });
    const K = blackMat, D = darkMat;
    const smg = new THREE.Group();
    // Dipçik: gövde, kanallar ve tamponlu arka yüz
    addPart(smg, box(0.075, 0.13, 0.16), K, 0.24, -0.25, -0.1);
    for (let i = 0; i < 3; i++) addPart(smg, box(0.078, 0.012, 0.11), D, 0.24, -0.215 - i * 0.03, -0.11);
    addPart(smg, box(0.08, 0.15, 0.025), knurlMat, 0.24, -0.255, -0.01);
    addPart(smg, cyl(0.024, 0.14), K, 0.24, -0.2, -0.24, R);               // tampon borusu
    // Alt ve üst gövde, kovan penceresi, kurma kolu
    addPart(smg, box(0.075, 0.09, 0.28), K, 0.24, -0.245, -0.44);
    addPart(smg, box(0.08, 0.075, 0.3), K, 0.24, -0.172, -0.45);
    addPart(smg, box(0.004, 0.035, 0.08), D, 0.282, -0.175, -0.44);
    addPart(smg, box(0.03, 0.02, 0.04), D, 0.24, -0.13, -0.3);
    // Üst ray (tüm boy) ve diş sırası
    addPart(smg, box(0.035, 0.018, 0.72), K, 0.24, -0.125, -0.66);
    for (let i = 0; i < 12; i++) addPart(smg, box(0.04, 0.008, 0.02), D, 0.24, -0.113, -0.34 - i * 0.055);
    // El kundağı ve yan yarıklar
    addPart(smg, box(0.085, 0.085, 0.38), K, 0.24, -0.175, -0.8);
    for (let i = 0; i < 5; i++) {
        addPart(smg, box(0.088, 0.018, 0.04), D, 0.24, -0.19, -0.66 - i * 0.07);
    }
    addPart(smg, box(0.03, 0.02, 0.3), K, 0.24, -0.225, -0.8);              // alt ray
    // Namlu ve alev gizleyici
    addPart(smg, cyl(0.016, 0.12), K, 0.24, -0.17, -1.04, R);
    addPart(smg, cyl(0.024, 0.07, 8), D, 0.24, -0.17, -1.12, R);
    // Katlanır gez ve arpacık
    addPart(smg, box(0.035, 0.045, 0.02), K, 0.24, -0.095, -0.35);
    addPart(smg, box(0.035, 0.05, 0.02), K, 0.24, -0.093, -0.98);
    // Taramalı kabza, tetik ve tetik korkuluğu
    addPart(smg, box(0.06, 0.16, 0.075), knurlMat, 0.24, -0.33, -0.33, 0.3);
    addPart(smg, box(0.01, 0.04, 0.012), D, 0.24, -0.305, -0.4);
    addPart(smg, box(0.012, 0.01, 0.09), K, 0.24, -0.335, -0.41);
    // Tırtıklı şarjör (hafif öne eğik)
    addPart(smg, box(0.055, 0.22, 0.085), knurlMat, 0.24, -0.38, -0.5, -0.12);

    // Testereli Eldiven: sağ kolda zırhlı bilek koruması, yumruğun önünde dönen dişli
    // daire testere ve üstünde koruyucu kapak; arkada küçük motor bloğu. Sol el boşta, yumruk.
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, emissive: 0x2a2a2a, roughness: 0.25, metalness: 0.8 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });
    const saw = new THREE.Group();
    addPart(saw, box(0.11, 0.1, 0.22), B, 0.25, -0.31, -0.42);                   // bilek koruması
    addPart(saw, box(0.115, 0.02, 0.23), hazardMat, 0.25, -0.255, -0.42);        // sarı şerit
    addPart(saw, box(0.08, 0.07, 0.08), gripMat, 0.25, -0.33, -0.27);           // motor bloğu
    addPart(saw, cyl(0.022, 0.12), A, 0.22, -0.24, -0.62, R);                    // mil
    // Testere biraz içe dönük: hem kesen kenarı hem yüzü görünsün
    const blade = new THREE.Group();
    blade.position.set(0.19, -0.2, -0.74);
    blade.rotation.y = -0.75;
    const bladeSpin = new THREE.Group();
    blade.add(bladeSpin);
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20, 1, false, 0, Math.PI), B);
    guard.rotation.z = R; guard.position.x = 0.03;                               // üst yarıyı örten kapak
    blade.add(guard);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 28), steelMat);
    disc.rotation.z = R;                                                          // disk dik dursun (x ekseni)
    bladeSpin.add(disc);
    for (let i = 0; i < 18; i++) {                                                // dişler
        const a = (i / 18) * Math.PI * 2;
        const t = new THREE.Mesh(box(0.014, 0.04, 0.035), steelMat);
        t.position.set(0, Math.sin(a) * 0.18, Math.cos(a) * 0.18);
        t.rotation.x = -a;
        bladeSpin.add(t);
    }
    for (let i = 0; i < 3; i++) {                                                 // dönüşü belli eden kollar
        const s = new THREE.Mesh(box(0.016, 0.2, 0.02), A);
        s.rotation.x = (i / 3) * Math.PI; bladeSpin.add(s);
    }
    const hub = new THREE.Mesh(cyl(0.04, 0.03, 12), A); hub.rotation.z = R; bladeSpin.add(hub);
    saw.add(blade);
    saw.userData.blade = bladeSpin;

    // Roketatar: omuzda taşınan kalın tüp, arkada genişleyen ağız, önde görünen roket başlığı,
    // yan tarafta nişangâh, altta kabza ve ön tutamak
    const rocketBody = new THREE.MeshStandardMaterial({ color: 0x4d5a2e, roughness: 0.6, metalness: 0.3 });
    const rocketL = new THREE.Group();
    addPart(rocketL, cyl(0.08, 1.15, 16), rocketBody, 0.27, -0.13, -0.55, R);
    addPart(rocketL, new THREE.CylinderGeometry(0.11, 0.08, 0.14, 16), gripMat, 0.27, -0.13, 0.06, R);   // arka ağız
    addPart(rocketL, cyl(0.09, 0.05, 16), gripMat, 0.27, -0.13, -1.11, R);                               // ön bilezik
    const warhead = addPart(rocketL, new THREE.ConeGeometry(0.06, 0.16, 12), hazardMat, 0.27, -0.13, -1.2, -R);
    addPart(rocketL, box(0.035, 0.07, 0.1), B, 0.19, -0.06, -0.62);                                      // nişangâh
    addPart(rocketL, box(0.02, 0.03, 0.02), A, 0.19, -0.015, -0.62);
    addPart(rocketL, box(0.06, 0.16, 0.08), gripMat, 0.27, -0.27, -0.45, 0.25);                          // kabza
    addPart(rocketL, box(0.05, 0.13, 0.06), gripMat, 0.27, -0.25, -0.82);                                // ön tutamak
    addPart(rocketL, box(0.17, 0.02, 0.02), hazardMat, 0.27, -0.13, -0.3);                               // uyarı bandı
    rocketL.userData.warhead = warhead;

    // Eller ve kollar: parmaksız taktik eldivenli eller silahı tutar, kollar ekranın altından gelir.
    // Kamera silahı sol üstten gördüğü için parmaklar ve başparmak silahın sol (görünen) yüzüne sarılır;
    // ten rengi parmaklar koyu silahın üstünde net seçilir.
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a47c, roughness: 0.7 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x55633d, roughness: 0.9 });
    const cuffMat = new THREE.MeshStandardMaterial({ color: 0x2d3324, roughness: 0.8 });
    const limb = (g, a, b, r, mat) => {
        const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
        const len = va.distanceTo(vb);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, len, 12), mat);
        m.position.copy(va).add(vb).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
        g.add(m);
    };
    const forearm = (g, side, wx, wy, wz) => {
        addPart(g, cyl(0.062, 0.08), cuffMat, wx, wy, wz, 0.9);                      // bilek / eldiven ağzı
        const ex = wx + side * 0.17, ey = wy - 0.45, ez = wz + 0.4;
        limb(g, [wx, wy, wz], [ex, ey, ez], 0.06, sleeveMat);                        // önkol
        limb(g, [ex, ey, ez], [ex + side * 0.12, ey - 0.4, ez + 0.35], 0.075, sleeveMat);
    };
    // Sağ el kabzada: avuç kabzanın sağında, parmaklar kabzanın önünden sola sarılır, başparmak üstte
    const gripHand = (g, x, y, z, w = 0.065) => {
        addPart(g, box(0.06, 0.14, 0.13), gloveMat, x + w / 2 + 0.025, y, z);          // avuç (dış)
        addPart(g, box(0.04, 0.14, 0.12), gloveMat, x - w / 2 - 0.015, y, z + 0.015);   // elin sol yüzü
        for (let i = 0; i < 4; i++) {                                                  // parmaklar
            addPart(g, box(w + 0.06, 0.03, 0.034), skinMat, x, y + 0.05 - i * 0.034, z - 0.07);
        }
        addPart(g, box(0.032, 0.032, 0.11), skinMat, x - w / 2 - 0.025, y + 0.08, z - 0.035);   // başparmak
        forearm(g, 1, x + 0.03, y - 0.09, z + 0.07);
    };
    // Sol el önde: avuç el kundağının altında, parmaklar sol yüzden yukarı sarılır
    const foreHand = (g, x, y, z, w = 0.09) => {
        addPart(g, box(w + 0.04, 0.05, 0.15), gloveMat, x, y - 0.005, z);                      // avuç (alt)
        addPart(g, box(0.038, 0.075, 0.15), gloveMat, x - w / 2 - 0.02, y + 0.035, z);   // elin sol yüzü
        for (let i = 0; i < 4; i++) {                                                  // parmaklar
            addPart(g, box(0.03, 0.09, 0.03), skinMat, x - w / 2 - 0.026, y + 0.075, z - 0.055 + i * 0.036);
        }
        addPart(g, box(0.03, 0.085, 0.032), skinMat, x + w / 2 + 0.025, y + 0.055, z + 0.035);    // başparmak
        forearm(g, -1, x - 0.02, y - 0.05, z + 0.08);
    };
    gripHand(rifle, 0.25, -0.34, -0.29, 0.06);    foreHand(rifle, 0.25, -0.3, -0.84, 0.09);
    gripHand(shotgun, 0.25, -0.29, -0.24, 0.09);  foreHand(shotgun, 0.25, -0.31, -0.74, 0.1);
    gripHand(sniper, 0.25, -0.33, -0.28, 0.06);   foreHand(sniper, 0.25, -0.3, -0.78, 0.1);
    gripHand(smg, 0.24, -0.33, -0.34, 0.06);      foreHand(smg, 0.24, -0.245, -0.8, 0.085);
    gripHand(rocketL, 0.27, -0.27, -0.45, 0.06);  foreHand(rocketL, 0.27, -0.25, -0.82, 0.05);
    // Tabanca: sağ el kabzada, sol el altından destekler (iki elle tutuş)
    gripHand(pistol, 0.14, -0.34, -0.45, 0.07);
    addPart(pistol, box(0.06, 0.13, 0.12), gloveMat, 0.075, -0.36, -0.44);
    for (let i = 0; i < 4; i++) addPart(pistol, box(0.1, 0.024, 0.026), skinMat, 0.12, -0.31 - i * 0.028, -0.375);
    forearm(pistol, -1, 0.06, -0.43, -0.37);
    // Testere: sağ el yumruk halinde bileklikte; sol el boşta, yumruk
    addPart(saw, box(0.1, 0.1, 0.1), gloveMat, 0.25, -0.3, -0.58);
    for (let i = 0; i < 4; i++) addPart(saw, box(0.028, 0.026, 0.03), skinMat, 0.2, -0.26 - i * 0.026, -0.62);
    forearm(saw, 1, 0.27, -0.36, -0.36);
    addPart(saw, box(0.09, 0.1, 0.11), gloveMat, 0.0, -0.36, -0.52);
    for (let i = 0; i < 4; i++) addPart(saw, box(0.03, 0.026, 0.03), skinMat, 0.05, -0.32 - i * 0.026, -0.57);
    forearm(saw, -1, 0.0, -0.42, -0.45);

    Object.assign(weaponModels, { rifle, pistol, shotgun, sniper, smg, saw, rocket: rocketL });
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

// Kabza ve şarjör için tırtıklı (çapraz taramalı) doku
function createKnurlTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 2;
    for (let k = -64; k <= 64; k += 8) {
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + 64, 64); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(k + 64, 0); ctx.lineTo(k, 64); ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 3);
    return t;
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
    return addWall(x, y, z, w, h, d, material);
}
