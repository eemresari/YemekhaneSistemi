const { Router } = require('express');
const bakiye = require('../controllers/bakiyeController');
const girisGerekli = require('../ara/girisGerekli');

const router = Router();

router.use(girisGerekli);

router.get('/', bakiye.ozet);
router.post('/yukle', bakiye.yukle);

module.exports = router;
