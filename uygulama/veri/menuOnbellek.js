const redis = require('./redis');

// Menü önbelleği. Anahtar: menu:{yemekhane_id}:{tarih}:{ogun_id}
// Değer: o menünün içeriği (yemekler, fiyatlar, son saat) JSON olarak.
// O gün o yemekhanede o öğünde menü yoksa değer "null" olur; "menü yok" bilgisi de önbelleğe
// girer, böylece boş günler her istekte veritabanına sorulmaz.
// Boş yer ve kullanıcının rezervasyonu burada TUTULMAZ: biri her rezervasyonda değişir,
// öteki kişiye özeldir. Onlar her istekte veritabanından okunur (menuVeri.js).

function anahtar(yemekhaneId, tarih, ogunId) {
  return `menu:${yemekhaneId}:${tarih}:${ogunId}`;
}

// Anahtarları tek istekte (MGET) okur.
// Dönüş: Map(anahtar → içerik ya da null). Önbellekte olmayan anahtar Map'e girmez.
async function oku(anahtarlar) {
  const degerler = anahtarlar.length ? await redis.mGet(anahtarlar) : [];
  const bulunanlar = new Map();
  anahtarlar.forEach((a, i) => {
    if (degerler[i] !== null) bulunanlar.set(a, JSON.parse(degerler[i]));
  });
  return bulunanlar;
}

// Okuyan istek önbelleği yalnızca anahtar BOŞSA doldurur (SET NX).
// Neden: yönetici menüyü değiştirdiğinde yeni içerik kaynaktan okunup yazılır (Adım 3.4).
// Aynı anda replikadan eski içeriği okumuş bir istek, onun üzerine yazamamalı.
// silinmeZamani: Unix saniyesi (bugün gece yarısı) → EXAT ile o anda Redis kendisi siler.
async function bosaYaz(anahtar, icerik, silinmeZamani) {
  await redis.set(anahtar, JSON.stringify(icerik), {
    condition: 'NX',
    expiration: { type: 'EXAT', value: silinmeZamani },
  });
}

// Yönetici menüyü değiştirdiğinde eski kayıt silinir. Dönüş: silinen anahtar sayısı (0 ya da 1).
async function sil(anahtar) {
  return redis.del(anahtar);
}

// Yöneticinin değişikliğinden sonra KAYNAKTAN okunan yeni içerik yazılır.
// NX yok: varsa, arada replikadan eski içeriği okuyup yazmış bir isteğin kaydını ezer.
async function uzerineYaz(anahtar, icerik, silinmeZamani) {
  await redis.set(anahtar, JSON.stringify(icerik), {
    expiration: { type: 'EXAT', value: silinmeZamani },
  });
}

// Uygulama günlüğüne her istek için tek satır: kaç anahtar Redis'ten, kaç anahtar veritabanından?
function gunlugeYaz(anahtarlar, eksikler) {
  if (anahtarlar.length === 1) {
    const kaynak = eksikler.length ? 'veritabanından (Redis\'e yazıldı)' : 'Redis\'ten';
    console.log(`Menü önbelleği: ${anahtarlar[0]} → ${kaynak}`);
  } else {
    console.log(`Menü önbelleği: ${anahtarlar.length} anahtar → `
      + `${anahtarlar.length - eksikler.length} Redis'ten, ${eksikler.length} veritabanından`);
  }
}

module.exports = { anahtar, oku, bosaYaz, sil, uzerineYaz, gunlugeYaz };
