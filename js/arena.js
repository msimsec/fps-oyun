'use strict';

// =====================================================================
//  ARENA ÖĞELERİ — haritadaki sabit eşyalar, güç kutusu, madalyalar/anons, roket zıplaması
//  - Her bölümde sabit noktalarda eşyalar durur; alınınca bir süre sonra aynı yerde yeniden çıkar.
//    Büyük Can canı sınırın üstüne çıkarır, fazlası yavaşça erir.
//  - Güç kutusu (yalnızca dalga modu): elin başından bir süre sonra belirir; alınca 20 sn güç verir.
//  - Madalyalar: belli başarılarda ekranda ve sesli (tarayıcının Türkçe sesiyle) duyurulur.
//  - Roket zıplaması: kendi roketin/bomban yakınında patlarsa seni iter (ayağının dibine atınca
//    yukarı fırlarsın; canın yine azalır).
// =====================================================================
const ITEM_DEFS = {
    health: { name: 'CAN +25',       icon: '➕', color: 0x22c55e, respawn: 25 },
    mega:   { name: 'BÜYÜK CAN +50', icon: '💚', color: 0xa3e635, respawn: 45 },
    armor:  { name: 'KALKAN +25',    icon: '🛡️', color: 0x38bdf8, respawn: 30 },
    ammo:   { name: 'CEPHANE KUTUSU', icon: '📦', color: 0xfacc15, respawn: 30 }
};
const MEGA_EXTRA = 50;            // Büyük Can canı sınırın bu kadar üstüne çıkarabilir
const OVERHEAL_DECAY = 2;         // sınırın üstündeki can saniyede bu kadar erir

const POWERUPS = {
    rage:   { name: 'ÖFKE',   desc: '3 kat hasar',                         color: 0xef4444, icon: '🔥' },
    haste:  { name: 'RÜZGÂR', desc: 'hızlı koşu ve hızlı ateş',             color: 0xfacc15, icon: '💨' },
    shadow: { name: 'GÖLGE',  desc: 'düşman mermileri çok sapar',          color: 0xa78bfa, icon: '👤' },
    heal:   { name: 'ŞİFA',   desc: 'can, hasar alsan da hızla dolar',      color: 0x22c55e, icon: '✚' }
};
const POWER_IDS = Object.keys(POWERUPS);
const POWER_TIME = 20, POWER_FIRST = 40, POWER_RESPAWN = 75;

// Bölüm başına: [tür, x, z, y] eşyalar ve güç kutusunun yeri
const MAP_ITEM_SPOTS = {
    depot:  { items: [['health', -26.4, -30, 0], ['health', 33.6, 30, 0], ['armor', 32.4, -30, 0], ['ammo', -27.6, 30, 0], ['mega', 0, -34, 0]], power: [0, -22, 0] },
    space:  { items: [['health', 36, -8, 2], ['health', -36, -8, 2], ['armor', 4, 36, -3], ['ammo', 0, -8, 0], ['mega', 18, -25, 11]], power: [0, -42, 4] },
    desert: { items: [['health', -8, -4, 0], ['health', 8, 24, 0], ['armor', 24, -22, 0], ['ammo', -22, 0, 0], ['mega', 25, 4, 3]], power: [0, -8, 0] },
    snow:   { items: [['health', -20, 0, 0], ['health', 20, 22, 0], ['armor', 0, -24, 0], ['ammo', 24, -30, 0], ['mega', 36, 18, 3]], power: [0, 8, 0] },
    tower:  { items: [['health', -24, 24, 0], ['health', 24, -24, 0], ['armor', -32, -32, 3], ['ammo', 26, 26, 0], ['mega', 0, 0, 4]], power: [32, 32, 3] },
    harbor: { items: [['health', -34, 2, 0], ['health', 30, 22, 0], ['armor', 0, -36, 0], ['ammo', -8, 30, 0], ['mega', 26, 34, 2.6]], power: [0, -20, 0] }
};

