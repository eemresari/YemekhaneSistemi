// Menü formu: ?id= yoksa yeni menü, varsa düzenleme.
// Kurallar (geçmiş tarih, en az bir yemek, fiyat biçimi, aynı menü ikinci kez) sunucudadır;
// burada yalnızca sunucunun mesajı gösterilir. "Düzenlenebilir mi" kararı da sunucudan gelir.

const form = document.getElementById('menu-formu');
const baslik = document.getElementById('baslik');
const hataKutusu = document.getElementById('hata');
const yemekhaneKutusu = document.getElementById('yemekhane');
const tarihKutusu = document.getElementById('tarih');
const ogunKutusu = document.getElementById('ogun');
const ogrenciFiyati = document.getElementById('ogrenci-fiyati');
const personelFiyati = document.getElementById('personel-fiyati');
const katalog = document.getElementById('katalog');
const kaydetDugme = document.getElementById('kaydet');
const mesaj = document.getElementById('mesaj');

let menuId = Number(new URLSearchParams(location.search).get('id')) || null;

function hataGoster(metin) {
  hataKutusu.textContent = metin;
  hataKutusu.hidden = false;
}

function mesajYaz(tur, metin) {
  mesaj.className = `kart-mesaj kart-mesaj-${tur}`;
  mesaj.textContent = metin;
  mesaj.hidden = false;
}

function secenekEkle(kutu, liste) {
  for (const oge of liste) {
    const s = el('option', null, oge.ad);
    s.value = oge.id;
    kutu.append(s);
  }
}

// Kategori kategori onay kutuları
function katalogCiz(kategoriler) {
  for (const k of kategoriler) {
    const grup = el('fieldset', 'yemek-grup');
    grup.append(el('legend', null, k.ad));
    for (const y of k.yemekler) {
      const etiket = el('label', 'yemek-secim');
      const kutu = el('input');
      kutu.type = 'checkbox';
      kutu.value = y.id;
      kutu.name = 'yemek';
      etiket.append(kutu, ` ${y.ad}`, el('span', 'rez-alt', ` · ${y.kalori} kcal${y.vejetaryen ? ' · V' : ''}`));
      grup.append(etiket);
    }
    katalog.append(grup);
  }
}

// Düzenleme modu: yemekhane, tarih ve öğün değiştirilemez (o menüye rezervasyon yapılmış olabilir)
function duzenlemeModu() {
  baslik.textContent = 'Menüyü düzenle';
  yemekhaneKutusu.disabled = true;
  tarihKutusu.disabled = true;
  ogunKutusu.disabled = true;
}

function menuyuDoldur(menu) {
  yemekhaneKutusu.value = menu.yemekhane_id;
  tarihKutusu.value = menu.tarih;
  ogunKutusu.value = menu.ogun_id;
  ogrenciFiyati.value = Number(menu.ogrenci_fiyati);
  personelFiyati.value = Number(menu.personel_fiyati);
  const secili = new Set(menu.yemekler);
  for (const kutu of form.querySelectorAll('input[name=yemek]')) {
    kutu.checked = secili.has(Number(kutu.value));
  }
}

// Boş kutu null gider; sunucu uygun mesajı döndürür
const sayiOku = (kutu) => (kutu.value === '' ? null : Number(kutu.value));

form.addEventListener('submit', async (olay) => {
  olay.preventDefault();
  mesaj.hidden = true;
  kaydetDugme.disabled = true;

  const govde = {
    ogrenci_fiyati: sayiOku(ogrenciFiyati),
    personel_fiyati: sayiOku(personelFiyati),
    yemekler: [...form.querySelectorAll('input[name=yemek]:checked')].map((k) => Number(k.value)),
  };
  let sonuc;
  if (menuId) {
    sonuc = await apiIstek(`/api/yonetim/menuler/${menuId}`, { yontem: 'PUT', govde });
  } else {
    Object.assign(govde, {
      yemekhane_id: Number(yemekhaneKutusu.value),
      ogun_id: Number(ogunKutusu.value),
      tarih: tarihKutusu.value,
    });
    sonuc = await apiIstek('/api/yonetim/menuler', { yontem: 'POST', govde });
  }
  kaydetDugme.disabled = false;

  if (!sonuc.ok) {
    mesajYaz('hata', sonuc.hata);
    return;
  }
  if (menuId) {
    mesajYaz('basari', 'Değişiklikler kaydedildi.');
  } else {
    // Oluşturulan menü artık bu sayfada düzenlenir; adres ?id= ile güncellenir
    menuId = sonuc.veri.menu_id;
    history.replaceState(null, '', `/yonetim-menu.html?id=${menuId}`);
    duzenlemeModu();
    mesajYaz('basari', 'Menü oluşturuldu.');
  }
});

async function acilis() {
  const kullanici = await gezinmeyiKur();
  if (!kullanici) return;

  // Seçenekler ve katalog; katalog ucu yönetici değilse 403 döner
  const [secenekler, yemekler] = await Promise.all([
    apiIstek('/api/menu/secenekler'),
    apiIstek('/api/yonetim/yemekler'),
  ]);
  if (!yemekler.ok) return hataGoster(yemekler.hata);
  if (!secenekler.ok) return hataGoster(secenekler.hata);

  secenekEkle(yemekhaneKutusu, secenekler.veri.yemekhaneler);
  secenekEkle(ogunKutusu, secenekler.veri.ogunler);
  katalogCiz(yemekler.veri.kategoriler);

  if (menuId) {
    const detay = await apiIstek(`/api/yonetim/menuler/${menuId}`);
    if (!detay.ok) return hataGoster(detay.hata);
    menuyuDoldur(detay.veri.menu);
    duzenlemeModu();
    if (!detay.veri.menu.duzenlenebilir) {
      // Sunucunun kararı: geçmiş menü. Form yalnızca okunur gösterilir.
      for (const oge of form.elements) oge.disabled = true;
      mesajYaz('hata', 'Geçmiş menüler düzenlenemez.');
    }
  }
  form.hidden = false;
}

acilis();
