# 3D Tactical FPS (v1.4)

Tarayıcıda çalışan, Three.js ile yazılmış birinci şahıs nişancı oyunu. Kurulum veya derleme gerektirmez.

**Oyna:** https://msimsec.github.io/fps-oyun/

## Oyuncu girişi

Oyun açılınca **"Kim oynuyor?"** ekranı gelir. Herkes adını yazıp kayıt olur; her oyuncunun altını, silahları, skinleri, yükseltmeleri, rekorları ve ayarları ayrı tutulur. Menüdeki **Oyuncu değiştir** ile geçiş yapılır. Parola yoktur ve kayıtlar yalnızca o tarayıcıda saklanır (en fazla 20 oyuncu).

## Bölümler

Ana menüdeki **BÖLÜM SEÇ** kısmından oynanacak harita seçilir (seçim oyuncuya özel kaydedilir):

- **Depo:** Tuğla duvarlı kapalı alan, kasalar ve siperler.
- **Çöl:** Kum taşı evlerden oluşan bir kasaba. Ortada kuyulu ve gölgelikli tezgâhlı bir pazar meydanı, kuzey-güney ana cadde, iki yanda dar sokaklar, altından geçilen kemerler, palmiyeler ve basamaklarla çatısına çıkılan bir gözetleme evi var.
- **Kar Üssü:** Karlı bir dağdaki askerî üs. Kuzeyde komuta binası, iki yanda kışlalar, ortada açık avlu ve renkli konteyner yığınları, batıda yakıt tankları, doğuda basamaklarla çıkılan gözetleme kulesi; sürekli kar yağar.
- **Space:** Uzay boşluğunda yüzen 6 platform. Platformlar arası yürünemez; turuncu **zıplatma rampaları** oyuncuyu karşı platforma fırlatır. Platformdan düşen 35 can kaybeder ve başlangıç platformuna döner. Düşmanlar platformlarından ayrılmaz, uzaktan ateş eder. Yüksek nişancı kulesine kuzey platformundaki rampayla çıkılır.

## Oyun modları

- **Dalga modu:** Düşmanlar dalgalar halinde gelir. Her dalga bir öncekinden kalabalık ve güçlüdür. Dalga temizlenince bonus altın ve skor verilir, kısa bir moladan sonra sıradaki dalga başlar.
- **1v1 Düello:** Sağa sola kayan ve sürekli ateş eden mor bota karşı teke tek. Botun canı ekranın üstündeki çubukta görünür.

Dalga modunda 4 düşman tipi vardır: **Er** (kırmızı), **Koşucu** (turuncu, hızlı ama zayıf, 2. dalgadan itibaren), **Nişancı** (mavi, uzakta durup isabetli ateş eder, 3. dalgadan itibaren) ve **Zırhlı** (gri, iri, çok dayanıklı, 2.5 kat ödül, 4. dalgadan itibaren).

