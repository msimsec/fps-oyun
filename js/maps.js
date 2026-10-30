'use strict';

// =====================================================================
//  BÖLÜMLER (haritalar)
//  Her bölüm kendi sahnesini mapGroup içine kurar ve walls dizisini doldurur.
//  walls elemanı: { x, z, w, d, h: üst yüzey, b: alt yüzey }
//  floorY: zemin yüksekliği (-Infinity = zemin yok, aşağısı boşluk)
// =====================================================================
let mapGroup = null;
let currentMapId = null;
let jumpPads = [];
let mapAnimators = [];          // her karede çağrılan görsel efektler (ör. rampa parlaması)

const MAP_IDS = ['depot', 'space'];
const MAPS = {
    depot: {
        name: 'Depo',
        desc: 'Tuğla duvarlı kapalı depo; kasalar ve siperler',
        floorY: 0, killY: -Infinity, bulletMinY: 0, bulletMaxY: 10, enemyRange: 25,
        spawn: { x: 0, y: 0, z: 10, angle: 0 },
        duel: { player: { x: 0, y: 0, z: 12, angle: Math.PI }, bot: { x: 0, y: 0, z: 34 } },
        build: buildDepot,
        enemySpawn: (px, pz) => {
            for (let i = 0; i < 20; i++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 18 + Math.random() * 10;
                const x = px + Math.cos(angle) * radius;
                const z = pz + Math.sin(angle) * radius;
                if (Math.abs(x) < 42 && Math.abs(z) < 42 && !collides(x, z, 1.0)) return { x, y: 0, z };
            }
            return null;
        }
    },
    space: {
        name: 'Space',
        desc: 'Boşlukta yüzen platformlar; turuncu rampalar fırlatır, düşen 35 can kaybeder',
        floorY: -Infinity, killY: -25, bulletMinY: -60, bulletMaxY: 80, enemyRange: 50,
        spawn: { x: 0, y: 0, z: 4, angle: 0 },
        duel: { player: { x: 0, y: 0, z: 6, angle: 0 }, bot: { x: 0, y: 0, z: -6 } },
        build: buildSpace,
        enemySpawn: (px, pz) => {
            // Rastgele bir platformda, oyuncudan uzak ve siperlerin dışında bir nokta
            for (let i = 0; i < 30; i++) {
                const p = SPACE_PLATFORMS[Math.floor(Math.random() * SPACE_PLATFORMS.length)];
                const x = p.x + (Math.random() - 0.5) * (p.w - 3);
                const z = p.z + (Math.random() - 0.5) * (p.d - 3);
                if (Math.hypot(x - px, z - pz) < 12) continue;
                if (collides(x, z, 1.0, p.top)) continue;
                return { x, y: p.top, z };
            }
            return null;
        }
    }
};

const curMap = () => MAPS[currentMapId] || MAPS.depot;

function addWall(x, y, z, w, h, d, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mapGroup.add(mesh);
    walls.push({ x, z, w, d, h: y + h / 2, b: y - h / 2 });
    return mesh;
}

