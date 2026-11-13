'use strict';

document.body.classList.add('in-menu');   // ilk açılışta ana menü gösteriliyor
init();
initTouch();
updateMobileNote();
updateDifficultyInfo();
updatePlayerTag();
// Bu sekmede henüz giriş yapılmadıysa (ya da hiç oyuncu yoksa) önce "Kim oynuyor?" ekranı
if (needsLogin()) openProfiles();
updateResumeButton();

// ---- Uygulama olarak kurma (PWA) ----
// Servis çalışanı oyunun dosyalarını önbelleğe alır: bir kez açıldıktan sonra internetsiz de açılır.
// (Yalnızca https ya da localhost'ta çalışır; dosyadan açılınca sessizce atlanır.)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
// Tarayıcı kurmayı önerebiliyorsa (Chrome, Edge) menüde YÜKLE butonu çıkar
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    $('installBtn').style.display = '';
});
window.addEventListener('appinstalled', () => {
    installPrompt = null;
    $('installBtn').style.display = 'none';
    showToast('Oyun uygulama olarak yüklendi 📲');
});
function installApp() {
    if (!installPrompt) { showToast('Bu tarayıcı yüklemeyi desteklemiyor ya da oyun zaten yüklü'); return; }
    installPrompt.prompt();
    installPrompt.userChoice.finally(() => { installPrompt = null; $('installBtn').style.display = 'none'; });
}

// Tarayıcı/sekme kapatılırken (ya da sayfa yenilenirken) o anki el kaybolmasın:
// dalga modunda skor ve ulaşılan dalga rekorlara işlenir, altın ve diğer kayıtlar yazılır.
// (Düello yarıda bırakılırsa galibiyet ya da mağlubiyet sayılmaz — ana menüye dönmekle aynı.)
window.addEventListener('pagehide', () => {
    if (profileDeleted) return;                  // oynayan oyuncu az önce silindi
    try {
        if (run.active && !isDuelMode) { updateRecords(false); saveRunSnapshot(); }   // DEVAM ET için
        saveGameData();
    } catch (e) { /* kapanırken hata çıkarsa yapılacak bir şey yok */ }
});
