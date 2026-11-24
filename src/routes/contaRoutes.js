const express = require('express');
const contaController = require('../controllers/contaController');
const { autenticar, verificarDono } = require('../middlewares/auth');

const router = express.Router();

// Todas as rotas de conta são protegidas: não existe conta pública.
router.post('/conta', autenticar, contaController.criarConta);

// Passa dinheiro de uma conta da pessoa para outra (as duas manuais).
router.post('/conta/transferencia', autenticar, contaController.transferir);
router.get('/usuario/:id/conta', autenticar, verificarDono, contaController.listarContas);
router.put('/conta/:id', autenticar, contaController.atualizarConta);
router.delete('/conta/:id', autenticar, contaController.deletarConta);

module.exports = router;
