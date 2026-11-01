'use strict';

// =====================================================================
//  OYUNCU PROFİLLERİ — aynı tarayıcıda birden fazla oyuncu (Ahmet, Mehmet...)
//  Her profilin kaydı, rekorları ve ayarları ayrı anahtarlarda tutulur:
//  "fps_save_v2::<profilId>" gibi. Diğer dosyalar anahtar adını profileKey()
//  ile alır; bu yüzden bu dosya hepsinden önce yüklenir.
//  Her profilin 4-8 karakterlik basit bir parolası vardır (yalnızca özeti/hash saklanır).
//  Bu, aynı bilgisayarı kullananların birbirinin kaydına girmesini önleyen basit bir kilittir;
//  kayıtlar yalnızca bu tarayıcıda durur ve parola unutulursa geri getirilemez.
// =====================================================================
const PROFILES_KEY = 'fps_profiles_v1';
const PROFILE_CHOSEN_KEY = 'fps_profile_chosen';   // sessionStorage: bu sekmede giriş yapıldı mı
const MAX_PROFILES = 20, NAME_MAX = 16;
const PW_MIN = 4, PW_MAX = 8;
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
// Parola özeti (cyrb53): parolanın kendisi saklanmaz; profil kimliği tuz olarak eklenir
function pwHash(id, pw) {
    const str = 'fps-pw|' + id + '|' + pw;
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const pwValid = (pw) => typeof pw === 'string' && pw.length >= PW_MIN && pw.length <= PW_MAX;
const pwCheck = (p, pw) => !!p.pw && p.pw === pwHash(p.id, pw);

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
// Parolası olmayan (eski) oyuncu, bu sekmede giriş yapmış olsa bile önce parola belirlemeli
const needsLogin = () => !currentProfile() || !profileChosenThisTab() || !currentProfile().pw;

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
    $('profileBack').style.display = needsLogin() ? 'none' : '';
    const cur = currentProfile();
    $('profileNote').textContent = cur && !cur.pw && profileChosenThisTab()
        ? `${cur.name}, artık her oyuncunun parolası var. Adına tıklayıp ${PW_MIN}-${PW_MAX} karakterlik bir parola belirle.` : '';
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
        main.onclick = () => loginProfile(p.id);
        const name = document.createElement('span');
        name.className = 'profile-name';
        name.textContent = p.name;                       // textContent: isim HTML olarak yorumlanmaz
        const info = document.createElement('span');
        info.className = 'profile-info';
        info.textContent = `🪙 ${sum.gold}  ·  🏆 ${sum.best}` + (p.pw ? '' : '  ·  ⚠ parola yok');
        main.append(name, info);

        const actions = document.createElement('div');
        actions.className = 'profile-actions';
        const ren = document.createElement('button');
        ren.className = 'icon-btn'; ren.title = 'Adını değiştir'; ren.textContent = '✎ Ad';
        ren.onclick = () => renameProfile(p.id);
        const key = document.createElement('button');
        key.className = 'icon-btn'; key.title = 'Parolayı değiştir'; key.textContent = '🔑 Parola';
        key.onclick = () => changePassword(p.id);
        const del = document.createElement('button');
        del.className = 'icon-btn danger'; del.title = 'Oyuncuyu ve kaydını sil'; del.textContent = '🗑 Sil';
        del.onclick = () => deleteProfile(p.id);
        actions.append(ren, key, del);

        card.append(main, actions);
        box.appendChild(card);
    });
    $('newProfileRow').style.display = profiles.list.length >= MAX_PROFILES ? 'none' : '';
}

// Profil kartına tıklama: bu sekmede zaten bu oyuncuyla giriş yapıldıysa doğrudan geç,
// değilse parola sor (parolası olmayan eski profil için önce parola belirlenir)
function loginProfile(id) {
    refreshProfiles();
    const p = profiles.list.find(x => x.id === id);
    if (!p) return;
    if (!p.pw) {
        askPassword({
            title: `${p.name} için parola belirle`,
            text: `Bu oyuncunun henüz parolası yok. ${PW_MIN}-${PW_MAX} karakterlik bir parola belirle; sonraki girişlerde sorulacak.`,
            confirm: true, ok: 'KAYDET VE GİR',
            onOk: (pw) => { p.pw = pwHash(p.id, pw); saveProfiles(); selectProfile(id); }
        });
        return;
    }
    if (id === profiles.current && profileChosenThisTab()) { closeProfiles(); return; }
    askPassword({
        title: `${p.name} · Giriş`, text: 'Parolanı yaz.', ok: 'GİRİŞ',
        onOk: (pw) => { if (!pwCheck(p, pw)) return 'Parola yanlış.'; selectProfile(id); }
    });
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
    const pw = $('newProfilePw').value;
    if (!pwValid(pw)) { note.textContent = `Parola ${PW_MIN}-${PW_MAX} karakter olmalı.`; $('newProfilePw').focus(); return; }
    const id = newProfileId();
    profiles.list.push({ id, name, pw: pwHash(id, pw) });
    selectProfile(id);
}

