const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const escalasController = require('../controllers/escalasController');

// 🔒 TODAS protegidas
router.get('/', auth, escalasController.getEscalas);
router.post('/', auth, escalasController.createEscala);
router.delete('/:id', auth, escalasController.deleteEscala);

module.exports = router;