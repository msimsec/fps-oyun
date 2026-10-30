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
    $('skinSelect').value = player.activeSkin;
}

function spend(cost) {
    if (player.gold < cost) { showToast(`Yeterli altının yok! (${cost} Altın)`); return false; }
    player.gold -= cost;
    return true;
}

function afterPurchase(msg) {
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
    } else {
        showToast('Önce bu skini satın almalısın');
        $('skinSelect').value = player.activeSkin;
    }
}
