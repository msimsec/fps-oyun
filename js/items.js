'use strict';

// =====================================================================
//  BOMBA (G tuşu) — atılır, sekerek yuvarlanır, kısa süre sonra patlar.
//  Patlama yarıçapındaki düşmanlara (ve çok yakındaysa oyuncuya) uzaklıkla azalan hasar verir;
//  arada duvar olan hedefler korunur.
// =====================================================================
let grenades = [];
let explosions = [];
const GRENADE_GEO = new THREE.SphereGeometry(0.14, 10, 8);
const GRENADE_MAT = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.6, metalness: 0.3 });
const BLAST_GEO = new THREE.SphereGeometry(1, 16, 12);

function throwGrenade() {
    if (player.grenades <= 0) { showToast('Bomban kalmadı'); return; }
    if (player.grenadeCd > 0) return;
    player.grenades--;
    player.grenadeCd = 0.6;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const mesh = new THREE.Mesh(GRENADE_GEO, GRENADE_MAT);
    mesh.position.copy(camera.position).addScaledVector(dir, 0.6);
    mesh.position.y -= 0.2;
    mesh.castShadow = true;
    scene.add(mesh);
    grenades.push({
        mesh, fuse: CFG.grenadeFuse,
        vx: dir.x * CFG.grenadeSpeed, vy: dir.y * CFG.grenadeSpeed + 3.5, vz: dir.z * CFG.grenadeSpeed
    });
    sfx('throw');
}

function updateGrenades(dt) {
    if (player.grenadeCd > 0) player.grenadeCd -= dt;
    for (let i = grenades.length - 1; i >= 0; i--) {
        const g = grenades[i], p = g.mesh.position;
        g.fuse -= dt;
        g.vy -= CFG.gravity * dt;
        // Eksen eksen ilerle: duvara çarpan eksende sekip yavaşla
        const nx = p.x + g.vx * dt;
        if (pointInWall({ x: nx, y: p.y, z: p.z })) g.vx *= -0.4; else p.x = nx;
        const nz = p.z + g.vz * dt;
        if (pointInWall({ x: p.x, y: p.y, z: nz })) g.vz *= -0.4; else p.z = nz;
        const ground = groundHeight(p.x, p.z, p.y, 0) + 0.14;
        const ny = p.y + g.vy * dt;
        if (ny <= ground && g.vy < 0) {
            p.y = ground;
            g.vy = Math.abs(g.vy) > 2 ? -g.vy * 0.35 : 0;
            g.vx *= 0.6; g.vz *= 0.6;
        } else if (pointInWall({ x: p.x, y: ny, z: p.z }) || ny > curMap().bulletMaxY - 0.2) {
            g.vy = -g.vy * 0.3;              // tavana / kirişin altına çarptı
        } else {
            p.y = ny;
        }
        g.mesh.rotation.x += dt * 8;
        if (p.y < curMap().killY) {            // boşluğa düştü: patlamadan kaybolur
            scene.remove(g.mesh); grenades.splice(i, 1); continue;
        }
        if (g.fuse <= 0) {
            scene.remove(g.mesh); grenades.splice(i, 1);
            explode(p.clone());
        }
    }
    // Patlama küresi: hızla büyüyüp söner
    for (let i = explosions.length - 1; i >= 0; i--) {
        const e = explosions[i];
        e.t += dt;
        const k = e.t / 0.4;
        if (k >= 1) { scene.remove(e.mesh); e.mesh.material.dispose(); explosions.splice(i, 1); continue; }
        e.mesh.scale.setScalar(0.5 + e.r * 0.8 * Math.sqrt(k));
        e.mesh.material.opacity = 0.75 * (1 - k);
    }
}

// Patlama noktasından hedefe kadar duvar var mı
function blastClear(from, to) {
    const steps = Math.ceil(from.distanceTo(to) / 0.4);
    const pt = new THREE.Vector3();
    for (let i = 1; i < steps; i++) {
        pt.lerpVectors(from, to, i / steps);
        if (pointInWall(pt)) return false;
    }
    return true;
}

