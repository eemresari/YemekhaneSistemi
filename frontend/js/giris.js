const ROL_ADI = { ogrenci: 'Öğrenci', personel: 'Personel', yonetici: 'Yönetici' };

const form = document.getElementById('giris-formu');
const hataKutusu = document.getElementById('giris-hata');
const girisDugme = document.getElementById('giris-dugme');
const oturumKutusu = document.getElementById('oturum-kutusu');

function formuGoster() {
  oturumKutusu.hidden = true;
  form.hidden = false;
}

function oturumuGoster(kullanici) {
  // textContent: ad/soyad sayfaya HTML olarak değil düz metin olarak yazılır (XSS'e karşı)
  document.getElementById('kullanici-adi').textContent = `${kullanici.ad} ${kullanici.soyad}`;
  document.getElementById('kullanici-rol').textContent = ROL_ADI[kullanici.rol] ?? kullanici.rol;
  form.hidden = true;
  oturumKutusu.hidden = false;
}

// Sayfa açılınca: zaten giriş yapılmış mı? (/api/ben giriş yoksa 401 döner)
async function acilis() {
  const sonuc = await apiIstek('/api/ben');
  if (sonuc.ok) {
    oturumuGoster(sonuc.veri.kullanici);
  } else {
    formuGoster();
  }
}

form.addEventListener('submit', async (olay) => {
  olay.preventDefault();               // sayfanın yeniden yüklenmesini engelle
  hataKutusu.hidden = true;
  girisDugme.disabled = true;          // çift tıklamayla iki istek gitmesin

  const sonuc = await apiIstek('/api/giris', {
    yontem: 'POST',
    govde: {
      eposta: document.getElementById('eposta').value.trim(),
      sifre: document.getElementById('sifre').value,
    },
  });

  girisDugme.disabled = false;
  if (!sonuc.ok) {
    hataKutusu.textContent = sonuc.hata;   // sunucunun Türkçe mesajı olduğu gibi gösterilir
    hataKutusu.hidden = false;
    return;
  }

  form.reset();                        // şifre alanında kalmasın
  oturumuGoster(sonuc.veri.kullanici);
});

document.getElementById('cikis-dugme').addEventListener('click', async () => {
  await apiIstek('/api/cikis', { yontem: 'POST' });
  formuGoster();
});

acilis();
