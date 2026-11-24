const yonetimVeri = require('../veri/yonetimVeri');
const menuVeri = require('../veri/menuVeri');
const { gecerliTarihMi, gecerliKimlik, kimlikOku, gecerliTutar } = require('./denetim');

const HATA_MESAJI = {
  menu_var: [409, 'Bu yemekhane, tarih ve öğün için zaten bir menü var.'],
  gecersiz_kayit: [400, 'Seçilen yemekhane, öğün ya da yemeklerden biri bulunamadı.'],
};

// Fiyatlar ve yemek listesi: oluşturma ve düzenlemede ortak denetim.
// Hata varsa mesajı, yoksa temizlenmiş değerleri döndürür.
function fiyatVeYemekleriOku(govde) {
  const { ogrenci_fiyati: ogrenciFiyati, personel_fiyati: personelFiyati, yemekler } = govde;
  if (!gecerliTutar(ogrenciFiyati) || !gecerliTutar(personelFiyati)) {
    return { hata: 'Fiyatlar sıfır ya da pozitif, en fazla iki ondalıklı sayı olmalıdır.' };
  }
  if (!Array.isArray(yemekler) || yemekler.length === 0) {
    return { hata: 'En az bir yemek seçmelisiniz.' };
  }
  if (!yemekler.every(gecerliKimlik)) {
    return { hata: 'Geçersiz yemek.' };
  }
  return { ogrenciFiyati, personelFiyati, yemekIdleri: [...new Set(yemekler)] };   // tekrarlar atılır
}

// GET /api/yonetim/menuler?baslangic=2026-11-24
async function menuler(req, res) {
  const zaman = await menuVeri.sunucuZamani();
  const baslangic = req.query.baslangic ?? zaman.bugun;
  if (!gecerliTarihMi(baslangic)) {
    return res.status(400).json({ hata: 'Geçersiz tarih. Biçim: YYYY-AA-GG.' });
  }
  const satirlar = await yonetimVeri.menuRaporu(baslangic, 7);
  res.json({
    baslangic,
    menuler: satirlar.map((m) => ({ ...m, duzenlenebilir: m.tarih >= zaman.bugun })),
  });
}

// GET /api/yonetim/yemekler
async function yemekler(req, res) {
  res.json({ kategoriler: await yonetimVeri.yemekKatalogu() });
}

// GET /api/yonetim/menuler/:id
async function menuDetay(req, res) {
  const id = kimlikOku(req.params.id);
  if (id.hata) return res.status(400).json({ hata: 'Geçersiz menü.' });

  const [zaman, menu] = await Promise.all([menuVeri.sunucuZamani(), yonetimVeri.menuGetir(id.deger)]);
  if (!menu) return res.status(404).json({ hata: 'Menü bulunamadı.' });
  res.json({ menu: { ...menu, duzenlenebilir: menu.tarih >= zaman.bugun } });
}

// POST /api/yonetim/menuler
async function olustur(req, res) {
  const govde = req.body ?? {};
  const { yemekhane_id: yemekhaneId, ogun_id: ogunId, tarih } = govde;

  if (!gecerliKimlik(yemekhaneId) || !gecerliKimlik(ogunId)) {
    return res.status(400).json({ hata: 'Geçersiz yemekhane ya da öğün.' });
  }
  if (!gecerliTarihMi(tarih)) {
    return res.status(400).json({ hata: 'Geçersiz tarih. Biçim: YYYY-AA-GG.' });
  }
  const zaman = await menuVeri.sunucuZamani();
  if (tarih < zaman.bugun) {
    return res.status(400).json({ hata: 'Geçmiş bir tarihe menü eklenemez.' });
  }
  const girdi = fiyatVeYemekleriOku(govde);
  if (girdi.hata) return res.status(400).json({ hata: girdi.hata });

  const sonuc = await yonetimVeri.menuOlustur({ yemekhaneId, tarih, ogunId, ...girdi });
  if (sonuc.hata) {
    const [durum, mesaj] = HATA_MESAJI[sonuc.hata];
    return res.status(durum).json({ hata: mesaj });
  }
  res.status(201).json({ menu_id: sonuc.menuId });
}

// PUT /api/yonetim/menuler/:id   (yalnızca fiyatlar ve yemekler değişir)
async function guncelle(req, res) {
  const id = kimlikOku(req.params.id);
  if (id.hata) return res.status(400).json({ hata: 'Geçersiz menü.' });

  const [zaman, mevcut] = await Promise.all([menuVeri.sunucuZamani(), yonetimVeri.menuGetir(id.deger)]);
  if (!mevcut) return res.status(404).json({ hata: 'Menü bulunamadı.' });
  if (mevcut.tarih < zaman.bugun) {
    return res.status(409).json({ hata: 'Geçmiş menüler düzenlenemez.' });
  }

  const girdi = fiyatVeYemekleriOku(req.body ?? {});
  if (girdi.hata) return res.status(400).json({ hata: girdi.hata });

  // Fiyat değişikliği mevcut rezervasyonları etkilemez: her rezervasyon ödediği ücreti saklar.
  const sonuc = await yonetimVeri.menuGuncelle(id.deger, girdi);
  if (sonuc.hata) {
    const [durum, mesaj] = HATA_MESAJI[sonuc.hata];
    return res.status(durum).json({ hata: mesaj });
  }
  res.json({ menu_id: id.deger });
}

module.exports = { menuler, yemekler, menuDetay, olustur, guncelle };