Dalgalar ilerledikçe düşmanlar yetenek kazanır: **2. dalga** zıplama (alçak kasa ve siperlerin üstüne çıkar, kasaya çıkan oyuncunun yanına zıplar), **3. dalga** rampa kullanma (Space'te oyuncunun platformuna en kısa rampa yoluyla gelir), **4. dalga** vurulunca yana kaçma, **5. dalga** keskin nişan (daha isabetli ve sık ateş). Yeni yetenek dalga başında duyurulur.

**Can yenilenmesi (dalga modu):** Bir süre hasar almazsan can kendiliğinden dolar; can göstergesi yeşil parlar ve kısa bir ses çalar. Kolay: 3 sn sonra saniyede 14, Orta: 4 sn sonra saniyede 10, Zor: 5 sn sonra saniyede 7 can. Düelloda can yenilenmez. Can kiti yoktur; eski kayıtlardaki kitler 50'şer altın olarak iade edilir.

**Bomba (G):** Her ele 2 bombayla başlanır (en fazla 4). Atılan bomba sekerek yuvarlanır, 1.8 sn sonra patlar; 6 birim içindeki düşmanlara uzaklıkla azalan hasar verir, duvarın arkasındakiler korunur. Çok yakındaysan sana da yarı hasar verir. Her dalga sonunda +1 bomba.

**Yerden toplananlar:** Ölen düşman %35 ihtimalle bir eşya düşürür: **Cephane** (sarı, her silaha bir şarjör), **Kalkan** (mavi, +25), **Altın** (sarı para) ya da **Bomba** (yeşil). Üstünden geçince alınır; 20 sn sonra (son saniyelerde yanıp sönerek) kaybolur.

**Geri bildirim:** Vurulunca nişangâhın çevresinde atışın geldiği yönü gösteren kırmızı bir yay çıkar. Ölen düşman geriye doğru yığılıp yere gömülür; kafadan vurulursa kafası parçalanır.

Her iki modun zorluğu **Ayarlar** ekranından ayrı ayrı seçilir (Kolay / Orta / Zor).

## Kontroller

| Tuş | İşlev |
|---|---|
| W A S D / ok tuşları | Hareket |
| Shift | Koş (ileri giderken) |
| Space | Zıpla (1 birimlik kasalara çıkılabilir) |
| Fare | Nişan |
| Sol tık | Ateş (tüfek basılı tutunca otomatik) |
| Sağ tık | Dürbün (keskin nişancı) |
| R | Şarjör değiştir |
| G | Bomba at |
| 1 2 3 4 5 / fare tekerleği | Silah değiştir |
| ESC | Duraklat |

## Silahlar

| # | Silah | Özellik | Nasıl açılır |
|---|---|---|---|
| 1 | Tabanca | Yarı otomatik, 1.4x hasar, **sınırsız yedek mermi** | Başlangıçta açık |
| 2 | Tüfek | Otomatik, 30'luk şarjör (mağazadan büyütülür) | Başlangıçta açık |
| 3 | Pompalı | 8 saçma, yakında çok güçlü, menzili kısa | Mağaza, 250 altın |
| 4 | Keskin Nişancı | 5x hasar, dürbün | Mağaza, 400 altın |
| 5 | Makineli | Çok hızlı otomatik ateş, 0.5x hasar, 40'lık şarjör | Mağaza, 300 altın |

Kafa vuruşu her silahta 2 kat hasar verir. Mağazadaki "Silah Hasarı" yükseltmesi tüm silahlara işler.

## Rekorlar ve başarımlar

**Rekorlar** her bölüm için ayrı tutulur; rekor ekranının üstündeki sekmelerden bölüm seçilir. (Bölüm ayrımından önceki rekorlar Depo'ya aktarılır.)

**Başarımlar** ana menüdeki **BAŞARIMLAR 🎖️** ekranındadır. Her biri bir kez açılır ve altın verir:

| Başarım | Koşul | Ödül |
|---|---|---|
| İlk Kan | İlk düşmanını vur | 25 |
| Kafa Avcısı | Tek elde 10 kafa vuruşu | 150 |
| Hayatta Kalan | 5. dalgaya ulaş | 150 |
| Dalga Ustası | 10. dalgaya ulaş | 400 |
| Demir Yürek | Zor seviyede 5. dalgaya ulaş | 300 |
| Dokunulmaz | Bir dalgayı hiç hasar almadan bitir | 200 |
| Bombacı | Tek bombayla 3 düşman öldür | 200 |
| Toplayıcı | Tek elde yerden 10 eşya topla | 150 |
| Düellocu | Bir düello kazan | 150 |
| Şampiyon | Zor seviyede düello kazan | 400 |
| Şimşek | Düelloyu 30 sn'den kısa sürede kazan | 250 |
| Tek Kişilik Ordu | Toplam 250 düşman vur | 300 |
| Gezgin | Her bölümde 3. dalgaya ulaş | 300 |

## Kalıcı yükseltmeler ve skinler

| Yükseltme | Seviye başına | En fazla |
|---|---|---|
| Can Sınırı | +20 maksimum can | 5 seviye (200 can) |
| Hareket Hızı | +%6 hız | 5 seviye (+%30) |
| Hızlı Şarjör | -%10 şarjör değiştirme süresi | 5 seviye (-%50) |

Fiyat her seviyede artar. Skinler (Standart, Kraliyet, Gölge, Kor, Buz, Zehir, Altın) mağazanın altındaki kartlardan satın alınır ve kuşanılır.

## Dosya yapısı

```
index.html        Sayfa iskeleti: HUD, menüler, mağaza, ayarlar, rekorlar, başarımlar
three.min.js      Three.js r128 (yerel kopya)
css/style.css     Tüm stiller
js/
  profiles.js     Oyuncu girişi (profiller); kayıt anahtarlarını profile göre ayırır
  config.js       Ayarlar, silahlar, skinler, yükseltmeler, düşman tipleri, zorluk seviyeleri
  save.js         Kayıt (localStorage + sağlama toplamı, eski sürümden taşıma)
  state.js        Oyuncu ve oyun durumu, paylaşılan geometri/materyaller
  utils.js        Çarpışma, zemin yüksekliği, ekran geçişleri, küçük yardımcılar
  audio.js        Web Audio ile üretilen ses efektleri
  feedback.js     Hasar sayıları, öldürme akışı, duyurular, düello can çubuğu, hasar yönü
  world.js        Sahne, ışıklar, Depo duvarları/kasaları, silah modelleri, başlangıç (init)
  maps.js         Bölümler: Depo, Space, Çöl, Kar Üssü; zıplatma rampaları, boşluğa düşme
  input.js        Klavye/fare, pointer lock
  game.js         El başlatma/bitirme, hasar alma
  weapons.js      Atış, şarjör, silah değiştirme, dürbün
  enemies.js      Düşman ve düello botu, yol bulma, ölüm efekti
  items.js        Bomba ve yerden toplanan eşyalar
  waves.js        Dalga sistemi
  records.js      Rekorlar (bölüm ve zorluk başına)
  achievements.js Başarımlar
  update.js       Oyun döngüsü, hareket/zıplama, HUD
  shop.js         Mağaza
  settings.js     Ayarlar ekranı
  main.js         Başlatma
```

Dosyalar klasik `<script>` etiketleriyle sırayla yüklenir (ES modülü değil). Bu sayede derleme adımı gerekmez ve HTML'deki `onclick` çağrıları doğrudan çalışır. Sıra önemlidir: bir dosya, kendinden önce yüklenen dosyalardaki tanımları kullanabilir.

## Yerelde çalıştırma

`index.html` dosyasını tarayıcıda açmak yeterlidir. İstenirse küçük bir sunucuyla da çalıştırılabilir:

```
python3 -m http.server 8000
# http://localhost:8000
```

## Kayıtlar

Altın, yükseltmeler, silahlar, skinler, ayarlar, rekorlar ve başarımlar tarayıcının `localStorage` alanında, oyuncu başına ayrı anahtarlarla (`fps_save_v2::<profil>` gibi) saklanır. Başka bir tarayıcıya veya cihaza taşınmaz. v1.1'den kalan kayıt ilk açılışta "Oyuncu 1" profiline taşınır.
