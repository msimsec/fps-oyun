'use strict';

init();
updateDifficultyInfo();
updatePlayerTag();
// Bu sekmede henüz giriş yapılmadıysa (ya da hiç oyuncu yoksa) önce "Kim oynuyor?" ekranı
if (needsLogin()) openProfiles();
