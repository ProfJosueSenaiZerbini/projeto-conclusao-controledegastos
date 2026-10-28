const express = require('express');
const transacaoController = require('../controllers/transacaoController');
const { autenticar, verificarDono } = require('../middlewares/auth');

const router = express.Router();

router.post('/transacao', autenticar, transacaoController.criarTransacao);

// Marca um gasto como pago ou não pago. PATCH porque muda só uma parte da
// transação (a data de pagamento), e não a transação inteira.
router.patch('/transacao/:id/pagamento', autenticar, transacaoController.marcarPagamento);
router.get(
  '/usuario/:id/transacao',
  autenticar,
  verificarDono,
  transacaoController.listarTransacoes
);

module.exports = router;
