// Haftalık menü: seçilen günden başlayarak 7 gün, güne göre gruplu.
// Rezervasyon düğmesinin açık/pasif olmasına sunucu karar verir (rezervasyon_acik, pasif_neden).

const suzgec = document.getElementById('suzgec');
const baslangicKutusu = document.getElementById('baslangic');
const durum = document.getElementById('durum');
const hataKutusu = document.getElementById('hata');
const gunlerKutusu = document.getElementById('gunler');

// '2026-11-25' → 'Çarşamba, 25 Kasım'
function gunBasligi(tarih) {
  const gun = new Date(`${tarih}T00:00:00`);
  const gunAdi = gun.toLocaleDateString('tr-TR', { weekday: 'long' });
  const gunAy = gun.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  return `${gunAdi}, ${gunAy}`;
}

// Menü kartının altına rezervasyon düğmesi ekler
function rezervasyonluKart(menu) {
  const kart = menuKartiOlustur(menu);
  const alan = el('div', 'rezervasyon-alan');

  const dugme = el('button', 'dugme tam', 'Rezervasyon yap');
  dugme.type = 'button';
  dugme.dataset.menuId = menu.menu_id;   // Adım 6'da tıklanınca bu menü için istek gidecek
  alan.append(dugme);

  if (!menu.rezervasyon_acik) {
    dugme.disabled = true;
    const neden = el('p', 'pasif-neden', menu.pasif_neden);
    neden.id = `neden-${menu.menu_id}`;
    dugme.setAttribute('aria-describedby', neden.id);   // ekran okuyucu nedeni de okusun
    alan.append(neden);
  }

  kart.append(alan);
  return kart;
}

async function haftayiYukle() {
  const parametreler = new URLSearchParams();
  if (baslangicKutusu.value) parametreler.set('baslangic', baslangicKutusu.value);

  durum.textContent = 'Yükleniyor…';
  durum.hidden = false;
  hataKutusu.hidden = true;
  gunlerKutusu.replaceChildren();

  const sonuc = await apiIstek(`/api/menu/haftalik?${parametreler}`);
  if (!sonuc.ok) {
    durum.hidden = true;
    hataKutusu.textContent = sonuc.hata;
    hataKutusu.hidden = false;
    return;
  }

  baslangicKutusu.value = sonuc.veri.baslangic;
  const { menuler } = sonuc.veri;
  if (menuler.length === 0) {
    durum.textContent = 'Bu hafta için menü bulunamadı.';
    return;
  }
  durum.hidden = true;

  // Menüler sunucudan tarihe göre sıralı gelir; aynı tarihtekiler tek bölümde toplanır
  const gunler = new Map();
  for (const menu of menuler) {
    if (!gunler.has(menu.tarih)) gunler.set(menu.tarih, []);
    gunler.get(menu.tarih).push(menu);
  }

  for (const [tarih, gununMenuleri] of gunler) {
    const bolum = el('section', 'gun');
    bolum.append(el('h2', 'gun-baslik', gunBasligi(tarih)));
    const liste = el('div', 'menu-liste');
    liste.append(...gununMenuleri.map(rezervasyonluKart));
    bolum.append(liste);
    gunlerKutusu.append(bolum);
  }
}

async function acilis() {
  const kullanici = await gezinmeyiKur();
  if (!kullanici) return;

  suzgec.addEventListener('change', haftayiYukle);
  suzgec.addEventListener('submit', (olay) => olay.preventDefault());
  await haftayiYukle();
}

acilis();
