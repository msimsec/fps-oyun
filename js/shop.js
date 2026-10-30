'use strict';

// =====================================================================
//  MAĞAZA
// =====================================================================
function openShop(from) {
    shopReturn = from;
    state = 'shop';
    showScreen('shopModal');
    updateShopModal();
}

function returnTo(from) {
    const screen = { menu: 'menuScreen', paused: 'pauseScreen', over: 'gameOverScreen' }[from] || 'menuScreen';
    state = from;
    showScreen(screen);
    updateHUD();
}

function closeShop() { returnTo(shopReturn); }

const inRun = () => shopReturn === 'paused';

function shieldStatusText() {
    if (inRun() && player.armor > 0) return `AKTİF (${Math.ceil(player.armor)})`;
    if (player.hasShield) return 'SONRAKİ ELDE HAZIR';
    return 'YOK';
}

function updateShopModal() {
    $('modalGold').textContent = player.gold;
    $('modalDmg').textContent = `${player.damage} / ${CFG.maxDamage}`;
    $('modalMag').textContent = `${player.maxAmmo} / ${CFG.maxMag}`;
    $('modalHeal').textContent = `${player.healKits} / ${CFG.maxHealKits}`;
    $('modalShield').textContent = shieldStatusText();
    $('primeStatus').textContent = player.unlockedSkins.prime ? 'SAHİPSİNİZ' : 'KİLİTLİ';
    $('reaverStatus').textContent = player.unlockedSkins.reaver ? 'SAHİPSİNİZ' : 'KİLİTLİ';
    renderSkinPicker();
    ['shotgun', 'sniper'].forEach(id => {
        $(id + 'Status').textContent = player.ownedWeapons[id] ? 'SAHİPSİNİZ' : 'KİLİTLİ';
    });
    // Yükseltme her silaha kendi çarpanıyla işler; kartta gerçek hasarları göster
    $('modalDmgDetail').textContent = WEAPON_ORDER.map(id => {
        const w = WEAPONS[id], d = Math.round(player.damage * w.dmgMul);
        return `${w.name} ${w.pellets > 1 ? w.pellets + '×' + d : d}`;
    }).join(' · ');

    // Fiyatlar CFG'den gelir; alınamayan (maksimum/sahip olunan) kalemlerin butonu durumunu yazar
    const shieldDone = inRun() ? (player.armor >= CFG.armorAmount ? 'Kalkan dolu ✓' : null)
                               : (player.hasShield ? 'Sonraki ele hazır ✓' : null);
    setBuyBtn('btnDamage', CFG.damageCost, player.damage >= CFG.maxDamage ? 'Maksimum ✓' : null);
    setBuyBtn('btnMag', CFG.magCost, player.maxAmmo >= CFG.maxMag ? 'Maksimum ✓' : null);
    setBuyBtn('btnHeal', CFG.healCost, player.healKits >= CFG.maxHealKits ? 'Çanta dolu ✓' : null);
    setBuyBtn('btnShield', CFG.shieldCost, shieldDone);
    setBuyBtn('btnShotgun', WEAPONS.shotgun.cost, player.ownedWeapons.shotgun ? 'Sahipsin ✓' : null);
    setBuyBtn('btnSniper', WEAPONS.sniper.cost, player.ownedWeapons.sniper ? 'Sahipsin ✓' : null);
    setBuyBtn('btnPrime', CFG.skinCost, player.unlockedSkins.prime ? 'Sahipsin ✓' : null);
    setBuyBtn('btnReaver', CFG.skinCost, player.unlockedSkins.reaver ? 'Sahipsin ✓' : null);
}

function setBuyBtn(id, cost, doneText) {
    const btn = $(id);
    btn.textContent = doneText || `Satın Al (${cost} Altın)`;
    btn.classList.toggle('owned', !!doneText);
    // Altını yetmeyen kalem soluk görünsün (tıklanınca yine nedenini söyler)
    btn.classList.toggle('poor', !doneText && player.gold < cost);
}

function spend(cost) {
    if (player.gold < cost) { showToast(`Yeterli altının yok! (${cost} Altın)`); return false; }
    player.gold -= cost;
    return true;
}

function afterPurchase(msg) {
    initAudio();
    sfx('buy');
    saveGameData();
    updateShopModal();
    updateHUD();
    if (msg) showToast(msg);
}

