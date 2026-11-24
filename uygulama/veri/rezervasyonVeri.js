const { yazmaHavuzu, okumaHavuzu } = require('./baglanti');

// Rezervasyon ve iptal yazma işlemidir: kaynak sunucuya (yazmaHavuzu) gider.
// Kuralların hepsi (süre, tekrar, kapasite, bakiye) yordamların içindedir;
// kural çiğnenirse yordam SQLSTATE 45000 ve Türkçe mesajla hata fırlatır.

// porsiyon: 'tam' ya da 'yarim' (Aşama 4). Yarım porsiyon ücreti ve "kahvaltıda yok" kuralı yordamda.
async function rezervasyonYap(kullaniciId, menuId, porsiyon) {
  // CALL'ın sonucu: [ [dönen satırlar], çalıştırma bilgisi ]
  const [sonuclar] = await yazmaHavuzu.execute(
    'CALL sp_rezervasyon_yap(?, ?, ?)', [kullaniciId, menuId, porsiyon]
  );
  return sonuclar[0][0];   // { rezervasyon_id, ucret, bakiye, porsiyon }
}

async function rezervasyonIptal(kullaniciId, rezervasyonId) {
  const [sonuclar] = await yazmaHavuzu.execute('CALL sp_rezervasyon_iptal(?, ?)', [kullaniciId, rezervasyonId]);
  return sonuclar[0][0];   // { rezervasyon_id, iade, bakiye }
}

// Listeleme bir okuma işlemidir: replikaya (okumaHavuzu) gider.
async function kullanicininRezervasyonlari(kullaniciId) {
  const [satirlar] = await okumaHavuzu.execute(
    `SELECT r.id, r.menu_id, r.durum, r.porsiyon, r.ucret, r.olusturma, r.kullanma_zamani, r.iptal_zamani,
            m.tarih, yh.ad AS yemekhane, o.ad AS ogun,
            TIMESTAMP(m.tarih, o.son_saat) AS rezervasyon_son
       FROM rezervasyonlar r
       JOIN menuler m       ON m.id  = r.menu_id
       JOIN ogunler o       ON o.id  = m.ogun_id
       JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
      WHERE r.kullanici_id = ?
      ORDER BY m.tarih DESC, o.sira, yh.id`,
    [kullaniciId]
  );
  return satirlar;
}

module.exports = { rezervasyonYap, rezervasyonIptal, kullanicininRezervasyonlari };
