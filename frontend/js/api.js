// Tüm ekranların ortak kullandığı yardımcı: API'ye JSON isteği gönderir.
// Arayüzde iş kuralı yoktur; burası yalnızca isteği atar ve sonucu tek biçime çevirir:
//   başarılı  -> { ok: true,  durum: 200, veri: {...} }
//   başarısız -> { ok: false, durum: 401, hata: "Sunucunun Türkçe mesajı" }
async function apiIstek(yol, { yontem = 'GET', govde } = {}) {
  const secenekler = { method: yontem, headers: { Accept: 'application/json' } };
  if (govde !== undefined) {
    secenekler.headers['Content-Type'] = 'application/json';
    secenekler.body = JSON.stringify(govde);
  }

  let yanit;
  try {
    yanit = await fetch(yol, secenekler);   // aynı kökten istek: oturum çerezi kendiliğinden gider
  } catch {
    return { ok: false, durum: 0, hata: 'Sunucuya ulaşılamıyor.' };
  }

  let veri = null;
  try {
    veri = await yanit.json();
  } catch {
    // Gövde JSON değil (örn. uygulama kapalıyken Apache'nin 503 sayfası)
  }

  if (!yanit.ok) {
    return { ok: false, durum: yanit.status, hata: veri?.hata ?? 'Beklenmeyen bir hata oluştu.' };
  }
  return { ok: true, durum: yanit.status, veri };
}
