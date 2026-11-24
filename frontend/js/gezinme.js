// Giriş sonrası her sayfanın en üstündeki ortak gezinme çubuğu.
// Sayfa betiği önce gezinmeyiKur()'u çağırır: giriş yoksa kullanıcı giriş sayfasına gider.

const SAYFALAR = [
  { adres: '/menu.html', ad: 'Günün menüsü' },
  { adres: '/haftalik.html', ad: 'Haftalık' },
  { adres: '/rezervasyonlarim.html', ad: 'Rezervasyonlarım' },
  { adres: '/bakiye.html', ad: 'Bakiye' },
  { adres: '/degerlendirme.html', ad: 'Değerlendirme' },
  { adres: '/profil.html', ad: 'Profil' },
];

// Yalnızca yöneticiye gösterilir. Bu yalnızca görünümdür: asıl koruma sunucudadır
// (yoneticiGerekli ara katmanı); başkası adresi elle yazsa da API 403 döner.
const YONETICI_SAYFALARI = [
  { adres: '/yonetim.html', ad: 'Yönetim', altSayfalar: ['/yonetim-menu.html'] },
];

// Kısa yardımcı: etiket oluşturur, metni textContent ile yazar (HTML olarak yorumlanmaz)
function el(etiket, sinif, metin) {
  const oge = document.createElement(etiket);
  if (sinif) oge.className = sinif;
  if (metin !== undefined) oge.textContent = metin;
  return oge;
}

let girisYapildi = false;

// api.js herhangi bir istekte 401 alınca bunu çağırır. Sayfa açıkken oturum düşmüşse
// (süre doldu ya da uygulama yeniden başladı) kullanıcı sayfada takılı kalmaz.
function oturumDustu() {
  if (!girisYapildi) return;   // sayfa açılışındaki denetimi gezinmeyiKur kendisi yapar
  location.replace('/giris.html?oturum=bitti');
}

async function gezinmeyiKur() {
  const sonuc = await apiIstek('/api/ben');
  if (sonuc.durum === 401) {
    // Giriş yok. replace: geri tuşu kullanıcıyı korumalı sayfaya döndürmesin
    location.replace('/giris.html');
    return null;
  }
  if (!sonuc.ok) {
    // Sunucuya ulaşılamıyor ya da beklenmeyen hata: giriş sayfasına atmak yanıltıcı olur,
    // mesaj sayfanın kırmızı kutusunda gösterilir
    const hataKutusu = document.getElementById('hata');
    hataKutusu.textContent = sonuc.hata;
    hataKutusu.hidden = false;
    const durum = document.getElementById('durum');
    if (durum) durum.hidden = true;
    return null;
  }
  girisYapildi = true;
  const kullanici = sonuc.veri.kullanici;

  const ic = el('div', 'kapsayici gezinme-ic');
  ic.append(el('span', 'gezinme-baslik', 'Yemekhane'));

  const baglantilar = el('nav', 'gezinme-baglantilar');
  baglantilar.setAttribute('aria-label', 'Ana menü');
  const sayfalar = kullanici.rol === 'yonetici' ? [...SAYFALAR, ...YONETICI_SAYFALARI] : SAYFALAR;
  for (const sayfa of sayfalar) {
    const a = el('a', null, sayfa.ad);
    a.href = sayfa.adres;
    const aktif = location.pathname === sayfa.adres || sayfa.altSayfalar?.includes(location.pathname);
    if (aktif) a.setAttribute('aria-current', 'page');
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
  // Telefonda bağlantılar yana kayar: aktif sayfanın bağlantısı görünür alana getirilir
  baglantilar.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return kullanici;
}
