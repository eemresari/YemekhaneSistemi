// Bir menüyü kart olarak çizer. Günün menüsü ve haftalık sayfa aynı kartı kullanır.
// Bütün kararlar (fiyat, rezervasyon açık mı) sunucudan hazır gelir; burada yalnızca gösterilir.
// Biçim fonksiyonları (paraBicimi, saatBicimi) bicim.js'tedir.

function yemekSatiri(yemek) {
  const li = el('li');

  const satir = el('div', 'yemek-satir');
  satir.append(el('span', 'yemek-ad', yemek.ad), el('span', 'yemek-kalori', `${yemek.kalori} kcal`));
  li.append(satir);

  const ek = el('div', 'yemek-ek');
  ek.append(el('span', null, yemek.kategori));
  if (yemek.vejetaryen) {
    ek.append(' ', el('span', 'etiket etiket-vejetaryen', 'Vejetaryen'));
  }
  if (yemek.alerjenler.length > 0) {
    ek.append(el('span', null, ` · Alerjen: ${yemek.alerjenler.join(', ')}`));
  }
  li.append(ek);

  // Aşama 4: yemekte kullanıcının profilinde seçtiği alerjen var mı? (Kararı sunucu verdi.)
  if (yemek.uyari.length > 0) {
    li.classList.add('yemek-uyarili');
    li.append(el('p', 'alerjen-uyari', `⚠ Alerjeniniz var: ${yemek.uyari.join(', ')}`));
  }
  return li;
}

function menuKartiOlustur(menu) {
  const kart = el('article', 'menu-kart');

  const ust = el('div', 'menu-kart-ust');
  ust.append(el('h2', null, menu.ogun), el('span', 'fiyat', paraBicimi(menu.fiyat)));
  kart.append(ust, el('p', 'menu-kart-yemekhane', menu.yemekhane));
  // Aşama 4: yarım porsiyon yalnızca sunucu fiyat gönderdiyse (kahvaltıda gelmez)
  if (menu.yarim_fiyat) {
    kart.append(el('p', 'yarim-fiyat', `Yarım porsiyon: ${paraBicimi(menu.yarim_fiyat)}`));
  }

  const liste = el('ul', 'yemekler');
  for (const yemek of menu.yemekler) liste.append(yemekSatiri(yemek));
  kart.append(liste);

  const alt = el('div', 'menu-kart-alt');
  const bilgi = (etiket, deger) => {
    const s = el('span', null, `${etiket}: `);
    s.append(el('strong', null, deger));
    return s;
  };
  alt.append(
    bilgi('Toplam', `${menu.toplam_kalori} kcal`),
    bilgi('Boş yer', `${menu.bos_yer} / ${menu.kapasite}`),
    bilgi('Son rezervasyon', saatBicimi(menu.rezervasyon_son)),
  );
  kart.append(alt);
  return kart;
}
