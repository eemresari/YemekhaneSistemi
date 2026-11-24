const bcrypt = require('bcryptjs');
const kullaniciVeri = require('../veri/kullaniciVeri');
const profilVeri = require('../veri/profilVeri');

// POST /api/giris  { eposta, sifre }
async function giris(req, res) {
  const { eposta, sifre } = req.body ?? {};
  if (!eposta || !sifre) {
    return res.status(400).json({ hata: 'E-posta ve şifre gerekli.' });
  }

  const kullanici = await kullaniciVeri.epostaIleBul(eposta);

  // Şifre açık hâliyle hiçbir yerde saklanmaz: bcrypt, girilen şifreyi
  // kayıtlı özetteki tuzla yeniden özetler ve iki özeti karşılaştırır.
  const sifreDogru = kullanici !== null && await bcrypt.compare(sifre, kullanici.sifre_hash);

  // E-posta mı yanlış, şifre mi? Bilerek aynı mesaj: hangi e-postaların
  // kayıtlı olduğu dışarıya sızmasın.
  if (!sifreDogru) {
    return res.status(401).json({ hata: 'E-posta ya da şifre hatalı.' });
  }
  if (!kullanici.aktif) {
    return res.status(403).json({ hata: 'Hesabınız pasif durumda.' });
  }

  // Girişten önce oturum kimliğini yenile (session fixation saldırısına karşı)
  await new Promise((tamam, hata) => req.session.regenerate((e) => (e ? hata(e) : tamam())));

  // Oturuma yalnızca gereken bilgiler yazılır; şifre özeti yazılmaz.
  // alerjenler (Aşama 4): menüdeki uyarı için her istekte veritabanına sorulmasın diye oturumda.
  req.session.kullanici = {
    id: kullanici.id,
    ad: kullanici.ad,
    soyad: kullanici.soyad,
    rol: kullanici.rol,
    alerjenler: await profilVeri.kullaniciAlerjenleri(kullanici.id),
  };
  res.json({ kullanici: req.session.kullanici });
}

// POST /api/cikis
async function cikis(req, res) {
  await new Promise((tamam, hata) => req.session.destroy((e) => (e ? hata(e) : tamam())));
  res.clearCookie('yemekhane.sid');
  res.json({ durum: 'Çıkış yapıldı.' });
}

// GET /api/ben  (giriş yapmış kullanıcının bilgisi)
function ben(req, res) {
  res.json({ kullanici: req.session.kullanici });
}

module.exports = { giris, cikis, ben };
