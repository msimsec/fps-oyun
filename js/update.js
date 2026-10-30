'use strict';

// =====================================================================
//  GÜNCELLEMELER (dt = saniye)
// =====================================================================
function updatePlayer(dt) {
    const f = new THREE.Vector3();
    camera.getWorldDirection(f);
    f.y = 0; f.normalize();
    const rx = -f.z, rz = f.x;      // kameranın sağ yönü

    let mx = 0, mz = 0;
    if (keys.forward) { mx += f.x; mz += f.z; }
    if (keys.back) { mx -= f.x; mz -= f.z; }
    if (keys.right) { mx += rx; mz += rz; }
    if (keys.left) { mx -= rx; mz -= rz; }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
        const s = CFG.playerSpeed * dt / len;   // çapraz giderken hız artmaz
        moveWithCollision(camera.position, mx * s, mz * s, CFG.playerRadius);
    }

    if (player.fireCooldown > 0) player.fireCooldown -= dt;
    if (player.ammo + player.ammoPool < player.maxAmmo) {
        player.ammoRegenAcc += CFG.ammoRegen * dt;
        const add = Math.floor(player.ammoRegenAcc);
        if (add > 0) { player.ammoPool += add; player.ammoRegenAcc -= add; }
    }
    if (player.reloading) {
        player.reloadTimer -= dt;
        if (player.reloadTimer <= 0) finishReload();
    }
    if (firing) tryShoot();

    // Silah geri tepmesi ve şarjör animasyonu
    weaponKick = Math.max(0, weaponKick - dt * 0.8);
    weapon3DGroup.position.z = weaponKick;
    if (player.reloading) {
        const prog = 1 - player.reloadTimer / CFG.reloadTime;
        weapon3DGroup.position.y = -0.18 * Math.sin(Math.PI * prog);
        weapon3DGroup.rotation.x = -0.5 * Math.sin(Math.PI * prog);
    } else {
        weapon3DGroup.position.y = 0;
        weapon3DGroup.rotation.x = 0;
    }
}

function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.life -= dt;
        let remove = b.life <= 0;

        // Hızlı mermi hedefin içinden atlamasın diye hareketi küçük adımlara böl
        const dist = b.velocity.length() * dt;
        const steps = Math.max(1, Math.ceil(dist / 0.2));
        tmpVec.copy(b.velocity).multiplyScalar(dt / steps);

        for (let s = 0; s < steps && !remove; s++) {
            b.position.add(tmpVec);

            if (b.position.y < 0 || b.position.y > 10 || pointInWall(b.position)) {
                createParticles(b.position, 0xb45309);
                remove = true;
                break;
            }

            if (b.isPlayer) {
                const targets = isDuelMode ? (duelBot ? [duelBot] : []) : enemies;
                for (const e of targets) {
                    const hit = e.hitTest(b.position);
                    if (!hit) continue;
                    const dmg = hit === 'head' ? b.damage * 2 : b.damage;
                    e.health -= dmg;
                    createParticles(b.position, b.colorHex);
                    flashClass('crosshair', hit === 'head' ? 'head' : 'hit', 120);
                    if (e.health <= 0) onEnemyKilled(e);
                    remove = true;
                    break;
                }
            } else if (hitsPlayer(b.position)) {
                damagePlayer(b.damage);
                remove = true;
            }
        }

        if (remove) {
            scene.remove(b);
            bullets.splice(i, 1);
        }
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.velocity.y -= 30 * dt;
        p.position.addScaledVector(p.velocity, dt);
        p.life -= dt;
        if (p.life <= 0) { scene.remove(p); particles.splice(i, 1); }
    }
}

function updateEnemies(dt) {
    if (isDuelMode) {
        if (duelBot) duelBot.update(dt);
        return;
    }
    for (let i = 0; i < enemies.length && state === 'playing'; i++) enemies[i].update(dt);
    if (enemies.length < CFG.maxEnemies && Math.random() < CFG.spawnPerSec * dt) {
        const sp = findSpawnPoint();
        if (sp) enemies.push(new HumanoidEnemy(sp.x, sp.z, false));
    }
}

function updateHUD() {
    setHud('hpDisplay', Math.max(0, Math.ceil(player.health)));
    setHud('shieldDisplay', player.armor > 0 ? String(Math.ceil(player.armor)) : (player.hasShield ? 'HAZIR' : 'YOK'));
    setHud('ammoDisplay', player.ammo);
    setHud('ammoPoolDisplay', player.ammoPool);
    setHud('reloadDisplay', player.reloading ? 'ŞARJÖR DEĞİŞİYOR...' : (player.ammo === 0 && player.ammoPool === 0 ? 'MERMİ DOLUYOR...' : ''));
    setHud('scoreDisplay', player.score);
    setHud('killsDisplay', player.kills);
    setHud('goldDisplay', player.gold);
    setHud('healKitsDisplay', player.healKits);
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);   // sekme değişiminde dev sıçramaları önle

    if (state === 'playing') {
        updatePlayer(dt);
        updateBullets(dt);
        if (pendingDuelWin) {
            pendingDuelWin = false;
            player.score += 500;
            player.kills++;
            player.gold += CFG.duelGold;
            player.goldEarned += CFG.duelGold;
            saveGameData();
            endRun(true);
        }
        if (state === 'playing') updateEnemies(dt);
        updateParticles(dt);
        updateHUD();
    }

    renderer.render(scene, camera);
}
