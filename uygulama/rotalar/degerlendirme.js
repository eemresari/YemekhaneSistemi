const { Router } = require('express');
const degerlendirme = require('../controllers/degerlendirmeController');
const girisGerekli = require('../ara/girisGerekli');

const router = Router();

router.use(girisGerekli);

router.get('/', degerlendirme.liste);
router.post('/', degerlendirme.kaydet);

module.exports = router;
