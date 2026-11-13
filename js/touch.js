'use strict';

// =====================================================================
//  DOKUNMATİK KONTROLLER (tablet / telefon)
//  - Sol yarı: parmağı koyduğun yerde sanal çubuk çıkar; çubukla yürürsün, sonuna kadar
//    ileri itince koşarsın.
//  - Sağ yarı: parmağı kaydırarak nişan alırsın (ATEŞ butonundan kaydırınca da nişan döner).
//  - Butonlar: ATEŞ, zıpla, çömel (aç/kapa), şarjör, bomba, silah değiştir, dürbün (yalnızca
//    Keskin Nişancı), fener (yalnızca Gece Limanı), duraklat.
//  Pointer Events kullanılır: her parmak kendi pointerId'siyle izlenir (aynı anda yürü + nişan + ateş).
//  Ayarlar → Dokunmatik Kontroller: Otomatik (dokunmatik ekranda açılır) / Açık / Kapalı.
// =====================================================================
const TOUCH_MODES = ['auto', 'on', 'off'];
const TOUCH_LOOK_SENS = 0.0055;           // radyan / piksel (hassasiyet 1.0x)
const STICK_R = 56;                       // çubuğun en fazla gidebildiği yarıçap (px)

// Çubuğun analog değeri: x sağ (+), y ileri (+); 0-1 arası
const touchMove = { x: 0, y: 0, active: false };
const touchPtr = { stick: null, look: null, fire: null };
let stickOrigin = { x: 0, y: 0 };
let lookLast = { x: 0, y: 0 };

function touchDevice() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return coarse && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
}
// Menüdeki bilgi satırı: dokunmatik cihazda kontrollerin açık olup olmadığı
function updateMobileNote() {
    const note = $('mobileNote');
    if (!note) return;
    if (touchActive()) note.textContent = '📱 Dokunmatik kontroller açık. En rahat yatay ekranda ve uygulama olarak yükleyip tam ekranda oynanır.';
    else if (touchDevice()) note.textContent = 'Dokunmatik kontroller kapalı. Açmak için Ayarlar → Dokunmatik Kontroller.';
    else note.textContent = '';
}
function touchActive() {
    return settings.touch === 'on' || (settings.touch === 'auto' && touchDevice());
}
function applyTouchMode() {
    document.body.classList.toggle('touch', touchActive());
    resetTouch();
}

function resetTouch() {
    touchMove.x = touchMove.y = 0; touchMove.active = false;
    touchPtr.stick = touchPtr.look = touchPtr.fire = null;
    const knob = $('touchStick');
    if (knob) knob.classList.remove('show');
}

// Oyun başlarken: fare kilidi yerine doğrudan oyna; mümkünse tam ekran ve yatay
function touchStartPlaying() {
    clearTimeout(lockTimer);
    state = 'playing';
    hideAllScreens();
    $('pauseHint').textContent = '';
    clock.getDelta();
    resetKeys();
    resetTouch();
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
        el.requestFullscreen({ navigationUI: 'hide' })
            .then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); })
            .catch(() => {});
    }
}

// Bakış: parmağın kayması kadar kamerayı döndür (dürbünde görüş açısıyla orantılı yavaşlar)
function touchLook(dx, dy) {
    const k = TOUCH_LOOK_SENS * settings.sens * (camera.fov / CFG.baseFov);
    cameraAngleY -= dx * k;
    cameraAngleX -= dy * k;
    cameraAngleX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, cameraAngleX));
    applyCameraRotation();
}

function setStick(px, py) {
    let dx = px - stickOrigin.x, dy = py - stickOrigin.y;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    touchMove.x = dx / STICK_R;
    touchMove.y = -dy / STICK_R;
    touchMove.active = Math.hypot(touchMove.x, touchMove.y) > 0.15;     // küçük titremeler yürütmesin
    // Klavye bayrakları: koşma, FOV ve sallanma aynı kurallarla çalışsın
    keys.forward = touchMove.active && touchMove.y > 0.35;
    keys.back = touchMove.active && touchMove.y < -0.35;
    keys.right = touchMove.active && touchMove.x > 0.35;
    keys.left = touchMove.active && touchMove.x < -0.35;
    keys.sprint = touchMove.y > 0.9;                                    // sonuna kadar ileri: koş
    $('touchKnob').style.transform = `translate(${dx}px, ${dy}px)`;
}
function releaseStick() {
    touchPtr.stick = null;
    touchMove.x = touchMove.y = 0; touchMove.active = false;
    keys.forward = keys.back = keys.left = keys.right = keys.sprint = false;
    $('touchStick').classList.remove('show');
}