let mapItems = [];                 // { type, x, y, z, root, item, timer } — timer > 0: yeniden çıkmayı bekliyor
let powerSpot = null;              // { x, y, z, root, item, ring, timer, kind }
const power = { kind: null, time: 0 };

const powerOn = (k) => power.kind === k && power.time > 0;
const dmgBoost = () => (powerOn('rage') ? 3 : 1);
const hasteMul = () => (powerOn('haste') ? 1.35 : 1);       // hareket hızı
const fireMul = () => (powerOn('haste') ? 0.65 : 1);        // atış arası süre
const shadowMul = () => (powerOn('shadow') ? 3 : 1);        // düşman mermisinin sapması
const healthCap = () => player.maxHealth + MEGA_EXTRA;

// ---- Görseller ----
const ARENA_GEO = {
    pad: new THREE.CylinderGeometry(0.7, 0.8, 0.12, 24),
    crossA: new THREE.BoxGeometry(0.5, 0.16, 0.16),
    crossB: new THREE.BoxGeometry(0.16, 0.5, 0.16),
    shield: new THREE.CylinderGeometry(0.28, 0.28, 0.08, 6),
    box: new THREE.BoxGeometry(0.5, 0.32, 0.36),
    orb: new THREE.IcosahedronGeometry(0.34, 0)
};

function itemModel(type) {
    const g = new THREE.Group(), c = ITEM_DEFS[type].color;
    const m = glowMat(c);
    if (type === 'health' || type === 'mega') {
        g.add(new THREE.Mesh(ARENA_GEO.crossA, m), new THREE.Mesh(ARENA_GEO.crossB, m));
        if (type === 'mega') g.scale.setScalar(1.6);
    } else if (type === 'armor') {
        const s = new THREE.Mesh(ARENA_GEO.shield, m); s.rotation.x = Math.PI / 2; g.add(s);
    } else {
        g.add(new THREE.Mesh(ARENA_GEO.box, m));
    }
    return g;
}

function itemPad(color) {
    const pad = new THREE.Mesh(ARENA_GEO.pad, new THREE.MeshStandardMaterial({ color: 0x334155, emissive: color, emissiveIntensity: 0.25, roughness: 0.6 }));
    pad.position.y = 0.06;
    return pad;
}

// Bölüm kurulurken (buildMap) eşyaları ve güç kutusunu yerleştir
function buildMapItems(mapId) {
    mapItems = []; powerSpot = null;
    const spots = MAP_ITEM_SPOTS[mapId];
    if (!spots) return;
    for (const [type, sx, sz, y] of spots.items) {
        const { x, z } = freeDropSpot(sx, y, sz);
        const root = new THREE.Group();
        root.position.set(x, y, z);
        root.add(itemPad(ITEM_DEFS[type].color));
        const item = itemModel(type);
        item.position.y = 0.75;
        const label = dropLabel(ITEM_DEFS[type]);
        label.position.y = 1.45;
        item.add(label);
        root.add(item);
        mapGroup.add(root);
        mapItems.push({ type, x, y, z, root, item, timer: 0 });
    }
    const [px, pz, py] = spots.power;
    const proot = new THREE.Group();
    proot.position.set(px, py, pz);
    proot.add(itemPad(0xffffff));
    const orb = new THREE.Mesh(ARENA_GEO.orb, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.3 }));
    orb.position.y = 1;
    proot.add(orb);
    mapGroup.add(proot);
    powerSpot = { x: px, y: py, z: pz, root: proot, item: orb, timer: POWER_FIRST, kind: null };
    resetArena();
}

// Her elin başında: bütün eşyalar yerinde, güç kutusu bir süre sonra, aktif güç yok
function resetArena() {
    mapItems.forEach(it => { it.timer = 0; it.item.visible = true; });
    if (powerSpot) { powerSpot.timer = POWER_FIRST; powerSpot.kind = null; powerSpot.item.visible = false; }
    power.kind = null; power.time = 0;
    updatePowerHud();
}