// R: patlama yarıçapı, power: merkezdeki hasar (bomba için ayarlardan; roket için silah hasarından)
// opts.pct: hasar düşmanın canının yüzdesi olarak (roket): patlama merkezine yarıçapın %10'u
//   kadar yakın olan canının yarısını, %20'si kadar yakın olan yarıdan biraz azını kaybeder,
//   kenara doğru sıfıra iner. opts.direct: roketin doğrudan çarptığı düşman (tam hasar alır).
// Roket patlaması gerçekte en öldürücü silah: yarıçapın ilk %25'inde (düşmanın ayağının dibi
// dahil) öldürür; dışarı doğru hızla azalır (%50'de ~%65, %75'te ~%28, kenarda 0).
const ROCKET_SPLASH = (d, R) => {
    const k = d / R;
    if (k <= 0.25) return 1.05;
    return Math.max(0, 1.05 * Math.pow(1 - (k - 0.25) / 0.75, 1.2));
};
function explode(pos, R = CFG.grenadeRadius, power = CFG.grenadeDamage, opts = {}) {
    ensureFxLights();
    // Görsel: hızla büyüyen şok küresi, ateş topu, kara duman, kıvılcımlar, parlama ışığı, sarsıntı
    const mesh = new THREE.Mesh(BLAST_GEO, new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.45 }));
    mesh.position.copy(pos);
    scene.add(mesh);
    explosions.push({ mesh, t: 0, r: R });
    const rnd = (k) => new THREE.Vector3((Math.random() - 0.5) * k, Math.random() * k * 0.6, (Math.random() - 0.5) * k);
    makePuff(pos, 0xffffff, R * 0.5, 0.12, true, null, 1);                       // ilk beyaz parlama
    for (let i = 0; i < 9; i++) makePuff(pos.clone().add(rnd(R * 0.4)), i % 2 ? 0xff7a1a : 0xffc04a, R * 0.35, 0.45 + Math.random() * 0.2, true, rnd(4), 1.8);
    for (let i = 0; i < 8; i++) makePuff(pos.clone().add(rnd(R * 0.3)), 0x3f3f46, R * 0.3, 1.6 + Math.random() * 0.6, false, rnd(2).add(new THREE.Vector3(0, 1.2, 0)), 2.2);
    createParticles(pos, 0xffb020, 22);
    createParticles(pos, 0x52525b, 10);
    fxLights.blast.position.copy(pos); fxLights.blast.position.y += 1;
    fxLights.blast.intensity = 5;
    const d = Math.hypot(pos.x - camera.position.x, pos.z - camera.position.z);
    camShake = Math.max(camShake, Math.max(0, 1 - d / 30) * 0.9);
    sfx('explode', Math.max(0.3, 1 - d / 60));

    const dmgAt = (dist) => power * (1 - dist / R) + 20;
    const center = new THREE.Vector3();
    const targets = isDuelMode ? (duelBot ? [duelBot] : []) : enemies.slice();
    let kills = 0;
    for (const e of targets) {
        const gp = e.group.position;
        center.set(gp.x, e.midY(), gp.z);
        const dist = center.distanceTo(pos);
        if (dist > R || !blastClear(pos, center)) continue;
        // Yüzdeli hasar yalnızca dalga düşmanlarına: düello botunun canı çok yüksek, yüzdeyle
        // iki roket botu bitirirdi; bot için uzaklıkla azalan sabit hasar kullanılır.
        const pct = opts.pct && !e.isDuel;
        const dmg = pct
            // Doğrudan isabet, yanına düşmekten asla az vurmaz (çok canlı düşmanda yüzde daha büyük olabilir)
            ? Math.round(Math.max(e === opts.direct ? power : 0, e.maxHealth * ROCKET_SPLASH(dist, R)))
            : Math.round(e === opts.direct ? Math.max(power, dmgAt(dist)) : dmgAt(dist));
        if (dmg <= 0) continue;
        e.takeDamage(dmg);
        showDamageNumber(e, dmg, false);
        if (e.health <= 0) { onEnemyKilled(e, 'body'); kills++; }
    }
    if (kills) runStats.bestBlast = Math.max(runStats.bestBlast, kills);
    // Oyuncu kendi bombasından / roketinden de etkilenir (yarı hasar)
    const pd = camera.position.distanceTo(pos);
    if (pd < R && blastClear(pos, camera.position)) {
        // Kendi roketin: aynı eğri, yarı şiddette (dibinde patlarsa canının yarısı gider)
        const self = opts.pct ? player.maxHealth * ROCKET_SPLASH(pd, R) * 0.5 : dmgAt(pd) * 0.5;
        if (self > 0) damagePlayer(self, false, 300, pos);
    }
    if (kills) checkAchievements();
}

// =====================================================================
//  ROKETATAR — roket düz gider; duvara, zemine ya da bir hedefe değince (ya da menzili
//  bitince) patlar. Patlama bomba ile aynı kuralları izler: yarıçap içinde azalan hasar,
//  duvar arkası korunur, çok yakındaki oyuncuya yarı hasar.
// =====================================================================
let rockets = [];
const ROCKET_BODY_GEO = new THREE.CylinderGeometry(0.075, 0.075, 0.55, 10);
ROCKET_BODY_GEO.rotateX(Math.PI / 2);            // uzun ekseni z boyunca (burun -z'de)
const ROCKET_NOSE_GEO = new THREE.ConeGeometry(0.075, 0.2, 10);
ROCKET_NOSE_GEO.rotateX(-Math.PI / 2); ROCKET_NOSE_GEO.translate(0, 0, -0.37);
const ROCKET_FIN_GEO = new THREE.BoxGeometry(0.26, 0.012, 0.12);
ROCKET_FIN_GEO.translate(0, 0, 0.22);
const ROCKET_MAT = new THREE.MeshStandardMaterial({ color: 0x4d5a2e, roughness: 0.5, metalness: 0.4 });
const ROCKET_NOSE_MAT = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4, metalness: 0.3 });

