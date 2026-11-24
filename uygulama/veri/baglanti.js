const mysql = require('mysql2/promise');

// İki havuzun ortak ayarları. Bilgiler docker-compose.yml'den ortam değişkeni olarak gelir.
const ortak = {
  port: Number(process.env.DB_PORT),
  database: process.env.DB_ADI,
  user: process.env.DB_KULLANICI,
  password: process.env.DB_SIFRE,
  charset: 'utf8mb4',     // Türkçe karakterler (ş, ğ, ı) bozulmasın
  timezone: '+03:00',     // veritabanı sunucusunun saat dilimiyle aynı
  dateStrings: true,      // tarihler '2026-11-24' metni olarak gelir; Date nesnesine çevrilip gün kaymasın
  waitForConnections: true,
  connectionLimit: 10,    // havuzda aynı anda en fazla 10 bağlantı
};

// Yazma işlemleri (INSERT, UPDATE, stored procedure) yalnızca buradan: kaynak sunucu
const yazmaHavuzu = mysql.createPool({ ...ortak, host: process.env.DB_YAZMA_HOST });

// Okuma işlemleri (SELECT, listeleme, rapor) buradan: replika sunucu
const okumaHavuzu = mysql.createPool({ ...ortak, host: process.env.DB_OKUMA_HOST });

// Bir işi tek transaction içinde çalıştırır: hepsi başarılıysa COMMIT, herhangi biri hata
// verirse ROLLBACK. Havuzdan tek bir bağlantı alınır, çünkü transaction bağlantıya aittir.
async function transactionIcinde(is) {
  const baglanti = await yazmaHavuzu.getConnection();
  try {
    await baglanti.beginTransaction();
    const sonuc = await is(baglanti);
    await baglanti.commit();
    return sonuc;
  } catch (err) {
    await baglanti.rollback();
    throw err;
  } finally {
    baglanti.release();     // bağlantı havuza geri döner
  }
}

module.exports = { yazmaHavuzu, okumaHavuzu, transactionIcinde };
