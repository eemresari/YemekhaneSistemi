const { yazmaHavuzu, okumaHavuzu } = require('./baglanti');
const menuOnbellek = require('./menuOnbellek');
const { menuIcerikleriGetir, gunSonuZamani } = require('./menuVeri');

// ---- Okumalar ----------------------------------------------------------------

// Yönetici raporu: menü bazında fiyat, doluluk (v_menu_doluluk) ve ortalama puan (v_menu_puan).
// Rapor bir listelemedir: replikadan okunur.
async function menuRaporu(baslangic, gunSayisi = 7) {
  const [satirlar] = await okumaHavuzu.execute(
    `SELECT m.id AS menu_id, m.tarih, yh.ad AS yemekhane, o.ad AS ogun,
            m.ogrenci_fiyati, m.personel_fiyati,
            d.kapasite, d.rezerve, d.doluluk_yuzde,
            p.oy_sayisi, p.ortalama_puan,
            (SELECT COUNT(*) FROM menu_yemekleri my WHERE my.menu_id = m.id) AS yemek_sayisi
       FROM menuler m
       JOIN yemekhaneler yh   ON yh.id = m.yemekhane_id
       JOIN ogunler o         ON o.id  = m.ogun_id
       JOIN v_menu_doluluk d  ON d.menu_id = m.id
       JOIN v_menu_puan p     ON p.menu_id = m.id
      WHERE m.tarih >= ? AND m.tarih < DATE_ADD(?, INTERVAL ? DAY)
      ORDER BY m.tarih, m.yemekhane_id, o.sira`,
    [baslangic, baslangic, gunSayisi]
  );
  return satirlar;
}

// Menü formu için yemek kataloğu, kategori kategori. Replikadan.
async function yemekKatalogu() {
  const [satirlar] = await okumaHavuzu.execute(
    `SELECT y.id, y.ad, y.kalori, y.vejetaryen, k.id AS kategori_id, k.ad AS kategori
       FROM yemekler y
       JOIN yemek_kategorileri k ON k.id = y.kategori_id
      ORDER BY k.sira, y.ad`
  );
  const kategoriler = new Map();
  for (const s of satirlar) {
    if (!kategoriler.has(s.kategori_id)) {
      kategoriler.set(s.kategori_id, { id: s.kategori_id, ad: s.kategori, yemekler: [] });
    }
    kategoriler.get(s.kategori_id).yemekler.push({
      id: s.id, ad: s.ad, kalori: s.kalori, vejetaryen: Boolean(s.vejetaryen),
    });
  }
  return [...kategoriler.values()];
}

// Düzenlenecek menü. Bu okuma bir yazmanın dayanağıdır (form bununla doldurulur, "geçmiş mi"
// kararı buna göre verilir); replika geride olabileceği için KAYNAKTAN okunur.
async function menuGetir(menuId) {
  const [[menu]] = await yazmaHavuzu.execute(
    `SELECT id AS menu_id, yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati
       FROM menuler WHERE id = ?`,
    [menuId]
  );
  if (!menu) return null;
  const [yemekler] = await yazmaHavuzu.execute(
    'SELECT yemek_id FROM menu_yemekleri WHERE menu_id = ? ORDER BY yemek_id', [menuId]
  );
  return { ...menu, yemekler: yemekler.map((y) => y.yemek_id) };
}

// ---- Yazmalar (kaynak, transaction) -----------------------------------------

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

async function yemekleriEkle(baglanti, menuId, yemekIdleri) {
  const yerTutucular = yemekIdleri.map(() => '(?, ?)').join(', ');
  const degerler = yemekIdleri.flatMap((yemekId) => [menuId, yemekId]);
  await baglanti.execute(`INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES ${yerTutucular}`, degerler);
}

// Veritabanı hatalarını Controller'ın anlayacağı sonuçlara çevirir (MySQL kodları dışarı sızmasın)
function hataSonucu(err) {
  if (err.code === 'ER_DUP_ENTRY') return { hata: 'menu_var' };                 // uq_menu
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return { hata: 'gecersiz_kayit' };  // olmayan yemek/yemekhane/öğün
  throw err;
}