// =====================================================================
//  EFEKTLER — ateş ve duman bulutları (kameraya dönük parlak lekeler), patlama ışığı, ekran sarsıntısı
// =====================================================================
let puffs = [];
let fxLights = null;
const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
})();

// Işıklar sahneye bir kez eklenir; kapalıyken şiddeti 0 (sonradan ışık ekleyip çıkarmak oyunu takıltır)
function ensureFxLights() {
    if (fxLights) return;
    fxLights = { rocket: new THREE.PointLight(0xffa040, 0, 10), blast: new THREE.PointLight(0xffb050, 0, 26) };
    scene.add(fxLights.rocket, fxLights.blast);
}

// glow: true → parlak ateş (toplamalı karışım), false → duman
function makePuff(pos, color, size, life, glow, vel = null, grow = 1.5) {
    const mat = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false,
        opacity: glow ? 1 : 0.7, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(pos);
    sp.scale.setScalar(size);
    scene.add(sp);
    puffs.push({ sp, life, max: life, size, grow, vel: vel || new THREE.Vector3(0, glow ? 0 : 0.6, 0), op: mat.opacity });
    if (puffs.length > 220) killPuff(0);
}
function killPuff(i) { scene.remove(puffs[i].sp); puffs[i].sp.material.dispose(); puffs.splice(i, 1); }

function updateFx(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life -= dt;
        if (p.life <= 0) { killPuff(i); continue; }
        const k = 1 - p.life / p.max;
        p.sp.position.addScaledVector(p.vel, dt);
        p.sp.scale.setScalar(p.size * (1 + p.grow * k));
        p.sp.material.opacity = p.op * (1 - k);
    }
    if (fxLights) {
        fxLights.blast.intensity = Math.max(0, fxLights.blast.intensity - dt * 12);
        if (!rockets.length) fxLights.rocket.intensity = 0;
    }
    camShake = Math.max(0, camShake - dt * 2.2);
}

function clearFx() {
    while (puffs.length) killPuff(puffs.length - 1);
    if (fxLights) { fxLights.rocket.intensity = 0; fxLights.blast.intensity = 0; }
    camShake = 0;
}

// Nişangâhın baktığı nokta (en fazla 80 birim ya da ilk duvar): roket namludan çıkıp oraya gider
function aimPoint(dir) {
    const p = camera.position.clone();
    for (let d = 0.5; d < 80; d += 0.5) {
        p.copy(camera.position).addScaledVector(dir, d);
        if (pointInWall(p) || p.y < curMap().bulletMinY) return p;
    }
    return p;
}

function spawnRocket(origin, dir, speed, damage, radius, life) {
    ensureFxLights();
    // Roket, roketatarın ağzından (sağ alt) çıkar ve nişangâhın baktığı noktaya uçar
    const muzzle = camera.localToWorld(new THREE.Vector3(0.27, -0.13, -1.0));
    const target = aimPoint(dir);
    const d = target.clone().sub(muzzle);
    const v = d.lengthSq() > 4 ? d.normalize() : dir.clone();
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(ROCKET_BODY_GEO, ROCKET_MAT));
    mesh.add(new THREE.Mesh(ROCKET_NOSE_GEO, ROCKET_NOSE_MAT));
    const f1 = new THREE.Mesh(ROCKET_FIN_GEO, ROCKET_MAT), f2 = new THREE.Mesh(ROCKET_FIN_GEO, ROCKET_MAT);
    f2.rotation.z = Math.PI / 2;
    mesh.add(f1, f2);
    // Arkada parlak alev ve çevresinde turuncu hale
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe08a, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.position.z = 0.4; flame.scale.setScalar(0.8);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff7a1a, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    halo.position.z = 0.45; halo.scale.setScalar(1.9);
    mesh.add(flame, halo);
    mesh.position.copy(muzzle);
    mesh.lookAt(muzzle.clone().sub(v));
    scene.add(mesh);
    rockets.push({ mesh, vel: v.multiplyScalar(speed), life, damage, radius, flame, halo });
    // Atış anı: namlu alevi, ağızdan duman, kısa sarsıntı
    makePuff(muzzle, 0xffd27a, 0.9, 0.1, true, null, 1);
    for (let i = 0; i < 4; i++) {
        makePuff(muzzle, 0xb8b8b8, 0.35, 0.9, false,
            new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.5 + Math.random(), (Math.random() - 0.5) * 1.5), 2.5);
    }
    camShake = Math.max(camShake, 0.18);
}

