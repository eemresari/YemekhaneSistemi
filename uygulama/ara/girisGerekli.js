// Ara katman (middleware): giriş yapmamış kullanıcının isteğini 401 ile durdurur.
// Korunması gereken her rotada Controller'dan önce kullanılır.
function girisGerekli(req, res, next) {
  if (!req.session.kullanici) {
    return res.status(401).json({ hata: 'Bu işlem için giriş yapmalısınız.' });
  }
  next();
}

module.exports = girisGerekli;
