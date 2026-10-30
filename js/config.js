'use strict';

// =====================================================================
//  AYARLAR (tüm hızlar saniye başına — kare hızından bağımsız)
// =====================================================================
const CFG = {
    // Göz hizası düşmanın gövdesine denk gelir; kafa vuruşu için hafif yukarı nişan gerekir
    eyeHeight: 1.4, playerSpeed: 7.2, playerRadius: 0.6, enemyScale: 1.3,
    fireInterval: 0.1,            // ~10 atış/sn (otomatik tüfek)
    reloadTime: 2.0,
    bulletSpeed: 84, bulletLife: 1.2,
    botBulletSpeed: 45, botBulletLife: 2.0, enemyRange: 25,
    armorAmount: 50,
    baseDamage: 15, damageStep: 5, maxDamage: 35, damageCost: 100,
    baseMag: 30, magStep: 5, maxMag: 60, magCost: 75,
    startPool: 90, ammoRegen: 4,  // yedek mermi azken saniyede dolan mermi (kilitlenmeyi önler)
    healCost: 50, maxHealKits: 9, shieldCost: 150, skinCost: 300,
    killAmmo: 20
};
const SKINS = ['classic', 'prime', 'reaver'];

// =====================================================================
//  ZORLUK SEVİYELERİ — her elin başında CFG'ye uygulanır
// =====================================================================
const DIFFICULTIES = ['easy', 'normal', 'hard'];
const DIFF_LABELS = { easy: 'Kolay', normal: 'Orta', hard: 'Zor' };
const GAME_DIFF = {
    easy: {
        enemyHealth: 16, enemySpeed: 1.5, maxEnemies: 7, spawnPerSec: 0.8, meleeDps: 16,
        enemyFireMin: 3.0, enemyFireMax: 4.5, enemyBulletDamage: 2, enemySpread: 0.14, killGold: 20
    },
    normal: {
        enemyHealth: 25, enemySpeed: 1.9, maxEnemies: 10, spawnPerSec: 1.2, meleeDps: 24,
        enemyFireMin: 2.2, enemyFireMax: 3.5, enemyBulletDamage: 3, enemySpread: 0.10, killGold: 25
    },
    hard: {
        enemyHealth: 38, enemySpeed: 2.4, maxEnemies: 14, spawnPerSec: 1.8, meleeDps: 32,
        enemyFireMin: 1.5, enemyFireMax: 2.6, enemyBulletDamage: 5, enemySpread: 0.065, killGold: 35
    }
};
const DUEL_DIFF = {
    easy: {
        duelHealth: 200, duelSpeed: 2.0, botFireInterval: 0.7, botBulletDamage: 5,
        botSpread: 0.10, botFirstShot: 1.4, duelGold: 75
    },
    normal: {
        duelHealth: 330, duelSpeed: 2.4, botFireInterval: 0.5, botBulletDamage: 7,
        botSpread: 0.065, botFirstShot: 1.0, duelGold: 150
    },
    hard: {
        duelHealth: 500, duelSpeed: 2.9, botFireInterval: 0.35, botBulletDamage: 9,
        botSpread: 0.04, botFirstShot: 0.7, duelGold: 300
    }
};

const SETTINGS_KEY = 'fps_settings_v1';
const SENS_MIN = 0.2, SENS_MAX = 3, BASE_SENS = 0.003;   // radyan / piksel (1.0x)
const settings = (() => {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch (e) {}
    return {
        game: o && DIFFICULTIES.includes(o.game) ? o.game : 'normal',
        duel: o && DIFFICULTIES.includes(o.duel) ? o.duel : 'normal',
        sens: o && Number.isFinite(o.sens) ? Math.min(SENS_MAX, Math.max(SENS_MIN, o.sens)) : 1
    };
})();
function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}
function applyDifficulty() {
    Object.assign(CFG, GAME_DIFF[settings.game], DUEL_DIFF[settings.duel]);
}
applyDifficulty();
