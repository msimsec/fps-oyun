'use strict';

// =====================================================================
//  KAYIT (localStorage) — güvenli okuma, doğrulama, sağlama toplamı
//  Not: İstemci tarafında tutulan veri her zaman değiştirilebilir. Buradaki
//  sağlama toplamı sadece konsoldan "elle" yapılan basit değişiklikleri
//  geçersiz kılar; gerçek koruma (ör. skor tablosu) sunucu doğrulaması ister.
// =====================================================================
const SAVE_KEY = profileKey('fps_save_v2');
const SAVE_SALT = 'tfps-7c1e';

function sGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function sSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* gizli mod / engelli depolama */ } }
function sDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

function hashStr(str) { // cyrb53
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

function clampInt(v, def, min, max) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, n));
}

function defaultSave() {
    return {
        gold: 0, damage: CFG.baseDamage, maxAmmo: CFG.baseMag, healKits: 0,
        hasShield: false, activeSkin: 'classic',
        unlockedSkins: Object.fromEntries(SKINS.map(id => [id, id === 'classic'])),
        upgrades: Object.fromEntries(UPGRADE_IDS.map(id => [id, 0])),
        weapons: { shotgun: false, sniper: false }   // tüfek ve tabanca her zaman açık
    };
}

function sanitizeSave(o) {
    const d = defaultSave();
    if (!o || typeof o !== 'object') return d;
    const skins = (o.unlockedSkins && typeof o.unlockedSkins === 'object') ? o.unlockedSkins : {};
    const ups = (o.upgrades && typeof o.upgrades === 'object') ? o.upgrades : {};
    const weapons = (o.weapons && typeof o.weapons === 'object') ? o.weapons : {};
    const s = {
        gold: clampInt(o.gold, 0, 0, 1000000),
        damage: clampInt(o.damage, d.damage, CFG.baseDamage, CFG.maxDamage),
        maxAmmo: clampInt(o.maxAmmo, d.maxAmmo, CFG.baseMag, CFG.maxMag),
        healKits: clampInt(o.healKits, 0, 0, CFG.maxHealKits),
        hasShield: o.hasShield === true,
        activeSkin: SKINS.includes(o.activeSkin) ? o.activeSkin : 'classic',
        unlockedSkins: Object.fromEntries(SKINS.map(id => [id, id === 'classic' || skins[id] === true])),
        upgrades: Object.fromEntries(UPGRADE_IDS.map(id => [id, clampInt(ups[id], 0, 0, UPGRADES[id].max)])),
        weapons: { shotgun: weapons.shotgun === true, sniper: weapons.sniper === true }
    };
    if (!s.unlockedSkins[s.activeSkin]) s.activeSkin = 'classic';
    return s;
}

function writeSave(s) {
    const data = JSON.stringify(s);
    sSet(SAVE_KEY, JSON.stringify({ d: data, h: hashStr(SAVE_SALT + data) }));
}

function loadSave() {
    const raw = sGet(SAVE_KEY);
    if (raw) {
        try {
            const wrap = JSON.parse(raw);
            if (wrap && typeof wrap.d === 'string' && wrap.h === hashStr(SAVE_SALT + wrap.d)) {
                return sanitizeSave(JSON.parse(wrap.d));
            }
        } catch (e) { /* bozuk kayıt → varsayılan */ }
        return defaultSave(); // değiştirilmiş veya bozuk kayıt
    }
    // Eski sürümden (val_* anahtarları) tek seferlik taşıma
    if (sGet('val_gold') !== null) {
        let skins = null;
        try { skins = JSON.parse(sGet('val_unlockedSkins')); } catch (e) {}
        const migrated = sanitizeSave({
            gold: sGet('val_gold'), damage: sGet('val_damage'), maxAmmo: sGet('val_maxAmmo'),
            healKits: sGet('val_healKits'), hasShield: sGet('val_hasShield') === 'true',
            activeSkin: sGet('val_skin'), unlockedSkins: skins
        });
        writeSave(migrated);   // eski anahtarlar silinmeden önce yeni kayıt yazılsın
        ['val_gold', 'val_damage', 'val_maxAmmo', 'val_ammoPool', 'val_healKits',
         'val_hasShield', 'val_skin', 'val_unlockedSkins'].forEach(sDel);
        return migrated;
    }
    return defaultSave();
}

const save = loadSave();
