'use strict';

// =====================================================================
//  GİRİŞ (klavye düzeninden bağımsız: e.code)
// =====================================================================
function onKeyDown(e) {
    switch (e.code) {
        case 'KeyW': case 'ArrowUp': keys.forward = true; break;
        case 'KeyS': case 'ArrowDown': keys.back = true; break;
        case 'KeyA': case 'ArrowLeft': keys.left = true; break;
        case 'KeyD': case 'ArrowRight': keys.right = true; break;
        case 'KeyR': if (state === 'playing') startReload(); break;
        case 'Digit2': case 'Numpad2': if (state === 'playing') useHealKit(); break;
    }
}

function onKeyUp(e) {
    switch (e.code) {
        case 'KeyW': case 'ArrowUp': keys.forward = false; break;
        case 'KeyS': case 'ArrowDown': keys.back = false; break;
        case 'KeyA': case 'ArrowLeft': keys.left = false; break;
        case 'KeyD': case 'ArrowRight': keys.right = false; break;
    }
}

function onMouseMove(e) {
    if (document.pointerLockElement !== canvas || state !== 'playing') return;
    const k = BASE_SENS * settings.sens;
    cameraAngleY -= e.movementX * k;
    cameraAngleX -= e.movementY * k;
    cameraAngleX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, cameraAngleX));
    applyCameraRotation();
}

function onMouseDown(e) {
    // Sadece fare kilitliyken ateş edilir; kilidi almak için yapılan tıklama mermi harcamaz
    if (e.button === 0 && state === 'playing' && document.pointerLockElement === canvas) firing = true;
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
