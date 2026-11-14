'use strict';

// =====================================================================
//  YARDIM — Ayarlar ekranından açılır. Oyunun nasıl çalıştığını konu konu, satır satır anlatır.
//  Sayılar (fiyatlar, hasarlar, süreler) doğrudan ayarlardan okunur; oyun değişince metin de güncel kalır.
// =====================================================================
const HELP_SECTIONS = [
    { id: 'start', title: '🚀 Başlarken', lines: () => [
        `Oyun açılınca "Kim oynuyor?" ekranı gelir. Yeni oyuncuysan adını ve ${PW_MIN}-${PW_MAX} karakterlik bir parola yazıp KAYIT OL'a bas.`,
        'Kayıtlıysan listeden adına tıkla ve parolanı yaz (ayrıntılar "Oyuncu ve Parola" konusunda).',
        `Her oyuncunun altını, silahları, skinleri, yükseltmeleri, rekorları, başarımları ve ayarları ayrı tutulur (en fazla ${MAX_PROFILES} oyuncu).`,
        'Kayıtlar yalnızca bu tarayıcıda saklanır; başka bir bilgisayara ya da tarayıcıya taşınmaz. Parolanı unutursan geri getirilemez.',
        'Altın, silahlar, yükseltmeler, skinler, başarımlar ve ayarlar anında kaydedilir. Tarayıcıyı ya da sekmeyi oyunun ortasında kapatsan bile o elin skoru ve ulaştığın dalga rekorlara yazılır.',
        'Yarım kalan dalga eli de kaydedilir (birkaç saniyede bir, ana menüye dönünce ve tarayıcıyı kapatınca). Ana menüde yeşil DEVAM ET ▶ butonu çıkar; altında bölüm, zorluk, dalga ve skor yazar.',
        'DEVAM ET eli kaldığın yerden sürdürür: aynı bölüm ve zorluk, aynı dalga, canın, kalkanın, skorun, cephanen, bomban, konumun, sahadaki düşmanlar ve yerdeki eşyalar geri gelir.',
        'Yarım kalan elin varken OYUNA BAŞLA\'ya basarsan önce sorulur; yeni el başlatırsan eski kayıt silinir. El bitince (canın sıfırlanınca) kayıt da silinir. Düello kaydedilmez.',
        'Ana menüde BÖLÜM SEÇ kısmından oynamak istediğin haritaya tıkla; seçili olanın üstünde "✓ SEÇİLİ" yazar.',
        'OYUNA BAŞLA dalga modunu, 1v1 DÜELLO bota karşı teke tek maçı başlatır.',
        'Oyun başlayınca fare ekrana kilitlenir. Kilitlenmezse ekrana bir kez tıkla.',
        'ESC oyunu duraklatır. Duraklatma menüsünden devam edebilir, mağazaya, ayarlara ya da ana menüye gidebilirsin.',
        'Bilgisayarda klavye ve fare ile, tablet ve telefonda dokunmatik kontrollerle oynanır (ayrıntılar "Dokunmatik (Tablet / Telefon)" konusunda).',
        'Uygulama olarak yükle: Chrome ya da Edge\'de ana menüde UYGULAMA OLARAK YÜKLE 📲 butonu çıkar (ya da adres çubuğundaki yükle simgesi). Yüklenince oyun masaüstünden/başlat menüsünden kendi penceresinde, tam ekran açılır.',
        'İnternetsiz oynama: oyunu bir kez açtıktan sonra dosyaları bilgisayarda saklanır; internet yokken de açılır ve oynanır. Yeni sürüm çıkınca internet varken kendiliğinden gelir.',
        'Uygulama olarak yüklense de kayıtların aynı tarayıcıda durur: yüklü oyun ile tarayıcıdaki oyun aynı oyuncuları, altını ve rekorları görür.'
    ] },
    { id: 'account', title: '👤 Oyuncu ve Parola', lines: () => [
        `Kayıt olurken adını ve ${PW_MIN}-${PW_MAX} karakterlik bir parola yazarsın. Parola basittir: harf, rakam, ne istersen olabilir; zorunlu kural yoktur.`,
        'Giriş için listeden adına tıkla; açılan pencereye parolanı yazıp Enter\'a bas (Esc ya da İptal pencereyi kapatır).',
        'Parolayı yanlış yazarsan "Parola yanlış." uyarısı çıkar. "Parolayı göster" kutusuyla yazdığını görebilirsin.',
        'Aynı tarayıcı sekmesinde bir kez giriş yaptıysan, sayfayı yenilesen de tekrar parola sorulmaz. Yeni sekmede yeniden sorulur.',
        'Ana menünün sol üstünde oynayan oyuncunun adı yazar; "Oyuncu değiştir" ile giriş ekranına dönersin.',
        'Oyuncu kartındaki ✎ Ad adını, 🔑 Parola parolanı değiştirir, 🗑 Sil oyuncuyu tüm kaydıyla siler. Üçü de o oyuncunun parolasını ister.',
        'Silmeden önce ayrıca "silinsin mi?" diye sorulur; EVET, SİL\'e basmadan hiçbir oyuncu silinmez. Vazgeç ya da Esc iptal eder.',
        'Parolan değiştirilirken yanlış yazılmasın diye yeni parola iki kez sorulur.',
        'Parolası olmayan eski oyuncuların kartında "⚠ parola yok" yazar; oyun açılır açılmaz parola belirlemeleri istenir, belirlemeden oynanamaz.',
        'Parolanın kendisi saklanmaz, yalnızca şifrelenmiş özeti tutulur. Parolanı unutursan geri getirilemez.',
        'Bu parola, aynı bilgisayarı kullananların birbirinin kaydına girmesini önleyen basit bir kilittir; gerçek bir hesap güvenliği değildir.'
    ] },
    { id: 'controls', title: '🎮 Kontroller', lines: () => [
        'W A S D (ya da ok tuşları): ileri, geri, sola, sağa yürü.',
        `Shift: koş (yalnızca ileri giderken). Koşarken görüş açısı genişler ama isabet biraz bozulur.`,
        'Space: zıpla. 1 birim yüksekliğindeki kasalara zıplayarak çıkabilirsin; çok alçak basamaklara yürüyerek çıkılır.',
        'C ya da Ctrl: basılı tuttukça çömel. Çömelince alçalırsın (alçak siperin arkasında düşman seni göremez, mermisi de sana gelmez), yarı hızda yürürsün, atışların daha isabetli olur; zıplayamazsın. Not: tarayıcıda Ctrl+W sekmeyi kapatır, çömelip ileri yürürken C tuşunu kullan (kapansa bile DEVAM ET ile kaldığın yerden sürersin).',
        'Fare: nişan al. Hassasiyeti Ayarlar\'dan değiştirebilirsin.',
        'Sol tık: ateş et. Otomatik silahta (Taramalı Tabanca) ve Testereli Eldiven\'de basılı tutunca sürekli çalışır; diğerleri her tıkta bir atar.',
        'Sağ tık: dürbün (yalnızca Keskin Nişancı). Dürbünle bakarken yavaş yürürsün ama isabet tamdır.',
        'R: şarjör değiştir. Şarjör boşalınca kendiliğinden de değişir.',
        'B: bomba at (alışık olanlar için G de çalışır).',
        'F: feneri aç / kapat (yalnızca Gece Limanı\'nda; bölüme girince açık gelir).',
        `1-${WEAPON_ORDER.length}: silah seç (${WEAPON_ORDER.map((id, i) => `${i + 1} ${WEAPONS[id].name}`).join(', ')}). Fare tekerleği de silahlar arasında gezer.`,
        'ESC: duraklat.'
    ] },
    { id: 'touch', title: '📱 Dokunmatik (Tablet / Telefon)', lines: () => [
        'Tablet ve telefonda dokunmatik kontroller kendiliğinden açılır. Ayarlar → Dokunmatik Kontroller: OTOMATİK (dokunmatik ekranda açık), AÇIK (her zaman), KAPALI (klavye ve fare).',
        'Cihazı yan çevirerek (yatay) oyna. Dik tutarsan oyun duraklar ve "cihazı yan çevir" yazar. Oyun başlarken mümkünse tam ekrana geçer.',
        'Yürümek: ekranın sol yarısına parmağını koy, orada bir çubuk çıkar. Parmağını kaydırdığın yöne yürürsün; az itersen yavaş, çok itersen hızlı. Sonuna kadar ileri itersen koşarsın.',
        'Nişan almak: ekranın sağ yarısında parmağını kaydır. Hassasiyeti Ayarlar\'daki "Fare / Dokunmatik Bakış Hassasiyeti" ile değiştirebilirsin.',
        '🔥 ATEŞ (sağ altta büyük kırmızı buton): basılı tuttukça ateş eder (otomatik silahlar ve testere sürekli, diğerleri her dokunuşta bir). ATEŞ\'e basarken parmağını kaydırırsan nişan da döner: aynı anda yürüyüp nişan alıp ateş edebilirsin.',
        '⤒ zıpla · ⬇ çömel (bir dokunuşla çömelir, tekrar dokununca kalkar; açıkken yeşil) · ↻ şarjör değiştir · 💣 bomba at · ⇄ sıradaki silaha geç.',
        '🔭 dürbün yalnızca Keskin Nişancı elindeyken, 🔦 fener yalnızca Gece Limanı\'nda görünür. ⏸ (üst ortada) oyunu duraklatır.',
        'Başka uygulamaya geçersen ya da ekran kilitlenirse oyun kendiliğinden duraklar; DEVAM ET ile sürersin.',
        'Göstergeler (can, skor, altın, silah ve mermi) dokunmatikte ekranın üstündedir; alt köşeler çubuğa ve butonlara kalır.',
        'En rahat oyun için oyunu uygulama olarak yükle (tarayıcı menüsünde "Ana ekrana ekle" / "Uygulamayı yükle"): tam ekran açılır, internetsiz de oynanır.',
        'Tablet/telefonda oyun daha akıcı çalışsın diye görüntü çözünürlüğü ve gölge kalitesi biraz düşük tutulur.'
    ] },
    { id: 'modes', title: '⚔️ Oyun Modları', lines: () => [
        'DALGA MODU: Düşmanlar dalgalar halinde gelir. Ekranın sol üstünde dalga numarası ve kalan düşman sayısı yazar.',
        'Bir dalgadaki tüm düşmanlar ölünce dalga biter; bonus altın, skor ve +1 bomba alırsın.',
        `Dalgalar arasında ${CFG.waveBreak} saniyelik mola vardır; sonraki dalga daha kalabalık, düşmanlar daha dayanıklı ve hızlıdır.`,
        'Dalga modunda can sıfırlanınca el biter (GÖREV BAŞARISIZ). Ulaştığın dalga ve skorun rekorlara yazılır.',
        'Yarıda ana menüye dönersen o ana kadarki skor ve dalga rekorlara işlenir; el de kaydedilir, ana menüdeki DEVAM ET ▶ ile kaldığın yerden sürdürebilirsin.',
        '1v1 DÜELLO: Sağa sola kayarak sürekli ateş eden mor bota karşı teke tek. Botun canı ekranın üstündeki çubukta görünür.',
        'Botu öldürürsen kazanırsın (+500 skor ve altın), sen ölürsen kaybedersin. Düelloda can yenilenmez.',
        'Dalga modunun ve düellonun zorluğu Ayarlar\'dan ayrı ayrı seçilir: Kolay, Orta, Zor. Değişiklik bir sonraki elde geçerli olur.'
    ] },
    { id: 'health', title: '❤️ Can ve Kalkan', lines: () => [
        'Sol alttaki göstergede canın ve kalkanın yazar.',
        'Hasar alınca ekran kırmızı yanıp söner; nişangâhın çevresinde atışın geldiği yönü gösteren kırmızı bir yay çıkar.',
        'Kalkan varsa hasarı önce kalkan emer; kalkan bitince can azalır.',
        `Mağazadaki Ağır Kalkan +${CFG.armorAmount} kalkan verir. El içinde (duraklatıp) alınırsa hemen, menüden alınırsa sonraki elin başında takılır.`,
        'Dalga modunda can kendiliğinden yenilenir: bir süre hasar almazsan can dolmaya başlar, can göstergesi yeşil parlar.',
        `Yenilenme zorluğa göre: ${DIFFICULTIES.map(d => `${DIFF_LABELS[d]} ${GAME_DIFF[d].regenDelay} sn sonra saniyede ${GAME_DIFF[d].regenRate} can`).join(' · ')}.`,
        'Yeniden hasar alınca bekleme süresi baştan başlar. Bu yüzden siperin arkasına çekilip beklemek canını doldurur.',
        'Düşmanla temas halinde kalmak (yakın dövüş) saniye saniye can götürür; düşmanları yakına sokmamaya çalış.',
        'Space bölümünde platformdan düşersen 35 can kaybeder (kalkan bunu emmez) ve başlangıç platformuna dönersin.',
        `Mağazadaki Can Sınırı yükseltmesi maksimum canı kalıcı olarak +${UPGRADES.health.per} artırır.`
    ] },
    { id: 'weapons', title: '🔫 Silahlar ve Cephane', lines: () => [
        'Silahlar gerçeğe yakın dengelendi (mermi başına öldürücülük): Roketatar > Keskin Nişancı > Av Tüfeği (yakında) > Yaylı Tüfek > Tabanca > Taramalı Tabanca. Taramalı tek mermisi zayıf ama çok hızlı atar; Testereli Eldiven yalnızca dipte etkilidir ama orada çok öldürücüdür.',
        'Sağ alttaki panelde silahın adı, şarjördeki mermi / yedek mermi ve sahip olduğun silahlar yazar.',
        ...WEAPON_ORDER.map((id, i) => {
            const w = WEAPONS[id];
            const how = w.cost ? `mağazada ${w.cost} altın` : 'başlangıçta açık';
            if (w.melee) return `${w.name} (${i + 1} tuşu): yakın dövüş, basılı tutunca dönen testere önündeki düşmanı keser (${w.range} birim menzil), ${w.dmgMul}x hasar, mermi harcamaz; ${how}.`;
            const kind = w.bolt ? 'ok atar, tek atış, tam isabetli' : w.rocket ? `roket, ${w.blastRadius} birimlik patlama` : w.pellets > 1 ? `${w.pellets} saçma` : (w.auto ? 'otomatik' : 'yarı otomatik');
            const mag = id === 'smg' ? `${numSuffix(w.mag)} şarjör (mağazadan ${maxSmgMag()}'a kadar büyür)` : `${numSuffix(w.mag)} şarjör`;
            return `${w.name} (${i + 1} tuşu): ${kind}, ${w.dmgMul}x hasar, ${mag}; ${how}.`;
        }),
        'Silahlarını eldivenli ellerin tutar: tabancayı iki elle, tüfekleri bir el kabzada bir el önde tutarsın.',
        'Testereli Eldiven her zaman sendedir; mermi bitince ya da düşman dibine geldiğinde 1 tuşuyla geç. Kafaya denk gelen kesik 2 kat hasar verir. Duvarın arkasındaki düşmanı kesemezsin.',
        'Yaylı Tüfek: yay gücüyle ok atar. Her atıştan sonra kirişi yeniden gerer (yavaş), ama bir ok çoğu düşmanı tek başına indirir; kafaya 2 kat. Ok uzakta hafifçe düşer, uzaktaki hedefe biraz yukarı nişan al. Duvara saplanan ok bir süre orada kalır.',
        'Roketatar: roket namludan alev ve duman izi bırakarak uçar; bir duvara, zemine ya da düşmana değince büyük bir patlamayla patlar ve ekran sarsılır. Duvar arkası korunur.',
        "Roket en öldürücü silahtır: düşmana doğrudan çarparsa ya da çok yakınına (ayağının dibine) düşerse öldürür. Patlamadan uzaklaştıkça hasar hızla azalır: yarıçapın yarısında canının ~%65'i, dörtte üçünde ~%28'i gider, kenarda hiç.",
        'Düello botunun canı çok yüksek olduğu için ona yüzdeli değil, bombadaki gibi uzaklıkla azalan normal patlama hasarı işler.',
        'Kendi roketine çok yakın durursan sen de aynı kuralla, yarı şiddette can kaybedersin (dibinde patlarsa canının yarısı gider).',
        'Taramalı Tabanca tamamen siyah, tırtıklı kabzalı AR tipi bir silahtır; skin seçimi gövdesinin rengini değiştirmez, yalnızca mermi rengi skine göre değişir.',
        'Tabancanın yedek mermisi sınırsızdır; diğer silahların mermisi bitse bile tabancayla savaşmaya devam edebilirsin.',
        'Her öldürdüğün düşman, sahip olduğun silahlara biraz yedek mermi verir.',
        'Kafa vuruşu her silahta 2 kat hasar verir; nişangâh kırmızı yanar. Göğsün biraz üstüne nişan al.',
        'Koşarken ve havadayken atışların biraz dağılır; durarak ateş etmek daha isabetlidir.',
        `Mağazadaki Silah Hasarı yükseltmesi temel hasarı +${CFG.damageStep} artırır ve tüm silahlara kendi çarpanıyla işler (en fazla ${CFG.maxDamage}).`,
        'Her elin başında tüm silahların şarjörü ve yedek mermisi doldurulur.'
    ] },
    { id: 'grenade', title: '💣 Bomba', lines: () => [
        'B tuşu baktığın yöne bomba atar (G de çalışır). Sağ alttaki panelde kaç bomban kaldığı yazar.',
        `Bomba duvardan ve yerden seker, ${CFG.grenadeFuse} saniye sonra patlar.`,
        `Patlama ${CFG.grenadeRadius} birim içindeki düşmanlara hasar verir; merkeze yakın olan daha çok hasar alır.`,
        'Duvarın ya da siperin arkasındaki düşmanlar patlamadan korunur.',
        'Patlamaya çok yakınsan sana da yarı hasar verir; bombayı yakınına atma.',
        `Her ele ${CFG.grenadeStart} bombayla başlarsın, en fazla ${CFG.grenadeMax} taşıyabilirsin.`,
        'Her dalga sonunda +1 bomba kazanırsın; ölen düşmanlar da bazen bomba düşürür.',
        'İpucu: kalabalık düşman gruplarına ya da köşe arkasına saklananlara bomba at.'
    ] },
    { id: 'enemies', title: '👾 Düşmanlar', lines: () => [
        'Düşmanlar seni bulmak için duvarların etrafından dolaşır; arada duvar varken ateş etmezler.',
        'Bir düşmanı vurunca başının üstünde can çubuğu görünür.',
        'Her düşmanın kafasında kendi renginde kızgın bir yüz vardır (çatık kaşlar, dişli ağız): Er kırmızı, Koşucu turuncu, Nişancı mavi (alnında dürbün gözlüğü), Zırhlı gri; düello botu mor. Yüzünü gördüğün düşman sana bakıyordur.',
        ...Object.values(ENEMY_TYPES).map(t => `${t.name}: ${{
            Er: 'kırmızı, standart asker.',
            'Koşucu': 'turuncu, hızlı ama zayıf; ateşi seyrek.',
            'Nişancı': 'mavi, uzakta durup isabetli ve güçlü ateş eder.',
            'Zırhlı': 'gri ve iri, çok dayanıklı; öldürünce fazla ödül verir.'
        }[t.name] || ''}${t.minWave ? ` ${t.minWave}. dalgadan itibaren çıkar.` : ''}`),
        'Dalgalar ilerledikçe düşmanlar yeni yetenekler kazanır (dalga başında duyurulur):',
        ...ENEMY_SKILLS.map(k => `${k.wave}. dalga: ${k.text}${k.needsPads ? ' (yalnızca rampalı bölümde, Space)' : ''}`),
        'Düşman yakına gelince temas hasarı verir; mesafeni koru.',
        '3. dalgadan itibaren düşmanlar arada bir durup çömelerek ateş eder: alçalırlar (kafaları da aşağı iner), daha isabetli atarlar. Dibine gelince ya da vurulup kaçarken kalkarlar. Koşucular çömelmez; düello botu da arada bir çömelir.',
        'Ölen düşman geriye doğru devrilir, birkaç saniye yerde kalır, sonra toprağa gömülür. Kafadan öldürülürse kafası parçalanır.',
        'Cesetler engel değildir: mermiler içinden geçer, üstünden yürüyebilirsin.'
    ] },
    { id: 'drops', title: '🎁 Yerden Toplananlar', lines: () => [
        `Ölen düşman %${Math.round(CFG.dropChance * 100)} ihtimalle yere dönen, parlayan bir eşya bırakır.`,
        'Her eşyanın üstünde ne olduğunu yazan renkli bir etiket, altında da aynı renkte parlayan bir halka vardır.',
        'Cephane silaha özeldir: etikette hangi silahın cephanesi olduğu ve kaç tane verdiği yazar. Yalnızca sahip olduğun silahların cephanesi düşer; elindeki silahın yedeği azsa onunki daha sık düşer.',
        'Cephane kutusunun üstünde o silahın küçük modeli yatar (hep yandan görünür): 🏹 OK +5 Yaylı Tüfek · 🔴 SAÇMA +6 Av Tüfeği · 🎯 MERMİ +5 Keskin Nişancı (dürbünlü) · 🔫 MERMİ +şarjör Taramalı Tabanca (siyah) · 🚀 ROKET +2 Roketatar (sarı başlıklı tüp). Kutunun bandı ve halkası da silahın renginde.',
        'Cephaneyi alınca sağ üstte "+6 saçma (Av Tüfeği) → 6/12" gibi ne aldığın yazar; elindeki silahın cephanesiyse mermi göstergesi yeşil yanar.',
        '🛡️ KALKAN +25 (mavi): artılı mavi plaka; +25 kalkan (kalkanın doluysa alınmaz).',
        '🪙 ALTIN (sarı): üst üste altın paralar; bir düşman öldürme ödülü kadar altın.',
        '💣 BOMBA +1 (yeşil): pimli el bombası; +1 bomba (çantan doluysa alınmaz).',
        'Eşyayı almak için üstünden geçmen yeterli. Eşya bir kasanın ya da duvarın dibine düşerse en yakın boş yere kayar; hep alınabilir.',
        'Bomba çantan doluyken (4/4) bomba, kalkanın doluyken kalkan alınmaz: etiketi soluk görünür ve üstüne gelince nedeni yazar. Bir bomba atınca ya da hasar alınca alabilirsin; eşya kaybolana kadar yerinde bekler.',
        `Eşyalar ${CFG.dropLife} saniye sonra kaybolur; son saniyelerde yanıp söner.`
    ] },
    { id: 'maps', title: '🗺️ Bölümler', lines: () => [
        ...MAP_IDS.map(id => `${MAPS[id].name}: ${MAPS[id].desc}.`),
        'Space\'te platformlar arasında yürünemez: turuncu zıplatma rampasına basınca karşı platforma fırlatılırsın.',
        'Çöl ve Kar Üssü\'ndeki gözetleme yerlerine basamak kasalarından zıplayarak çıkılır; yukarıdan uzağı görürsün.',
        'Gece Limanı karanlıktır: yalnızca ay ışığı, sokak lambaları ve senin fenerin aydınlatır. Fener baktığın yönü aydınlatır; F ile açılıp kapanır.',
        'Gece Limanı\'nda düşmanların kızgın yüzleri karanlıkta hafifçe parlar; lambaların altındaki aydınlık alanlarda daha kolay görünürsün ve görürsün.',
        'Gece Limanı\'nın batısındaki açık depoya girilebilir (çatılı, içi lambalı). Doğudaki konteyner sahasında güneydeki konteynerin batı ucundaki iki kasa basamağından konteynerin üstüne çıkılır. Kuzeyde rıhtım korkuluğu geçilmez.',
        'Her bölümün rekorları ayrı tutulur.'
    ] },
    { id: 'score', title: '🏅 Skor ve Altın', lines: () => [
        'Düşman öldürmek 100 skor verir; kafadan öldürmek +50 skor daha.',
        `Düşman başına ${DIFFICULTIES.map(d => `${DIFF_LABELS[d]} ${GAME_DIFF[d].killGold}`).join(' · ')} altın kazanırsın.`,
        'Güçlü düşmanlar (Nişancı, Zırhlı) daha çok skor ve altın verir.',
        `Dalga bitince dalga numarası × ${CFG.waveScorePerWave} skor ve dalga numarası × ${CFG.waveGoldPerWave} altın bonusu alırsın.`,
        `Düello kazanınca +500 skor ve ${DIFFICULTIES.map(d => `${DIFF_LABELS[d]} ${DUEL_DIFF[d].duelGold}`).join(' · ')} altın.`,
        'Başarımlar ve yerden toplanan altınlar da altın kazandırır.',
        'Altın kalıcıdır: el bitse de kaybolmaz, mağazada harcanır.'
    ] },
    { id: 'shop', title: '🛒 Mağaza', lines: () => [
        'Mağazaya ana menüden, duraklatma menüsünden ya da oyun sonu ekranından girilir.',
        'Altının yetmediği kalemlerin butonu soluk görünür.',
        `Silah Hasarı (${CFG.damageCost} altın): tüm silahların hasarı artar.`,
        `Gelişmiş Taramalı Şarjörü (${CFG.magCost} altın): Taramalı Tabanca şarjörü +${CFG.magStep}.`,
        `Ağır Kalkan (${CFG.shieldCost} altın): +${CFG.armorAmount} kalkan.`,
        ...UPGRADE_IDS.map(id => `${UPGRADES[id].name}: kalıcı yükseltme, ${UPGRADES[id].max} seviye; her seviyede fiyat artar (ilk seviye ${upgradeCost(id, 0)} altın).`),
        'Silahlar (Av Tüfeği, Keskin Nişancı, Taramalı Tabanca, Roketatar) bir kez alınır ve kalıcı olarak açılır.',
        'Skinler silahın ve mermilerin rengini değiştirir (Taramalı Tabanca her zaman siyah kalır, yalnızca mermisi renk alır).',
        'Sahip olduğun skine tıklayınca kuşanılır, kilitli olana tıklayınca satın alınır.'
    ] },
    { id: 'progress', title: '🏆 Rekorlar ve Başarımlar', lines: () => [
        'REKORLAR ekranında her bölüm için ayrı sekme vardır; her zorluk seviyesinin en iyi skoru, en uzak dalgası ve düello sonuçları yazar.',
        'En iyi skorun ve en hızlı düello galibiyetinin altında rekorun kırıldığı gün ve saat yazar (bu özellikten önceki eski rekorlarda "tarih yok").',
        'Rekor kırınca oyun sonu ekranında "YENİ REKOR" yazar.',
        'Rekor ekranındaki Sıfırla yalnızca seçili bölümün rekorlarını siler; önce onay sorulur.',
        `BAŞARIMLAR ekranında ${ACHIEVEMENTS.length} başarım vardır; her biri bir kez açılır ve altın ödülü verir.`,
        'Açılan başarım ekranın sağında duyurulur ve altını hemen hesabına eklenir.',
        'Bazı başarımlarda ilerleme çubuğu vardır (ör. toplam vurulan düşman).',
        ...ACHIEVEMENTS.map(a => `${a.name}: ${a.desc} (${a.reward} altın).`)
    ] },
    { id: 'settings', title: '⚙️ Ayarlar', lines: () => [
        'Oyun Zorluğu: dalga modundaki düşmanların canı, hızı, sayısı, isabeti ve verdiği altın değişir.',
        'Düello Zorluğu: botun canı, ateş hızı ve hasarı değişir; zor seviyede kazanınca daha çok altın.',
        'Zorluk değişikliği bir sonraki elde geçerli olur (oynanan el aynı zorlukta biter).',
        `Fare Hassasiyeti: ${SENS_MIN}x ile ${SENS_MAX}x arasında; hemen geçerli olur.`,
        'Ses Düzeyi: %0 sesi tamamen kapatır.',
        'Dokunmatik Kontroller: OTOMATİK / AÇIK / KAPALI (ayrıntılar "Dokunmatik" konusunda).',
        'Ayarlar her oyuncu için ayrı kaydedilir.'
    ] },
    { id: 'tips', title: '💡 İpuçları', lines: () => [
        'Siperin arkasında kalarak çatış; hasar almadığın sürece canın dolar. Alçak siperin arkasında çömelirsen (C) düşman seni hiç göremez.',
        'Düşmanları kafadan vur: hem 2 kat hasar hem fazladan skor.',
        'Tabancayı yedek silah olarak kullan: mermisi hiç bitmez. Dibine gelen düşmana Testereli Eldiven ile karşılık ver.',
        'Nişancılar uzaktan vurur; önce onları temizle ya da Keskin Nişancı ile uzaktan karşılık ver.',
        'Zırhlılar çok dayanıklıdır; bomba, Roketatar ya da Av Tüfeği ile vur.',
        'Kalabalık düşman grubuna roket at; tek roketle birkaç düşmanı birden indirebilirsin.',
        'Yere düşen eşyaları kaçırma; özellikle cephane ve kalkan zor anlarda hayat kurtarır.',
        'Altını önce Silah Hasarı ve Can Sınırı\'na yatırmak oyunu en çok kolaylaştırır.',
        'Zor gelirse Ayarlar\'dan zorluğu düşür; Kolay\'da can daha hızlı yenilenir.'
    ] }
];

