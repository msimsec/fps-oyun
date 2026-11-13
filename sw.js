'use strict';

// =====================================================================
//  SERVİS ÇALIŞANI — oyunu "uygulama gibi" kurulabilir ve internetsiz açılabilir yapar.
//  İlk açılışta oyunun bütün dosyaları önbelleğe alınır; sonraki açılışlarda internet yoksa
//  oyun önbellekten açılır. Sayfa (index.html) her zaman önce internetten istenir: yeni sürüm
//  yayınlanınca hemen gelir. Önbellek adı sürüm anahtarıyla (?v=) değişir; eski önbellek silinir.
//  Her yayında VERSION, index.html'deki ?v= değeriyle aynı olmalı.
// =====================================================================
const VERSION = '20261113d';
const CACHE = 'fps-oyun-' + VERSION;
const FILES = [
    './',
    'index.html',
    'manifest.webmanifest',
    'three.min.js',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-512-maskable.png',
    'css/style.css?v=' + VERSION,
    'js/profiles.js?v=' + VERSION,
    'js/config.js?v=' + VERSION,
    'js/save.js?v=' + VERSION,
    'js/state.js?v=' + VERSION,
    'js/utils.js?v=' + VERSION,
    'js/audio.js?v=' + VERSION,
    'js/feedback.js?v=' + VERSION,
    'js/world.js?v=' + VERSION,
    'js/maps.js?v=' + VERSION,
    'js/input.js?v=' + VERSION,
    'js/touch.js?v=' + VERSION,
    'js/game.js?v=' + VERSION,
    'js/weapons.js?v=' + VERSION,
    'js/enemies.js?v=' + VERSION,
    'js/items.js?v=' + VERSION,
    'js/waves.js?v=' + VERSION,
    'js/records.js?v=' + VERSION,
    'js/achievements.js?v=' + VERSION,
    'js/resume.js?v=' + VERSION,
    'js/update.js?v=' + VERSION,
    'js/shop.js?v=' + VERSION,
    'js/settings.js?v=' + VERSION,
    'js/help.js?v=' + VERSION,
    'js/main.js?v=' + VERSION,
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k.startsWith('fps-oyun-') && k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
    if (req.mode === 'navigate') {
        // Sayfa: önce internet (yeni sürüm hemen gelsin), yoksa önbellekteki sayfa
        e.respondWith(fetch(req).then(res => {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('index.html', copy));
            return res;
        }).catch(() => caches.match('index.html').then(r => r || caches.match('./'))));
        return;
    }
    // Diğer dosyalar: önce önbellek (sürüm anahtarlı adresler değişmez), yoksa internet
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
    })));
});
