const express = require('express');
const contaController = require('../controllers/contaController');
const { autenticar, verificarDono } = require('../middlewares/auth');

const router = express.Router();

// Todas as rotas de conta são protegidas: não existe conta pública.
router.post('/conta', autenticar, contaController.criarConta);
router.get('/usuario/:id/conta', autenticar, verificarDono, contaController.listarContas);
router.put('/conta/:id', autenticar, contaController.atualizarConta);
router.delete('/conta/:id', autenticar, contaController.deletarConta);

module.exports = router;