function updateRockets(dt) {
    const step = new THREE.Vector3();
    for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i], p = r.mesh.position;
        r.life -= dt;
        r.flame.scale.setScalar(0.7 + Math.random() * 0.4);
        r.halo.material.opacity = 0.6 + Math.random() * 0.3;
        // Hızlı roket ince duvarın içinden geçmesin diye küçük adımlarla ilerle
        const n = Math.max(1, Math.ceil(r.vel.length() * dt / 0.25));
        step.copy(r.vel).multiplyScalar(dt / n);
        let boom = null, direct = null;
        for (let k = 0; k < n && !boom; k++) {
            const prev = p.clone();
            p.add(step);
            if (p.y < curMap().bulletMinY || p.y > curMap().bulletMaxY || pointInWall(p)) { boom = prev; break; }
            const targets = isDuelMode ? (duelBot ? [duelBot] : []) : enemies;
            direct = targets.find(e => e.hitTest(p)) || null;
            if (direct) boom = p.clone();
        }
        // Duman izi: roketin arkasında kalan, büyüyüp sönen gri bulutlar ve kısa ateş kıvılcımları
        const tail = p.clone().addScaledVector(r.vel, -0.45 / r.vel.length());
        makePuff(tail, 0xe4e4e7, 0.45, 1.6, false, new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.4, (Math.random() - 0.5) * 0.3), 3.2);
        makePuff(tail, 0xff9a3c, 0.5, 0.15, true, null, 0.5);
        if (i === rockets.length - 1 && fxLights) {           // en son atılan roketi ışık izler
            fxLights.rocket.position.copy(p);
            fxLights.rocket.intensity = 2.2;
        }
        if (!boom && r.life <= 0) boom = p.clone();
        if (boom) {
            scene.remove(r.mesh);
            r.flame.material.dispose(); r.halo.material.dispose();
            rockets.splice(i, 1);
            // Space'te boşlukta biten roket patlamadan kaybolur (altında hiçbir şey yok)
            if (r.life <= 0 && boom.y < curMap().killY) continue;
            explode(boom, r.radius, r.damage, { pct: true, direct });
        }
    }
}

// =====================================================================
//  YAYLI TÜFEK OKLARI — ok hafifçe düşerek uçar; düşmana değince hasar verir (kafaya 2 kat),
//  duvara ya da zemine saplanınca bir süre orada kalır.
// =====================================================================
let bolts = [];
const BOLT_SHAFT_GEO = new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6);
BOLT_SHAFT_GEO.rotateX(Math.PI / 2);
const BOLT_TIP_GEO = new THREE.ConeGeometry(0.025, 0.08, 6);
BOLT_TIP_GEO.rotateX(-Math.PI / 2);
BOLT_TIP_GEO.translate(0, 0, -0.33);
const BOLT_FLETCH_GEO = new THREE.BoxGeometry(0.004, 0.05, 0.1);
BOLT_FLETCH_GEO.translate(0, 0, 0.25);
const BOLT_MAT = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5, metalness: 0.5 });

function spawnBolt(origin, dir, speed, damage, gravity, life) {
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(BOLT_SHAFT_GEO, BOLT_MAT));
    const accent = basicMat(skinBulletColor());
    mesh.add(new THREE.Mesh(BOLT_TIP_GEO, accent));
    const f1 = new THREE.Mesh(BOLT_FLETCH_GEO, accent), f2 = new THREE.Mesh(BOLT_FLETCH_GEO, accent);
    f2.rotation.z = Math.PI / 2;
    mesh.add(f1, f2);
    mesh.position.copy(origin).addScaledVector(dir, 0.3);
    scene.add(mesh);
    bolts.push({ mesh, vel: dir.clone().multiplyScalar(speed), damage, gravity, life, stuck: 0 });
}

function updateBolts(dt) {
    const step = new THREE.Vector3(), look = new THREE.Vector3();
    for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i], p = b.mesh.position;
        if (b.stuck > 0) {                                   // saplanmış ok bir süre sonra kaybolur
            b.stuck -= dt;
            if (b.stuck <= 0) { scene.remove(b.mesh); bolts.splice(i, 1); }
            continue;
        }
        b.life -= dt;
        b.vel.y -= b.gravity * dt;
        look.copy(p).sub(b.vel);                             // burun gidiş yönüne baksın (-z ileri)
        b.mesh.lookAt(look);
        const n = Math.max(1, Math.ceil(b.vel.length() * dt / 0.2));
        step.copy(b.vel).multiplyScalar(dt / n);
        let done = false;
        for (let k = 0; k < n && !done; k++) {
            p.add(step);
            if (p.y < curMap().bulletMinY || p.y > curMap().bulletMaxY || pointInWall(p)) {
                p.sub(step);
                b.stuck = 3;                                 // duvara / yere saplandı
                createParticles(p, 0xb45309, 4);
                sfx('boltHit');
                done = true;
                break;
            }
            const targets = isDuelMode ? (duelBot ? [duelBot] : []) : enemies;
            for (const e of targets) {
                const hit = e.hitTest(p);
                if (!hit) continue;
                const dmg = hit === 'head' ? b.damage * 2 : b.damage;
                e.takeDamage(dmg);
                createParticles(p, 0xb91c1c, 6);
                flashClass('crosshair', hit === 'head' ? 'head' : 'hit', 120);
                showDamageNumber(e, dmg, hit === 'head');
                sfx(hit === 'head' ? 'head' : 'hit');
                if (e.health <= 0) onEnemyKilled(e, hit);
                scene.remove(b.mesh); bolts.splice(i, 1);
                done = true;
                break;
            }
        }
        if (!done && b.life <= 0) { scene.remove(b.mesh); bolts.splice(i, 1); }
    }
}

