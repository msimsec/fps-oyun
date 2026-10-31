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

const MAP_IDS = ['depot', 'space', 'desert', 'snow'];

// Zeminli bölümlerde düşman doğma noktası: oyuncudan 18-28 birim uzakta, engelsiz ve
// oyuncuya yürüyerek ulaşılabilen (yol bulma alanında mesafesi olan) bir yer
function floorSpawn(px, pz) {
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 18 + Math.random() * 10;
        const x = px + Math.cos(angle) * radius;
        const z = pz + Math.sin(angle) * radius;
        if (Math.abs(x) >= 42 || Math.abs(z) >= 42 || collides(x, z, 1.0)) continue;
        if (NAV.dist && NAV.mapId === currentMapId) {
            const ci = navCell(x), cj = navCell(z);
            if (!navInside(ci, cj) || NAV.dist[navIdx(ci, cj)] < 0) continue;   // kapalı avlu vb.
        }
        return { x, y: 0, z };
    }
    return null;
}
const MAPS = {
    depot: {
        name: 'Depo',
        desc: 'Tuğla duvarlı kapalı depo; kasalar ve siperler',
        floorY: 0, killY: -Infinity, bulletMinY: 0, bulletMaxY: 10, enemyRange: 25,
        spawn: { x: 0, y: 0, z: 10, angle: 0 },
        duel: { player: { x: 0, y: 0, z: 12, angle: Math.PI }, bot: { x: 0, y: 0, z: 34 } },
        build: buildDepot,
        enemySpawn: floorSpawn
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

MAPS.desert = {
    name: 'Çöl',
    desc: 'Kum taşı kasaba; dar sokaklar, kemerler, pazar meydanı ve çatısına çıkılan gözetleme evi',
    floorY: 0, killY: -Infinity, bulletMinY: 0, bulletMaxY: 60, enemyRange: 30,
    spawn: { x: 0, y: 0, z: 36, angle: 0 },
    duel: { player: { x: 0, y: 0, z: 20, angle: 0 }, bot: { x: 0, y: 0, z: -10 } },
    build: buildDesert,
    enemySpawn: floorSpawn
};

MAPS.snow = {
    name: 'Kar Üssü',
    desc: 'Karlı dağdaki askerî üs; konteynerler, yakıt tankları, kışla ve basamaklı gözetleme kulesi',
    floorY: 0, killY: -Infinity, bulletMinY: 0, bulletMaxY: 60, enemyRange: 30,
    spawn: { x: 0, y: 0, z: 34, angle: 0 },
    duel: { player: { x: 0, y: 0, z: 18, angle: 0 }, bot: { x: 0, y: 0, z: -12 } },
    build: buildSnow,
    enemySpawn: floorSpawn
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
    // Önceki bölümden kalan cesetler, bombalar ve yerdeki eşyalar yeni bölüme taşınmasın
    clearCorpses(); clearGrenades(); clearDrops();
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
    damagePlayer(35, true, 300);
    if (state !== 'playing') return;              // düşüş öldürdüyse el bitti
    camera.position.set(s.x, s.y + CFG.eyeHeight, s.z);
    player.velY = 0; player.airVX = 0; player.airVZ = 0; player.onGround = true;
    showBanner('BOŞLUĞA DÜŞTÜN!', '-35 can', 1600);
}

// ---------------------------------------------------------------------
//  ÇÖL — kum taşı bir kasaba. Yerleşim bu oyuna özgüdür:
//  ortada pazar meydanı, kuzey-güney ana cadde, iki yanda evler ve ara sokaklar,
//  kemerli geçitler, palmiyeler ve basamaklarla çatısına çıkılan bir gözetleme evi.
// ---------------------------------------------------------------------
function createSandTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d6b47a';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
        const v = Math.random();
        ctx.fillStyle = v < 0.5 ? 'rgba(160,120,70,0.25)' : 'rgba(250,230,190,0.3)';
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function createSandstoneTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b8935e';
    ctx.fillRect(0, 0, 256, 256);
    const rows = 8, rh = 256 / rows;
    for (let r = 0; r < rows; r++) {
        const off = r % 2 ? 32 : 0;
        for (let x = -64; x < 256; x += 64) {
            const v = 200 + Math.floor(Math.random() * 30);
            ctx.fillStyle = `rgb(${v},${Math.floor(v * 0.83)},${Math.floor(v * 0.58)})`;
            ctx.fillRect(x + off + 2, r * rh + 2, 60, rh - 4);
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function buildDesert() {
    scene.background = new THREE.Color(0xf2d9a7);
    scene.fog = new THREE.FogExp2(0xeed5a4, 0.011);
    mapGroup.add(new THREE.HemisphereLight(0xfff1d6, 0xb08850, 0.3));

    const sand = createSandTexture();
    sand.repeat.set(24, 24);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ map: sand, color: 0xc9b08a, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    mapGroup.add(floor);

    const stoneTex = createSandstoneTexture();
    const stoneMat = (w, h) => {
        const t = stoneTex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, w / 4), Math.max(1, h / 4));
        return new THREE.MeshStandardMaterial({ map: t, color: 0xdcc8a8, roughness: 0.95 });   // güneşte fazla parlamasın
    };
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.9 });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x2b1d12 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x9c7445, roughness: 0.9 });

    // Kasaba duvarı
    const B = 45;
    addWall(0, 4, -B, 90, 8, 2, stoneMat(90, 8));
    addWall(0, 4, B, 90, 8, 2, stoneMat(90, 8));
    addWall(-B, 4, 0, 2, 8, 90, stoneMat(90, 8));
    addWall(B, 4, 0, 2, 8, 90, stoneMat(90, 8));

    // Ev: duvar + çatı kenarı + kapı ve pencereler (kapı merkeze bakan yüzde)
    const house = (x, z, w, d, h) => {
        addWall(x, h / 2, z, w, h, d, stoneMat(Math.max(w, d), h));
        const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3), trimMat);
        rim.position.set(x, h + 0.15, z);
        mapGroup.add(rim);
        const faceX = Math.abs(x) > Math.abs(z);              // merkeze bakan yüz: x mi z mi
        const sx = -Math.sign(x) || 1, sz = -Math.sign(z) || 1;
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), doorMat);
        if (faceX) { door.position.set(x + sx * (w / 2 + 0.02), 1.2, z); door.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; }
        else { door.position.set(x, 1.2, z + sz * (d / 2 + 0.02)); door.rotation.y = sz > 0 ? 0 : Math.PI; }
        mapGroup.add(door);
        if (h >= 4) {
            for (const k of [-1, 1]) {
                const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), windowMat);
                if (faceX) { win.position.set(x + sx * (w / 2 + 0.02), h - 1.3, z + k * Math.min(2.5, d / 4)); win.rotation.y = door.rotation.y; }
                else { win.position.set(x + k * Math.min(2.5, w / 4), h - 1.3, z + sz * (d / 2 + 0.02)); win.rotation.y = door.rotation.y; }
                mapGroup.add(win);
            }
        }
    };
    // Batı yakası
    house(-14, -32, 14, 8, 6);
    house(-31, -31, 10, 12, 5);
    house(-14, -17, 8, 6, 4);
    house(-31, -13, 12, 8, 7);
    house(-21, 15, 10, 8, 5);
    house(-35, 15, 8, 12, 6);
    house(-17, 31, 14, 8, 5);
    house(-35, 34, 10, 8, 4);
    // Doğu yakası
    house(17, -33, 12, 8, 6);
    house(33, -29, 10, 12, 5);
    house(18, -17, 10, 6, 4);
    house(35, -6, 8, 10, 6);
    house(19, 17, 8, 10, 7);
    house(35, 21, 10, 8, 5);
    house(21, 34, 12, 6, 4);

    // Kemerli geçitler: iki sütun ve üstte taş kiriş (kirişin altından geçilir, mermi çarpar)
    const arch = (x, z, alongX, span) => {
        const m = stoneMat(4, 5);
        if (alongX) {
            addWall(x - span / 2, 2.5, z, 1.2, 5, 1.2, m);
            addWall(x + span / 2, 2.5, z, 1.2, 5, 1.2, m);
            addWall(x, 5.25, z, span + 1.2, 1, 1.4, m);
        } else {
            addWall(x, 2.5, z - span / 2, 1.2, 5, 1.2, m);
            addWall(x, 2.5, z + span / 2, 1.2, 5, 1.2, m);
            addWall(x, 5.25, z, 1.4, 1, span + 1.2, m);
        }
    };
    arch(0, -24, true, 8);      // kuzey cadde girişi
    arch(0, 24, true, 8);       // güney cadde girişi
    arch(11, 0, false, 6);      // meydandan doğuya
    arch(-11, 0, false, 6);     // meydandan batıya

    // Pazar meydanı: kuyu (ortadan kaydırılmış, cadde açık kalsın) ve gölgelikli tezgâhlar
    addWall(6, 0.6, 5, 3, 1.2, 3, stoneMat(3, 1.2));
    const well = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.18, 8, 20), trimMat);
    well.rotation.x = Math.PI / 2; well.position.set(6, 1.25, 5); mapGroup.add(well);
    const canopyColors = [0xb91c1c, 0x1d4ed8, 0x15803d, 0xb45309];
    [[-8, -6], [8, -7], [-7, 8]].forEach(([x, z], i) => {
        addWall(x, 0.55, z, 3, 1.1, 2, crateMaterial);
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 2.8),
            new THREE.MeshStandardMaterial({ color: canopyColors[i % canopyColors.length], roughness: 0.8 }));
        canopy.position.set(x, 2.5, z); canopy.rotation.z = 0.08;
        mapGroup.add(canopy);
        [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]].forEach(([dx, dz]) => {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), trimMat);
            pole.position.set(x + dx, 1.25, z + dz); mapGroup.add(pole);
        });
    });

    // Kasalar ve alçak kum torbası siperleri
    [[-3.5, 14, 1.4, 1, 1.4], [3.5, -14, 1.4, 1, 1.4], [-24, 0, 2, 1, 2], [24, -24, 2, 1, 2], [-24, 24, 2, 1, 2]]
        .forEach(([x, z, w, h, d]) => addWall(x, h / 2, z, w, h, d, crateMaterial));
    const sandbag = new THREE.MeshStandardMaterial({ color: 0xa88b5b, roughness: 1 });
    [[0, -38, 6, 0.9, 1], [-26, -22, 1, 0.9, 5], [27, 10, 1, 0.9, 5]].forEach(([x, z, w, h, d]) => addWall(x, h / 2, z, w, h, d, sandbag));

    // Gözetleme evi: basamaklarla (1 → 2 birim) çatısına (3 birim) çıkılır
    house(25, 4, 6, 6, 3);
    addWall(19.2, 0.5, 4, 1.6, 1, 4, crateMaterial);
    addWall(21, 1, 4, 2, 2, 4, stoneMat(2, 2));

    // Palmiyeler: ince gövde (çarpışmalı) + yapraklar (görsel)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7d2c, roughness: 0.9, side: THREE.DoubleSide });
    [[-6, 14], [6, -16], [-38, -42 + 4], [38, 40], [-40, 2], [40, -40]].forEach(([x, z]) => {
        walls.push({ x, z, w: 0.6, d: 0.6, h: 6, b: 0 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 6, 8), trunkMat);
        trunk.position.set(x, 3, z); trunk.castShadow = true; mapGroup.add(trunk);
        for (let k = 0; k < 6; k++) {
            const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 4), leafMat);
            const a = (k / 6) * Math.PI * 2;
            leaf.position.set(x + Math.cos(a) * 1.2, 6, z + Math.sin(a) * 1.2);
            leaf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
            leaf.castShadow = true;
            mapGroup.add(leaf);
        }
    });
}