// Boş alan (oyun ekranı): sol yarı çubuk, sağ yarı bakış
function onPadDown(e) {
    if (state !== 'playing') return;
    e.preventDefault();
    const left = e.clientX < window.innerWidth * 0.42;
    if (left && touchPtr.stick === null) {
        touchPtr.stick = e.pointerId;
        stickOrigin = { x: e.clientX, y: e.clientY };
        const st = $('touchStick');
        st.style.left = e.clientX + 'px'; st.style.top = e.clientY + 'px';
        st.classList.add('show');
        setStick(e.clientX, e.clientY);
    } else if (!left && touchPtr.look === null) {
        touchPtr.look = e.pointerId;
        lookLast = { x: e.clientX, y: e.clientY };
    }
    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
}
function onPadMove(e) {
    if (e.pointerId === touchPtr.stick) { e.preventDefault(); setStick(e.clientX, e.clientY); }
    else if (e.pointerId === touchPtr.look || e.pointerId === touchPtr.fire) {
        e.preventDefault();
        if (state === 'playing') touchLook(e.clientX - lookLast.x, e.clientY - lookLast.y);
        lookLast = { x: e.clientX, y: e.clientY };
    }
}
function onPadUp(e) {
    if (e.pointerId === touchPtr.stick) releaseStick();
    if (e.pointerId === touchPtr.look) touchPtr.look = null;
}

// ATEŞ: basılı tuttukça ateş eder; parmağı kaydırınca nişan da döner
function onFireDown(e) {
    if (state !== 'playing') return;
    e.preventDefault(); e.stopPropagation();
    touchPtr.fire = e.pointerId;
    lookLast = { x: e.clientX, y: e.clientY };
    firing = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
}
function onFireUp(e) {
    if (e.pointerId !== touchPtr.fire) return;
    touchPtr.fire = null;
    firing = false;
    player.semiFired = false;            // yarı otomatik silah: her dokunuşta bir atış
}

// Tek dokunuşluk butonlar
const TOUCH_ACTIONS = {
    jump: () => jump(),
    crouch: () => { keys.crouch = !keys.crouch; },
    reload: () => startReload(),
    grenade: () => throwGrenade(),
    weapon: () => cycleWeapon(1),
    scope: () => setZoom(!player.zoomed),
    light: () => toggleFlashlight(),
    pause: () => { resetTouch(); firing = false; pauseGame(); }
};

function initTouch() {
    const pad = $('touchPad');
    pad.addEventListener('pointerdown', onPadDown);
    // Hareket ve bırakma belge düzeyinde: parmak bir butonun üstünden geçse de izlensin
    document.addEventListener('pointermove', onPadMove, { passive: false });
    document.addEventListener('pointerup', (e) => { onPadUp(e); onFireUp(e); });
    document.addEventListener('pointercancel', (e) => { onPadUp(e); onFireUp(e); });
    const fire = $('touchFire');
    fire.addEventListener('pointerdown', onFireDown);
    document.querySelectorAll('#touchUI [data-act]').forEach(b => {
        b.addEventListener('pointerdown', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (state !== 'playing') return;
            TOUCH_ACTIONS[b.dataset.act]();
            b.classList.add('pressed');
            setTimeout(() => b.classList.remove('pressed'), 120);
        });
    });
    // Oyun sırasında sağ tık menüsü, uzun basma büyüteci ve çift dokunma yakınlaştırması çıkmasın
    $('touchUI').addEventListener('contextmenu', (e) => e.preventDefault());
    // Uygulama arka plana geçince (telefon kilitlenince, başka uygulamaya geçince) oyunu duraklat
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && touchActive() && state === 'playing') TOUCH_ACTIONS.pause();
    });
    // Telefon dik çevrilince oyunu duraklat (yatay oynanır)
    window.addEventListener('resize', () => {
        if (touchActive() && state === 'playing' && window.innerHeight > window.innerWidth) TOUCH_ACTIONS.pause();
    });
    applyTouchMode();
}

// Her karede: duruma göre görünen butonlar (dürbün yalnızca Keskin Nişancı, fener yalnızca gece)
function updateTouchUI() {
    if (!document.body.classList.contains('touch')) return;
    const scope = $('touchScope'), light = $('touchLight'), crouch = $('touchCrouch');
    const showScope = !!curWeapon().zoom;
    if (scope.hidden === showScope) scope.hidden = !showScope;
    scope.classList.toggle('on', player.zoomed);
    const showLight = !!curMap().night;
    if (light.hidden === showLight) light.hidden = !showLight;
    light.classList.toggle('on', showLight && flashlightOn);
    crouch.classList.toggle('on', keys.crouch);
}