function clearGrenades() {
    clearFx();
    bolts.forEach(b => scene.remove(b.mesh));
    bolts = [];
    rockets.forEach(r => { scene.remove(r.mesh); r.flame.material.dispose(); r.halo.material.dispose(); });
    rockets = [];
    grenades.forEach(g => scene.remove(g.mesh));
    explosions.forEach(e => { scene.remove(e.mesh); e.mesh.material.dispose(); });
    grenades = []; explosions = [];
}

// =====================================================================
//  YERDEN TOPLANANLAR — ölen düşman bazen cephane, kalkan, altın ya da bomba düşürür.
//  Üstünden geçince alınır; bir süre sonra (son saniyelerde yanıp sönerek) kaybolur.
// =====================================================================
// Her eşyanın kendine özgü modeli, yerde parlayan renkli halkası ve üstünde ne olduğunu yazan etiketi var
const DROP_TYPES = {
    ammo:    { name: 'CEPHANE',    icon: '🔫', color: 0xfacc15, weight: 40 },
    shield:  { name: 'KALKAN +25', icon: '🛡️', color: 0x38bdf8, weight: 25 },
    gold:    { name: 'ALTIN',      icon: '🪙', color: 0xffd700, weight: 20 },
    grenade: { name: 'BOMBA +1',   icon: '💣', color: 0x84cc16, weight: 15 }
};
const DROP_IDS = Object.keys(DROP_TYPES);
let drops = [];
const dropCache = {};                // tür başına paylaşılan model parçaları ve etiket

const glowMat = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.45, metalness: 0.3 });

