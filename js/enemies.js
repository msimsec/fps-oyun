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
        this.head = head;
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
        this.skills = {};          // dalgaya göre kazanılan yetenekler (waves.js atar)
        this.air = false;          // havada mı (zıplama / rampa / düşme)
        this.vy = 0; this.avx = 0; this.avz = 0;
        this.jumpCd = 0;
        this.following = false;    // duvar takibinde mi (arada duvar varken; zeminsiz bölümde)
        this.navCheck = 0; this.directPath = true;
        this.followTime = 0; this.followCheck = 0;
        this.dodgeTimer = 0; this.dodgeCooldown = 0; this.dodgeDir = 1;
    }

    update(dt) {
        const p = this.group.position;
        const dx = camera.position.x - p.x;
        const dz = camera.position.z - p.z;
        const dist = Math.hypot(dx, dz) || 0.0001;
        const nx = dx / dist, nz = dz / dist;
        this.group.rotation.y = Math.atan2(dx, dz);

        if (this.air) {
            this.updateAir(dt);
            if (this.hpBar.visible) this.hpBar.lookAt(camera.position);
            return;
        }
        // Altındaki zemin bittiyse (kasanın kenarından yürüdü) düşmeye başla
        if (!this.isDuel && groundHeight(p.x, p.z, p.y, 0.3) < p.y - 0.05) {
            this.air = true; this.vy = 0; this.avx = 0; this.avz = 0;
            return;
        }
        this.jumpCd -= dt;
        this.dodgeCooldown -= dt;
        if (this.dodgeTimer > 0) {
            // Kaçınma: vurulunca kısa süre hızla yana kay
            this.dodgeTimer -= dt;
            const s = this.speed * 2.4 * dt;
            this.move(-nz * this.dodgeDir * s, nx * this.dodgeDir * s);
        }

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
            const rise = footY() - p.y;      // oyuncu ne kadar yukarıda
            if (this.onOtherPlatform()) {
                // Space: oyuncu başka platformda. Rampa yeteneği varsa oraya giden rampaya yürü,
                // yoksa kenarda ileri geri gidip gelmek yerine yerinde yana kayarak ateş et.
                if (!(this.skills.pads && this.goToPad(dt))) this.strafeAndKeepDistance(dt, dist, nx, nz, 0, Infinity);
            } else if (dist > 1.5) {
                // Oyuncu zıplanabilecek bir kasanın üstündeyse yanına zıpla
                if (this.skills.jump && this.jumpCd <= 0 && dist < 3.5 && rise > CFG.stepHeight && rise < 1.1) this.jump(nx, nz);
                else this.chase(dt, dist, nx, nz);
            } else if (rise < 1.2 && rise > -1) {
                // Oyuncu yüksek bir kasanın üstündeyse yakın temas hasarı yok (ateş etmeye devam ederler)
                damagePlayer(CFG.meleeDps * this.type.melee * dt, false, 150, p);   // saniye bazlı yakın temas hasarı
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

    // Oyuncuya (ya da hedefe) doğru yürü. Arada duvar varsa duvar takibine geçer: hedefe dik
    // yönde duvar boyunca yürür ve hedefe giden düz yol açılana kadar bunu bırakmaz (yoksa
    // duvarın ucunda geri kayıp gidip gelir). Yön kapanırsa (köşe) diğer yöne döner, çok uzun
    // sürerse öbür taraftan dener. Alçak engel önündeyse ve zıplama yeteneği varsa üstüne zıplar.
    chase(dt, dist, nx, nz) {
        const p = this.group.position;
        const step = this.speed * dt;
        const ox = p.x, oz = p.z;
        // Zeminli bölümlerde (Depo): hedefe düz yol yoksa yol bulma alanının gösterdiği yöne git
        if (curMap().floorY !== -Infinity && NAV.dist) {
            this.navCheck -= dt;
            if (this.navCheck <= 0) { this.navCheck = 0.25; this.directPath = this.pathClear(p.x + nx * dist, p.z + nz * dist); }
            if (!this.directPath) {
                const d = navDirection(p.x, p.z);
                if (d) { nx = d.x; nz = d.z; }
            }
            this.move(nx * step, nz * step);
            const moved = Math.hypot(p.x - ox, p.z - oz);
            if (moved < step * 0.5 && this.skills.jump && this.jumpCd <= 0 && this.jumpableAhead(nx, nz)) this.jump(nx, nz);
            return;
        }
        if (this.following) {
            this.followCheck -= dt;
            this.followTime += dt;
            if (this.followCheck <= 0) {
                this.followCheck = 0.2;
                if (this.pathClear(p.x + nx * dist, p.z + nz * dist)) this.following = false;
            }
            if (this.followTime > 8) { this.strafeDir *= -1; this.followTime = 0; }
            if (this.following) {
                this.move(-nz * this.strafeDir * step, nx * this.strafeDir * step);
                if (Math.hypot(p.x - ox, p.z - oz) < step * 0.1) this.strafeDir *= -1;
                return;
            }
        }
        this.move(nx * step, nz * step);
        const moved = Math.hypot(p.x - ox, p.z - oz);
        if (moved < step * 0.5 && this.skills.jump && this.jumpCd <= 0 && this.jumpableAhead(nx, nz)) {
            this.jump(nx, nz);
            return;
        }
        // Hedefe doğru gerçek ilerleme azsa (duvara dayandı ya da çok yatık kayıyor) duvarı takip et
        const progress = (p.x - ox) * nx + (p.z - oz) * nz;
        if (progress < step * 0.35) {
            this.following = true;
            this.followCheck = 0.3;
            this.followTime = 0;
        }
    }

    // Bulunduğu yerden (tx, tz) noktasına düz yürünebilir mi (arada engel var mı)
    pathClear(tx, tz) {
        const p = this.group.position;
        const d = Math.hypot(tx - p.x, tz - p.z);
        const n = Math.ceil(d / 0.5);
        for (let i = 1; i <= n; i++) {
            const t = i / n;
            if (collides(p.x + (tx - p.x) * t, p.z + (tz - p.z) * t, this.radius * 0.9, p.y)) return false;
        }
        return true;
    }

    // Önünde zıplanarak üstüne çıkılabilecek alçak bir engel (kasa, siper) var mı
    jumpableAhead(nx, nz) {
        const p = this.group.position;
        const ax = p.x + nx * (this.radius + 0.5), az = p.z + nz * (this.radius + 0.5);
        return walls.some(w => w.h > p.y + CFG.stepHeight && w.h <= p.y + 1.1 && w.b <= p.y + 0.1 &&
            Math.abs(ax - w.x) < w.w / 2 + 0.2 && Math.abs(az - w.z) < w.d / 2 + 0.2);
    }

    jump(nx, nz) {
        this.air = true;
        this.vy = CFG.jumpSpeed;
        this.avx = nx * this.speed * 1.3;
        this.avz = nz * this.speed * 1.3;
        this.jumpCd = 1;
    }

    // Havadayken: yerçekimi ve yatay hız; bir zemine inince durur, boşluğa düşerse ölür
    updateAir(dt) {
        const p = this.group.position;
        this.vy -= CFG.gravity * dt;
        moveWithCollision(p, this.avx * dt, this.avz * dt, this.radius, p.y);
        const ground = groundHeight(p.x, p.z, p.y, 0.3);
        const ny = p.y + this.vy * dt;
        if (this.vy <= 0 && ny <= ground) {
            p.y = ground;
            this.air = false; this.vy = 0; this.avx = 0; this.avz = 0;
            return;
        }
        p.y = ny;
        if (p.y < curMap().killY) this.fellOut();
    }

    fellOut() {
        this.destroy();
        const i = enemies.indexOf(this);
        if (i !== -1) enemies.splice(i, 1);
        addKillFeed(`${this.type.name} boşluğa düştü`, false);
    }

    // Space: düşman ile oyuncu farklı platformlarda mı
    onOtherPlatform() {
        if (!jumpPads.length) return false;
        const p = this.group.position;
        const mine = platformIndexAt(p.x, p.z, p.y);
        return mine >= 0 && player.platform >= 0 && mine !== player.platform;
    }

    // Oyuncunun platformuna giden yoldaki ilk rampaya yürü, üstüne gelince fırla
    goToPad(dt) {
        const p = this.group.position;
        const pad = nextPad(platformIndexAt(p.x, p.z, p.y), player.platform);
        if (!pad) return false;
        const dx = pad.x - p.x, dz = pad.z - p.z, d = Math.hypot(dx, dz) || 0.0001;
        if (d < pad.r * 0.7) {
            this.air = true;
            this.vy = pad.vy; this.avx = pad.vx; this.avz = pad.vz;
            return true;
        }
        this.chase(dt, d, dx / d, dz / d);
        return true;
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
            const aim = this.skills.aim ? 0.6 : 1;      // keskin nişan yeteneği
            this.shootAtPlayer(CFG.enemyBulletDamage * this.type.dmg, CFG.enemySpread * this.type.spread * aim);
        }
    }

    nextFireDelay() {
        const mul = (this.type ? this.type.fire : 1) * (this.skills && this.skills.aim ? 0.8 : 1);
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
        if (this.skills.dodge && !this.air && this.dodgeCooldown <= 0 && this.health > 0) {
            this.dodgeTimer = 0.35;
            this.dodgeCooldown = 1.6;
            this.dodgeDir = Math.random() < 0.5 ? -1 : 1;
        }
        const frac = Math.max(0, this.health / this.maxHealth);
        this.hpBar.visible = true;
        this.hpFill.scale.x = Math.max(0.001, frac);
        this.hpFill.position.x = -0.45 * (1 - frac);   // sol kenara yaslı azalsın
        this.hpFill.material = frac > 0.6 ? MAT.hpHigh : frac > 0.3 ? MAT.hpMid : MAT.hpLow;
        this.hpBar.lookAt(camera.position);
    }

    destroy() { scene.remove(this.group); }
}

