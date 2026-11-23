const { Router } = require('express');
const oturum = require('../controllers/oturumController');
const girisGerekli = require('../ara/girisGerekli');

const router = Router();

router.post('/giris', oturum.giris);
router.post('/cikis', oturum.cikis);
router.get('/ben', girisGerekli, oturum.ben);

module.exports = router;
