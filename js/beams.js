'use strict';

// =====================================================================
//  IŞIN SİLAHLARI — anında isabet eden atışlar (mermi uçmaz)
//  - Işın Tüfeği: duvara kadar düz bir çizgide yolundaki BÜTÜN düşmanları deler; sarmal ışık izi.
//  - Yıldırım: kısa menzilde önündeki ilk düşmana sürekli akım; zikzaklı şimşek çizgisi.
//  İsabet, düşmanın kendi hitTest'iyle (kafa / gövde) çizgi boyunca örneklenerek bulunur.
// =====================================================================
let beamFx = [];                     // { obj, t, life, fade: [materyaller] }
let lastBeamHitSfx = 0;

// Kameradan bakış yönünde duvara (ya da menzil sonuna) kadar olan uzaklık
function traceWall(origin, dir, maxDist) {
    const p = new THREE.Vector3();
    const M = curMap();
    for (let d = 0.3; d <= maxDist; d += 0.2) {
        p.copy(origin).addScaledVector(dir, d);
        if (pointInWall(p) || p.y < M.bulletMinY || p.y > M.bulletMaxY) return d;
    }
    return maxDist;
}

// Çizginin [0, maxDist] aralığında değdiği düşmanlar (yakından uzağa), her biri için vurulan yer
function enemiesOnRay(origin, dir, maxDist) {
    const targets = isDuelMode ? (duelBot ? [duelBot] : []) : enemies;
    const out = [], p = new THREE.Vector3();
    for (const e of targets) {
        const c = e.group.position;
        // Düşmanın eksenine en yakın geçiş noktası; oradan ±1.5 birim örnekle
        const t0 = (c.x - origin.x) * dir.x + (e.midY() - origin.y) * dir.y + (c.z - origin.z) * dir.z;
        if (t0 < -1.5 || t0 > maxDist + 1.5) continue;
        const from = Math.max(0, t0 - 1.5), to = Math.min(maxDist, t0 + 1.5);
        for (let t = from; t <= to; t += 0.04) {
            p.copy(origin).addScaledVector(dir, t);
            const hit = e.hitTest(p);
            if (hit) { out.push({ e, hit, t, point: p.clone() }); break; }
        }
    }
    return out.sort((a, b) => a.t - b.t);
}

// Namlunun ucu (ekranın sağ altındaki silahtan çıkıyormuş gibi görünsün)
function muzzlePoint(dir) {
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    return camera.position.clone().addScaledVector(dir, 0.6).addScaledVector(right, 0.14).addScaledVector(up, -0.13);
}

function hitEnemy(h, damage) {
    const dmg = h.hit === 'head' ? damage * 2 : damage;
    h.e.takeDamage(dmg);
    showDamageNumber(h.e, dmg, h.hit === 'head');
    flashClass('crosshair', h.hit === 'head' ? 'head' : 'hit', 120);
    return dmg;
}

// ---- Işın Tüfeği ----
function fireRail(dir, damage) {
    const origin = camera.position.clone();
    const range = curWeapon().range;
    const wall = traceWall(origin, dir, range);
    const hits = enemiesOnRay(origin, dir, wall);
    let biggest = 0;
    for (const h of hits) {
        const dmg = hitEnemy(h, damage);
        biggest = Math.max(biggest, dmg);
        createParticles(h.point, 0x67e8f9, 10);
        if (h.e.health <= 0) onEnemyKilled(h.e, h.hit);
    }
    if (hits.length) sfx(hits.some(h => h.hit === 'head') ? 'head' : 'hit', biggest);
    const end = origin.clone().addScaledVector(dir, wall);
    if (wall < range) createParticles(end, 0x67e8f9, 8);
    railTrail(muzzlePoint(dir), end);
}

