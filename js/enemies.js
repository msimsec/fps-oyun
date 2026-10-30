'use strict';

// =====================================================================
//  DÜŞMAN / 1v1 BOT
// =====================================================================
class HumanoidEnemy {
    // hpMul / speedMul: dalga ilerledikçe düşmanlar güçlenir
    constructor(x, z, isDuel = false, hpMul = 1, speedMul = 1) {
        this.isDuel = isDuel;
        this.group = new THREE.Group();
        const bm = isDuel ? MAT.duelBody : MAT.enemyBody;
        const hm = isDuel ? MAT.duelHead : MAT.enemyHead;

        const body = new THREE.Mesh(GEO.body, bm);
        body.position.y = 0.6; body.castShadow = true;
        const head = new THREE.Mesh(GEO.head, hm);
        head.position.y = 1.45; head.castShadow = true;
        const la = new THREE.Mesh(GEO.arm, bm); la.position.set(-0.6, 0.6, 0);
        const ra = new THREE.Mesh(GEO.arm, bm); ra.position.set(0.6, 0.6, 0);
        this.group.add(body, head, la, ra);

        // Kafanın üstünde can barı (ilk hasardan sonra görünür, hep kameraya döner)
        this.hpBar = new THREE.Group();
        this.hpBar.position.y = 1.95;
        this.hpBar.add(new THREE.Mesh(GEO.hpBar, MAT.hpBg));
        this.hpFill = new THREE.Mesh(GEO.hpBar, MAT.hpHigh);
        this.hpFill.position.z = 0.005;
        this.hpBar.add(this.hpFill);
        this.hpBar.visible = false;
        this.group.add(this.hpBar);

        this.group.position.set(x, 0, z);
        this.group.scale.setScalar(CFG.enemyScale);
        scene.add(this.group);

        this.health = Math.round((isDuel ? CFG.duelHealth : CFG.enemyHealth) * hpMul);
        this.maxHealth = this.health;
        this.speed = (isDuel ? CFG.duelSpeed : CFG.enemySpeed) * speedMul;
        // ilk atıştan önce kısa bir süre (normal düşmanlar aynı anda ateş etmesin diye rastgele)
        this.shootTimer = isDuel ? CFG.botFirstShot : this.nextFireDelay();
        this.strafeDir = 1;
        this.strafeTimer = 0;
    }

    update(dt) {
        const p = this.group.position;
        const dx = camera.position.x - p.x;
        const dz = camera.position.z - p.z;
        const dist = Math.hypot(dx, dz) || 0.0001;
        const nx = dx / dist, nz = dz / dist;
        this.group.rotation.y = Math.atan2(dx, dz);

        if (this.isDuel) {
            // Mesafeyi koru, sağa-sola kay, düzenli ateş et
            let mx = 0, mz = 0;
            if (dist > 10) { mx = nx; mz = nz; }
            else if (dist < 6) { mx = -nx; mz = -nz; }
            this.strafeTimer -= dt;
            if (this.strafeTimer <= 0) {
                this.strafeDir = Math.random() < 0.5 ? -1 : 1;
                this.strafeTimer = 0.8 + Math.random() * 1.2;
            }
            mx += -nz * this.strafeDir * 0.7;
            mz += nx * this.strafeDir * 0.7;
            moveWithCollision(p, mx * this.speed * dt, mz * this.speed * dt, 0.6);

            this.shootTimer -= dt;
            if (this.shootTimer <= 0) {
                this.shootTimer = CFG.botFireInterval;
                this.shootAtPlayer(CFG.botBulletDamage, CFG.botSpread);
            }
        } else {
            if (dist > 1.5) {
                const step = this.speed * dt;
                const ox = p.x, oz = p.z;
                moveWithCollision(p, nx * step, nz * step, 0.6);
                if (Math.hypot(p.x - ox, p.z - oz) < step * 0.5) {
                    // Duvara takıldı: duvar boyunca yana kay, o yön de kapalıysa yön değiştir
                    moveWithCollision(p, -nz * this.strafeDir * step, nx * this.strafeDir * step, 0.6);
                    if (Math.hypot(p.x - ox, p.z - oz) < step * 0.1) this.strafeDir *= -1;
                }
            } else if (footY() < 1.2) {
                // Oyuncu yüksek bir kasanın üstündeyse yakın temas hasarı yok (ateş etmeye devam ederler)
                damagePlayer(CFG.meleeDps * dt);   // saniye bazlı yakın temas hasarı
            }

            this.shootTimer -= dt;
            if (this.shootTimer <= 0) {
                this.shootTimer = this.nextFireDelay();
                if (dist > 1.5 && dist < CFG.enemyRange && this.canSeePlayer()) {
                    this.shootAtPlayer(CFG.enemyBulletDamage, CFG.enemySpread);
                }
            }
        }

        if (this.hpBar.visible) this.hpBar.lookAt(camera.position);
    }

