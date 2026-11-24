// Değerlendirme: kullanılmış menüler; değerlendirilmişse puan ve yorum, değilse form.
// "Yalnızca kullanılmış menü", "puan 1–5", "yorum en fazla 500 karakter" kurallarını sunucu denetler.

const durum = document.getElementById('durum');
const hataKutusu = document.getElementById('hata');
const liste = document.getElementById('liste');

// 4 → '★★★★☆' (ekran okuyucu için "5 üzerinden 4 puan")
function yildizlar(puan) {
  const s = el('span', 'yildizlar', '★'.repeat(puan) + '☆'.repeat(5 - puan));
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', `5 üzerinden ${puan} puan`);
  return s;
}

// Verilmiş değerlendirmenin görünümü
function sonucGorunumu(puan, yorum) {
  const kutu = el('div', 'deg-sonuc');
  kutu.append(yildizlar(puan), el('p', yorum ? 'deg-yorum' : 'deg-yorum soluk', yorum ?? 'Yorum yazılmadı.'));
  return kutu;
}

// Yıldız seçimi: gizlenmiş radio düğmeleri (klavyeyle de seçilebilir).
// DOM'da 5'ten 1'e dizilir, CSS row-reverse ile 1'den 5'e görünür; böylece seçilen
// yıldızın solundakiler de "input:checked ~ label" ile boyanır.
function yildizSecici(menuId) {
  const grup = el('fieldset', 'yildiz-secici');
  grup.append(el('legend', null, 'Puanınız'));
  const satir = el('div', 'yildiz-satir');
  for (let n = 5; n >= 1; n--) {
    const girdi = el('input');
    girdi.type = 'radio';
    girdi.name = `puan-${menuId}`;
    girdi.value = n;
    girdi.id = `puan-${menuId}-${n}`;
    const etiket = el('label', null, '★');
    etiket.htmlFor = girdi.id;
    etiket.title = `${n} puan`;
    etiket.setAttribute('aria-label', `${n} puan`);
    satir.append(girdi, etiket);
  }
  grup.append(satir);
  return grup;
}

function degerlendirmeFormu(m) {
  const form = el('form', 'deg-form');
  form.noValidate = true;

  const yorumId = `yorum-${m.menu_id}`;
  const yorumEtiketi = el('label', null, 'Yorum (isteğe bağlı)');
  yorumEtiketi.htmlFor = yorumId;
  const yorumKutusu = el('textarea');
  yorumKutusu.id = yorumId;
  yorumKutusu.rows = 3;

  const dugme = el('button', 'dugme', 'Gönder');
  dugme.type = 'submit';
  const mesaj = el('p', 'kart-mesaj');
  mesaj.setAttribute('role', 'status');
  mesaj.hidden = true;

  form.append(yildizSecici(m.menu_id), yorumEtiketi, yorumKutusu, dugme, mesaj);

  form.addEventListener('submit', async (olay) => {
    olay.preventDefault();
    mesaj.hidden = true;
    dugme.disabled = true;

    const secili = form.querySelector('input[type=radio]:checked');
    const puan = secili ? Number(secili.value) : null;   // seçilmediyse sunucu uyarır
    const sonuc = await apiIstek('/api/degerlendirmeler', {
      yontem: 'POST',
      govde: { menu_id: m.menu_id, puan, yorum: yorumKutusu.value },
    });
    dugme.disabled = false;

    if (!sonuc.ok) {
      mesaj.className = 'kart-mesaj kart-mesaj-hata';
      mesaj.textContent = sonuc.hata;
      mesaj.hidden = false;
      return;
    }

    // Form, kaydedilen puan ve yorumla yer değiştirir (sunucunun döndürdüğü değerler)
    const basari = el('p', 'kart-mesaj kart-mesaj-basari', 'Değerlendirmeniz kaydedildi.');
    basari.setAttribute('role', 'status');
    form.replaceWith(sonucGorunumu(sonuc.veri.puan, sonuc.veri.yorum), basari);
  });

  return form;
}

function menuKarti(m) {
  const kart = el('article', 'deg-kart');
  kart.append(
    el('strong', null, gunBasligi(m.tarih)),
    el('span', 'rez-alt', `${m.yemekhane} · ${m.ogun}`),
  );
  kart.append(m.puan === null ? degerlendirmeFormu(m) : sonucGorunumu(m.puan, m.yorum));
  return kart;
}

async function yukle() {
  const sonuc = await apiIstek('/api/degerlendirmeler');
  if (!sonuc.ok) {
    durum.hidden = true;
    hataKutusu.textContent = sonuc.hata;
    hataKutusu.hidden = false;
    return;
  }
  const { menuler } = sonuc.veri;
  if (menuler.length === 0) {
    durum.textContent = 'Henüz kullandığınız bir menü yok.';
    return;
  }
  durum.hidden = true;
  liste.append(...menuler.map(menuKarti));
}

async function acilis() {
  const kullanici = await gezinmeyiKur();
  if (!kullanici) return;
  await yukle();
}

acilis();
