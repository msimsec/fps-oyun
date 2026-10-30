'use strict';

// =====================================================================
//  DALGALAR (normal mod) — dalga temizlenince kısa mola, sonra daha güçlü dalga
// =====================================================================
function waveSize(n) { return Math.round(CFG.waveBase * (1 + CFG.waveGrowth * (n - 1))); }
function waveHpMul(n) { return 1 + CFG.waveHpGrowth * (n - 1); }
function waveSpeedMul(n) { return Math.min(CFG.waveSpeedMax, 1 + CFG.waveSpeedGrowth * (n - 1)); }

function resetWaves() {
    wave.num = 0;
    wave.toSpawn = 0;
    wave.inBreak = true;
    wave.breakTimer = 2;     // ilk dalgadan önce kısa hazırlık
}

function startNextWave() {
    wave.num++;
    wave.toSpawn = waveSize(wave.num);
    wave.inBreak = false;
    // Bu dalgada ilk kez çıkan düşman tipi varsa duyur
    const fresh = Object.values(ENEMY_TYPES).filter(t => t.minWave === wave.num).map(t => t.name);
    showBanner(`DALGA ${wave.num}`, `${wave.toSpawn} düşman geliyor` + (fresh.length ? ` · Yeni: ${fresh.join(', ')}!` : ''),
        fresh.length ? 3200 : 2200);
    sfx('waveStart');
}

function updateWaves(dt) {
    if (wave.inBreak) {
        wave.breakTimer -= dt;
        if (wave.num > 0) setHud('bannerSub', `Sonraki dalga ${Math.max(0, Math.ceil(wave.breakTimer))} sn içinde`);
        if (wave.breakTimer <= 0) startNextWave();
        return;
    }
    if (wave.toSpawn > 0 && enemies.length < CFG.maxEnemies && Math.random() < CFG.spawnPerSec * dt) {
        const sp = findSpawnPoint();
        if (sp) {
            const e = new HumanoidEnemy(sp.x, sp.z, false, waveHpMul(wave.num), waveSpeedMul(wave.num),
                pickEnemyType(wave.num));
            e.group.position.y = sp.y;       // Space'te platform yüksekliği
            enemies.push(e);
            wave.toSpawn--;
        }
    }
    if (wave.toSpawn === 0 && enemies.length === 0) waveCleared();
}

function waveCleared() {
    const gold = CFG.waveGoldPerWave * wave.num;
    const score = CFG.waveScorePerWave * wave.num;
    player.gold += gold;
    player.goldEarned += gold;
    player.score += score;
    player.health = Math.min(player.maxHealth, player.health + CFG.waveHeal);
    saveGameData();
    wave.inBreak = true;
    wave.breakTimer = CFG.waveBreak;
    showBanner(`DALGA ${wave.num} TAMAMLANDI`, '', 0);
    addKillFeed(`Dalga bonusu +${score} · +${gold} 🪙 · +${CFG.waveHeal} can`, true);
    sfx('waveClear');
}

const waveRemaining = () => wave.toSpawn + enemies.length;