// Eşyanın etkisi; alınamıyorsa (can/kalkan dolu) false
function applyMapItem(type) {
    switch (type) {
        case 'health':
            if (player.health >= player.maxHealth) return false;
            player.health = Math.min(player.maxHealth, player.health + 25);
            addKillFeed('➕ +25 Can', false);
            return true;
        case 'mega':
            if (player.health >= healthCap()) return false;
            player.health = Math.min(healthCap(), player.health + 50);
            addKillFeed(`💚 Büyük Can +50 (sınırın üstü yavaşça erir)`, true);
            return true;
        case 'armor':
            if (player.armor >= CFG.armorAmount) return false;
            player.armor = Math.min(CFG.armorAmount, player.armor + 25);
            addKillFeed('🛡️ +25 Kalkan', false);
            return true;
        case 'ammo': {
            const got = WEAPON_ORDER.filter(id => player.ownedWeapons[id] && player.arsenal[id] &&
                !WEAPONS[id].melee && player.arsenal[id].pool !== Infinity);
            got.forEach(id => { player.arsenal[id].pool += magSize(id); });
            addKillFeed('📦 Cephane kutusu: her silaha bir şarjör yedek', false);
            flashClass('ammoHud', 'gain', 700);
            return true;
        }
    }
    return false;
}

const nearPlayer = (x, y, z) => Math.hypot(x - camera.position.x, z - camera.position.z) < 1.4 && Math.abs(footY() - y) < 1.2;

function activatePower(kind) {
    power.kind = kind; power.time = POWER_TIME;
    const P = POWERUPS[kind];
    popText(`${P.icon} ${P.name}`, P.color);                    // dalga duyurusuyla çakışmasın: ayrı yazı
    addKillFeed(`${P.icon} ${P.name}: ${POWER_TIME} saniye ${P.desc}`, true);
    announce(P.name);
    sfx('achievement');
    updatePowerHud();
}

function updateArena(dt) {
    arenaTime += dt;
    // Sınırın üstündeki can (Büyük Can) yavaşça erir
    if (player.health > player.maxHealth) player.health = Math.max(player.maxHealth, player.health - OVERHEAL_DECAY * dt);
    const t = clock.elapsedTime;
    for (const it of mapItems) {
        if (it.timer > 0) {
            it.timer -= dt;
            if (it.timer <= 0) { it.timer = 0; it.item.visible = true; }
            continue;
        }
        it.item.rotation.y += dt * 1.6;
        it.item.position.y = 0.75 + Math.sin(t * 2 + it.x) * 0.08;
        if (nearPlayer(it.x, it.y, it.z) && applyMapItem(it.type)) {
            it.item.visible = false;
            it.timer = ITEM_DEFS[it.type].respawn;
            runStats.pickups++;
            sfx('pickup');
            checkAchievements();
        }
    }
    // Güç kutusu yalnızca dalga modunda
    if (powerSpot && !isDuelMode) {
        if (!powerSpot.kind) {
            powerSpot.timer -= dt;
            if (powerSpot.timer <= 0) {
                powerSpot.kind = POWER_IDS[Math.floor(Math.random() * POWER_IDS.length)];
                const c = POWERUPS[powerSpot.kind].color;
                powerSpot.item.material.color.setHex(c); powerSpot.item.material.emissive.setHex(c);
                powerSpot.item.visible = true;
                showToast(`⚡ Güç kutusu belirdi: ${POWERUPS[powerSpot.kind].name}`);
            }
        } else {
            powerSpot.item.rotation.y += dt * 2.4; powerSpot.item.rotation.x += dt * 1.1;
            powerSpot.item.position.y = 1 + Math.sin(t * 2.5) * 0.12;
            if (nearPlayer(powerSpot.x, powerSpot.y, powerSpot.z)) {
                activatePower(powerSpot.kind);
                powerSpot.kind = null; powerSpot.item.visible = false; powerSpot.timer = POWER_RESPAWN;
            }
        }
    }
    if (power.kind) {
        power.time -= dt;
        if (powerOn('heal')) player.health = Math.min(Math.max(player.health, player.maxHealth), player.health + 15 * dt);
        if (power.time <= 0) {
            showToast(`${POWERUPS[power.kind].name} bitti`);
            power.kind = null; power.time = 0;
        }
        updatePowerHud();
    }
}

