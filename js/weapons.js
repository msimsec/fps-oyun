'use strict';

// =====================================================================
//  SİLAH
// =====================================================================
function spawnBullet(origin, dir, speed, damage, color, isPlayer, life, geo = GEO.bullet) {
    const b = new THREE.Mesh(geo, basicMat(color));
    b.position.copy(origin);
    b.velocity = dir.clone().multiplyScalar(speed);
    b.life = life;
    b.damage = damage;
    b.colorHex = color;
    b.isPlayer = isPlayer;
    b.srcX = origin.x; b.srcZ = origin.z;     // hasar yönü göstergesi için atışın geldiği yer
    scene.add(b);
    bullets.push(b);
}

// Her elin başında: tüm silahlar dolu şarjör + başlangıç yedeği, yaylı tüfek elde
function resetArsenal() {
    WEAPON_ORDER.forEach(id => {
        player.arsenal[id] = { ammo: magSize(id), pool: WEAPONS[id].startPool };
    });
    player.reloading = false; player.reloadTimer = 0; player.fireCooldown = 0;
    setZoom(false);
    showWeapon('crossbow');
}

function showWeapon(id) {
    player.weapon = id;
    WEAPON_ORDER.forEach(w => { if (weaponModels[w]) weaponModels[w].visible = (w === id); });
}

function selectWeapon(id) {
    if (id === player.weapon) return;
    if (!player.ownedWeapons[id]) { showToast(`${WEAPONS[id].name} kilitli (mağazadan alabilirsin)`); return; }
    player.reloading = false;                    // silah değişince şarjör değiştirme iptal
    player.fireCooldown = Math.max(player.fireCooldown, 0.25);
    // Tetik basılıyken silah değişirse yeni (yarı otomatik) silah kendiliğinden ateş etmesin
    player.semiFired = firing;
    setZoom(false);
    showWeapon(id);
    weaponSwitchAnim = 1;
    sfx('switch');
}

function cycleWeapon(step) {
    const owned = WEAPON_ORDER.filter(id => player.ownedWeapons[id]);
    const i = owned.indexOf(player.weapon);
    selectWeapon(owned[(i + step + owned.length) % owned.length]);
}

function tryShoot() {
    const w = curWeapon(), a = curAmmo();
    if (player.reloading || player.fireCooldown > 0) return;
    if (w.melee) { sawAttack(w); return; }
    if (!w.auto && player.semiFired) return;      // yarı otomatik: her tıkta bir atış
    if (a.ammo <= 0) {
        if (!player.semiFired) sfx('empty');
        player.semiFired = true;
        startReload();
        return;
    }
    a.ammo--;
    player.fireCooldown = w.interval;
    player.semiFired = true;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone().addScaledVector(dir, 0.3);
    const damage = player.damage * w.dmgMul;
    // Koşarken ve havadayken isabet biraz bozulur (dürbünle bakarken bozulmaz)
    const extra = player.zoomed ? 0 : (isSprinting() ? 0.02 : 0) + (player.onGround ? 0 : 0.03);
    const spread = w.spread + extra;
    if (w.bolt) {
        spawnBolt(origin, dir, w.speed, damage, w.gravity, w.life);
        weaponKick = 0.12;
        sfx('shoot_crossbow');
        if (a.ammo === 0) startReload();
        return;
    }
    if (w.rocket) {
        spawnRocket(origin, dir, w.speed, damage, w.blastRadius, w.life);
        weaponKick = 0.22;
        sfx('shoot_rocket');
        if (a.ammo === 0) startReload();
        return;
    }
    for (let i = 0; i < w.pellets; i++) {
        const d = dir.clone();
        if (spread > 0) {
            d.x += (Math.random() - 0.5) * 2 * spread;
            d.y += (Math.random() - 0.5) * 2 * spread;
            d.z += (Math.random() - 0.5) * 2 * spread;
            d.normalize();
        }
        spawnBullet(origin, d, w.speed, damage, skinBulletColor(), true, w.life,
            w.pellets > 1 ? GEO.pellet : GEO.bullet);
    }
    weaponKick = player.weapon === 'sniper' || player.weapon === 'shotgun' ? 0.16 : player.weapon === 'smg' ? 0.05 : 0.08;
    sfx('shoot_' + player.weapon);

    if (a.ammo === 0) startReload();
}

function startReload() {
    const a = curAmmo();
    if (player.reloading || a.ammo >= magSize(player.weapon) || a.pool <= 0) return;
    player.reloading = true;
    player.reloadTimer = player.reloadTotal = curWeapon().reload * reloadMul();
    setZoom(false);
    sfx('reload');
}

function finishReload() {
    const a = curAmmo();
    const take = Math.min(magSize(player.weapon) - a.ammo, a.pool);
    a.ammo += take;
    if (a.pool !== Infinity) a.pool -= take;
    player.reloading = false;
}

// Dürbün: sadece keskin nişancıda; şarjör değiştirirken kapanır
function setZoom(on) {
    const can = on && state === 'playing' && curWeapon().zoom && !player.reloading;
    if (player.zoomed === can) return;
    player.zoomed = can;
    if (weapon3DGroup) weapon3DGroup.visible = !can;
    $('scopeOverlay').classList.toggle('show', can);
}

// Testereli Eldiven: önündeki (menzil ve görüş konisi içindeki) en yakın hedefe kesme hasarı.
// Bakılan noktaya göre kafa vuruşu da sayılır. Mermi harcamaz, şarjör değiştirmez.
function sawAttack(w) {
    player.fireCooldown = w.interval;
    player.sawSpin = 0.25;                       // testere bu kadar süre hızlı döner (görsel)
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const targets = isDuelMode ? (duelBot ? [duelBot] : []) : enemies;
    let best = null, bestD = Infinity;
    const c = new THREE.Vector3();
    for (const e of targets) {
        const p = e.group.position;
        c.set(p.x, p.y + 0.9 * e.scale, p.z);
        const to = c.clone().sub(camera.position);
        const d = to.length();
        if (d > w.range + e.radius || d >= bestD) continue;
        if (to.normalize().dot(dir) < 0.6) continue;           // önünde değil
        best = e; bestD = d;
    }
    sfx(best ? 'sawHit' : 'sawSpin');
    weaponKick = 0.03;
    if (!best) return;
    // Bakılan noktanın düşmanın neresine geldiği: kafa mı gövde mi
    const pt = camera.position.clone().addScaledVector(dir, Math.max(0.3, bestD - best.radius * 0.5));
    const hit = best.hitTest(pt) === 'head' ? 'head' : 'body';
    const dmg = player.damage * w.dmgMul * (hit === 'head' ? 2 : 1);
    best.takeDamage(dmg);
    createParticles(pt, 0xb91c1c, 5);
    createParticles(pt, 0xfbbf24, 3);                        // kıvılcım
    flashClass('crosshair', hit === 'head' ? 'head' : 'hit', 120);
    showDamageNumber(best, dmg, hit === 'head');
    if (best.health <= 0) onEnemyKilled(best, hit);
}