// ---------------------------------------------------------------------
//  KAR ÜSSÜ — karlı bir dağ yamacındaki askerî üs. Yerleşim bu oyuna özgüdür:
//  kuzeyde komuta binası, iki yanda kışlalar, ortada açık avlu ve konteyner yığınları,
//  batıda yakıt tankları, doğuda basamaklarla çıkılan gözetleme kulesi. Kar yağar.
// ---------------------------------------------------------------------
function createSnowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eef3f8';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(170,190,215,0.25)' : 'rgba(255,255,255,0.6)';
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function createConcreteTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7b8794';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1500; i++) {
        const v = 100 + Math.floor(Math.random() * 60);
        ctx.fillStyle = `rgba(${v},${v + 6},${v + 14},0.35)`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let k = 0; k < 256; k += 64) { ctx.fillRect(0, k, 256, 2); ctx.fillRect(k, 0, 2, 256); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function buildSnow() {
    scene.background = new THREE.Color(0xc9d5e2);
    scene.fog = new THREE.FogExp2(0xd6e0ea, 0.017);
    mapGroup.add(new THREE.HemisphereLight(0xeaf2ff, 0x8a9bb0, 0.35));

    const snowTex = createSnowTexture();
    snowTex.repeat.set(20, 20);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100),
        new THREE.MeshStandardMaterial({ map: snowTex, color: 0xc9d3df, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    mapGroup.add(floor);

    const concTex = createConcreteTexture();
    const concMat = (w, h) => {
        const t = concTex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, w / 4), Math.max(1, h / 4));
        return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    };
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf5f8fc, roughness: 1 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.5, metalness: 0.6 });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });     // ışığı yanan pencereler
    // Çatısı karla kaplı yapı (kar örtüsü yalnızca görsel)
    const building = (x, z, w, d, h, mat) => {
        addWall(x, h / 2, z, w, h, d, mat || concMat(Math.max(w, d), h));
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4), snowCapMat);
        cap.position.set(x, h + 0.17, z);
        mapGroup.add(cap);
    };
    const windows = (x, z, w, d, h, faceZ) => {
        // faceZ: pencerelerin baktığı yön (+1 güney, -1 kuzey); yoksa x yüzlerine
        const n = Math.max(1, Math.floor((faceZ ? w : d) / 4));
        for (let k = 0; k < n; k++) {
            const off = -((faceZ ? w : d) / 2) + (k + 0.5) * ((faceZ ? w : d) / n);
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), windowMat);
            if (faceZ) { win.position.set(x + off, h - 1.4, z + faceZ * (d / 2 + 0.02)); win.rotation.y = faceZ > 0 ? 0 : Math.PI; }
            else { const sx = -Math.sign(x) || 1; win.position.set(x + sx * (w / 2 + 0.02), h - 1.4, z + off); win.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; }
            mapGroup.add(win);
        }
    };

    // Üs çiti: beton duvar
    const B = 45;
    addWall(0, 3.5, -B, 90, 7, 2, concMat(90, 7));
    addWall(0, 3.5, B, 90, 7, 2, concMat(90, 7));
    addWall(-B, 3.5, 0, 2, 7, 90, concMat(90, 7));
    addWall(B, 3.5, 0, 2, 7, 90, concMat(90, 7));

    // Kuzeyde komuta binası, iki yanda kışlalar
    building(0, -32, 18, 8, 7); windows(0, -32, 18, 8, 7, 1);
    building(-32, -18, 8, 18, 4); windows(-32, -18, 8, 18, 4, 0);
    building(32, -20, 8, 14, 4); windows(32, -20, 8, 14, 4, 0);
    building(-31, 22, 10, 10, 5); windows(-31, 22, 10, 10, 5, 0);

    // Konteyner yığınları (renkli, oluklu görünüm için iki ton)
    const contColors = [0xb91c1c, 0x1d4ed8, 0x15803d, 0xc2410c, 0x0f766e];
    let ci = 0;
    const container = (x, z, alongX, y = 0) => {
        const w = alongX ? 6 : 2.5, d = alongX ? 2.5 : 6, h = 2.6;
        const col = contColors[ci++ % contColors.length];
        addWall(x, y + h / 2, z, w, h, d, new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, metalness: 0.3 }));
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.15, d + 0.1), snowCapMat);
        cap.position.set(x, y + h + 0.07, z);
        mapGroup.add(cap);
    };
    container(-12, -12, true);
    container(-12, -12, true, 2.6);     // üst üste iki konteyner (yüzen değil: alttaki taşır)
    container(13, -9, false);
    container(-15, 8, false);
    container(14, 12, true);
    container(-6, 22, true);
    container(20, 30, false);
    container(-22, -36, true);

    // Batıda yakıt tankları (yuvarlak görünüm, kare çarpışma)
    [[-36, 2], [-36, 9]].forEach(([x, z]) => {
        walls.push({ x, z, w: 4.4, d: 4.4, h: 4, b: 0 });
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4, 20), metalMat);
        tank.position.set(x, 2, z); tank.castShadow = true; mapGroup.add(tank);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.25, 20), snowCapMat);
        top.position.set(x, 4.1, z); mapGroup.add(top);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.3, 20),
            new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 }));
        band.position.set(x, 2.6, z); mapGroup.add(band);
    });

    // Alçak siperler: kum torbası/beton bariyer (üstlerinden atlanır) ve kar yığınları
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9 });
    [[-10, 4, 6, 1], [-6, -2, 1, 5], [7, -2, 1, 5], [26, 6, 1, 6], [-24, -2, 6, 1], [6, -22, 6, 1], [-8, 32, 5, 1]]
        .forEach(([x, z, w, d]) => addWall(x, 0.5, z, w, 1, d, barrierMat));
    [[-20, 30, 3, 0.3, 3], [24, -4, 3, 0.3, 4], [0, -18, 4, 0.3, 2.5]]
        .forEach(([x, z, w, h, d]) => {
            addWall(x, h / 2, z, w, h, d, snowCapMat);           // üstünde yürünebilir kar tümseği
        });
    // Kasalar
    [[-26, 14, 1.4, 1, 1.4], [27, -36, 2, 1, 2], [-38, -38, 2, 1.2, 2], [38, 38, 2, 1, 2]]
        .forEach(([x, z, w, h, d]) => addWall(x, h / 2, z, w, h, d, crateMaterial));

    // Doğuda gözetleme kulesi: basamaklar (1 → 2) ile 3 birimlik platforma çıkılır
    addWall(36, 1.5, 18, 6, 3, 6, concMat(6, 3));
    addWall(30.2, 0.5, 18, 1.6, 1, 4, crateMaterial);
    addWall(32, 1, 18, 2, 2, 4, concMat(2, 2));
    // Kulenin korkulukları (alçak, görsel + çarpışmalı) ve çatı direkleri
    [[36, 15.2, 6, 0.2], [36, 20.8, 6, 0.2], [38.8, 18, 0.2, 6]].forEach(([x, z, w, d]) =>
        addWall(x, 3.45, z, w, 0.9, d, metalMat));
    [[33.4, 15.4], [38.6, 15.4], [33.4, 20.6], [38.6, 20.6]].forEach(([x, z]) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), metalMat);
        pole.position.set(x, 4.5, z); mapGroup.add(pole);
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.25, 6.4), snowCapMat);
    roof.position.set(36, 6.1, 18); mapGroup.add(roof);

    // Telsiz anteni (yalnızca görsel; tabanı çarpışmalı)
    addWall(20, 0.5, -30, 2, 1, 2, concMat(2, 1));
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 16, 6), metalMat);
    mast.position.set(20, 9, -30); mapGroup.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    beacon.position.set(20, 17.2, -30); mapGroup.add(beacon);

    // Çam ağaçları (çit dışında, sadece manzara)
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x1f4d3a, roughness: 0.9 });
    for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2, r = 52 + (i % 3) * 5;
        const x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.8 + (i % 4) * 0.2;
        const tree = new THREE.Mesh(new THREE.ConeGeometry(2.4 * s, 9 * s, 8), pineMat);
        tree.position.set(x, 4.5 * s, z); mapGroup.add(tree);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 2.6 * s, 8), snowCapMat);
        tip.position.set(x, 8 * s, z); mapGroup.add(tip);
    }

    // Kar yağışı: oyuncunun çevresinde düşen noktalar (yere inen tanecik tekrar yukarıdan başlar)
    const N = 1600, R = 30, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 2 * R;
        pos[i * 3 + 1] = Math.random() * 18;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * R;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flakes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.9 }));
    mapGroup.add(flakes);
    let t = 0;
    mapAnimators.push((dt) => {
        t += dt;
        flakes.position.set(camera.position.x, 0, camera.position.z);   // yağış oyuncuyla gelir
        const arr = geo.attributes.position.array;
        for (let i = 0; i < N; i++) {
            let y = arr[i * 3 + 1] - dt * (1.6 + (i % 5) * 0.25);
            if (y < 0) y += 18;
            arr[i * 3 + 1] = y;
            arr[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.3;               // hafif rüzgâr salınımı
        }
        geo.attributes.position.needsUpdate = true;
    });
}
