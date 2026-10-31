'use strict';

// =====================================================================
//  OYUNCU PROFİLLERİ — aynı tarayıcıda birden fazla oyuncu (Ahmet, Mehmet...)
//  Her profilin kaydı, rekorları ve ayarları ayrı anahtarlarda tutulur:
//  "fps_save_v2::<profilId>" gibi. Diğer dosyalar anahtar adını profileKey()
//  ile alır; bu yüzden bu dosya hepsinden önce yüklenir.
//  Not: Parola yok; kayıtlar yalnızca bu tarayıcıda saklanır.
// =====================================================================
const PROFILES_KEY = 'fps_profiles_v1';
const PROFILE_CHOSEN_KEY = 'fps_profile_chosen';   // sessionStorage: bu sekmede giriş yapıldı mı
const MAX_PROFILES = 20, NAME_MAX = 16;
const PROFILE_DATA_KEYS = ['fps_save_v2', 'fps_records_v1', 'fps_records_v2', 'fps_settings_v1', 'fps_achievements_v1'];

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

const profiles = (() => {
    let o = null;
    try { o = JSON.parse(lsGet(PROFILES_KEY)); } catch (e) {}
    const list = (o && Array.isArray(o.list) ? o.list : [])
        .filter(p => p && typeof p.id === 'string' && typeof p.name === 'string')
        .slice(0, MAX_PROFILES);
    const current = o && list.some(p => p.id === o.current) ? o.current : (list[0] ? list[0].id : null);
    return { list, current };
})();

function saveProfiles() { lsSet(PROFILES_KEY, JSON.stringify(profiles)); }
// Listeyi değiştirmeden önce depodan yeniden oku: başka bir sekmede eklenen/silinen oyuncu,
// bu sekmedeki eski liste kaydedilince kaybolmasın
function refreshProfiles() {
    try {
        const o = JSON.parse(lsGet(PROFILES_KEY));
        if (o && Array.isArray(o.list)) {
            profiles.list = o.list.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string').slice(0, MAX_PROFILES);
        }
    } catch (e) {}
}
function newProfileId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
// Profil yokken (ilk açılış) oyun "_none" anahtarlarıyla yüklenir; giriş yapılmadan oynanamaz
const profileKey = (base) => `${base}::${profiles.current || '_none'}`;
const currentProfile = () => profiles.list.find(p => p.id === profiles.current) || null;

// v1.1'den geçiş: profil listesi yoksa ve eski (profilsiz) kayıt varsa "Oyuncu 1" profiline taşı
if (!profiles.list.length && PROFILE_DATA_KEYS.concat('val_gold').some(k => lsGet(k) !== null)) {
    const id = newProfileId();
    profiles.list.push({ id, name: 'Oyuncu 1' });
    profiles.current = id;
    PROFILE_DATA_KEYS.forEach(k => {
        const v = lsGet(k);
        if (v !== null) { lsSet(`${k}::${id}`, v); lsDel(k); }
    });
    saveProfiles();
}

function profileChosenThisTab() {
    try { return sessionStorage.getItem(PROFILE_CHOSEN_KEY) === profiles.current; } catch (e) { return false; }
}
function markProfileChosen() {
    try { sessionStorage.setItem(PROFILE_CHOSEN_KEY, profiles.current || ''); } catch (e) {}
}
const needsLogin = () => !currentProfile() || !profileChosenThisTab();

// Başka bir profilin özetini (altın, en iyi skor) kendi kaydından okur
function profileSummary(id) {
    let gold = 0, best = 0;
    try {
        const wrap = JSON.parse(lsGet(`fps_save_v2::${id}`));
        if (wrap && typeof wrap.d === 'string') gold = Math.max(0, Math.floor(Number(JSON.parse(wrap.d).gold)) || 0);
    } catch (e) {}
    const bestOf = (r) => { if (r && r.game) Object.values(r.game).forEach(g => { best = Math.max(best, Number(g && g.score) || 0); }); };
    try {
        const r2 = JSON.parse(lsGet(`fps_records_v2::${id}`));   // bölüm başına rekorlar
        if (r2 && typeof r2 === 'object') Object.values(r2).forEach(bestOf);
        else bestOf(JSON.parse(lsGet(`fps_records_v1::${id}`)));
    } catch (e) {}
    return { gold, best };
}

function cleanName(raw) { return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX); }
function nameTaken(name, exceptId) {
    const n = name.toLocaleLowerCase('tr');
    return profiles.list.some(p => p.id !== exceptId && p.name.toLocaleLowerCase('tr') === n);
}

