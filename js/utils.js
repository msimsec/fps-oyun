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
        if (w.h <= feet + CFG.stepHeight) continue;
        const px = Math.min(x - (w.x - w.w / 2 - r), (w.x + w.w / 2 + r) - x);
        const pz = Math.min(z - (w.z - w.d / 2 - r), (w.z + w.d / 2 + r) - z);
        if (px > 0 && pz > 0) depth = Math.max(depth, Math.min(px, pz));
    }
    return depth;
}
function collides(x, z, r, feet = 0) { return overlapDepth(x, z, r, feet) > 0; }
// Durulan zeminin yüksekliği: altındaki ve çıkılabilecek en yüksek engelin üstü (yoksa 0).
// r çarpışma payıyla aynı olmalı; daha küçük olursa kenardan düşen oyuncu engelin içine düşüp sıkışır.
function groundHeight(x, z, feet, r) {
    let g = 0;
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
        if (p.y < w.h &&
            p.x > w.x - w.w / 2 && p.x < w.x + w.w / 2 &&
            p.z > w.z - w.d / 2 && p.z < w.z + w.d / 2) return true;
    }
    return false;
}
// Eksenleri ayrı ayrı deneyerek duvar boyunca kaymayı sağlar. Bir şekilde engelin içinde
// kalındıysa, içeri daha az girilen yöne harekete izin verilir (sıkışıp kalmayı önler).
function moveWithCollision(pos, dx, dz, r, feet = 0) {
    const cur = overlapDepth(pos.x, pos.z, r, feet);
    const nx = overlapDepth(pos.x + dx, pos.z, r, feet);
    if (nx === 0 || nx < cur) pos.x += dx;
    const cur2 = overlapDepth(pos.x, pos.z, r, feet);
    const nz = overlapDepth(pos.x, pos.z + dz, r, feet);
    if (nz === 0 || nz < cur2) pos.z += dz;
}

function applyCameraRotation() {
    camera.rotation.y = cameraAngleY;
    camera.rotation.x = cameraAngleX;
}

const SCREENS = ['menuScreen', 'pauseScreen', 'gameOverScreen', 'shopModal', 'settingsScreen', 'recordsScreen'];
function hideAllScreens() {
    SCREENS.forEach(id => $(id).classList.remove('show'));
}
function showScreen(id) { hideAllScreens(); $(id).classList.add('show'); }

function resetKeys() {
    keys.forward = keys.back = keys.left = keys.right = keys.sprint = false;
    firing = false;
    player.semiFired = false;
}

function formatTime(sec) {
    const m = Math.floor(sec / 60), s = sec - m * 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
