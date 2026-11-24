const rezervasyonVeri = require('../veri/rezervasyonVeri');
const menuVeri = require('../veri/menuVeri');

// Pozitif tamsayı mı? (JSON gövdesinden gelen kimlikler için)
function gecerliKimlik(deger) {
  return Number.isInteger(deger) && deger > 0;
}

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

// POST /api/rezervasyonlar   gövde: { "menu_id": 52 }
async function yap(req, res) {
  const menuId = req.body?.menu_id;
  if (!gecerliKimlik(menuId)) {
    return res.status(400).json({ hata: 'Geçersiz menü.' });
  }

  // Kullanıcı kimliği istekten değil oturumdan alınır: kimse başkası adına rezervasyon yapamaz.
  // Yordamın hatası (45000) burada yakalanmaz; index.js'teki hata ara katmanı 409'a çevirir.
  const sonuc = await rezervasyonVeri.rezervasyonYap(req.session.kullanici.id, menuId);

  // Dönen bakiye yordamın transaction'ı içinde kaynakta hesaplanmıştır (replikadan okunmaz).
  res.status(201).json(sonuc);
}

// POST /api/rezervasyonlar/:id/iptal
async function iptal(req, res) {
  const id = req.params.id;
  if (!/^\d+$/.test(id) || Number(id) < 1) {
    return res.status(400).json({ hata: 'Geçersiz rezervasyon.' });
  }

  // Rezervasyonun bu kullanıcıya ait olup olmadığını yordam denetler;
  // başkasınınki "Rezervasyon bulunamadı." döner (bilgi sızdırmamak için).
  const sonuc = await rezervasyonVeri.rezervasyonIptal(req.session.kullanici.id, Number(id));
  res.json(sonuc);
}

module.exports = { liste, yap, iptal };
