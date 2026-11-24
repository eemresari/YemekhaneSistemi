const express = require('express');
const session = require('express-session');
const oturumRotalari = require('./rotalar/oturum');
const menuRotalari = require('./rotalar/menu');

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

// Beklenmeyen hatalar: ayrıntı günlüğe yazılır, kullanıcıya genel mesaj gider
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ hata: 'Beklenmeyen bir hata oluştu.' });
});

app.listen(PORT, () => {
  console.log(`Uygulama ${PORT} portunda dinliyor`);
});
