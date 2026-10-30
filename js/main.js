'use strict';

document.body.classList.add('in-menu');   // ilk açılışta ana menü gösteriliyor
init();
updateDifficultyInfo();
updatePlayerTag();
// Bu sekmede henüz giriş yapılmadıysa (ya da hiç oyuncu yoksa) önce "Kim oynuyor?" ekranı
if (needsLogin()) openProfiles();
