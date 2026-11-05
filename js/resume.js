'use strict';

// =====================================================================
//  YARIM KALAN EL — dalga modunda o anki el (bölüm, dalga, can, kalkan, skor, cephane, konum,
//  sahadaki düşmanlar ve yerdeki eşyalar) birkaç saniyede bir ve oyundan çıkarken kaydedilir.
//  Ana menüdeki DEVAM ET butonu eli kaldığı yerden sürdürür. El bitince (ölünce) kayıt silinir.
//  Düello kaydedilmez. Kayıt oyuncuya özeldir.
// =====================================================================
const RUN_KEY = profileKey('fps_run_v1');
let runSaveTimer = 0;

const finite = (v, d = 0) => (Number.isFinite(v) ? v : d);
const ammoOut = (v) => (v === Infinity ? null : v);           // JSON'da Infinity tutulamaz

function loadRunSnapshot() {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(RUN_KEY)); } catch (e) {}
    if (!o || o.v !== 1 || !MAPS[o.map] || !DIFFICULTIES.includes(o.game) || !o.wave || !o.player) return null;
    return o;
}

function clearRunSnapshot() {
    try { localStorage.removeItem(RUN_KEY); } catch (e) {}
    updateResumeButton();
}

// Yalnızca dalga modunda, el sürerken (oyunda, duraklatılmış ya da el içi mağazadayken)
function saveRunSnapshot() {
    if (!run.active || isDuelMode || !['playing', 'paused', 'shop', 'settings', 'records', 'starting', 'achievements', 'help'].includes(state)) return;
    const c = camera.position;
    const snap = {
        v: 1, t: Date.now(), map: run.map, game: run.game,
        wave: { num: wave.num, toSpawn: wave.toSpawn, breakTimer: wave.breakTimer, inBreak: wave.inBreak, hurt: wave.hurt },
        player: {
            health: player.health, armor: player.armor, score: player.score, kills: player.kills,
            headshots: player.headshots, goldEarned: player.goldEarned, grenades: player.grenades,
            weapon: player.weapon, platform: player.platform
        },
        arsenal: Object.fromEntries(WEAPON_ORDER.filter(id => player.arsenal[id]).map(id =>
            [id, [ammoOut(player.arsenal[id].ammo), ammoOut(player.arsenal[id].pool)]])),
        cam: [c.x, c.y, c.z, cameraAngleY, cameraAngleX],
        stats: { pickups: runStats.pickups, bestBlast: runStats.bestBlast, cleanWave: runStats.cleanWave },
        enemies: enemies.filter(e => !e.isDuel).map(e => {
            const p = e.group.position;
            return [e.typeId, p.x, p.y, p.z, e.health, e.maxHealth, e.speed, Object.keys(e.skills || {})];
        }),
        drops: drops.map(d => [d.type, d.weapon, d.amount, d.mesh.position.x, d.baseY, d.mesh.position.z, d.life])
    };
    try { localStorage.setItem(RUN_KEY, JSON.stringify(snap)); } catch (e) {}
}

// Oyun döngüsünden: oynarken 5 saniyede bir kaydet (tarayıcı çökse bile en fazla birkaç saniye kaybolur)
function tickRunSave(dt) {
    if (!run.active || isDuelMode) return;
    runSaveTimer -= dt;
    if (runSaveTimer <= 0) { runSaveTimer = 5; saveRunSnapshot(); }
}

function updateResumeButton() {
    const btn = $('resumeBtn'), info = $('resumeInfo');
    if (!btn) return;
    const s = loadRunSnapshot();
    btn.style.display = s ? '' : 'none';
    info.style.display = s ? '' : 'none';
    if (s) {
        info.textContent = `Yarım kalan el: ${MAPS[s.map].name} · ${DIFF_LABELS[s.game]} · Dalga ${s.wave.num || 1} · Skor ${finite(s.player.score)}`;
    }
}

// Ana menüdeki OYUNA BAŞLA: yarım kalan el varsa önce sor (yeni el başlarsa eski kayıt silinir)
function startNewRun() {
    const s = loadRunSnapshot();
    if (!s) { startRun(false); return; }
    askDialog({
        title: 'Yarım kalan elin var',
        text: `${MAPS[s.map].name} · ${DIFF_LABELS[s.game]} · Dalga ${s.wave.num || 1} · Skor ${finite(s.player.score)}. ` +
              'Yeni el başlatırsan bu kayıt silinir. Kaldığın yerden sürdürmek için DEVAM ET\'e bas.',
        ok: 'YENİ EL BAŞLAT', danger: true,
        onOk: () => { clearRunSnapshot(); setTimeout(() => startRun(false), 0); }
    });
}

