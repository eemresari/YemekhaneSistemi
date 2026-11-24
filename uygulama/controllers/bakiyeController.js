const bakiyeVeri = require('../veri/bakiyeVeri');
const { gecerliTutar } = require('./denetim');

// GET /api/bakiye
async function ozet(req, res) {
  const kullaniciId = req.session.kullanici.id;
  // İki okuma birbirinden bağımsız: aynı anda çalıştırılır
  const [bakiye, hareketler] = await Promise.all([
    bakiyeVeri.bakiyeGetir(kullaniciId),
    bakiyeVeri.hareketleriGetir(kullaniciId),
  ]);
  res.json({ bakiye, hareketler });
}

// POST /api/bakiye/yukle   gövde: { "tutar": 100 }
async function yukle(req, res) {
  const tutar = req.body?.tutar;

  // Yalnızca biçim denetlenir: pozitif, en fazla iki ondalıklı bir sayı mı?
  // 10–1000 TL sınırı burada tekrar yazılmaz; sp_bakiye_yukle'nin kuralı ve mesajı kullanılır.
  if (!gecerliTutar(tutar)) {
    return res.status(400).json({ hata: 'Geçersiz tutar.' });
  }

  const sonuc = await bakiyeVeri.bakiyeYukle(req.session.kullanici.id, tutar);
  // Dönen bakiye yordamın transaction'ı içinde kaynakta hesaplanmıştır.
  res.status(201).json(sonuc);
}

module.exports = { ozet, yukle };
