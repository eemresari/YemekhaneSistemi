// Yönetim: menü bazında fiyat, doluluk ve ortalama puan; haftalar arasında gezinme.
// Yetki kararı burada verilmez: yönetici değilse API 403 döner, mesajı gösterilir.

const durum = document.getElementById('durum');
const hataKutusu = document.getElementById('hata');
const tablo = document.querySelector('.yonetim-tablo');
const govde = document.getElementById('menuler');
const aralik = document.getElementById('aralik');

let baslangic = null;   // ilk açılışta sunucu bugünü seçer

// Hafta gezinmesi için takvim hesabı ('2026-11-24' + 7 → '2026-12-01'). İş kuralı değildir.
function gunEkle(tarih, gun) {
  const d = new Date(`${tarih}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

function dolulukHucresi(m) {
  const td = el('td');
  td.append(el('span', 'nowrap', `${m.rezerve} / ${m.kapasite}`));
  const cubuk = el('div', 'doluluk-cubuk');
  const dolu = el('div', 'doluluk-dolu');
  dolu.style.width = `${Math.min(Number(m.doluluk_yuzde), 100)}%`;
  cubuk.append(dolu);
  td.append(cubuk, el('span', 'rez-alt', `%${Number(m.doluluk_yuzde).toLocaleString('tr-TR')}`));
  return td;
}

function puanHucresi(m) {
  if (m.ortalama_puan === null) return el('td', 'rez-alt', '—');
  const td = el('td', 'nowrap');
  td.append(
    el('span', 'puan-ort', `★ ${Number(m.ortalama_puan).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`),
    el('span', 'rez-alt', ` · ${m.oy_sayisi} oy`),
  );
  return td;
}

function menuSatiri(m) {
  const tr = el('tr');
  const fiyat = `${paraBicimi(m.ogrenci_fiyati)} / ${paraBicimi(m.personel_fiyati)}`;

  const eylem = el('td', 'sag');
  if (m.duzenlenebilir) {
    const a = el('a', null, 'Düzenle');
    a.href = `/yonetim-menu.html?id=${m.menu_id}`;
    eylem.append(a);
  } else {
    eylem.append(el('span', 'rez-alt', 'Geçmiş'));
  }

  tr.append(
    el('td', 'nowrap', gunBasligi(m.tarih)),
    el('td', null, `${m.yemekhane} · ${m.ogun}`),
    el('td', 'sag', fiyat),
    dolulukHucresi(m),
    puanHucresi(m),
    eylem,
  );
  return tr;
}

async function yukle() {
  durum.textContent = 'Yükleniyor…';
  durum.hidden = false;
  hataKutusu.hidden = true;
  tablo.hidden = true;
  govde.replaceChildren();

  const adres = baslangic ? `/api/yonetim/menuler?baslangic=${baslangic}` : '/api/yonetim/menuler';
  const sonuc = await apiIstek(adres);
  if (!sonuc.ok) {
    durum.hidden = true;
    hataKutusu.textContent = sonuc.hata;    // yönetici değilse: "Bu işlem için yönetici yetkisi gerekir."
    hataKutusu.hidden = false;
    // Yetki yoksa (403) hafta düğmeleri ve "Yeni menü" de anlamsız: gizlenir
    if (sonuc.durum === 403) document.querySelector('.arac-cubugu').hidden = true;
    return;
  }

  baslangic = sonuc.veri.baslangic;
  aralik.textContent = `${kisaGun(baslangic)} – ${kisaGun(gunEkle(baslangic, 6))}`;

  const { menuler } = sonuc.veri;
  if (menuler.length === 0) {
    durum.textContent = 'Bu hafta için menü yok. "Yeni menü" ile ekleyebilirsiniz.';
    return;
  }
  durum.hidden = true;
  tablo.hidden = false;
  govde.append(...menuler.map(menuSatiri));
}

document.getElementById('onceki').addEventListener('click', () => { baslangic = gunEkle(baslangic, -7); yukle(); });
document.getElementById('sonraki').addEventListener('click', () => { baslangic = gunEkle(baslangic, 7); yukle(); });

async function acilis() {
  const kullanici = await gezinmeyiKur();
  if (!kullanici) return;
  await yukle();
}

acilis();
