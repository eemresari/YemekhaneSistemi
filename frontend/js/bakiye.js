// Bakiye: güncel bakiye, hareket geçmişi, bakiye yükleme.
// 10–1000 TL kuralı burada yazılmaz; sunucu (sp_bakiye_yukle) reddederse mesajı gösterilir.

const TUR_ADI = { yukleme: 'Yükleme', rezervasyon: 'Rezervasyon', iade: 'İade' };

const hataKutusu = document.getElementById('hata');
const bakiyeTutar = document.getElementById('bakiye-tutar');
const form = document.getElementById('yukle-formu');
const tutarKutusu = document.getElementById('tutar');
const yukleDugme = document.getElementById('yukle-dugme');
const yukleMesaj = document.getElementById('yukle-mesaj');
const durum = document.getElementById('durum');
const tablo = document.querySelector('.hareket-tablo');
const govde = document.getElementById('hareketler');

// Artı tutar yeşil '+₺40,00', eksi tutar kırmızı '−₺40,00'
function tutarHucresi(tutar) {
  const sayi = Number(tutar);
  const arti = sayi > 0;
  return el('td', `sag ${arti ? 'tutar-arti' : 'tutar-eksi'}`,
    `${arti ? '+' : '−'}${paraBicimi(Math.abs(sayi))}`);
}

function hareketSatiri(h, tarihMetni) {
  const tr = el('tr');
  let aciklama = TUR_ADI[h.tur] ?? h.tur;
  if (h.menu_tarih) aciklama += ` · ${kisaGun(h.menu_tarih)} ${h.ogun} · ${h.yemekhane}`;
  tr.append(el('td', 'nowrap', tarihMetni), el('td', null, aciklama), tutarHucresi(h.tutar));
  return tr;
}

async function yukle() {
  const sonuc = await apiIstek('/api/bakiye');
  if (!sonuc.ok) {
    durum.hidden = true;
    hataKutusu.textContent = sonuc.hata;
    hataKutusu.hidden = false;
    return;
  }
  bakiyeTutar.textContent = paraBicimi(sonuc.veri.bakiye);

  const { hareketler } = sonuc.veri;
  if (hareketler.length === 0) {
    durum.textContent = 'Henüz hareket yok.';
    return;
  }
  durum.hidden = true;
  tablo.hidden = false;
  govde.append(...hareketler.map((h) => hareketSatiri(h, tarihSaatBicimi(h.olusturma))));
}

form.addEventListener('submit', async (olay) => {
  olay.preventDefault();
  yukleMesaj.hidden = true;
  yukleDugme.disabled = true;

  // Boş kutu null gider, sunucu "Geçersiz tutar." der
  const tutar = tutarKutusu.value === '' ? null : Number(tutarKutusu.value);
  const sonuc = await apiIstek('/api/bakiye/yukle', { yontem: 'POST', govde: { tutar } });
  yukleDugme.disabled = false;

  if (!sonuc.ok) {
    yukleMesaj.className = 'kart-mesaj kart-mesaj-hata';
    yukleMesaj.textContent = sonuc.hata;
    yukleMesaj.hidden = false;
    return;
  }

  // Bakiye yordamın kaynakta hesapladığı değerdir. Liste replikadan yeniden çekilmez
  // (yeni hareket henüz oraya ulaşmamış olabilir); yeni satır tablonun başına eklenir.
  bakiyeTutar.textContent = paraBicimi(sonuc.veri.bakiye);
  govde.prepend(hareketSatiri({ tur: 'yukleme', tutar }, 'Az önce'));
  durum.hidden = true;
  tablo.hidden = false;

  form.reset();
  yukleMesaj.className = 'kart-mesaj kart-mesaj-basari';
  yukleMesaj.textContent = `${paraBicimi(tutar)} yüklendi.`;
  yukleMesaj.hidden = false;
});

async function acilis() {
  const kullanici = await gezinmeyiKur();
  if (!kullanici) return;
  await yukle();
}

acilis();