// Düz ışık çekirdeği + etrafında dönen sarmal noktalar; 0.9 sn'de söner
function railTrail(a, b) {
    const len = a.distanceTo(b);
    if (len < 0.1) return;
    const dir = b.clone().sub(a).normalize();
    const group = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xe0f7ff, transparent: true, opacity: 0.95, depthWrite: false });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 6, 1, true), coreMat);
    core.position.copy(a).add(b).multiplyScalar(0.5);
    core.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    group.add(core);
    // Sarmal: bakış yönüne dik iki eksen üzerinde dönen noktalar
    const n1 = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const n2 = new THREE.Vector3().crossVectors(dir, n1).normalize();
    // Sarmal namludan 1.2 birim ileride başlar (kameraya çok yakın noktalar ekranda iri kare görünmesin)
    const start = Math.min(1.2, len), N = Math.max(0, Math.min(1200, Math.floor((len - start) * 14))), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
        const t = start + i / 14, ang = t * 7;
        const q = a.clone().addScaledVector(dir, t).addScaledVector(n1, Math.cos(ang) * 0.09).addScaledVector(n2, Math.sin(ang) * 0.09);
        pos[i * 3] = q.x; pos[i * 3 + 1] = q.y; pos[i * 3 + 2] = q.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const spiralMat = new THREE.PointsMaterial({ color: 0x22d3ee, size: 0.05, transparent: true, opacity: 0.9, depthWrite: false });
    group.add(new THREE.Points(g, spiralMat));
    scene.add(group);
    beamFx.push({ obj: group, t: 0, life: 0.9, fade: [coreMat, spiralMat], base: [0.95, 0.9] });
}

// ---- Yıldırım ----
function fireLightning(dir, damage) {
    const origin = camera.position.clone();
    const range = curWeapon().range;
    const wall = traceWall(origin, dir, range);
    const h = enemiesOnRay(origin, dir, wall)[0];
    let end = origin.clone().addScaledVector(dir, wall);
    if (h) {
        const dmg = hitEnemy(h, damage);
        end = h.point;
        if (Math.random() < 0.4) createParticles(h.point, 0x93c5fd, 2);
        const now = performance.now();
        if (now - lastBeamHitSfx > 110) { lastBeamHitSfx = now; sfx(h.hit === 'head' ? 'head' : 'hit', dmg * 4); }
        if (h.e.health <= 0) onEnemyKilled(h.e, h.hit);
    }
    boltLine(muzzlePoint(dir), end);
}

// Zikzaklı şimşek çizgisi: her atışta yeniden çizilir, çok kısa yaşar
function boltLine(a, b) {
    const seg = 12, pts = [];
    const len = a.distanceTo(b);
    for (let i = 0; i <= seg; i++) {
        const p = a.clone().lerp(b, i / seg);
        if (i > 0 && i < seg) p.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(Math.min(0.5, len * 0.04)));
        pts.push(p);
    }
    // Parlak çekirdek + çevresinde yarı saydam mavi hale: her ekranda (karda da) seçilsin
    const curve = new THREE.CatmullRomCurve3(pts);
    const group = new THREE.Group();
    const m1 = new THREE.MeshBasicMaterial({ color: 0xeff6ff, transparent: true, opacity: 1, depthWrite: false });
    const m2 = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.45, depthWrite: false });
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.018, 4), m1));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.06, 5), m2));
    scene.add(group);
    beamFx.push({ obj: group, t: 0, life: 0.07, fade: [m1, m2], base: [1, 0.45] });
}

function updateBeams(dt) {
    for (let i = beamFx.length - 1; i >= 0; i--) {
        const f = beamFx[i];
        f.t += dt;
        const k = Math.max(0, 1 - f.t / f.life);
        f.fade.forEach((m, j) => { m.opacity = f.base[j] * k; });
        if (f.t >= f.life) {
            scene.remove(f.obj);
            f.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
            f.fade.forEach(m => m.dispose());
            beamFx.splice(i, 1);
        }
    }
}

function clearBeams() {
    beamFx.forEach(f => { scene.remove(f.obj); f.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); }); f.fade.forEach(m => m.dispose()); });
    beamFx = [];
}
