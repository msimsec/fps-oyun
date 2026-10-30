# 3D Tactical FPS (v1.2)

Tarayıcıda çalışan, Three.js ile yazılmış birinci şahıs nişancı oyunu. Kurulum veya derleme gerektirmez.

**Oyna:** https://msimsec.github.io/fps-oyun/

## Oyuncu girişi

Oyun açılınca **"Kim oynuyor?"** ekranı gelir. Herkes adını yazıp kayıt olur; her oyuncunun altını, silahları, skinleri, yükseltmeleri, rekorları ve ayarları ayrı tutulur. Menüdeki **Oyuncu değiştir** ile geçiş yapılır. Parola yoktur ve kayıtlar yalnızca o tarayıcıda saklanır (en fazla 20 oyuncu).

## Oyun modları

- **Dalga modu:** Düşmanlar dalgalar halinde gelir. Her dalga bir öncekinden kalabalık ve güçlüdür. Dalga temizlenince bonus altın, skor ve can verilir, kısa bir moladan sonra sıradaki dalga başlar.
- **1v1 Düello:** Sağa sola kayan ve sürekli ateş eden mor bota karşı teke tek. Botun canı ekranın üstündeki çubukta görünür.

Dalga modunda 4 düşman tipi vardır: **Er** (kırmızı), **Koşucu** (turuncu, hızlı ama zayıf, 2. dalgadan itibaren), **Nişancı** (mavi, uzakta durup isabetli ateş eder, 3. dalgadan itibaren) ve **Zırhlı** (gri, iri, çok dayanıklı, 2.5 kat ödül, 4. dalgadan itibaren).

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
| 1 2 3 4 / fare tekerleği | Silah değiştir |
| H | Can kiti kullan |
| ESC | Duraklat |

## Silahlar

| # | Silah | Özellik | Nasıl açılır |
|---|---|---|---|
| 1 | Tüfek | Otomatik, 30'luk şarjör (mağazadan büyütülür) | Başlangıçta açık |
| 2 | Tabanca | Yarı otomatik, 1.4x hasar, **sınırsız yedek mermi** | Başlangıçta açık |
| 3 | Pompalı | 8 saçma, yakında çok güçlü, menzili kısa | Mağaza, 250 altın |
| 4 | Keskin Nişancı | 5x hasar, dürbün | Mağaza, 400 altın |

Kafa vuruşu her silahta 2 kat hasar verir. Mağazadaki "Silah Hasarı" yükseltmesi tüm silahlara işler.

## Kalıcı yükseltmeler ve skinler

| Yükseltme | Seviye başına | En fazla |
|---|---|---|
| Can Sınırı | +20 maksimum can | 5 seviye (200 can) |
| Hareket Hızı | +%6 hız | 5 seviye (+%30) |
| Hızlı Şarjör | -%10 şarjör değiştirme süresi | 5 seviye (-%50) |

Fiyat her seviyede artar. Skinler (Standart, Kraliyet, Gölge, Kor, Buz, Zehir, Altın) mağazanın altındaki kartlardan satın alınır ve kuşanılır.

## Dosya yapısı

```
index.html        Sayfa iskeleti: HUD, menüler, mağaza, ayarlar, rekorlar
three.min.js      Three.js r128 (yerel kopya)
css/style.css     Tüm stiller
js/
  profiles.js     Oyuncu girişi (profiller); kayıt anahtarlarını profile göre ayırır
  config.js       Ayarlar, silahlar, skinler, yükseltmeler, düşman tipleri, zorluk seviyeleri
  save.js         Kayıt (localStorage + sağlama toplamı, eski sürümden taşıma)
  state.js        Oyuncu ve oyun durumu, paylaşılan geometri/materyaller
  utils.js        Çarpışma, zemin yüksekliği, ekran geçişleri, küçük yardımcılar
  audio.js        Web Audio ile üretilen ses efektleri
  feedback.js     Hasar sayıları, öldürme akışı, duyurular, düello can çubuğu
  world.js        Sahne, harita, kasalar, silah modelleri, başlangıç (init)
  input.js        Klavye/fare, pointer lock
  game.js         El başlatma/bitirme, hasar alma, can kiti
  weapons.js      Atış, şarjör, silah değiştirme, dürbün
  enemies.js      Düşman ve düello botu
  waves.js        Dalga sistemi
  records.js      Rekorlar
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

Altın, yükseltmeler, silahlar, skinler, ayarlar ve rekorlar tarayıcının `localStorage` alanında, oyuncu başına ayrı anahtarlarla (`fps_save_v2::<profil>` gibi) saklanır. Başka bir tarayıcıya veya cihaza taşınmaz. v1.1'den kalan kayıt ilk açılışta "Oyuncu 1" profiline taşınır.
