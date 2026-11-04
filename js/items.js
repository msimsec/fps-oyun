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
function explode(pos, R = CFG.grenadeRadius, power = CFG.grenadeDamage) {
    const mesh = new THREE.Mesh(BLAST_GEO, new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.75 }));
    mesh.position.copy(pos);
    scene.add(mesh);
    explosions.push({ mesh, t: 0, r: R });
    createParticles(pos, 0xffb020, 18);
    createParticles(pos, 0x52525b, 10);
    const d = Math.hypot(pos.x - camera.position.x, pos.z - camera.position.z);
    sfx('explode', Math.max(0.3, 1 - d / 60));

    const dmgAt = (dist) => power * (1 - dist / R) + 20;
    const center = new THREE.Vector3();
    const targets = isDuelMode ? (duelBot ? [duelBot] : []) : enemies.slice();
    let kills = 0;
    for (const e of targets) {
        const gp = e.group.position;
        center.set(gp.x, gp.y + 0.9 * e.scale, gp.z);
        const dist = center.distanceTo(pos);
        if (dist > R || !blastClear(pos, center)) continue;
        const dmg = Math.round(dmgAt(dist));
        e.takeDamage(dmg);
        showDamageNumber(e, dmg, false);
        if (e.health <= 0) { onEnemyKilled(e, 'body'); kills++; }
    }
    if (kills) runStats.bestBlast = Math.max(runStats.bestBlast, kills);
    // Oyuncu kendi bombasından / roketinden de etkilenir (yarı hasar)
    const pd = camera.position.distanceTo(pos);
    if (pd < R && blastClear(pos, camera.position)) damagePlayer(dmgAt(pd) * 0.5, false, 300, pos);
    if (kills) checkAchievements();
}

// =====================================================================
//  ROKETATAR — roket düz gider; duvara, zemine ya da bir hedefe değince (ya da menzili
//  bitince) patlar. Patlama bomba ile aynı kuralları izler: yarıçap içinde azalan hasar,
//  duvar arkası korunur, çok yakındaki oyuncuya yarı hasar.
// =====================================================================
let rockets = [];
const ROCKET_GEO = new THREE.CylinderGeometry(0.06, 0.08, 0.5, 8);
ROCKET_GEO.rotateX(Math.PI / 2);                 // uzun ekseni ileri baksın
const ROCKET_MAT = new THREE.MeshStandardMaterial({ color: 0x4b5320, roughness: 0.5, metalness: 0.4 });
const ROCKET_FLAME_GEO = new THREE.ConeGeometry(0.07, 0.35, 8);
ROCKET_FLAME_GEO.rotateX(-Math.PI / 2);
const ROCKET_FLAME_MAT = new THREE.MeshBasicMaterial({ color: 0xffa21f });

function spawnRocket(origin, dir, speed, damage, radius, life) {
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(ROCKET_GEO, ROCKET_MAT));
    const flame = new THREE.Mesh(ROCKET_FLAME_GEO, ROCKET_FLAME_MAT);
    flame.position.z = 0.42;
    mesh.add(flame);
    mesh.position.copy(origin).addScaledVector(dir, 0.4);
    mesh.lookAt(mesh.position.clone().sub(dir));      // burun ileri (-z ekseni gidiş yönünde değil, +z arkada)
    scene.add(mesh);
    rockets.push({ mesh, vel: dir.clone().multiplyScalar(speed), life, damage, radius, flame });
}

function updateRockets(dt) {
    const step = new THREE.Vector3();
    for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i], p = r.mesh.position;
        r.life -= dt;
        r.flame.scale.setScalar(0.8 + Math.random() * 0.5);
        // Hızlı roket ince duvarın içinden geçmesin diye küçük adımlarla ilerle
        const n = Math.max(1, Math.ceil(r.vel.length() * dt / 0.25));
        step.copy(r.vel).multiplyScalar(dt / n);
        let boom = null;
        for (let k = 0; k < n && !boom; k++) {
            const prev = p.clone();
            p.add(step);
            if (p.y < curMap().bulletMinY || p.y > curMap().bulletMaxY || pointInWall(p)) { boom = prev; break; }
            const targets = isDuelMode ? (duelBot ? [duelBot] : []) : enemies;
            if (targets.some(e => e.hitTest(p))) boom = p.clone();
        }
        if (Math.random() < 0.6) createParticles(p.clone().addScaledVector(r.vel, -0.02), 0x9ca3af, 1);   // duman izi
        if (!boom && r.life <= 0) boom = p.clone();
        if (boom) {
            scene.remove(r.mesh);
            rockets.splice(i, 1);
            // Space'te boşlukta biten roket patlamadan kaybolur (altında hiçbir şey yok)
            if (r.life <= 0 && boom.y < curMap().killY) continue;
            explode(boom, r.radius, r.damage);
        }
    }
}

