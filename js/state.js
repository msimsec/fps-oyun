'use strict';

// =====================================================================
//  OYUNCU VE DURUM
// =====================================================================
const player = {
    health: 100, maxHealth: 100, armor: 0,
    maxAmmo: save.maxAmmo, ammo: save.maxAmmo, ammoPool: CFG.startPool,
    score: 0, kills: 0, goldEarned: 0,
    gold: save.gold, damage: save.damage, healKits: save.healKits,
    hasShield: save.hasShield, activeSkin: save.activeSkin, unlockedSkins: save.unlockedSkins,
    reloading: false, reloadTimer: 0, fireCooldown: 0, ammoRegenAcc: 0
};

function saveGameData() {
    writeSave({
        gold: player.gold, damage: player.damage, maxAmmo: player.maxAmmo,
        healKits: player.healKits, hasShield: player.hasShield,
        activeSkin: player.activeSkin, unlockedSkins: player.unlockedSkins
    });
}

// state: 'menu' | 'starting' | 'playing' | 'paused' | 'shop' | 'settings' | 'over'
let state = 'menu';
let shopReturn = 'menu';
let isDuelMode = false;
let duelBot = null;
let pendingDuelWin = false;
let firing = false;
let lockTimer = null;
const keys = { forward: false, back: false, left: false, right: false };

let scene, camera, renderer, canvas;
let enemies = [], bullets = [], particles = [], walls = [];
let cameraAngleY = 0, cameraAngleX = 0;
let brickMaterial;
let weapon3DGroup, weaponBodyMat, weaponAccentMat;
let weaponKick = 0;
const clock = new THREE.Clock();
const tmpVec = new THREE.Vector3();

const $ = (id) => document.getElementById(id);

// ---- Paylaşılan geometri/materyaller (her mermi için yeniden oluşturulmaz) ----
const GEO = {
    bullet: new THREE.SphereGeometry(0.1, 8, 8),
    particle: new THREE.BoxGeometry(0.08, 0.08, 0.08),
    body: new THREE.BoxGeometry(0.9, 1.2, 0.5),
    head: new THREE.BoxGeometry(0.5, 0.5, 0.5),
    arm: new THREE.BoxGeometry(0.3, 1.0, 0.3)
};
const MAT = {
    enemyBody: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }),
    enemyHead: new THREE.MeshStandardMaterial({ color: 0xf87171, roughness: 0.5 }),
    duelBody: new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.4 }),
    duelHead: new THREE.MeshStandardMaterial({ color: 0xc084fc, roughness: 0.5 })
};
const basicMatCache = {};
function basicMat(color) {
    return basicMatCache[color] || (basicMatCache[color] = new THREE.MeshBasicMaterial({ color }));
}
