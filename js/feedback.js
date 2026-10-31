'use strict';

// =====================================================================
//  GERİ BİLDİRİM — hasar sayıları, öldürme akışı, ortadaki duyurular
// =====================================================================
const floaters = [];
const projVec = new THREE.Vector3();

// Vurulan noktada yükselip kaybolan hasar sayısı. Aynı düşmana çok kısa arayla gelen
// vuruşlar (ör. pompalının saçmaları) tek sayıda toplanır.
function showDamageNumber(enemy, amount, head) {
    const last = enemy._floater;
    if (last && last.age < 0.15 && floaters.includes(last)) {
        last.amount += amount;
        last.head = last.head || head;
        last.el.textContent = Math.round(last.amount);
        last.el.classList.toggle('head', last.head);
        return;
    }
    const el = document.createElement('div');
    el.className = 'dmg-number' + (head ? ' head' : '');
    el.textContent = Math.round(amount);
    $('floaterLayer').appendChild(el);
    const pos = enemy.group.position.clone();
    pos.y = enemy.group.position.y + 2.1 * enemy.scale;
    pos.x += (Math.random() - 0.5) * 0.6;
    const f = { el, pos, age: 0, life: 0.8, amount, head };
    floaters.push(f);
    enemy._floater = f;
}

function updateFloaters(dt) {
    for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.age += dt;
        f.pos.y += dt * 1.2;
        if (f.age >= f.life) { f.el.remove(); floaters.splice(i, 1); continue; }
        projVec.copy(f.pos).project(camera);
        if (projVec.z > 1) { f.el.style.display = 'none'; continue; }   // kameranın arkasında
        f.el.style.display = '';
        const x = (projVec.x + 1) / 2 * window.innerWidth;
        const y = (1 - projVec.y) / 2 * window.innerHeight;
        f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        f.el.style.opacity = String(1 - Math.max(0, f.age - f.life * 0.5) / (f.life * 0.5));
    }
}

function clearFloaters() {
    floaters.forEach(f => f.el.remove());
    floaters.length = 0;
}

// Sağ üstte, skor panelinin altında kısa süreli öldürme mesajları
function addKillFeed(text, highlight) {
    const feed = $('killFeed');
    const el = document.createElement('div');
    el.className = 'kill-item' + (highlight ? ' head' : '');
    el.textContent = text;
    feed.prepend(el);
    while (feed.children.length > 5) feed.lastChild.remove();
    setTimeout(() => el.classList.add('fade'), 2200);
    setTimeout(() => el.remove(), 2700);
}

function clearKillFeed() { $('killFeed').innerHTML = ''; }

// Ekranın üst ortasında büyük duyuru (dalga başladı/bitti vb.)
let bannerTimer = null;
function showBanner(title, sub = '', ms = 2200) {
    setHud('bannerTitle', title);
    setHud('bannerSub', sub);
    const b = $('banner');
    b.classList.add('show');
    clearTimeout(bannerTimer);
    if (ms > 0) bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
}
function hideBanner() { clearTimeout(bannerTimer); $('banner').classList.remove('show'); }

function updateDuelBar() {
    const bar = $('duelBar');
    if (!isDuelMode || !duelBot) { bar.classList.remove('show'); return; }
    bar.classList.add('show');
    const frac = Math.max(0, duelBot.health / duelBot.maxHealth);
    $('duelBarFill').style.width = (frac * 100).toFixed(1) + '%';
    setHud('duelBarText', `BOT ${Math.max(0, Math.ceil(duelBot.health))} / ${duelBot.maxHealth}`);
}

// =====================================================================
//  HASAR YÖNÜ — vurulunca nişangâhın çevresinde, atışın geldiği yönü gösteren kırmızı yay.
//  Oyuncu dönünce yay da döner (kaynak noktası dünyada sabit tutulur).
// =====================================================================
const hitDirs = [];
const HIT_DIR_LIFE = 1.2;

function showHitDirection(x, z) {
    // Aynı yerden gelen hasar (yakın temas her kare) yeni yay açmasın, eskisini tazelesin
    const near = hitDirs.find(h => Math.hypot(h.x - x, h.z - z) < 2);
    if (near) { near.age = 0; near.x = x; near.z = z; return; }
    if (hitDirs.length >= 6) { hitDirs[0].el.remove(); hitDirs.shift(); }
    const el = document.createElement('div');
    el.className = 'hit-dir';
    $('hitDirLayer').appendChild(el);
    hitDirs.push({ x, z, age: 0, el });
}

function updateHitDirections(dt) {
    const cx = camera.position.x, cz = camera.position.z;
    const fx = -Math.sin(cameraAngleY), fz = -Math.cos(cameraAngleY);   // bakış yönü
    const rx = Math.cos(cameraAngleY), rz = -Math.sin(cameraAngleY);    // sağ
    for (let i = hitDirs.length - 1; i >= 0; i--) {
        const h = hitDirs[i];
        h.age += dt;
        if (h.age >= HIT_DIR_LIFE) { h.el.remove(); hitDirs.splice(i, 1); continue; }
        const dx = h.x - cx, dz = h.z - cz;
        const a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);       // 0 = önde, + = sağda
        h.el.style.transform = `translate(-50%, -50%) rotate(${a}rad)`;
        h.el.style.opacity = String(Math.min(1, 2 * (1 - h.age / HIT_DIR_LIFE)));
    }
}

function clearHitDirections() {
    hitDirs.forEach(h => h.el.remove());
    hitDirs.length = 0;
}