function updatePowerHud() {
    const el = $('powerHud');
    if (!el) return;
    if (power.kind && power.time > 0) {
        const P = POWERUPS[power.kind];
        el.textContent = `${P.icon} ${P.name} ${Math.ceil(power.time)}`;
        el.style.borderColor = el.style.color = '#' + P.color.toString(16).padStart(6, '0');
        el.classList.add('show');
    } else el.classList.remove('show');
    document.body.dataset.power = power.kind && power.time > 0 ? power.kind : '';
}

// ---- Roket zıplaması: kendi patlamanın itmesi ----
const BLAST_PUSH = 13;            // ayağının dibindeki patlama ~3 birim yukarı fırlatır
function blastKnockback(pos, R) {
    const c = new THREE.Vector3(camera.position.x, footY() + 0.7, camera.position.z);
    const d = c.distanceTo(pos);
    if (d >= R || !blastClear(pos, c)) return;
    const s = BLAST_PUSH * (1 - d / R);
    const dir = c.sub(pos);
    if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
    dir.normalize();
    // Yerdeyken zayıf itme (uzaktaki patlama) yok sayılır: hız yalnızca havadayken işlediği için
    // yerde verilen yatay hız kalır ve sonraki zıplamada oyuncuyu kaydırırdı
    if (player.onGround && s <= 2) return;
    player.velY = Math.max(player.velY, 0) + dir.y * s;
    player.airVX += dir.x * s * 0.8;
    player.airVZ += dir.z * s * 0.8;
    player.onGround = false;
}

// ---- Madalyalar ve anons ----
// Harika: kısa sürede art arda öldürme (iki düşman çok sık oluyordu; üç düşman gerçek bir seri).
// Keskin Göz: yalnızca Keskin Nişancı tüfeğiyle kafadan öldürünce (başka silahın kafa vuruşu sayılmaz).
const STREAK_KILLS = 3, STREAK_TIME = 3;
const SAY_GAP = 6;                // aynı anons bu kadar saniye içinde tekrar seslendirilmez
const MEDALS = {
    harika:   { name: 'HARİKA!',     say: 'Harika!',     desc: `${STREAK_TIME} saniye içinde ${STREAK_KILLS} düşman` },
    keskin:   { name: 'KESKİN GÖZ!', say: 'Keskin göz!', desc: 'Keskin Nişancı ile kafadan öldürme' },
    rezil:    { name: 'REZİL OLDU!', say: 'Rezil oldu!', desc: 'Testereli Eldiven ile öldürme' },
    kusursuz: { name: 'KUSURSUZ!',   say: 'Kusursuz!',   desc: 'dalgayı hiç hasar almadan bitirme' }
};
let killSource = null;            // öldüren silah (madalya için): 'saw', 'sniper', ...; patlama ve ışında null
let arenaTime = 0;                // oyun süresi (duraklatma sayılmaz): seri öldürme ve anons aralığı için
let recentKills = [];             // son öldürmelerin zamanları
const lastSaid = {};              // anons metni → en son söylendiği oyun zamanı

function resetMedals() {
    runStats.medals = Object.fromEntries(Object.keys(MEDALS).map(k => [k, 0]));
    arenaTime = 0; recentKills = [];
    Object.keys(lastSaid).forEach(k => delete lastSaid[k]);
}

