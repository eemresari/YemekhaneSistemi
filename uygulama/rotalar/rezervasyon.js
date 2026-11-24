const { Router } = require('express');
const rezervasyon = require('../controllers/rezervasyonController');
const girisGerekli = require('../ara/girisGerekli');

const router = Router();

router.use(girisGerekli);

router.get('/', rezervasyon.liste);
router.post('/', rezervasyon.yap);
router.post('/:id/iptal', rezervasyon.iptal);

module.exports = router;
