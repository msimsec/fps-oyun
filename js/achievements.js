'use strict';

// =====================================================================
//  BAŞARIMLAR — her biri bir kez açılır ve altın ödülü verir (profil başına saklanır).
//  check(): şu anki oyun durumuna bakarak koşulun sağlanıp sağlanmadığını söyler.
//  progress(): (isteğe bağlı) ekranda gösterilen ilerleme [şimdiki, hedef].
// =====================================================================
const ACH_KEY = profileKey('fps_achievements_v1');
const GEZGIN_WAVE = 3;

const ach = (() => {
    const a = { done: {}, totalKills: 0, mapsReached: {} };
    let o = null;
    try { o = JSON.parse(localStorage.getItem(ACH_KEY)); } catch (e) {}
    if (o && typeof o === 'object') {
        if (o.done && typeof o.done === 'object') Object.keys(o.done).forEach(k => { if (o.done[k] === true) a.done[k] = true; });
        a.totalKills = clampInt(o.totalKills, 0, 0, 1e9);
        if (o.mapsReached && typeof o.mapsReached === 'object') {
            MAP_IDS.forEach(id => { if (o.mapsReached[id] === true) a.mapsReached[id] = true; });
        }
    }
    return a;
})();

function saveAchievements() {
    try { localStorage.setItem(ACH_KEY, JSON.stringify(ach)); } catch (e) {}
}

const inWaves = () => run.active && !isDuelMode;
const ACHIEVEMENTS = [
    { id: 'firstBlood', name: 'İlk Kan', desc: 'İlk düşmanını vur', reward: 25,
      check: () => ach.totalKills >= 1 },
    { id: 'headHunter', name: 'Kafa Avcısı', desc: 'Tek elde 10 kafa vuruşu yap', reward: 150,
      check: () => run.active && player.headshots >= 10, progress: () => [run.active ? player.headshots : 0, 10] },
    { id: 'survivor', name: 'Hayatta Kalan', desc: '5. dalgaya ulaş', reward: 150,
      check: () => inWaves() && wave.num >= 5 },
    { id: 'waveMaster', name: 'Dalga Ustası', desc: '10. dalgaya ulaş', reward: 400,
      check: () => inWaves() && wave.num >= 10 },
    { id: 'ironHeart', name: 'Demir Yürek', desc: 'Zor seviyede 5. dalgaya ulaş', reward: 300,
      check: () => inWaves() && run.game === 'hard' && wave.num >= 5 },
    { id: 'untouchable', name: 'Dokunulmaz', desc: 'Bir dalgayı hiç hasar almadan bitir', reward: 200,
      check: () => runStats.cleanWave === true },
    { id: 'bomber', name: 'Bombacı', desc: 'Tek bombayla 3 düşman öldür', reward: 200,
      check: () => runStats.bestBlast >= 3 },
    { id: 'collector', name: 'Toplayıcı', desc: 'Tek elde yerden 10 eşya topla', reward: 150,
      check: () => runStats.pickups >= 10, progress: () => [run.active ? runStats.pickups : 0, 10] },
    { id: 'duelist', name: 'Düellocu', desc: 'Bir düello kazan', reward: 150,
      check: () => runStats.duelWon === true },
    { id: 'champion', name: 'Şampiyon', desc: 'Zor seviyede düello kazan', reward: 400,
      check: () => runStats.duelWon === true && run.duel === 'hard' },
    { id: 'lightning', name: 'Şimşek', desc: 'Düelloyu 30 saniyeden kısa sürede kazan', reward: 250,
      check: () => runStats.duelWon === true && duelTime < 30 },
    { id: 'army', name: 'Tek Kişilik Ordu', desc: 'Toplam 250 düşman vur', reward: 300,
      check: () => ach.totalKills >= 250, progress: () => [Math.min(ach.totalKills, 250), 250] },
    { id: 'traveler', name: 'Gezgin', desc: `Her bölümde ${GEZGIN_WAVE}. dalgaya ulaş`, reward: 300,
      check: () => MAP_IDS.every(id => ach.mapsReached[id]),
      progress: () => [MAP_IDS.filter(id => ach.mapsReached[id]).length, MAP_IDS.length] }
];

// Oyun olaylarından sonra çağrılır (öldürme, dalga, düello, toplama, patlama)
function checkAchievements() {
    if (inWaves() && wave.num >= GEZGIN_WAVE && !ach.mapsReached[run.map]) {
        ach.mapsReached[run.map] = true;
        saveAchievements();
    }
    const unlocked = ACHIEVEMENTS.filter(a => !ach.done[a.id] && a.check());
    if (!unlocked.length) return;
    unlocked.forEach(a => {
        ach.done[a.id] = true;
        player.gold += a.reward;
        player.goldEarned += a.reward;
        addKillFeed(`🎖️ BAŞARIM: ${a.name} · +${a.reward} 🪙`, true);
    });
    showToast(`🎖️ Başarım açıldı: ${unlocked.map(a => a.name).join(', ')}`);
    sfx('achievement');
    saveAchievements();
    saveGameData();
}

// Düşman öldürüldüğünde (toplam sayaç profil boyunca tutulur)
function achKill() {
    ach.totalKills++;
    saveAchievements();
    checkAchievements();
}

// ---- Başarımlar ekranı ----
let achievementsReturn = 'menu';

function openAchievements(from) {
    achievementsReturn = from;
    state = 'achievements';
    showScreen('achievementsScreen');
    const doneCount = ACHIEVEMENTS.filter(a => ach.done[a.id]).length;
    $('achSummary').textContent = `${doneCount} / ${ACHIEVEMENTS.length} açıldı`;
    $('achList').innerHTML = ACHIEVEMENTS.map(a => {
        const done = !!ach.done[a.id];
        let prog = '';
        if (!done && a.progress) {
            const [cur, goal] = a.progress();
            prog = `<span class="ach-progress"><span style="width:${Math.min(100, cur / goal * 100).toFixed(0)}%"></span></span>
                    <span class="ach-progress-text">${cur} / ${goal}</span>`;
        }
        return `<div class="ach-card${done ? ' done' : ''}">
            <div class="ach-name">${done ? '✓ ' : ''}${a.name}</div>
            <div class="ach-desc">${a.desc}</div>
            ${prog}
            <div class="ach-reward">${done ? 'Alındı' : 'Ödül'}: ${a.reward} 🪙</div>
        </div>`;
    }).join('');
}

function closeAchievements() { returnTo(achievementsReturn); }
