'use strict';

// =====================================================================
//  OYUN AKIŞI
// =====================================================================
function resetWorld(duel) {
    applyDifficulty();   // ayar değişiklikleri yeni elde geçerli olur
    run.game = settings.game;
    run.duel = settings.duel;
    run.active = true;
    enemies.forEach(e => e.destroy()); enemies = [];
    if (duelBot) { duelBot.destroy(); duelBot = null; }
    bullets.forEach(b => scene.remove(b)); bullets = [];
    particles.forEach(p => scene.remove(p)); particles = [];
    clearFloaters();
    clearKillFeed();
    hideBanner();

    player.health = player.maxHealth;
    player.armor = 0;
    if (player.hasShield) { player.armor = CFG.armorAmount; player.hasShield = false; }
    resetArsenal();
    player.score = 0; player.kills = 0; player.headshots = 0; player.goldEarned = 0;
    player.velY = 0; player.airVX = 0; player.airVZ = 0; player.onGround = true; player.platform = 0;
    if (currentMapId !== settings.map) buildMap(settings.map);
    run.map = currentMapId;
    weaponKick = 0; weaponSwitchAnim = 0;
    camera.fov = CFG.baseFov; camera.updateProjectionMatrix();

    isDuelMode = duel;
    pendingDuelWin = false;
    duelTime = 0;
    cameraAngleX = 0;
    if (duel) {
        // Oyuncu ve bot arasında duvar yok; bot oyuncunun tam karşısında doğar
        const d = curMap().duel;
        placeAt(d.player);
        duelBot = new HumanoidEnemy(d.bot.x, d.bot.z, true);
        duelBot.group.position.y = d.bot.y;
    } else {
        placeAtSpawn();
        resetWaves();
    }
    applyCameraRotation();
    resetKeys();
    saveGameData();
    updateHUD();
}

function startRun(duel) {
    initAudio();
    // Tıklanan buton odakta kalırsa oyun sırasında Space/Enter onu tekrar tetikleyebilir
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
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
    initAudio();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    hideAllScreens();
    state = 'starting';
    requestLock();
}

function goToMenu() {
    if (document.pointerLockElement) document.exitPointerLock();
    // Dalga modundan yarıda çıkılırsa o ana kadarki skor/dalga yine rekorlara işlensin
    // (düellodan çıkmak galibiyet ya da mağlubiyet sayılmaz)
    if (run.active && !isDuelMode) updateRecords(false);
    run.active = false;
    hideBanner();
    state = 'menu';
    showScreen('menuScreen');
}

function endRun(won) {
    if (state !== 'playing') return;
    state = 'over';
    run.active = false;
    resetKeys();
    setZoom(false);
    hideBanner();
    saveGameData();
    const broken = updateRecords(won);
    sfx(won ? 'win' : 'lose');

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
    $('finalHeadshots').textContent = player.headshots;
    $('finalGold').textContent = player.goldEarned;
    $('finalTotalGold').textContent = player.gold;
    $('finalDifficulty').textContent = (isDuelMode ? 'Düello ' : '') +
        DIFF_LABELS[isDuelMode ? run.duel : run.game] + ` · Bölüm: ${curMap().name}`;
    $('finalExtra').textContent = isDuelMode ? `Süre: ${formatTime(duelTime)}` : `Ulaşılan dalga: ${wave.num}`;
    $('newRecord').textContent = broken.length ? `🏆 YENİ REKOR: ${broken.join(' · ')}` : '';
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
    sfx('hurt');
    if (player.health <= 0) { player.health = 0; endRun(false); }
}

function useHealKit() {
    if (player.healKits > 0 && player.health < player.maxHealth) {
        player.health = player.maxHealth;
        player.healKits--;
        saveGameData();
        showToast('Can dolduruldu');
        sfx('heal');
    } else if (player.healKits <= 0) {
        showToast('Can kitin yok (mağazadan alabilirsin)');
    } else {
        showToast('Canın zaten dolu');
    }
}

// Oyuncuyu bölümün başlangıç noktasına koy
function placeAt(s) {
    camera.position.set(s.x, s.y + CFG.eyeHeight, s.z);
    cameraAngleY = s.angle || 0;
    cameraAngleX = 0;
    if (camera) applyCameraRotation();
}
function placeAtSpawn() { placeAt(curMap().spawn); }
