// Rezervasyonlarım: aktif, kullanıldı ve iptal durumları; süresi dolmamışsa iptal.
// İptal edilebilir mi kararı sunucudan gelir (iptal_edilebilir); burada yalnızca gösterilir.

const DURUM_ADI = { aktif: 'Aktif', kullanildi: 'Kullanıldı', iptal: 'İptal edildi' };

const durum = document.getElementById('durum');
const hataKutusu = document.getElementById('hata');
const liste = document.getElementById('liste');

function durumEtiketi(etiket, durumKodu) {
  etiket.className = `durum-etiketi durum-${durumKodu}`;
  etiket.textContent = DURUM_ADI[durumKodu] ?? durumKodu;
}

function rezervasyonSatiri(r) {
  const satir = el('article', 'rez-satir');

  const bilgi = el('div', 'rez-bilgi');
  bilgi.append(
    el('strong', null, gunBasligi(r.tarih)),
    el('span', 'rez-alt', `${r.yemekhane} · ${r.ogun}`),
  );

  const sag = el('div', 'rez-sag');
  const etiket = el('span');
  durumEtiketi(etiket, r.durum);
  sag.append(el('span', 'rez-ucret', paraBicimi(r.ucret)), etiket);

  satir.append(bilgi, sag);

  if (r.iptal_edilebilir) {
    const eylem = el('div', 'rez-eylem');
    const dugme = el('button', 'dugme dugme-ikincil', 'İptal et');
    dugme.type = 'button';
    const mesaj = el('p', 'kart-mesaj');
    mesaj.setAttribute('role', 'status');
    mesaj.hidden = true;
    eylem.append(dugme, mesaj);
    satir.append(eylem);

    dugme.addEventListener('click', async () => {
      const onay = confirm(`${gunBasligi(r.tarih)} ${r.ogun} rezervasyonu iptal edilsin mi?`);
      if (!onay) return;

      dugme.disabled = true;
      const sonuc = await apiIstek(`/api/rezervasyonlar/${r.id}/iptal`, { yontem: 'POST' });

      if (!sonuc.ok) {
        // Yordamın mesajı olduğu gibi ("Bu rezervasyon için iptal süresi doldu." gibi)
        mesaj.className = 'kart-mesaj kart-mesaj-hata';
        mesaj.textContent = sonuc.hata;
        mesaj.hidden = false;
        dugme.disabled = false;
        return;
      }

      // Liste yeniden çekilmez (replikasyon gecikmesi); yalnızca bu satır güncellenir.
      // İade ve bakiye yordamın kaynakta hesapladığı değerlerdir.
      durumEtiketi(etiket, 'iptal');
      dugme.remove();
      mesaj.className = 'kart-mesaj kart-mesaj-basari';
      mesaj.textContent = `İptal edildi. İade ${paraBicimi(sonuc.veri.iade)} · Bakiye ${paraBicimi(sonuc.veri.bakiye)}`;
      mesaj.hidden = false;
    });
  }

  return satir;
}

async function yukle() {
  const sonuc = await apiIstek('/api/rezervasyonlar');
  if (!sonuc.ok) {
    durum.hidden = true;
    hataKutusu.textContent = sonuc.hata;
    hataKutusu.hidden = false;
    return;
  }

  const { rezervasyonlar } = sonuc.veri;
  if (rezervasyonlar.length === 0) {
    durum.textContent = 'Henüz rezervasyonunuz yok.';
    return;
  }
  durum.hidden = true;
  liste.append(...rezervasyonlar.map(rezervasyonSatiri));
}

async function acilis() {
  const kullanici = await gezinmeyiKur();
  if (!kullanici) return;
  await yukle();
}

acilis();