function buildMap(id) {
    if (!MAPS[id]) id = 'depot';
    if (mapGroup) {
        scene.remove(mapGroup);
        mapGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    mapGroup = new THREE.Group();
    scene.add(mapGroup);
    walls = [];
    jumpPads = [];
    mapAnimators = [];
    currentMapId = id;
    MAPS[id].build();
}

function updateMapEffects(dt) {
    for (const fn of mapAnimators) fn(dt);
}

// ---------------------------------------------------------------------
//  DEPO — v1.0'dan beri oynanan tuğla harita
// ---------------------------------------------------------------------
function buildDepot() {
    scene.background = new THREE.Color(0x0b0f19);
    scene.fog = new THREE.FogExp2(0x0b0f19, 0.025);

    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    mapGroup.add(floor);
    const ceiling = new THREE.Mesh(floorGeo, floorMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 10;
    mapGroup.add(ceiling);

    createBrickMap();
    createCover();
}

// ---------------------------------------------------------------------
//  SPACE — boşlukta yüzen platformlar, zıplatma rampaları, yıldızlar ve gezegen
//  Platformlar arası boşluklar yürüyerek geçilemez; turuncu rampalar fırlatır.
// ---------------------------------------------------------------------
// x, z: merkez · w, d: boyut · top: üst yüzey yüksekliği
const SPACE_PLATFORMS = [
    { x: 0, z: 0, w: 26, d: 24, top: 0 },        // A: ana platform
    { x: 0, z: -40, w: 16, d: 12, top: 4 },      // B: kuzey
    { x: 36, z: -8, w: 12, d: 16, top: 2 },      // C: doğu
    { x: -36, z: -8, w: 12, d: 16, top: 2 },     // D: batı
    { x: 0, z: 36, w: 18, d: 10, top: -3 },      // E: güney (alçak)
    { x: 18, z: -26, w: 7, d: 7, top: 11 }       // F: yüksek nişancı kulesi (uçuş yollarının dışında)
];
// Rampa: konum ve fırlattığı hedef nokta (hedef hiçbir rampanın üstünde değil)
const SPACE_PADS = [
    { x: 0, z: -9, to: { x: 0, z: -36 } },        // A → B
    { x: 10, z: -3, to: { x: 33, z: -8 } },        // A → C
    { x: -10, z: -3, to: { x: -33, z: -8 } },      // A → D
    { x: 0, z: 9.5, to: { x: 0, z: 34 } },         // A → E
    { x: -4.5, z: -42, to: { x: -3, z: 5 } },      // B → A
    { x: 5.5, z: -43, to: { x: 16.5, z: -25 } },    // B → F
    { x: 38, z: -13, to: { x: 6, z: 4 } },          // C → A
    { x: -38, z: -13, to: { x: -6, z: 4 } },        // D → A
    { x: 6, z: 37, to: { x: 3, z: 6 } },            // E → A
    { x: 19.8, z: -24.2, to: { x: 6, z: 6 } }       // F → A
];

function createPanelTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a3140';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            const v = 40 + Math.floor(Math.random() * 14);
            ctx.fillStyle = `rgb(${v},${v + 6},${v + 16})`;
            ctx.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
        }
    }
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.35)';
    ctx.lineWidth = 2;
    for (let k = 0; k <= 256; k += 64) {
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(256, k); ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function buildSpace() {
    scene.background = new THREE.Color(0x02030a);
    scene.fog = new THREE.FogExp2(0x02030a, 0.004);

    // Yıldızlar: uzak bir küre üzerinde rastgele noktalar
    const starCount = 2500, pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 420;
        const s = Math.sqrt(1 - u * u);
        pos[i * 3] = r * s * Math.cos(th); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * s * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
    mapGroup.add(stars);

    // Uzakta halkalı bir gezegen
    const planet = new THREE.Mesh(new THREE.SphereGeometry(70, 48, 32),
        new THREE.MeshStandardMaterial({ color: 0x3b5bdb, emissive: 0x0b1a4a, roughness: 0.9, fog: false }));
    planet.position.set(-180, -40, -260);
    mapGroup.add(planet);
    const ring = new THREE.Mesh(new THREE.RingGeometry(95, 130, 64),
        new THREE.MeshBasicMaterial({ color: 0x9fb4ff, side: THREE.DoubleSide, transparent: true, opacity: 0.35, fog: false }));
    ring.position.copy(planet.position);
    ring.rotation.set(Math.PI / 2.4, 0.3, 0);
    mapGroup.add(ring);
    const planetLight = new THREE.PointLight(0x6d8cff, 0.6, 600);
    planetLight.position.set(-120, 20, -160);
    mapGroup.add(planetLight);

    const panelTex = createPanelTexture();
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.6 });

    for (const p of SPACE_PLATFORMS) {
        const tex = panelTex.clone();
        tex.needsUpdate = true;
        tex.repeat.set(p.w / 4, p.d / 4);
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.4 });
        const thick = 1.5;
        addWall(p.x, p.top - thick / 2, p.z, p.w, thick, p.d, mat);
        // Kenar ışıkları (çarpışması yok, sadece görsel)
        const e = 0.12;
        [[p.w, e, p.x, p.z - p.d / 2], [p.w, e, p.x, p.z + p.d / 2]].forEach(([w, d, x, z]) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), edgeMat); m.position.set(x, p.top + 0.02, z); mapGroup.add(m);
        });
        [[e, p.d, p.x - p.w / 2, p.z], [e, p.d, p.x + p.w / 2, p.z]].forEach(([w, d, x, z]) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), edgeMat); m.position.set(x, p.top + 0.02, z); mapGroup.add(m);
        });
        // Platform altında hafif ışıklı itici
        const thruster = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(p.w, p.d) * 0.18, Math.min(p.w, p.d) * 0.3, 1.2, 16),
            new THREE.MeshBasicMaterial({ color: 0x1e40af }));
        thruster.position.set(p.x, p.top - thick - 0.6, p.z);
        mapGroup.add(thruster);
    }

    // Siperler (platform üstünde): x, z, w, yükseklik, d, bulunduğu platformun üstü
    const cover = (x, z, w, h, d, top) => addWall(x, top + h / 2, z, w, h, d, coverMat);
    cover(-6, 2, 3, 1.2, 1.2, 0);
    cover(6, 2, 3, 1.2, 1.2, 0);
    cover(-8, -6, 1.2, 1.2, 3, 0);
    cover(8, -6, 1.2, 1.2, 3, 0);
    cover(-10, 8, 1.6, 4, 1.6, 0);
    cover(10, 8, 1.6, 4, 1.6, 0);
    cover(3, -37, 3, 1.2, 1.2, 4);
    cover(-3, -37, 3, 1.2, 1.2, 4);
    cover(34, -4, 1.2, 1.2, 3, 2);
    cover(-34, -4, 1.2, 1.2, 3, 2);
    cover(-4, 36, 2, 1.2, 1.2, -3);
    cover(17, -28, 3, 1, 0.6, 11);

    // Zıplatma rampaları: hedefe ulaşacak fırlatma hızını önceden hesapla
    const padMat = new THREE.MeshBasicMaterial({ color: 0xff8c1a });
    const padGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.6 });
    for (const pd of SPACE_PADS) {
        const from = SPACE_PLATFORMS.find(p => Math.abs(pd.x - p.x) <= p.w / 2 && Math.abs(pd.z - p.z) <= p.d / 2);
        const to = SPACE_PLATFORMS.find(p => Math.abs(pd.to.x - p.x) <= p.w / 2 && Math.abs(pd.to.z - p.z) <= p.d / 2);
        const y = from.top, ty = to.top;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.18, 24), padMat);
        base.position.set(pd.x, y + 0.09, pd.z);
        const glow = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 8, 32), padGlowMat);
        glow.rotation.x = Math.PI / 2;
        glow.position.set(pd.x, y + 0.25, pd.z);
        mapGroup.add(base, glow);
        // Balistik: tepe noktası iki platformun yükseğinin 6 birim üstünde
        const apex = Math.max(y, ty) + 6;
        const vy = Math.sqrt(2 * CFG.gravity * (apex - y));
        const time = vy / CFG.gravity + Math.sqrt(2 * (apex - ty) / CFG.gravity);
        jumpPads.push({ x: pd.x, z: pd.z, y, r: 1.4, vy, vx: (pd.to.x - pd.x) / time, vz: (pd.to.z - pd.z) / time,
                        from: SPACE_PLATFORMS.indexOf(from), to: SPACE_PLATFORMS.indexOf(to) });
        let t = Math.random() * 6;
        mapAnimators.push((dt) => {
            t += dt * 3;
            glow.position.y = y + 0.25 + (Math.sin(t) * 0.5 + 0.5) * 0.6;
            glow.scale.setScalar(0.9 + (Math.sin(t) * 0.5 + 0.5) * 0.35);
        });
    }
}

