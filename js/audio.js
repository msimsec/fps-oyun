'use strict';

// =====================================================================
//  SES — Web Audio ile anlık üretilen efektler (ses dosyası gerekmez).
//  Tarayıcılar sesi ancak bir kullanıcı tıklamasından sonra açtığı için
//  initAudio() oyun başlatma butonlarından çağrılır.
// =====================================================================
let audioCtx = null, masterGain = null, noiseBuffer = null;
let lastHurtSfx = 0;

function initAudio() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
        audioCtx = new AC();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = settings.volume;
        masterGain.connect(audioCtx.destination);
        noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) { audioCtx = null; }
}

function setMasterVolume(v) { if (masterGain) masterGain.gain.value = v; }

// Tek bir ton: frekans (isteğe bağlı kayarak), dalga tipi, süre, ses düzeyi, gecikme
function tone(freq, dur, type = 'square', vol = 0.2, freqEnd = null, delay = 0) {
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur + 0.02);
}

// Filtrelenmiş gürültü patlaması (silah sesleri, şarjör tıkırtıları)
function noise(dur, vol = 0.3, freq = 2000, type = 'lowpass', freqEnd = null, delay = 0) {
    const t = audioCtx.currentTime + delay;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(masterGain);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}

const SFX = {
    shoot_rifle: () => { noise(0.09, 0.35, 3000, 'lowpass', 600); tone(150, 0.06, 'square', 0.12, 60); },
    shoot_pistol: () => { noise(0.07, 0.3, 4000, 'lowpass', 900); tone(220, 0.05, 'square', 0.12, 90); },
    shoot_shotgun: () => { noise(0.3, 0.6, 2000, 'lowpass', 250); tone(90, 0.2, 'sawtooth', 0.25, 40); },
    shoot_sniper: () => { noise(0.45, 0.6, 5000, 'lowpass', 300); tone(110, 0.35, 'sawtooth', 0.25, 35); },
    enemyShoot: (v = 1) => { noise(0.08, 0.14 * v, 1400, 'bandpass', 500); },
    hit: () => tone(950, 0.04, 'square', 0.08),
    head: () => { tone(1500, 0.05, 'triangle', 0.18); tone(2200, 0.08, 'triangle', 0.12, null, 0.04); },
    kill: () => { tone(520, 0.08, 'triangle', 0.2); tone(780, 0.12, 'triangle', 0.2, null, 0.07); },
    killHead: () => { tone(660, 0.08, 'triangle', 0.22); tone(990, 0.08, 'triangle', 0.22, null, 0.07); tone(1320, 0.14, 'triangle', 0.2, null, 0.14); },
    hurt: () => { tone(140, 0.16, 'sawtooth', 0.22, 60); noise(0.1, 0.15, 600); },
    reload: () => { noise(0.04, 0.25, 3500, 'highpass'); noise(0.05, 0.25, 2500, 'highpass', null, 0.25); },
    empty: () => tone(320, 0.03, 'square', 0.12),
    switch: () => noise(0.05, 0.2, 3000, 'highpass'),
    jump: () => tone(260, 0.08, 'sine', 0.08, 380),
    land: () => noise(0.06, 0.12, 400),
    heal: () => { tone(440, 0.1, 'sine', 0.2, 660); tone(660, 0.15, 'sine', 0.2, 990, 0.1); },
    buy: () => { tone(880, 0.06, 'triangle', 0.15); tone(1320, 0.1, 'triangle', 0.15, null, 0.06); },
    waveStart: () => { tone(330, 0.15, 'square', 0.15); tone(440, 0.15, 'square', 0.15, null, 0.15); tone(660, 0.3, 'square', 0.15, null, 0.3); },
    waveClear: () => { tone(523, 0.12, 'triangle', 0.2); tone(659, 0.12, 'triangle', 0.2, null, 0.12); tone(784, 0.25, 'triangle', 0.2, null, 0.24); },
    win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, null, i * 0.13)); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.15, null, i * 0.18)); }
};

function sfx(name, arg) {
    if (!audioCtx || !masterGain || settings.volume <= 0 || !SFX[name]) return;
    if (name === 'hurt') {   // yakın temas hasarı her kare gelir; sesi seyrekleştir
        const now = audioCtx.currentTime;
        if (now - lastHurtSfx < 0.3) return;
        lastHurtSfx = now;
    }
    try { SFX[name](arg); } catch (e) { /* ses hatası oyunu durdurmasın */ }
}