// =====================================================================
//  YOL BULMA (zeminli bölümler) — oyuncudan yayılan adım mesafesi alanı ("flow field").
//  Harita 1 m'lik karelere bölünür; oyuncunun karesinden başlayan BFS her kareye oyuncuya
//  kaç adım uzak olduğunu yazar. Düşman, bulunduğu karenin en yakın komşusuna yürür.
//  Bütün düşmanlar aynı alanı kullanır; saniyede ~3 kez ya da oyuncu kare değiştirince yenilenir.
// =====================================================================
const NAV = { min: -45, n: 90, walk: null, dist: null, timer: 0, mapId: null, pi: -1, pj: -1 };
const navCell = (v) => Math.floor(v - NAV.min);
const navIdx = (i, j) => i * NAV.n + j;
const navInside = (i, j) => i >= 0 && j >= 0 && i < NAV.n && j < NAV.n;

function navBuild() {
    NAV.walk = new Uint8Array(NAV.n * NAV.n);
    NAV.dist = new Int32Array(NAV.n * NAV.n);
    for (let i = 0; i < NAV.n; i++) {
        for (let j = 0; j < NAV.n; j++) {
            NAV.walk[navIdx(i, j)] = collides(NAV.min + i + 0.5, NAV.min + j + 0.5, 0.7, 0) ? 0 : 1;
        }
    }
    NAV.mapId = currentMapId;
    NAV.pi = NAV.pj = -1;
}