// Space: (x, z, y) noktasının durduğu platformun sırası; platform üstünde değilse -1
function platformIndexAt(x, z, y) {
    if (currentMapId !== 'space') return 0;
    return SPACE_PLATFORMS.findIndex(p => Math.abs(x - p.x) <= p.w / 2 + 0.7 && Math.abs(z - p.z) <= p.d / 2 + 0.7 &&
        Math.abs(y - p.top) < 0.3);
}

// from platformundan to platformuna rampa zincirinin ilk rampası (en kısa yol, BFS)
function nextPad(from, to) {
    if (from < 0 || to < 0 || from === to) return null;
    const via = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
        const n = queue.shift();
        if (n === to) break;
        for (const pd of jumpPads) {
            if (pd.from === n && !via.has(pd.to)) { via.set(pd.to, pd); queue.push(pd.to); }
        }
    }
    if (!via.has(to)) return null;
    let pd = via.get(to);
    while (pd && pd.from !== from) pd = via.get(pd.from);
    return pd;
}

// Oyuncu bir rampanın üstündeyse fırlat (yalnızca yerdeyken)
function checkJumpPads() {
    if (!player.onGround) return;
    const feet = footY();
    for (const pd of jumpPads) {
        if (Math.abs(feet - pd.y) > 0.1) continue;
        if (Math.hypot(camera.position.x - pd.x, camera.position.z - pd.z) > pd.r) continue;
        player.velY = pd.vy;
        player.airVX = pd.vx;
        player.airVZ = pd.vz;
        player.onGround = false;
        sfx('jumpPad');
        return;
    }
}

// Boşluğa düşen oyuncu: can kaybı ve başlangıç platformuna geri dönüş
function fellOut() {
    const s = curMap().spawn;
    player.health -= 35;
    flashClass('damageFlash', 'on', 300);
    sfx('hurt');
    if (player.health <= 0) { player.health = 0; endRun(false); return; }
    camera.position.set(s.x, s.y + CFG.eyeHeight, s.z);
    player.velY = 0; player.airVX = 0; player.airVZ = 0; player.onGround = true;
    showBanner('BOŞLUĞA DÜŞTÜN!', '-35 can', 1600);
}
