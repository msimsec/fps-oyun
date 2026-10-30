'use strict';

// =====================================================================
//  OYUNCU VE DURUM
// =====================================================================
const player = {
    health: 100, maxHealth: 100, armor: 0,
    maxAmmo: save.maxAmmo,          // tüfek şarjörü (mağazadan yükseltilir)
    weapon: 'rifle',
    ownedWeapons: { rifle: true, pistol: true, shotgun: save.weapons.shotgun, sniper: save.weapons.sniper },
    arsenal: {},                    // silah başına { ammo, pool } — her elin başında doldurulur
    score: 0, kills: 0, headshots: 0, goldEarned: 0,
    gold: save.gold, damage: save.damage, healKits: save.healKits,
    hasShield: save.hasShield, activeSkin: save.activeSkin, unlockedSkins: save.unlockedSkins,
    reloading: false, reloadTimer: 0, fireCooldown: 0, semiFired: false,
    velY: 0, onGround: true, zoomed: false
};

function saveGameData() {
    writeSave({
        gold: player.gold, damage: player.damage, maxAmmo: player.maxAmmo,
        healKits: player.healKits, hasShield: player.hasShield,
        activeSkin: player.activeSkin, unlockedSkins: player.unlockedSkins,
        weapons: { shotgun: player.ownedWeapons.shotgun, sniper: player.ownedWeapons.sniper }
    });
}

// state: 'menu' | 'starting' | 'playing' | 'paused' | 'shop' | 'settings' | 'records' | 'over'
let state = 'menu';
let shopReturn = 'menu';
let isDuelMode = false;
let duelBot = null;
let duelTime = 0;
let pendingDuelWin = false;
// Elin hangi zorlukta başladığı (duraklatmada ayar değişse de rekor doğru seviyeye yazılsın)
const run = { active: false, game: 'normal', duel: 'normal' };
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
    hpBar: new THREE.PlaneGeometry(0.9, 0.09)
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

// Aktif silah ve cephanesi
const curWeapon = () => WEAPONS[player.weapon];
const curAmmo = () => player.arsenal[player.weapon];
function magSize(id) { return id === 'rifle' ? player.maxAmmo : WEAPONS[id].mag; }
// Ayakların yüksekliği (kasaların üstünde > 0)
const footY = () => camera.position.y - CFG.eyeHeight;