    nextFireDelay() {
        return CFG.enemyFireMin + Math.random() * (CFG.enemyFireMax - CFG.enemyFireMin);
    }

    // Arada duvar varsa ateş etmez (mermi boşa duvara gitmesin)
    canSeePlayer() {
        const from = new THREE.Vector3(this.group.position.x, 1.4 * CFG.enemyScale, this.group.position.z);
        const to = camera.position;
        const steps = Math.ceil(from.distanceTo(to) / 0.5);
        const pt = new THREE.Vector3();
        for (let i = 1; i < steps; i++) {
            pt.lerpVectors(from, to, i / steps);
            if (pointInWall(pt)) return false;
        }
        return true;
    }

    shootAtPlayer(damage, spread) {
        const origin = new THREE.Vector3(this.group.position.x, 1.4 * CFG.enemyScale, this.group.position.z);
        const target = new THREE.Vector3(camera.position.x, camera.position.y - 0.3, camera.position.z);
        const dist = origin.distanceTo(target);
        const dir = target.sub(origin).normalize();
        // küçük sapma: bot her atışı tam isabetle yapmasın
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();
        origin.addScaledVector(dir, 0.6);
        spawnBullet(origin, dir, CFG.botBulletSpeed, damage, 0xff3333, false, CFG.botBulletLife);
        sfx('enemyShoot', Math.max(0.15, 1 - dist / 40));
    }

    // Mermi noktası gövdeye/kafaya değiyor mu? (kafa vuruşu 2x hasar)
    hitTest(pt) {
        const p = this.group.position;
        const k = CFG.enemyScale;
        const h = Math.hypot(pt.x - p.x, pt.z - p.z) / k;
        const y = pt.y / k;
        if (y > 1.2 && y < 1.75 && h < 0.35) return 'head';
        if (y >= 0 && y <= 1.2 && h < 0.7) return 'body';
        return null;
    }

    takeDamage(dmg) {
        this.health -= dmg;
        const frac = Math.max(0, this.health / this.maxHealth);
        this.hpBar.visible = true;
        this.hpFill.scale.x = Math.max(0.001, frac);
        this.hpFill.position.x = -0.45 * (1 - frac);   // sol kenara yaslı azalsın
        this.hpFill.material = frac > 0.6 ? MAT.hpHigh : frac > 0.3 ? MAT.hpMid : MAT.hpLow;
        this.hpBar.lookAt(camera.position);
    }

    destroy() { scene.remove(this.group); }
}

function hitsPlayer(pt) {
    const h = Math.hypot(pt.x - camera.position.x, pt.z - camera.position.z);
    return h < 0.45 && pt.y > footY() && pt.y < camera.position.y + 0.25;
}

function findSpawnPoint() {
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 18 + Math.random() * 10;
        const x = camera.position.x + Math.cos(angle) * radius;
        const z = camera.position.z + Math.sin(angle) * radius;
        if (Math.abs(x) < 42 && Math.abs(z) < 42 && !collides(x, z, 1.0)) return { x, z };
    }
    return null;
}

function onEnemyKilled(e, hit) {
    e.destroy();
    if (e.isDuel) {
        duelBot = null;
        pendingDuelWin = true;
        return;
    }
    const idx = enemies.indexOf(e);
    if (idx !== -1) enemies.splice(idx, 1);
    const head = hit === 'head';
    const score = head ? 150 : 100;
    player.score += score;
    player.kills++;
    if (head) player.headshots++;
    player.gold += CFG.killGold;
    player.goldEarned += CFG.killGold;
    // Her sahip olunan silaha biraz yedek mermi (tabancanınki zaten sınırsız)
    WEAPON_ORDER.forEach(id => {
        if (player.ownedWeapons[id] && WEAPONS[id].killAmmo) player.arsenal[id].pool += WEAPONS[id].killAmmo;
    });
    addKillFeed(head ? `KAFA VURUŞU! +${score} · +${CFG.killGold} 🪙` : `Düşman öldü +${score} · +${CFG.killGold} 🪙`, head);
    sfx(head ? 'killHead' : 'kill');
    saveGameData();
}

function createParticles(pos, colorHex, count = 6) {
    const mat = basicMat(colorHex);
    for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(GEO.particle, mat);
        p.position.copy(pos);
        p.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 18,
            Math.random() * 18,
            (Math.random() - 0.5) * 18
        );
        p.life = 0.4;
        scene.add(p);
        particles.push(p);
    }
}