// Eşyanın üstünde duran etiket: renkli kutu içinde simge + ad (hep kameraya döner)
// t.sub verilirse ikinci satırda küçük yazılır (cephanede: hangi silahın)
function dropLabel(t) {
    const two = !!t.sub;
    const c = document.createElement('canvas');
    c.width = 256; c.height = two ? 96 : 64;
    const ctx = c.getContext('2d');
    const hex = '#' + t.color.toString(16).padStart(6, '0');
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.strokeStyle = hex; ctx.lineWidth = 5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(4, 4, 248, c.height - 8, 14); else ctx.rect(4, 4, 248, c.height - 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = hex;
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${t.icon} ${t.name}`, 128, 34);
    if (two) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillText(t.sub, 128, 68);
    }
    const tex = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    sprite.scale.set(1.3, two ? 0.4875 : 0.325, 1);
    return sprite;
}

// Silaha özel cephane: hangi silahın, kaç tane, nasıl görünür
const AMMO_INFO = {
    crossbow: { icon: '🏹', unit: 'OK',    word: 'ok',    color: 0xd97706, amount: () => 5 },
    shotgun:  { icon: '🔴', unit: 'SAÇMA', word: 'saçma', color: 0xef4444, amount: () => 6 },
    sniper:   { icon: '🎯', unit: 'MERMİ', word: 'mermi', color: 0x22d3ee, amount: () => 5 },
    smg:      { icon: '🔫', unit: 'MERMİ', word: 'mermi', color: 0xe5e7eb, amount: () => magSize('smg') },
    rocket:   { icon: '🚀', unit: 'ROKET', word: 'roket', color: 0xf97316, amount: () => 2 }
};

// Hangi silahın cephanesi düşsün: yalnızca sahip olunanlar; elindeki silahın yedeği azsa
// ya da bir silahın mermisi hiç kalmadıysa onun düşme ihtimali artar
function pickAmmoWeapon() {
    const opts = Object.keys(AMMO_INFO).filter(id => player.ownedWeapons[id] && player.arsenal[id]);
    if (!opts.length) return null;
    const w = opts.map(id => {
        const a = player.arsenal[id];
        let k = 1;
        if (a.ammo + a.pool === 0) k += 2;
        if (id === player.weapon && a.pool < magSize(id)) k += 3;
        return k;
    });
    let r = Math.random() * w.reduce((s, v) => s + v, 0);
    for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) return opts[i]; }
    return opts[opts.length - 1];
}

// Türün 3B modeli (her çağrıda yeni grup; geometri ve materyaller paylaşılır)
function dropModel(type, weapon) {
    const C = dropCache[type] || (dropCache[type] = {});
    const g = new THREE.Group();
    const add = (geo, mat, x, y, z, rx = 0, rz = 0) => {
        const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; g.add(m); return m;
    };
    if (type === 'ammo') {
        // Yeşil cephane kutusu; bandı silahın renginde, üstünde o silahın cephanesi
        const info = AMMO_INFO[weapon];
        C.box = C.box || new THREE.BoxGeometry(0.44, 0.26, 0.28);
        C.band = C.band || new THREE.BoxGeometry(0.45, 0.06, 0.29);
        C.m1 = C.m1 || glowMat(0x4d5a2e);
        C['band' + weapon] = C['band' + weapon] || glowMat(info.color);
        add(C.box, C.m1, 0, 0, 0); add(C.band, C['band' + weapon], 0, 0.05, 0);
        const brass = C.brass || (C.brass = glowMat(0xd4a017));
        const dark = C.dark || (C.dark = glowMat(0x27272a));
        // Kutunun üstünde o silahın küçük modeli yatar (yandan tanınacak şekilde); dönerken her yönden görünür
        const wood = C.wood || (C.wood = glowMat(0x8b5a2b));
        const olive = C.olive || (C.olive = glowMat(0x4d5a2e));
        const yellow = C.yellow || (C.yellow = glowMat(0xeab308));
        const G = (k, f) => C[k] || (C[k] = f());
        const box = (k, w, h, d) => G(k, () => new THREE.BoxGeometry(w, h, d));
        const rod = (k, r, len) => G(k, () => new THREE.CylinderGeometry(r, r, len, 10));
        const Y = 0.26, R = Math.PI / 2;                 // silahın yüksekliği; R: silindiri x eksenine yatırır
        if (weapon === 'crossbow') {             // dipçik, ray, iki yana açılan yay kolları, kiriş, ok
            add(box('cbStock', 0.3, 0.07, 0.06), wood, -0.12, Y, 0);
            add(box('cbRail', 0.38, 0.035, 0.05), dark, 0.14, Y + 0.01, 0);
            const l1 = add(box('cbLimb', 0.04, 0.035, 0.3), dark, 0.3, Y + 0.01, 0.13); l1.rotation.y = 0.35;
            const l2 = add(box('cbLimb', 0.04, 0.035, 0.3), dark, 0.3, Y + 0.01, -0.13); l2.rotation.y = -0.35;
            add(box('cbStr', 0.004, 0.006, 0.5), G('strMat', () => glowMat(0xe5e7eb)), 0.22, Y + 0.02, 0);
            add(rod('cbBolt', 0.01, 0.42), C['band' + weapon], 0.12, Y + 0.04, 0, 0, R);
        } else if (weapon === 'shotgun') {       // uzun namlu, altında tüp, tahta pompa ve dipçik, kırmızı fişek
            add(rod('sgBarrel', 0.024, 0.5), dark, 0.16, Y + 0.02, 0, 0, R);
            add(rod('sgTube', 0.018, 0.38), dark, 0.12, Y - 0.025, 0, 0, R);
            add(box('sgPump', 0.13, 0.055, 0.06), wood, 0.2, Y - 0.025, 0);
            add(box('sgBody', 0.14, 0.08, 0.06), dark, -0.12, Y, 0);
            add(box('sgStock', 0.24, 0.09, 0.05), wood, -0.3, Y - 0.02, 0);
            add(rod('sgShell', 0.03, 0.09), C['band' + weapon], -0.1, Y - 0.1, 0.12);
        } else if (weapon === 'sniper') {        // uzun ince namlu, büyük dürbün, dipçik ve uzun mermi
            add(rod('snBarrel', 0.014, 0.5), dark, 0.25, Y, 0, 0, R);
            add(box('snBody', 0.26, 0.065, 0.055), dark, -0.04, Y, 0);
            add(rod('snScope', 0.032, 0.22), dark, -0.02, Y + 0.07, 0, 0, R);
            add(rod('snLens', 0.036, 0.02), C['band' + weapon], 0.1, Y + 0.07, 0, 0, R);
            add(box('snStock', 0.22, 0.09, 0.045), wood, -0.29, Y - 0.015, 0);
            add(rod('snRound', 0.02, 0.14), brass, 0.05, Y - 0.1, 0.12);
        } else if (weapon === 'smg') {           // siyah AR tipi: gövde, ray, namlu, şarjör, kabza, dipçik
            add(box('smBody', 0.3, 0.075, 0.05), dark, 0, Y, 0);
            add(box('smRail', 0.34, 0.015, 0.03), dark, 0.03, Y + 0.045, 0);
            add(rod('smBarrel', 0.013, 0.14), dark, 0.22, Y + 0.01, 0, 0, R);
            add(box('smMag', 0.045, 0.13, 0.04), dark, 0.05, Y - 0.09, 0);
            add(box('smGrip', 0.04, 0.1, 0.04), dark, -0.08, Y - 0.07, 0);
            add(box('smStock', 0.14, 0.065, 0.04), dark, -0.24, Y - 0.01, 0);
            add(box('smTip', 0.05, 0.02, 0.045), C['band' + weapon], 0.05, Y - 0.15, 0);   // açık renk şarjör tabanı
        } else {                                 // roketatar: yeşil tüp, sarı roket başlığı, kabza
            add(rod('rkTube', 0.055, 0.6), olive, -0.02, Y + 0.02, 0, 0, R);
            const head = add(G('rkHead', () => new THREE.ConeGeometry(0.05, 0.14, 10)), yellow, 0.34, Y + 0.02, 0, 0, -R);
            head.rotation.z = -R;
            add(box('rkGrip', 0.04, 0.1, 0.04), dark, 0.0, Y - 0.06, 0);
            add(box('rkBand', 0.03, 0.115, 0.115), C['band' + weapon], -0.22, Y + 0.02, 0);
        }
    } else if (type === 'shield') {
        // Mavi kalkan plakası, ortasında açık renkli artı
        C.plate = C.plate || new THREE.BoxGeometry(0.42, 0.5, 0.08);
        C.barV = C.barV || new THREE.BoxGeometry(0.08, 0.32, 0.1);
        C.barH = C.barH || new THREE.BoxGeometry(0.28, 0.08, 0.1);
        C.m1 = C.m1 || glowMat(0x1d4ed8); C.m2 = C.m2 || glowMat(0xbae6fd);
        add(C.plate, C.m1, 0, 0, 0); add(C.barV, C.m2, 0, 0, 0); add(C.barH, C.m2, 0, 0.03, 0);
    } else if (type === 'gold') {
        // Üst üste iki altın para
        C.coin = C.coin || new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20);
        C.m1 = C.m1 || glowMat(0xffd700);
        add(C.coin, C.m1, 0, 0, 0, Math.PI / 2); add(C.coin, C.m1, 0.08, 0.06, -0.08, Math.PI / 2);
    } else {
        // Yeşil el bombası, üstünde kapak ve pim halkası
        C.ball = C.ball || new THREE.SphereGeometry(0.17, 12, 10);
        C.cap = C.cap || new THREE.CylinderGeometry(0.06, 0.07, 0.08, 10);
        C.ring = C.ring || new THREE.TorusGeometry(0.06, 0.012, 6, 14);
        C.m1 = C.m1 || glowMat(0x4d7c0f); C.m2 = C.m2 || glowMat(0x9ca3af);
        add(C.ball, C.m1, 0, 0, 0); add(C.cap, C.m2, 0, 0.19, 0); add(C.ring, C.m2, 0.09, 0.22, 0, 0, Math.PI / 2);
    }
    return g;
}

function maybeDrop(x, y, z) {
    if (Math.random() >= CFG.dropChance) return;
    // Düşman havada öldüyse eşya altındaki zemine düşer; altı boşluksa (Space) hiç düşmez
    y = groundHeight(x, z, y, 0.3);
    if (!Number.isFinite(y)) return;
    let r = Math.random() * DROP_IDS.reduce((s, id) => s + DROP_TYPES[id].weight, 0);
    let type = DROP_IDS[0];
    for (const id of DROP_IDS) { r -= DROP_TYPES[id].weight; if (r <= 0) { type = id; break; } }
    let weapon = null;
    if (type === 'ammo') { weapon = pickAmmoWeapon(); if (!weapon) type = 'gold'; }
    spawnDrop(type, x, y, z, weapon);
}

// Eşya bir kasanın/duvarın içine ya da oyuncunun yaklaşamayacağı kadar dibine düştüyse
// en yakın boş yere kaydırılır (oyuncu yarıçapından geniş pay bırakılır, böylece hep alınabilir)
function freeDropSpot(x, y, z) {
    const R = CFG.playerRadius + 0.3;
    if (overlapDepth(x, z, R, y) === 0) return { x, z };
    for (let r = 0.4; r <= 10; r += 0.4) {
        for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2, nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
            // Aynı zeminde kalsın (kasanın üstüne ya da boşluğa kaymasın)
            if (overlapDepth(nx, nz, R, y) === 0 && Math.abs(groundHeight(nx, nz, y, 0.3) - y) < 0.05) return { x: nx, z: nz };
        }
    }
    return { x, z };
}

function spawnDrop(type, x, y, z, weapon = null) {
    if (type === 'ammo' && !AMMO_INFO[weapon]) weapon = 'crossbow';
    ({ x, z } = freeDropSpot(x, y, z));
    const info = type === 'ammo' ? AMMO_INFO[weapon] : null;
    const amount = info ? info.amount() : 0;
    // Cephane etiketinde silahın cephanesi ve adı yazar: "🏹 OK +5 / Yaylı Tüfek"
    const t = info ? { icon: info.icon, name: `${info.unit} +${amount}`, sub: WEAPONS[weapon].name, color: info.color }
                   : DROP_TYPES[type];
    const C = dropCache[type] || (dropCache[type] = {});
    const root = new THREE.Group();
    root.position.set(x, y, z);
    const item = dropModel(type, weapon);
    item.position.y = 0.6;
    if (type === 'ammo') item.scale.setScalar(1.3);   // silahlı cephane kutusu biraz daha büyük
    root.add(item);
    // Yerde parlayan halka
    C.ringGeo = C.ringGeo || new THREE.RingGeometry(0.45, 0.6, 28);
    const rk = 'ringMat' + t.color;
    C[rk] = C[rk] || new THREE.MeshBasicMaterial({ color: t.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(C.ringGeo, C[rk]);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    root.add(ring);
    // Etiket
    const lk = 'label' + (info ? weapon + amount : '');
    C[lk] = C[lk] || dropLabel(t);
    const label = C[lk].clone();
    label.material = label.material.clone();     // soluklaşma her eşyada ayrı olsun (doku paylaşılır)
    label.position.y = info ? 1.6 : 1.25;
    root.add(label);
    scene.add(root);
    drops.push({ type, weapon, amount, mesh: root, item, ring, label, baseY: y, life: CFG.dropLife, t: Math.random() * 6 });
    if (drops.length > 15) removeDrop(0);
}

function removeDrop(i) {
    scene.remove(drops[i].mesh);
    drops[i].label.material.dispose();           // geometri ve materyaller türler arasında paylaşıldığı için silinmez
    drops.splice(i, 1);
}

// Alınabiliyorsa etkisini uygular ve true döner (dolu kalkan / bomba çantası alınmaz)
function applyDrop(type, weapon, amount) {
    switch (type) {
        case 'ammo': {
            const a = player.arsenal[weapon];
            if (!a || !AMMO_INFO[weapon]) return false;
            a.pool += amount;
            addKillFeed(`${AMMO_INFO[weapon].icon} +${amount} ${AMMO_INFO[weapon].word} (${WEAPONS[weapon].name}) → ${a.ammo}/${a.pool}`, false);
            if (weapon === player.weapon) flashClass('ammoHud', 'gain', 700);   // elindeki silahsa mermi göstergesi yeşil yanar
            return true;
        }
        case 'shield':
            if (player.armor >= CFG.armorAmount) return false;
            player.armor = Math.min(CFG.armorAmount, player.armor + 25);
            addKillFeed('+25 Kalkan', false);
            return true;
        case 'gold':
            player.gold += CFG.killGold; player.goldEarned += CFG.killGold;
            addKillFeed(`+${CFG.killGold} 🪙`, false);
            return true;
        case 'grenade':
            if (player.grenades >= CFG.grenadeMax) return false;
            player.grenades++;
            addKillFeed('+1 Bomba', false);
            return true;
    }
    return false;
}

let dropFullHintAt = 0;
function updateDrops(dt) {
    const feet = footY();
    dropFullHintAt -= dt;
    for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i], m = d.mesh;
        d.life -= dt; d.t += dt;
        if (d.life <= 0) { removeDrop(i); continue; }
        // Silah modeli hep yandan görünsün: uzun ekseni oyuncuya dik dursun, hafifçe sallansın
        // (dönerken önden bakınca çubuk gibi görünüyordu)
        d.item.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z) + Math.sin(d.t * 1.6) * 0.35;
        d.item.position.y = 0.6 + Math.sin(d.t * 3) * 0.12;
        d.ring.scale.setScalar(1 + Math.sin(d.t * 4) * 0.08);
        m.visible = d.life > 4 || Math.floor(d.life * 6) % 2 === 0;   // kaybolmadan önce yanıp söner
        if (Math.hypot(m.position.x - camera.position.x, m.position.z - camera.position.z) < 1.5 &&
            Math.abs(feet - d.baseY) < 1.6) {
            if (applyDrop(d.type, d.weapon, d.amount)) {
                sfx('pickup');
                runStats.pickups++;
                removeDrop(i);
                checkAchievements();
            } else if (dropFullHintAt <= 0) {
                // Alınamıyor: neden alınamadığını söyle (sık sık tekrarlamadan)
                dropFullHintAt = 2;
                showToast(d.type === 'grenade'
                    ? `💣 Bomba çantan dolu (${player.grenades}/${CFG.grenadeMax}) — bomba atınca alabilirsin`
                    : `🛡️ Kalkanın dolu (${Math.ceil(player.armor)}/${CFG.armorAmount}) — hasar alınca alabilirsin`);
            }
        }
        // Dolu olduğu için şu an alınamayan eşyanın etiketi soluk görünür
        const full = (d.type === 'grenade' && player.grenades >= CFG.grenadeMax) ||
                     (d.type === 'shield' && player.armor >= CFG.armorAmount);
        if (d.label) d.label.material.opacity = full ? 0.4 : 1;
    }
}

function clearDrops() {
    while (drops.length) removeDrop(drops.length - 1);
}
