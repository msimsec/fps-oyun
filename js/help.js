'use strict';

// =====================================================================
//  YARDIM — Ayarlar ekranından açılır. Oyunun nasıl çalıştığını konu konu, satır satır anlatır.
//  Sayılar (fiyatlar, hasarlar, süreler) doğrudan ayarlardan okunur; oyun değişince metin de güncel kalır.
// =====================================================================
const HELP_SECTIONS = [
    { id: 'start', title: '🚀 Başlarken', lines: () => [
        `Oyun açılınca "Kim oynuyor?" ekranı gelir. Yeni oyuncuysan adını ve ${PW_MIN}-${PW_MAX} karakterlik bir parola yazıp KAYIT OL'a bas.`,
        'Kayıtlıysan listeden adına tıkla ve parolanı yaz. Parola basittir: harf, rakam, ne istersen olabilir.',
        'Adını değiştirmek (✎ Ad), parolanı değiştirmek (🔑 Parola) ya da oyuncuyu silmek (🗑 Sil) için de parolan sorulur.',
        `Her oyuncunun altını, silahları, skinleri, yükseltmeleri, rekorları, başarımları ve ayarları ayrı tutulur (en fazla ${MAX_PROFILES} oyuncu).`,
        'Kayıtlar yalnızca bu tarayıcıda saklanır; başka bir bilgisayara ya da tarayıcıya taşınmaz. Parolanı unutursan geri getirilemez.',
        'Ana menüde BÖLÜM SEÇ kısmından oynamak istediğin haritaya tıkla; seçili olanın üstünde "✓ SEÇİLİ" yazar.',
        'OYUNA BAŞLA dalga modunu, 1v1 DÜELLO bota karşı teke tek maçı başlatır.',
        'Oyun başlayınca fare ekrana kilitlenir. Kilitlenmezse ekrana bir kez tıkla.',
        'ESC oyunu duraklatır. Duraklatma menüsünden devam edebilir, mağazaya, ayarlara ya da ana menüye gidebilirsin.',
        'Oyun klavye ve fare ile oynanır; dokunmatik ekranlarda oynanamaz.'
    ] },
    { id: 'controls', title: '🎮 Kontroller', lines: () => [
        'W A S D (ya da ok tuşları): ileri, geri, sola, sağa yürü.',
        `Shift: koş (yalnızca ileri giderken). Koşarken görüş açısı genişler ama isabet biraz bozulur.`,
        'Space: zıpla. 1 birim yüksekliğindeki kasalara zıplayarak çıkabilirsin; çok alçak basamaklara yürüyerek çıkılır.',
        'Fare: nişan al. Hassasiyeti Ayarlar\'dan değiştirebilirsin.',
        'Sol tık: ateş et. Otomatik silahlarda (Tüfek, Taramalı Tabanca) basılı tutunca seri atar; diğerleri her tıkta bir atar.',
        'Sağ tık: dürbün (yalnızca Keskin Nişancı). Dürbünle bakarken yavaş yürürsün ama isabet tamdır.',
        'R: şarjör değiştir. Şarjör boşalınca kendiliğinden de değişir.',
        'G: bomba at.',
        `1-${WEAPON_ORDER.length}: silah seç (${WEAPON_ORDER.map((id, i) => `${i + 1} ${WEAPONS[id].name}`).join(', ')}). Fare tekerleği de silahlar arasında gezer.`,
        'ESC: duraklat.'
    ] },
    { id: 'modes', title: '⚔️ Oyun Modları', lines: () => [
        'DALGA MODU: Düşmanlar dalgalar halinde gelir. Ekranın sol üstünde dalga numarası ve kalan düşman sayısı yazar.',
        'Bir dalgadaki tüm düşmanlar ölünce dalga biter; bonus altın, skor ve +1 bomba alırsın.',
        `Dalgalar arasında ${CFG.waveBreak} saniyelik mola vardır; sonraki dalga daha kalabalık, düşmanlar daha dayanıklı ve hızlıdır.`,
        'Dalga modunda can sıfırlanınca el biter (GÖREV BAŞARISIZ). Ulaştığın dalga ve skorun rekorlara yazılır.',
        'Yarıda ana menüye dönersen de o ana kadarki skor ve dalga rekorlara işlenir.',
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
        'Sağ alttaki panelde silahın adı, şarjördeki mermi / yedek mermi ve sahip olduğun silahlar yazar.',
        ...WEAPON_ORDER.map((id, i) => {
            const w = WEAPONS[id];
            const kind = w.pellets > 1 ? `${w.pellets} saçma` : (w.auto ? 'otomatik' : 'yarı otomatik');
            const mag = id === 'rifle' ? `${numSuffix(CFG.baseMag)} şarjör (mağazadan ${CFG.maxMag}'a kadar büyür)` : `${numSuffix(w.mag)} şarjör`;
            const how = w.cost ? `mağazada ${w.cost} altın` : 'başlangıçta açık';
            return `${w.name} (${i + 1} tuşu): ${kind}, ${w.dmgMul}x hasar, ${mag}; ${how}.`;
        }),
        'Tabancanın yedek mermisi sınırsızdır; diğer silahların mermisi bitse bile tabancayla savaşmaya devam edebilirsin.',
        'Her öldürdüğün düşman, sahip olduğun silahlara biraz yedek mermi verir.',
        'Kafa vuruşu her silahta 2 kat hasar verir; nişangâh kırmızı yanar. Göğsün biraz üstüne nişan al.',
        'Koşarken ve havadayken atışların biraz dağılır; durarak ateş etmek daha isabetlidir.',
        `Mağazadaki Silah Hasarı yükseltmesi temel hasarı +${CFG.damageStep} artırır ve tüm silahlara kendi çarpanıyla işler (en fazla ${CFG.maxDamage}).`,
        'Her elin başında tüm silahların şarjörü ve yedek mermisi doldurulur.'
    ] },
    { id: 'grenade', title: '💣 Bomba', lines: () => [
        'G tuşu baktığın yöne bomba atar. Sağ alttaki panelde kaç bomban kaldığı yazar.',
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
        ...Object.values(ENEMY_TYPES).map(t => `${t.name}: ${{
            Er: 'kırmızı, standart asker.',
            'Koşucu': 'turuncu, hızlı ama zayıf; ateşi seyrek.',
            'Nişancı': 'mavi, uzakta durup isabetli ve güçlü ateş eder.',
            'Zırhlı': 'gri ve iri, çok dayanıklı; öldürünce fazla ödül verir.'
        }[t.name] || ''}${t.minWave ? ` ${t.minWave}. dalgadan itibaren çıkar.` : ''}`),
        'Dalgalar ilerledikçe düşmanlar yeni yetenekler kazanır (dalga başında duyurulur):',
        ...ENEMY_SKILLS.map(k => `${k.wave}. dalga: ${k.text}${k.needsPads ? ' (yalnızca rampalı bölümde, Space)' : ''}`),
        'Düşman yakına gelince temas hasarı verir; mesafeni koru.'
    ] },
    { id: 'drops', title: '🎁 Yerden Toplananlar', lines: () => [
        `Ölen düşman %${Math.round(CFG.dropChance * 100)} ihtimalle yere dönen, parlayan bir eşya bırakır.`,
        'Sarı kutu = Cephane: sahip olduğun her silaha bir şarjör yedek mermi.',
        'Mavi elmas = Kalkan: +25 kalkan (kalkanın doluysa alınmaz).',
        'Sarı para = Altın: bir düşman öldürme ödülü kadar altın.',
        'Yeşil top = Bomba: +1 bomba (çantan doluysa alınmaz).',
        'Eşyayı almak için üstünden geçmen yeterli.',
        `Eşyalar ${CFG.dropLife} saniye sonra kaybolur; son saniyelerde yanıp söner.`
    ] },
    { id: 'maps', title: '🗺️ Bölümler', lines: () => [
        ...MAP_IDS.map(id => `${MAPS[id].name}: ${MAPS[id].desc}.`),
        'Space\'te platformlar arasında yürünemez: turuncu zıplatma rampasına basınca karşı platforma fırlatılırsın.',
        'Çöl ve Kar Üssü\'ndeki gözetleme yerlerine basamak kasalarından zıplayarak çıkılır; yukarıdan uzağı görürsün.',
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
        `Gelişmiş Tüfek Şarjörü (${CFG.magCost} altın): tüfek şarjörü +${CFG.magStep}.`,
        `Ağır Kalkan (${CFG.shieldCost} altın): +${CFG.armorAmount} kalkan.`,
        ...UPGRADE_IDS.map(id => `${UPGRADES[id].name}: kalıcı yükseltme, ${UPGRADES[id].max} seviye; her seviyede fiyat artar (ilk seviye ${upgradeCost(id, 0)} altın).`),
        'Silahlar (Pompalı, Keskin Nişancı, Taramalı Tabanca) bir kez alınır ve kalıcı olarak açılır.',
        'Skinler silahın ve mermilerin rengini değiştirir. Sahip olduğun skine tıklayınca kuşanılır, kilitli olana tıklayınca satın alınır.'
    ] },
    { id: 'progress', title: '🏆 Rekorlar ve Başarımlar', lines: () => [
        'REKORLAR ekranında her bölüm için ayrı sekme vardır; her zorluk seviyesinin en iyi skoru, en uzak dalgası ve düello sonuçları yazar.',
        'Rekor kırınca oyun sonu ekranında "YENİ REKOR" yazar.',
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
        'Ayarlar her oyuncu için ayrı kaydedilir.'
    ] },
    { id: 'tips', title: '💡 İpuçları', lines: () => [
        'Siperin arkasında kalarak çatış; hasar almadığın sürece canın dolar.',
        'Düşmanları kafadan vur: hem 2 kat hasar hem fazladan skor.',
        'Tabancayı yedek silah olarak kullan: mermisi hiç bitmez.',
        'Nişancılar uzaktan vurur; önce onları temizle ya da Keskin Nişancı ile uzaktan karşılık ver.',
        'Zırhlılar çok dayanıklıdır; bomba ya da Pompalı ile yakından vur.',
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
