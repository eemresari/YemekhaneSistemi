// Haftalık menü: seçilen günden başlayarak 7 gün, güne göre gruplu.
// Rezervasyon düğmesinin açık/pasif olmasına sunucu karar verir (rezervasyon_acik, pasif_neden).

const suzgec = document.getElementById('suzgec');
const baslangicKutusu = document.getElementById('baslangic');
const durum = document.getElementById('durum');
const hataKutusu = document.getElementById('hata');
const gunlerKutusu = document.getElementById('gunler');

// Kartın altındaki mesaj satırına yazar: tur 'hata' (kırmızı) ya da 'basari' (yeşil)
function mesajYaz(mesaj, tur, metin) {
  mesaj.className = `kart-mesaj kart-mesaj-${tur}`;
  mesaj.textContent = metin;
  mesaj.hidden = false;
}

// Düğmeyi "Rezervasyonunuz var" durumuna getirir
function rezerveliYap(dugme) {
  dugme.textContent = 'Rezervasyonunuz var';
  dugme.disabled = true;
}

// Menü kartının altına rezervasyon düğmesi ve mesaj satırı ekler
function rezervasyonluKart(menu) {
  const kart = menuKartiOlustur(menu);
  const alan = el('div', 'rezervasyon-alan');

  const dugme = el('button', 'dugme', 'Rezervasyon yap');
  dugme.type = 'button';
  const mesaj = el('p', 'kart-mesaj');
  mesaj.id = `mesaj-${menu.menu_id}`;
  mesaj.setAttribute('role', 'status');
  mesaj.hidden = true;
  dugme.setAttribute('aria-describedby', mesaj.id);   // ekran okuyucu mesajı da okusun

  // Aşama 4: öğle ve akşamda porsiyon seçimi (kahvaltıda sunucu yarim_porsiyon: false gönderir)
  let porsiyonSecimi = null;
  if (menu.yarim_porsiyon && menu.rezervasyon_acik && !menu.rezervasyonum) {
    porsiyonSecimi = el('select', 'porsiyon-secimi');
    porsiyonSecimi.setAttribute('aria-label', 'Porsiyon');
    const secenek = (deger, metin) => {
      const o = el('option', null, metin);
      o.value = deger;
      return o;
    };
    porsiyonSecimi.append(
      secenek('tam', `Tam porsiyon · ${paraBicimi(menu.fiyat)}`),
      secenek('yarim', `Yarım porsiyon · ${paraBicimi(menu.yarim_fiyat)}`),
    );
    alan.append(porsiyonSecimi);
  }
  alan.append(dugme, mesaj);

  // Açık mı, kapalı mı, neden? Kararı sunucu verdi; burada yalnızca gösterilir.
  if (menu.rezervasyonum) {
    rezerveliYap(dugme);
  } else if (!menu.rezervasyon_acik) {
    dugme.disabled = true;
    mesajYaz(mesaj, 'hata', menu.pasif_neden);
  }

  dugme.addEventListener('click', async () => {
    dugme.disabled = true;               // çift tıklamayla iki istek gitmesin
    mesaj.hidden = true;

    const sonuc = await apiIstek('/api/rezervasyonlar', {
      yontem: 'POST',
      govde: { menu_id: menu.menu_id, porsiyon: porsiyonSecimi?.value ?? 'tam' },
    });

    if (!sonuc.ok) {
      // Yordamın Türkçe mesajı olduğu gibi gösterilir ("Bakiye yetersiz." gibi)
      mesajYaz(mesaj, 'hata', sonuc.hata);
      dugme.disabled = false;
      return;
    }

    // Liste yeniden çekilmez, yalnızca bu kart güncellenir: liste replikadan okunur ve
    // rezervasyon replikaya henüz ulaşmamış olabilir (replikasyon gecikmesi).
    // Gösterilen bakiye yordamın kaynakta hesapladığı değerdir.
    rezerveliYap(dugme);
    if (porsiyonSecimi) porsiyonSecimi.disabled = true;
    const { ucret, bakiye, porsiyon } = sonuc.veri;
    const porsiyonAdi = porsiyon === 'yarim' ? 'yarım porsiyon' : 'tam porsiyon';
    mesajYaz(mesaj, 'basari',
      `Rezervasyon yapıldı (${porsiyonAdi}). Ücret ${paraBicimi(ucret)} · Kalan bakiye ${paraBicimi(bakiye)}`);
  });

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
