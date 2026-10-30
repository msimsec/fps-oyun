'use strict';

// =====================================================================
//  DÜŞMAN / 1v1 BOT
// =====================================================================
// Düşman tipi renkleri için paylaşılan materyaller
const typeMatCache = {};
function typeMat(color) {
    return typeMatCache[color] || (typeMatCache[color] = new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
}

class HumanoidEnemy {
    // hpMul / speedMul: dalga ilerledikçe düşmanlar güçlenir; typeId: ENEMY_TYPES anahtarı
    constructor(x, z, isDuel = false, hpMul = 1, speedMul = 1, typeId = 'grunt') {
        this.isDuel = isDuel;
        this.type = isDuel ? null : ENEMY_TYPES[typeId] || ENEMY_TYPES.grunt;
        this.typeId = isDuel ? 'duel' : typeId;
        this.scale = isDuel ? CFG.enemyScale : this.type.scale;
        this.radius = 0.6 * this.scale / CFG.enemyScale;   // iri düşmanlar duvara daha erken değer
        this.group = new THREE.Group();
        const bm = isDuel ? MAT.duelBody : typeMat(this.type.body);
        const hm = isDuel ? MAT.duelHead : typeMat(this.type.head);

        const body = new THREE.Mesh(GEO.body, bm);
        body.position.y = 0.6; body.castShadow = true;
        const head = new THREE.Mesh(GEO.head, hm);
        head.position.y = 1.45; head.castShadow = true;
        const la = new THREE.Mesh(GEO.arm, bm); la.position.set(-0.6, 0.6, 0);
        const ra = new THREE.Mesh(GEO.arm, bm); ra.position.set(0.6, 0.6, 0);
        this.group.add(body, head, la, ra);
        // Tipe özgü ayırt edici parçalar
        if (typeId === 'tank' && !isDuel) {
            const pad = typeMat(0x1e293b);
            const lp = new THREE.Mesh(GEO.shoulder, pad); lp.position.set(-0.62, 1.15, 0);
            const rp = new THREE.Mesh(GEO.shoulder, pad); rp.position.set(0.62, 1.15, 0);
            const plate = new THREE.Mesh(GEO.chestPlate, pad); plate.position.set(0, 0.7, 0.27);
            this.group.add(lp, rp, plate);
        } else if (typeId === 'sniper' && !isDuel) {
            const gun = new THREE.Mesh(GEO.longGun, typeMat(0x111827));
            gun.position.set(0.6, 0.85, 0.55);
            const visor = new THREE.Mesh(GEO.visor, typeMat(0x22d3ee));
            visor.position.set(0, 1.5, 0.26);
            this.group.add(gun, visor);
        } else if (typeId === 'runner' && !isDuel) {
            const band = new THREE.Mesh(GEO.headband, typeMat(0x111827));
            band.position.set(0, 1.55, 0);
            this.group.add(band);
        }

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
        this.group.scale.setScalar(this.scale);
        scene.add(this.group);

        this.health = Math.round((isDuel ? CFG.duelHealth : CFG.enemyHealth * this.type.hp) * hpMul);
        this.maxHealth = this.health;
        this.speed = (isDuel ? CFG.duelSpeed : CFG.enemySpeed * this.type.speed) * speedMul;
        // ilk atıştan önce kısa bir süre (normal düşmanlar aynı anda ateş etmesin diye rastgele)
        this.shootTimer = isDuel ? CFG.botFirstShot : this.nextFireDelay();
        this.strafeDir = 1;
        this.strafeTimer = 0;
        this.blindTime = 0;        // nişancı: oyuncuyu kaç saniyedir göremiyor
        this.sightCheck = 0;
    }

    update(dt) {
        const p = this.group.position;
        const dx = camera.position.x - p.x;
        const dz = camera.position.z - p.z;
        const dist = Math.hypot(dx, dz) || 0.0001;
        const nx = dx / dist, nz = dz / dist;
        this.group.rotation.y = Math.atan2(dx, dz);

        if (this.isDuel) {
            this.strafeAndKeepDistance(dt, dist, nx, nz, 6, 10);

            this.shootTimer -= dt;
            if (this.shootTimer <= 0) {
                this.shootTimer = CFG.botFireInterval;
                this.shootAtPlayer(CFG.botBulletDamage, CFG.botSpread);
            }
        } else if (this.type.keepDistance && this.blindTime < 2.5) {
            // Nişancı: yaklaşmaz, belli mesafede yana kayarak ateş eder
            this.strafeAndKeepDistance(dt, dist, nx, nz, this.type.keepDistance[0], this.type.keepDistance[1]);
            this.updateSight(dt);
            this.tryShoot(dt, dist);
        } else if (this.type.keepDistance) {
            // Uzun süredir oyuncuyu göremiyor (ör. duvarın arkasında kaldı): görene kadar yaklaş.
            // Yoksa saklanmış bir nişancı yüzünden dalga hiç bitmeyebilir.
            this.chase(dt, dist, nx, nz);
            this.updateSight(dt);
        } else {
            if (dist > 1.5) {
                this.chase(dt, dist, nx, nz);
            } else if (footY() - p.y < 1.2 && footY() - p.y > -1) {
                // Oyuncu yüksek bir kasanın üstündeyse yakın temas hasarı yok (ateş etmeye devam ederler)
                damagePlayer(CFG.meleeDps * this.type.melee * dt);   // saniye bazlı yakın temas hasarı
            }
            this.tryShoot(dt, dist);
        }

        if (this.hpBar.visible) this.hpBar.lookAt(camera.position);
    }

    // Bulunduğu yükseklikte yürür; zemini olmayan bölümde (Space) platformun dışına çıkmaz
    move(dx, dz) {
        const p = this.group.position;
        const y = p.y;
        const canStand = curMap().floorY === -Infinity
            ? (x, z) => groundHeight(x, z, y, 0.3) >= y - 0.05 : null;
        moveWithCollision(p, dx, dz, this.radius, y, canStand);
    }

    // Oyuncuya doğru yürü; duvara takılırsa duvar boyunca yana kay, o yön de kapalıysa yön değiştir
    chase(dt, dist, nx, nz) {
        const p = this.group.position;
        const step = this.speed * dt;
        const ox = p.x, oz = p.z;
        this.move(nx * step, nz * step);
        if (Math.hypot(p.x - ox, p.z - oz) < step * 0.5) {
            this.move(-nz * this.strafeDir * step, nx * this.strafeDir * step);
            if (Math.hypot(p.x - ox, p.z - oz) < step * 0.1) this.strafeDir *= -1;
        }
    }

    // Görüş kontrolü her karede değil, 0.4 saniyede bir (her kontrol duvar taraması yapar)
    updateSight(dt) {
        this.sightCheck -= dt;
        if (this.sightCheck > 0) { if (this.blindTime > 0) this.blindTime += dt; return; }
        this.sightCheck = 0.4;
        if (this.canSeePlayer()) this.blindTime = 0;
        else this.blindTime += dt + 0.0001;
    }

    // Belli bir mesafe aralığında kal, sağa-sola kay (düello botu ve nişancı)
    strafeAndKeepDistance(dt, dist, nx, nz, near, far) {
        const p = this.group.position;
        let mx = 0, mz = 0;
        if (dist > far) { mx = nx; mz = nz; }
        else if (dist < near) { mx = -nx; mz = -nz; }
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
            this.strafeDir = Math.random() < 0.5 ? -1 : 1;
            this.strafeTimer = 0.8 + Math.random() * 1.2;
        }
        mx += -nz * this.strafeDir * 0.7;
        mz += nx * this.strafeDir * 0.7;
        this.move(mx * this.speed * dt, mz * this.speed * dt);
    }

    tryShoot(dt, dist) {
        this.shootTimer -= dt;
        if (this.shootTimer > 0) return;
        this.shootTimer = this.nextFireDelay();
        // Space'te platformlar uzak: bölüm kendi menzilini verir
        const range = Math.max(this.type.range || 0, curMap().enemyRange);
        if (dist > 1.5 && dist < range && this.canSeePlayer()) {
            this.shootAtPlayer(CFG.enemyBulletDamage * this.type.dmg, CFG.enemySpread * this.type.spread);
        }
    }

    nextFireDelay() {
        const mul = this.type ? this.type.fire : 1;
        return (CFG.enemyFireMin + Math.random() * (CFG.enemyFireMax - CFG.enemyFireMin)) * mul;
    }

    // Arada duvar varsa ateş etmez (mermi boşa duvara gitmesin)
    canSeePlayer() {
        const from = new THREE.Vector3(this.group.position.x, this.group.position.y + 1.4 * this.scale, this.group.position.z);
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
        const origin = new THREE.Vector3(this.group.position.x, this.group.position.y + 1.4 * this.scale, this.group.position.z);
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
        const k = this.scale;
        const h = Math.hypot(pt.x - p.x, pt.z - p.z) / k;
        const y = (pt.y - p.y) / k;
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
    return curMap().enemySpawn(camera.position.x, camera.position.z);
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
    const score = Math.round(100 * e.type.reward) + (head ? 50 : 0);
    const gold = Math.round(CFG.killGold * e.type.reward);
    player.score += score;
    player.kills++;
    if (head) player.headshots++;
    player.gold += gold;
    player.goldEarned += gold;
    // Her sahip olunan silaha biraz yedek mermi (tabancanınki zaten sınırsız)
    WEAPON_ORDER.forEach(id => {
        if (player.ownedWeapons[id] && WEAPONS[id].killAmmo) player.arsenal[id].pool += WEAPONS[id].killAmmo;
    });
    addKillFeed(`${head ? 'KAFA VURUŞU! ' : ''}${e.type.name} öldü +${score} · +${gold} 🪙`, head);
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
