'use strict';

// =====================================================================
//  AYARLAR
// =====================================================================
let settingsReturn = 'menu';

function openSettings(from) {
    settingsReturn = from;
    state = 'settings';
    showScreen('settingsScreen');
    $('settingsNote').textContent = from === 'paused' ? 'Zorluk değişiklikleri bir sonraki elde geçerli olur.' : '';
    updateSettingsScreen();
}

function closeSettings() { returnTo(settingsReturn); }

function setSensitivity(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return;
    settings.sens = Math.round(Math.min(SENS_MAX, Math.max(SENS_MIN, v)) * 10) / 10;
    saveSettings();
    $('sensValue').textContent = settings.sens.toFixed(1) + 'x';
}

function setVolume(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return;
    settings.volume = Math.min(1, Math.max(0, v / 100));
    saveSettings();
    setMasterVolume(settings.volume);
    $('volumeValue').textContent = Math.round(settings.volume * 100) + '%';
}

// Ses ayarını değiştirirken kısa bir örnek çal
function previewVolume() {
    initAudio();
    sfx('hit');
}

function setDifficulty(kind, value) {
    if (!DIFFICULTIES.includes(value) || (kind !== 'game' && kind !== 'duel')) return;
    settings[kind] = value;
    saveSettings();
    updateSettingsScreen();
    updateDifficultyInfo();
}

// Görüş açısı ve nişangâh: hemen uygulanır
function applyView() {
    CFG.baseFov = settings.fov;
    CFG.sprintFov = settings.fov + 7;                // koşarken biraz geniş
    if (camera && !player.zoomed) { camera.fov = CFG.baseFov; camera.updateProjectionMatrix(); }
    const ch = $('crosshair');
    ch.dataset.shape = settings.crosshair;
    ch.style.setProperty('--ch', settings.chColor);
}
function setFov(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return;
    settings.fov = Math.min(FOV_MAX, Math.max(FOV_MIN, Math.round(v / 5) * 5));
    saveSettings(); applyView();
    $('fovValue').textContent = settings.fov + '°';
}
function setCrosshair(shape) {
    if (!CROSSHAIRS.includes(shape)) return;
    settings.crosshair = shape; saveSettings(); applyView(); updateSettingsScreen();
}
function setCrosshairColor(c) {
    if (!CH_COLORS.includes(c)) return;
    settings.chColor = c; saveSettings(); applyView(); updateSettingsScreen();
}

function setAnnouncer(on) {
    settings.announcer = !!on;
    saveSettings();
    updateSettingsScreen();
    if (on) { initAudio(); announce('Harika!'); }
}

function setTouchMode(value) {
    if (!TOUCH_MODES.includes(value)) return;
    settings.touch = value;
    saveSettings();
    applyTouchMode();
    updateSettingsScreen();
    updateMobileNote();
}

function updateSettingsScreen() {
    $('chShapeButtons').innerHTML = CROSSHAIRS.map(s =>
        `<button class="seg-btn normal${settings.crosshair === s ? ' active' : ''}" onclick="setCrosshair('${s}')">${CROSSHAIR_NAMES[s]}</button>`).join('');
    $('chColorButtons').innerHTML = CH_COLORS.map(c =>
        `<button class="color-swatch${settings.chColor === c ? ' active' : ''}" style="background:${c}" title="${c}" onclick="setCrosshairColor('${c}')"></button>`).join('');
    $('chPreview').dataset.shape = settings.crosshair;
    $('chPreview').style.setProperty('--ch', settings.chColor);
    $('fovSlider').value = settings.fov;
    $('fovValue').textContent = settings.fov + '°';
    $('announcerButtons').querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', (b.dataset.value === 'on') === settings.announcer));
    $('touchButtons').querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === settings.touch));
    $('touchDesc').textContent = touchActive()
        ? 'Dokunmatik kontroller AÇIK: sol yarıda çubukla yürü, sağ yarıda kaydırarak nişan al, butonlarla ateş et.'
        : 'Dokunmatik kontroller kapalı: klavye ve fare ile oynanır.' + (touchDevice() ? ' (Bu cihaz dokunmatik; Otomatik ya da Açık seç.)' : '');
    $('gameDiffButtons').querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === settings.game));
    $('duelDiffButtons').querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === settings.duel));
    $('sensSlider').value = settings.sens;
    $('sensValue').textContent = settings.sens.toFixed(1) + 'x';
    $('volumeSlider').value = Math.round(settings.volume * 100);
    $('volumeValue').textContent = Math.round(settings.volume * 100) + '%';
    const g = GAME_DIFF[settings.game], d = DUEL_DIFF[settings.duel];
    $('gameDiffDesc').textContent =
        `Düşman canı ${g.enemyHealth} · İlk dalga ${g.waveBase} düşman · Düşman başına ${g.killGold} altın`;
    $('duelDiffDesc').textContent =
        `Bot canı ${d.duelHealth} · ${d.botFireInterval} sn'de bir ${d.botBulletDamage} hasar · Kazanınca ${d.duelGold} altın`;
}

function updateDifficultyInfo() {
    $('difficultyInfo').textContent =
        `Bölüm: ${MAPS[settings.map].name} · Zorluk: ${DIFF_LABELS[settings.game]} · Düello: ${DIFF_LABELS[settings.duel]}`;
    renderMapPicker();
}

// Ana menüdeki bölüm seçici: seçilen bölüm menünün arkasında hemen kurulur
function renderMapPicker() {
    const box = $('mapPicker');
    box.innerHTML = '';
    MAP_IDS.forEach(id => {
        const m = MAPS[id];
        const b = document.createElement('button');
        b.className = 'map-option map-' + id + (settings.map === id ? ' active' : '');
        b.onclick = () => setMap(id);
        const name = document.createElement('span'); name.className = 'map-name'; name.textContent = m.name;
        const desc = document.createElement('span'); desc.className = 'map-desc'; desc.textContent = m.desc;
        const badge = document.createElement('span'); badge.className = 'map-badge';
        badge.textContent = settings.map === id ? '✓ SEÇİLİ' : 'Seçmek için tıkla';
        b.append(name, desc, badge);
        box.appendChild(b);
    });
}

function setMap(id) {
    if (!MAPS[id] || settings.map === id) return;
    settings.map = id;
    saveSettings();
    if (state === 'menu' || state === 'over') { buildMap(id); placeAtSpawn(); }
    updateDifficultyInfo();
    initAudio();
    sfx('switch');
}