function clearGrenades() {
    rockets.forEach(r => scene.remove(r.mesh));
    rockets = [];
    grenades.forEach(g => scene.remove(g.mesh));
    explosions.forEach(e => { scene.remove(e.mesh); e.mesh.material.dispose(); });
    grenades = []; explosions = [];
}

// =====================================================================
//  YERDEN TOPLANANLAR — ölen düşman bazen cephane, kalkan, altın ya da bomba düşürür.
//  Üstünden geçince alınır; bir süre sonra (son saniyelerde yanıp sönerek) kaybolur.
// =====================================================================
const DROP_TYPES = {
    ammo:    { name: 'Cephane', color: 0xfacc15, weight: 40, geo: new THREE.BoxGeometry(0.45, 0.3, 0.3) },
    shield:  { name: 'Kalkan',  color: 0x38bdf8, weight: 25, geo: new THREE.OctahedronGeometry(0.28) },
    gold:    { name: 'Altın',   color: 0xffd700, weight: 20, geo: new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16) },
    grenade: { name: 'Bomba',   color: 0x65a30d, weight: 15, geo: new THREE.SphereGeometry(0.2, 10, 8) }
};
const DROP_IDS = Object.keys(DROP_TYPES);
let drops = [];

function maybeDrop(x, y, z) {
    if (Math.random() >= CFG.dropChance) return;
    // Düşman havada öldüyse eşya altındaki zemine düşer; altı boşluksa (Space) hiç düşmez
    y = groundHeight(x, z, y, 0.3);
    if (!Number.isFinite(y)) return;
    let r = Math.random() * DROP_IDS.reduce((s, id) => s + DROP_TYPES[id].weight, 0);
    let type = DROP_IDS[0];
    for (const id of DROP_IDS) { r -= DROP_TYPES[id].weight; if (r <= 0) { type = id; break; } }
    const t = DROP_TYPES[type];
    const mesh = new THREE.Mesh(t.geo, new THREE.MeshStandardMaterial({
        color: t.color, emissive: t.color, emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.4 }));
    if (type === 'gold') mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y + 0.6, z);
    scene.add(mesh);
    drops.push({ type, mesh, baseY: y, life: CFG.dropLife, t: Math.random() * 6 });
    if (drops.length > 15) removeDrop(0);
}

function removeDrop(i) {
    scene.remove(drops[i].mesh);
    drops[i].mesh.material.dispose();
    drops.splice(i, 1);
}

// Alınabiliyorsa etkisini uygular ve true döner (dolu kalkan / bomba çantası alınmaz)
function applyDrop(type) {
    switch (type) {
        case 'ammo':
            WEAPON_ORDER.forEach(id => {
                const a = player.arsenal[id];
                if (player.ownedWeapons[id] && a && a.pool !== Infinity) a.pool += magSize(id);
            });
            addKillFeed('+ Cephane (her silaha bir şarjör)', false);
            return true;
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

function updateDrops(dt) {
    const feet = footY();
    for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i], m = d.mesh;
        d.life -= dt; d.t += dt;
        if (d.life <= 0) { removeDrop(i); continue; }
        m.rotation.y += dt * 2.2;
        m.position.y = d.baseY + 0.6 + Math.sin(d.t * 3) * 0.12;
        m.visible = d.life > 4 || Math.floor(d.life * 6) % 2 === 0;   // kaybolmadan önce yanıp söner
        if (Math.hypot(m.position.x - camera.position.x, m.position.z - camera.position.z) < 1.4 &&
            Math.abs(feet - d.baseY) < 1.6 && applyDrop(d.type)) {
            sfx('pickup');
            runStats.pickups++;
            removeDrop(i);
            checkAchievements();
        }
    }
}

function clearDrops() {
    while (drops.length) removeDrop(drops.length - 1);
}
