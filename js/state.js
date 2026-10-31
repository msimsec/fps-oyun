'use strict';

// =====================================================================
//  OYUNCU VE DURUM
// =====================================================================
const player = {
    upgrades: save.upgrades,
    health: 100, maxHealth: 100 + UPGRADES.health.per * save.upgrades.health, armor: 0,
    maxAmmo: save.maxAmmo,          // tüfek şarjörü (mağazadan yükseltilir)
    weapon: 'rifle',
    ownedWeapons: { rifle: true, pistol: true, shotgun: save.weapons.shotgun, sniper: save.weapons.sniper },
    arsenal: {},                    // silah başına { ammo, pool } — her elin başında doldurulur
    score: 0, kills: 0, headshots: 0, goldEarned: 0,
    gold: save.gold, damage: save.damage,
    hasShield: save.hasShield, activeSkin: save.activeSkin, unlockedSkins: save.unlockedSkins,
    sinceHurt: 0, regenOn: false,   // son hasardan beri geçen süre, can şu an doluyor mu
    reloading: false, reloadTimer: 0, reloadTotal: 1, fireCooldown: 0, semiFired: false,
    velY: 0, airVX: 0, airVZ: 0, onGround: true, zoomed: false,
    platform: 0                     // Space: oyuncunun son durduğu platform
};

function saveGameData() {
    writeSave({
        gold: player.gold, damage: player.damage, maxAmmo: player.maxAmmo,
        hasShield: player.hasShield,
        activeSkin: player.activeSkin, unlockedSkins: player.unlockedSkins, upgrades: player.upgrades,
        weapons: { shotgun: player.ownedWeapons.shotgun, sniper: player.ownedWeapons.sniper }
    });
}

// state: 'menu' | 'starting' | 'playing' | 'paused' | 'shop' | 'settings' | 'records' | 'profiles' | 'over'
let state = 'menu';
let shopReturn = 'menu';
let isDuelMode = false;
let duelBot = null;
let duelTime = 0;
let pendingDuelWin = false;
// Elin hangi zorlukta başladığı (duraklatmada ayar değişse de rekor doğru seviyeye yazılsın)
const run = { active: false, game: 'normal', duel: 'normal', map: 'depot' };
let firing = false;
let lockTimer = null;
const keys = { forward: false, back: false, left: false, right: false, sprint: false };

// Dalga durumu (yalnızca normal mod)
const wave = { num: 0, toSpawn: 0, breakTimer: 0, inBreak: false };

let scene, camera, renderer, canvas;
let enemies = [], bullets = [], particles = [], walls = [];
let cameraAngleY = 0, cameraAngleX = 0;
let brickMaterial, crateMaterial;
let weapon3DGroup, weaponBodyMat, weaponAccentMat;
const weaponModels = {};
let weaponKick = 0;
let weaponSwitchAnim = 0;
const clock = new THREE.Clock();
const tmpVec = new THREE.Vector3();

const $ = (id) => document.getElementById(id);

// ---- Paylaşılan geometri/materyaller (her mermi için yeniden oluşturulmaz) ----
const GEO = {
    bullet: new THREE.SphereGeometry(0.1, 8, 8),
    pellet: new THREE.SphereGeometry(0.05, 6, 6),
    particle: new THREE.BoxGeometry(0.08, 0.08, 0.08),
    body: new THREE.BoxGeometry(0.9, 1.2, 0.5),
    head: new THREE.BoxGeometry(0.5, 0.5, 0.5),
    arm: new THREE.BoxGeometry(0.3, 1.0, 0.3),
    hpBar: new THREE.PlaneGeometry(0.9, 0.09),
    shoulder: new THREE.BoxGeometry(0.45, 0.22, 0.6),
    chestPlate: new THREE.BoxGeometry(0.7, 0.6, 0.06),
    longGun: new THREE.BoxGeometry(0.07, 0.07, 1.1),
    visor: new THREE.BoxGeometry(0.42, 0.1, 0.04),
    headband: new THREE.BoxGeometry(0.54, 0.08, 0.54)
};
const MAT = {
    enemyBody: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }),
    enemyHead: new THREE.MeshStandardMaterial({ color: 0xf87171, roughness: 0.5 }),
    duelBody: new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.4 }),
    duelHead: new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.5 }),
    hpBg: new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7 }),
    hpHigh: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    hpMid: new THREE.MeshBasicMaterial({ color: 0xeab308 }),
    hpLow: new THREE.MeshBasicMaterial({ color: 0xef4444 })
};
const basicMatCache = {};
function basicMat(color) {
    return basicMatCache[color] || (basicMatCache[color] = new THREE.MeshBasicMaterial({ color }));
}

// Yükseltmelerin etkisi
const speedMul = () => 1 + UPGRADES.speed.per * player.upgrades.speed;
const reloadMul = () => 1 - UPGRADES.reload.per * player.upgrades.reload;
function applyMaxHealth() { player.maxHealth = 100 + UPGRADES.health.per * player.upgrades.health; }

// Aktif silah ve cephanesi
const curWeapon = () => WEAPONS[player.weapon];
const curAmmo = () => player.arsenal[player.weapon];
function magSize(id) { return id === 'rifle' ? player.maxAmmo : WEAPONS[id].mag; }
// Ayakların yüksekliği (kasaların üstünde > 0)
const footY = () => camera.position.y - CFG.eyeHeight;