let helpSection = 'start';
let helpReturn = 'settings';

function openHelp() {
    helpReturn = state === 'settings' ? 'settings' : 'menu';
    state = 'help';
    showScreen('helpScreen');
    renderHelp();
}

function renderHelp() {
    $('helpTabs').innerHTML = HELP_SECTIONS.map(s =>
        `<button class="help-tab${s.id === helpSection ? ' active' : ''}" onclick="showHelpSection('${s.id}')">${s.title}</button>`
    ).join('');
    const sec = HELP_SECTIONS.find(s => s.id === helpSection) || HELP_SECTIONS[0];
    $('helpTitle').textContent = sec.title;
    $('helpBody').innerHTML = sec.lines().map(l => `<li>${escapeHtml(l)}</li>`).join('');
    const i = HELP_SECTIONS.indexOf(sec);
    $('helpPrev').disabled = i === 0;
    $('helpNext').disabled = i === HELP_SECTIONS.length - 1;
    $('helpPage').textContent = `${i + 1} / ${HELP_SECTIONS.length}`;
    $('helpContent').scrollTop = 0;
}

function showHelpSection(id) { helpSection = id; renderHelp(); }

function stepHelp(d) {
    const i = HELP_SECTIONS.findIndex(s => s.id === helpSection);
    const n = HELP_SECTIONS[Math.min(HELP_SECTIONS.length - 1, Math.max(0, i + d))];
    showHelpSection(n.id);
}

function closeHelp() {
    if (helpReturn === 'settings') { state = 'settings'; showScreen('settingsScreen'); updateSettingsScreen(); }
    else returnTo('menu');
}

// Sayıya Türkçe "-lik" eki: 6'lık, 12'lik, 30'luk, 40'lık
function numSuffix(n) {
    const last = { 0: n % 100 === 0 ? 'lük' : ({ 1: 'luk', 2: 'lik', 3: 'luk', 4: 'lık', 5: 'lik', 6: 'lık', 7: 'lik', 8: 'lik', 9: 'luk' })[Math.floor(n / 10) % 10],
        1: 'lik', 2: 'lik', 3: 'lük', 4: 'lük', 5: 'lik', 6: 'lık', 7: 'lik', 8: 'lik', 9: 'luk' }[n % 10];
    return `${n}'${last}`;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
