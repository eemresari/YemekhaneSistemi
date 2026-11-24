const rezervasyonVeri = require('../veri/rezervasyonVeri');
const menuVeri = require('../veri/menuVeri');
const { gecerliKimlik, kimlikOku } = require('./denetim');

// GET /api/rezervasyonlar
async function liste(req, res) {
  const zaman = await menuVeri.sunucuZamani();
  const satirlar = await rezervasyonVeri.kullanicininRezervasyonlari(req.session.kullanici.id);

  // İptal edilebilir mi? Kural sp_rezervasyon_iptal ile aynı: yalnızca aktif olan ve
  // son saati geçmemiş rezervasyon. Arayüz bu kararı vermez, yalnızca düğmeyi gösterir.
  const rezervasyonlar = satirlar.map((r) => ({
    ...r,
    iptal_edilebilir: r.durum === 'aktif' && zaman.simdi < r.rezervasyon_son,
  }));
  res.json({ rezervasyonlar });
}

// POST /api/rezervasyonlar   gövde: { "menu_id": 52, "porsiyon": "yarim" }   (porsiyon yoksa 'tam')
async function yap(req, res) {
  const menuId = req.body?.menu_id;
  const porsiyon = req.body?.porsiyon ?? 'tam';
  if (!gecerliKimlik(menuId)) {
    return res.status(400).json({ hata: 'Geçersiz menü.' });
  }
  // Yalnızca biçim denetimi; "kahvaltıda yarım porsiyon yok" kuralı yordamda.
  if (porsiyon !== 'tam' && porsiyon !== 'yarim') {
    return res.status(400).json({ hata: 'Geçersiz porsiyon.' });
  }

  // Kullanıcı kimliği istekten değil oturumdan alınır: kimse başkası adına rezervasyon yapamaz.
  // Yordamın hatası (45000) burada yakalanmaz; index.js'teki hata ara katmanı 409'a çevirir.
  const sonuc = await rezervasyonVeri.rezervasyonYap(req.session.kullanici.id, menuId, porsiyon);

  // Dönen bakiye yordamın transaction'ı içinde kaynakta hesaplanmıştır (replikadan okunmaz).
  res.status(201).json(sonuc);
}

// POST /api/rezervasyonlar/:id/iptal
async function iptal(req, res) {
  const id = kimlikOku(req.params.id);
  if (id.hata) {
    return res.status(400).json({ hata: 'Geçersiz rezervasyon.' });
  }

  // Rezervasyonun bu kullanıcıya ait olup olmadığını yordam denetler;
  // başkasınınki "Rezervasyon bulunamadı." döner (bilgi sızdırmamak için).
  const sonuc = await rezervasyonVeri.rezervasyonIptal(req.session.kullanici.id, id.deger);
  res.json(sonuc);
}

module.exports = { liste, yap, iptal };
