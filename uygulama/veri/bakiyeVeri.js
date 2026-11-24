const { yazmaHavuzu, okumaHavuzu } = require('./baglanti');

// Bakiye ve hareket geçmişi okumadır: replikaya gider.
async function bakiyeGetir(kullaniciId) {
  const [[satir]] = await okumaHavuzu.execute('SELECT bakiye FROM kullanicilar WHERE id = ?', [kullaniciId]);
  return satir.bakiye;
}

// Son 100 hareket, yeniden eskiye. Rezervasyon ve iade hareketlerinde hangi menü olduğu da gelir.
async function hareketleriGetir(kullaniciId) {
  const [satirlar] = await okumaHavuzu.execute(
    `SELECT h.id, h.tur, h.tutar, h.aciklama, h.olusturma,
            m.tarih AS menu_tarih, o.ad AS ogun, yh.ad AS yemekhane
       FROM bakiye_hareketleri h
       LEFT JOIN rezervasyonlar r  ON r.id  = h.rezervasyon_id
       LEFT JOIN menuler m         ON m.id  = r.menu_id
       LEFT JOIN ogunler o         ON o.id  = m.ogun_id
       LEFT JOIN yemekhaneler yh   ON yh.id = m.yemekhane_id
      WHERE h.kullanici_id = ?
      ORDER BY h.olusturma DESC, h.id DESC
      LIMIT 100`,
    [kullaniciId]
  );
  return satirlar;
}

// Yükleme yazma işlemidir: kaynağa gider. 10–1000 TL kuralı yordamın içindedir.
async function bakiyeYukle(kullaniciId, tutar) {
  const [sonuclar] = await yazmaHavuzu.execute('CALL sp_bakiye_yukle(?, ?)', [kullaniciId, tutar]);
  return sonuclar[0][0];   // { hareket_id, bakiye }
}

module.exports = { bakiyeGetir, hareketleriGetir, bakiyeYukle };
