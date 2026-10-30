'use strict';

// =====================================================================
//  OYUN AKIŞI
// =====================================================================
function resetWorld(duel) {
    applyDifficulty();   // ayar değişiklikleri yeni elde geçerli olur
    enemies.forEach(e => e.destroy()); enemies = [];
    if (duelBot) { duelBot.destroy(); duelBot = null; }
    bullets.forEach(b => scene.remove(b)); bullets = [];
    particles.forEach(p => scene.remove(p)); particles = [];

    player.health = player.maxHealth;
    player.armor = 0;
    if (player.hasShield) { player.armor = CFG.armorAmount; player.hasShield = false; }
    player.ammo = player.maxAmmo;
    player.ammoPool = CFG.startPool;
    player.score = 0; player.kills = 0; player.goldEarned = 0;
    player.reloading = false; player.reloadTimer = 0; player.fireCooldown = 0;
    player.ammoRegenAcc = 0;
    weaponKick = 0;

    isDuelMode = duel;
    pendingDuelWin = false;
    cameraAngleX = 0;
    if (duel) {
        // Oyuncu ve bot arasında duvar yok; bot oyuncunun tam karşısında doğar
        camera.position.set(0, CFG.eyeHeight, 12);
        cameraAngleY = Math.PI;
        duelBot = new HumanoidEnemy(0, 34, true);
    } else {
        camera.position.set(0, CFG.eyeHeight, 10);
        cameraAngleY = 0;
    }
    applyCameraRotation();
    resetKeys();
    saveGameData();
    updateHUD();
}

function startRun(duel) {
    resetWorld(duel);
    hideAllScreens();
    state = 'starting';
    requestLock();
}

function pauseGame() {
    state = 'paused';
    resetKeys();
    showScreen('pauseScreen');
}

function resumeGame() {
    hideAllScreens();
    state = 'starting';
    requestLock();
}

function goToMenu() {
    if (document.pointerLockElement) document.exitPointerLock();
    state = 'menu';
    showScreen('menuScreen');
}

function endRun(won) {
    if (state !== 'playing') return;
    state = 'over';
    resetKeys();
    saveGameData();

    const t = $('gameOverTitle');
    if (won) {
        t.textContent = 'DÜELLOYU KAZANDIN! 🏆';
        t.style.color = '#22c55e';
        t.style.textShadow = '0 0 15px rgba(34,197,94,0.8)';
    } else {
        t.textContent = isDuelMode ? 'DÜELLOYU KAYBETTİN' : 'GÖREV BAŞARISIZ';
        t.style.color = '#ff0000';
        t.style.textShadow = '0 0 15px rgba(255,0,0,0.8)';
    }
    $('finalScore').textContent = player.score;
    $('finalKills').textContent = player.kills;
    $('finalGold').textContent = player.goldEarned;
    $('finalTotalGold').textContent = player.gold;
    $('finalDifficulty').textContent = (isDuelMode ? 'Düello ' : '') +
        DIFF_LABELS[isDuelMode ? settings.duel : settings.game];
    showScreen('gameOverScreen');
    if (document.pointerLockElement) document.exitPointerLock();
}

function damagePlayer(amount) {
    // Bot bu karede öldüyse düello kazanılmıştır; kalan mermiler sonucu değiştirmesin
    if (state !== 'playing' || pendingDuelWin) return;
    if (player.armor > 0) {
        const absorbed = Math.min(player.armor, amount);
        player.armor -= absorbed;
        amount -= absorbed;
    }
    player.health -= amount;
    flashClass('damageFlash', 'on', 150);
    if (player.health <= 0) { player.health = 0; endRun(false); }
}

function useHealKit() {
    if (player.healKits > 0 && player.health < player.maxHealth) {
        player.health = player.maxHealth;
        player.healKits--;
        saveGameData();
        showToast('Can dolduruldu');
    } else if (player.healKits <= 0) {
        showToast('Can kitin yok (mağazadan alabilirsin)');
    } else {
        showToast('Canın zaten dolu');
    }
}
