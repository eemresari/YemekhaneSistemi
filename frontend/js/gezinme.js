// Giriş sonrası her sayfanın en üstündeki ortak gezinme çubuğu.
// Sayfa betiği önce gezinmeyiKur()'u çağırır: giriş yoksa kullanıcı giriş sayfasına gider.

const SAYFALAR = [
  { adres: '/menu.html', ad: 'Günün menüsü' },
  { adres: '/haftalik.html', ad: 'Haftalık' },
  { adres: '/rezervasyonlarim.html', ad: 'Rezervasyonlarım' },
  { adres: '/bakiye.html', ad: 'Bakiye' },
  { adres: '/degerlendirme.html', ad: 'Değerlendirme' },
];

// Kısa yardımcı: etiket oluşturur, metni textContent ile yazar (HTML olarak yorumlanmaz)
function el(etiket, sinif, metin) {
  const oge = document.createElement(etiket);
  if (sinif) oge.className = sinif;
  if (metin !== undefined) oge.textContent = metin;
  return oge;
}

async function gezinmeyiKur() {
  const sonuc = await apiIstek('/api/ben');
  if (!sonuc.ok) {
    // replace: geri tuşu kullanıcıyı korumalı sayfaya döndürmesin
    location.replace('/giris.html');
    return null;
  }
  const kullanici = sonuc.veri.kullanici;

  const ic = el('div', 'kapsayici gezinme-ic');
  ic.append(el('span', 'gezinme-baslik', 'Yemekhane'));

  const baglantilar = el('nav', 'gezinme-baglantilar');
  baglantilar.setAttribute('aria-label', 'Ana menü');
  for (const sayfa of SAYFALAR) {
    const a = el('a', null, sayfa.ad);
    a.href = sayfa.adres;
    if (location.pathname === sayfa.adres) a.setAttribute('aria-current', 'page');
    baglantilar.append(a);
  }
  ic.append(baglantilar);

  const kutu = el('div', 'gezinme-kullanici');
  kutu.append(el('span', null, `${kullanici.ad} ${kullanici.soyad}`));
  const cikis = el('button', 'dugme dugme-ince', 'Çıkış');
  cikis.type = 'button';
  cikis.addEventListener('click', async () => {
    cikis.disabled = true;
    await apiIstek('/api/cikis', { yontem: 'POST' });
    location.replace('/giris.html');
  });
  kutu.append(cikis);
  ic.append(kutu);

  document.getElementById('gezinme').append(ic);
  return kullanici;
}
