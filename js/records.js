'use strict';

// =====================================================================
//  REKORLAR — bölüm ve zorluk seviyesi başına en iyi skor/dalga ve düello sonuçları
//  (yalnızca bu tarayıcıda tutulur)
// =====================================================================
const RECORDS_KEY = profileKey('fps_records_v2');
const OLD_RECORDS_KEY = profileKey('fps_records_v1');   // bölüm ayrımı yokken tutulan rekorlar

function emptyDiffRecords() {
    const r = { game: {}, duel: {} };
    DIFFICULTIES.forEach(d => {
        r.game[d] = { score: 0, wave: 0, kills: 0 };
        r.duel[d] = { wins: 0, losses: 0, bestTime: 0 };
    });
    return r;
}
// Her bölümün kendi rekor tablosu: records[mapId].game[zorluk], records[mapId].duel[zorluk]
function emptyRecords() {
    return Object.fromEntries(MAP_IDS.map(id => [id, emptyDiffRecords()]));
}

function readDiffRecords(src, into) {
    if (!src || typeof src !== 'object') return;
    DIFFICULTIES.forEach(d => {
        const g = src.game && src.game[d], u = src.duel && src.duel[d];
        if (g) {
            into.game[d].score = clampInt(g.score, 0, 0, 1e9);
            into.game[d].wave = clampInt(g.wave, 0, 0, 1e6);
            into.game[d].kills = clampInt(g.kills, 0, 0, 1e9);
        }
        if (u) {
            into.duel[d].wins = clampInt(u.wins, 0, 0, 1e9);
            into.duel[d].losses = clampInt(u.losses, 0, 0, 1e9);
            into.duel[d].bestTime = Number.isFinite(u.bestTime) && u.bestTime > 0 ? u.bestTime : 0;
        }
    });
}

const records = (() => {
    const r = emptyRecords();
    let o = null;
    try { o = JSON.parse(localStorage.getItem(RECORDS_KEY)); } catch (e) {}
    if (o && typeof o === 'object') {
        MAP_IDS.forEach(id => readDiffRecords(o[id], r[id]));
    } else {
        // Eski (bölümsüz) rekorlar: o zamanlar en çok oynanan Depo'ya aktarılır
        let old = null;
        try { old = JSON.parse(localStorage.getItem(OLD_RECORDS_KEY)); } catch (e) {}
        if (old && typeof old === 'object') readDiffRecords(old, r.depot);
    }
    return r;
})();

function saveRecords() {
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

// Elin sonunda çağrılır; kırılan rekorların açıklamalarını döndürür (elin oynandığı bölüme yazılır)
function updateRecords(won) {
    const broken = [];
    const m = records[run.map] || records.depot;
    if (isDuelMode) {
        const r = m.duel[run.duel];
        if (won) {
            r.wins++;
            if (duelTime > 0 && (!r.bestTime || duelTime < r.bestTime)) {
                if (r.bestTime) broken.push('En hızlı düello');
                r.bestTime = duelTime;
            }
        } else {
            r.losses++;
        }
    } else {
        const r = m.game[run.game];
        if (player.score > r.score) { if (r.score) broken.push('En yüksek skor'); r.score = player.score; }
        if (wave.num > r.wave) { if (r.wave) broken.push('En uzak dalga'); r.wave = wave.num; }
        if (player.kills > r.kills) r.kills = player.kills;
    }
    saveRecords();
    return broken;
}

let recordsReturn = 'menu';
let recordsMap = null;          // rekor ekranında gösterilen bölüm

function openRecords(from, mapId) {
    recordsReturn = from;
    recordsMap = MAPS[mapId] ? mapId : (recordsMap || settings.map);
    state = 'records';
    showScreen('recordsScreen');
    $('recordsPlayer').textContent = currentProfile() ? currentProfile().name : '-';
    // Bölüm sekmeleri
    $('recordsTabs').innerHTML = MAP_IDS.map(id =>
        `<button class="seg-btn${id === recordsMap ? ' active map' : ''}" onclick="openRecords(recordsReturn, '${id}')">${MAPS[id].name}</button>`
    ).join('');
    const rows = DIFFICULTIES.map(d => {
        const g = records[recordsMap].game[d], u = records[recordsMap].duel[d];
        return `<tr><td class="lvl ${d}">${DIFF_LABELS[d]}</td>` +
            `<td>${g.score}</td><td>${g.wave}</td><td>${g.kills}</td>` +
            `<td>${u.wins} / ${u.losses}</td><td>${u.bestTime ? formatTime(u.bestTime) : '-'}</td></tr>`;
    }).join('');
    $('recordsBody').innerHTML = rows;
}

function closeRecords() { returnTo(recordsReturn); }

function resetRecords() {
    if (!confirm(`${MAPS[recordsMap].name} bölümünün rekorları silinsin mi?`)) return;
    records[recordsMap] = emptyDiffRecords();
    saveRecords();
    openRecords(recordsReturn);
    showToast('Rekorlar sıfırlandı');
}
