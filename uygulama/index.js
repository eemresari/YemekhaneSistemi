const express = require('express');
const session = require('express-session');
const oturumRotalari = require('./rotalar/oturum');
const menuRotalari = require('./rotalar/menu');
const rezervasyonRotalari = require('./rotalar/rezervasyon');
const bakiyeRotalari = require('./rotalar/bakiye');
const degerlendirmeRotalari = require('./rotalar/degerlendirme');
const yonetimRotalari = require('./rotalar/yonetim');
const redis = require('./veri/redis');

const app = express();
const PORT = 8000;

if (!process.env.OTURUM_SIRRI) {
  throw new Error('OTURUM_SIRRI ortam değişkeni tanımlı değil.');
}

// İstek gövdesindeki JSON'u req.body'ye çevirir
app.use(express.json());

// Oturum: tarayıcıya yalnızca imzalı bir kimlik çerezi gider, bilgiler sunucuda durur.
// Şimdilik bellekte tutulur; Aşama 3'te Redis'e taşınacak.
app.use(session({
  name: 'yemekhane.sid',
  secret: process.env.OTURUM_SIRRI,   // çerezi imzalamak için
  resave: false,                      // değişmeyen oturumu yeniden kaydetme
  saveUninitialized: false,           // giriş yapmayana boş oturum açma
  cookie: {
    httpOnly: true,                   // JavaScript çerezi okuyamaz
    sameSite: 'lax',                  // başka sitelerden gelen isteklerde gönderilmez
    maxAge: 2 * 60 * 60 * 1000,       // 2 saat
  },
}));

// Sağlık ucu: uygulama ayakta mı, Apache üzerinden ulaşılabiliyor mu?
app.get('/api/saglik', (req, res) => {
  res.json({ durum: 'ok' });
});

app.use('/api', oturumRotalari);
app.use('/api/menu', menuRotalari);
app.use('/api/rezervasyonlar', rezervasyonRotalari);
app.use('/api/bakiye', bakiyeRotalari);
app.use('/api/degerlendirmeler', degerlendirmeRotalari);
app.use('/api/yonetim', yonetimRotalari);

const DB_BAGLANTI_HATALARI = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST',
]);

// Hata ara katmanı: Controller'lardan gelen bütün hatalar buraya düşer
app.use((err, req, res, next) => {
  // Stored procedure bir iş kuralını reddetti (SIGNAL SQLSTATE '45000').
  // Mesaj Türkçe ve kullanıcıya yöneliktir; olduğu gibi arayüze iletilir.
  if (err.sqlState === '45000') {
    return res.status(409).json({ hata: err.sqlMessage });
  }
  // Bozuk JSON gövdesi (express.json 400 hatası verir)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ hata: 'İstek gövdesi geçerli JSON değil.' });
  }
  // Veritabanına bağlanılamadı (sunucu kapalı, ad çözülemedi, bağlantı koptu)
  if (DB_BAGLANTI_HATALARI.has(err.code)) {
    console.error(`Veritabanı bağlantı hatası: ${err.code}`);
    return res.status(503).json({ hata: 'Veritabanına şu an ulaşılamıyor. Lütfen biraz sonra tekrar deneyin.' });
  }
  // Beklenmeyen hatalar: ayrıntı günlüğe yazılır, kullanıcıya genel mesaj gider
  console.error(err);
  res.status(500).json({ hata: 'Beklenmeyen bir hata oluştu.' });
});

// Önce Redis'e bağlan, sonra istek kabul etmeye başla.
// (compose, uygulamayı Redis "healthy" olduktan sonra başlatır.)
async function basla() {
  await redis.connect();
  app.listen(PORT, () => {
    console.log(`Uygulama ${PORT} portunda dinliyor`);
  });
}

basla();
