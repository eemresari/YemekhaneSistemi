// Yalnızca yönetici rolündeki kullanıcıları geçirir.
// Giriş yoksa 401 (kim olduğunu bilmiyoruz), giriş var ama rol uygun değilse 403 (biliyoruz, yetkisi yok).
function yoneticiGerekli(req, res, next) {
  const kullanici = req.session.kullanici;
  if (!kullanici) {
    return res.status(401).json({ hata: 'Bu işlem için giriş yapmalısınız.' });
  }
  if (kullanici.rol !== 'yonetici') {
    return res.status(403).json({ hata: 'Bu işlem için yönetici yetkisi gerekir.' });
  }
  next();
}

module.exports = yoneticiGerekli;
