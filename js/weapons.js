'use strict';

// =====================================================================
//  SİLAH
// =====================================================================
function spawnBullet(origin, dir, speed, damage, color, isPlayer, life) {
    const b = new THREE.Mesh(GEO.bullet, basicMat(color));
    b.position.copy(origin);
    b.velocity = dir.clone().multiplyScalar(speed);
    b.life = life;
    b.damage = damage;
    b.colorHex = color;
    b.isPlayer = isPlayer;
    scene.add(b);
    bullets.push(b);
}

function tryShoot() {
    if (player.reloading || player.fireCooldown > 0) return;
    if (player.ammo <= 0) { startReload(); return; }
    player.ammo--;
    player.fireCooldown = CFG.fireInterval;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone().addScaledVector(dir, 0.3);
    spawnBullet(origin, dir, CFG.bulletSpeed, player.damage, skinBulletColor(), true, CFG.bulletLife);
    weaponKick = 0.08;

    if (player.ammo === 0) startReload();
}

function startReload() {
    if (player.reloading || player.ammo >= player.maxAmmo || player.ammoPool <= 0) return;
    player.reloading = true;
    player.reloadTimer = CFG.reloadTime;
}

function finishReload() {
    const need = player.maxAmmo - player.ammo;
    const take = Math.min(need, player.ammoPool);
    player.ammo += take;
    player.ammoPool -= take;
    player.reloading = false;
}
