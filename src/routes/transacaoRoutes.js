const express = require('express');
const transacaoController = require('../controllers/transacaoController');
const { autenticar, verificarDono } = require('../middlewares/auth');

const router = express.Router();

router.post('/transacao', autenticar, transacaoController.criarTransacao);
router.get(
  '/usuario/:id/transacao',
  autenticar,
  verificarDono,
  transacaoController.listarTransacoes
);

module.exports = router;
