const profilVeri = require('../veri/profilVeri');
const { gecerliKimlik } = require('./denetim');

// GET /api/profil   → bütün alerjenler ve kullanıcının seçtikleri
async function getir(req, res) {
  const alerjenler = await profilVeri.tumAlerjenler();
  const secili = (req.session.kullanici.alerjenler ?? []).map((a) => a.id);
  res.json({ kullanici: req.session.kullanici, alerjenler, secili });
}

// PUT /api/profil/alerjenler   gövde: { "alerjenler": [1, 4] }   (boş dizi = hiçbiri)
async function alerjenleriKaydet(req, res) {
  const liste = req.body?.alerjenler;
  if (!Array.isArray(liste) || !liste.every(gecerliKimlik)) {
    return res.status(400).json({ hata: 'Geçersiz alerjen listesi.' });
  }

  const kaydedilen = await profilVeri.alerjenleriKaydet(req.session.kullanici.id, [...new Set(liste)]);
  if (kaydedilen === null) {
    return res.status(400).json({ hata: 'Seçilen alerjenlerden biri bulunamadı.' });
  }

  // Menüdeki uyarı oturumdaki listeye göre verilir: hemen güncellenir (Redis'teki oturum)
  req.session.kullanici = { ...req.session.kullanici, alerjenler: kaydedilen };
  res.json({ alerjenler: kaydedilen });
}

module.exports = { getir, alerjenleriKaydet };