function navUpdate(dt) {
    if (curMap().floorY === -Infinity) return;
    if (!NAV.walk || NAV.mapId !== currentMapId) navBuild();
    NAV.timer -= dt;
    const ci = navCell(camera.position.x), cj = navCell(camera.position.z);
    if (NAV.timer > 0 && ci === NAV.pi && cj === NAV.pj) return;
    NAV.timer = 0.3; NAV.pi = ci; NAV.pj = cj;
    const dist = NAV.dist;
    dist.fill(-1);
    const queue = [];
    // Oyuncunun karesi yürünemezse (ör. kasanın üstünde) çevresindeki kareler başlangıç olur
    for (let r = 0; r <= 2 && !queue.length; r++) {
        for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
            if (navInside(i, j) && NAV.walk[navIdx(i, j)] && dist[navIdx(i, j)] < 0) { dist[navIdx(i, j)] = r; queue.push(navIdx(i, j)); }
        }
    }
    for (let q = 0; q < queue.length; q++) {
        const k = queue[q], i = Math.floor(k / NAV.n), j = k % NAV.n, d = dist[k] + 1;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
            if (!di && !dj) continue;
            const a = i + di, b = j + dj;
            if (!navInside(a, b)) continue;
            const kk = navIdx(a, b);
            if (!NAV.walk[kk] || dist[kk] >= 0) continue;
            // Çaprazda köşe kesmesin: iki yan kare de yürünebilir olmalı
            if (di && dj && (!NAV.walk[navIdx(i + di, j)] || !NAV.walk[navIdx(i, j + dj)])) continue;
            dist[kk] = d;
            queue.push(kk);
        }
    }
}