// Ad değiştirme, parola değiştirme ve silme için önce o oyuncunun parolası istenir
function withPassword(id, action, fn) {
    refreshProfiles();
    const p = profiles.list.find(x => x.id === id);
    if (!p) return;
    if (!p.pw) { fn(p); return; }            // parolası olmayan eski profil
    askPassword({
        title: `${p.name} · ${action}`, text: 'Devam etmek için bu oyuncunun parolasını yaz.', ok: 'DEVAM',
        onOk: (pw) => { if (!pwCheck(p, pw)) return 'Parola yanlış.'; fn(p); }
    });
}

function renameProfile(id) { withPassword(id, 'Ad değiştir', doRename); }
function deleteProfile(id) { withPassword(id, 'Sil', doDelete); }

function changePassword(id) {
    withPassword(id, 'Parola değiştir', (p) => {
        // Doğrulama penceresi kapandıktan sonra yeni parolayı sor
        setTimeout(() => askPassword({
            title: `${p.name} · Yeni parola`, text: `${PW_MIN}-${PW_MAX} karakterlik yeni parolayı yaz.`,
            confirm: true, ok: 'KAYDET',
            onOk: (pw) => {
                refreshProfiles();
                const q = profiles.list.find(x => x.id === p.id);
                if (!q) return;
                q.pw = pwHash(q.id, pw);
                saveProfiles();
                renderProfiles();
                $('profileNote').textContent = `${q.name} için parola değiştirildi.`;
            }
        }), 0);
    });
}

function doRename(p) {
    const name = cleanName(prompt('Yeni ad:', p.name));
    if (!name || name === p.name) return;
    if (nameTaken(name, p.id)) { $('profileNote').textContent = `"${name}" adı zaten kayıtlı.`; return; }
    p.name = name;
    saveProfiles();
    renderProfiles();
    updatePlayerTag();
}

function doDelete(p) {
    const id = p.id;
    if (!confirm(`"${p.name}" ve tüm kaydı (altın, silahlar, rekorlar) silinsin mi? Bu geri alınamaz.`)) return;
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

// ---- Parola penceresi (giriş ekranının üstünde) ----
let pwRequest = null;

// opts: { title, text, ok, confirm (iki kez yazdır), onOk(pw) → hata metni ya da undefined }
function askPassword(opts) {
    pwRequest = opts;
    $('pwTitle').textContent = opts.title;
    $('pwText').textContent = opts.text;
    $('pwOk').textContent = opts.ok || 'TAMAM';
    $('pwInput').value = '';
    $('pwInput2').value = '';
    $('pwInput2').style.display = opts.confirm ? '' : 'none';
    $('pwInput').placeholder = `Parola (${PW_MIN}-${PW_MAX} karakter)`;
    $('pwError').textContent = '';
    $('pwShow').checked = false;
    togglePwShow();
    $('pwBox').classList.add('show');
    setTimeout(() => $('pwInput').focus(), 0);
}

function submitPassword() {
    if (!pwRequest) return;
    const pw = $('pwInput').value;
    if (!pwValid(pw)) { $('pwError').textContent = `Parola ${PW_MIN}-${PW_MAX} karakter olmalı.`; return; }
    if (pwRequest.confirm && $('pwInput2').value !== pw) { $('pwError').textContent = 'İki parola aynı değil.'; return; }
    const req = pwRequest;
    const err = req.onOk(pw);
    if (err) { $('pwError').textContent = err; $('pwInput').select(); return; }
    if (pwRequest === req) closePassword();
}

function closePassword() {
    pwRequest = null;
    $('pwBox').classList.remove('show');
}

function togglePwShow() {
    const t = $('pwShow').checked ? 'text' : 'password';
    $('pwInput').type = t; $('pwInput2').type = t;
}
