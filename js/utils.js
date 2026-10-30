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

// Duvar çarpışması (yatay düzlemde, r = yarıçap payı)
function collides(x, z, r) {
    for (const w of walls) {
        if (x > w.x - w.w / 2 - r && x < w.x + w.w / 2 + r &&
            z > w.z - w.d / 2 - r && z < w.z + w.d / 2 + r) return true;
    }
    return false;
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
// Eksenleri ayrı ayrı deneyerek duvar boyunca kaymayı sağlar
function moveWithCollision(pos, dx, dz, r) {
    if (!collides(pos.x + dx, pos.z, r)) pos.x += dx;
    if (!collides(pos.x, pos.z + dz, r)) pos.z += dz;
}

function applyCameraRotation() {
    camera.rotation.y = cameraAngleY;
    camera.rotation.x = cameraAngleX;
}

function hideAllScreens() {
    ['menuScreen', 'pauseScreen', 'gameOverScreen', 'shopModal', 'settingsScreen'].forEach(id => $(id).classList.remove('show'));
}
function showScreen(id) { hideAllScreens(); $(id).classList.add('show'); }

function resetKeys() {
    keys.forward = keys.back = keys.left = keys.right = false;
    firing = false;
}
