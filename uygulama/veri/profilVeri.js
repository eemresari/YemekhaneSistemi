const { okumaHavuzu, transactionIcinde } = require('./baglanti');

// Profil: kullanıcının alerjenleri (Aşama 4, tablo: kullanici_alerjenleri)

// Seçim listesi için bütün alerjenler. Okuma: replikaya gider.
async function tumAlerjenler() {
  const [satirlar] = await okumaHavuzu.execute('SELECT id, ad FROM alerjenler ORDER BY ad');
  return satirlar;
}

// Kullanıcının seçtiği alerjenler. Girişte oturuma yazılır. Okuma: replikaya gider.
async function kullaniciAlerjenleri(kullaniciId) {
  const [satirlar] = await okumaHavuzu.execute(
    `SELECT a.id, a.ad
       FROM kullanici_alerjenleri ka JOIN alerjenler a ON a.id = ka.alerjen_id
      WHERE ka.kullanici_id = ?
      ORDER BY a.ad`,
    [kullaniciId]
  );
  return satirlar;
}

// Kullanıcının alerjen listesini değiştirir: eskiler silinir, yeniler eklenir (tek transaction).
// Kaydedilen liste aynı bağlantıdan, yani KAYNAKTAN okunup döner: hemen oturuma yazılacak,
// replika değişikliği henüz almamış olabilir.
// Olmayan bir alerjen kimliği gelirse null döner.
async function alerjenleriKaydet(kullaniciId, alerjenIdleri) {
  try {
    return await transactionIcinde(async (baglanti) => {
      await baglanti.execute('DELETE FROM kullanici_alerjenleri WHERE kullanici_id = ?', [kullaniciId]);
      if (alerjenIdleri.length) {
        const yerTutucular = alerjenIdleri.map(() => '(?, ?)').join(', ');
        await baglanti.execute(
          `INSERT INTO kullanici_alerjenleri (kullanici_id, alerjen_id) VALUES ${yerTutucular}`,
          alerjenIdleri.flatMap((id) => [kullaniciId, id])
        );
      }
      const [satirlar] = await baglanti.execute(
        `SELECT a.id, a.ad
           FROM kullanici_alerjenleri ka JOIN alerjenler a ON a.id = ka.alerjen_id
          WHERE ka.kullanici_id = ?
          ORDER BY a.ad`,
        [kullaniciId]
      );
      return satirlar;
    });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') return null;   // olmayan alerjen
    throw err;
  }
}

module.exports = { tumAlerjenler, kullaniciAlerjenleri, alerjenleriKaydet };
