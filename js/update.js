'use strict';

// =====================================================================
//  GÜNCELLEMELER (dt = saniye)
// =====================================================================
const isMoving = () => keys.forward || keys.back || keys.left || keys.right;
// İleri giderken, yerdeyken ve dürbünsüzken koşulur
const isSprinting = () => keys.sprint && keys.forward && player.onGround && !player.zoomed;

function jump() {
    if (!player.onGround) return;
    player.velY = CFG.jumpSpeed;
    player.onGround = false;
    sfx('jump');
}

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
    const feet = footY();
    if (len > 0) {
        const speed = CFG.playerSpeed * (isSprinting() ? CFG.sprintMul : 1) * (player.zoomed ? 0.5 : 1);
        const s = speed * dt / len;   // çapraz giderken hız artmaz
        moveWithCollision(camera.position, mx * s, mz * s, CFG.playerRadius, feet);
    }

    // Dikey hareket: yerçekimi, zıplama, kasaların üstüne çıkma / kenardan düşme
    const ground = groundHeight(camera.position.x, camera.position.z, feet);
    if (player.onGround && feet > ground + 0.01) player.onGround = false;   // kenardan yürüyüp düştü
    if (!player.onGround) {
        player.velY -= CFG.gravity * dt;
        let newFeet = feet + player.velY * dt;
        if (newFeet <= ground) {
            newFeet = ground;
            if (player.velY < -4) sfx('land');
            player.velY = 0;
            player.onGround = true;
        }
        camera.position.y = newFeet + CFG.eyeHeight;
    } else {
        camera.position.y = ground + CFG.eyeHeight;   // alçak basamaklara yürüyerek çık
    }

    if (player.fireCooldown > 0) player.fireCooldown -= dt;
    if (player.reloading) {
        player.reloadTimer -= dt;
        if (player.reloadTimer <= 0) finishReload();
    }
    if (firing) tryShoot();

    // Görüş açısı: dürbünde yakın, koşarken biraz geniş
    const targetFov = player.zoomed ? CFG.zoomFov : (isSprinting() && isMoving() ? CFG.sprintFov : CFG.baseFov);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14);
        camera.updateProjectionMatrix();
    }

    // Silah geri tepmesi, değiştirme ve şarjör animasyonu, yürürken hafif sallanma
    weaponKick = Math.max(0, weaponKick - dt * 0.8);
    weaponSwitchAnim = Math.max(0, weaponSwitchAnim - dt * 4);
    const bob = player.onGround && isMoving() ? Math.sin(clock.elapsedTime * (isSprinting() ? 14 : 9)) * 0.012 : 0;
    weapon3DGroup.position.z = weaponKick;
    weapon3DGroup.position.x = bob * 0.6;
    if (player.reloading) {
        const prog = 1 - player.reloadTimer / curWeapon().reload;
        weapon3DGroup.position.y = -0.18 * Math.sin(Math.PI * prog);
        weapon3DGroup.rotation.x = -0.5 * Math.sin(Math.PI * prog);
    } else {
        weapon3DGroup.position.y = -0.25 * weaponSwitchAnim + Math.abs(bob);
        weapon3DGroup.rotation.x = isSprinting() && isMoving() ? -0.25 : 0;
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
                createParticles(b.position, 0xb45309, b.geometry === GEO.pellet ? 2 : 6);
                remove = true;
                break;
            }

            if (b.isPlayer) {
                const targets = isDuelMode ? (duelBot ? [duelBot] : []) : enemies;
                for (const e of targets) {
                    const hit = e.hitTest(b.position);
                    if (!hit) continue;
                    const dmg = hit === 'head' ? b.damage * 2 : b.damage;
                    e.takeDamage(dmg);
                    createParticles(b.position, b.colorHex, b.geometry === GEO.pellet ? 2 : 6);
                    flashClass('crosshair', hit === 'head' ? 'head' : 'hit', 120);
                    showDamageNumber(e, dmg, hit === 'head');
                    sfx(hit === 'head' ? 'head' : 'hit');
                    if (e.health <= 0) onEnemyKilled(e, hit);
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
    if (state === 'playing') updateWaves(dt);
}

function updateHUD() {
    const w = curWeapon(), a = curAmmo();
    setHud('hpDisplay', Math.max(0, Math.ceil(player.health)));
    setHud('shieldDisplay', player.armor > 0 ? String(Math.ceil(player.armor)) : (player.hasShield ? 'HAZIR' : 'YOK'));
    setHud('weaponName', w.name.toUpperCase());
    setHud('ammoDisplay', a ? a.ammo : 0);
    setHud('ammoPoolDisplay', a ? (a.pool === Infinity ? '∞' : a.pool) : 0);
    setHud('reloadDisplay', player.reloading ? 'ŞARJÖR DEĞİŞİYOR...' :
        (a && a.ammo === 0 && a.pool === 0 ? 'MERMİ BİTTİ · 2: TABANCA' : ''));
    setHud('weaponSlots', WEAPON_ORDER.map((id, i) =>
        player.ownedWeapons[id] ? (id === player.weapon ? `[${i + 1}]` : ` ${i + 1} `) : ' · ').join(''));
    setHud('scoreDisplay', player.score);
    setHud('killsDisplay', player.kills);
    setHud('goldDisplay', player.gold);
    setHud('healKitsDisplay', player.healKits);
    setHud('modeDisplay', isDuelMode
        ? `DÜELLO · ${DIFF_LABELS[settings.duel]} · ${formatTime(duelTime)}`
        : `DALGA ${wave.num || '-'} · KALAN ${waveRemaining()} · ${DIFF_LABELS[settings.game]}`);
    updateDuelBar();
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);   // sekme değişiminde dev sıçramaları önle

    if (state === 'playing') {
        if (isDuelMode) duelTime += dt;
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
    updateFloaters(dt);

    renderer.render(scene, camera);
}
