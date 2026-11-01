'use strict';

// =====================================================================
//  GİRİŞ (klavye düzeninden bağımsız: e.code)
// =====================================================================
const WEAPON_KEYS = { Digit1: 'pistol', Digit2: 'rifle', Digit3: 'shotgun', Digit4: 'sniper', Digit5: 'smg',
                      Numpad1: 'pistol', Numpad2: 'rifle', Numpad3: 'shotgun', Numpad4: 'sniper', Numpad5: 'smg' };

function onKeyDown(e) {
    // Oyun sırasında Space/Enter odaktaki bir menü butonunu tetiklemesin
    if (state === 'playing' && (e.code === 'Space' || e.code === 'Enter')) e.preventDefault();
    switch (e.code) {
        case 'KeyW': case 'ArrowUp': keys.forward = true; break;
        case 'KeyS': case 'ArrowDown': keys.back = true; break;
        case 'KeyA': case 'ArrowLeft': keys.left = true; break;
        case 'KeyD': case 'ArrowRight': keys.right = true; break;
        case 'ShiftLeft': case 'ShiftRight': keys.sprint = true; break;
        case 'Space': if (state === 'playing') jump(); break;
        case 'KeyR': if (state === 'playing') startReload(); break;
        case 'KeyG': if (state === 'playing') throwGrenade(); break;
        default:
            if (WEAPON_KEYS[e.code] && state === 'playing') selectWeapon(WEAPON_KEYS[e.code]);
    }
}

function onKeyUp(e) {
    switch (e.code) {
        case 'KeyW': case 'ArrowUp': keys.forward = false; break;
        case 'KeyS': case 'ArrowDown': keys.back = false; break;
        case 'KeyA': case 'ArrowLeft': keys.left = false; break;
        case 'KeyD': case 'ArrowRight': keys.right = false; break;
        case 'ShiftLeft': case 'ShiftRight': keys.sprint = false; break;
    }
}

function onMouseMove(e) {
    if (document.pointerLockElement !== canvas || state !== 'playing') return;
    // Dürbünle bakarken hassasiyet görüş açısıyla orantılı düşer
    const k = BASE_SENS * settings.sens * (camera.fov / CFG.baseFov);
    cameraAngleY -= e.movementX * k;
    cameraAngleX -= e.movementY * k;
    cameraAngleX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, cameraAngleX));
    applyCameraRotation();
}

function onMouseDown(e) {
    // Sadece fare kilitliyken ateş edilir; kilidi almak için yapılan tıklama mermi harcamaz
    if (state !== 'playing' || document.pointerLockElement !== canvas) return;
    if (e.button === 0) firing = true;
    if (e.button === 2) setZoom(true);
}

function onMouseUp(e) {
    if (e.button === 0) { firing = false; player.semiFired = false; }
    if (e.button === 2) setZoom(false);
}

function onWheel(e) {
    if (state !== 'playing' || e.deltaY === 0) return;
    cycleWeapon(e.deltaY > 0 ? 1 : -1);
}

function onPointerLockChange() {
    const locked = document.pointerLockElement === canvas;
    if (locked) {
        clearTimeout(lockTimer);
        if (state === 'starting' || state === 'paused') {
            state = 'playing';
            hideAllScreens();
            $('pauseHint').textContent = '';
            clock.getDelta();
        }
    } else {
        resetKeys();
        setZoom(false);
        if (state === 'playing') pauseGame();
    }
}

function requestLock() {
    try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(lockFailed);
    } catch (e) { lockFailed(); }
    clearTimeout(lockTimer);   // önceki isteğin zamanlayıcısı yeni isteği bozmasın
    lockTimer = setTimeout(() => { if (state === 'starting') lockFailed(); }, 1200);
}

function lockFailed() {
    if (state !== 'starting') return;
    state = 'paused';
    showScreen('pauseScreen');
    $('pauseHint').textContent = 'Fare kilitlenemedi. "Devam Et"e tekrar tıkla.';
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