// (x, z)'deki düşmanın gitmesi gereken yön (en yakın komşu kareye), yoksa null
function navDirection(x, z) {
    const i = navCell(x), j = navCell(z);
    let best = -1, bi = 0, bj = 0;
    const here = navInside(i, j) ? NAV.dist[navIdx(i, j)] : -1;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj;
        if (!navInside(a, b)) continue;
        const d = NAV.dist[navIdx(a, b)];
        if (d < 0) continue;
        if (di && dj && (!NAV.walk[navIdx(i + di, j)] || !NAV.walk[navIdx(i, j + dj)])) continue;
        if (best < 0 || d < best) { best = d; bi = a; bj = b; }
    }
    if (best < 0 || (here >= 0 && best >= here)) return null;
    const tx = NAV.min + bi + 0.5 - x, tz = NAV.min + bj + 0.5 - z, l = Math.hypot(tx, tz) || 1;
    return { x: tx / l, z: tz / l };
}

function hitsPlayer(pt) {
    const h = Math.hypot(pt.x - camera.position.x, pt.z - camera.position.z);
    return h < 0.45 && pt.y > footY() && pt.y < camera.position.y + 0.25;
}

function findSpawnPoint() {
    return curMap().enemySpawn(camera.position.x, camera.position.z);
}

function onEnemyKilled(e, hit) {
    makeCorpse(e, hit === 'head');
    if (e.isDuel) {
        if (hit === 'head') player.headshots++;   // düelloyu kafadan bitiren vuruş da sayılsın
        duelBot = null;
        pendingDuelWin = true;
        achKill();
        return;
    }
    const idx = enemies.indexOf(e);
    if (idx !== -1) enemies.splice(idx, 1);
    maybeDrop(e.group.position.x, e.group.position.y, e.group.position.z);
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
    achKill();
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

// =====================================================================
//  ÖLÜM EFEKTİ — ölen düşman geriye doğru yığılır, kısa süre yerde kalır, sonra zemine gömülür.
//  Ceset artık düşman listesinde değildir (mermiler içinden geçer).
//  Kafadan vurulduysa kafa kopar: kafa gizlenir, yerine parçacık patlaması çıkar.
// =====================================================================
let corpses = [];

function makeCorpse(e, head) {
    const g = e.group;
    e.hpBar.visible = false;
    if (head) {
        e.head.visible = false;
        const hp = new THREE.Vector3(g.position.x, g.position.y + 1.45 * e.scale, g.position.z);
        createParticles(hp, e.isDuel ? 0xc084fc : (e.type ? e.type.head : 0xf87171), 14);
    }
    g.rotation.order = 'YXZ';            // devrilme düşmanın kendi ekseninde olsun
    corpses.push({ group: g, t: 0, landed: false });
    // Aynı anda çok ceset birikmesin
    if (corpses.length > 12) { scene.remove(corpses[0].group); corpses.shift(); }
}

function updateCorpses(dt) {
    for (let i = corpses.length - 1; i >= 0; i--) {
        const c = corpses[i];
        c.t += dt;
        const fall = Math.min(1, c.t / 0.45);
        c.group.rotation.x = -Math.PI / 2 * fall * fall;       // hızlanarak yere düşer
        if (fall >= 1 && !c.landed) { c.landed = true; sfx('bodyFall'); }
        if (c.t > 2.2) c.group.position.y -= dt * 1.2;          // yavaşça gömülür
        if (c.t > 3.4) { scene.remove(c.group); corpses.splice(i, 1); }
    }
}

function clearCorpses() {
    corpses.forEach(c => scene.remove(c.group));
    corpses = [];
}