function giveMedal(id) {
    if (!runStats.medals) resetMedals();
    runStats.medals[id]++;
    const m = MEDALS[id];
    popText(`🏅 ${m.name}`, 0xfde047);
    addKillFeed(`🏅 Madalya: ${m.name} (${m.desc})`, true);
    announce(m.say);
}

// Nişangâhın üstünde kısa süre büyüyüp sönen yazı (madalya, güç)
function popText(text, color) {
    const el = $('medalPop');
    if (!el) return;
    el.textContent = text;
    el.style.color = '#' + color.toString(16).padStart(6, '0');
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

// Öldürmeden sonra (onEnemyKilled): madalya kontrolleri
function medalOnKill(head) {
    recentKills.push(arenaTime);
    recentKills = recentKills.filter(t => arenaTime - t <= STREAK_TIME);
    if (recentKills.length >= STREAK_KILLS) { giveMedal('harika'); recentKills = []; }
    if (head && killSource === 'sniper') giveMedal('keskin');
    if (killSource === 'saw') giveMedal('rezil');
}

function medalSummary() {
    const m = runStats.medals || {};
    const parts = Object.keys(MEDALS).filter(k => m[k]).map(k => `${MEDALS[k].name.replace('!', '')} ×${m[k]}`);
    return parts.length ? `🏅 Madalyalar: ${parts.join(' · ')}` : '';
}

// Sesli anons: tarayıcının konuşma sesi (Türkçe ses varsa onu seçer). Ayarlardan kapatılabilir.
let trVoice = null;
function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    trVoice = vs.find(v => /^tr/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

function announce(text, force = false) {
    if (!settings.announcer || !('speechSynthesis' in window) || settings.volume <= 0) return;
    // Aynı söz kısa aralıkla tekrar seslendirilmez (yazısı yine çıkar)
    if (!force && lastSaid[text] !== undefined && arenaTime - lastSaid[text] < SAY_GAP) return;
    lastSaid[text] = arenaTime;
    try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'tr-TR';
        if (trVoice) u.voice = trVoice;
        u.rate = 1.05; u.pitch = 0.7; u.volume = Math.min(1, settings.volume * 1.4);
        speechSynthesis.speak(u);
    } catch (e) {}
}

// ---- DEVAM ET kaydı için ----
function arenaSnapshot() {
    return {
        items: mapItems.map(it => +it.timer.toFixed(2)),
        power: powerSpot ? [powerSpot.timer, powerSpot.kind] : null,
        active: power.kind ? [power.kind, power.time] : null,
        medals: runStats.medals || null
    };
}
function arenaRestore(s) {
    if (!s || typeof s !== 'object') return;
    if (Array.isArray(s.items) && s.items.length === mapItems.length) {
        s.items.forEach((t, i) => {
            const v = Number.isFinite(t) ? Math.max(0, Math.min(ITEM_DEFS[mapItems[i].type].respawn, t)) : 0;
            mapItems[i].timer = v; mapItems[i].item.visible = v === 0;
        });
    }
    if (powerSpot && Array.isArray(s.power)) {
        const [timer, kind] = s.power;
        if (POWERUPS[kind]) {
            powerSpot.kind = kind; powerSpot.timer = 0;
            const c = POWERUPS[kind].color;
            powerSpot.item.material.color.setHex(c); powerSpot.item.material.emissive.setHex(c);
            powerSpot.item.visible = true;
        } else if (Number.isFinite(timer)) powerSpot.timer = Math.max(0, Math.min(POWER_RESPAWN, timer));
    }
    if (Array.isArray(s.active) && POWERUPS[s.active[0]] && Number.isFinite(s.active[1]) && s.active[1] > 0) {
        power.kind = s.active[0]; power.time = Math.min(POWER_TIME, s.active[1]);
    }
    if (s.medals && typeof s.medals === 'object') {
        resetMedals();
        Object.keys(MEDALS).forEach(k => { runStats.medals[k] = Math.max(0, Math.floor(Number(s.medals[k]) || 0)); });
    }
    updatePowerHud();
}
