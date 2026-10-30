'use strict';

// =====================================================================
//  REKORLAR — zorluk seviyesi başına en iyi skor/dalga ve düello sonuçları
//  (yalnızca bu tarayıcıda tutulur)
// =====================================================================
const RECORDS_KEY = profileKey('fps_records_v1');

function emptyRecords() {
    const r = { game: {}, duel: {} };
    DIFFICULTIES.forEach(d => {
        r.game[d] = { score: 0, wave: 0, kills: 0 };
        r.duel[d] = { wins: 0, losses: 0, bestTime: 0 };
    });
    return r;
}

const records = (() => {
    const r = emptyRecords();
    let o = null;
    try { o = JSON.parse(localStorage.getItem(RECORDS_KEY)); } catch (e) {}
    if (o && typeof o === 'object') {
        DIFFICULTIES.forEach(d => {
            const g = o.game && o.game[d], u = o.duel && o.duel[d];
            if (g) {
                r.game[d].score = clampInt(g.score, 0, 0, 1e9);
                r.game[d].wave = clampInt(g.wave, 0, 0, 1e6);
                r.game[d].kills = clampInt(g.kills, 0, 0, 1e9);
            }
            if (u) {
                r.duel[d].wins = clampInt(u.wins, 0, 0, 1e9);
                r.duel[d].losses = clampInt(u.losses, 0, 0, 1e9);
                r.duel[d].bestTime = Number.isFinite(u.bestTime) && u.bestTime > 0 ? u.bestTime : 0;
            }
        });
    }
    return r;
})();

function saveRecords() {
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

// Elin sonunda çağrılır; kırılan rekorların açıklamalarını döndürür
function updateRecords(won) {
    const broken = [];
    if (isDuelMode) {
        const r = records.duel[run.duel];
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
        const r = records.game[run.game];
        if (player.score > r.score) { if (r.score) broken.push('En yüksek skor'); r.score = player.score; }
        if (wave.num > r.wave) { if (r.wave) broken.push('En uzak dalga'); r.wave = wave.num; }
        if (player.kills > r.kills) r.kills = player.kills;
    }
    saveRecords();
    return broken;
}

let recordsReturn = 'menu';

function openRecords(from) {
    recordsReturn = from;
    state = 'records';
    showScreen('recordsScreen');
    const rows = DIFFICULTIES.map(d => {
        const g = records.game[d], u = records.duel[d];
        return `<tr><td class="lvl ${d}">${DIFF_LABELS[d]}</td>` +
            `<td>${g.score}</td><td>${g.wave}</td><td>${g.kills}</td>` +
            `<td>${u.wins} / ${u.losses}</td><td>${u.bestTime ? formatTime(u.bestTime) : '-'}</td></tr>`;
    }).join('');
    $('recordsBody').innerHTML = rows;
}

function closeRecords() { returnTo(recordsReturn); }

function resetRecords() {
    if (!confirm('Tüm rekorlar silinsin mi?')) return;
    Object.assign(records, emptyRecords());
    saveRecords();
    openRecords(recordsReturn);
    showToast('Rekorlar sıfırlandı');
}
