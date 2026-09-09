const express = require('express');
const metaController = require('../controllers/metaController');
const { autenticar, verificarDono } = require('../middlewares/auth');

const router = express.Router();

router.post('/meta', autenticar, metaController.criarMeta);
router.get('/usuario/:id/meta', autenticar, verificarDono, metaController.listarMetas);
router.put('/meta/:id', autenticar, metaController.atualizarMeta);
router.delete('/meta/:id', autenticar, metaController.deletarMeta);

module.exports = router;
