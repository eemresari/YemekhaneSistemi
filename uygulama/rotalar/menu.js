const { Router } = require('express');
const menu = require('../controllers/menuController');
const girisGerekli = require('../ara/girisGerekli');

const router = Router();

// Bu dosyadaki tüm rotalar giriş gerektirir: ara katman Controller'dan önce çalışır
router.use(girisGerekli);

router.get('/secenekler', menu.secenekler);
router.get('/gunluk', menu.gunluk);
router.get('/haftalik', menu.haftalik);

module.exports = router;
