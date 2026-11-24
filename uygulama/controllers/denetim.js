// Controller'ların ortak girdi denetimleri. Yalnızca biçime bakar; iş kuralı içermez.

// '2026-11-24' biçiminde ve takvimde gerçekten var olan bir gün mü? ('2026-02-30' geçersiz)
function gecerliTarihMi(metin) {
  if (typeof metin !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(metin)) return false;
  const gun = new Date(`${metin}T00:00:00Z`);
  return !Number.isNaN(gun.getTime()) && gun.toISOString().slice(0, 10) === metin;
}

// JSON gövdesinden gelen kimlik: pozitif tamsayı mı?
function gecerliKimlik(deger) {
  return Number.isInteger(deger) && deger > 0;
}

// Adres parametresi ya da sorgu dizgisinden gelen kimlik ('12'): yoksa null, geçerliyse sayı, bozuksa hata.
function kimlikOku(deger) {
  if (deger === undefined) return { deger: null };
  if (typeof deger !== 'string' || !/^\d+$/.test(deger) || Number(deger) < 1) return { hata: true };
  return { deger: Number(deger) };
}

// Para tutarı: sıfır ya da pozitif, en fazla iki ondalıklı bir sayı mı? (metin '100' kabul edilmez)
function gecerliTutar(deger) {
  return typeof deger === 'number' && /^\d+(\.\d{1,2})?$/.test(String(deger));
}

module.exports = { gecerliTarihMi, gecerliKimlik, kimlikOku, gecerliTutar };
