const degerlendirmeVeri = require('../veri/degerlendirmeVeri');

// Bu ekranın iş kuralı için yordam yoktur; şemanın notu: "Yalnızca kullanılmış menü
// değerlendirilir kuralı uygulamaya aittir." Kural bu Controller'da uygulanır.

const YORUM_EN_FAZLA = 500;   // degerlendirmeler.yorum VARCHAR(500)

// GET /api/degerlendirmeler
async function liste(req, res) {
  const menuler = await degerlendirmeVeri.kullanilmisMenuler(req.session.kullanici.id);
  res.json({ menuler });
}

// POST /api/degerlendirmeler   gövde: { "menu_id": 5, "puan": 4, "yorum": "..." }
async function kaydet(req, res) {
  const { menu_id: menuId, puan, yorum } = req.body ?? {};

  // ---- Girdi denetimi
  if (!Number.isInteger(menuId) || menuId < 1) {
    return res.status(400).json({ hata: 'Geçersiz menü.' });
  }
  if (!Number.isInteger(puan) || puan < 1 || puan > 5) {
    return res.status(400).json({ hata: 'Puan 1 ile 5 arasında bir tamsayı olmalıdır.' });
  }
  if (yorum !== undefined && yorum !== null && typeof yorum !== 'string') {
    return res.status(400).json({ hata: 'Geçersiz yorum.' });
  }
  const temizYorum = yorum?.trim() || null;   // boş yorum kaydedilmez
  if (temizYorum !== null && temizYorum.length > YORUM_EN_FAZLA) {
    return res.status(400).json({ hata: `Yorum en fazla ${YORUM_EN_FAZLA} karakter olabilir.` });
  }

  // ---- İş kuralı: yalnızca kullanılmış (turnikeden geçilmiş) menü değerlendirilir
  const kullaniciId = req.session.kullanici.id;
  if (!(await degerlendirmeVeri.menuyuKullandiMi(kullaniciId, menuId))) {
    return res.status(403).json({ hata: 'Yalnızca kullandığınız menüleri değerlendirebilirsiniz.' });
  }

  const id = await degerlendirmeVeri.degerlendirmeEkle(kullaniciId, menuId, puan, temizYorum);
  if (id === null) {
    return res.status(409).json({ hata: 'Bu menüyü zaten değerlendirdiniz.' });
  }
  res.status(201).json({ menu_id: menuId, puan, yorum: temizYorum });
}

module.exports = { liste, kaydet };
