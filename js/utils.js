'use strict';

// =====================================================================
//  YARDIMCILAR
// =====================================================================
let toastTimer = null;
function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

const hudCache = {};
function setHud(id, val) {
    if (hudCache[id] !== val) { hudCache[id] = val; $(id).textContent = val; }
}

function flashClass(id, cls, ms) {
    const el = $(id);
    el.classList.add(cls);
    clearTimeout(el['_t' + cls]);
    el['_t' + cls] = setTimeout(() => el.classList.remove(cls), ms);
}

// Duvar/kasa çarpışması (yatay düzlemde, r = yarıçap payı).
// feet: ayak yüksekliği; üst yüzeyi ayağın en fazla stepHeight üstünde olan engeller engellemez
// (üstlerine çıkılır). Düşmanlar her zaman 0 ile çağırır, yani kasalara çıkamaz.
// Dönen değer engelin ne kadar içine girildiği (0 = çarpışma yok).
function overlapDepth(x, z, r, feet = 0) {
    let depth = 0;
    for (const w of walls) {
        // Üstüne çıkılabilecek kadar alçak ya da tamamen başın üstünde kalan (yüzen) engeller engellemez
        if (w.h <= feet + CFG.stepHeight || w.b >= feet + 2) continue;
        const px = Math.min(x - (w.x - w.w / 2 - r), (w.x + w.w / 2 + r) - x);
        const pz = Math.min(z - (w.z - w.d / 2 - r), (w.z + w.d / 2 + r) - z);
        // 1e-6 payı: duvara tam yaslanınca ondalık hatası yüzünden "içeride" sayılmasın
        if (px > 1e-6 && pz > 1e-6) depth = Math.max(depth, Math.min(px, pz));
    }
    return depth;
}
function collides(x, z, r, feet = 0) { return overlapDepth(x, z, r, feet) > 0; }
// Durulan zeminin yüksekliği: altındaki ve çıkılabilecek en yüksek engelin üstü (yoksa 0).
// r çarpışma payıyla aynı olmalı; daha küçük olursa kenardan düşen oyuncu engelin içine düşüp sıkışır.
function groundHeight(x, z, feet, r) {
    let g = curMap().floorY;          // Space'te zemin yok: -Infinity
    for (const w of walls) {
        if (w.h > feet + CFG.stepHeight || w.h <= g) continue;
        if (x > w.x - w.w / 2 - r && x < w.x + w.w / 2 + r &&
            z > w.z - w.d / 2 - r && z < w.z + w.d / 2 + r) g = w.h;
    }
    return g;
}
// Mermi için: yükseklik de dahil
function pointInWall(p) {
    for (const w of walls) {
        if (p.y < w.h && p.y > w.b &&
            p.x > w.x - w.w / 2 && p.x < w.x + w.w / 2 &&
            p.z > w.z - w.d / 2 && p.z < w.z + w.d / 2) return true;
    }
    return false;
}
// Eksenleri ayrı ayrı deneyerek duvar boyunca kaymayı sağlar. Bir şekilde engelin içinde
// kalındıysa, daha derine girmeyen her harekete izin verilir: dışarı çıkmak ve engel boyunca
// kaymak serbest (yalnızca "daha az içeri" şartı, duvar boyunca kaymayı da engelleyip kilitliyordu).
// canStand verilirse (düşmanlar için) yeni konumun altında zemin olmalı: platformdan düşmezler.
function moveWithCollision(pos, dx, dz, r, feet = 0, canStand = null) {
    const cur = overlapDepth(pos.x, pos.z, r, feet);
    const nx = overlapDepth(pos.x + dx, pos.z, r, feet);
    if (nx <= cur && (!canStand || canStand(pos.x + dx, pos.z))) pos.x += dx;
    const cur2 = overlapDepth(pos.x, pos.z, r, feet);
    const nz = overlapDepth(pos.x, pos.z + dz, r, feet);
    if (nz <= cur2 && (!canStand || canStand(pos.x, pos.z + dz))) pos.z += dz;
}

function applyCameraRotation() {
    camera.rotation.y = cameraAngleY;
    camera.rotation.x = cameraAngleX;
}

const SCREENS = ['menuScreen', 'pauseScreen', 'gameOverScreen', 'shopModal', 'settingsScreen', 'recordsScreen', 'profileScreen', 'achievementsScreen'];
// Bir menü açıkken oyun HUD'u gizlenir (menünün arkasında silik görünüp karışıklık yaratmasın)
function hideAllScreens() {
    SCREENS.forEach(id => $(id).classList.remove('show'));
    document.body.classList.remove('in-menu');
}
function showScreen(id) { hideAllScreens(); $(id).classList.add('show'); document.body.classList.add('in-menu'); }

function resetKeys() {
    keys.forward = keys.back = keys.left = keys.right = keys.sprint = false;
    firing = false;
    player.semiFired = false;
}

function formatTime(sec) {
    const m = Math.floor(sec / 60), s = sec - m * 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
