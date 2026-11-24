// Profil: kullanıcı alerjenlerini seçer (Aşama 4). Menüdeki uyarı kararını sunucu verir;
// bu sayfa yalnızca listeyi gösterir ve seçimi kaydeder.

const form = document.getElementById('alerjen-formu');
const liste = document.getElementById('alerjen-liste');
const kaydet = document.getElementById('kaydet');
const mesaj = document.getElementById('mesaj');
const durum = document.getElementById('durum');
const hataKutusu = document.getElementById('hata');

function mesajYaz(tur, metin) {
  mesaj.className = `kart-mesaj kart-mesaj-${tur}`;
  mesaj.textContent = metin;
  mesaj.hidden = false;
}

// Her alerjen için bir onay kutusu
function alerjenKutusu(alerjen, secili) {
  const etiket = el('label');
  const kutu = el('input');
  kutu.type = 'checkbox';
  kutu.name = 'alerjen';
  kutu.value = alerjen.id;
  kutu.checked = secili;
  etiket.append(kutu, alerjen.ad);
  return etiket;
}

async function yukle() {
  const sonuc = await apiIstek('/api/profil');
  durum.hidden = true;
  if (!sonuc.ok) {
    hataKutusu.textContent = sonuc.hata;
    hataKutusu.hidden = false;
    return;
  }
  const secili = new Set(sonuc.veri.secili);
  liste.replaceChildren(...sonuc.veri.alerjenler.map((a) => alerjenKutusu(a, secili.has(a.id))));
  form.hidden = false;
}

form.addEventListener('submit', async (olay) => {
  olay.preventDefault();
  kaydet.disabled = true;               // çift tıklamayla iki istek gitmesin
  mesaj.hidden = true;

  const alerjenler = [...form.querySelectorAll('input[name="alerjen"]:checked')]
    .map((kutu) => Number(kutu.value));
  const sonuc = await apiIstek('/api/profil/alerjenler', { yontem: 'PUT', govde: { alerjenler } });
  kaydet.disabled = false;

  if (!sonuc.ok) {
    mesajYaz('hata', sonuc.hata);
    return;
  }
  const adlar = sonuc.veri.alerjenler.map((a) => a.ad);
  mesajYaz('basari', adlar.length
    ? `Kaydedildi. Alerjenleriniz: ${adlar.join(', ')}`
    : 'Kaydedildi. Seçili alerjen yok.');
});

async function acilis() {
  const kullanici = await gezinmeyiKur();
  if (!kullanici) return;
  await yukle();
}

acilis();
