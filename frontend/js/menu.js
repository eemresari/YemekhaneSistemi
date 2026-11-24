// Günün menüsü: tarih, yemekhane ve öğüne göre süzülür. Bu sayfada rezervasyon yapılmaz.

const suzgec = document.getElementById('suzgec');
const tarihKutusu = document.getElementById('tarih');
const yemekhaneKutusu = document.getElementById('yemekhane');
const ogunKutusu = document.getElementById('ogun');
const durum = document.getElementById('durum');
const hataKutusu = document.getElementById('hata');
const menulerKutusu = document.getElementById('menuler');

function secenekEkle(kutu, liste) {
  for (const oge of liste) {
    const secenek = el('option', null, oge.ad);
    secenek.value = oge.id;
    kutu.append(secenek);
  }
}

async function menuleriYukle() {
  // Boş bırakılan süzgeçler gönderilmez; tarih boşsa sunucu "bugün"ü kendi saatinden seçer
  const parametreler = new URLSearchParams();
  if (tarihKutusu.value) parametreler.set('tarih', tarihKutusu.value);
  if (yemekhaneKutusu.value) parametreler.set('yemekhane', yemekhaneKutusu.value);
  if (ogunKutusu.value) parametreler.set('ogun', ogunKutusu.value);

  durum.textContent = 'Yükleniyor…';
  durum.hidden = false;
  hataKutusu.hidden = true;
  menulerKutusu.replaceChildren();

  const sonuc = await apiIstek(`/api/menu/gunluk?${parametreler}`);
  if (!sonuc.ok) {
    durum.hidden = true;
    hataKutusu.textContent = sonuc.hata;
    hataKutusu.hidden = false;
    return;
  }

  tarihKutusu.value = sonuc.veri.tarih;   // ilk açılışta sunucunun "bugün"ü kutuya yazılır
  const { menuler } = sonuc.veri;
  if (menuler.length === 0) {
    durum.textContent = 'Seçilen gün için menü bulunamadı.';
    return;
  }
  durum.hidden = true;
  menulerKutusu.append(...menuler.map(menuKartiOlustur));
}

async function acilis() {
  const kullanici = await gezinmeyiKur();
  if (!kullanici) return;                  // giriş sayfasına yönlendirildi

  const secenekler = await apiIstek('/api/menu/secenekler');
  if (secenekler.ok) {
    secenekEkle(yemekhaneKutusu, secenekler.veri.yemekhaneler);
    secenekEkle(ogunKutusu, secenekler.veri.ogunler);
  }

  // Herhangi bir süzgeç değişince liste yeniden yüklenir
  suzgec.addEventListener('change', menuleriYukle);
  suzgec.addEventListener('submit', (olay) => olay.preventDefault());

  await menuleriYukle();
}

acilis();
