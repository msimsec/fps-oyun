'use strict';

document.body.classList.add('in-menu');   // ilk açılışta ana menü gösteriliyor
init();
updateDifficultyInfo();
updatePlayerTag();
// Bu sekmede henüz giriş yapılmadıysa (ya da hiç oyuncu yoksa) önce "Kim oynuyor?" ekranı
if (needsLogin()) openProfiles();
updateResumeButton();

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