// ---- Giriş ekranı ----
function openProfiles() {
    if (document.pointerLockElement) document.exitPointerLock();
    state = 'profiles';
    showScreen('profileScreen');
    $('profileBack').style.display = profileChosenThisTab() && currentProfile() ? '' : 'none';
    $('profileNote').textContent = '';
    renderProfiles();
    setTimeout(() => $('newProfileName').focus(), 0);
}

function renderProfiles() {
    refreshProfiles();
    const box = $('profileList');
    box.innerHTML = '';
    if (!profiles.list.length) {
        const empty = document.createElement('div');
        empty.className = 'note';
        empty.textContent = 'Henüz kayıtlı oyuncu yok. Aşağıya adını yazıp kayıt ol.';
        box.appendChild(empty);
    }
    profiles.list.forEach(p => {
        const sum = profileSummary(p.id);
        const card = document.createElement('div');
        card.className = 'profile-card' + (p.id === profiles.current ? ' current' : '');

        const main = document.createElement('button');
        main.className = 'profile-main';
        main.onclick = () => selectProfile(p.id);
        const name = document.createElement('span');
        name.className = 'profile-name';
        name.textContent = p.name;                       // textContent: isim HTML olarak yorumlanmaz
        const info = document.createElement('span');
        info.className = 'profile-info';
        info.textContent = `🪙 ${sum.gold}  ·  🏆 ${sum.best}`;
        main.append(name, info);

        const actions = document.createElement('div');
        actions.className = 'profile-actions';
        const ren = document.createElement('button');
        ren.className = 'icon-btn'; ren.title = 'Adını değiştir'; ren.textContent = '✎ Ad';
        ren.onclick = () => renameProfile(p.id);
        const del = document.createElement('button');
        del.className = 'icon-btn danger'; del.title = 'Oyuncuyu ve kaydını sil'; del.textContent = '🗑 Sil';
        del.onclick = () => deleteProfile(p.id);
        actions.append(ren, del);

        card.append(main, actions);
        box.appendChild(card);
    });
    $('newProfileRow').style.display = profiles.list.length >= MAX_PROFILES ? 'none' : '';
}

function selectProfile(id) {
    profiles.current = id;
    saveProfiles();
    markProfileChosen();
    // Kayıt, ayarlar ve rekorlar sayfa yüklenirken okunduğu için en temizi yeniden yüklemek
    location.reload();
}

function createProfile() {
    refreshProfiles();
    const name = cleanName($('newProfileName').value);
    const note = $('profileNote');
    if (!name) { note.textContent = 'Lütfen bir ad yaz.'; return; }
    if (nameTaken(name)) { note.textContent = `"${name}" adı zaten kayıtlı. Listeden seçebilirsin.`; return; }
    if (profiles.list.length >= MAX_PROFILES) { note.textContent = `En fazla ${MAX_PROFILES} oyuncu kaydedilebilir.`; return; }
    const id = newProfileId();
    profiles.list.push({ id, name });
    selectProfile(id);
}

function renameProfile(id) {
    refreshProfiles();
    const p = profiles.list.find(x => x.id === id);
    if (!p) return;
    const name = cleanName(prompt('Yeni ad:', p.name));
    if (!name || name === p.name) return;
    if (nameTaken(name, id)) { $('profileNote').textContent = `"${name}" adı zaten kayıtlı.`; return; }
    p.name = name;
    saveProfiles();
    renderProfiles();
    updatePlayerTag();
}

function deleteProfile(id) {
    refreshProfiles();
    const p = profiles.list.find(x => x.id === id);
    if (!p || !confirm(`"${p.name}" ve tüm kaydı (altın, silahlar, rekorlar) silinsin mi? Bu geri alınamaz.`)) return;
    PROFILE_DATA_KEYS.forEach(k => lsDel(`${k}::${id}`));
    profiles.list = profiles.list.filter(x => x.id !== id);
    if (profiles.current === id) {
        profiles.current = profiles.list[0] ? profiles.list[0].id : null;
        saveProfiles();
        try { sessionStorage.removeItem(PROFILE_CHOSEN_KEY); } catch (e) {}
        location.reload();                       // oynayan oyuncu silindi: giriş ekranına dön
        return;
    }
    saveProfiles();
    renderProfiles();
}

function closeProfiles() { returnTo('menu'); }

function updatePlayerTag() {
    const p = currentProfile();
    $('playerName').textContent = p ? p.name : '-';
}
