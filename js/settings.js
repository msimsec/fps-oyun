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

function updateSettingsScreen() {
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
        b.append(name, desc);
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