function resumeRun() {
    const s = loadRunSnapshot();
    if (!s) { updateResumeButton(); return; }
    initAudio();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    // Elin bölümü ve zorluğuyla kur (zorluk ayarı yalnızca bu el için; menüdeki seçim değişmez)
    const prevGame = settings.game;
    settings.game = s.game;
    if (settings.map !== s.map) { settings.map = s.map; saveSettings(); }
    resetWorld(false);
    settings.game = prevGame;
    updateDifficultyInfo();

    const P = s.player;
    player.health = Math.min(player.maxHealth, Math.max(1, finite(P.health, player.maxHealth)));
    player.armor = Math.min(CFG.armorAmount, Math.max(0, finite(P.armor)));
    player.score = Math.max(0, Math.floor(finite(P.score)));
    player.kills = Math.max(0, Math.floor(finite(P.kills)));
    player.headshots = Math.max(0, Math.floor(finite(P.headshots)));
    player.goldEarned = Math.max(0, Math.floor(finite(P.goldEarned)));
    player.grenades = Math.min(CFG.grenadeMax, Math.max(0, Math.floor(finite(P.grenades))));
    player.platform = Math.floor(finite(P.platform));
    Object.entries(s.arsenal || {}).forEach(([id, v]) => {
        if (!WEAPONS[id] || !player.arsenal[id] || !Array.isArray(v)) return;
        const inf = WEAPONS[id].startPool === Infinity;
        player.arsenal[id].ammo = v[0] === null ? magSize(id) : Math.min(magSize(id), Math.max(0, Math.floor(finite(v[0]))));
        player.arsenal[id].pool = inf ? Infinity : Math.max(0, Math.floor(finite(v[1])));
    });
    if (WEAPONS[P.weapon] && player.ownedWeapons[P.weapon]) showWeapon(P.weapon);

    const W = s.wave;
    wave.num = Math.max(0, Math.floor(finite(W.num)));
    wave.toSpawn = Math.max(0, Math.floor(finite(W.toSpawn)));
    wave.breakTimer = Math.max(0, finite(W.breakTimer, 2));
    wave.inBreak = !!W.inBreak;
    wave.hurt = !!W.hurt;
    if (s.stats) {
        runStats.pickups = Math.max(0, Math.floor(finite(s.stats.pickups)));
        runStats.bestBlast = Math.max(0, Math.floor(finite(s.stats.bestBlast)));
        runStats.cleanWave = !!s.stats.cleanWave;
    }

    // Konum: duvarın içine düşmüyorsa kaydedilen yer, yoksa bölümün başlangıç noktası
    const [x, y, z, ay, ax] = (s.cam || []).map(v => finite(v, NaN));
    if ([x, y, z].every(Number.isFinite) && overlapDepth(x, z, CFG.playerRadius, y - CFG.eyeHeight) === 0) {
        camera.position.set(x, y, z);
        player.onGround = false;                         // altındaki zemine kendiliğinden oturur
    }
    if (Number.isFinite(ay)) cameraAngleY = ay;
    if (Number.isFinite(ax)) cameraAngleX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, ax));
    applyCameraRotation();

    // Sahadaki düşmanlar: tipi, konumu, canı, hızı ve yetenekleriyle
    (s.enemies || []).slice(0, 40).forEach(r => {
        if (!Array.isArray(r) || !ENEMY_TYPES[r[0]]) return;
        const [type, ex, ey, ez, h, mh, sp, skills] = r;
        if (![ex, ey, ez, h, mh].every(Number.isFinite) || h <= 0) return;
        const e = new HumanoidEnemy(ex, ez, false, 1, 1, type);
        e.group.position.y = ey;
        e.maxHealth = Math.max(1, mh);
        e.health = Math.min(e.maxHealth, h);
        if (Number.isFinite(sp) && sp > 0) e.speed = sp;
        e.skills = {};
        (Array.isArray(skills) ? skills : []).forEach(k => { if (ENEMY_SKILLS.some(q => q.id === k)) e.skills[k] = true; });
        e.shootTimer = e.nextFireDelay();
        if (e.health < e.maxHealth) {                    // can çubuğunu göster
            const frac = e.health / e.maxHealth;
            e.hpBar.visible = true;
            e.hpFill.scale.x = Math.max(0.001, frac);
            e.hpFill.position.x = -0.45 * (1 - frac);
            e.hpFill.material = frac > 0.6 ? MAT.hpHigh : frac > 0.3 ? MAT.hpMid : MAT.hpLow;
        }
        enemies.push(e);
    });
    // Yerdeki eşyalar
    (s.drops || []).slice(0, 15).forEach(r => {
        if (!Array.isArray(r) || !DROP_TYPES[r[0]]) return;
        const [type, weapon, , dx, dy, dz, life] = r;
        if (![dx, dy, dz].every(Number.isFinite)) return;
        if (type === 'ammo' && !(AMMO_INFO[weapon] && player.ownedWeapons[weapon])) return;
        spawnDrop(type, dx, dy, dz, weapon);
        if (Number.isFinite(life)) drops[drops.length - 1].life = Math.max(1, Math.min(CFG.dropLife, life));
    });

    if (wave.num > 0) showBanner(`DALGA ${wave.num}`, 'Kaldığın yerden devam', 1800);
    updateHUD();
    hideAllScreens();
    state = 'starting';
    requestLock();
}