// ---- Menü önbelleğinin geçersizleştirilmesi ----------------------------------

// Yönetici bir menüyü değiştirdiğinde (ya da o güne yeni menü eklediğinde) çağrılır.
// Transaction COMMIT edildikten SONRA çalışır: önce çalışsaydı, commit'ten önce gelen bir
// okuma eski menüyü yeniden önbelleğe yazabilirdi.
// 1. Eski kayıt silinir.
// 2. Yeni içerik KAYNAKTAN okunup yazılır. Replikadan okunsaydı, replika değişikliği henüz
//    almamışsa eski menü yeniden önbelleğe girer ve gece yarısına kadar kalırdı.
async function menuOnbelleginiYenile({ yemekhaneId, tarih, ogunId }) {
  const anahtar = menuOnbellek.anahtar(yemekhaneId, tarih, ogunId);
  const silinen = await menuOnbellek.sil(anahtar);
  const [icerikler, gunSonu] = await Promise.all([
    menuIcerikleriGetir(yazmaHavuzu, { baslangic: tarih, yemekhaneId, ogunId }),
    gunSonuZamani(),
  ]);
  await menuOnbellek.uzerineYaz(anahtar, icerikler.get(anahtar) ?? null, gunSonu);
  console.log(`Menü önbelleği: ${anahtar} → eski kayıt silindi (DEL ${silinen}), `
    + 'yeni içerik kaynaktan yazıldı');
}

// Önbellek yenilenemezse (Redis kapalı vb.) veritabanındaki değişiklik geri alınmaz;
// yönetici "kaydedilmedi" sanmasın diye istek başarılı döner, hata günlüğe yazılır.
async function onbellegiYenileHataYutarak(konum) {
  try {
    await menuOnbelleginiYenile(konum);
  } catch (err) {
    console.error(`Menü önbelleği yenilenemedi: ${err.message}`);
  }
}

// Yeni menü: menü satırı ve yemekleri birlikte; biri başarısızsa hiçbiri kalmaz.
async function menuOlustur({ yemekhaneId, tarih, ogunId, ogrenciFiyati, personelFiyati, yemekIdleri }) {
  let menuId;
  try {
    menuId = await transactionIcinde(async (baglanti) => {
      const [sonuc] = await baglanti.execute(
        `INSERT INTO menuler (yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati)
         VALUES (?, ?, ?, ?, ?)`,
        [yemekhaneId, tarih, ogunId, ogrenciFiyati, personelFiyati]
      );
      await yemekleriEkle(baglanti, sonuc.insertId, yemekIdleri);
      return sonuc.insertId;
    });
  } catch (err) {
    return hataSonucu(err);
  }
  // O gün için önbellekte "menü yok" (null) kaydı olabilir: yenisiyle değiştirilir.
  await onbellegiYenileHataYutarak({ yemekhaneId, tarih, ogunId });
  return { menuId };
}

// Menü düzenleme: fiyatlar ve yemek listesi. Yemekhane, tarih ve öğün değişmez.
async function menuGuncelle(menuId, { ogrenciFiyati, personelFiyati, yemekIdleri }) {
  let konum;
  try {
    konum = await transactionIcinde(async (baglanti) => {
      await baglanti.execute(
        'UPDATE menuler SET ogrenci_fiyati = ?, personel_fiyati = ? WHERE id = ?',
        [ogrenciFiyati, personelFiyati, menuId]
      );
      await baglanti.execute('DELETE FROM menu_yemekleri WHERE menu_id = ?', [menuId]);
      await yemekleriEkle(baglanti, menuId, yemekIdleri);
      // Önbellek anahtarı için menünün yemekhanesi, tarihi ve öğünü
      const [[m]] = await baglanti.execute(
        'SELECT yemekhane_id AS yemekhaneId, tarih, ogun_id AS ogunId FROM menuler WHERE id = ?',
        [menuId]
      );
      return m;
    });
  } catch (err) {
    return hataSonucu(err);
  }
  await onbellegiYenileHataYutarak(konum);
  return { menuId };
}

module.exports = { menuRaporu, yemekKatalogu, menuGetir, menuOlustur, menuGuncelle };
