const { okumaHavuzu } = require('./baglanti');
const menuOnbellek = require('./menuOnbellek');

// Bu dosyadaki işlemlerin hepsi okumadır; replikaya gider.
// Burada yalnızca veri getirilir. Fiyat seçimi, "rezervasyon açık mı" gibi iş kuralları
// Controller'dadır.

// Veritabanı sunucusunun şu anki zamanı. "Bugün" ve "son saat geçti mi" kararları
// uygulamanın değil veritabanının saatine göre verilir (rezervasyon yordamı da onu kullanır).
async function sunucuZamani() {
  const [[satir]] = await okumaHavuzu.execute('SELECT CURDATE() AS bugun, NOW() AS simdi');
  return satir;   // { bugun: '2026-11-24', simdi: '2026-11-24 15:46:26' }
}

// Arayüzdeki seçim kutuları için yemekhane ve öğün listesi
async function secenekleriGetir() {
  const [yemekhaneler] = await okumaHavuzu.execute('SELECT id, ad FROM yemekhaneler ORDER BY id');
  const [ogunler] = await okumaHavuzu.execute('SELECT id, ad FROM ogunler ORDER BY sira');
  return { yemekhaneler, ogunler };
}

// 'baslangic' gününden başlayarak 'gunSayisi' günlük menüleri getirir.
// Günün menüsü için gunSayisi = 1, haftalık menü için 7.
// yemekhaneId / ogunId verilirse yalnızca o yemekhane / öğün gelir (null = hepsi).
//
// Menü İÇERİĞİ (yemekler, fiyatlar, son saat) önbellekten gelir; önbellekte yoksa replikadan
// okunup önbelleğe yazılır. ANLIK bilgiler (boş yer, kullanıcının rezervasyonu) her istekte
// replikadan okunur, çünkü biri her rezervasyonda değişir, öteki kişiye özeldir.
async function menulerGetir({ kullaniciId, baslangic, gunSayisi = 1, yemekhaneId = null, ogunId = null }) {
  // 1. Bu istek hangi anahtarlara bakmalı? (gün × yemekhane × öğün, sıralı)
  const anahtarlar = await anahtarlariHazirla({ baslangic, gunSayisi, yemekhaneId, ogunId });

  // 2. Önce Redis'e sor
  const icerikler = await menuOnbellek.oku(anahtarlar);
  const eksikler = anahtarlar.filter((a) => !icerikler.has(a));

  // 3. Önbellekte olmayanları replikadan getir ve önbelleğe yaz (bugün gece yarısına kadar)
  if (eksikler.length) {
    const [veritabanindan, gunSonu] = await Promise.all([
      menuIcerikleriGetir(okumaHavuzu, { baslangic, gunSayisi, yemekhaneId, ogunId }),
      gunSonuZamani(),
    ]);
    await Promise.all(eksikler.map((a) => {
      const icerik = veritabanindan.get(a) ?? null;   // null = o gün o öğünde menü yok
      icerikler.set(a, icerik);
      return menuOnbellek.bosaYaz(a, icerik, gunSonu);
    }));
  }
  menuOnbellek.gunlugeYaz(anahtarlar, eksikler);

  // 4. Anlık bilgileri ekle
  const menuler = anahtarlar.map((a) => icerikler.get(a)).filter((m) => m !== null);
  const anlik = await anlikBilgileriGetir(kullaniciId, menuler.map((m) => m.menu_id));
  return menuler.map((m) => ({ ...m, ...anlik.get(m.menu_id) }));
}

// Gün × yemekhane × öğün sırasıyla önbellek anahtarları (veritabanındaki menü sırasıyla aynı).
async function anahtarlariHazirla({ baslangic, gunSayisi, yemekhaneId, ogunId }) {
  const [ciftler] = await okumaHavuzu.execute(
    `SELECT y.id AS yemekhane_id, o.id AS ogun_id
       FROM yemekhaneler y CROSS JOIN ogunler o
      WHERE (? IS NULL OR y.id = ?) AND (? IS NULL OR o.id = ?)
      ORDER BY y.id, o.sira`,
    [yemekhaneId, yemekhaneId, ogunId, ogunId]
  );
  const anahtarlar = [];
  for (const tarih of gunleriSirala(baslangic, gunSayisi)) {
    for (const c of ciftler) anahtarlar.push(menuOnbellek.anahtar(c.yemekhane_id, tarih, c.ogun_id));
  }
  return anahtarlar;
}

// '2026-11-24', 3 → ['2026-11-24', '2026-11-25', '2026-11-26']  (UTC'de hesaplanır: saat kayması olmaz)
function gunleriSirala(baslangic, gunSayisi) {
  const [yil, ay, gun] = baslangic.split('-').map(Number);
  return Array.from({ length: gunSayisi }, (_, i) =>
    new Date(Date.UTC(yil, ay - 1, gun + i)).toISOString().slice(0, 10));
}

