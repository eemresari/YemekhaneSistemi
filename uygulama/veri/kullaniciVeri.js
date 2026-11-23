const { okumaHavuzu } = require('./baglanti');

// E-postaya göre kullanıcıyı bulur. Okuma işlemi olduğu için replikaya gider.
// Bulamazsa null döner.
async function epostaIleBul(eposta) {
  const [satirlar] = await okumaHavuzu.execute(
    `SELECT id, ad, soyad, eposta, sifre_hash, rol, aktif
       FROM kullanicilar
      WHERE eposta = ?`,
    [eposta]
  );
  return satirlar[0] ?? null;
}

module.exports = { epostaIleBul };
