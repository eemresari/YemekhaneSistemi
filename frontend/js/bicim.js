// Bütün sayfaların ortak kullandığı gösterim biçimleri. Hesap yapmaz, yalnızca yazıya çevirir.

// '40.00' → '₺40,00'
function paraBicimi(deger) {
  return Number(deger).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
}

// '2026-11-25 10:00:00' → '10:00'
function saatBicimi(tarihSaat) {
  return tarihSaat.slice(11, 16);
}

// '2026-11-25' → 'Çarşamba, 25 Kasım'
function gunBasligi(tarih) {
  const gun = new Date(`${tarih}T00:00:00`);
  const gunAdi = gun.toLocaleDateString('tr-TR', { weekday: 'long' });
  const gunAy = gun.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  return `${gunAdi}, ${gunAy}`;
}
