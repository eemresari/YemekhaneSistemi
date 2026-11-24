const { okumaHavuzu } = require('./baglanti');

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
// kullaniciId: o kullanıcının bu menüde geçerli (aktif ya da kullanılmış) rezervasyonu var mı?
async function menulerGetir({ kullaniciId, baslangic, gunSayisi = 1, yemekhaneId = null, ogunId = null }) {
  const [satirlar] = await okumaHavuzu.execute(
    `SELECT d.menu_id, d.tarih, d.yemekhane_id, d.yemekhane, d.ogun_id, d.ogun,
            d.rezervasyon_son, d.ogrenci_fiyati, d.personel_fiyati,
            d.yemek_id, d.yemek, d.kategori, d.kalori, d.vejetaryen, d.alerjenler,
            o.kapasite, o.bos_yer,
            r.id AS rezervasyon_id
       FROM v_menu_detay d
       JOIN v_menu_doluluk o ON o.menu_id = d.menu_id
       LEFT JOIN rezervasyonlar r          -- kişi başına menü başına tek kayıt: satır çoğalmaz
              ON r.menu_id = d.menu_id
             AND r.kullanici_id = ?
             AND r.durum IN ('aktif', 'kullanildi')
      WHERE d.tarih >= ?
        AND d.tarih < DATE_ADD(?, INTERVAL ? DAY)
        AND (? IS NULL OR d.yemekhane_id = ?)
        AND (? IS NULL OR d.ogun_id = ?)
      ORDER BY d.tarih, d.yemekhane_id, d.ogun_sira, d.kategori_sira, d.yemek`,
    [kullaniciId, baslangic, baslangic, gunSayisi, yemekhaneId, yemekhaneId, ogunId, ogunId]
  );
  return menuleriGrupla(satirlar);
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
        kapasite: s.kapasite,
        bos_yer: s.bos_yer,
        rezervasyonum: s.rezervasyon_id !== null,
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
    });
    menu.toplam_kalori += s.kalori;
  }
  return [...menuler.values()];
}

module.exports = { sunucuZamani, secenekleriGetir, menulerGetir };