function buyDamage() {
    if (player.damage >= CFG.maxDamage) { showToast('Hasar maksimum seviyede'); return; }
    if (!spend(CFG.damageCost)) return;
    player.damage = Math.min(CFG.maxDamage, player.damage + CFG.damageStep);
    afterPurchase('Hasar artırıldı');
}

function buyAmmo() {
    if (player.maxAmmo >= CFG.maxMag) { showToast('Şarjör maksimum kapasitede'); return; }
    if (!spend(CFG.magCost)) return;
    player.maxAmmo = Math.min(CFG.maxMag, player.maxAmmo + CFG.magStep);
    afterPurchase('Şarjör kapasitesi artırıldı');
}

function buyHealKit() {
    if (player.healKits >= CFG.maxHealKits) { showToast('En fazla ' + CFG.maxHealKits + ' can kiti taşıyabilirsin'); return; }
    if (!spend(CFG.healCost)) return;
    player.healKits++;
    afterPurchase('Can kiti alındı');
}

function buyShield() {
    if (inRun()) {
        if (player.armor >= CFG.armorAmount) { showToast('Kalkanın zaten dolu'); return; }
        if (!spend(CFG.shieldCost)) return;
        player.armor = CFG.armorAmount;
        afterPurchase('Kalkan kuşanıldı (+50)');
    } else {
        if (player.hasShield) { showToast('Sonraki el için kalkanın zaten hazır'); return; }
        if (!spend(CFG.shieldCost)) return;
        player.hasShield = true;
        afterPurchase('Kalkan sonraki elin başında kuşanılacak');
    }
}

function buyWeapon(id) {
    if (!WEAPONS[id] || !WEAPONS[id].cost) return;
    if (player.ownedWeapons[id]) { showToast(`${WEAPONS[id].name} zaten sende`); return; }
    if (!spend(WEAPONS[id].cost)) return;
    player.ownedWeapons[id] = true;
    // Duraklatılmış bir elin ortasında alınırsa hemen kullanılabilsin
    player.arsenal[id] = { ammo: magSize(id), pool: WEAPONS[id].startPool };
    const key = WEAPON_ORDER.indexOf(id) + 1;
    afterPurchase(`${WEAPONS[id].name} alındı! Oyunda ${key} tuşuyla seç`);
}

function buySkin(skinName) {
    if (!SKINS.includes(skinName)) return;
    if (player.unlockedSkins[skinName]) { showToast('Bu skine zaten sahipsin'); return; }
    if (!spend(CFG.skinCost)) return;
    player.unlockedSkins[skinName] = true;
    player.activeSkin = skinName;
    updateWeaponSkinColors();
    afterPurchase('Skin açıldı ve kuşanıldı!');
}

function changeSkin(skinName) {
    if (SKINS.includes(skinName) && player.unlockedSkins[skinName]) {
        player.activeSkin = skinName;
        updateWeaponSkinColors();
        saveGameData();
        renderSkinPicker();
    } else {
        showToast('Önce bu skini satın almalısın');
    }
}

const hexColor = (n) => '#' + n.toString(16).padStart(6, '0');

// Her skin için renk örnekli bir kart: gövde, namlu/detay ve mermi rengi + durum
function renderSkinPicker() {
    $('skinPicker').innerHTML = SKINS.map(id => {
        const s = SKIN_DEFS[id];
        const owned = player.unlockedSkins[id];
        const active = player.activeSkin === id;
        const status = active ? 'SEÇİLİ ✓' : owned ? 'Seçmek için tıkla' : `KİLİTLİ · ${CFG.skinCost} altın`;
        const swatch = (c, label) => `<span class="swatch" style="background:${hexColor(c)}" title="${label}"></span>`;
        return `<button class="skin-option${active ? ' active' : ''}${owned ? '' : ' locked'}" onclick="changeSkin('${id}')">
            <span class="skin-gun">
                <span class="gun-body" style="background:${hexColor(s.body)}"></span>
                <span class="gun-barrel" style="background:${hexColor(s.accent)}"></span>
                <span class="gun-bullet" style="background:${hexColor(s.bullet)}; box-shadow: 0 0 6px ${hexColor(s.bullet)}"></span>
            </span>
            <span class="skin-name">${s.name}</span>
            <span class="swatches">${swatch(s.body, 'Gövde')}${swatch(s.accent, 'Namlu ve detaylar')}${swatch(s.bullet, 'Mermi')}</span>
            <span class="skin-status">${status}</span>
        </button>`;
    }).join('');
}