// Bugün gece yarısı, Unix saniyesi olarak (veritabanının saatine göre). Önbelleğin silinme anı.
async function gunSonuZamani() {
  const [[satir]] = await okumaHavuzu.execute(
    'SELECT UNIX_TIMESTAMP(CURDATE() + INTERVAL 1 DAY) AS gun_sonu'
  );
  return Number(satir.gun_sonu);
}

// Boş yer ve kullanıcının bu menülerde geçerli (aktif ya da kullanılmış) rezervasyonu var mı?
// Dönüş: Map(menu_id → { kapasite, bos_yer, rezervasyonum })
async function anlikBilgileriGetir(kullaniciId, menuIdleri) {
  if (!menuIdleri.length) return new Map();
  const [satirlar] = await okumaHavuzu.execute(
    `SELECT o.menu_id, o.kapasite, o.bos_yer, r.id AS rezervasyon_id
       FROM v_menu_doluluk o
       LEFT JOIN rezervasyonlar r          -- kişi başına menü başına tek kayıt: satır çoğalmaz
              ON r.menu_id = o.menu_id
             AND r.kullanici_id = ?
             AND r.durum IN ('aktif', 'kullanildi')
      WHERE o.menu_id IN (${menuIdleri.map(() => '?').join(', ')})`,
    [kullaniciId, ...menuIdleri]
  );
  return new Map(satirlar.map((s) => [s.menu_id, {
    kapasite: s.kapasite,
    bos_yer: s.bos_yer,
    rezervasyonum: s.rezervasyon_id !== null,
  }]));
}

// Menü içeriklerini veritabanından getirir. Dönüş: Map(önbellek anahtarı → içerik)
// havuz parametre: okuyan istek replikayı, yönetici güncellemesi kaynağı kullanır (Adım 3.4).
async function menuIcerikleriGetir(havuz, { baslangic, gunSayisi = 1, yemekhaneId = null, ogunId = null }) {
  const [satirlar] = await havuz.execute(
    `SELECT d.menu_id, d.tarih, d.yemekhane_id, d.yemekhane, d.ogun_id, d.ogun,
            d.rezervasyon_son, d.ogrenci_fiyati, d.personel_fiyati,
            d.yemek_id, d.yemek, d.kategori, d.kalori, d.vejetaryen, d.alerjenler, d.alerjen_idler,
            o.yarim_porsiyon
       FROM v_menu_detay d
       JOIN ogunler o ON o.id = d.ogun_id     -- Aşama 4: bu öğünde yarım porsiyon var mı?
      WHERE d.tarih >= ?
        AND d.tarih < DATE_ADD(?, INTERVAL ? DAY)
        AND (? IS NULL OR d.yemekhane_id = ?)
        AND (? IS NULL OR d.ogun_id = ?)
      ORDER BY d.tarih, d.yemekhane_id, d.ogun_sira, d.kategori_sira, d.yemek`,
    [baslangic, baslangic, gunSayisi, yemekhaneId, yemekhaneId, ogunId, ogunId]
  );
  const icerikler = new Map();
  for (const menu of menuleriGrupla(satirlar)) {
    icerikler.set(menuOnbellek.anahtar(menu.yemekhane_id, menu.tarih, menu.ogun_id), menu);
  }
  return icerikler;
}

// View menüdeki her yemek için ayrı bir satır döndürür. Burada menü başına tek nesnede
// toplanır ve toplam kalori hesaplanır (view bunu bizden bekliyor).
function menuleriGrupla(satirlar) {
  const menuler = new Map();
  for (const s of satirlar) {
    if (!menuler.has(s.menu_id)) {
      menuler.set(s.menu_id, {
        menu_id: s.menu_id,
        tarih: s.tarih,
        yemekhane_id: s.yemekhane_id,
        yemekhane: s.yemekhane,
        ogun_id: s.ogun_id,
        ogun: s.ogun,
        rezervasyon_son: s.rezervasyon_son,
        ogrenci_fiyati: s.ogrenci_fiyati,
        personel_fiyati: s.personel_fiyati,
        yarim_porsiyon: Boolean(s.yarim_porsiyon),   // Aşama 4
        toplam_kalori: 0,
        yemekler: [],
      });
    }
    const menu = menuler.get(s.menu_id);
    menu.yemekler.push({
      id: s.yemek_id,
      ad: s.yemek,
      kategori: s.kategori,
      kalori: s.kalori,
      vejetaryen: Boolean(s.vejetaryen),
      alerjenler: s.alerjenler ? s.alerjenler.split(', ') : [],
      alerjen_idler: s.alerjen_idler ? s.alerjen_idler.split(',').map(Number) : [],   // Aşama 4
    });
    menu.toplam_kalori += s.kalori;
  }
  return [...menuler.values()];
}

module.exports = { sunucuZamani, secenekleriGetir, menulerGetir, menuIcerikleriGetir, gunSonuZamani };
