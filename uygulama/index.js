const express = require('express');

const app = express();
const PORT = 8000;

// Sağlık ucu: uygulama ayakta mı, Apache üzerinden ulaşılabiliyor mu?
app.get('/api/saglik', (req, res) => {
  res.json({ durum: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Uygulama ${PORT} portunda dinliyor`);
});
