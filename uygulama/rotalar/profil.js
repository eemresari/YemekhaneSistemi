const { Router } = require('express');
const profil = require('../controllers/profilController');
const girisGerekli = require('../ara/girisGerekli');

const router = Router();

router.use(girisGerekli);

router.get('/', profil.getir);
router.put('/alerjenler', profil.alerjenleriKaydet);

module.exports = router;
