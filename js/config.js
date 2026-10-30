'use strict';

// =====================================================================
//  AYARLAR (tüm hızlar saniye başına — kare hızından bağımsız)
// =====================================================================
const CFG = {
    // Göz hizası düşmanın gövdesine denk gelir; kafa vuruşu için hafif yukarı nişan gerekir
    eyeHeight: 1.4, playerSpeed: 7.2, playerRadius: 0.6, enemyScale: 1.3,
    sprintMul: 1.6,               // Shift ile koşma hız çarpanı
    jumpSpeed: 6.5, gravity: 18,  // ~1.2 birim zıplama yüksekliği (1 birimlik kasalara çıkılabilir)
    stepHeight: 0.35,             // bu kadar alçak engellerin üstüne yürüyerek çıkılır
    baseFov: 75, sprintFov: 82, zoomFov: 25,
    botBulletSpeed: 45, botBulletLife: 2.0, enemyRange: 25,
    armorAmount: 50,
    baseDamage: 15, damageStep: 5, maxDamage: 35, damageCost: 100,
    baseMag: 30, magStep: 5, maxMag: 60, magCost: 75,
    healCost: 50, maxHealKits: 9, shieldCost: 150, skinCost: 300,
    // Dalgalar: her dalgada düşman sayısı, canı ve hızı biraz artar
    waveGrowth: 0.35, waveHpGrowth: 0.1, waveSpeedGrowth: 0.03, waveSpeedMax: 1.4,
    waveBreak: 5, waveGoldPerWave: 10, waveScorePerWave: 200, waveHeal: 25
};
const SKINS = ['classic', 'prime', 'reaver'];

// =====================================================================
//  SİLAHLAR — hasar = oyuncunun hasar seviyesi × dmgMul (mağazadaki yükseltme hepsine işler)
// =====================================================================
const WEAPON_ORDER = ['rifle', 'pistol', 'shotgun', 'sniper'];
const WEAPONS = {
    rifle: {
        name: 'Tüfek', auto: true, interval: 0.1, dmgMul: 1, pellets: 1, spread: 0,
        mag: null /* mağazadan yükseltilir */, startPool: 90, killAmmo: 20,
        reload: 2.0, speed: 84, life: 1.2, cost: 0
    },
    pistol: {
        // Yedek mermisi sınırsız: diğer silahların mermisi bitse de oyuncu çaresiz kalmaz
        name: 'Tabanca', auto: false, interval: 0.2, dmgMul: 1.4, pellets: 1, spread: 0.004,
        mag: 12, startPool: Infinity, killAmmo: 0, reload: 1.2, speed: 84, life: 1.0, cost: 0
    },
    shotgun: {
        name: 'Pompalı', auto: false, interval: 0.85, dmgMul: 0.6, pellets: 8, spread: 0.07,
        mag: 6, startPool: 24, killAmmo: 3, reload: 2.4, speed: 70, life: 0.35, cost: 250
    },
    sniper: {
        name: 'Keskin Nişancı', auto: false, interval: 1.1, dmgMul: 5, pellets: 1, spread: 0,
        mag: 5, startPool: 15, killAmmo: 2, reload: 2.6, speed: 160, life: 0.8, cost: 400, zoom: true
    }
};

// =====================================================================
//  ZORLUK SEVİYELERİ — her elin başında CFG'ye uygulanır
// =====================================================================
const DIFFICULTIES = ['easy', 'normal', 'hard'];
const DIFF_LABELS = { easy: 'Kolay', normal: 'Orta', hard: 'Zor' };
const GAME_DIFF = {
    easy: {
        enemyHealth: 16, enemySpeed: 1.5, maxEnemies: 7, spawnPerSec: 0.8, meleeDps: 16,
        enemyFireMin: 3.0, enemyFireMax: 4.5, enemyBulletDamage: 2, enemySpread: 0.14, killGold: 20,
        waveBase: 5
    },
    normal: {
        enemyHealth: 25, enemySpeed: 1.9, maxEnemies: 10, spawnPerSec: 1.2, meleeDps: 24,
        enemyFireMin: 2.2, enemyFireMax: 3.5, enemyBulletDamage: 3, enemySpread: 0.10, killGold: 25,
        waveBase: 6
    },
    hard: {
        enemyHealth: 38, enemySpeed: 2.4, maxEnemies: 14, spawnPerSec: 1.8, meleeDps: 32,
        enemyFireMin: 1.5, enemyFireMax: 2.6, enemyBulletDamage: 5, enemySpread: 0.065, killGold: 35,
        waveBase: 8
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
        sens: o && Number.isFinite(o.sens) ? Math.min(SENS_MAX, Math.max(SENS_MIN, o.sens)) : 1,
        volume: o && Number.isFinite(o.volume) ? Math.min(1, Math.max(0, o.volume)) : 0.6
    };
})();
function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}
function applyDifficulty() {
    Object.assign(CFG, GAME_DIFF[settings.game], DUEL_DIFF[settings.duel]);
}
applyDifficulty();
