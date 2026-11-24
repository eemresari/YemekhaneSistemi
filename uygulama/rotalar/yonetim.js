const { Router } = require('express');
const yonetim = require('../controllers/yonetimController');
const yoneticiGerekli = require('../ara/yoneticiGerekli');

const router = Router();

// Bu dosyadaki bütün uçlar yalnızca yönetici içindir
router.use(yoneticiGerekli);

router.get('/menuler', yonetim.menuler);
router.get('/yemekler', yonetim.yemekler);
router.get('/menuler/:id', yonetim.menuDetay);
router.post('/menuler', yonetim.olustur);
router.put('/menuler/:id', yonetim.guncelle);

module.exports = router;
