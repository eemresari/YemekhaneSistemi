const menuVeri = require('../veri/menuVeri');

// Controller SQL içermez: veriyi veri katmanından ister, iş kurallarını uygular
// (rolüne göre fiyat, rezervasyon açık mı) ve yanıtı hazırlar.

// ---- Girdi denetimi -------------------------------------------------------

// '2026-11-24' biçiminde ve takvimde gerçekten var olan bir gün mü? ('2026-02-30' geçersiz)
function gecerliTarihMi(metin) {
  if (typeof metin !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(metin)) return false;
  const gun = new Date(`${metin}T00:00:00Z`);
  return !Number.isNaN(gun.getTime()) && gun.toISOString().slice(0, 10) === metin;
}

// İsteğe bağlı sayı parametresi: yoksa null, geçerli pozitif tamsayıysa sayı, bozuksa hata.
function kimlikOku(deger) {
  if (deger === undefined) return { deger: null };
  if (typeof deger !== 'string' || !/^\d+$/.test(deger) || Number(deger) < 1) return { hata: true };
  return { deger: Number(deger) };
}

// ---- İş kuralları ---------------------------------------------------------

// Menüyü giriş yapan kullanıcı için hazırlar. Arayüz bu kararları vermez, yalnızca gösterir.
function menuyuHazirla(menu, kullanici, simdi) {
  const { ogrenci_fiyati, personel_fiyati, ...gorunen } = menu;

  // Fiyat rolüne göre seçilir; öğrenci dışındakiler (personel, yönetici) personel fiyatını öder.
  // Diğer fiyat arayüze hiç gönderilmez. (sp_rezervasyon_yap ile aynı kural)
  const fiyat = kullanici.rol === 'ogrenci' ? ogrenci_fiyati : personel_fiyati;

  // Rezervasyon neden kapalı? Sınır ve mesajlar sp_rezervasyon_yap ile aynıdır:
  // NOW() >= son saat ise süre dolmuştur.
  let pasifNeden = null;
  if (simdi >= menu.rezervasyon_son) {
    pasifNeden = 'Bu menü için rezervasyon süresi doldu.';
  } else if (menu.bos_yer <= 0) {
    pasifNeden = 'Yemekhane kapasitesi dolu.';
  }

  return { ...gorunen, fiyat, rezervasyon_acik: pasifNeden === null, pasif_neden: pasifNeden };
}

// ---- Uçlar ----------------------------------------------------------------

// GET /api/menu/secenekler
async function secenekler(req, res) {
  res.json(await menuVeri.secenekleriGetir());
}

// GET /api/menu/gunluk?tarih=2026-11-25&yemekhane=1&ogun=2   (hepsi isteğe bağlı)
async function gunluk(req, res) {
  const zaman = await menuVeri.sunucuZamani();
  const tarih = req.query.tarih ?? zaman.bugun;
  const yemekhane = kimlikOku(req.query.yemekhane);
  const ogun = kimlikOku(req.query.ogun);

  if (!gecerliTarihMi(tarih)) {
    return res.status(400).json({ hata: 'Geçersiz tarih. Biçim: YYYY-AA-GG.' });
  }
  if (yemekhane.hata || ogun.hata) {
    return res.status(400).json({ hata: 'Geçersiz yemekhane ya da öğün.' });
  }

  const menuler = await menuVeri.menulerGetir({
    baslangic: tarih,
    gunSayisi: 1,
    yemekhaneId: yemekhane.deger,
    ogunId: ogun.deger,
  });
  res.json({
    tarih,
    menuler: menuler.map((m) => menuyuHazirla(m, req.session.kullanici, zaman.simdi)),
  });
}

// GET /api/menu/haftalik?baslangic=2026-11-24   (yoksa bugünden başlar, 7 gün)
async function haftalik(req, res) {
  const zaman = await menuVeri.sunucuZamani();
  const baslangic = req.query.baslangic ?? zaman.bugun;

  if (!gecerliTarihMi(baslangic)) {
    return res.status(400).json({ hata: 'Geçersiz tarih. Biçim: YYYY-AA-GG.' });
  }

  const menuler = await menuVeri.menulerGetir({ baslangic, gunSayisi: 7 });
  res.json({
    baslangic,
    menuler: menuler.map((m) => menuyuHazirla(m, req.session.kullanici, zaman.simdi)),
  });
}

module.exports = { secenekler, gunluk, haftalik };
