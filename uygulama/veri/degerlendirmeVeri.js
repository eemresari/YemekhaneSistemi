const { yazmaHavuzu, okumaHavuzu } = require('./baglanti');

// Kullanıcının kullandığı menüler ve varsa verdiği puan/yorum. Listeleme: replikadan.
async function kullanilmisMenuler(kullaniciId) {
  const [satirlar] = await okumaHavuzu.execute(
    `SELECT r.menu_id, m.tarih, o.ad AS ogun, yh.ad AS yemekhane,
            d.puan, d.yorum
       FROM rezervasyonlar r
       JOIN menuler m       ON m.id  = r.menu_id
       JOIN ogunler o       ON o.id  = m.ogun_id
       JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
       LEFT JOIN degerlendirmeler d
              ON d.menu_id = r.menu_id AND d.kullanici_id = r.kullanici_id
      WHERE r.kullanici_id = ? AND r.durum = 'kullanildi'
      ORDER BY m.tarih DESC, o.sira`,
    [kullaniciId]
  );
  return satirlar;
}

// Kullanıcı bu menüyü kullandı mı? Bu okuma bir yazma kararının dayanağıdır; replika birkaç
// saniye geride olabileceği için KAYNAKTAN okunur (yazmaHavuzu).
async function menuyuKullandiMi(kullaniciId, menuId) {
  const [satirlar] = await yazmaHavuzu.execute(
    `SELECT 1 FROM rezervasyonlar
      WHERE kullanici_id = ? AND menu_id = ? AND durum = 'kullanildi'`,
    [kullaniciId, menuId]
  );
  return satirlar.length > 0;
}

// Değerlendirmeyi kaynağa yazar. Aynı kişi aynı menüye ikinci kez oy verirse tablodaki
// UNIQUE (kullanici_id, menu_id) kuralı reddeder; bu durumda null döner.
async function degerlendirmeEkle(kullaniciId, menuId, puan, yorum) {
  try {
    const [sonuc] = await yazmaHavuzu.execute(
      'INSERT INTO degerlendirmeler (kullanici_id, menu_id, puan, yorum) VALUES (?, ?, ?, ?)',
      [kullaniciId, menuId, puan, yorum]
    );
    return sonuc.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return null;   // MySQL'e özgü kod Controller'a sızmasın
    throw err;
  }
}

module.exports = { kullanilmisMenuler, menuyuKullandiMi, degerlendirmeEkle };
